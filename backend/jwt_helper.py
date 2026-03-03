"""
jwt_helper.py - JWT 认证生成器
使用 Ed25519 私钥生成 JWT Token
"""
import time
import jwt
from config import QWEATHER_KID, QWEATHER_SUB, QWEATHER_PRIVATE_KEY_PATH
from logger import logger

_jwt_cache = {"token": None, "expires_at": 0}


def get_jwt_token() -> str | None:
    """
    获取 JWT Token（带缓存，15分钟有效）
    """
    now = time.time()
    
    # 缓存有效则直接返回
    if _jwt_cache["token"] and now < _jwt_cache["expires_at"] - 60:
        return _jwt_cache["token"]
    
    # 读取私钥
    try:
        with open(QWEATHER_PRIVATE_KEY_PATH, "r") as f:
            private_key = f.read()
    except FileNotFoundError:
        logger.error(f"[JWT] 私钥文件不存在: {QWEATHER_PRIVATE_KEY_PATH}")
        return None
    
    if not QWEATHER_KID or not QWEATHER_SUB:
        logger.error("[JWT] JWT 配置不完整: kid 或 sub 为空")
        return None
    
    # 生成 JWT
    payload = {
        "iat": int(now) - 30,
        "exp": int(now) + 900,  # 15分钟有效
        "sub": QWEATHER_SUB
    }
    headers = {"kid": QWEATHER_KID}
    
    try:
        token = jwt.encode(payload, private_key, algorithm="EdDSA", headers=headers)
        _jwt_cache["token"] = token
        _jwt_cache["expires_at"] = now + 900
        logger.info("[JWT] Token 生成成功")
        return token
    except Exception as e:
        logger.error(f"[JWT] Token 生成失败: {e}")
        return None
