"""
from logger import logger
main.py - FastAPI 后端入口
提供微信小程序天气提醒的后端接口：订阅管理、天气查询、手动触发推送
"""
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
from weather import get_weather
from scheduler import start_scheduler, stop_scheduler, push_daily_weather
from retry import get_retry_queue, clear_retry_queue, retry_failed_pushes


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
    return {"subscribed": user["is_active"] == 1, "city": user["city"]}


@app.get("/api/weather/{city_name}", summary="查询天气（调试用）")
async def query_weather(city_name: str):
    """手动查询指定城市天气，用于测试天气 API 是否正常"""
    weather = await get_weather(city_name)
    if not weather:
        raise HTTPException(status_code=404, detail=f"无法获取 {city_name} 的天气数据，请检查城市名或 API Key")
    return weather


@app.post("/api/login", summary="小程序登录")
async def miniapp_login(request: Request):
    """小程序登录接口，返回 mock openid（实际应调用微信 code2session）"""
    body = await request.json()
    code = body.get("code")
    # TODO: 实际应调用微信 code2session 接口换取 openid
    # 这里返回 mock 数据供测试
    return {"openid": f"mock_openid_{code}", "session_key": "mock_session"}


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
