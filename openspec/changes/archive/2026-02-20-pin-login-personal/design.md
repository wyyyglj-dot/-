# PIN Login Personal - 技术设计

## 架构决策

### AD-001: 会话架构 → 有状态 DB 会话

**选择**: Option A - 有状态 opaque token + SQLite `auth_session` 表

**理由**:
- 个人单机部署，无水平扩展需求，JWT 的无状态优势无意义
- 即时撤销（登出/PIN变更）简单直接，无需黑名单
- 与现有同步 SQLite 架构一致
- 实现复杂度最低

**否决方案**:
- JWT (Option B): 撤销困难，个人系统不需要无状态
- Hybrid JWT+DB (Option C): 过度设计，违反 YAGNI

### AD-002: PIN 哈希 → scrypt (Node 内置)

**选择**: `crypto.scryptSync(pin, salt, 64, { N: 32768, r: 8, p: 1 })`

**参数**: N=32768, r=8, p=1, dkLen=64, salt=16B `crypto.randomBytes`

**理由**:
- Node.js 内置，零额外依赖
- 对 6 位 PIN 的低熵输入提供足够的暴力破解防护
- 参数存储在 `pin_algo` 字段，支持未来迁移

**否决方案**:
- Argon2id: 需要 native 编译依赖，Electron 打包可能有兼容问题

### AD-003: Token 生成与存储

**选择**: `crypto.randomBytes(32)` → base64url 编码 → 存储 SHA-256 哈希

**理由**:
- 32 字节随机数提供 256 位熵
- DB 仅存哈希，即使数据库泄露也无法直接使用 token
- SHA-256 查找足够快（非密码哈希，仅用于索引匹配）

### AD-004: SSE 认证 → 直接 query param

**选择**: `EventSource('/api/v1/events?token=xxx')`

**理由**:
- EventSource 不支持自定义 header，这是唯一可行方案
- 局域网场景，token 泄露风险可控
- 实现简单，无需额外 ticket 端点

**风险接受**: query param 中的 token 可能出现在浏览器历史和服务器日志中，个人局域网场景下接受此风险

### AD-005: 无登录速率限制

**选择**: 不实现登录失败锁定

**理由**: 用户明确决策，个人系统无外部攻击面

### AD-006: 安全答案大小写不敏感

**选择**: 验证前 `answer.trim().toLowerCase()` 再哈希比对

**理由**: 提升用户体验，避免因大小写记忆错误导致恢复失败

## 中间件管道顺序

```
cors → express.json → requestId → maintenanceMiddleware
  → authRouter (公开端点: state/setup/login/recover)
  → authMiddleware (默认拒绝)
  → sseRouter (SSE 端点，authMiddleware 内部处理 query param)
  → [所有业务 router]
  → errorHandler
```

**关键**: authRouter 必须在 authMiddleware 之前注册，否则登录端点被拦截。

## 文件变更清单

### 新增文件

| 文件 | 职责 |
|------|------|
| `server/src/modules/auth/auth.router.ts` | Auth API 路由定义 |
| `server/src/modules/auth/auth.service.ts` | PIN 验证/会话管理/恢复逻辑 |
| `server/src/modules/auth/auth.repo.ts` | auth 相关 SQL 操作 |
| `server/src/shared/auth-middleware.ts` | Bearer token 验证中间件 |
| `server/src/db/migrations/0009_auth.sql` | 数据库迁移 |
| `web/src/views/Login.vue` | 登录页（含数字键盘） |
| `web/src/views/Setup.vue` | PIN 设置引导页 |
| `web/src/views/Recovery.vue` | PIN 恢复页 |
| `web/src/stores/auth.ts` | Auth Pinia store |
| `web/src/api/auth.ts` | Auth API 调用封装 |
| `web/src/components/common/PinPad.vue` | 可复用数字键盘组件 |

### 修改文件

| 文件 | 变更 |
|------|------|
| `server/src/app.ts` | 注册 authRouter + authMiddleware，调整管道顺序 |
| `web/src/api/client.ts` | 添加 Bearer token 注入 + 401 拦截 |
| `web/src/api/sse.ts` | SSE URL 添加 token query param |
| `web/src/router/index.ts` | 添加 auth 路由 + beforeEach 守卫 |
| `server/src/shared/types.ts` | 添加 auth 相关类型 |
| `web/src/types/index.ts` | 同步 auth 类型 |
