# 📋 实施计划：菜品辣度备注功能

## 任务类型
- [x] 全栈 (→ 并行)

## 需求摘要

店员点餐时，部分菜品需要标注辣度（微辣/中辣/特辣）。操作者是店员而非顾客，高峰期速度至关重要。

核心约束：
- 不需要辣度的菜品，点击即 +1 的默认流程不变
- 需要辣度的菜品，最多额外 1 次点击即可完成标注
- 同一菜品不同辣度 = 不同行项目（购物车、工单、上菜队列）
- 厨房（上菜队列）和桌位卡片必须清晰显示辣度信息

## 方案对比分析

### 方案 A：辣度拼接到 `dish_name_snapshot`（无新列）

| 维度 | 评价 |
|------|------|
| 实现成本 | 低 |
| 数据完整性 | ❌ 污染菜名快照，统计排行会按辣度拆分（"羊肉串" vs "羊肉串(特辣)"） |
| 可扩展性 | ❌ 无法按辣度筛选/聚合 |
| 向后兼容 | ⚠️ 历史数据格式不一致 |

### 方案 B：新增 `spice_level` 快照列 + `has_spice_option` 菜品标记 ✅ 推荐

| 维度 | 评价 |
|------|------|
| 实现成本 | 中等 |
| 数据完整性 | ✅ 菜名快照保持干净，辣度独立存储 |
| 可扩展性 | ✅ 可按辣度筛选/聚合，未来可扩展更多选项 |
| 向后兼容 | ✅ 新列 nullable，旧数据 NULL = 不辣 |

### 方案 C：通用修饰符表（JSON/关联表）

| 维度 | 评价 |
|------|------|
| 实现成本 | 高 |
| 数据完整性 | ✅ 最灵活 |
| 可扩展性 | ✅ 支持任意修饰符 |
| 向后兼容 | ⚠️ 改动面大，SQLite JSON 支持有限 |

**结论：选择方案 B**，与现有快照模式（`skip_queue_snapshot`）一致，改动可控。

## 双模型交叉验证

### 一致观点（强信号）
- 数据模型：两个模型均认为需要在 `order_ticket_item` 新增字段存储辣度，不应污染 `dish_name_snapshot`
- 购物车 Key：均建议 `${dish.id}_${spiceLevel}` 策略区分不同辣度变体
- 同菜品不同辣度必须是独立行项目

### 分歧点（需权衡）
| 维度 | Codex（后端视角） | Gemini（前端视角） | 最终决策 |
|------|-------------------|-------------------|----------|
| 交互模式 | 未深入 UI 交互 | 推荐长按 + 扇形径向菜单（Marking Menu） | **采用长按 + 扇形菜单 + Sticky 模式** |
| 数据字段 | 专用 `spice_level` 列 | 通用 `item_notes` 字段 | **采用专用列**（更结构化，可查询） |
| 可发现性 | 建议 `has_spice_option` 标记 | 建议辣椒图标 + 首次引导 | **两者结合**：标记 + 图标 + 引导 |

### 交互模式决策分析（v2 - 用户反馈修订）

用户反馈：卡片内嵌按钮太小难以点击。经 Gemini 深度分析后，采用 **长按 + 扇形径向菜单 + Sticky Spice 模式**：

**选择理由：**
1. **不占卡片空间**：扇形菜单仅在长按时浮现，卡片布局保持简洁
2. **手势高效**：Press-Slide-Release（Marking Menu 模式），熟练后可盲操作
3. **Sticky 模式解决批量问题**：选择辣度后卡片进入"锁定"状态，后续点击自动应用相同辣度
4. **PC 端右键替代长按**：更自然，无延迟

**可发现性保障：**
- `has_spice_option=1` 的菜品右上角显示小辣椒图标 🌶
- 首次使用时显示引导提示："长按菜品可选择辣度"
- 偶尔在普通点击后显示 toast 提示

### Gemini 深度分析要点（已采纳）
1. 扇形菜单使用色彩编码：微辣=amber、中辣=orange、特辣=red
2. 触控区域 ≥ 60×60px，中心死区防止误选
3. 移动端扇形菜单出现在触摸点上方，避免手指遮挡
4. Sticky 模式 5 秒无操作自动解锁，切换其他菜品也解锁
5. 上菜队列辣度信息使用高对比度颜色

