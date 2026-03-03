"""
test_database.py - 数据库持久化测试
验证 database.py 中的数据库操作
"""
import pytest
import sqlite3
import sys
from pathlib import Path

# 添加 backend 目录到路径
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))


class TestDatabaseInit:
    """数据库初始化测试"""

    def test_init_db_creates_tables(self, test_db):
        """测试数据库初始化创建表"""
        from database import get_connection
        
        conn = get_connection()
        cursor = conn.cursor()
        
        # 检查 subscribers 表是否存在
        cursor.execute("""
            SELECT name FROM sqlite_master WHERE type='table' AND name='subscribers'
        """)
        result = cursor.fetchone()
        
        assert result is not None, "subscribers table should exist"
        assert result[0] == "subscribers"
        
        conn.close()

    def test_init_db_creates_retry_queue_table(self, test_db):
        """测试重试队列表创建"""
        from database import get_connection
        
        conn = get_connection()
        cursor = conn.cursor()
        
        # 检查 retry_queue 表是否存在
        cursor.execute("""
            SELECT name FROM sqlite_master WHERE type='table' AND name='retry_queue'
        """)
        result = cursor.fetchone()
        
        assert result is not None, "retry_queue table should exist"
        
        conn.close()


class TestSubscriberCRUD:
    """订阅者增删改查测试"""

    def test_add_subscriber_new(self, test_db):
        """测试新增订阅者"""
        from database import add_subscriber, get_subscriber
        
        result = add_subscriber("new_user_001", "杭州")
        
        assert result is True, "Should return True for new user"
        
        # 验证用户已添加
        user = get_subscriber("new_user_001")
        assert user is not None
        assert user["openid"] == "new_user_001"
        assert user["city"] == "杭州"
        assert user["is_active"] == 1

    def test_add_subscriber_duplicate(self, test_db):
        """测试重复添加订阅者"""
        from database import add_subscriber
        
        add_subscriber("existing_user", "北京")
        result = add_subscriber("existing_user", "上海")
        
        assert result is False, "Should return False for existing user"

    def test_add_subscriber_updates_inactive(self, test_db):
        """测试重新激活已取消订阅的用户"""
        from database import add_subscriber, remove_subscriber, get_subscriber
        
        # 添加用户
        add_subscriber("reactive_user", "北京")
        
        # 取消订阅
        remove_subscriber("reactive_user")
        
        # 重新订阅
        add_subscriber("reactive_user", "广州")
        
        # 验证用户已重新激活
        user = get_subscriber("reactive_user")
        assert user["is_active"] == 1
        assert user["city"] == "广州"

    def test_remove_subscriber(self, test_db):
        """测试取消订阅（软删除）"""
        from database import add_subscriber, remove_subscriber, get_subscriber
        
        add_subscriber("remove_test_user", "深圳")
        
        result = remove_subscriber("remove_test_user")
        
        assert result is True
        
        # 验证用户已标记为非活跃
        user = get_subscriber("remove_test_user")
        assert user["is_active"] == 0

    def test_remove_subscriber_not_found(self, test_db):
        """测试取消不存在的订阅"""
        from database import remove_subscriber
        
        result = remove_subscriber("nonexistent_user")
        
        assert result is False

    def test_get_all_subscribers(self, test_db):
        """测试获取所有订阅者"""
        from database import add_subscriber, get_all_subscribers
        
        add_subscriber("user_a", "北京")
        add_subscriber("user_b", "上海")
        add_subscriber("user_c", "广州")
        
        subscribers = get_all_subscribers()
        
        assert len(subscribers) >= 3
        
        # 验证只返回活跃用户
        from database import remove_subscriber
        remove_subscriber("user_a")
        
        subscribers = get_all_subscribers()
        openids = [s["openid"] for s in subscribers]
        assert "user_a" not in openids

    def test_get_subscriber_not_found(self, test_db):
        """测试获取不存在的订阅者"""
        from database import get_subscriber
        
        user = get_subscriber("not_found_user")
        
        assert user is None


class TestSubscriberFields:
    """订阅者字段测试"""

    def test_subscriber_required_fields(self, test_db):
        """测试订阅者必要字段"""
        from database import add_subscriber, get_subscriber
        
        add_subscriber("field_test_user", "杭州")
        
        user = get_subscriber("field_test_user")
        
        # 检查必要字段
        required_fields = ["id", "openid", "city", "is_active", "created_at", "updated_at"]
        for field in required_fields:
            assert field in user, f"Missing required field: {field}"

    def test_subscriber_default_values(self, test_db):
        """测试订阅者默认值"""
        from database import add_subscriber, get_subscriber
        
        add_subscriber("default_user", "北京")
        
        user = get_subscriber("default_user")
        
        # 验证默认值
        assert user["city"] == "北京"
        assert user["is_active"] == 1
        assert user["push_hour"] == 8
        assert user["push_minute"] == 0

    def test_city_id_caching(self, test_db):
        """测试城市ID缓存"""
        from database import add_subscriber, update_city_id, get_subscriber
        
        add_subscriber("cache_user", "杭州")
        
        update_city_id("cache_user", "101210101")
        
        user = get_subscriber("cache_user")
        
        assert user["city_id"] == "101210101"


class TestDatabaseConnection:
    """数据库连接测试"""

    def test_get_connection(self, test_db):
        """测试获取数据库连接"""
        from database import get_connection
        
        conn = get_connection()
        
        assert conn is not None
        assert isinstance(conn, sqlite3.Connection)
        
        conn.close()

    def test_connection_creates_directory(self):
        """测试连接自动创建目录"""
        import os
        import tempfile
        from database import DATABASE_PATH
        
        # 使用临时路径
        original_path = DATABASE_PATH
        temp_dir = tempfile.mkdtemp()
        temp_db = os.path.join(temp_dir, "test.db")
        
        # 临时修改路径
        import database
        database.DATABASE_PATH = temp_db
        
        try:
            conn = database.get_connection()
            assert conn is not None
            conn.close()
        finally:
            # 恢复原路径
            database.DATABASE_PATH = original_path
            # 清理临时文件
            import shutil
            shutil.rmtree(temp_dir, ignore_errors=True)


class TestRetryQueue:
    """重试队列测试"""

    def test_add_to_retry_queue(self, test_db):
        """测试添加重试任务"""
        from retry import add_to_retry_queue, get_retry_queue
        
        add_to_retry_queue("retry_user_1", "杭州", "推送失败：token无效")
        
        queue = get_retry_queue()
        
        assert len(queue) >= 1
        assert queue[0]["openid"] == "retry_user_1"
        assert queue[0]["city"] == "杭州"
        assert queue[0]["retry_count"] == 0

    def test_clear_retry_queue(self, test_db):
        """测试清空重试队列"""
        from retry import add_to_retry_queue, clear_retry_queue, get_retry_queue
        
        add_to_retry_queue("retry_user_2", "北京", "测试错误")
        
        clear_retry_queue()
        
        queue = get_retry_queue()
        
        assert len(queue) == 0

    def test_retry_queue_persistence(self, test_db):
        """测试重试队列持久化"""
        from retry import add_to_retry_queue, get_retry_queue
        
        # 添加一些任务
        add_to_retry_queue("persist_user_1", "北京", "错误1")
        add_to_retry_queue("persist_user_2", "上海", "错误2")
        
        # 模拟重启（重新获取连接）
        from database import get_connection
        conn = get_connection()
        conn.close()
        
        # 再次获取队列
        queue = get_retry_queue()
        
        assert len(queue) >= 2
