# PIN Login Personal - 实施任务

> 零决策实施计划。每个任务包含精确的输入/输出/验证标准。

## Task 1: 数据库迁移 0009_auth.sql

**文件**: `server/src/db/migrations/0009_auth.sql`

**操作**: 创建 `admin_pin` 和 `auth_session` 表

**精确内容**:
```sql
BEGIN IMMEDIATE;

CREATE TABLE IF NOT EXISTS admin_pin (
  id INTEGER PRIMARY KEY CHECK(id = 1),
  pin_hash TEXT NOT NULL,
  pin_salt TEXT NOT NULL,
  pin_algo TEXT NOT NULL DEFAULT 'scrypt:N=32768,r=8,p=1,dkLen=64',
  security_question TEXT NOT NULL,
  security_answer_hash TEXT NOT NULL,
  security_answer_salt TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT(datetime('now'))
);

CREATE TABLE IF NOT EXISTS auth_session (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  token_hash TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT(datetime('now')),
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  client_ip TEXT,
  user_agent TEXT
);

CREATE INDEX IF NOT EXISTS idx_auth_session_expires ON auth_session(expires_at);
CREATE INDEX IF NOT EXISTS idx_auth_session_token ON auth_session(token_hash);

COMMIT;
```

**验证**: 启动服务器，检查 `_migrations` 表包含 `0009_auth.sql`，两张表存在且约束正确。

---

## Task 2: 后端 Auth Repo 层

**文件**: `server/src/modules/auth/auth.repo.ts`

**操作**: 实现所有 auth 相关 SQL 操作

**函数签名**:
- `getAdminPin(): AdminPinRow | undefined` — 查询 admin_pin 行
- `upsertAdminPin(pinHash, pinSalt, question, answerHash, answerSalt): void` — UPSERT admin_pin
- `createSession(tokenHash, expiresAt, clientIp, userAgent): number` — 插入会话，返回 id
- `findValidSession(tokenHash): SessionRow | undefined` — 查找未过期未撤销的会话
- `revokeSession(tokenHash): void` — 设置 revoked_at
- `revokeAllSessions(): void` — 撤销所有会话
- `revokeAllSessionsExcept(tokenHash): void` — 撤销除指定 token 外的所有会话
- `cleanupExpiredSessions(): number` — 删除过期会话，返回删除数

**依赖**: `server/src/db/client.ts` 的 `getDb()`

**验证**: 每个函数可独立调用，SQL 语法正确，事务边界清晰。

---

## Task 3: 后端 Auth Service 层

**文件**: `server/src/modules/auth/auth.service.ts`

**操作**: 实现 PIN 验证、会话管理、恢复逻辑

**函数签名**:
- `isSetupRequired(): boolean` — admin_pin 表是否为空
- `getSecurityQuestion(): string | null` — 返回安全问题文本
- `setupPin(pin, question, answer): { token: string }` — 设置 PIN + 安全问题，创建会话
- `login(pin, clientIp, userAgent): { token: string }` — 验证 PIN，创建会话
- `recover(answer, newPin, clientIp, userAgent): { token: string }` — 验证答案，重置 PIN，撤销旧会话
- `logout(tokenHash): void` — 撤销会话
- `validateToken(rawToken): boolean` — SHA-256 哈希后查 DB 验证

**内部工具函数**:
- `hashPin(pin, salt?): { hash: string, salt: string }` — scrypt 哈希
- `verifyPin(pin, hash, salt): boolean` — scrypt 验证
- `generateToken(): { raw: string, hash: string }` — crypto.randomBytes(32) + SHA-256
- `isWeakPin(pin): boolean` — 弱 PIN 检测

**弱 PIN 列表**: `000000`~`999999`(全重复), `123456`, `654321`, `012345`, `543210`

**验证**: setup → login → check → logout 完整流程可执行。

---

## Task 4: 后端 Auth 中间件

**文件**: `server/src/shared/auth-middleware.ts`

**操作**: Express 中间件，默认拒绝未认证请求

**逻辑**:
1. 检查 `admin_pin` 表是否为空 → 空则放行（未设置 PIN）
2. 从 `Authorization: Bearer <token>` 或 `?token=<token>` 提取 token
3. 调用 `authService.validateToken(token)`
4. 有效 → `next()`；无效/缺失 → 返回 401

**验证**: 无 PIN 时所有路由可访问；有 PIN 时无 token 返回 401；有效 token 放行。

---

## Task 5: 后端 Auth Router + app.ts 集成

**文件**: `server/src/modules/auth/auth.router.ts`, `server/src/app.ts`

**Router 端点**:
- `GET /auth/state` → `{ setupRequired, securityQuestion? }`
- `POST /auth/setup` → 校验 body `{ pin, question, answer }` → `{ token }`
- `POST /auth/login` → 校验 body `{ pin }` → `{ token }`
- `POST /auth/recover` → 校验 body `{ answer, newPin }` → `{ token }`
- `GET /auth/check` → `{ authenticated: true }`
- `POST /auth/logout` → `{ ok: true }`

**app.ts 修改**:
```typescript
// 在 maintenanceMiddleware 之后，业务路由之前
app.use('/api/v1', authRouter)      // 公开 auth 端点
app.use('/api/v1', authMiddleware)  // 默认拒绝
// ... 现有业务路由
```

**验证**: 所有 6 个端点可调用，响应格式符合统一格式 `{ ok, data, meta }`。

---

## Task 6: 共享类型定义

**文件**: `server/src/shared/types.ts`, `web/src/types/index.ts`

