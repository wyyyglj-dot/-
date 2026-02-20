[根目录](../CLAUDE.md) > **server**

# server -- Express REST API 后端

## 模块职责

提供点餐系统的全部 REST API，管理 SQLite 数据库，通过 SSE 向前端推送实时事件。采用模块化 Router/Service/Repo 三层架构。

## 入口与启动

- 入口文件：`src/server.ts` -- 初始化数据库、运行迁移、启动 HTTP 服务
- Express 应用组装：`src/app.ts` -- 注册中间件与路由
- 启动命令：`npm run dev` (tsx watch) / `npm run start` (编译后)

## 对外接口

所有 API 挂载在 `/api/v1` 前缀下，统一响应格式 `{ ok, data?, error?, meta }`.

### 菜品管理 (menu)
- `GET /categories` -- 分类列表
- `POST /categories` -- 创建分类
- `PATCH /categories/:id` -- 更新分类
- `DELETE /categories/:id` -- 删除分类
- `GET /dishes` -- 菜品列表 (支持 query 过滤)
- `POST /dishes` -- 创建菜品
- `PATCH /dishes/:id` -- 更新菜品
- `DELETE /dishes/:id` -- 删除菜品

### 桌位管理 (tables)
- `GET /tables` -- 桌位列表
- `GET /tables/summary` -- 全部桌位摘要 (含状态/菜品/金额)
- `GET /tables/:tableId/summary` -- 单桌摘要
- `POST /tables` -- 创建桌位
- `PATCH /tables/:id` -- 更新桌位

### 用餐会话 (sessions)
- `POST /tables/:tableId/sessions` -- 开台
- `GET /sessions/:sessionId` -- 会话详情 (含工单)
- `DELETE /sessions/:sessionId` -- 取消会话

### 点餐工单 (tickets)
- `POST /sessions/:sessionId/tickets` -- 创建工单 (下单)
- `PATCH /ticket-items/:itemId` -- 修改工单明细 (退菜等)

### 上菜队列 (serving)
- `GET /serving-queue` -- 待上菜队列
- `GET /served-items` -- 已上菜列表
- `POST /ticket-items/:itemId/serve` -- 标记上菜
- `POST /ticket-items/:itemId/unserve` -- 撤销上菜

### 结账 (checkout)
- `POST /sessions/:sessionId/checkout` -- 结账

### 营业统计 (stats)
- `GET /stats/revenue` -- 营收统计
- `GET /stats/rankings/quantity` -- 销量排行
- `GET /stats/rankings/revenue` -- 营收排行
- `GET /stats/rankings/profit` -- 利润排行
- `GET /stats/dashboard` -- 仪表盘聚合数据

### 历史记录 (history)
- `GET /history/sessions` -- 已结账会话列表
- `GET /history/sessions/:sessionId` -- 已结账会话详情
- `POST /history/sessions/:sessionId/restore` -- 恢复已结账会话
- `DELETE /history/sessions/:sessionId` -- 删除历史记录

### 实时事件 (SSE)
- `GET /events` -- SSE 连接端点
- 事件类型：`session.opened`, `ticket.created`, `serving.updated`, `checkout.completed`, `table.updated`, `menu.updated`

### 系统管理 (system)
- `GET /system/lan` -- 局域网 IP 信息
- `GET /system/db` -- 数据库状态 (需管理员)
- `POST /system/db/backup` -- 数据库备份 (需管理员)
- `POST /system/db/restore` -- 数据库恢复 (需管理员)
- `POST /system/db/migrate` -- 数据库迁移路径 (需管理员)

## 关键依赖与配置

| 依赖 | 用途 |
|------|------|
| express | HTTP 框架 |
| better-sqlite3 | SQLite 驱动 (同步 API，WAL 模式) |
| cors | 跨域支持 |
| multer | 文件上传 (数据库恢复) |
| uuid | 请求 ID 生成 |
| tsx | 开发热重载 |

- TypeScript 编译目标：ES2022, CommonJS
- 配置文件：`src/config/constants.ts` -- PORT / DB_PATH / CORS_ORIGIN

## 数据模型

SQLite 数据库，8 个迁移文件 (`src/db/migrations/0001~0008`)：

| 表 | 说明 |
|------|------|
| `menu_category` | 菜品分类 (名称/排序/启用/跳过上菜队列/折扣) |
| `menu_dish` | 菜品 (分类/售价/成本/折扣/辣度选项/启用/排序) |
| `dining_table` | 桌位 (桌号/排序/启用) |
| `table_session` | 用餐会话 (桌位/状态: DINING/PENDING_CHECKOUT/CLOSED) |
| `order_ticket` | 点餐工单 (会话/备注) |
| `order_ticket_item` | 工单明细 (菜品快照/售价/成本/数量/已上菜/已退/辣度) |
| `payment` | 支付记录 (会话/方式: CASH/WECHAT/ALIPAY/金额/营业日) |
| `_migrations` | 迁移记录 |

## 测试与质量

当前无自动化测试。建议引入 Vitest 对 service/repo 层进行单元测试。

## 常见问题 (FAQ)

- 数据库锁定：已配置 `busy_timeout = 5000` 和 WAL 模式
- 管理员接口权限：优先检查 `ADMIN_TOKEN` 请求头，回退本机 IP 校验
- 维护模式：`withMaintenance()` 包裹的操作期间，所有 API 返回 503

## 相关文件清单

```
server/
  package.json
  tsconfig.json
  src/
    server.ts              # 入口
    app.ts                 # Express 应用组装
    config/constants.ts    # 配置常量
    db/
      client.ts            # 数据库连接管理
      migrate.ts           # 迁移执行器
      migrations/          # SQL 迁移文件 (0001~0008)
    shared/
      response.ts          # 统一响应格式
      errors.ts            # 错误类 (DomainError/NotFoundError/ConflictError)
      middleware.ts         # requestId 中间件
      validation.ts        # 参数校验工具
      types.ts             # 共享类型定义
    modules/
      menu/                # 菜品管理 (router/service/repo)
      tables/              # 桌位管理
      sessions/            # 用餐会话
      tickets/             # 点餐工单
      serving/             # 上菜队列
      checkout/            # 结账
      stats/               # 营业统计
      history/             # 历史记录
      sse/                 # SSE 实时推送 (hub + router)
      system/              # 系统管理 (LAN/DB 备份恢复)
```

## 变更记录 (Changelog)

| 时间 | 操作 | 说明 |
|------|------|------|
| 2026-02-20 15:10:51 UTC | 初始化 | 首次生成模块文档 |
