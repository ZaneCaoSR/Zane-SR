"""
config.py - 配置管理
从环境变量或 .env 文件加载所有配置项，所有敏感信息不得硬编码
"""
import os
from dotenv import load_dotenv

load_dotenv()

# 微信小程序配置
WECHAT_APP_ID = os.getenv("WECHAT_APP_ID", "YOUR_WECHAT_APP_ID")
WECHAT_APP_SECRET = os.getenv("WECHAT_APP_SECRET", "YOUR_WECHAT_APP_SECRET")
WECHAT_TEMPLATE_ID = os.getenv("WECHAT_TEMPLATE_ID", "YOUR_TEMPLATE_ID")

# 和风天气 API 配置
QWEATHER_API_KEY = os.getenv("QWEATHER_API_KEY", "YOUR_QWEATHER_API_KEY")

# 和风天气 JWT 配置
QWEATHER_KID = os.getenv("QWEATHER_KID", "")
QWEATHER_SUB = os.getenv("QWEATHER_SUB", "")
QWEATHER_PRIVATE_KEY_PATH = os.path.join(os.path.dirname(__file__), "ed25519-private.pem")
QWEATHER_BASE_URL = "https://kj564v7e3y.re.qweatherapi.com/v7"
QWEATHER_GEO_URL = "https://kj564v7e3y.re.qweatherapi.com/geo/v2/city/lookup"

# 推送时间配置（默认每天早8点）
PUSH_HOUR = int(os.getenv("PUSH_HOUR", "8"))
PUSH_MINUTE = int(os.getenv("PUSH_MINUTE", "0"))

# 数据库路径
DATABASE_PATH = os.getenv("DATABASE_PATH", "/root/projects/weather-mini/data/weather.db")

# 日志路径
LOG_PATH = os.getenv("LOG_PATH", "/root/projects/weather-mini/logs/app.log")

# API 鉴权 Key
API_KEY = os.getenv("API_KEY", "your-secret-api-key-change-me")

# 告警配置
ALERT_WEBHOOK_URL = os.getenv("ALERT_WEBHOOK_URL", "")
ALERT_SUCCESS_RATE_THRESHOLD = int(os.getenv("ALERT_SUCCESS_RATE_THRESHOLD", "80"))
