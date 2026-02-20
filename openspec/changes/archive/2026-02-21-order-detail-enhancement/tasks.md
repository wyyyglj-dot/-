## 1. 后端基础设施

- [x] 1.1 `SseEventName` 联合类型新增 `'session.deleted'`，文件：`server/src/modules/sse/sse.hub.ts:3`
- [x] 1.2 `patchTicketItem` 入口增加参数映射：`qty = body.qty ?? body.qty_ordered`，`void_qty = body.void_qty ?? body.qty_voided`，文件：`server/src/modules/tickets/tickets.service.ts:125-128`
- [x] 1.3 `sessions.repo.ts` 新增 `revertToDining(sessionId: number): boolean` 方法，SQL：`UPDATE table_session SET status='DINING' WHERE id=? AND status='PENDING_CHECKOUT'`，返回 changes > 0

## 2. 后端：PENDING_CHECKOUT 自动回退 (R4)

- [x] 2.1 `tickets.repo.ts` 新增 `getSessionContext` 返回值增加 `table_id` 字段（如尚未包含），确保 revert 后能广播正确的 table_id
- [x] 2.2 `tickets.service.ts` 的 `createTicket`：状态检查从 `status !== 'DINING'` 改为 `status === 'CLOSED'`；若 `status === 'PENDING_CHECKOUT'`，在同一事务内调用 `sessionsRepo.revertToDining(sessionId)` 后再执行 `repo.createTicketWithItems`
- [x] 2.3 `tickets.service.ts` 的 `patchTicketItem`：状态检查从 `session_status !== 'DINING'` 改为 `session_status === 'CLOSED'`；若 `session_status === 'PENDING_CHECKOUT'`，在同一事务内调用 `sessionsRepo.revertToDining` 后再执行 qty/void 更新
- [x] 2.4 回退成功时，`table.updated` 事件 payload 增加 `status: 'dining'` 字段

## 3. 后端：强制删除 Session (R3)

- [x] 3.1 `sessions.repo.ts` 新增 `forceDeleteSession(sessionId: number)` 事务方法，删除顺序：payment → order_ticket_item (JOIN order_ticket) → order_ticket → table_session，返回 `{ deleted_items, deleted_tickets, deleted_payments }`
- [x] 3.2 抽取 `sessions.repo.ts` 和 `history.repo.ts` 共享的级联删除 helper（避免 DRY 违反），或直接在 `forceDeleteSession` 中实现独立逻辑
- [x] 3.3 `sessions.service.ts` 新增 `forceDeleteSession(sessionId: number)` 方法：加载 session 获取 table_id → 调用 repo 事务 → 广播 `session.deleted` + `table.updated` 事件
- [x] 3.4 `sessions.router.ts` 新增 `DELETE /sessions/:sessionId/force` 路由，调用 `service.forceDeleteSession`，返回 `success(null)`

## 4. 后端：Checkout 加固 (D3)

- [x] 4.1 `checkout.repo.ts` 的 `finalizeCheckout` 事务内，在 `session.status === 'CLOSED'` 检查之后增加：`if (session.status !== 'PENDING_CHECKOUT') throw new ConflictError('Session must be in PENDING_CHECKOUT status', 'SESSION_NOT_PENDING_CHECKOUT')`

## 5. 前端：类型与 API 更新

- [x] 5.1 `web/src/api/orders.ts` 新增 `forceDeleteSession(sessionId: number)` 方法，调用 `del('/sessions/${sessionId}/force')`
- [x] 5.2 `web/src/api/orders.ts` 确认 `updateTicketItem` 参数命名与后端兼容（当前发送 `qty_ordered/qty_voided`，后端已兼容）
- [x] 5.3 `web/src/api/client.ts` 确认 `del` 方法存在（如不存在则新增）

## 6. 前端：OrderDetailModal 组件 (R2)

