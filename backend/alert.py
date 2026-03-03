"""
alert.py - 监控告警模块
推送成功率低于阈值时发送告警通知
"""
import httpx
from config import ALERT_WEBHOOK_URL, ALERT_SUCCESS_RATE_THRESHOLD
from logger import logger


async def send_alert(title: str, content: str):
    """发送告警到Webhook"""
    if not ALERT_WEBHOOK_URL:
        logger.warning(f"[Alert] 未配置告警Webhook: {title}")
        return False
    
    payload = {"msgtype": "text", "text": {"content": f"{title}\n{content}"}}
    
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(ALERT_WEBHOOK_URL, json=payload)
            if resp.status_code == 200:
                logger.info(f"[Alert] 告警发送成功: {title}")
                return True
            else:
                logger.error(f"[Alert] 告警发送失败: {resp.text}")
                return False
    except Exception as e:
        logger.error(f"[Alert] 告警发送异常: {e}")
        return False


async def check_and_alert(total: int, success: int):
    """检查成功率并发送告警"""
    if total == 0:
        return
    
    rate = (success / total) * 100
    if rate < ALERT_SUCCESS_RATE_THRESHOLD:
        msg = f"推送成功率: {success}/{total} ({rate:.1f}%)，低于阈值 {ALERT_SUCCESS_RATE_THRESHOLD}%"
        await send_alert("⚠️ 天气推送告警", msg)
        logger.warning(f"[Alert] {msg}")
