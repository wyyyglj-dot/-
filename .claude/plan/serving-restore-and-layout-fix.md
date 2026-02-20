# 📋 实施计划：上菜队列恢复按钮 + 点餐页面布局修复

## 需求分析

**原始需求**：
1. 在队列页面加一个恢复按钮，防止误点"已上菜"。限制：只能恢复未结账桌号中的已上菜菜品
2. 移动端点餐页面底部缺一块，分类导航栏只显示一半

**增强后需求**：

### 功能 A：上菜队列恢复功能
- 在上菜队列页面增加"已上菜"视图，展示当前活跃会话中已上菜的菜品
- 每个已上菜项提供"恢复"按钮，点击后将 `qty_served` 减回，菜品重新出现在待上菜队列
- 约束条件：
  - 仅限未结账（DINING / PENDING_CHECKOUT）会话的菜品可恢复
  - 已结账（CLOSED）会话的菜品不可恢复
  - 恢复数量不能超过已上菜数量
  - 恢复后若会话从 PENDING_CHECKOUT 回退，需自动转回 DINING

### 功能 B：点餐页面布局修复
- 修复 `.bg-aurora` 的 `overflow: hidden` 导致的两个问题：
  - CategoryTabs sticky 定位失效（只显示一半）
  - 页面底部内容被裁剪

## 任务类型
- [x] 前端 (→ Gemini)
- [x] 后端 (→ Codex)

## 技术方案

### 功能 A：恢复按钮

#### 后端设计