## 技术方案

### 数据模型变更

```sql
-- 0007_spice_level.sql
ALTER TABLE menu_dish ADD COLUMN has_spice_option INTEGER NOT NULL DEFAULT 0;
ALTER TABLE order_ticket_item ADD COLUMN spice_level TEXT;
-- spice_level 允许值: NULL(不辣), 'MILD'(微辣), 'MEDIUM'(中辣), 'HOT'(特辣)
```

### 辣度枚举定义

```typescript
// shared/types.ts
export type SpiceLevel = 'MILD' | 'MEDIUM' | 'HOT'
export const SPICE_LABELS: Record<SpiceLevel, string> = {
  MILD: '微辣',
  MEDIUM: '中辣',
  HOT: '特辣',
}
export const SPICE_COLORS: Record<SpiceLevel, string> = {
  MILD: '#f59e0b',   // amber
  MEDIUM: '#f97316',  // orange
  HOT: '#ef4444',     // red
}
```

### 购物车 Key 策略

```typescript
// 当前: _key = String(dish.id)  → 同菜品合并
// 新增: _key = `${dish.id}` (无辣度) 或 `${dish.id}_${spiceLevel}` (有辣度)
// 这样同菜品不同辣度自然成为不同行项目
```

### CartItem 类型扩展

```typescript
interface CartItem {
  _key: string
  dish_id: number | null
  name: string
  price_cents: number
  cost_cents: number
  quantity: number
  spice_level?: SpiceLevel | null  // 新增
}
```

### API 变更

```typescript
// createTicket 请求体 items[] 新增可选字段
interface TicketItemInput {
  dish_id?: number | null
  name?: string
  sell_price_cents?: number
  cost_price_cents?: number
  qty: number
  spice_level?: string | null  // 新增
}
```

## 前端 UX 设计

### 核心交互原则

1. **默认流程不变**：点击 DishCard 主体 = 加入购物车（无辣度），与现在完全一致
2. **长按触发扇形菜单**：`has_spice_option` 的菜品长按 300ms 弹出扇形辣度选择器
3. **Sticky Spice 模式**：选择辣度后，卡片进入"锁定"状态，后续点击自动应用相同辣度
4. **PC 端右键替代长按**：无需等待，即时弹出

### 扇形径向菜单设计（SpiceRadialMenu）

```
         [ 中辣 ]        ← 上方（橙色）
        / (Orange) \
       /            \
  [ 微辣 ]        [ 特辣 ]   ← 左（琥珀色）/ 右（红色）
  (Amber)          (Red)
       \            /
        \    ●     /     ← 中心死区：松手 = 取消
         \  触摸  /
          \ 点  /
           \  /
            \/
```

- 半圆形布局，出现在触摸点上方（避免手指遮挡）
- 3 个扇区：左=微辣(amber)、上=中辣(orange)、右=特辣(red)
- 中心死区：松手不选择任何辣度 = 取消操作
- 每个扇区 ≥ 60×60px 触控面积，包含文字标签（不仅靠颜色区分）
- 屏幕边缘自适应：靠近顶部时菜单出现在下方

### 手势流程

```
[普通点击]  ──→  加入购物车（无辣度）  ──→  与现在完全一致

[长按 300ms] ──→  卡片缩小 95% + 震动反馈
             ──→  扇形菜单浮现
             ──→  手指滑向目标扇区（扇区高亮放大）
             ──→  松手 = 确认选择，加入购物车（带辣度）
             ──→  卡片进入 Sticky 模式

[松手在中心] ──→  取消，不添加任何菜品

[PC 右键]   ──→  直接弹出扇形菜单（无需等待）
             ──→  鼠标移动到扇区 + 松开右键 = 确认
```

### Sticky Spice 模式（批量辣度）

解决场景："10串羊肉串，都要特辣"

