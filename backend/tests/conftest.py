"""
conftest.py - pytest 配置和共享 fixtures
"""
import os
import sys
import pytest
import sqlite3
import tempfile
from pathlib import Path

# 设置测试环境变量（在导入任何模块之前）
os.environ["DATABASE_PATH"] = "/tmp/test_weather.db"
os.environ["API_KEY"] = "test-api-key"
os.environ["WECHAT_APP_ID"] = "test_app_id"
os.environ["WECHAT_APP_SECRET"] = "test_app_secret"
os.environ["WECHAT_TEMPLATE_ID"] = "test_template_id"
os.environ["QWEATHER_API_KEY"] = "test_qweather_key"
os.environ["QWEATHER_KID"] = "test_kid"
os.environ["QWEATHER_SUB"] = "test_sub"
os.environ["LOG_PATH"] = "/tmp/test_weather.log"
# file storage paths (avoid writing to /root in CI)
os.environ["WEATHER_MINI_ROOT"] = "/tmp/weather-mini-test"
os.environ["PHOTOS_DIR"] = "/tmp/weather-mini-test/photos"
os.environ["PHOTOS_DB"] = "/tmp/weather-mini-test/data/photos.json"

# 将 backend 目录加入 Python 路径
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))


@pytest.fixture(scope="function", autouse=True)
def setup_test_env():
    """每个测试前后设置和清理环境"""
    # 确保临时目录存在
    os.makedirs("/tmp", exist_ok=True)
    os.makedirs(os.environ["PHOTOS_DIR"], exist_ok=True)
    os.makedirs(str(Path(os.environ["PHOTOS_DB"]).parent), exist_ok=True)
    
    # 清理旧的测试数据库
    if os.path.exists("/tmp/test_weather.db"):
        try:
            os.remove("/tmp/test_weather.db")
        except:
            pass
    
    yield
    
    # 测试后清理
    if os.path.exists("/tmp/test_weather.db"):
        try:
            os.remove("/tmp/test_weather.db")
        except:
            pass


@pytest.fixture
def test_db():
    """创建测试用数据库"""
    from database import init_db
    init_db()
    yield
    # 测试后清理由 setup_test_env 处理


@pytest.fixture
def client():
    """创建 FastAPI 测试客户端"""
    from contextlib import asynccontextmanager
    from fastapi.testclient import TestClient
    
    # 延迟导入以确保环境变量已设置
    import importlib
    import main
    importlib.reload(main)
    from main import app
    
    # 创建测试客户端，不使用 lifespan（手动调用 init_db）
    from database import init_db
    from retry import init_retry_db
    init_db()
    init_retry_db()
    
    return TestClient(app, raise_server_exceptions=False)


@pytest.fixture
def mock_weather_data():
    """模拟天气数据"""
    return {
        "city": "杭州",
        "weather": "晴",
        "temp": "20",
        "feels_like": "18",
        "humidity": "45",
        "wind_dir": "东北风",
        "wind_scale": "3",
        "min_temp": "15",
        "max_temp": "25",
        "day_weather": "晴",
        "update_time": "2024-01-01T10:00:00+08:00"
    }


@pytest.fixture
def mock_access_token():
    """模拟微信 access_token"""
    return "mock_access_token_12345"


@pytest.fixture
def sample_openid():
    """测试用 openid"""
    return "test_openid_12345"


@pytest.fixture
def api_headers():
    """API 鉴权请求头"""
    return {"X-API-Key": "test-api-key"}
