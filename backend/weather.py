"""
weather.py - 和风天气数据拉取
使用和风天气 API v7 (JWT 认证)，获取实时天气 + 3日预报
API 文档：https://dev.qweather.com/docs/api/weather/
"""
import httpx
import time
from config import QWEATHER_BASE_URL, QWEATHER_GEO_URL
from jwt_helper import get_jwt_token
from logger import logger

# 本地缓存：key=(城市名, 类型), value=(数据, 时间戳)
# 缓存时间 10 分钟 (600 秒)
_weather_cache = {}
CITY_ID_CACHE_TTL = 600  # 城市ID缓存 10 分钟
WEATHER_CACHE_TTL = 600  # 天气数据缓存 10 分钟


def _get_cached_weather(city_name: str) -> dict | None:
    """从缓存获取天气数据"""
    key = ("weather", city_name)
    if key in _weather_cache:
        data, timestamp = _weather_cache[key]
        if time.time() - timestamp < WEATHER_CACHE_TTL:
            logger.info(f"[Weather] 命中缓存: {city_name}")
            return data
        else:
            del _weather_cache[key]
    return None


def _set_cached_weather(city_name: str, data: dict):
    """设置天气数据缓存"""
    key = ("weather", city_name)
    _weather_cache[key] = (data, time.time())


def _get_cached_city_id(city_name: str) -> str | None:
    """从缓存获取城市ID"""
    key = ("city_id", city_name)
    if key in _weather_cache:
        data, timestamp = _weather_cache[key]
        if time.time() - timestamp < CITY_ID_CACHE_TTL:
            logger.info(f"[Weather] 城市ID命中缓存: {city_name}")
            return data
        else:
            del _weather_cache[key]
    return None


def _set_cached_city_id(city_name: str, city_id: str):
    """设置城市ID缓存"""
    key = ("city_id", city_name)
    _weather_cache[key] = (city_id, time.time())


async def get_city_id(city_name: str) -> str | None:
    """
    根据城市名称查询和风天气城市ID（LocationID）
    使用 GeoAPI v2，先检查缓存
    """
    # 先检查缓存
    cached_id = _get_cached_city_id(city_name)
    if cached_id:
        return cached_id
    
    token = get_jwt_token()
    if not token:
        logger.warning("[Weather] 获取 JWT 失败")
        return None
    
    params = {
        "location": city_name,
        "lang": "zh",
        "number": 1,
    }
    headers = {"Authorization": f"Bearer {token}"}
    
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(QWEATHER_GEO_URL, params=params, headers=headers)
        data = resp.json()
        if data.get("code") == "200" and data.get("location"):
            city_id = data["location"][0]["id"]
            # 写入缓存
            _set_cached_city_id(city_name, city_id)
            return city_id
        else:
            logger.warning(f"[Weather] 城市ID查询失败: {data}")
    return None


async def get_weather(city_name: str) -> dict | None:
    """
    获取指定城市的天气信息（实时天气 + 今日预报）
    使用 Weather API v7，先检查缓存（10分钟）
    :return: 天气数据字典
    """
    # 先检查缓存
    cached_weather = _get_cached_weather(city_name)
    if cached_weather:
        return cached_weather
    
    # 第一步：查询城市ID（也会检查缓存）
    city_id = await get_city_id(city_name)
    if not city_id:
        return None

    token = get_jwt_token()
    if not token:
        logger.warning("[Weather] 获取 JWT 失败")
        return None
    
    headers = {"Authorization": f"Bearer {token}"}
    
    async with httpx.AsyncClient(timeout=10) as client:
        # 第二步：获取实时天气
        now_resp = await client.get(
            f"{QWEATHER_BASE_URL}/weather/now",
            params={"location": city_id, "lang": "zh"},
            headers=headers
        )
        now_data = now_resp.json()

        # 第三步：获取3日预报
        daily_resp = await client.get(
            f"{QWEATHER_BASE_URL}/weather/3d",
            params={"location": city_id, "lang": "zh"},
            headers=headers
        )
        daily_data = daily_resp.json()

    if now_data.get("code") != "200" or daily_data.get("code") != "200":
        logger.warning(f"[Weather] API 返回错误: now={now_data.get('code')}, daily={daily_data.get('code')}")
        return None

    now = now_data["now"]
    today = daily_data["daily"][0]

    weather_data = {
        "city": city_name,
        "weather": now["text"],
        "temp": now["temp"],
        "feels_like": now["feelsLike"],
        "humidity": now["humidity"],
        "wind_dir": now["windDir"],
        "wind_scale": now["windScale"],
        "min_temp": today["tempMin"],
        "max_temp": today["tempMax"],
        "day_weather": today["textDay"],
        "update_time": now_data["updateTime"],
    }
    
    # 写入缓存
    _set_cached_weather(city_name, weather_data)
    return weather_data
