# 📋 实施计划：分类管理功能（队列控制 + 折扣系统）

## 任务类型
- [x] 全栈 (→ 并行)

## 需求摘要

在 MenuConfig 菜品管理页面增加「分类管理」按钮，弹窗内以表格形式管理所有分类，支持：
1. 分类 CRUD（名称、排序、启用/停用、删除）
2. 跳过队列标记（如饮料无需上菜排队，下单即自动标记已上菜 + 视觉提示）
3. 折扣设置（百分比折扣率 + 启用开关，影响下单价格快照）

## 技术方案

### 核心设计决策

| 决策点 | 方案 | 理由 |
|--------|------|------|
| 折扣计算位置 | 后端 ticket 创建时计算 | 防止客户端篡改，价格快照一致性 |
| 折扣存储 | `discount_rate` REAL (0.01~1.0) + `is_discount_enabled` 开关 | 灵活控制，不影响基础售价 |
| 跳过队列实现 | 下单时 `qty_served = qty_ordered` | 上菜队列 SQL 自然排除，零改动 |
| 价格快照 | `unit_sell_price_cents` 存折后价 | checkout/统计/历史无需改动 |
| 分类管理 UI | Modal + NDataTable + 混合编辑 | 开关类用 NSwitch 直接切换，文本类行内编辑 |

### 数据流变更

```
下单流程（变更部分）:
  getDishSnapshot() → 新增返回 skip_queue / discount_rate / is_discount_enabled
  ↓
  tickets.service.createTicket()
    → 计算 effective_price = Math.round(sell_price_cents * discount_rate)
    → 若 skip_queue: qty_served = qty_ordered
  ↓
  order_ticket_item.unit_sell_price_cents = effective_price（折后快照）
  order_ticket_item.qty_served = skip_queue ? qty_ordered : 0
```

## 实施步骤

### Step 1: 数据库迁移
- 新建 `server/src/db/migrations/0003_category_flags.sql`
- 添加 3 个字段到 `menu_category`：
  - `skip_queue INTEGER NOT NULL DEFAULT 0`
  - `discount_rate REAL NOT NULL DEFAULT 1.0`
  - `is_discount_enabled INTEGER NOT NULL DEFAULT 0`
- 预期产物：迁移文件，启动时自动执行

### Step 2: 后端类型 & 接口扩展
- 更新 `server/src/shared/types.ts` Category 接口：新增 `skip_queue`, `discount_rate`, `is_discount_enabled`
- 更新 `server/src/modules/menu/menu.repo.ts`：
  - `listCategories()` / `getCategoryById()` SELECT 新增字段
  - `createCategory()` 接受新字段
  - `updateCategory()` 支持新字段 patch
  - 新增 `deleteCategory(id)` 方法（含菜品引用检查）
- 更新 `server/src/modules/menu/menu.service.ts`：
  - `createCategory()` 验证新字段（discount_rate 范围 0.01~1.0）
  - `updateCategory()` 验证新字段
  - 新增 `deleteCategory(id)` 服务方法
- 更新 `server/src/modules/menu/menu.router.ts`：
  - 新增 `DELETE /api/v1/categories/:id` 路由
- 预期产物：完整的分类 CRUD API（含删除保护）

### Step 3: 后端工单创建逻辑变更
- 更新 `server/src/modules/tickets/tickets.repo.ts`：
  - `getDishSnapshot()` JOIN 新增 `c.skip_queue`, `c.discount_rate`, `c.is_discount_enabled`
  - `DishSnapshot` 接口新增对应字段
  - `NewTicketItem` 接口新增 `qty_served` 字段（可选，默认 0）
  - `createTicketWithItems()` INSERT 语句使用 item 的 `qty_served` 值（替代硬编码 0）
- 更新 `server/src/modules/tickets/tickets.service.ts`：
  - `createTicket()` 中计算折后价：`Math.round(dish.sell_price_cents * (is_discount_enabled ? discount_rate : 1.0))`
  - 若 `skip_queue`：设置 `qty_served = qty_ordered`
- 预期产物：下单自动应用折扣 + 跳过队列

### Step 4: 后端边界情况处理
- 更新 `server/src/modules/tables/tables.repo.ts`：
  - `autoTransitionStuckSessions()` 逻辑调整：当会话所有已点菜品均为 skip_queue 类别时，不自动转为 PENDING_CHECKOUT（避免只点饮料就无法继续加菜）
  - 方案：在 `loadAllDishesByTable()` 查询中标记 skip_queue 来源，transition 判断时排除纯 skip_queue 会话
- 预期产物：避免纯饮料订单被误转状态