**新增 API 端点**：

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/served-items` | 获取已上菜列表（仅活跃会话） |
| POST | `/api/v1/ticket-items/:itemId/unserve` | 恢复已上菜菜品（减少 qty_served） |

**`GET /served-items` 返回结构**：
```typescript
interface ServedItem {
  item_id: number
  ticket_id: number
  table_no: string
  table_id: number
  session_id: number
  dish_name: string
  qty_served: number      // 已上菜数量（可恢复的最大值）
  qty_ordered: number     // 总点数
  ordered_at: string
}
```

**`POST /ticket-items/:itemId/unserve` 逻辑**：
1. 校验 itemId 存在
2. 校验会话状态 ≠ CLOSED（未结账才能恢复）
3. 校验 qty ≤ qty_served（不能恢复超过已上菜数量）
4. 执行 `qty_served = qty_served - qty`（乐观锁 CAS）
5. 若会话状态为 PENDING_CHECKOUT，自动回退为 DINING
6. 广播 SSE 事件 `serving.updated` + `table.updated`

#### 前端设计

**交互方案**：在 ServingQueue 组件中增加 Tab 切换：
- Tab 1：「待上菜」（当前队列，默认）
- Tab 2：「已上菜」（可恢复列表）

**已上菜列表项**：
- 显示：桌号 + 菜名 × 已上数量 + 下单时间
- 操作：「恢复」按钮（点击后弹确认，恢复成功后刷新两个列表）

### 功能 B：布局修复

**根因**（Gemini 分析确认）：
- `.bg-aurora` 的 `overflow: hidden` 破坏了 `position: sticky` 的工作机制
- `sticky` 需要祖先元素 overflow 为 visible，`overflow: hidden` 创建了新的滚动上下文

**修复方案**：
- 将 `overflow: hidden` 改为 `overflow: clip`
- `overflow: clip` 同样裁剪溢出的伪元素（aurora 光效），但不创建滚动容器，不影响 sticky

## 实施步骤

### Step 1：布局修复 — 修改 bg-aurora CSS
- 文件：`web/src/style.css:131`
- 操作：`overflow: hidden` → `overflow: clip`
- 影响：所有使用 `bg-aurora` 的页面（MobileOrdering、MobileHome、MobileServing 等）
- 验收：CategoryTabs 正确 sticky，底部内容不再被裁剪

### Step 2：后端 — 新增已上菜列表查询
- 文件：`server/src/modules/serving/serving.repo.ts`
- 操作：新增 `listServedItems()` 函数
- SQL：查询活跃会话（DINING/PENDING_CHECKOUT）中 `qty_served > 0` 的菜品
- 返回：`ServedItem[]`

### Step 3：后端 — 新增恢复（unserve）逻辑
- 文件：`server/src/modules/serving/serving.repo.ts`
- 操作：新增 `tryDecrementServedQuantity(itemId, qty)` 函数
- SQL：`UPDATE order_ticket_item SET qty_served = qty_served - ? WHERE id = ? AND qty_served >= ?`

### Step 4：后端 — 新增恢复 Service + Router
- 文件：`server/src/modules/serving/serving.service.ts`
- 操作：新增 `unserveTicketItem(itemId, input)` 函数
  - 校验会话未关闭
  - 校验恢复数量合法
  - 调用 repo 减少 qty_served
  - 若会话为 PENDING_CHECKOUT 且恢复后有待上菜，回退为 DINING
  - 广播 SSE 事件
- 文件：`server/src/modules/serving/serving.router.ts`
- 操作：新增两个路由
  - `GET /served-items` → `service.getServedItems()`
  - `POST /ticket-items/:itemId/unserve` → `service.unserveTicketItem()`

### Step 5：前端 — 新增 API 调用
- 文件：`web/src/api/serving.ts`
- 操作：新增 `getServedItems()` 和 `unserveItem(itemId, qty)` 函数

### Step 6：前端 — 扩展 Store
- 文件：`web/src/stores/orders.ts`
- 操作：
  - 新增 `servedItems` ref
  - 新增 `fetchServedItems()` action
  - 新增 `unserveItem(itemId, qty)` action
  - 新增 `ServedItem` 类型到 `types/index.ts`

### Step 7：前端 — 改造 ServingQueue 组件
- 文件：`web/src/components/business/ServingQueue.vue`
- 操作：
  - 顶部增加 Tab 切换（待上菜 / 已上菜）
  - 「已上菜」Tab 渲染 servedItems 列表
  - 每项显示「恢复」按钮
  - 点击恢复后刷新两个列表

### Step 8：前端 — 新增 ServedItem 组件（可选，复用 ServingItem 样式）
- 文件：`web/src/components/business/ServingItem.vue`
- 操作：扩展 props 支持 `mode: 'serving' | 'served'`
  - serving 模式：显示「已上菜」按钮（当前行为）
  - served 模式：显示「恢复」按钮 + 已上数量

## 关键文件

| 文件 | 操作 | 说明 |
|------|------|------|
| [style.css:131](web/src/style.css#L131) | 修改 | `overflow: hidden` → `overflow: clip` |
| [serving.repo.ts](server/src/modules/serving/serving.repo.ts) | 修改 | 新增 `listServedItems()` + `tryDecrementServedQuantity()` |
| [serving.service.ts](server/src/modules/serving/serving.service.ts) | 修改 | 新增 `getServedItems()` + `unserveTicketItem()` |
| [serving.router.ts](server/src/modules/serving/serving.router.ts) | 修改 | 新增 2 个路由 |
| [serving.ts (api)](web/src/api/serving.ts) | 修改 | 新增 2 个 API 调用 |
| [types/index.ts](web/src/types/index.ts) | 修改 | 新增 `ServedItem` 类型 |
| [orders.ts (store)](web/src/stores/orders.ts) | 修改 | 新增 served 相关 state/actions |
| [ServingQueue.vue](web/src/components/business/ServingQueue.vue) | 修改 | 增加 Tab 切换 + 已上菜列表 |
| [ServingItem.vue](web/src/components/business/ServingItem.vue) | 修改 | 支持 served 模式 + 恢复按钮 |

## 风险与缓解

| 风险 | 缓解措施 |
|------|----------|
| 恢复操作并发冲突 | 使用 CAS 乐观锁（`WHERE qty_served >= ?`） |
| 已结账会话被恢复 | 后端强制校验 `session_status ≠ CLOSED` |
| `overflow: clip` 浏览器兼容性 | Chrome 90+/Safari 16+/Firefox 81+ 均支持，覆盖主流设备 |
| PENDING_CHECKOUT 回退为 DINING | 恢复时检测并自动回退，SSE 通知前端刷新状态 |

## SESSION_ID（供 /ccg:execute 使用）
- CODEX_SESSION: (未使用)
- GEMINI_SESSION: bb181570-bf26-497e-90d3-33db072721e7
