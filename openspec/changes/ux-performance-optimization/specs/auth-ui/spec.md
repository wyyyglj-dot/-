# auth-ui: Delta Spec for 401 Graceful Handling

## MODIFIED Requirements

### Requirement: API Client 401 graceful redirect

- `web/src/api/client.ts` 的 `request()` 函数修改：
  - 从 localStorage 读取 token，存在则添加 `Authorization: Bearer <token>` header
  - 响应 401 时：清除 localStorage token，显示 toast "登录已过期"，延迟 1.5 秒后使用 `router.push('/login')` 跳转
  - **CHANGED**: 不再使用 `window.location.href = '/login'`（硬刷新丢失状态）
  - **CHANGED**: 使用 Naive UI discrete API `createDiscreteApi(['message'])` 显示 warning toast
  - **CHANGED**: 模块级 `_redirecting` 布尔锁，防止多个并发 401 响应触发多次跳转
- 避免循环依赖：client.ts 直接读 localStorage，不导入 Pinia store
- router 实例通过延迟导入获取：`const { default: router } = await import('../router')`

#### Scenario: Single 401 triggers toast then redirect
- **WHEN** an API request returns 401
- **THEN** localStorage token is cleared, warning toast "登录已过期" is shown, and after 1.5 seconds `router.push('/login')` is called

#### Scenario: Multiple concurrent 401s trigger only one redirect
- **WHEN** 3 parallel API requests all return 401
- **THEN** only the first 401 sets the lock, shows toast, and triggers redirect; the other two are silently ignored

#### Scenario: Lock resets after redirect completes
- **WHEN** the 1.5s delay completes and router.push executes
- **THEN** the `_redirecting` lock is reset to false (allowing future 401 handling if user navigates back)

### Requirement: SSE 401 detection via auth check

- `web/src/api/sse.ts` 修改：
  - `onerror` 重连时重新读取当前 token（防止使用过期 token）
  - **CHANGED**: Before reconnecting, perform a lightweight `fetch('/api/v1/auth/check')` call
  - If auth check returns 401, the API client's 401 handler (above) will trigger the redirect
  - If auth check succeeds (200), proceed with normal SSE reconnection
  - **CHANGED**: 不再无条件重连，先验证 token 有效性

#### Scenario: SSE disconnects with valid token
- **WHEN** SSE connection drops due to network issue and auth check returns 200
- **THEN** SSE reconnects normally after 3 seconds

#### Scenario: SSE disconnects with expired token
- **WHEN** SSE connection drops and auth check returns 401
- **THEN** the API client's 401 handler shows toast and redirects to login; SSE does not attempt reconnection

## PBT Properties

### REDIRECT_LOCK_MUTUAL_EXCLUSION
- **Invariant**: Concurrent 401 responses result in exactly 1 toast and 1 router.push call
- **Falsification**: Fire N concurrent 401 responses, count toast and router.push invocations, assert both == 1

### REDIRECT_USES_ROUTER_NOT_LOCATION
- **Invariant**: 401 handling never sets window.location.href; always uses router.push
- **Falsification**: Mock window.location setter, trigger 401, assert setter never called

### SSE_AUTH_CHECK_BEFORE_RECONNECT
- **Invariant**: Every SSE reconnection attempt is preceded by a successful auth check
- **Falsification**: Mock auth check to return 401, assert no EventSource constructor call follows
