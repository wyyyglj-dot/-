## 1. 后端：table.updated SSE payload 统一化 (R2-D3)

- [x] 1.1 `server/src/modules/tables/tables.repo.ts` — 确认 `getTableSummary(tableId)` 已存在且返回完整 `TableSummary`；**修复**：单桌查询时移除 `is_enabled = 1` 过滤条件（禁用桌台也需要返回 summary），确认无 `autoTransitionStuckSessions` 副作用影响高频路径
- [x] 1.2 `server/src/modules/serving/serving.service.ts` — `serveTicketItem()` 中 `sseHub.broadcast('table.updated', ...)` 改为 `{ table: repo.getTableSummary(updated.table_id) }`（注意：需从 tables repo 导入）
- [x] 1.3 `server/src/modules/serving/serving.service.ts` — `unserveTicketItem()` 中同样修改 `table.updated` broadcast payload
- [x] 1.4 `server/src/modules/tickets/tickets.service.ts` — `createTicket()` 中修改 `table.updated` broadcast payload
- [x] 1.5 `server/src/modules/tickets/tickets.service.ts` — `patchTicketItem()` 中修改 `table.updated` broadcast payload
- [x] 1.6 `server/src/modules/checkout/checkout.service.ts` — `checkoutSession()` 中修改 `table.updated` broadcast payload
- [x] 1.7 `server/src/modules/sessions/sessions.service.ts` — `openSession()` 中修改 `table.updated` broadcast payload
- [x] 1.8 `server/src/modules/sessions/sessions.service.ts` — `cancelSession()` / `forceDeleteSession()` 中修改 `table.updated` broadcast payload（注意：可能有多处）
- [x] 1.9 `server/src/modules/tables/tables.service.ts` — `createTable()` 和 `updateTable()` 中修改 `table.updated` broadcast payload（这里已有 `{ table: created/updated }` 但类型是 DiningTable 非 TableSummary，需改为 `getTableSummary()`）
- [x] 1.10 `server/src/modules/history/history.service.ts` — `reopenSession()` 中修改 `table.updated` broadcast payload

## 2. 后端：安全设置 API (R4-D5)

- [x] 2.1 `server/src/modules/auth/auth.repo.ts` — 新增 `updatePinHash(hash: string, salt: string): void` 方法，SQL: `UPDATE admin_pin SET pin_hash=?, pin_salt=?, updated_at=datetime('now') WHERE id=1`
- [x] 2.2 `server/src/modules/auth/auth.repo.ts` — 新增 `updateSecurityQuestion(question: string, answerHash: string, answerSalt: string): void` 方法
- [x] 2.3 `server/src/modules/auth/auth.repo.ts` — 检查 `revokeAllSessionsExcept(keepTokenHash)` 是否已存在；如不存在则新增，SQL: `UPDATE auth_session SET revoked_at=datetime('now') WHERE token_hash != ? AND revoked_at IS NULL`
- [x] 2.4 `server/src/modules/auth/auth.service.ts` — 新增 `changePin(currentPin, newPin, currentTokenHash)` 方法：verifyPin → **validatePin(newPin)**（6位数字格式 + isWeakPin 双重检查）→ hashPin(newPin) → **db.transaction 包装**：updatePinHash + revokeAllSessionsExcept(currentTokenHash) → tokenCache.clear()
- [x] 2.5 `server/src/modules/auth/auth.service.ts` — 新增 `changeSecurity(currentPin, question, answer)` 方法：verifyPin → 验证 question/answer 非空 → **normalizeAnswer(answer)**（`answer.trim().toLowerCase()`，与 setup/recover 一致）→ hashPin(normalizedAnswer) → updateSecurityQuestion
- [x] 2.6 `server/src/modules/auth/auth.router.ts` — 新增 `POST /change-pin` 路由：**手动验证 token**（从 Authorization header 提取 → SHA-256 hash → validateToken，因为 authRouter 在 authMiddleware 之前挂载），从 req body 取 `current_pin, new_pin`，调用 `service.changePin()`，错误映射：INVALID_PIN→401, WEAK_PIN→400, VALIDATION_ERROR→400
- [x] 2.7 `server/src/modules/auth/auth.router.ts` — 新增 `POST /change-security` 路由：**同样手动验证 token**，从 req body 取 `current_pin, question, answer`，调用 `service.changeSecurity()`
- [x] 2.8 `server/src/shared/types.ts` — 如需新增类型定义（ChangePinRequest, ChangeSecurityRequest）