```
┌─────────────────────────┐
│ 羊肉串 🌶       [3]     │  ← 辣椒图标提示支持辣度
│ [免排队]                 │
│                         │
│ ¥3                  [+] │
│ ── 🔒 特辣模式 ──       │  ← Sticky 状态指示条（红色）
└─────────────────────────┘
```

工作流程：
1. 长按羊肉串 → 扇形菜单 → 选择「特辣」→ 加入 1 份特辣羊肉串
2. 卡片进入 Sticky 模式，底部显示红色「🔒 特辣模式」指示条
3. 后续每次点击该卡片 → 自动加入特辣羊肉串（无需再次长按）
4. 连续点击 9 次 → 共 10 份特辣羊肉串

退出 Sticky 模式的条件：
- **超时**：5 秒无操作自动解锁
- **切换**：点击其他菜品时自动解锁
- **手动**：点击 Sticky 指示条可手动解锁
- **再次长按**：可切换到其他辣度

### 混合辣度操作指南

场景："10串羊肉串，5串不辣，5串特辣"

推荐操作顺序：**先不辣，后辣**
1. 点击羊肉串卡片 5 次 → 5 串不辣（默认流程，零额外操作）
2. 长按羊肉串 → 选「特辣」→ 加入 1 串特辣，自动进入 Sticky
3. 点击 4 次 → 共 5 串特辣
4. Sticky 5 秒后自动解锁（或切到其他菜品时解锁）

反向操作也可行：先辣后不辣
1. 长按 → 选「特辣」→ Sticky 模式
2. 点击 4 次 → 共 5 串特辣
3. 点击 Sticky 指示条手动解锁
4. 点击 5 次 → 5 串不辣

### DishCard 视觉变化

```
普通菜品（无辣度支持）：
┌─────────────────────────┐
│ 啤酒              [2]   │  ← 无辣椒图标
│ ¥8                  [+] │
└─────────────────────────┘

辣度菜品（has_spice_option=1）：
┌─────────────────────────┐
│ 羊肉串 🌶         [3]   │  ← 右上角小辣椒图标
│ [免排队]                 │     提示"长按可选辣度"
│ ¥3                  [+] │
└─────────────────────────┘

Sticky 模式中：
┌─────────────────────────┐
│ 羊肉串 🌶         [3]   │
│ [免排队]                 │
│ ¥3                  [+] │
│ ── 🔒 特辣模式 ──       │  ← 红色指示条
└─────────────────────────┘
```

### DishCard 数量角标

当前逻辑：`cartStore.items.find(i => i.dish_id === dish.id)?.quantity`
改为：`cartStore.items.filter(i => i.dish_id === dish.id).reduce((s, i) => s + i.quantity, 0)`
→ 显示该菜品所有辣度变体的总数量

### 上菜队列显示

```
┌──────────────────────────────────────────┐
│ [1号桌]  羊肉串(特辣) × 5    00:03:21  [已上菜] │
│ [1号桌]  羊肉串 × 10         00:03:21  [已上菜] │
└──────────────────────────────────────────┘
```

ServingItem.vue 中 `dish_name` 后追加辣度标签，格式：`${dish_name}(${SPICE_LABELS[spice_level]})`

### 桌位卡片菜品列表

TableDishItem 新增 `spice_level` 字段，分组键加入 `spice_level`：
- "羊肉串 ×10"（无辣度）
- "羊肉串(特辣) ×5"（有辣度）

## 实施步骤

### Step 1: 数据库迁移
- 新建 `server/src/db/migrations/0007_spice_level.sql`
- `menu_dish` 添加 `has_spice_option INTEGER NOT NULL DEFAULT 0`
- `order_ticket_item` 添加 `spice_level TEXT`（nullable）
- 预期产物：迁移文件，启动时自动执行

### Step 2: 后端类型与共享定义
- `server/src/shared/types.ts`：新增 `SpiceLevel` 类型、`SPICE_LABELS` 常量、`OrderTicketItem.spice_level` 字段
- `web/src/types/index.ts`：同步新增 `SpiceLevel`、`CartItem.spice_level`、`OrderTicketItem.spice_level`、`TableDishItem.spice_level`
- 预期产物：前后端类型对齐