**新增类型**:
```typescript
interface AuthStateResponse {
  setupRequired: boolean
  securityQuestion?: string
}

interface AuthTokenResponse {
  token: string
}

interface AuthSetupRequest {
  pin: string
  question: string
  answer: string
}

interface AuthLoginRequest {
  pin: string
}

interface AuthRecoverRequest {
  answer: string
  newPin: string
}
```

**验证**: 前后端类型一致，TypeScript 编译无错误。

---

## Task 7: 前端 Auth API 封装

**文件**: `web/src/api/auth.ts`

**函数**:
- `getAuthState(): Promise<AuthStateResponse>`
- `setupPin(data: AuthSetupRequest): Promise<AuthTokenResponse>`
- `login(pin: string): Promise<AuthTokenResponse>`
- `recover(data: AuthRecoverRequest): Promise<AuthTokenResponse>`
- `checkAuth(): Promise<void>`
- `logout(): Promise<void>`

**验证**: 每个函数调用对应后端端点，类型正确。

---

## Task 8: 前端 Auth Store (Pinia)

**文件**: `web/src/stores/auth.ts`

**State**: `token: string | null`, `setupRequired: boolean`
**Actions**: `checkState()`, `login(pin)`, `logout()`, `setup(pin, q, a)`, `recover(a, newPin)`
**持久化**: `token` 读写 `localStorage.getItem/setItem('auth_token')`

**验证**: store 状态与 localStorage 同步，login 后 token 非空，logout 后 token 为 null。

---

## Task 9: 前端 API Client 改造

**文件**: `web/src/api/client.ts`

**修改**:
1. `request()` 函数内，构建 headers 时检查 `localStorage.getItem('auth_token')`
2. 存在则添加 `Authorization: Bearer ${token}`
3. 响应 status 401 时：`localStorage.removeItem('auth_token')` + `window.location.href = '/login'`

**验证**: 有 token 时请求包含 Authorization header；401 时清除 token 并跳转。

---

## Task 10: 前端 SSE 认证改造

**文件**: `web/src/api/sse.ts`

**修改**:
1. `connect()` 时读取 `localStorage.getItem('auth_token')`
2. URL: `'/api/v1/events' + (token ? '?token=' + encodeURIComponent(token) : '')`
3. `onerror` 重连时重新读取 token（不缓存旧值）

**验证**: SSE 连接 URL 包含 token；重连使用最新 token。

---

## Task 11: 前端 PinPad 组件

**文件**: `web/src/components/common/PinPad.vue`

**Props**: `length: number` (默认 6), `error: boolean`
**Emits**: `complete(pin: string)`, `update(pin: string)`

**UI**:
- 6 个圆点指示器（已输入=实心，未输入=空心）
- 3×4 数字键盘网格（1-9, 空, 0, 删除）
- error=true 时圆点抖动动画（CSS shake）
- 输入满 length 位自动 emit `complete`
- 响应式：Mobile 全宽，PC max-width 320px

**验证**: 只接受数字输入，长度上限 6，complete 事件在满位时触发。

---

## Task 12: 前端登录页

**文件**: `web/src/views/Login.vue`

**功能**:
- 使用 PinPad 组件
- complete 事件触发 `authStore.login(pin)`
- 登录失败：PinPad error 状态 + 0.5s 后清空
- 登录成功：跳转 `/`（或 `/m` 如果移动端）
- "忘记 PIN？" 链接跳转 `/recovery`

**验证**: 输入正确 PIN 跳转首页；错误 PIN 显示抖动动画。

---

## Task 13: 前端 Setup 页

**文件**: `web/src/views/Setup.vue`

**功能**:
- 步骤 1: PinPad 输入新 PIN
- 步骤 2: PinPad 确认 PIN（不一致则提示重新输入）
- 步骤 3: NInput 输入安全问题 + NInput(password) 输入答案
- 提交调用 `authStore.setup(pin, question, answer)`
- 成功后跳转首页

**验证**: 两次 PIN 不一致时提示；完整流程后自动登录。

---

## Task 14: 前端 Recovery 页

**文件**: `web/src/views/Recovery.vue`

**功能**:
- 显示安全问题（从 authStore.checkState 获取）
- NInput 输入答案
- PinPad 输入新 PIN + 确认
- 提交调用 `authStore.recover(answer, newPin)`
- 成功后跳转首页

**验证**: 正确答案 + 新 PIN 后自动登录；错误答案显示错误提示。

---

## Task 15: 前端路由守卫

**文件**: `web/src/router/index.ts`

**修改**:
1. 添加路由：`/login` → Login.vue, `/setup` → Setup.vue, `/recovery` → Recovery.vue
2. `beforeEach` 逻辑：
   - 移动端检测（保留现有）
   - 公开路由白名单：`['/login', '/setup', '/recovery']`
   - 无 token + 非公开 → `/login`
   - 有 token + 公开路由 → `/`

**验证**: 未登录访问 `/stats` 跳转 `/login`；已登录访问 `/login` 跳转 `/`。

---

## 实施顺序

```
Task 1 (迁移) → Task 2 (repo) → Task 3 (service) → Task 4 (中间件)
  → Task 5 (router + app.ts) → Task 6 (类型)
  → Task 7-10 (前端 API/Store/Client/SSE) [可并行]
  → Task 11 (PinPad) → Task 12-14 (页面) [可并行]
  → Task 15 (路由守卫)
```

## 完成标准

- [ ] 后端所有 6 个 auth 端点可调用，响应格式正确
- [ ] 认证中间件正确保护业务路由
- [ ] 前端登录/设置/恢复流程完整可用
- [ ] SSE 连接携带 token
- [ ] TypeScript 编译无错误
- [ ] PC 和 Mobile 布局均正常显示
