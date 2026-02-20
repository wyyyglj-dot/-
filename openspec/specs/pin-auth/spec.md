# pin-auth: PIN 码认证核心能力

## 概述

为个人餐厅点餐系统提供轻量级 PIN 码认证，保护所有 `/api/v1` 业务路由。单用户模型，有状态 DB 会话。

## 需求

### REQ-AUTH-001: PIN 设置

- 系统首次使用时，必须先设置 PIN 才能访问任何业务功能
- PIN 格式：恰好 6 位纯数字，正则 `^\d{6}$`
- 弱 PIN 拒绝列表：`000000`, `111111`, `222222`, ..., `999999`, `123456`, `654321`, `012345`, `543210`
- 设置时同时提供 1 个自定义安全问题和答案（用于恢复）
- `admin_pin` 表始终最多 1 行（`id=1` 约束），重复设置为 UPSERT
- 设置操作在单个 DB 事务中完成（PIN hash + 安全问题 + 答案 hash）

### REQ-AUTH-002: PIN 验证与登录

- 端点：`POST /api/v1/auth/login` body: `{ pin: string }`
- PIN 使用 scrypt 验证（N=32768, r=8, p=1, dkLen=64, 16B 随机 salt）
- 验证成功：生成 `crypto.randomBytes(32)` 的 base64url token
- DB 存储 token 的 SHA-256 哈希（非明文），附带 `created_at`, `expires_at`, `client_ip`, `user_agent`
- 返回明文 token 给客户端，响应格式 `{ ok: true, data: { token: string } }`
- 验证失败：返回 401，通用错误消息 "PIN 码错误"
- 无登录速率限制（用户决策）

### REQ-AUTH-003: 会话管理

- 会话绝对过期：`created_at + 30 天`
- 无空闲超时
- 登出端点：`POST /api/v1/auth/logout`（需认证），撤销当前 token
- 登出幂等：重复登出同一 token 不报错
- PIN 变更时撤销所有其他会话（仅保留当前会话）

### REQ-AUTH-004: 认证中间件

- 默认拒绝：所有 `/api/v1` 路由需要 Bearer token
- 白名单（无需认证）：`/api/v1/auth/state`, `/api/v1/auth/setup`, `/api/v1/auth/login`, `/api/v1/auth/recover`
- Token 验证：从 `Authorization: Bearer <token>` 提取，SHA-256 哈希后查 DB
- 过期检查：`now < expires_at` 且 `revoked_at IS NULL`
- SSE 端点：从 `?token=xxx` query param 提取，验证逻辑同上
- 无 PIN 设置时（`admin_pin` 表空）：所有路由放行，仅 `/api/v1/auth/state` 返回 `setupRequired: true`

### REQ-AUTH-005: 状态检查

- `GET /api/v1/auth/state`（公开）：返回 `{ setupRequired: boolean }`
- `GET /api/v1/auth/check`（需认证）：返回 `{ authenticated: true }`

## API 端点

| 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|
| GET | `/api/v1/auth/state` | 否 | 检查是否需要初始设置 |
| POST | `/api/v1/auth/setup` | 否* | 设置 PIN + 安全问题（仅当无 PIN 时） |
| POST | `/api/v1/auth/login` | 否 | PIN 验证登录 |
| POST | `/api/v1/auth/recover` | 否 | 安全问题验证 + 重置 PIN |
| GET | `/api/v1/auth/check` | 是 | 验证当前 token 有效性 |
| POST | `/api/v1/auth/logout` | 是 | 撤销当前会话 |

## 数据库 Schema (0009_auth.sql)

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

## PBT 属性

### IDEMPOTENCY_SETUP_RETRY
- **不变量**: 重复 setup 调用不会创建第二条 `admin_pin` 记录，始终最多 1 行
- **伪造策略**: 并发/重复 setup 调用后断言 `COUNT(admin_pin) == 1`

### IDEMPOTENCY_LOGOUT_RETRY
- **不变量**: 多次 logout 同一 token 幂等，token 首次撤销后永远无效
- **伪造策略**: 重复 logout + check 交替调用，断言状态一致

### ROUNDTRIP_PIN_SET_VERIFY
- **不变量**: 任意合法 6 位 PIN，setup 后 verify 返回 true；任意不同 PIN verify 返回 false
- **伪造策略**: 生成 (p, q) 对，p≠q，setup(p) 后 verify(p)=true, verify(q)=false

### INVARIANT_SINGLE_ADMIN_PIN_ROW
- **不变量**: `admin_pin` 表任何时刻最多 1 行
- **伪造策略**: 有状态动作序列（setup/recover/changePin/并发），每步后断言行数

### INVARIANT_EXPIRED_SESSIONS_NEVER_VALIDATE
- **不变量**: `now >= expires_at` 的会话在所有认证表面（REST + SSE）被拒绝
- **伪造策略**: 时间旅行测试，边界时间戳 (expires_at ± 1ms)

### BOUND_PIN_FORMAT
- **不变量**: 仅 `^\d{6}$` 且不在弱 PIN 列表中的值被接受
- **伪造策略**: 生成任意字符串和数字模式，断言只有合法强 PIN 被接受

### BOUND_SESSION_EXPIRY_EXACT_30D
- **不变量**: `expires_at == created_at + 30 天`，任何活动不延长过期时间
- **伪造策略**: 创建会话后生成大量认证流量，断言 expires_at 不变

### SECURITY_HASH_NEVER_EQUALS_INPUT
- **不变量**: 存储的哈希值永远不等于明文输入
- **伪造策略**: 检查所有持久化哈希值与原始输入不相等

### SECURITY_SALT_UNIQUENESS
- **不变量**: 相同 PIN 不同 salt 产生不同哈希
- **伪造策略**: 固定输入多次 setup 强制新 salt，断言哈希两两不同
