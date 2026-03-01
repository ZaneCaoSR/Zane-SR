"""
wechat.py - 微信接口封装
包含：access_token 获取与缓存、订阅消息推送
微信订阅消息文档：https://developers.weixin.qq.com/miniprogram/dev/api-backend/open-api/subscribe-message/subscribeMessage.send.html
"""
import httpx
import time
from datetime import datetime
from config import WECHAT_APP_ID, WECHAT_APP_SECRET, WECHAT_TEMPLATE_ID

# access_token 缓存（避免频繁请求，有效期7200秒）
_access_token_cache = {
    "token": None,
    "expires_at": 0,
}


async def get_access_token() -> str | None:
    """
    获取微信 access_token（带本地缓存，提前5分钟刷新）
    :return: access_token 字符串
    """
    now = time.time()
    # 还有5分钟以上有效期则直接返回缓存
    if _access_token_cache["token"] and now < _access_token_cache["expires_at"] - 300:
        return _access_token_cache["token"]

    url = "https://api.weixin.qq.com/cgi-bin/token"
    params = {
        "grant_type": "client_credential",
        "appid": WECHAT_APP_ID,
        "secret": WECHAT_APP_SECRET,
    }
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(url, params=params)
        data = resp.json()

    if "access_token" in data:
        _access_token_cache["token"] = data["access_token"]
        _access_token_cache["expires_at"] = now + data.get("expires_in", 7200)
        return _access_token_cache["token"]

    return None


async def send_weather_message(openid: str, weather: dict) -> bool:
    """
    向指定用户发送天气订阅消息
    :param openid: 目标用户 openid
    :param weather: 天气数据字典（来自 weather.py）
    :return: True=发送成功, False=失败
    
    订阅消息模板字段（需与微信后台模板一致）：
    - thing1：城市
    - date2：日期
    - temperature3：温度区间
    - weather4：天气状况
    - thing5：温馨提示
    """
    token = await get_access_token()
    if not token:
        print(f"[WeChat] 获取 access_token 失败，跳过用户 {openid}")
        return False

    today = datetime.now().strftime("%Y年%m月%d日")
    temp_range = f"{weather['min_temp']}℃ ~ {weather['max_temp']}℃"
    
    # 根据天气状况生成温馨提示
    tip = _get_weather_tip(weather["weather"], weather["wind_scale"])

    url = f"https://api.weixin.qq.com/cgi-bin/message/subscribe/send?access_token={token}"
    payload = {
        "touser": openid,
        "template_id": WECHAT_TEMPLATE_ID,
        "page": "pages/index/index",  # 点击消息跳转到小程序首页
        "data": {
            "thing1": {"value": weather["city"]},
            "date2": {"value": today},
            "temperature3": {"value": temp_range},
            "weather4": {"value": weather["day_weather"]},
            "thing5": {"value": tip},
        }
    }

    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.post(url, json=payload)
        result = resp.json()

    if result.get("errcode") == 0:
        print(f"[WeChat] 成功推送给 {openid}：{weather['city']} {today}")
        return True
    else:
        print(f"[WeChat] 推送失败 {openid}：{result}")
        return False


def _get_weather_tip(weather_text: str, wind_scale: str) -> str:
    """根据天气状况生成简短温馨提示（最多20字）"""
    if any(w in weather_text for w in ["雨", "雷"]):
        return "记得带伞，注意安全"
    elif "雪" in weather_text:
        return "注意保暖，路面湿滑"
    elif "霾" in weather_text or "雾" in weather_text:
        return "能见度低，出行注意"
    elif int(wind_scale.replace("级", "").split("-")[-1] if wind_scale else "0") >= 6:
        return "风力较大，注意防风"
    elif "晴" in weather_text:
        return "天气晴好，心情愉快"
    else:
        return "注意天气变化，保重"
