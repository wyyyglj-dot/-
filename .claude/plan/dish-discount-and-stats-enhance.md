# 📋 实施计划：商品级折扣 + 营业统计增强

## 任务类型
- [x] 全栈 (→ 并行)

## 需求摘要

三项增强需求：
1. **商品级折扣系统**：在现有分类级折扣基础上，增加单个菜品的独立折扣设置（商品级 > 分类级）
2. **导航重命名**：PC 侧边栏 "统计" → "营业统计"（与其他 4 字导航一致）
3. **统计页日/周/月分类**：PC 和移动端统计页增加日/周/月 Tab 切换

## 交叉验证结论

| 决策点 | Codex 观点 | Gemini 观点 | 最终决策 |
|--------|-----------|------------|---------|
| 折扣计算位置 | 后端 service 计算一次，前端消费 API 结果 | 前端 cart store 本地计算 | **混合**：后端 service 为权威计算（写入快照），前端 store 本地计算用于显示（两端同一优先级逻辑） |
| 折扣 UI 入口 | 菜品管理页面 | 菜品编辑弹窗内新增折扣区域 | **菜品编辑弹窗**（Gemini 方案，更自然） |
| 移动端导航改名 | 改为"营业统计"并验证布局 | 保持"统计"2字，仅改页面标题 | **PC 改为"营业统计"，移动端保持"统计"**（移动端 3 个 Tab 均为 2 字，改 4 字会破坏布局平衡） |
| 月统计范围 | 明确定义周起始和月范围 | "本月"=本月1日至今日 | **本月=当月1日至今日** |
| 周统计范围 | 保持现有逻辑 | 保持 last 7 days | **保持现有 last 7 days**（与已上线的移动端行为一致） |

## 技术方案

### R1：商品级折扣系统

#### 核心设计

| 决策点 | 方案 | 理由 |
|--------|------|------|
| 数据模型 | `menu_dish` 新增 `discount_rate REAL DEFAULT 1.0` + `is_discount_enabled INTEGER DEFAULT 0` | 与分类级折扣字段命名一致 |
| 优先级规则 | 商品启用折扣 → 用商品折扣；否则 → 用分类折扣（如启用）；否则 → 原价 | 商品级覆盖分类级 |
| 快照机制 | `unit_sell_price_cents` 存折后价（已有机制） | 历史订单不受后续折扣变更影响 |
| 折扣率范围 | 0.01 ~ 1.0（与分类级一致） | 防止 0 折或超过原价 |

#### 数据流

```
下单流程（折扣优先级变更）:
  getDishSnapshot() → 新增返回 dish.discount_rate / dish.is_discount_enabled
  ↓
  tickets.service.createTicket()
    → effectiveRate = dish.is_discount_enabled ? dish.discount_rate
                    : (category.is_discount_enabled ? category.discount_rate : 1.0)
    → effective_price = Math.round(sell_price_cents * effectiveRate)
  ↓
  order_ticket_item.unit_sell_price_cents = effective_price（折后快照）
```

### R2：导航重命名

- PC 侧边栏 `AppSidebar.vue:12`："统计" → "营业统计"
- PC 路由 `router/index.ts:32`：meta.title "统计" → "营业统计"
- 移动端底部导航 `MobileNav.vue:8`：**保持 "统计" 不变**（3 个 Tab 均为 2 字，视觉平衡）
- 移动端页面标题 `MobileStats.vue:54`：已经是 "营业统计"，无需改动

### R3：统计页日/周/月

- PC `Stats.vue`：新增 Segmented Control（今日 / 本周 / 本月）
- Mobile `MobileStats.vue`：现有 pill buttons 增加 "本月"
- 日期计算逻辑：
  - 今日：`today → today`
  - 本周：`today - 7 days → today`（保持现有行为）
  - 本月：`当月1日 → today`
- 后端：无需改动（已支持 `from`/`to` 参数）

## 实施步骤

### Step 1: 数据库迁移 — 菜品折扣字段
- 新建 `server/src/db/migrations/0006_dish_discount.sql`
- 添加 2 个字段到 `menu_dish`：
  - `discount_rate REAL NOT NULL DEFAULT 1.0`
  - `is_discount_enabled INTEGER NOT NULL DEFAULT 0`
- 预期产物：迁移文件，启动时自动执行

### Step 2: 后端类型 & 接口扩展
- 更新 `server/src/shared/types.ts`：Dish 接口新增 `discount_rate`, `is_discount_enabled`
- 更新 `server/src/modules/menu/menu.repo.ts`：
  - `getDishById()` SELECT 新增 `discount_rate`, `is_discount_enabled`
  - `listDishes()` SELECT 新增字段
  - `createDish()` 接受新字段
  - `updateDish()` 支持新字段 patch
- 更新 `server/src/modules/menu/menu.service.ts`：
  - `createDish()` / `updateDish()` 验证 discount_rate 范围 0.01~1.0
- 预期产物：菜品 CRUD API 支持折扣字段

### Step 3: 后端工单折扣优先级逻辑
- 更新 `server/src/modules/tickets/tickets.repo.ts`：
  - `getDishSnapshot()` SELECT 新增 `d.discount_rate AS dish_discount_rate`, `d.is_discount_enabled AS dish_is_discount_enabled`
  - `DishSnapshot` 接口新增 `dish_discount_rate`, `dish_is_discount_enabled`
- 更新 `server/src/modules/tickets/tickets.service.ts`：
  - `createTicket()` 折扣计算改为优先级逻辑：
    ```typescript
    const discountRate = dish.dish_is_discount_enabled
      ? dish.dish_discount_rate
      : (dish.is_discount_enabled ? dish.discount_rate : 1)
    ```
