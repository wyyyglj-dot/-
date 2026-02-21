## Context

点餐系统部署到服务器后，实际使用暴露出多个交互体验和性能问题。核心痛点：上菜队列操作阻塞（loading 转圈）、SSE 事件触发全量刷新（列表闪烁）、缺少安全设置入口、认证中间件每次查 DB。

当前架构：Express 4 + SQLite (better-sqlite3) 后端，Vue 3 + Pinia + Naive UI 前端，SSE 实时通信。前端所有 SSE 事件处理器都调用 `fetchXxx()` 全量 refetch。

本次变更涉及 8 个需求 (R1-R8)，跨前后端，影响 SSE 通信协议、状态管理、认证系统、API 客户端。

## Goals / Non-Goals

**Goals:**
- 消除上菜操作的 loading 阻塞，实现亚秒级响应
- SSE 事件从全量 refetch 迁移到增量更新，消除列表闪烁
- 提供 PIN 和安全问题的修改入口
- 减少认证中间件的 DB 查询开销 90%+
- 401 错误优雅处理，不丢失页面状态
- SSE 连接状态可视化
- API 响应压缩

**Non-Goals:**
- 不引入 WebSocket 替代 SSE（架构变更过大）
- 不引入 Redis 等外部缓存依赖（保持轻量单体）
- 不做 SSE 事件的版本化或序列号机制（复杂度不匹配）
- 不修改移动端设置页（当前设计移动端无设置入口）

## Decisions

### D1: 乐观更新 + 本地操作防抖（R1）

**选择**: 先移除本地数组项，再发 API 请求；引入 `_localOpTimestamp` 防抖机制。

**替代方案**:
- A) 仅加速 API 响应（优化后端查询）→ 不够，网络延迟仍存在
- B) WebSocket 双向通信 → 架构变更过大，SSE 已满足需求
- C) 乐观更新 + 版本号冲突检测 → 过度设计，餐厅场景并发极低

**理由**: 餐厅场景下同一菜品被两人同时操作的概率极低。乐观更新 + 失败回滚是最简方案。防抖窗口 2 秒足够覆盖 API 往返 + SSE 广播延迟。

**实现要点**:
- `orders.ts` 的 `markServed()`: 先 `const snapshot = [...servingQueue.value]`，再 filter 移除，再 `await api.markServed()`，catch 时恢复 snapshot
- `_localOpTimestamp = Date.now()` 在每次本地操作时更新
- SSE handler 检查 `Date.now() - _localOpTimestamp < 2000` 时跳过 refetch

### D2: SSE 增量更新分层策略（R2）

**选择**: 三层策略 — 精确增量 / 降级 refetch / 保持不变。

| SSE 事件 | 策略 | 理由 |
|----------|------|------|
| `serving.updated` (serve) | 精确增量：按 item_id 移除或更新 quantity | 事件已携带足够 delta 数据 |
| `serving.updated` (unserve) | 降级 500ms 防抖 refetch | 需要完整 ServingQueueItem 数据，事件不携带 |
| `table.updated` | 精确增量：`updateTableLocally(data.table)` | 后端统一携带完整 TableSummary |
| `ticket.created` | 降级 500ms 防抖 refetch | 新增多个菜品，数据复杂 |
| `session.deleted` | 精确增量：按 session_id filter 本地数组 | 只需 session_id 即可过滤 |
| `checkout.completed` (Stats) | 保持全量 refetch | 低频操作，聚合数据无法增量 |
| `menu.updated` | 保持全量 refetch | 低频操作，影响全局菜单 |

**替代方案**:
- A) 所有事件都增量更新 → 过度复杂，ticket.created 需要携带完整菜品列表
- B) 所有事件都防抖 refetch → 不够，serving.updated 高频场景仍会闪烁

### D3: table.updated payload 统一化（R2）

**选择**: 所有 `sseHub.broadcast('table.updated', ...)` 调用点统一为 `{ table: repo.getTableSummary(tableId) }` 格式。

