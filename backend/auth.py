"""
auth.py - API 鉴权模块
基于简单 token 的鉴权方案，适合内部服务
"""
from fastapi import HTTPException, Security, status
from fastapi.security import APIKeyHeader
from config import API_KEY

# 请求头鉴权
api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)


async def verify_api_key(api_key: str = Security(api_key_header)) -> str:
    """
    验证 API Key
    """
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="缺少 API Key"
        )
    if api_key != API_KEY:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="无效的 API Key"
        )
    return api_key
