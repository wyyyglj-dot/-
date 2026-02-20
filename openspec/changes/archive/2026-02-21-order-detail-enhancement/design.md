## Context

当前点餐系统的订单详情功能为纯展示弹窗，无法编辑菜品数量、删除菜品或删除整个订单。后端 API 严格限制 DINING 状态才能修改 ticket item 和创建 ticket，导致 PENDING_CHECKOUT 状态下无法加菜/修改。结账页面缺少详情查看入口。

现有架构：
- 后端：Express + TypeScript，Router/Service/Repo 三层，SQLite (better-sqlite3)
- 前端：Vue 3 + Naive UI，TableCard.vue 内联详情弹窗（纯展示）
- 实时通信：SSE 推送 6 种事件类型
- 状态机：DINING → PENDING_CHECKOUT → CLOSED（serving 模块自动转换）

关键约束：
- `TableSummary.dishes` 是聚合数据，无 ticket_item ID，编辑需调用 `GET /sessions/:id` 获取完整数据
- `patchTicketItem` 和 `createTicket` 硬编码 `session_status === 'DINING'` 检查
- `cancelSession` 仅允许删除无订单的 session
- checkout 事务仅排除 CLOSED 状态，不检查 PENDING_CHECKOUT

## Goals / Non-Goals

**Goals:**
- 详情弹窗支持编辑操作（增减数量、删除菜品、删除订单）
- "查看详情"按钮在菜品数 ≥ 1 时始终显示
- PENDING_CHECKOUT 状态下允许修改和加菜（自动回退到 DINING）
- 结账页面增加详情查看入口
- 加固 checkout 事务前置条件，防止竞态
- 所有操作通过 SSE 实时同步

**Non-Goals:**
- 不实现撤销/恢复功能（硬删除不可恢复，前端二次确认兜底）
- 不改变现有上菜队列排序逻辑
- 不引入权限控制（force delete 不做 admin-only 限制）
- 不实现批量编辑（逐项操作）

## Decisions

### D1: 强制删除采用硬删除，支持任意状态

**选择**: 物理删除 payment → items → tickets → session，支持 DINING/PENDING_CHECKOUT/CLOSED 所有状态。

**理由**: 小餐厅场景，数据审计需求低。硬删除实现简单，不需要改动所有查询加 WHERE deleted_at IS NULL 过滤。前端二次确认弹窗（明确提示"不可恢复"）作为安全兜底。

**替代方案**:
- 软删除（标记 deleted_at）：需要改动所有查询和迁移，复杂度高，收益低
- 混合模式（软删除 + 异步清理）：运维复杂度过高

**实现要点**:
- 新增 `DELETE /sessions/:sessionId/force` 路由
- Repo 层使用 `db.transaction()` 原子删除：payment → order_ticket_item → order_ticket → table_session
- 复用 `history.repo.deleteClosedSession` 的级联删除逻辑，抽取共享 helper 避免代码漂移
- 删除后广播 `session.deleted` + `table.updated` 事件

### D2: PENDING_CHECKOUT 自动回退采用事务内原子操作

**选择**: `patchTicketItem` 和 `createTicket` 允许 PENDING_CHECKOUT 状态，在同一个 DB 事务内执行 revert + mutation。

**理由**: 自动回退对用户透明，无需额外操作步骤。事务内原子操作确保：如果 mutation 失败，状态不会被错误回退。

**替代方案**:
- 显式回退端点（`POST /sessions/:id/reopen`）：多一次请求和 UI 步骤，用户体验差
- 允许 PENDING_CHECKOUT 下编辑但不改状态：语义模糊，"待结账"状态下还在改菜品

**实现要点**:
- 状态检查从 `status !== 'DINING'` 改为 `status === 'CLOSED'`（拒绝 CLOSED，允许 DINING 和 PENDING_CHECKOUT）
- Repo 新增 `revertToDining(sessionId)`: `UPDATE table_session SET status='DINING' WHERE id=? AND status='PENDING_CHECKOUT'`
- 在 `patchTicketItem` 和 `createTicket` 中，将 revert + mutation 包装在同一个 `db.transaction()` 内
- 回退成功时，`table.updated` 事件 payload 携带 `status: 'dining'`