## 3. 后端：Token 验证缓存 (R5-D6)

- [x] 3.1 `server/src/modules/auth/auth.service.ts` — 新增模块级 `const tokenCache = new Map<string, {valid: boolean, ts: number}>()`
- [x] 3.2 `server/src/modules/auth/auth.service.ts` — 修改 `validateToken()`: 先查 `tokenCache.get(hash)`，如果存在且 `Date.now() - entry.ts < 60000` 则返回 `entry.valid`；否则查 DB，结果写入 cache
- [x] 3.3 `server/src/modules/auth/auth.service.ts` — 修改 `logout()`: 在 `repo.revokeSession(hash)` 后添加 `tokenCache.delete(hash)`
- [x] 3.4 `server/src/modules/auth/auth.service.ts` — `changePin()` 中调用 `tokenCache.clear()`（PIN 变更后清空所有缓存）
- [x] 3.4b `server/src/modules/auth/auth.service.ts` — `recover()` 中也调用 `tokenCache.clear()`（recover 也撤销所有 session，必须同步清缓存）
- [x] 3.5 `server/src/modules/auth/auth.service.ts` — 新增缓存清理定时器：`setInterval(() => { const now = Date.now(); for (const [k, v] of tokenCache) { if (now - v.ts > 60000) tokenCache.delete(k) } }, 30000).unref()`
- [x] 3.6 `server/src/modules/auth/auth.service.ts` — 新增缓存大小限制：在写入缓存前检查 `tokenCache.size >= 1000`，如果满则遍历删除最旧的 100 条

## 4. 后端：响应压缩 (R8-D9)

- [x] 4.1 `server/package.json` — 添加依赖 `compression` 和 `@types/compression`（运行 `npm install compression && npm install -D @types/compression`）
- [x] 4.2 `server/src/app.ts` — 在**业务路由注册之前**添加 compression 中间件：`app.use(compression({ threshold: 1024, filter: (req, res) => req.path === '/api/v1/events' || (req.headers.accept && req.headers.accept.includes('text/event-stream')) ? false : compression.filter(req, res) }))`（路径匹配 + accept 头双重检查）

## 5. 前端：乐观更新 + SSE 防抖 (R1-D1)

- [x] 5.1 `web/src/stores/orders.ts` — 新增模块级 `let _localOpTimestamp = 0`
- [x] 5.2 `web/src/stores/orders.ts` — 重写 `markServed()`: 先 `const snapshot = [...servingQueue.value]`，再 `servingQueue.value = servingQueue.value.filter(i => i.item_id !== itemId)`，再 `_localOpTimestamp = Date.now()`，再 `try { await api.markServed(itemId, qty) } catch(e) { servingQueue.value = snapshot; message.error('上菜失败，已恢复'); throw e }`（需导入 discrete message API 或从外部传入 toast 回调）
- [x] 5.3 `web/src/stores/orders.ts` — 新增 `isLocalOpDebouncing(): boolean` 方法，返回 `Date.now() - _localOpTimestamp < 2000`
- [x] 5.4 `web/src/stores/orders.ts` — 新增 `handleServingUpdated(data: {item_id: number, served_delta: number, pending_qty: number})` 方法：如果 `served_delta > 0`，按 item_id 找到项，`pending_qty <= 0` 则移除，否则更新 `quantity = pending_qty`；如果 `served_delta < 0` 且项不在队列中，触发防抖 refetch
- [x] 5.5 `web/src/stores/orders.ts` — 新增 `removeBySessionId(sessionId: number)` 方法：`servingQueue.value = servingQueue.value.filter(i => i.session_id !== sessionId)`
- [x] 5.6 `web/src/stores/orders.ts` — 新增防抖 refetch 工具：`let _debounceTimer: ReturnType<typeof setTimeout> | null = null` + `function debouncedRefetch() { if (_debounceTimer) clearTimeout(_debounceTimer); _debounceTimer = setTimeout(() => fetchServingQueue(), 500) }`

