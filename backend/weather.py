"""
weather.py - 和风天气数据拉取
使用和风天气 API v7（免费版），获取实时天气 + 3日预报
API 文档：https://dev.qweather.com/docs/api/
"""
import httpx
from config import QWEATHER_API_KEY, QWEATHER_BASE_URL, QWEATHER_GEO_URL


async def get_city_id(city_name: str) -> str | None:
    """
    根据城市名称查询和风天气城市ID（LocationID）
    :param city_name: 城市名，如"杭州"、"北京"
    :return: 城市ID，如"101210101"
    """
    params = {
        "location": city_name,
        "key": QWEATHER_API_KEY,
        "lang": "zh",
        "number": 1,
    }
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(QWEATHER_GEO_URL, params=params)
        data = resp.json()
        if data.get("code") == "200" and data.get("location"):
            return data["location"][0]["id"]
    return None


async def get_weather(city_name: str) -> dict | None:
    """
    获取指定城市的天气信息（实时天气 + 今日预报）
    :param city_name: 城市名，如"杭州"
    :return: 天气数据字典，包含 city/weather/temp/min_temp/max_temp/humidity/wind
    """
    # 第一步：查询城市ID
    city_id = await get_city_id(city_name)
    if not city_id:
        return None

    async with httpx.AsyncClient(timeout=10) as client:
        # 第二步：获取实时天气
        now_resp = await client.get(
            f"{QWEATHER_BASE_URL}/weather/now",
            params={"location": city_id, "key": QWEATHER_API_KEY, "lang": "zh"}
        )
        now_data = now_resp.json()

        # 第三步：获取3日预报（取今天的最高/最低温）
        daily_resp = await client.get(
            f"{QWEATHER_BASE_URL}/weather/3d",
            params={"location": city_id, "key": QWEATHER_API_KEY, "lang": "zh"}
        )
        daily_data = daily_resp.json()

    if now_data.get("code") != "200" or daily_data.get("code") != "200":
        return None

    now = now_data["now"]
    today = daily_data["daily"][0]  # 今天的预报数据

    return {
        "city": city_name,
        "weather": now["text"],           # 天气状况，如"晴"、"多云"
        "temp": now["temp"],              # 实时温度（℃）
        "feels_like": now["feelsLike"],   # 体感温度
        "humidity": now["humidity"],      # 相对湿度（%）
        "wind_dir": now["windDir"],       # 风向，如"东北风"
        "wind_scale": now["windScale"],   # 风力等级
        "min_temp": today["tempMin"],     # 今日最低温
        "max_temp": today["tempMax"],     # 今日最高温
        "day_weather": today["textDay"],  # 白天天气状况
        "update_time": now_data["updateTime"],  # 数据更新时间
    }
