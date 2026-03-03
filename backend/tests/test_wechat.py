"""
test_wechat.py - 微信推送功能测试
验证 wechat.py 中的推送逻辑
"""
import pytest
from unittest.mock import patch, MagicMock, AsyncMock
import sys
from pathlib import Path

# 添加 backend 目录到路径
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))


class TestWeChatAccessToken:
    """微信 access_token 测试"""

    @patch("wechat.httpx.AsyncClient")
    async def test_get_access_token_success(self, mock_client):
        """测试成功获取 access_token"""
        from wechat import get_access_token
        
        # 模拟成功响应
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "access_token": "test_token_12345",
            "expires_in": 7200
        }
        
        mock_client_instance = AsyncMock()
        mock_client_instance.get.return_value = mock_response
        mock_client.return_value.__aenter__.return_value = mock_client_instance
        
        token = await get_access_token()
        
        assert token == "test_token_12345"

    @patch("wechat.httpx.AsyncClient")
    async def test_get_access_token_failed(self, mock_client):
        """测试获取 access_token 失败"""
        from wechat import get_access_token
        
        # 模拟失败响应
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "errcode": 40013,
            "errmsg": "invalid appid"
        }
        
        mock_client_instance = AsyncMock()
        mock_client_instance.get.return_value = mock_response
        mock_client.return_value.__aenter__.return_value = mock_client_instance
        
        token = await get_access_token()
        
        assert token is None

    @patch("wechat.httpx.AsyncClient")
    async def test_get_access_token_cached(self, mock_client):
        """测试 access_token 缓存"""
        from wechat import get_access_token, _access_token_cache
        import time
        
        # 先设置缓存
        _access_token_cache["token"] = "cached_token"
        _access_token_cache["expires_at"] = time.time() + 3600  # 1小时后过期
        
        token = await get_access_token()
        
        # 不应发起新的请求
        mock_client.assert_not_called()
        assert token == "cached_token"


class TestWeChatMessageSend:
    """微信消息发送测试"""

    @patch("wechat.get_access_token")
    @patch("wechat.httpx.AsyncClient")
    async def test_send_weather_message_success(self, mock_client, mock_token):
        """测试成功发送天气消息"""
        from wechat import send_weather_message
        
        mock_token.return_value = "test_token"
        
        # 模拟成功响应
        mock_response = MagicMock()
        mock_response.json.return_value = {"errcode": 0, "errmsg": "ok"}
        
        mock_client_instance = AsyncMock()
        mock_client_instance.post.return_value = mock_response
        mock_client.return_value.__aenter__.return_value = mock_client_instance
        
        weather_data = {
            "city": "杭州",
            "weather": "晴",
            "min_temp": "15",
            "max_temp": "25",
            "day_weather": "晴",
            "wind_scale": "3"
        }
        
        result = await send_weather_message("test_openid", weather_data)
        
        assert result is True

    @patch("wechat.get_access_token")
    @patch("wechat.httpx.AsyncClient")
    async def test_send_weather_message_failed(self, mock_client, mock_token):
        """测试发送天气消息失败"""
        from wechat import send_weather_message
        
        mock_token.return_value = "test_token"
        
        # 模拟失败响应
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "errcode": 40001,
            "errmsg": "invalid credential"
        }
        
        mock_client_instance = AsyncMock()
        mock_client_instance.post.return_value = mock_response
        mock_client.return_value.__aenter__.return_value = mock_client_instance
        
        weather_data = {
            "city": "杭州",
            "weather": "晴",
            "min_temp": "15",
            "max_temp": "25",
            "day_weather": "晴",
            "wind_scale": "3"
        }
        
        result = await send_weather_message("test_openid", weather_data)
        
        assert result is False

    @patch("wechat.get_access_token")
    async def test_send_message_no_token(self, mock_token):
        """测试无 access_token 时发送失败"""
        from wechat import send_weather_message
        
        mock_token.return_value = None
        
        weather_data = {
            "city": "杭州",
            "weather": "晴",
            "min_temp": "15",
            "max_temp": "25",
            "day_weather": "晴",
            "wind_scale": "3"
        }
        
        result = await send_weather_message("test_openid", weather_data)
        
        assert result is False


class TestWeatherTip:
    """天气提示生成测试"""

    def test_tip_rainy_weather(self):
        """测试雨天提示"""
        from wechat import _get_weather_tip
        
        tip = _get_weather_tip("大雨", "3")
        assert "伞" in tip

    def test_tip_snowy_weather(self):
        """测试雪天提示"""
        from wechat import _get_weather_tip
        
        tip = _get_weather_tip("小雪", "3")
        assert "保暖" in tip or "滑" in tip

    def test_tip_foggy_weather(self):
        """测试雾天提示"""
        from wechat import _get_weather_tip
        
        tip = _get_weather_tip("雾", "2")
        assert "能见度" in tip or "注意" in tip

    def test_tip_strong_wind(self):
        """测试强风提示"""
        from wechat import _get_weather_tip
        
        tip = _get_weather_tip("晴", "6")
        assert "风" in tip

    def test_tip_sunny_weather(self):
        """测试晴天提示"""
        from wechat import _get_weather_tip
        
        tip = _get_weather_tip("晴", "2")
        assert "晴" in tip or "愉快" in tip

    def test_tip_default(self):
        """测试默认提示"""
        from wechat import _get_weather_tip
        
        tip = _get_weather_tip("多云", "3")
        assert "注意" in tip or "保重" in tip


class TestWeChatMessageTemplate:
    """微信消息模板字段测试"""

    @patch("wechat.get_access_token")
    @patch("wechat.httpx.AsyncClient")
    async def test_message_template_fields(self, mock_client, mock_token):
        """测试消息模板字段正确"""
        from wechat import send_weather_message
        
        mock_token.return_value = "test_token"
        
        # 捕获发送的请求数据
        sent_payload = {}
        
        async def capture_post(url, json=None, **kwargs):
            nonlocal sent_payload
            sent_payload = json
            mock_response = MagicMock()
            mock_response.json.return_value = {"errcode": 0}
            return mock_response
        
        mock_client_instance = AsyncMock()
        mock_client_instance.post.side_effect = capture_post
        mock_client.return_value.__aenter__.return_value = mock_client_instance
        
        weather_data = {
            "city": "北京",
            "weather": "晴",
            "min_temp": "10",
            "max_temp": "20",
            "day_weather": "晴",
            "wind_scale": "3"
        }
        
        await send_weather_message("test_openid", weather_data)
        
        # 验证模板字段
        assert "touser" in sent_payload
        assert sent_payload["touser"] == "test_openid"
        
        assert "template_id" in sent_payload
        assert "data" in sent_payload
        
        # 验证必要的数据字段
        data = sent_payload["data"]
        assert "thing1" in data  # 城市
        assert "date2" in data  # 日期
        assert "temperature3" in data  # 温度
        assert "weather4" in data  # 天气
        assert "thing5" in data  # 提示
