# Weather Mini - 微信小程序天气提醒

每天早上 8 点，自动推送天气信息到微信。

## 项目结构

```
weather-mini/
├── backend/           # Python 后端（FastAPI）
│   ├── main.py        # API 入口
│   ├── config.py      # 配置管理
│   ├── database.py    # SQLite 数据库
│   ├── weather.py     # 和风天气 API
│   ├── wechat.py      # 微信订阅消息推送
│   ├── scheduler.py   # 定时任务
│   └── requirements.txt
├── miniapp/           # 微信小程序前端
│   ├── app.js/json/wxss
│   ├── pages/index/   # 首页
│   └── utils/         # 工具函数
└── data/              # SQLite 数据库文件（自动创建）
```

## 部署步骤

### 后端

1. 复制配置文件：`cp backend/.env.example backend/.env`
2. 填入真实配置（参见下方「需要的 Key」）
3. 安装依赖：`pip install -r backend/requirements.txt`
4. 启动服务：`uvicorn main:app --host 0.0.0.0 --port 8080 --reload`

### 需要的 Key

| 配置项 | 获取地址 |
|--------|----------|
| WECHAT_APP_ID | 微信公众平台 → 开发管理 → 开发设置 |
| WECHAT_APP_SECRET | 同上 |
| WECHAT_TEMPLATE_ID | 微信公众平台 → 订阅消息 → 选择模板 |
| QWEATHER_API_KEY | https://dev.qweather.com → 控制台 → 项目管理 |

### 小程序

1. 用微信开发者工具打开 `miniapp/` 目录
2. 修改 `utils/config.js` 中的 `BASE_URL` 为你的服务器地址（需 HTTPS）
3. 修改 `pages/index/index.js` 中的 `templateId`
4. 提交审核或本地预览

## API 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/subscribe | 订阅天气提醒 |
| POST | /api/unsubscribe | 取消订阅 |
| GET | /api/subscriber/{openid} | 查询订阅状态 |
| GET | /api/weather/{city} | 查询天气（调试）|
| POST | /api/push/now | 立即触发推送（调试）|