- 预期产物：下单时自动应用商品级 > 分类级折扣

### Step 4: 前端类型 & Store 扩展
- 更新 `web/src/types/index.ts`：Dish 接口新增 `discount_rate`, `is_discount_enabled`
- 更新 `web/src/stores/cart.ts`：
  - `addItem()` 折扣计算改为优先级逻辑（与后端一致）
- 更新 `web/src/stores/menu.ts`：
  - `addDish()` / `updateDish()` 参数扩展
- 预期产物：前端数据层支持商品级折扣

### Step 5: DishCard 折扣显示更新
- 更新 `web/src/components/business/DishCard.vue`：
  - `isDiscounted` computed 改为：商品级折扣启用 → 用商品折扣率；否则 → 用分类折扣率
  - `finalPrice` computed 同步更新
  - 折扣 Tag 显示：商品级折扣用 `error` 类型（红色，"特价X折"），分类级折扣保持 `warning` 类型（橙色，"X折"）
- 预期产物：点餐页面正确显示折扣来源

### Step 6: 菜品管理弹窗增加折扣设置
- 更新 `web/src/views/MenuConfig.vue`：
  - `dishForm` 新增 `discount_rate`, `is_discount_enabled` 字段
  - 弹窗内成本价下方新增"折扣设置"区域：
    - NSwitch "启用商品折扣"
    - NInputNumber 折扣率（0.1~1.0，步长 0.1，仅开关启用时显示）
    - 辅助文字："启用后将覆盖分类折扣"
  - `submitDish()` 提交新字段
  - `openEdit()` 回填折扣字段
  - 菜品列表表格新增"折扣"列（显示生效的折扣率或"-"）
- 预期产物：管理员可设置单个菜品折扣

### Step 7: 导航重命名
- 更新 `web/src/components/layout/AppSidebar.vue:12`：`'统计'` → `'营业统计'`
- 更新 `web/src/router/index.ts:32`：`meta: { title: '统计' }` → `meta: { title: '营业统计' }`
- 预期产物：PC 侧边栏导航 4 字一致

### Step 8: PC 统计页日/周/月 Tab
- 更新 `web/src/views/Stats.vue`：
  - 新增 `activeTab` ref（'today' | 'week' | 'month'）
  - 标题右侧新增 Naive UI Segmented Control（`<n-radio-group>` button 样式）
  - 新增日期计算函数：`todayStr()`, `weekAgoStr()`, `monthStartStr()`
  - `refreshDashboard()` 根据 activeTab 计算 from/to
  - Tab 切换触发数据刷新
- 预期产物：PC 统计页支持日/周/月切换

### Step 9: 移动端统计页增加"本月"
- 更新 `web/src/views/mobile/MobileStats.vue`：
  - `activeTab` 类型扩展为 `'today' | 'week' | 'month'`
  - Tab 列表新增 `{ key: 'month', label: '本月' }`
  - `loadData()` 新增 month 分支：`from = monthStartStr()`
  - 新增 `monthStartStr()` 函数
- 预期产物：移动端统计页支持日/周/月切换

## 关键文件

| 文件 | 操作 | 说明 |
|------|------|------|
| `server/src/db/migrations/0006_dish_discount.sql` | 新建 | 菜品折扣字段迁移 |
| `server/src/shared/types.ts` | 修改 | Dish 接口扩展 |
| `server/src/modules/menu/menu.repo.ts` | 修改 | 菜品 CRUD 支持折扣字段 |
| `server/src/modules/menu/menu.service.ts` | 修改 | 折扣率验证 |
| `server/src/modules/tickets/tickets.repo.ts` | 修改 | getDishSnapshot 扩展 |
| `server/src/modules/tickets/tickets.service.ts` | 修改 | 折扣优先级逻辑 |
| `web/src/types/index.ts` | 修改 | Dish 接口扩展 |
| `web/src/stores/cart.ts` | 修改 | 折扣优先级计算 |
| `web/src/stores/menu.ts` | 修改 | addDish/updateDish 参数 |
| `web/src/components/business/DishCard.vue` | 修改 | 折扣显示优先级 |
| `web/src/views/MenuConfig.vue` | 修改 | 菜品弹窗折扣设置 |
| `web/src/components/layout/AppSidebar.vue` | 修改 | "统计" → "营业统计" |
| `web/src/router/index.ts` | 修改 | 路由 title 更新 |
| `web/src/views/Stats.vue` | 修改 | 日/周/月 Tab |
| `web/src/views/mobile/MobileStats.vue` | 修改 | 增加"本月" Tab |

## 风险与缓解

| 风险 | 缓解措施 |
|------|----------|
| 前后端折扣优先级逻辑不一致 | 两端使用完全相同的 if-else 优先级链；后端为权威（快照价格），前端仅用于显示 |
| 现有菜品迁移后意外打折 | 默认值 `discount_rate=1.0`, `is_discount_enabled=0`，不影响现有数据 |
| 折扣率精度问题 | 使用 `Math.round()` 确保分为整数；discount_rate 存 REAL 精度足够 |
| 移动端 3 个 Tab pill 按钮空间 | 3 个短标签（今日/本周/本月）在 flex 布局中空间充足 |
| 周/月日期边界 | 本周=last 7 days（保持现有），本月=当月1日（明确定义） |

## SESSION_ID（供 /ccg:execute 使用）
- CODEX_SESSION: 019c7151-8163-76c2-b9bb-192d66144281
- GEMINI_SESSION: 762dd13a-79f9-4c44-89a0-b24fdef6f17b