**影响范围** (约 10 处修改):
- `server/src/modules/serving/serving.service.ts` — serveTicketItem, unserveTicketItem
- `server/src/modules/tickets/tickets.service.ts` — createTicket, patchTicketItem
- `server/src/modules/checkout/checkout.service.ts` — checkoutSession
- `server/src/modules/sessions/sessions.service.ts` — openSession, cancelSession, forceDeleteSession
- `server/src/modules/tables/tables.service.ts` — createTable, updateTable
- `server/src/modules/history/history.service.ts` — reopenSession

**理由**: 当前 payload 格式不一致（有的传 `{table_id, session_id}`，有的传 `{table: DiningTable}`）。统一后前端只需一个处理逻辑。`getTableSummary()` 是轻量查询（单表 JOIN），对 SQLite 同步 API 无性能影响。

**前端变更**:
- `TableMap.vue` / `MobileHome.vue`: `table.updated` handler 改为 `tableStore.updateTableLocally(data.table)`
- 移除 `checkout.completed` / `session.opened` / `session.deleted` 在 TableMap/MobileHome 中的冗余监听（因为这些事件后面都跟着 `table.updated`）

### D4: useActionLock composable（R3）

**选择**: 通用 composable 而非每个按钮单独管理状态。

```typescript
// web/src/composables/useActionLock.ts
export function useActionLock() {
  const locked = ref(false)
  async function execute(fn: () => Promise<void>) {
    if (locked.value) return
    locked.value = true
    try { await fn() } finally { locked.value = false }
  }
  return { locked, execute }
}
```

**替代方案**: 全局 loading store → 违反 KISS，按钮级控制更精确。

### D5: 安全设置 UI 架构（R4）

**选择**: Settings.vue 顶部新增 NCard "安全设置"，内含两个 NCollapse 面板（修改PIN / 修改安全问题）。

**API 设计**:
- `POST /api/v1/auth/change-pin` → `{ current_pin, new_pin }` → 200 `{ ok: true }` / 401 `INVALID_PIN` / 400 `WEAK_PIN`
- `POST /api/v1/auth/change-security` → `{ current_pin, question, answer }` → 200 `{ ok: true }` / 401 `INVALID_PIN` / 400 `VALIDATION_ERROR`

**后端实现**:
- `auth.router.ts` 新增两个路由（需认证）
- `auth.service.ts` 新增 `changePin(currentPin, newPin, currentTokenHash)` 和 `changeSecurity(currentPin, question, answer)`
- `auth.repo.ts` 新增 `updatePinHash(hash, salt)` 和 `updateSecurityQuestion(question, answerHash, answerSalt)`
- `changePin` 成功后调用 `repo.revokeAllSessionsExcept(currentTokenHash)`

**前端实现**:
- `web/src/api/auth.ts` 新增 `changePin()` 和 `changeSecurity()` API 调用
- Settings.vue 使用 NForm + NFormItem + NInput(type="password") + NButton

### D6: Token 验证缓存（R5）

**选择**: `auth.service.ts` 内部 `Map<string, {valid: boolean, ts: number}>` + 30s 清理定时器。

**实现要点**:
- `validateToken()` 先查缓存，命中且未过期直接返回；否则查 DB 并写入缓存
- `logout()` 调用 `tokenCache.delete(hash)` 主动失效
- `setInterval(() => purgeExpired(), 30000).unref()`
- 缓存满时（size >= 1000），遍历删除最旧的 100 条（批量清理，避免频繁逐条淘汰）

**替代方案**: LRU 库 (lru-cache) → 引入外部依赖，Map 足够简单。

### D7: 401 优雅处理（R6）

**选择**: `client.ts` 模块级锁 + Naive UI discrete API + 延迟 router.push。