- [x] 6.1 新建 `web/src/components/business/OrderDetailModal.vue`，Props：`show(boolean)`, `sessionId(number)`, `tableNo(string)`, `readonly?(boolean)`；Emits：`update:show`, `session-deleted`, `item-updated`
- [x] 6.2 弹窗打开时调用 `getSession(sessionId)` 获取完整 ticket/item 数据，显示 loading 状态
- [x] 6.3 实现菜品列表展示：按 ticket 分组，每项显示名称、辣度、单价、数量、状态标签
- [x] 6.4 实现数量编辑：每项菜品旁增加 +/- 按钮，调用 `updateTicketItem(itemId, { qty_ordered: newQty })`，最小值 = qty_served + qty_voided
- [x] 6.5 实现删除单个菜品：删除按钮调用 `updateTicketItem(itemId, { qty_voided: pending })`，pending = qty_ordered - qty_served - qty_voided
- [x] 6.6 实现删除整个订单：底部"删除订单"按钮，Naive UI `useDialog` 二次确认（提示"将删除所有数据（含结账记录），不可恢复"），确认后调用 `forceDeleteSession(sessionId)`，emit `session-deleted`
- [x] 6.7 操作成功后刷新弹窗内数据（重新调用 getSession），emit `item-updated` 通知父组件
- [x] 6.8 错误处理：CONCURRENT_MODIFICATION 提示"数据已被修改，请刷新重试"；NOT_FOUND 提示"订单已被删除"并关闭弹窗
- [x] 6.9 readonly 模式下隐藏所有编辑控件（+/- 按钮、删除按钮）

## 7. 前端：TableCard 集成 (R1 + R2)

- [x] 7.1 `TableCard.vue:107` 修改详情按钮条件：`(table.dishes?.length ?? 0) > 3` → `(table.dishes?.length ?? 0) > 0`
- [x] 7.2 移除 TableCard 内联的纯展示详情弹窗（n-modal 部分），替换为引用 `OrderDetailModal` 组件
- [x] 7.3 监听 `session-deleted` 事件：关闭弹窗，触发父组件刷新（SSE 会自动处理，但需确保本地状态同步）
- [x] 7.4 监听 `item-updated` 事件：触发父组件刷新桌台数据

## 8. 前端：Checkout 页面集成 (R5)

- [x] 8.1 `Checkout.vue` 引入 `OrderDetailModal` 组件，增加"查看详情"按钮（位于金额显示区域下方）
- [x] 8.2 监听 `session-deleted` 事件：导航回桌台总览页 `router.push('/')`
- [x] 8.3 监听 `item-updated` 事件：重新调用 `getSession` 刷新金额显示
- [x] 8.4 处理 checkout 失败 `SESSION_NOT_PENDING_CHECKOUT`：显示"订单已被修改，请重新确认"

## 9. 前端：SSE 事件处理

- [x] 9.1 SSE 连接管理（`web/src/api/sse.ts`）增加 `session.deleted` 事件监听
- [x] 9.2 `Serving.vue` 和 `MobileServing.vue` 监听 `session.deleted` 事件，移除对应 session 的队列项并刷新
- [x] 9.3 `TableMap.vue` 和 `MobileHome.vue` 监听 `session.deleted` 事件，刷新受影响桌台

## 10. 验收验证

- [x] 10.1 验证：桌台有 1 道菜时"查看详情"按钮可见
- [x] 10.2 验证：详情弹窗可增加/减少菜品数量，上菜队列同步更新
- [x] 10.3 验证：详情弹窗可删除单个菜品（void 待上菜数量）
- [x] 10.4 验证：详情弹窗可删除整个订单，桌台恢复空闲
- [x] 10.5 验证：PENDING_CHECKOUT 状态下修改菜品，session 自动回退到 DINING
- [x] 10.6 验证：PENDING_CHECKOUT 状态下加菜，下单成功
- [x] 10.7 验证：结账页面"查看详情"入口可用，弹窗功能完整
- [x] 10.8 验证：所有操作通过 SSE 实时同步到其他客户端
- [x] 10.9 验证：checkout 在 session 被回退到 DINING 后返回 409
