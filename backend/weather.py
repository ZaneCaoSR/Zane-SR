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
# 新增：基于城市ID的30分钟天气缓存
_weather_cache_by_id = {}
CITY_ID_CACHE_TTL = 600  # 城市ID缓存 10 分钟
WEATHER_CACHE_TTL = 600  # 天气数据缓存 10 分钟
WEATHER_CACHE_TTL_30 = 30 * 60  # 30分钟缓存（新功能）


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

    # 构建3日预报数据
    forecast = []
    for day in daily_data["daily"][:3]:
        forecast.append({
            "date": day["fxDate"],
            "temp_max": day["tempMax"],
            "temp_min": day["tempMin"],
            "weather_day": day["textDay"],
            "weather_night": day["textNight"],
            "wind_dir": day["windDirDay"],
            "wind_scale": day["windScaleDay"],
            "humidity": day["humidity"],
            "sunrise": day["sunrise"],
            "sunset": day["sunset"],
        })

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
        "forecast": forecast,
    }

    # 获取空气质量
    air = await get_air_quality(city_id)
    if air:
        weather_data["air"] = air

    # 获取逐小时预报
    hourly = await get_hourly_forecast(city_id)
    if hourly:
        weather_data["hourly"] = hourly

    # 获取天气预警
    alerts = await get_weather_alerts(city_id)
    if alerts:
        weather_data["alerts"] = alerts

    # 写入缓存
    _set_cached_weather(city_name, weather_data)
    return weather_data


# ===== 30分钟缓存功能（多城市订阅使用） =====

def _get_cached_weather_by_city_id(city_id: str) -> dict | None:
    """从缓存获取天气数据（基于城市ID，30分钟缓存）"""
    if city_id in _weather_cache_by_id:
        data, timestamp = _weather_cache_by_id[city_id]
        if time.time() - timestamp < WEATHER_CACHE_TTL_30:
            logger.info(f"[Weather] 30分钟缓存命中: {city_id}")
            return data
        else:
            del _weather_cache_by_id[city_id]
    return None


def _set_cached_weather_by_city_id(city_id: str, data: dict):
    """设置天气数据缓存（基于城市ID，30分钟）"""
    _weather_cache_by_id[city_id] = (data, time.time())


async def get_weather_by_city_id(city_id: str, city_name: str = None) -> dict | None:
    """
    获取指定城市的天气信息（基于城市ID，30分钟缓存）
    :param city_id: 和风天气城市ID
    :param city_name: 城市名称（可选，用于返回数据）
    :return: 天气数据字典
    """
    # 先检查30分钟缓存
    cached_weather = _get_cached_weather_by_city_id(city_id)
    if cached_weather:
        return cached_weather

    token = get_jwt_token()
    if not token:
        logger.warning("[Weather] 获取 JWT 失败")
        return None

    headers = {"Authorization": f"Bearer {token}"}

    async with httpx.AsyncClient(timeout=10) as client:
        # 获取实时天气
        now_resp = await client.get(
            f"{QWEATHER_BASE_URL}/weather/now",
            params={"location": city_id, "lang": "zh"},
            headers=headers
        )
        now_data = now_resp.json()

        # 获取3日预报
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

    # 构建3日预报数据
    forecast = []
    for day in daily_data["daily"][:3]:
        forecast.append({
            "date": day["fxDate"],
            "temp_max": day["tempMax"],
            "temp_min": day["tempMin"],
            "weather_day": day["textDay"],
            "weather_night": day["textNight"],
            "wind_dir": day["windDirDay"],
            "wind_scale": day["windScaleDay"],
            "humidity": day["humidity"],
            "sunrise": day["sunrise"],
            "sunset": day["sunset"],
        })

    weather_data = {
        "city": city_name or "未知",
        "cityId": city_id,
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
        "forecast": forecast,
    }

    # 获取空气质量
    air = await get_air_quality(city_id)
    if air:
        weather_data["air"] = air

    # 获取逐小时预报
    hourly = await get_hourly_forecast(city_id)
    if hourly:
        weather_data["hourly"] = hourly

    # 获取天气预警
    alerts = await get_weather_alerts(city_id)
    if alerts:
        weather_data["alerts"] = alerts

    # 写入30分钟缓存
    _set_cached_weather_by_city_id(city_id, weather_data)
    return weather_data


