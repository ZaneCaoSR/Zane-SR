"""
main.py - FastAPI 后端入口
提供微信小程序天气提醒的后端接口：订阅管理、天气查询、手动触发推送
"""
from logger import logger
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, Security, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from database import init_db, add_subscriber
from auth import verify_api_key
from database import remove_subscriber, get_all_subscribers, get_subscriber
from database import get_cities, set_cities, add_city_to_subscription, remove_city_from_subscription
from weather import get_weather, get_city_id, get_weather_by_city_id, get_weather_indices, get_hourly_forecast, get_weather_alerts
from config import QWEATHER_GEO_URL
from scheduler import start_scheduler, stop_scheduler, push_daily_weather
from retry import get_retry_queue, clear_retry_queue, retry_failed_pushes
from jwt_helper import get_jwt_token


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期管理：启动时初始化DB和调度器，关闭时停止调度器"""
    init_db()
    start_scheduler()
    yield
    stop_scheduler()


app = FastAPI(
    title="Zane-SR 后端",
    description="微信小程序天气提醒服务",
    version="1.0.0",
    lifespan=lifespan,
)

# 限流配置：使用客户端 IP 作为 key
limiter = Limiter(key_func=get_remote_address)

# 将限流器添加到 app 状态
app.state.limiter = limiter

# 限流异常处理器
@app.exception_handler(RateLimitExceeded)
async def rate_limit_handler(request: Request, exc: RateLimitExceeded):
    return JSONResponse(
        status_code=429,
        content={"detail": "请求过于频繁，请稍后再试"}
    )


# ===== 请求/响应模型 =====

class SubscribeRequest(BaseModel):
    openid: str   # 微信用户 openid（由小程序登录获取）
    city: str = "杭州"  # 订阅城市


class UnsubscribeRequest(BaseModel):
    openid: str


class SubscribeMultipleRequest(BaseModel):
    openid: str
    cities: list[dict]  # [{"city": "杭州", "cityId": "101210101", "pushTime": "08:00"}]


class UnsubscribeCityRequest(BaseModel):
    openid: str
    city: str


# ===== 路由 =====

@app.post("/api/subscribe", summary="订阅天气提醒")
async def subscribe(req: SubscribeRequest):
    """
    用户订阅天气提醒
    小程序端：用户授权订阅消息后调用此接口传入 openid 和城市
    """
    if not req.openid:
        raise HTTPException(status_code=400, detail="openid 不能为空")

    is_new = add_subscriber(req.openid, req.city)
    return {
        "success": True,
        "is_new": is_new,
        "message": f"已成功订阅 {req.city} 的每日天气提醒" if is_new else f"已更新订阅城市为 {req.city}",
    }


@app.post("/api/unsubscribe", summary="取消订阅")
async def unsubscribe(req: UnsubscribeRequest):
    """取消用户的天气订阅"""
    ok = remove_subscriber(req.openid)
    if not ok:
        raise HTTPException(status_code=404, detail="该用户未找到订阅记录")
    return {"success": True, "message": "已取消订阅"}


# ===== 多城市订阅 API =====

@app.post("/api/subscribe-multiple", summary="订阅多城市")
async def subscribe_multiple(req: SubscribeMultipleRequest):
    """
    用户订阅多个城市的天气提醒
    """
    if not req.openid:
        raise HTTPException(status_code=400, detail="openid 不能为空")
    if not req.cities:
        raise HTTPException(status_code=400, detail="cities 不能为空")

    # 保存多城市订阅
    set_cities(req.openid, req.cities)
    return {
        "success": True,
        "message": f"已成功订阅 {len(req.cities)} 个城市的每日天气提醒",
        "cities": req.cities
    }


@app.post("/api/unsubscribe-city", summary="取消单个城市订阅")
async def unsubscribe_city(req: UnsubscribeCityRequest):
    """
    取消指定城市的订阅，保留其他城市
    """
    if not req.openid:
        raise HTTPException(status_code=400, detail="openid 不能为空")
    if not req.city:
        raise HTTPException(status_code=400, detail="city 不能为空")

    cities = remove_city_from_subscription(req.openid, req.city)
    return {
        "success": True,
        "message": f"已取消 {req.city} 的订阅",
        "cities": cities
    }


@app.get("/api/subscribed-cities", summary="获取已订阅城市列表")
async def get_subscribed_cities(openid: str):
    """
    获取用户已订阅的城市列表
    """
    if not openid:
        raise HTTPException(status_code=400, detail="openid 不能为空")

    cities = get_cities(openid)
    return {
        "subscribed": len(cities) > 0,
        "cities": cities
    }


@app.get("/api/weather-by-id/{city_id}", summary="通过城市ID查询天气")
async def query_weather_by_id(city_id: str):
    """
    通过城市ID查询天气（使用30分钟缓存）
    """
    weather = await get_weather_by_city_id(city_id)
    if not weather:
        raise HTTPException(status_code=404, detail=f"无法获取城市ID {city_id} 的天气数据")
    return weather


@app.get("/api/weather-indices/{city_id}", summary="获取生活指数")
async def get_indices(city_id: str):
    """
    获取生活指数（紫外线、穿衣、洗车等）
    """
    indices = await get_weather_indices(city_id)
    if not indices:
        raise HTTPException(status_code=404, detail=f"无法获取城市ID {city_id} 的生活指数")
    return indices


@app.get("/api/cities/search", summary="搜索城市")
async def search_cities(keyword: str):
    """
    搜索城市（和风天气 GeoAPI）
    """
    if not keyword or len(keyword) < 1:
        return {"cities": []}

    token = get_jwt_token()
    if not token:
        return {"cities": []}

    headers = {"Authorization": f"Bearer {token}"}

    try:
        import httpx
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                QWEATHER_GEO_URL,
                params={"location": keyword, "lang": "zh", "number": 20},
                headers=headers
            )
            data = resp.json()

        if data.get("code") == "200" and data.get("location"):
            cities = [
                {
                    "id": loc["id"],
                    "name": loc["name"],
                    "province": loc.get("adm1", ""),
                    "city": loc["name"],
                    "cityId": loc["id"]
                }
                for loc in data["location"]
            ]
            return {"cities": cities}
        return {"cities": []}
    except Exception as e:
        logger.warning(f"[CitySearch] 搜索失败: {e}")
        return {"cities": []}


@app.get("/api/subscribers", dependencies=[Security(verify_api_key)], summary="获取所有订阅者（管理用）")
@limiter.limit("30/minute")
async def list_subscribers(request: Request):
    """查看所有激活的订阅用户（仅供管理调试）"""
    subscribers = get_all_subscribers()
    return {"total": len(subscribers), "subscribers": subscribers}


@app.get("/api/subscriber/{openid}", summary="查询单个订阅者状态")
async def get_subscriber_status(openid: str):
    """查询指定 openid 的订阅状态，供小程序首页判断是否已订阅"""
    user = get_subscriber(openid)
    if not user:
        return {"subscribed": False}
    # 返回多城市订阅信息
    cities = get_cities(openid)
    return {
        "subscribed": user["is_active"] == 1,
        "city": user["city"],
        "cities": cities
    }


@app.get("/api/weather/{city_name}", summary="查询天气（调试用）")
async def query_weather(city_name: str):
    """手动查询指定城市天气，用于测试天气 API 是否正常"""
    weather = await get_weather(city_name)
    if not weather:
        raise HTTPException(status_code=404, detail=f"无法获取 {city_name} 的天气数据，请检查城市名或 API Key")
    return weather


# ==================== 照片管理 API ====================

import os
import uuid
from pathlib import Path
from fastapi import UploadFile, File
from fastapi.responses import FileResponse

# 照片存储目录
PHOTOS_DIR = Path("/root/projects/weather-mini/photos")
PHOTOS_DIR.mkdir(exist_ok=True)

# 照片元数据存储文件
PHOTOS_DB = Path("/root/projects/weather-mini/data/photos.json")
if not PHOTOS_DB.exists():
    PHOTOS_DB.write_text("[]")

def load_photos():
    import json
    return json.loads(PHOTOS_DB.read_text())

def save_photos(photos):
    import json
    PHOTOS_DB.write_text(json.dumps(photos, ensure_ascii=False, indent=2))


@app.post("/api/photo/upload", summary="上传照片")
async def upload_photo(file: UploadFile = File(...)):
    """上传照片到服务器"""
    # 生成唯一文件名
    ext = file.filename.split('.')[-1] if '.' in file.filename else 'jpg'
    filename = f"{uuid.uuid4()}.{ext}"
    filepath = PHOTOS_DIR / filename
    
    # 保存文件
    content = await file.read()
    filepath.write_bytes(content)
    
    # 保存元数据
    photos = load_photos()
    photo_id = str(uuid.uuid4())
    photo_data = {
        "id": photo_id,
        "filename": filename,
        "original_name": file.filename,
        "size": len(content),
        "created_at": str(datetime.now()),
        "remark": "",
        "tags": [],
        "ai_result": None
    }
    photos.append(photo_data)
    save_photos(photos)
    
    return {
        "success": True,
        "photo_id": photo_id,
        "filename": filename,
        "url": f"/api/photo/{filename}"
    }


@app.get("/api/photo/{filename}", summary="获取照片")
async def get_photo(filename: str):
    """获取照片文件"""
    filepath = PHOTOS_DIR / filename
    if not filepath.exists():
        raise HTTPException(status_code=404, detail="照片不存在")
    return FileResponse(filepath)


@app.get("/api/photos", summary="获取照片列表")
async def get_photos():
    """获取所有照片列表"""
    photos = load_photos()
    # 返回倒序排列（最新的在前）
    photos.sort(key=lambda x: x.get("created_at", ""), reverse=True)
    return {"photos": photos}


@app.delete("/api/photo/{photo_id}", summary="删除照片")
async def delete_photo(photo_id: str):
    """删除照片"""
    photos = load_photos()
    photo_to_delete = None
    for photo in photos:
        if photo["id"] == photo_id:
            photo_to_delete = photo
            break
    
    if not photo_to_delete:
        raise HTTPException(status_code=404, detail="照片不存在")
    
    # 删除文件
    filepath = PHOTOS_DIR / photo_to_delete["filename"]
    if filepath.exists():
        filepath.unlink()
    
    # 删除元数据
    photos = [p for p in photos if p["id"] != photo_id]
    save_photos(photos)
    
    return {"success": True}


@app.put("/api/photo/{photo_id}", summary="更新照片信息")
async def update_photo(photo_id: str, request: Request):
    """更新照片备注和标签"""
    body = await request.json()
    photos = load_photos()

    for photo in photos:
        if photo["id"] == photo_id:
            photo["remark"] = body.get("remark", photo.get("remark", ""))
            # 更新标签
            if "tags" in body:
                photo["tags"] = body["tags"]
            save_photos(photos)
            return {"success": True, "photo": photo}

    raise HTTPException(status_code=404, detail="照片不存在")


@app.post("/api/photo/{photo_id}/analyze", summary="AI分析照片")
async def analyze_photo(photo_id: str):
    """AI分析照片，自动生成标签"""
    photos = load_photos()

    for photo in photos:
        if photo["id"] == photo_id:
            # 模拟AI分析结果（实际项目中可接入腾讯云图像识别等API）
            import random
            emotions = ["开心", "惊讶", "困倦", "好奇", "平静"]
            actions = ["抬头", "翻身", "爬行", "走路", "吃饭", "睡觉", "玩耍"]
            milestones = ["百天", "周岁", "长牙", "会坐", "会站"]
            scenes = ["室内", "户外", "商场", "公园", "家里", "海边"]
            weathers = ["晴天", "阴天", "雨天", "雪天"]

            # 随机生成标签
            tags = [
                {"type": "emotion", "value": random.choice(emotions), "confidence": round(random.uniform(0.8, 0.98), 2)},
                {"type": "action", "value": random.choice(actions), "confidence": round(random.uniform(0.7, 0.95), 2)},
                {"type": "milestone", "value": random.choice(milestones), "confidence": round(random.uniform(0.6, 0.9), 2)} if random.random() > 0.5 else None,
                {"type": "scene", "value": random.choice(scenes), "confidence": round(random.uniform(0.8, 0.95), 2)},
                {"type": "weather", "value": random.choice(weathers), "confidence": round(random.uniform(0.8, 0.95), 2)},
            ]
            # 过滤掉None值
            tags = [t for t in tags if t is not None]

            photo["tags"] = tags
            photo["ai_result"] = {"analyzed_at": str(datetime.now())}
            save_photos(photos)
            return {"success": True, "tags": tags}

    raise HTTPException(status_code=404, detail="照片不存在")


@app.post("/api/push/now", dependencies=[Security(verify_api_key)], summary="立即触发推送（测试用）")
@limiter.limit("30/minute")
async def trigger_push(request: Request):
    """手动触发一次天气推送，用于测试推送链路"""
    await push_daily_weather()
    return {"success": True, "message": "推送任务已触发"}



@app.get("/api/retry/queue", summary="获取重试队列")
@limiter.limit("30/minute")
async def get_queue(request: Request, dependencies=[Security(verify_api_key)]):
    """查看当前重试队列"""
    return {"queue": get_retry_queue()}


@app.post("/api/retry/now", summary="立即重试")
@limiter.limit("30/minute")
async def do_retry(request: Request, dependencies=[Security(verify_api_key)]):
    """手动触发重试"""
    count = await retry_failed_pushes()
    return {"success": True, "retry_success": count}


@app.delete("/api/retry/queue", summary="清空重试队列")
@limiter.limit("30/minute")
async def clear_queue(request: Request, dependencies=[Security(verify_api_key)]):
    """清空重试队列"""
    clear_retry_queue()
    return {"success": True, "message": "重试队列已清空"}

@app.get("/", summary="健康检查")
async def health():
    """增强健康检查：检查数据库、配置和外部API连通性"""
    status = {"status": "ok", "service": "Zane-SR Backend"}
    
    # 检查数据库
    try:
        from database import get_connection
        conn = get_connection()
        conn.execute("SELECT 1").fetchone()
        conn.close()
        status["database"] = "ok"
    except Exception as e:
        status["database"] = "error"
        status["error"] = str(e)
        status["status"] = "degraded"
    
    # 检查配置
    from config import WECHAT_APP_ID, WECHAT_APP_SECRET, QWEATHER_API_KEY
    status["config"] = {
        "wechat": "configured" if WECHAT_APP_ID != "YOUR_WECHAT_APP_ID" else "missing",
        "qweather": "configured" if QWEATHER_API_KEY != "YOUR_QWEATHER_API_KEY" else "missing",
    }
    
    # 检查微信 API 连通性
    try:
        import httpx
        from config import WECHAT_APP_ID, WECHAT_APP_SECRET
        if WECHAT_APP_ID != "YOUR_WECHAT_APP_ID" and WECHAT_APP_SECRET != "YOUR_WECHAT_APP_SECRET":
            # 尝试获取微信 access_token
            token_url = f"https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid={WECHAT_APP_ID}&secret={WECHAT_APP_SECRET}"
            async with httpx.AsyncClient(timeout=5) as client:
                resp = await client.get(token_url)
                data = resp.json()
                if "access_token" in data:
                    status["wechat_api"] = "ok"
                else:
                    status["wechat_api"] = f"error: {data.get('errmsg', 'unknown')}"
        else:
            status["wechat_api"] = "not_configured"
    except Exception as e:
        status["wechat_api"] = f"error: {str(e)}"
        status["status"] = "degraded"
    
    # 检查和风天气 API 连通性
    try:
        import httpx
        from config import QWEATHER_API_KEY
        if QWEATHER_API_KEY != "YOUR_QWEATHER_API_KEY":
            weather_url = f"https://devapi.qweather.com/v7/weather/now?location=101010100&key={QWEATHER_API_KEY}"
            async with httpx.AsyncClient(timeout=5) as client:
                resp = await client.get(weather_url)
                if resp.status_code == 200:
                    data = resp.json()
                    if data.get("code") == "200":
                        status["qweather_api"] = "ok"
                    else:
                        status["qweather_api"] = f"error: API code {data.get('code')}"
                else:
                    status["qweather_api"] = f"error: HTTP {resp.status_code}"
        else:
            status["qweather_api"] = "not_configured"
    except Exception as e:
        status["qweather_api"] = f"error: {str(e)}"
        status["status"] = "degraded"
    
    return status


# ===== 微信登录：code 换 openid =====

class LoginRequest(BaseModel):
    code: str  # 小程序 wx.login() 返回的临时凭证

@app.post('/api/login', summary='微信登录，code 换 openid')
async def wechat_login(req: LoginRequest):
    '''
    前端调用 wx.login() 获取 code，传入此接口换取 openid
    注意：openid 敏感，仅在后端处理，不返回给前端存储
    '''
    import httpx
    from config import WECHAT_APP_ID, WECHAT_APP_SECRET
    url = 'https://api.weixin.qq.com/sns/jscode2session'
    params = {
        'appid': WECHAT_APP_ID,
        'secret': WECHAT_APP_SECRET,
        'js_code': req.code,
        'grant_type': 'authorization_code',
    }
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(url, params=params)
        data = resp.json()
    
    if 'openid' not in data:
        raise HTTPException(status_code=400, detail=f'获取 openid 失败: {data}')
    
    return {'openid': data['openid']}


# ===== GitHub Webhook 自动部署 =====
import hmac
import hashlib
import subprocess

GITHUB_WEBHOOK_SECRET = os.getenv("GITHUB_WEBHOOK_SECRET", "")

@app.post("/webhook/github", summary="GitHub Webhook 自动部署")
async def github_webhook(request: Request):
    """接收 GitHub push 事件，自动 pull 最新代码并重启服务"""
    # 验证签名
    signature = request.headers.get("X-Hub-Signature-256", "")
    body = await request.body()

    if GITHUB_WEBHOOK_SECRET:
        expected = "sha256=" + hmac.new(
            GITHUB_WEBHOOK_SECRET.encode(),
            body,
            hashlib.sha256
        ).hexdigest()
        if not hmac.compare_digest(signature, expected):
            raise HTTPException(status_code=403, detail="Invalid signature")

    payload = await request.json() if not body else __import__("json").loads(body)
    ref = payload.get("ref", "")
    branch = ref.replace("refs/heads/", "")

    logger.info(f"[Webhook] 收到 push 事件，分支: {branch}")

    # 只响应目标分支
    target_branch = "feat/cream-style-ui"
    if branch != target_branch:
        return {"status": "skipped", "reason": f"branch {branch} not watched"}

    # 拉取最新代码并重启
    project_dir = "/root/projects/weather-mini"
    task_results = []
    try:
        pull = subprocess.run(
            ["git", "pull", "origin", target_branch],
            cwd=project_dir, capture_output=True, text=True, timeout=60
        )
        logger.info(f"[Webhook] git pull: {pull.stdout.strip()}")

        restart = subprocess.run(
            ["pm2", "restart", "weather-mini"],
            capture_output=True, text=True, timeout=30
        )
        logger.info(f"[Webhook] pm2 restart: {restart.returncode}")

        # 解析 commit message 中的 [task] 指令
        commits = payload.get("commits", [])
        for commit in commits:
            msg = commit.get("message", "")
            tasks = _parse_tasks(msg)
            for task in tasks:
                result = _execute_task(task, project_dir)
                task_results.append(result)
                logger.info(f"[Webhook] 执行任务: {task['type']} → {result['status']}")

        # 发送 Telegram 通知
        _notify_telegram(branch, commits, task_results)

        return {
            "status": "ok",
            "branch": branch,
            "pull_output": pull.stdout.strip(),
            "restarted": restart.returncode == 0,
            "tasks": task_results
        }
    except Exception as e:
        logger.error(f"[Webhook] 自动部署失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))


def _parse_tasks(commit_message: str) -> list:
    """从 commit message 中解析 [task] 指令块，支持三种格式：
    1. [task:type] content [/task]   — 标准多行块
    2. [task:type] content           — 无结束标签（到消息末尾）
    3. [task] type: content          — 单行简写
    """
    import re
    tasks = []
    seen = set()

    # 格式1：有结束标签的多行块
    block_pattern = re.findall(r'\[task:(\w+)\](.*?)\[/task\]', commit_message, re.DOTALL)
    for task_type, content in block_pattern:
        key = (task_type.strip(), content.strip())
        if key not in seen:
            seen.add(key)
            tasks.append({"type": task_type.strip(), "content": content.strip()})

    # 格式2：无结束标签，内容到消息末尾（如果格式1已匹配则跳过）
    if not block_pattern:
        open_pattern = re.findall(r'\[task:(\w+)\](.*?)(?=\[task:|\Z)', commit_message, re.DOTALL)
        for task_type, content in open_pattern:
            content = content.replace('[/task]', '').strip()
            key = (task_type.strip(), content)
            if key not in seen:
                seen.add(key)
                tasks.append({"type": task_type.strip(), "content": content})

    # 格式3：单行简写 [task] type: content
    line_pattern = re.findall(r'\[task\]\s+(\w+):\s+(.+)', commit_message)
    for task_type, content in line_pattern:
        key = (task_type.strip(), content.strip())
        if key not in seen:
            seen.add(key)
            tasks.append({"type": task_type.strip(), "content": content.strip()})

    return tasks


def _execute_task(task: dict, project_dir: str) -> dict:
    """执行任务指令，返回执行结果"""
    import sqlite3 as _sqlite3
    task_type = task["type"]
    content = task["content"]

    try:
        if task_type == "db_migrate":
            # 执行 SQLite SQL 语句
            db_path = f"{project_dir}/data/weather.db"
            conn = _sqlite3.connect(db_path)
            cursor = conn.cursor()
            for sql in content.split(";"):
                sql = sql.strip()
                if sql:
                    cursor.execute(sql)
            conn.commit()
            conn.close()
            return {"type": task_type, "status": "success", "detail": content}

        elif task_type == "shell":
            # 执行 shell 命令（仅限白名单）
            allowed = ["pip install", "python3", "pm2"]
            if not any(content.startswith(a) for a in allowed):
                return {"type": task_type, "status": "rejected", "detail": "命令不在白名单"}
            result = subprocess.run(content, shell=True, cwd=project_dir,
                                    capture_output=True, text=True, timeout=60)
            return {"type": task_type, "status": "success", "detail": result.stdout.strip()}

        elif task_type == "note":
            # 纯文字备注，记录日志即可
            logger.info(f"[Task:note] {content}")
            return {"type": task_type, "status": "noted", "detail": content}

        else:
            return {"type": task_type, "status": "unknown", "detail": f"未知任务类型: {task_type}"}

    except Exception as e:
        return {"type": task_type, "status": "error", "detail": str(e)}


def _notify_telegram(branch: str, commits: list, task_results: list):
    """通过 Telegram Bot API 发送部署通知"""
    import httpx as _httpx

    bot_token = os.getenv("TELEGRAM_BOT_TOKEN", "")
    chat_id = os.getenv("TELEGRAM_CHAT_ID", "8715713825")
    if not bot_token:
        logger.warning("[Webhook] TELEGRAM_BOT_TOKEN 未配置，跳过通知")
        return

    commit_lines = "\n".join(
        f"  • {c.get('message', '').splitlines()[0][:60]}" for c in commits[:5]
    )
    task_lines = ""
    if task_results:
        task_lines = "\n\n📋 *任务执行结果：*\n" + "\n".join(
            f"  {'✅' if r['status'] in ('success', 'noted') else '❌'} `[{r['type']}]` {r['detail'][:80]}"
            for r in task_results
        )

    msg = (
        f"🚀 *自动部署完成*\n"
        f"分支：`{branch}`\n\n"
        f"📝 *提交记录：*\n{commit_lines}"
        f"{task_lines}"
    )

    try:
        resp = _httpx.post(
            f"https://api.telegram.org/bot{bot_token}/sendMessage",
            json={"chat_id": chat_id, "text": msg, "parse_mode": "Markdown"},
            timeout=10
        )
        logger.info(f"[Webhook] Telegram 通知已发送: {resp.status_code}")
    except Exception as e:
        logger.warning(f"[Webhook] Telegram 通知发送失败: {e}")
