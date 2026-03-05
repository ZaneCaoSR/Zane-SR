# Miniapp E2E (miniprogram-automator)

> 目标：在 **微信开发者工具** 上跑 UI/冒烟自动化（E2E）。

## 运行前置

- 安装微信开发者工具（Windows 推荐）
- 能在 DevTools 里正常打开本项目（`miniapp/`）并预览运行

## 运行方式

在 `miniapp/` 目录：

```bash
npm i

# 必填：小程序工程绝对路径（指向 miniapp 目录）
# Windows PowerShell:
#   $env:MINIPROGRAM_PROJECT_PATH = "D:\\path\\to\\repo\\miniapp"
# cmd:
#   set MINIPROGRAM_PROJECT_PATH=D:\path\to\repo\miniapp

npm run test:e2e
```

## 说明

- `tests/e2e/run.js` 目前是一个 **冒烟骨架**：只验证 `/pages/album/index` 能被 reLaunch 并渲染。
- 后续扩展建议：
  1. 把选择器抽象成 page-object（例如 `tests/e2e/pages/album.page.js`）
  2. 固定 10 条关键路径作为回归冒烟集
  3. 与 CI 分离：Linux 跑 unit/api，Windows 夜间跑 e2e
