"""
scheduler.py - 定时推送任务
使用 APScheduler AsyncIOScheduler，每天定时向所有订阅用户推送天气
"""
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from database import get_all_subscribers
from weather import get_weather
from wechat import send_weather_message
from config import PUSH_HOUR, PUSH_MINUTE

# 全局调度器实例
scheduler = AsyncIOScheduler()


async def push_daily_weather():
    """
    每日天气推送任务：拉取所有订阅者，逐一推送天气消息
    """
    subscribers = get_all_subscribers()
    if not subscribers:
        print("[Scheduler] 当前无订阅用户，跳过推送")
        return

    print(f"[Scheduler] 开始推送，共 {len(subscribers)} 名用户")
    success_count = 0

    for user in subscribers:
        openid = user["openid"]
        city = user["city"]

        # 获取天气数据
        weather = await get_weather(city)
        if not weather:
            print(f"[Scheduler] 获取 {city} 天气失败，跳过 {openid}")
            continue

        # 发送订阅消息
        ok = await send_weather_message(openid, weather)
        if ok:
            success_count += 1

    print(f"[Scheduler] 推送完成：{success_count}/{len(subscribers)} 成功")


def start_scheduler():
    """启动定时任务调度器"""
    scheduler.add_job(
        push_daily_weather,
        trigger=CronTrigger(hour=PUSH_HOUR, minute=PUSH_MINUTE),
        id="daily_weather_push",
        name="每日天气推送",
        replace_existing=True,
    )
    scheduler.start()
    print(f"[Scheduler] 定时任务已启动，每天 {PUSH_HOUR:02d}:{PUSH_MINUTE:02d} 推送")


def stop_scheduler():
    """停止调度器"""
    if scheduler.running:
        scheduler.shutdown()
        print("[Scheduler] 定时任务已停止")