### Step 5: 前端类型 & API & Store 扩展
- 更新 `web/src/types/index.ts`：Category 接口新增 3 个字段
- 更新 `web/src/api/menu.ts`：
  - `createCategory()` 参数扩展
  - 新增 `deleteCategory(id)` API
- 更新 `web/src/stores/menu.ts`：
  - `addCategory()` 参数扩展
  - 新增 `updateCategory(id, data)` action
  - 新增 `deleteCategory(id)` action
- 预期产物：前端数据层完整支持分类管理

### Step 6: 分类管理弹窗 UI
- 新建 `web/src/components/business/CategoryManager.vue`：
  - NModal preset="card" 宽度 800px
  - NDataTable 列：排序(NInputNumber)、名称(行内编辑)、免排队(NSwitch)、折扣率(NInputNumber + %)、折扣开关(NSwitch)、状态(NSwitch)、操作(删除 NPopconfirm)
  - 顶部「新增分类」按钮
  - 开关类字段直接切换并调用 API
  - 删除按钮：有菜品时 disabled + tooltip 提示
- 更新 `web/src/views/MenuConfig.vue`：
  - 将「新增分类」按钮替换为「分类管理」按钮
  - 引入 CategoryManager 组件
- 预期产物：完整的分类管理 UI

### Step 7: 点餐页面视觉提示
- 更新 `web/src/components/business/DishCard.vue`：
  - 跳过队列：显示「免排队」NTag (info/teal 色)
  - 折扣生效：显示「X折」NTag (warning/red 色) + 原价删除线 + 折后价
  - 需要从 menuStore 获取分类信息来判断
- 更新 `web/src/components/business/CartPanel.vue`：
  - 购物车项显示折后单价
  - 跳过队列项显示小图标提示
- 更新 `web/src/stores/cart.ts`：
  - `addDish()` 时计算折后价作为 `price_cents`
- 预期产物：点餐时清晰的视觉反馈

### Step 8: 移动端适配
- 更新 `web/src/views/mobile/MobileOrdering.vue`：
  - DishCard 已复用，自动继承视觉提示
  - 确认 CartPanel 在移动端的折扣显示正常
- 预期产物：移动端一致体验

## 关键文件

| 文件 | 操作 | 说明 |
|------|------|------|
| `server/src/db/migrations/0003_category_flags.sql` | 新建 | 分类新字段迁移 |
| `server/src/shared/types.ts` | 修改 | Category 接口扩展 |
| `server/src/modules/menu/menu.repo.ts` | 修改 | 分类 CRUD + 删除 |
| `server/src/modules/menu/menu.service.ts` | 修改 | 验证逻辑 + 删除服务 |
| `server/src/modules/menu/menu.router.ts` | 修改 | DELETE 路由 |
| `server/src/modules/tickets/tickets.repo.ts` | 修改 | getDishSnapshot 扩展 + qty_served 支持 |
| `server/src/modules/tickets/tickets.service.ts` | 修改 | 折扣计算 + 跳过队列逻辑 |
| `server/src/modules/tables/tables.repo.ts` | 修改 | autoTransition 边界处理 |
| `web/src/types/index.ts` | 修改 | Category 接口扩展 |
| `web/src/api/menu.ts` | 修改 | deleteCategory API |
| `web/src/stores/menu.ts` | 修改 | updateCategory / deleteCategory |
| `web/src/stores/cart.ts` | 修改 | 折后价计算 |
| `web/src/components/business/CategoryManager.vue` | 新建 | 分类管理弹窗组件 |
| `web/src/views/MenuConfig.vue` | 修改 | 替换按钮 + 引入组件 |
| `web/src/components/business/DishCard.vue` | 修改 | 视觉提示标签 |
| `web/src/components/business/CartPanel.vue` | 修改 | 折扣价显示 |

## 风险与缓解

| 风险 | 缓解措施 |
|------|----------|
| 纯 skip_queue 订单触发 autoTransition 导致无法继续加菜 | Step 4 专门处理：排除纯 skip_queue 会话的自动转状态 |
| 折扣率修改后已下单的价格不一致 | 价格快照机制已保证：`unit_sell_price_cents` 存的是下单时的折后价 |
| 删除有菜品的分类导致外键错误 | 后端 deleteCategory 先检查菜品数量，有菜品时返回 409 CATEGORY_HAS_DISHES |
| 折扣率精度问题（浮点数） | 使用 `Math.round()` 确保分为整数；discount_rate 存 REAL 精度足够 |
| 临时菜品（source_dish_id=NULL）无分类信息 | 临时菜品不受分类折扣/队列影响，保持现有逻辑 |

## SESSION_ID（供 /ccg:execute 使用）
- CODEX_SESSION: 019c7121-4fc4-79f1-991f-046f12e6c8e8
- GEMINI_SESSION: a737ea45-d85c-457b-9903-b682060b760e