## 6. 前端：SSE 事件处理器改造 (R2-D2)

- [x] 6.1 `web/src/views/Serving.vue` — `serving.updated` handler 改为：`if (orderStore.isLocalOpDebouncing()) return; orderStore.handleServingUpdated(data)`
- [x] 6.2 `web/src/views/Serving.vue` — `ticket.created` handler 改为：`orderStore.debouncedRefetch()`
- [x] 6.3 `web/src/views/Serving.vue` — `session.deleted` handler 改为：`orderStore.removeBySessionId(data.session_id)`
- [x] 6.4 `web/src/views/mobile/MobileServing.vue` — 同 6.1-6.3 的修改（保持 PC/Mobile 一致）
- [x] 6.5 `web/src/views/TableMap.vue` — `table.updated` handler 改为：`tableStore.updateTableLocally(data.table)`
- [x] 6.6 `web/src/views/TableMap.vue` — 移除 `checkout.completed` / `session.opened` / `session.deleted` 的冗余监听（这些事件后面都跟着 `table.updated`）
- [x] 6.7 `web/src/views/mobile/MobileHome.vue` — `table.updated` handler 改为：`tableStore.updateTableLocally(data.table)`
- [x] 6.8 `web/src/views/mobile/MobileHome.vue` — 移除 `checkout.completed` / `session.deleted` 的冗余监听
- [x] 6.9 `web/src/stores/tables.ts` — 修改 `updateTableLocally()`: 如果 `idx < 0`（新桌台），则 `tables.value.push(updated)` 而非忽略

## 7. 前端：按钮防重复 (R3-D4)

- [x] 7.1 `web/src/composables/useActionLock.ts` — 新建文件，实现 `useActionLock()` composable：`const locked = ref(false); async function execute(fn) { if (locked.value) return; locked.value = true; try { await fn() } finally { locked.value = false } }; return { locked, execute }`
- [x] 7.2 `web/src/components/business/ServingItem.vue` — "恢复" 按钮使用 `useActionLock()`，`:disabled="locked"`；**同时**将 serve/unserve 逻辑从事件冒泡改为直接调用 store 方法
- [x] 7.2b `web/src/components/business/ServingQueue.vue` — 移除 `handleServe` / `handleUnserve` 方法和 `@serve` / `@unserve` 事件监听（逻辑已下沉到 ServingItem）
- [x] 7.3 `web/src/views/Checkout.vue` — "结账" 按钮使用 `useActionLock()`，`:disabled="locked"`
- [x] 7.4 `web/src/views/mobile/MobileOrdering.vue` — "提交订单" 按钮使用 `useActionLock()`，`:disabled="locked"`

## 8. 前端：安全设置 UI (R4-D5)

- [x] 8.1 `web/src/api/auth.ts` — 新增（或修改）：`export const changePin = (data: {current_pin: string, new_pin: string}) => post<void>('/auth/change-pin', data)` 和 `export const changeSecurity = (data: {current_pin: string, question: string, answer: string}) => post<void>('/auth/change-security', data)`
- [x] 8.2 `web/src/views/Settings.vue` — 在现有内容顶部新增 NCard "安全设置"，包含两个 NCollapse 面板
- [x] 8.3 `web/src/views/Settings.vue` — "修改 PIN" 面板：NForm 包含 3 个 NFormItem（当前PIN / 新PIN / 确认PIN），NInput type="password" maxlength=6 pattern="[0-9]*"，提交按钮调用 `changePin()`，前端验证：6位数字、两次一致、弱PIN检测（复用 isWeakPin 逻辑或前端简单列表）
- [x] 8.4 `web/src/views/Settings.vue` — "修改安全问题" 面板：NForm 包含 3 个 NFormItem（当前PIN / 新安全问题 / 新安全答案），提交按钮调用 `changeSecurity()`
- [x] 8.5 `web/src/views/Settings.vue` — 错误处理：INVALID_PIN 显示 "当前PIN码错误"，WEAK_PIN 显示 "新PIN码过于简单"，成功显示 "修改成功" toast

