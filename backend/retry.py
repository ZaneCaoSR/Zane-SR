"""
retry.py - 推送重试机制
失败的用户存入重试队列（SQLite 持久化），支持手动重试
"""
import asyncio
import sqlite3
from datetime import datetime
from database import get_connection
from logger import logger
import time

# 内存缓存：启动时从 DB 加载未重试的任务
_retry_queue = []


def init_retry_db():
    """初始化重试队列数据库表"""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS retry_queue (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            openid TEXT NOT NULL,
            city TEXT NOT NULL,
            retry_after TEXT,
            retry_count INTEGER DEFAULT 0,
            error TEXT,
            created_at TEXT NOT NULL
        )
    """)
    conn.commit()
    conn.close()


def _load_retry_queue():
    """从数据库加载未重试的任务到内存"""
    conn = get_connection()
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM retry_queue ORDER BY created_at")
    rows = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return rows


def add_to_retry_queue(openid: str, city: str, error: str, retry_after: str = None):
    """添加失败用户到重试队列（写入数据库）"""
    conn = get_connection()
    cursor = conn.cursor()
    now = datetime.now().isoformat()
    cursor.execute("""
        INSERT INTO retry_queue (openid, city, error, retry_count, created_at, retry_after)
        VALUES (?, ?, ?, 0, ?, ?)
    """, (openid, city, error, now, retry_after))
    conn.commit()
    conn.close()
    
    # 同时更新内存缓存
    _retry_queue.append({
        "openid": openid,
        "city": city,
        "error": error,
        "retry_count": 0,
        "created_at": now,
        "retry_after": retry_after
    })
    logger.warning(f"[Retry] 添加到重试队列: {openid}, 原因: {error}")


def get_retry_queue() -> list:
    """获取重试队列（从数据库读取）"""
    conn = get_connection()
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM retry_queue ORDER BY created_at")
    rows = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return rows


def clear_retry_queue():
    """清空重试队列（从数据库删除）"""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM retry_queue")
    conn.commit()
    conn.close()
    _retry_queue.clear()
    logger.info("[Retry] 重试队列已清空")


async def retry_failed_pushes():
    """重试推送失败的用户（基于数据库）"""
    from weather import get_weather
    from wechat import send_weather_message
    
    # 从数据库获取重试队列
    conn = get_connection()
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM retry_queue ORDER BY created_at")
    items = [dict(row) for row in cursor.fetchall()]
    conn.close()
    
    if not items:
        logger.info("[Retry] 重试队列为空")
        return 0
    
    success_count = 0
    remaining = []
    
    for item in items:
        if item["retry_count"] >= 3:
            logger.warning(f"[Retry] 跳过 {item['openid']}: 已达最大重试次数")
            # 删除超过最大重试次数的记录
            conn = get_connection()
            cursor = conn.cursor()
            cursor.execute("DELETE FROM retry_queue WHERE id=?", (item["id"],))
            conn.commit()
            conn.close()
            continue
        
        weather = await get_weather(item["city"])
        if not weather:
            # 更新重试次数
            conn = get_connection()
            cursor = conn.cursor()
            cursor.execute("""
                UPDATE retry_queue SET retry_count = retry_count + 1 WHERE id=?
            """, (item["id"],))
            conn.commit()
            conn.close()
            remaining.append(item)
            continue
        
        ok = await send_weather_message(item["openid"], weather)
        if ok:
            success_count += 1
            logger.info(f"[Retry] 重试成功: {item['openid']}")
            # 删除成功的记录
            conn = get_connection()
            cursor = conn.cursor()
            cursor.execute("DELETE FROM retry_queue WHERE id=?", (item["id"],))
            conn.commit()
            conn.close()
        else:
            # 更新重试次数
            conn = get_connection()
            cursor = conn.cursor()
            cursor.execute("""
                UPDATE retry_queue SET retry_count = retry_count + 1 WHERE id=?
            """, (item["id"],))
            conn.commit()
            conn.close()
            remaining.append(item)
    
    return success_count