**关键设计**:
- `createDiscreteApi(['message'])` 在模块顶层创建（不依赖 Vue 组件上下文）
- `let _redirecting = false` 模块级锁
- router 通过 `import('../router')` 动态导入避免循环依赖
- 401 处理流程: `if (_redirecting) return` → `_redirecting = true` → `localStorage.removeItem` → `message.warning('登录已过期')` → `setTimeout(() => router.push('/login'), 1500)` → `_redirecting = false`

### D8: SSE 连接状态（R7）

**选择**: SSEClient 类新增 `status: Ref<'connected' | 'reconnecting'>` 响应式属性。

**实现要点**:
- `import { ref } from 'vue'` 在 sse.ts 中引入 Vue 响应式
- `connect()` 成功时 `this.status.value = 'connected'`
- `onerror` 时 `this.status.value = 'reconnecting'`
- 重连成功后触发当前页面数据刷新（通过 emit `'reconnected'` 事件，各页面监听）
- UI: `<span class="w-2 h-2 rounded-full" :class="sseClient.status.value === 'connected' ? 'bg-green-500' : 'bg-red-500 animate-pulse'" />`

### D9: 响应压缩（R8）

**选择**: `compression` npm 包 + filter 函数跳过 SSE。

**实现要点**:
- `npm install compression @types/compression`
- `app.ts` 中业务路由注册之前添加 compression 中间件（非 SSE 路由之后）
- filter: `(req, res) => req.path === '/api/v1/events' || (req.headers.accept && req.headers.accept.includes('text/event-stream')) ? false : compression.filter(req, res)`（路径匹配 + accept 头双重检查）
- threshold: 1024

### D10: Auth 路由认证保护（R4，审查补充）

**选择**: `change-pin` 和 `change-security` 路由需要手动验证 token，因为 `authRouter` 挂载在 `authMiddleware` 之前。

**实现要点**:
- 在 `auth.router.ts` 的 `change-pin` 和 `change-security` handler 中，手动调用 `authService.validateToken(token)` 验证
- 从 `Authorization: Bearer <token>` 提取 token，SHA-256 hash 后作为 `currentTokenHash` 传给 `changePin()`
- 如果 token 无效，返回 401

**替代方案**: 拆分 authRouter 为公开路由和受保护路由 → 改动更大，不值得

### D11: 安全答案归一化（R4，审查补充）

**选择**: 共享归一化函数 `normalizeAnswer(answer: string): string` → `answer.trim().toLowerCase()`

**理由**: 现有 `setup()` 和 `recover()` 都用 `trim().toLowerCase()` 归一化答案后再 hash。`changeSecurity()` 必须使用相同的归一化逻辑，否则用户修改安全问题后无法恢复。

### D12: getTableSummary 禁用桌台兼容（R2，审查补充）

**选择**: `getTableSummary(tableId)` 单桌查询时移除 `is_enabled = 1` 过滤条件。

**理由**: `updateTable()` 可能禁用桌台，此时 `table.updated` 事件需要携带完整 summary。如果过滤掉禁用桌台，payload 为 null 会导致前端崩溃。

### D13: changePin 事务原子性（R4，审查补充）

**选择**: PIN 更新 + session 撤销包装在 SQLite 事务中。

**实现**: `db.transaction(() => { repo.updatePinHash(hash, salt); repo.revokeAllSessionsExcept(currentTokenHash) })()`

### D14: Token 缓存全路径失效（R5，审查补充）

**选择**: 所有 session 撤销路径都清除缓存：`logout()` 清除单条，`changePin()` 和 `recover()` 清除全部（`tokenCache.clear()`）。

### D15: ServingQueue.vue 事件处理重构（R1/R3，审查补充）

**选择**: `ServingItem.vue` 直接调用 store 方法（markServed / unserveItem），不再通过 `@serve` / `@unserve` 事件冒泡到 `ServingQueue.vue`。

**理由**: `useActionLock` 需要在触发操作的组件内管理异步状态。如果保持事件冒泡，父组件调用 API 而子组件无法感知锁状态。

**影响**: `ServingQueue.vue` 需要移除 `handleServe` / `handleUnserve` 方法和对应的事件监听。