### D3: 加固 checkout 事务前置条件

**选择**: checkout 事务内增加 `status = 'PENDING_CHECKOUT'` 检查，防止在自动回退后仍能结账。

**理由**: 当前 checkout 仅排除 CLOSED，如果 A 客户端触发自动回退（PENDING_CHECKOUT → DINING），B 客户端的 checkout 请求仍能成功，导致在修改进行中结账，金额不一致。

**实现要点**:
- `checkout.repo.ts` 的 `finalizeCheckout` 事务内，在 `session.status === 'CLOSED'` 检查后增加：`if (session.status !== 'PENDING_CHECKOUT') throw ConflictError('SESSION_NOT_PENDING_CHECKOUT')`
- 前端 checkout 失败时提示"订单已被修改，请重新确认"

### D4: 详情编辑弹窗抽取为独立组件

**选择**: 新建 `web/src/components/business/OrderDetailModal.vue`，TableCard 和 Checkout 页面共同引用。

**理由**: 符合 DRY 原则。弹窗逻辑复杂（数据获取、编辑操作、确认弹窗），内联在 TableCard 会导致组件膨胀。Checkout 页面需要复用同样的弹窗。

**组件接口设计**:
```typescript
// Props
interface OrderDetailModalProps {
  show: boolean           // v-model:show
  sessionId: number       // 用于获取完整 session 数据
  tableNo: string         // 显示标题用
  readonly?: boolean      // CLOSED 状态下只读
}

// Emits
interface OrderDetailModalEmits {
  'update:show': [value: boolean]
  'session-deleted': []   // 订单被删除后通知父组件
  'item-updated': []      // 菜品被修改后通知父组件刷新
}
```

**数据获取策略**: 弹窗打开时调用 `GET /sessions/:id` 获取完整 ticket/item 数据（含 item ID），不影响卡片列表性能。

### D5: 新增 session.deleted SSE 事件

**选择**: 新增 `session.deleted` 事件类型，而非复用 `table.updated`。

**理由**: Serving 页面当前只监听 `serving.updated` 和 `ticket.created`，不监听 `table.updated`。新增语义明确的事件，Serving 页面可以精确处理（移除已删除 session 的所有队列项）。

**实现要点**:
- `SseEventName` 联合类型新增 `'session.deleted'`
- Payload: `{ session_id: number, table_id: number }`
- Serving 页面监听此事件，过滤掉对应 session 的队列项并刷新

### D6: 后端 API 参数双向兼容

**选择**: `patchTicketItem` 同时接受 `qty/void_qty`（旧）和 `qty_ordered/qty_voided`（新），优先使用新命名。

**理由**: 前端已有代码使用 `qty_ordered/qty_voided` 命名（`orders.ts:18`），后端期望 `qty/void_qty`。双向兼容避免破坏性变更，同时让新代码使用更语义化的命名。

**实现要点**:
- `patchTicketItem` 入口处增加字段映射：`body.qty ?? body.qty_ordered`，`body.void_qty ?? body.qty_voided`
- 保持原有验证逻辑不变

## Risks / Trade-offs

| 风险 | 严重度 | 缓解措施 |
|------|--------|----------|
| 硬删除 CLOSED session 丢失已结账历史数据 | 高 | 前端二次确认弹窗，明确提示"将删除所有数据（含结账记录），不可恢复" |
| 并发：上菜操作与 force delete 竞态 | 中 | force delete 事务原子执行，上菜操作遇到 NOT_FOUND 返回错误，前端提示刷新 |
| 并发：checkout 与自动回退竞态 | 高 | D3 加固 checkout 前置条件，事务内检查 PENDING_CHECKOUT |
| 手动级联删除可能遗漏未来新增的依赖表 | 中 | 抽取共享 cascade helper，集中维护删除顺序 |
| 状态机分散在多个模块（serving/tickets/checkout） | 中 | 新增 `revertToDining` 集中在 sessions.repo，所有模块调用同一方法 |
| 弹窗打开时额外 API 调用 | 低 | 仅在打开时请求，不影响列表性能；加 loading 状态 |
