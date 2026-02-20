# 点餐系统

烧烤店点餐管理系统，支持桌台管理、菜单配置、下单出餐、结账统计等完整流程。

## 技术栈

- 前端：Vue 3 + Naive UI + TailwindCSS + ECharts
- 后端：Express + Better-SQLite3
- 桌面端：Electron

## 快速开始

```bash
# 安装依赖
npm install
cd server && npm install
cd ../web && npm install
cd ..

# 启动开发环境（同时启动前后端）
npm run dev
```

前端默认运行在 `http://localhost:5173`，后端 API 运行在 `http://localhost:3000`。

## 打包桌面应用

```bash
npm run dist
```

构建产物在 `release/` 目录下。

## 项目结构

```
├── server/          # 后端服务
│   └── src/
│       ├── db/          # 数据库与迁移
│       └── modules/     # 业务模块（菜单/桌台/出餐/结账/统计等）
├── web/             # 前端应用
│   └── src/
│       ├── views/       # 页面
│       ├── components/  # 组件
│       ├── stores/      # 状态管理
│       └── api/         # 接口调用
└── electron/        # Electron 主进程
```
