"""
test_weather.py - 天气数据格式和字段完整性测试
验证 weather.py 中的数据结构
"""
import pytest
from unittest.mock import patch, MagicMock
import sys
from pathlib import Path

# 添加 backend 目录到路径
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))


class TestWeatherDataFormat:
    """天气数据格式测试"""

    def test_weather_data_required_fields(self, mock_weather_data):
        """测试天气数据必须包含的字段"""
        required_fields = [
            "city", "weather", "temp", "feels_like", "humidity",
            "wind_dir", "wind_scale", "min_temp", "max_temp",
            "day_weather", "update_time"
        ]
        
        for field in required_fields:
            assert field in mock_weather_data, f"Missing required field: {field}"

    def test_weather_data_types(self, mock_weather_data):
        """测试天气数据类型"""
        # 城市和天气应为字符串
        assert isinstance(mock_weather_data["city"], str)
        assert isinstance(mock_weather_data["weather"], str)
        assert isinstance(mock_weather_data["day_weather"], str)
        
        # 温度相关字段应为字符串（API 返回为字符串）
        assert isinstance(mock_weather_data["temp"], str)
        assert isinstance(mock_weather_data["feels_like"], str)
        assert isinstance(mock_weather_data["min_temp"], str)
        assert isinstance(mock_weather_data["max_temp"], str)
        
        # 湿度和风速应为字符串
        assert isinstance(mock_weather_data["humidity"], str)
        assert isinstance(mock_weather_data["wind_scale"], str)
        assert isinstance(mock_weather_data["wind_dir"], str)

    def test_weather_data_not_empty(self, mock_weather_data):
        """测试天气数据不为空"""
        for key, value in mock_weather_data.items():
            assert value is not None, f"Field {key} should not be None"
            assert value != "", f"Field {key} should not be empty"

    def test_temperature_range_valid(self, mock_weather_data):
        """测试温度范围的合理性"""
        min_temp = int(mock_weather_data["min_temp"])
        max_temp = int(mock_weather_data["max_temp"])
        
        assert min_temp <= max_temp, "min_temp should be <= max_temp"
        # 温度应在合理范围内
        assert -50 <= min_temp <= 60, "min_temp out of reasonable range"
        assert -50 <= max_temp <= 60, "max_temp out of reasonable range"

    def test_humidity_range_valid(self, mock_weather_data):
        """测试湿度范围的合理性"""
        humidity = int(mock_weather_data["humidity"])
        assert 0 <= humidity <= 100, "Humidity should be between 0 and 100"

    def test_wind_scale_valid(self, mock_weather_data):
        """测试风力等级的有效性"""
        wind_scale = mock_weather_data["wind_scale"]
        # 风力等级应为数字（可能是字符串或带"级"）
        if wind_scale.isdigit():
            scale = int(wind_scale)
            assert 0 <= scale <= 17, "Wind scale should be 0-17"
        else:
            # 可能是 "3-4" 这样的格式
            assert "-" in wind_scale or "级" in wind_scale


class TestWeatherAPIIntegration:
    """天气 API 集成测试"""

    @patch("weather.httpx.AsyncClient")
    @patch("weather.get_jwt_token")
    @patch("weather.get_city_id")
    async def test_get_weather_success(self, mock_city_id, mock_jwt, mock_client):
        """测试成功获取天气数据"""
        from weather import get_weather
        
        # Mock 城市 ID
        mock_city_id.return_value = "101210101"
        
        # Mock JWT
        mock_jwt.return_value = "test_jwt_token"
        
        # Mock HTTP 响应
        mock_response_now = MagicMock()
        mock_response_now.json.return_value = {
            "code": "200",
            "now": {
                "text": "晴",
                "temp": "20",
                "feelsLike": "18",
                "humidity": "45",
                "windDir": "东北风",
                "windScale": "3",
                "updateTime": "2024-01-01T10:00:00+08:00"
            }
        }
        
        mock_response_daily = MagicMock()
        mock_response_daily.json.return_value = {
            "code": "200",
            "daily": [{
                "tempMin": "15",
                "tempMax": "25",
                "textDay": "晴"
            }]
        }
        
        # 设置 AsyncClient 的返回
        mock_client_instance = AsyncMock()
        mock_client_instance.get.side_effect = [mock_response_now, mock_response_daily]
        mock_client.return_value.__aenter__.return_value = mock_client_instance
        
        result = await get_weather("杭州")
        
        assert result is not None
        assert result["city"] == "杭州"
        assert "weather" in result

    @patch("weather.get_city_id")
    async def test_get_weather_invalid_city(self, mock_city_id):
        """测试无效城市获取天气"""
        from weather import get_weather
        
        mock_city_id.return_value = None
        
        result = await get_weather("无效城市名")
        
        assert result is None


class TestCityIdLookup:
    """城市 ID 查询测试"""

    @patch("weather.httpx.AsyncClient")
    @patch("weather.get_jwt_token")
    async def test_get_city_id_success(self, mock_jwt, mock_client):
        """测试成功获取城市 ID"""
        from weather import get_city_id
        
        mock_jwt.return_value = "test_jwt_token"
        
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "code": "200",
            "location": [{"id": "101210101"}]
        }
        
        mock_client_instance = AsyncMock()
        mock_client_instance.get.return_value = mock_response
        mock_client.return_value.__aenter__.return_value = mock_client_instance
        
        result = await get_city_id("杭州")
        
        assert result == "101210101"

    @patch("weather.get_jwt_token")
    async def test_get_city_id_not_found(self, mock_jwt):
        """测试不存在的城市"""
        from weather import get_city_id
        
        mock_jwt.return_value = "test_jwt_token"
        
        # 使用 AsyncMock 来模拟 httpx.AsyncClient
        mock_client = AsyncMock()
        mock_response = MagicMock()
        mock_response.json.return_value = {"code": "200", "location": []}
        
        mock_client.return_value.__aenter__.return_value.get.return_value = mock_response
        
        with patch("weather.httpx.AsyncClient", return_value=mock_client):
            result = await get_city_id("不存在的城市")
        
        assert result is None


class TestWeatherCaching:
    """天气数据缓存测试"""

    def test_weather_cache_set_get(self):
        """测试天气缓存设置和获取"""
        from weather import _set_cached_weather, _get_cached_weather
        
        test_data = {"city": "测试城市", "temp": "20"}
        
        # 设置缓存
        _set_cached_weather("测试城市", test_data)
        
        # 获取缓存
        result = _get_cached_weather("测试城市")
        
        assert result == test_data

    def test_weather_cache_miss(self):
        """测试缓存未命中"""
        from weather import _get_cached_weather
        
        result = _get_cached_weather("不存在的缓存")
        
        assert result is None