### Step 3: 后端 - 菜品管理支持 `has_spice_option`
- `server/src/modules/menu/menu.repo.ts`：CRUD 包含 `has_spice_option`
- `server/src/modules/menu/menu.service.ts`：创建/更新菜品时接受 `has_spice_option`
- 前端 `web/src/types/index.ts` 的 `Dish` 接口添加 `has_spice_option`
- 预期产物：菜品管理可配置辣度选项

### Step 4: 后端 - 工单创建支持 `spice_level`
- `server/src/modules/tickets/tickets.service.ts`：`createTicket` 接受 `spice_level`，校验允许值
- `server/src/modules/tickets/tickets.repo.ts`：`NewTicketItem` 新增 `spice_level`，INSERT 语句包含该字段
- `web/src/api/orders.ts`：`TicketItemInput` 新增 `spice_level`
- 预期产物：工单可携带辣度信息

### Step 5: 后端 - 上菜队列与桌位汇总包含辣度
- `server/src/modules/serving/serving.repo.ts`：查询结果包含 `spice_level`
- `server/src/modules/tables/tables.repo.ts`：`loadAllDishesByTable` 分组键加入 `spice_level`，`TableDishItem` 新增 `spice_level`
- `server/src/modules/history/history.repo.ts`：历史恢复包含 `spice_level`
- 预期产物：所有查询正确传递辣度信息

### Step 6: 前端 - 购物车 Store 支持辣度
- `web/src/stores/cart.ts`：
  - `addItem` 接受可选 `spiceLevel` 参数
  - `_key` 策略：`${dish.id}_${spiceLevel ?? 'none'}`
  - `submitOrder` 传递 `spice_level` 到 API
- 预期产物：购物车正确区分不同辣度的同一菜品

### Step 7: 前端 - SpiceRadialMenu 组件
- 新建 `web/src/components/business/SpiceRadialMenu.vue`：
  - 扇形径向菜单组件（全局浮层，absolute 定位）
  - Props：`visible`、`position: {x, y}`、`screenEdge` 自适应
  - 3 个扇区：MILD(amber)、MEDIUM(orange)、HOT(red)
  - 中心死区取消逻辑
  - 触摸/鼠标事件处理（touchmove/mousemove 追踪扇区高亮）
  - emit `select: [SpiceLevel]` 或 `cancel`
- 预期产物：可复用的扇形辣度选择器组件

### Step 8: 前端 - DishCard 长按手势 + Sticky 模式
- `web/src/components/business/DishCard.vue`：
  - 新增 prop `hasSpiceOption?: boolean`
  - 长按检测（300ms threshold）：`touchstart`/`mousedown` + timer
  - 长按触发时：卡片缩小 95%、震动反馈、弹出 SpiceRadialMenu
  - 右键事件（PC）：`@contextmenu.prevent` 直接弹出菜单
  - Sticky 模式状态：底部显示锁定指示条
  - emit 事件改为 `add: [dish: Dish, spiceLevel?: SpiceLevel]`
  - 辣椒图标提示（`has_spice_option` 时显示）
- `web/src/views/Ordering.vue`：传递 `hasSpiceOption`，处理辣度参数
- `web/src/views/mobile/MobileOrdering.vue`：同上
- 数量角标改为所有辣度变体总和
- 预期产物：DishCard 支持长按辣度选择 + Sticky 批量模式

### Step 9: 前端 - Sticky Spice 状态管理
- `web/src/stores/cart.ts` 或新建 `web/src/composables/useStickySpice.ts`：
  - `stickyDishId: number | null`
  - `stickySpiceLevel: SpiceLevel | null`
  - `setSticky(dishId, spice)` / `clearSticky()`
  - 5 秒超时自动清除
  - 切换菜品时自动清除
- 预期产物：Sticky 模式状态管理

### Step 10: 前端 - 购物车面板辣度显示
- `web/src/components/business/CartPanel.vue`：辣度项显示彩色标签
- `web/src/views/mobile/MobileOrdering.vue`：抽屉内购物车同步显示辣度标签
- 预期产物：购物车清晰展示辣度信息

