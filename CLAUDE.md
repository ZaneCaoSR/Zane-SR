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

## Configuration

Required environment variables in `backend/.env`:
- `WECHAT_APP_ID`, `WECHAT_APP_SECRET`, `WECHAT_TEMPLATE_ID` - WeChat credentials
- `QWEATHER_API_KEY` - QWeather API key
- `API_KEY` - Admin API authentication key
- `PUSH_HOUR`, `PUSH_MINUTE` - Daily push time (default 8:00)

Copy `backend/.env.example` to `backend/.env` and fill in the values.