## Risks / Trade-offs

| 风险 | 缓解措施 |
|------|----------|
| 乐观更新后 API 失败，本地状态与服务端不一致 | 失败时回滚 snapshot + toast 提示 + 3s 后自动 refetch |
| SSE 增量更新遗漏数据导致状态漂移 | 重连后全量 refetch；serving.updated(unserve) 降级为 refetch |
| table.updated 统一化改动面广（~10处） | 所有改动模式一致（替换 payload 为 getTableSummary 调用），风险低 |
| Token 缓存导致已注销 session 仍可访问 | TTL 60s + 全路径缓存失效（logout/changePin/recover），最大风险窗口 60s |
| compression 中间件影响 SSE 流式传输 | filter 函数：路径匹配 + accept 头双重检查跳过 SSE |
| discrete API 在 SSR 环境不可用 | 本项目纯 SPA，无 SSR 风险 |
| getTableSummary 有副作用 (autoTransitionStuckSessions) | 需确认副作用是否影响高频 serve 路径，必要时分离纯读查询 |
| authRouter 在 authMiddleware 之前挂载 | change-pin/change-security 手动验证 token (D10) |
| changeSecurity 答案归一化不一致 | 共享 normalizeAnswer() 函数 (D11) |
| getTableSummary 过滤 is_enabled=1 | 单桌查询移除 enabled 过滤 (D12) |
| changePin 非原子操作 | SQLite 事务包装 (D13) |
| 前后端部署顺序 | 后端先部署；或 payload 兼容 `{ table, table_id, session_id }` |

## File Impact Summary

| 文件 | 变更类型 | 涉及需求 |
|------|----------|----------|
| `web/src/stores/orders.ts` | 修改 | R1, R2 |
| `web/src/views/Serving.vue` | 修改 | R1, R2 |
| `web/src/views/mobile/MobileServing.vue` | 修改 | R1, R2 |
| `web/src/views/TableMap.vue` | 修改 | R2 |
| `web/src/views/mobile/MobileHome.vue` | 修改 | R2 |
| `web/src/stores/tables.ts` | 修改 | R2 |
| `web/src/composables/useActionLock.ts` | 新增 | R3 |
| `web/src/components/business/ServingItem.vue` | 修改 | R1, R3 |
| `web/src/components/business/ServingQueue.vue` | 修改 | R1, R3 (移除事件冒泡) |
| `web/src/views/Checkout.vue` | 修改 | R3 |
| `web/src/views/mobile/MobileOrdering.vue` | 修改 | R3 |
| `server/src/modules/auth/auth.router.ts` | 修改 | R4 |
| `server/src/modules/auth/auth.service.ts` | 修改 | R4, R5 |
| `server/src/modules/auth/auth.repo.ts` | 修改 | R4 |
| `web/src/views/Settings.vue` | 修改 | R4 |
| `web/src/api/auth.ts` | 新增/修改 | R4 |
| `web/src/api/client.ts` | 修改 | R6 |
| `web/src/api/sse.ts` | 修改 | R6, R7 |
| `web/src/components/layout/MobileNav.vue` | 修改 | R7 |
| `web/src/components/layout/AppSidebar.vue` | 修改 | R7 |
| `server/src/app.ts` | 修改 | R8 |
| `server/package.json` | 修改 | R8 |
| `server/src/modules/serving/serving.service.ts` | 修改 | R2 (table.updated 统一) |
| `server/src/modules/tickets/tickets.service.ts` | 修改 | R2 (table.updated 统一) |
| `server/src/modules/checkout/checkout.service.ts` | 修改 | R2 (table.updated 统一) |
| `server/src/modules/sessions/sessions.service.ts` | 修改 | R2 (table.updated 统一) |
| `server/src/modules/tables/tables.service.ts` | 修改 | R2 (table.updated 统一) |
| `server/src/modules/history/history.service.ts` | 修改 | R2 (table.updated 统一) |