# ===== 生活指数 =====

# 生活指数缓存
_indices_cache = {}
INDICES_CACHE_TTL = 30 * 60  # 30分钟


def _get_cached_indices(city_id: str) -> dict | None:
    """获取缓存的生活指数"""
    if city_id in _indices_cache:
        data, timestamp = _indices_cache[city_id]
        if time.time() - timestamp < INDICES_CACHE_TTL:
            return data
    return None


def _set_cached_indices(city_id: str, data: dict):
    """设置生活指数缓存"""
    _indices_cache[city_id] = (data, time.time())


async def get_weather_indices(city_id: str) -> dict | None:
    """
    获取生活指数（紫外线、穿衣、洗车等）
    """
    # 先检查缓存
    cached = _get_cached_indices(city_id)
    if cached:
        return cached

    token = get_jwt_token()
    if not token:
        return None

    headers = {"Authorization": f"Bearer {token}"}

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                f"{QWEATHER_BASE_URL}/indices/now",
                params={"location": city_id, "lang": "zh"},
                headers=headers
            )
            data = resp.json()

        if data.get("code") != "200":
            return None

        # 提取生活指数
        daily = data.get("daily", [])
        indices = {}
        for item in daily:
            type_id = item.get("type")
            if type_id == "1":  # 紫外线
                indices["uv"] = {"level": item.get("level"), "category": item.get("category")}
            elif type_id == "3":  # 穿衣
                indices["dressing"] = {"level": item.get("level"), "category": item.get("category")}
            elif type_id == "5":  # 洗车
                indices["car_wash"] = {"level": item.get("level"), "category": item.get("category")}
            elif type_id == "8":  # 运动
                indices["sport"] = {"level": item.get("level"), "category": item.get("category")}
            elif type_id == "9":  # 出行
                indices["travel"] = {"level": item.get("level"), "category": item.get("category")}

        # 写入缓存
        _set_cached_indices(city_id, indices)
        return indices

    except Exception as e:
        logger.warning(f"[Weather] 获取生活指数失败: {e}")
        return None


# ===== 空气质量 =====

_air_cache = {}
AIR_CACHE_TTL = 30 * 60  # 30分钟


def _get_cached_air(city_id: str) -> dict | None:
    """获取缓存的空气质量"""
    if city_id in _air_cache:
        data, timestamp = _air_cache[city_id]
        if time.time() - timestamp < AIR_CACHE_TTL:
            return data
    return None


def _set_cached_air(city_id: str, data: dict):
    """设置空气质量缓存"""
    _air_cache[city_id] = (data, time.time())


async def get_air_quality(city_id: str) -> dict | None:
    """
    获取空气质量
    """
    # 先检查缓存
    cached = _get_cached_air(city_id)
    if cached:
        return cached

    token = get_jwt_token()
    if not token:
        return None

    headers = {"Authorization": f"Bearer {token}"}

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                f"{QWEATHER_BASE_URL}/air/now",
                params={"location": city_id, "lang": "zh"},
                headers=headers
            )
            data = resp.json()

        if data.get("code") != "200":
            return None

        now = data.get("now", {})
        air_data = {
            "aqi": now.get("aqi"),
            "category": now.get("category"),
            "pm25": now.get("pm2p5"),
            "pm10": now.get("pm10"),
            "so2": now.get("so2"),
            "no2": now.get("no2"),
            "co": now.get("co"),
            "o3": now.get("o3"),
        }

        # 写入缓存
        _set_cached_air(city_id, air_data)
        return air_data

    except Exception as e:
        logger.warning(f"[Weather] 获取空气质量失败: {e}")
        return None


