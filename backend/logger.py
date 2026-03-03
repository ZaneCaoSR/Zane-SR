"""
logger.py - 日志配置
使用 loguru，提供日志轮转、控制台输出、文件输出
"""
import sys
from loguru import logger
from config import LOG_PATH

# 移除默认处理器
logger.remove()

# 控制台输出（INFO 及以上）
logger.add(
    sys.stdout,
    format="<green>{time:YYYY-MM-DD HH:mm:ss}</green> | <level>{level: <8}</level> | <cyan>{name}</cyan>:<cyan>{function}</cyan> - <level>{message}</level>",
    level="INFO",
)

# 文件输出（DEBUG 及以上，按天轮转，保留 7 天）
logger.add(
    LOG_PATH,
    format="{time:YYYY-MM-DD HH:mm:ss} | {level: <8} | {name}:{function} - {message}",
    level="DEBUG",
    rotation="00:00",  # 每天午夜轮转
    retention="7 days",  # 保留 7 天
    compression="zip",  # 压缩旧日志
)

# 全局导出
__all__ = ["logger"]