### Step 11: 前端 - 上菜队列与桌位卡片辣度显示
- `web/src/components/business/ServingItem.vue`：`dish_name` 后追加辣度标签
- `web/src/components/business/TableCard.vue`：菜品列表显示辣度
- 预期产物：厨房和桌位视图可见辣度信息

### Step 12: 菜品管理页面 - 辣度开关配置
- `web/src/views/MenuConfig.vue`：菜品编辑表单新增「支持辣度选择」开关
- 预期产物：管理员可配置哪些菜品显示辣度按钮

## 关键文件

| 文件 | 操作 | 说明 |
|------|------|------|
| `server/src/db/migrations/0007_spice_level.sql` | 新建 | 数据库迁移 |
| `server/src/shared/types.ts` | 修改 | 新增 SpiceLevel 类型 |
| `server/src/modules/tickets/tickets.service.ts` | 修改 | 工单创建接受 spice_level |
| `server/src/modules/tickets/tickets.repo.ts` | 修改 | INSERT 包含 spice_level |
| `server/src/modules/serving/serving.repo.ts` | 修改 | 查询包含 spice_level |
| `server/src/modules/tables/tables.repo.ts` | 修改 | 分组键加入 spice_level |
| `server/src/modules/menu/menu.repo.ts` | 修改 | CRUD 包含 has_spice_option |
| `server/src/modules/menu/menu.service.ts` | 修改 | 接受 has_spice_option |
| `server/src/modules/history/history.repo.ts` | 修改 | 历史恢复包含 spice_level |
| `web/src/types/index.ts` | 修改 | 前端类型同步 |
| `web/src/stores/cart.ts` | 修改 | 购物车辣度支持 |
| `web/src/api/orders.ts` | 修改 | API 传递 spice_level |
| `web/src/components/business/DishCard.vue` | 修改 | 长按手势 + Sticky 模式 + 辣椒图标 |
| `web/src/components/business/SpiceRadialMenu.vue` | 新建 | 扇形径向辣度选择器 |
| `web/src/composables/useStickySpice.ts` | 新建 | Sticky Spice 状态管理 |
| `web/src/components/business/CartPanel.vue` | 修改 | 辣度标签显示 |
| `web/src/components/business/ServingItem.vue` | 修改 | 上菜队列辣度显示 |
| `web/src/components/business/TableCard.vue` | 修改 | 桌位卡片辣度显示 |
| `web/src/views/Ordering.vue` | 修改 | 传递辣度参数 |
| `web/src/views/mobile/MobileOrdering.vue` | 修改 | 传递辣度参数 |
| `web/src/views/MenuConfig.vue` | 修改 | 辣度开关配置 |

## 风险与缓解

| 风险 | 缓解措施 |
|------|----------|
| 统计排行按辣度拆分 | `spice_level` 独立列，stats 查询可选择是否按辣度分组 |
| 购物车持久化兼容 | `spice_level` 可选字段，旧数据无此字段不影响 |
| 长按与滚动冲突 | 300ms 阈值 + 移动距离检测（移动 >10px 视为滚动，取消长按） |
| 扇形菜单屏幕边缘溢出 | 自适应定位：靠近顶部时菜单出现在下方 |
| Sticky 模式误操作 | 5 秒超时自动解锁 + 手动解锁 + 切换菜品解锁 |
| 长按可发现性 | 辣椒图标提示 + 首次引导 + 偶尔 toast 提示 |
| 临时菜品辣度 | 暂不支持，临时菜品通过名称手动备注即可 |

## 待确认事项

1. `has_spice_option=1` 的菜品，辣度是否必填？（建议：非必填，点击卡片主体 = 不辣/默认）
2. 统计排行是否需要按辣度拆分？（建议：默认按菜品聚合，不按辣度拆分）
3. 临时菜品是否需要辣度选择？（建议：暂不支持，通过名称备注）

## SESSION_ID（供 /ccg:execute 使用）
- CODEX_SESSION: 019c720b-d2b9-7f72-b72b-6f330f1a277c
- GEMINI_SESSION: 8ef6cd20-ed42-484a-85cb-4737cfbd450b