# ===== 逐小时预报 =====

_hourly_cache = {}
HOURLY_CACHE_TTL = 30 * 60  # 30分钟


def _get_cached_hourly(city_id: str) -> list | None:
    """获取缓存的逐小时预报"""
    if city_id in _hourly_cache:
        data, timestamp = _hourly_cache[city_id]
        if time.time() - timestamp < HOURLY_CACHE_TTL:
            return data
    return None


def _set_cached_hourly(city_id: str, data: list):
    """设置逐小时预报缓存"""
    _hourly_cache[city_id] = (data, time.time())


async def get_hourly_forecast(city_id: str) -> list | None:
    """
    获取逐小时天气预报
    """
    # 先检查缓存
    cached = _get_cached_hourly(city_id)
    if cached:
        return cached

    token = get_jwt_token()
    if not token:
        return None

    headers = {"Authorization": f"Bearer {token}"}

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                f"{QWEATHER_BASE_URL}/weather/24h",
                params={"location": city_id, "lang": "zh"},
                headers=headers
            )
            data = resp.json()

        if data.get("code") != "200":
            return None

        # 提取逐小时数据
        hourly = []
        for hour in data.get("hourly", [])[:24]:  # 取24小时
            hourly.append({
                "time": hour.get("fxTime", ""),  # 时间
                "temp": hour.get("temp", ""),    # 温度
                "weather": hour.get("text", ""), # 天气
                "icon": hour.get("icon", ""),    # 图标代码
                "wind_dir": hour.get("windDir", ""),
                "wind_scale": hour.get("windScale", ""),
                "humidity": hour.get("humidity", ""),
                "pop": hour.get("pop", ""),       # 降水概率
            })

        # 写入缓存
        _set_cached_hourly(city_id, hourly)
        return hourly

    except Exception as e:
        logger.warning(f"[Weather] 获取逐小时预报失败: {e}")
        return None


# ===== 天气预警 =====

_alert_cache = {}
ALERT_CACHE_TTL = 30 * 60  # 30分钟


def _get_cached_alerts(city_id: str) -> list | None:
    """获取缓存的天气预警"""
    if city_id in _alert_cache:
        data, timestamp = _alert_cache[city_id]
        if time.time() - timestamp < ALERT_CACHE_TTL:
            return data
    return None


def _set_cached_alerts(city_id: str, data: list):
    """设置天气预警缓存"""
    _alert_cache[city_id] = (data, time.time())


async def get_weather_alerts(city_id: str) -> list | None:
    """
    获取天气预警
    """
    # 先检查缓存
    cached = _get_cached_alerts(city_id)
    if cached:
        return cached

    token = get_jwt_token()
    if not token:
        return None

    headers = {"Authorization": f"Bearer {token}"}

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                f"{QWEATHER_BASE_URL}/warning/now",
                params={"location": city_id, "lang": "zh"},
                headers=headers
            )
            data = resp.json()

        if data.get("code") != "200":
            return None

        # 提取预警数据
        alerts = []
        for alert in data.get("warning", []):
            alerts.append({
                "id": alert.get("id", ""),
                "title": alert.get("title", ""),        # 预警标题
                "type": alert.get("type", ""),          # 预警类型
                "type_name": alert.get("typeName", ""), # 预警类型名称
                "level": alert.get("level", ""),        # 预警级别
                "level_name": alert.get("levelName", ""), # 预警级别名称
                "text": alert.get("text", ""),          # 预警详情
                "pub_time": alert.get("pubTime", ""),   # 发布时间
            })

        # 写入缓存
        _set_cached_alerts(city_id, alerts)
        return alerts

    except Exception as e:
        logger.warning(f"[Weather] 获取天气预警失败: {e}")
        return None
