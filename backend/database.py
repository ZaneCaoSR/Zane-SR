"""
database.py - SQLite 数据库管理
存储用户订阅信息：openid、城市、自定义推送时间（预留）
支持多城市订阅
"""
import sqlite3
import os
import json
from datetime import datetime
from config import DATABASE_PATH


def get_connection():
    """获取数据库连接，自动创建目录"""
    os.makedirs(os.path.dirname(DATABASE_PATH), exist_ok=True)
    return sqlite3.connect(DATABASE_PATH)


def init_db():
    """初始化数据库，创建 subscribers 表和 retry_queue 表"""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS subscribers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            openid TEXT UNIQUE NOT NULL,          -- 微信用户唯一标识
            city TEXT NOT NULL DEFAULT '杭州',     -- 订阅城市名称（兼容旧版）
            city_id TEXT,                          -- 和风天气城市ID（查询后缓存）
            cities TEXT,                           -- 多城市订阅JSON: [{"city": "杭州", "cityId": "101210101", "pushTime": "08:00", "isActive": true}]
            push_hour INTEGER DEFAULT 8,           -- 自定义推送小时（预留）
            push_minute INTEGER DEFAULT 0,         -- 自定义推送分钟（预留）
            is_active INTEGER DEFAULT 1,           -- 是否激活订阅
            created_at TEXT NOT NULL,              -- 订阅时间
            updated_at TEXT NOT NULL               -- 最后更新时间
        )
    """)
    conn.commit()
    conn.close()

    # 初始化重试队列表
    from retry import init_retry_db
    init_retry_db()


def add_subscriber(openid: str, city: str = "杭州") -> bool:
    """
    新增或更新订阅者
    :param openid: 微信用户 openid
    :param city: 城市名称
    :return: True=新增成功, False=已存在（已更新激活状态）
    """
    conn = get_connection()
    cursor = conn.cursor()
    now = datetime.now().isoformat()
    try:
        cursor.execute("""
            INSERT INTO subscribers (openid, city, is_active, created_at, updated_at)
            VALUES (?, ?, 1, ?, ?)
        """, (openid, city, now, now))
        conn.commit()
        return True
    except sqlite3.IntegrityError:
        # 已存在则重新激活
        cursor.execute("""
            UPDATE subscribers SET city=?, is_active=1, updated_at=? WHERE openid=?
        """, (city, now, openid))
        conn.commit()
        return False
    finally:
        conn.close()


def remove_subscriber(openid: str) -> bool:
    """
    取消订阅（软删除，标记为非激活）
    :param openid: 微信用户 openid
    :return: True=成功, False=用户不存在
    """
    conn = get_connection()
    cursor = conn.cursor()
    now = datetime.now().isoformat()
    cursor.execute("""
        UPDATE subscribers SET is_active=0, updated_at=? WHERE openid=?
    """, (now, openid))
    affected = cursor.rowcount
    conn.commit()
    conn.close()
    return affected > 0


def get_all_subscribers() -> list[dict]:
    """获取所有激活的订阅者列表"""
    conn = get_connection()
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("""
        SELECT * FROM subscribers WHERE is_active=1 ORDER BY created_at
    """)
    rows = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return rows


def get_subscriber(openid: str) -> dict | None:
    """根据 openid 获取订阅者信息"""
    conn = get_connection()
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM subscribers WHERE openid=?", (openid,))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None


def update_city_id(openid: str, city_id: str):
    """缓存城市ID，避免重复查询"""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        UPDATE subscribers SET city_id=?, updated_at=? WHERE openid=?
    """, (city_id, datetime.now().isoformat(), openid))
    conn.commit()
    conn.close()


# ===== 多城市订阅支持 =====

def get_cities(openid: str) -> list:
    """获取用户订阅的多城市列表"""
    conn = get_connection()
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("SELECT cities FROM subscribers WHERE openid=?", (openid,))
    row = cursor.fetchone()
    conn.close()

    if row and row["cities"]:
        try:
            return json.loads(row["cities"])
        except json.JSONDecodeError:
            return []
    return []


def set_cities(openid: str, cities: list):
    """设置用户订阅的多城市列表"""
    conn = get_connection()
    cursor = conn.cursor()
    now = datetime.now().isoformat()
    cities_json = json.dumps(cities, ensure_ascii=False)

    # 检查用户是否存在
    cursor.execute("SELECT id FROM subscribers WHERE openid=?", (openid,))
    exists = cursor.fetchone()

    if exists:
        cursor.execute("""
            UPDATE subscribers SET cities=?, is_active=1, updated_at=? WHERE openid=?
        """, (cities_json, now, openid))
    else:
        # 新用户，创建记录
        default_city = cities[0] if cities else {"city": "杭州", "pushTime": "08:00", "isActive": True}
        cursor.execute("""
            INSERT INTO subscribers (openid, city, cities, is_active, created_at, updated_at)
            VALUES (?, ?, ?, 1, ?, ?)
        """, (openid, default_city.get("city", "杭州"), cities_json, now, now))

    conn.commit()
    conn.close()


def add_city_to_subscription(openid: str, city: str, city_id: str = None, push_time: str = "08:00"):
    """添加一个城市到订阅列表"""
    cities = get_cities(openid)

    # 检查城市是否已存在
    for c in cities:
        if c.get("city") == city:
            c["isActive"] = True
            if city_id:
                c["cityId"] = city_id
            break
    else:
        # 新城市
        new_city = {"city": city, "pushTime": push_time, "isActive": True}
        if city_id:
            new_city["cityId"] = city_id
        cities.append(new_city)

    set_cities(openid, cities)
    return cities


def remove_city_from_subscription(openid: str, city: str):
    """从订阅列表中移除一个城市"""
    cities = get_cities(openid)
    cities = [c for c in cities if c.get("city") != city]
    set_cities(openid, cities)
    return cities


def update_city_id_in_cities(openid: str, city: str, city_id: str):
    """更新某个城市的cityId"""
    cities = get_cities(openid)
    for c in cities:
        if c.get("city") == city:
            c["cityId"] = city_id
            break
    set_cities(openid, cities)
