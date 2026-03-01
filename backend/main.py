"""
main.py - FastAPI 后端入口
提供微信小程序天气提醒的后端接口：订阅管理、天气查询、手动触发推送
"""
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from database import init_db, add_subscriber, remove_subscriber, get_all_subscribers, get_subscriber
from weather import get_weather
from scheduler import start_scheduler, stop_scheduler, push_daily_weather


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期管理：启动时初始化DB和调度器，关闭时停止调度器"""
    init_db()
    start_scheduler()
    yield
    stop_scheduler()


app = FastAPI(
    title="Weather Mini 后端",
    description="微信小程序天气提醒服务",
    version="1.0.0",
    lifespan=lifespan,
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


@app.get("/api/subscribers", summary="获取所有订阅者（管理用）")
async def list_subscribers():
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


@app.post("/api/push/now", summary="立即触发推送（测试用）")
async def trigger_push():
    """手动触发一次天气推送，用于测试推送链路"""
    await push_daily_weather()
    return {"success": True, "message": "推送任务已触发"}


@app.get("/", summary="健康检查")
async def health():
    return {"status": "ok", "service": "Weather Mini Backend"}


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