## 9. 前端：401 优雅处理 (R6-D7)

- [x] 9.1 `web/src/api/client.ts` — 顶部新增 `import { createDiscreteApi } from 'naive-ui'` 和 `const { message } = createDiscreteApi(['message'])`
- [x] 9.2 `web/src/api/client.ts` — 新增模块级 `let _redirecting = false`
- [x] 9.3 `web/src/api/client.ts` — 修改 401 处理块：`if (_redirecting) { throw new Error('认证已过期') }` → `_redirecting = true` → `localStorage.removeItem('auth_token')` → `message.warning('登录已过期')` → `setTimeout(async () => { const { default: router } = await import('../router'); router.push('/login'); _redirecting = false }, 1500)` → `throw new Error('认证已过期，请重新登录')`

## 10. 前端：SSE 连接状态 + 401 检测 (R7-D8, R6)

- [x] 10.1 `web/src/api/sse.ts` — 导入 `import { ref } from 'vue'`，SSEClient 类新增 `status = ref<'connected' | 'reconnecting'>('reconnecting')`
- [x] 10.2 `web/src/api/sse.ts` — `connect()` 中 EventSource 创建成功后添加 `this.source.onopen = () => { this.status.value = 'connected'; this.emit('reconnected', {}) }`（首次连接也触发）
- [x] 10.3 `web/src/api/sse.ts` — `onerror` handler 中：`this.status.value = 'reconnecting'`，重连前先做 auth check：`fetch('/api/v1/auth/check', { headers: { Authorization: 'Bearer ' + localStorage.getItem('auth_token') } }).then(r => { if (r.status === 401) { /* 不重连，API client 的 401 handler 会处理 */ } else { this.reconnectTimer = setTimeout(() => this.connect(), 3000) } }).catch(() => { this.reconnectTimer = setTimeout(() => this.connect(), 3000) })`
- [x] 10.4 `web/src/components/layout/MobileNav.vue` — 导入 `sseClient`，在底部导航栏添加状态指示器（非顶部标题旁）：`<span class="w-2 h-2 rounded-full inline-block ml-1" :class="sseClient.status.value === 'connected' ? 'bg-green-500' : 'bg-red-500 animate-pulse'" />`
- [x] 10.5 `web/src/components/layout/AppSidebar.vue` — 同 10.4，在侧边栏底部添加状态指示器
- [x] 10.6 `web/src/views/Serving.vue` — 监听 `sseClient.on('reconnected', () => orderStore.fetchServingQueue())`，**将返回的 unsub 函数 push 到 unsubs 数组**（onUnmounted 清理）
- [x] 10.7 `web/src/views/mobile/MobileServing.vue` — 同 10.6（含 unsubs 清理）
- [x] 10.8 `web/src/views/TableMap.vue` — 监听 `sseClient.on('reconnected', () => tableStore.fetchTables())`，**将返回的 unsub 函数 push 到 unsubs 数组**
- [x] 10.9 `web/src/views/mobile/MobileHome.vue` — 同 10.8（含 unsubs 清理）

## 11. 验收验证

- [ ] 11.1 上菜队列连续点击 5 个"已上菜"，每次点击后菜品立即消失，无 loading 阻塞
- [ ] 11.2 SSE 事件触发时，列表不闪烁、滚动位置不丢失
- [ ] 11.3 操作按钮无法被重复点击触发多次请求
- [x] 11.4 系统设置页可修改 PIN，修改后用旧 PIN 无法登录、新 PIN 可登录
- [x] 11.5 系统设置页可修改安全问题，修改后用新答案可恢复 PIN
- [x] 11.6 Token 缓存生效后，连续 10 次 API 请求仅产生 1 次数据库查询（可通过日志验证）
- [ ] 11.7 401 错误显示 toast 提示后跳转，不直接刷新页面
- [ ] 11.8 SSE 断开时 UI 显示红色状态指示，重连后恢复绿色
- [x] 11.9 API 响应启用压缩，Content-Encoding 头包含 gzip
