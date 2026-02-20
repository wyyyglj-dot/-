# Proposal: 订单详情增强 — 查看/编辑/删除全流程

## Context

当前点餐系统的订单详情功能存在以下不足：
1. 桌台卡片的"查看详情"按钮仅在菜品数 > 3 时显示，用户期望只要有菜品就显示
2. 详情弹窗为纯展示，无法修改菜品数量、删除菜品或删除整个订单
3. 结账页面缺少详情查看入口，且 PENDING_CHECKOUT 状态下无法继续点餐/修改订单
4. 后端 API 限制 DINING 状态才能修改 ticket item 和创建 ticket

## Requirements

### R1: "查看详情"按钮始终显示
- **场景**: 桌台有任意数量菜品（≥1）时，"查看详情"按钮始终可见
- **当前**: `(table.dishes?.length ?? 0) > 3` → **改为**: `table.dishes?.length > 0`
- **影响文件**: `web/src/components/business/TableCard.vue:107`

### R2: 详情弹窗支持编辑操作
- **场景**: 用户在详情弹窗中可以：
  - 增加/减少单个菜品的数量（直接修改 qty_ordered）
  - 删除单个菜品（将 qty_ordered 设为 qty_served + qty_voided，即 void 所有待上菜数量）
  - 删除整个订单（彻底删除 session 及所有关联数据，桌台恢复空闲）
- **数据约束**: 当前 `TableSummary.dishes` 是聚合数据，无 ticket_item ID。需在打开详情时调用 `GET /sessions/:id` 获取完整 ticket/item 数据
- **数量修改方式**: 直接调用 `PATCH /ticket-items/:id` 修改 `qty_ordered`
  - 不能低于 `qty_served + qty_voided`
  - 不会影响上菜队列排序（保持原始 ordered_at）
- **删除菜品**: 调用 `PATCH /ticket-items/:id` 设置 `void_qty` = 剩余待上菜数量
- **影响文件**: `web/src/components/business/TableCard.vue`（弹窗重构）

### R3: 删除订单功能（彻底删除）
- **场景**: 用户在详情弹窗点击"删除订单"，二次确认后彻底删除 session 及所有关联数据
- **后端**: 新增 `DELETE /sessions/:sessionId/force` API（区别于现有的 cancelSession，后者只能删除无订单的 session）
- **事务操作**: 删除 order_ticket_item → order_ticket → table_session，桌台恢复空闲
- **SSE 通知**: 广播 `table.updated` 事件
- **影响文件**:
  - `server/src/modules/sessions/sessions.repo.ts`（新增 forceDeleteSession）
  - `server/src/modules/sessions/sessions.service.ts`（新增 forceDeleteSession）
  - `server/src/modules/sessions/sessions.router.ts`（新增 DELETE 路由）
  - `web/src/api/orders.ts`（新增 deleteSession API）

### R4: PENDING_CHECKOUT 状态支持修改和加菜
- **场景**: 顾客在待结账状态下要求加菜或修改菜品
- **策略**: 自动回退 — 当用户在 PENDING_CHECKOUT 状态下执行修改/加菜操作时，后端自动将 session 状态回退到 DINING
- **后端修改**:
  - `patchTicketItem`: 允许 PENDING_CHECKOUT 状态，执行前自动回退 session 到 DINING
  - `createTicket`: 允许 PENDING_CHECKOUT 状态，执行前自动回退 session 到 DINING
- **SSE 通知**: 回退时广播 `table.updated` 事件（状态变更）
- **影响文件**:
  - `server/src/modules/tickets/tickets.service.ts`（放宽状态检查 + 自动回退）
  - `server/src/modules/sessions/sessions.repo.ts`（新增 revertToDining）

### R5: 结账页面增加详情入口
- **场景**: 结账页面保持现有样式，底部增加"查看详情"按钮，复用 TableCard 中的详情弹窗功能
- **加菜入口**: 结账状态下点击桌台卡片已能进入点餐页面，但下单会报错（R4 解决此问题）
- **影响文件**: `web/src/views/Checkout.vue`（增加详情弹窗）

## Success Criteria

1. ✅ 桌台有 1 道菜时，"查看详情"按钮可见
2. ✅ 详情弹窗中可增加菜品数量，上菜队列同步更新
3. ✅ 详情弹窗中可减少菜品数量（不低于已上菜数），上菜队列同步更新
4. ✅ 详情弹窗中可删除单个菜品（void 所有待上菜数量）
5. ✅ 详情弹窗中可删除整个订单，桌台恢复空闲，数据彻底清除
6. ✅ PENDING_CHECKOUT 状态下修改菜品，session 自动回退到 DINING
7. ✅ PENDING_CHECKOUT 状态下进入点餐页面加菜，下单成功
8. ✅ 结账页面有"查看详情"入口，弹窗功能完整可用
9. ✅ 所有操作通过 SSE 实时同步到其他客户端

## Risks

| 风险 | 缓解措施 |
|------|----------|
| 彻底删除 session 不可恢复 | 前端二次确认弹窗，明确提示"不可恢复" |
| 详情弹窗需额外 API 调用获取 item ID | 仅在打开弹窗时请求，不影响卡片列表性能 |
| 自动回退 DINING 可能导致结账流程混乱 | 回退后 SSE 通知所有客户端，卡片状态实时更新 |
| 并发修改冲突 | 后端已有乐观锁机制（CONCURRENT_MODIFICATION 错误） |
