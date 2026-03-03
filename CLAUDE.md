# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Zane-SR is a WeChat mini-program with a Python FastAPI backend that provides daily weather push notifications to users.

## Common Commands

### Backend Development

```bash
# Install dependencies
pip install -r backend/requirements.txt

# Start development server (with auto-reload)
cd backend && uvicorn main:app --host 0.0.0.0 --port 8080 --reload

# Run tests
cd backend && pytest

# Run a single test file
cd backend && pytest tests/test_api.py

# Run tests with coverage
cd backend && pytest --cov=. --cov-report=html
```

### Mini-program Development

Open the `miniapp/` directory in WeChat Developer Tools. Modify `utils/config.js` to set the correct `BASE_URL`.

## Architecture

### Backend (Python FastAPI)

- **main.py**: FastAPI app entry point with all API routes
- **config.py**: Configuration loaded from environment variables (`.env` file)
- **database.py**: SQLite database operations (subscribers table)
- **weather.py**: QWeather API integration
- **wechat.py**: WeChat subscription message push
- **scheduler.py**: APScheduler-based daily push task
- **auth.py**: API key authentication for admin endpoints
- **retry.py**: Failed push retry queue mechanism

API routes are defined in `main.py`:
- `POST /api/subscribe` - Subscribe to weather alerts
- `POST /api/unsubscribe` - Unsubscribe
- `GET /api/subscriber/{openid}` - Check subscription status
- `GET /api/weather/{city}` - Query weather (debug)
- `POST /api/push/now` - Manually trigger push (requires API key)
- `POST /api/login` - WeChat mini-program login (code -> openid)
- `POST /api/photo/upload` - Upload photo
- `GET /api/photos` - List photos

### Frontend (WeChat Mini-program)

- **app.json**: Tab bar configuration (album, weather, my)
- **pages/album/**: Photo album
- **pages/weather/**: Weather query
- **pages/my/**: User profile, login, theme settings
- **utils/request.js**: HTTP request wrapper
- **utils/config.js**: API base URL configuration

## 🤖 与服务器 AI 助手（小Z）协作

本项目服务器上运行着 AI 助手「小Z」，负责数据库维护、服务运维等工作。
你（本地 Claude Code）可以通过 **commit message** 向小Z下达任务指令，push 后自动触发执行。

### 任务指令格式

在 commit message 末尾追加任务块：

```
你的正常 commit 描述

[task:类型] 任务内容 [/task]
```

或单行简写（适合短指令）：

```
你的正常 commit 描述

[task] 类型: 内容
```

### 支持的任务类型

#### `db_migrate` — 数据库变更（最常用）
```
feat: 新增用户备注字段

[task:db_migrate]
ALTER TABLE subscribers ADD COLUMN nickname TEXT DEFAULT '';
ALTER TABLE subscribers ADD COLUMN avatar_url TEXT DEFAULT ''
[/task]
```

#### `shell` — 执行服务器命令（白名单限制）
```
feat: 新增依赖库

[task] shell: pip install pillow==10.0.0
```

白名单：`pip install`、`python3`、`pm2`

#### `note` — 备注（仅通知，不执行操作）
```
fix: 修复天气接口

[task] note: 此次修复需要清除天气缓存，已通过重启服务处理
```

### 执行流程

1. 你 push 代码到 `feat/cream-style-ui`
2. GitHub Webhook 触发 → 服务器自动 pull + 重启
3. 解析 commit message 中的 `[task]` 指令并执行
4. 小Z 通过 Telegram 通知 Zane，汇报部署结果 + 任务执行情况

### 注意事项

- 每个 commit 可以包含多个 `[task]` 指令
- `db_migrate` 支持多条 SQL，用 `;` 分隔
- SQL 语句会在生产数据库上直接执行，**务必先在本地验证**
- 如果任务执行失败，小Z 会在 Telegram 通知中标注 ❌ 并附带错误信息

## Configuration

Required environment variables in `backend/.env`:
- `WECHAT_APP_ID`, `WECHAT_APP_SECRET`, `WECHAT_TEMPLATE_ID` - WeChat credentials
- `QWEATHER_API_KEY` - QWeather API key
- `API_KEY` - Admin API authentication key
- `PUSH_HOUR`, `PUSH_MINUTE` - Daily push time (default 8:00)

Copy `backend/.env.example` to `backend/.env` and fill in the values.
