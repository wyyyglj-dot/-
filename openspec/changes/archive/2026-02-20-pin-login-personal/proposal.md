## Why

当前系统所有 API 和页面完全无认证保护，任何人访问局域网地址即可操作点餐、结账、菜品管理等功能。作为个人使用的餐厅点餐系统，需要一个轻量级的 PIN 码登录机制，防止未授权访问，同时保持操作便捷性。

## What Changes

- 新增后端 auth 模块：PIN 码验证、会话管理、安全问题恢复
- 新增数据库迁移：`admin_pin` 表（PIN 哈希 + 安全问题）和 `auth_session` 表
- 新增认证中间件：保护所有 `/api/v1` 业务路由，白名单放行 auth 相关端点
- 新增前端登录页面：PIN 码输入界面（支持 PC 和 Mobile）
- 新增前端 auth store：Pinia 状态管理 + localStorage 持久化
- 修改前端 API client：自动注入 Bearer token + 401 拦截重定向
- 修改前端路由：添加 beforeEach 守卫，未认证跳转登录页
- 新增 PIN 初始设置流程：首次使用时引导设置 PIN 和安全问题
- 新增 PIN 恢复流程：通过安全问题验证后重置 PIN
- SSE 连接支持 token 认证（query parameter 降级）

## Capabilities

### New Capabilities
- `pin-auth`: PIN 码认证核心能力，包含 PIN 设置/验证/会话管理/中间件保护
- `pin-recovery`: PIN 码恢复能力，通过安全问题验证后重置 PIN
- `auth-ui`: 认证相关 UI，包含登录页面、PIN 设置引导、恢复流程界面

### Modified Capabilities
<!-- 无现有 spec 需要修改 -->

## Impact

- **后端**：新增 `server/src/modules/auth/` 模块（router + service + repo），新增 `server/src/shared/auth-middleware.ts`，修改 `server/src/app.ts` 注册路由和中间件
- **数据库**：新增迁移 `0009_auth.sql`（admin_pin + auth_session 表）
- **前端**：新增 `web/src/views/Login.vue`、`web/src/stores/auth.ts`、`web/src/api/auth.ts`，修改 `web/src/api/client.ts`（token 注入）、`web/src/router/index.ts`（路由守卫）、`web/src/api/sse.ts`（SSE 认证）
- **API**：新增 `POST /api/v1/auth/login`、`POST /api/v1/auth/setup`、`POST /api/v1/auth/recover`、`GET /api/v1/auth/check`、`POST /api/v1/auth/logout` 端点
- **Breaking**：所有现有 API 端点将要求 Bearer token 认证
