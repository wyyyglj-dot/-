# 📋 实施计划：深色主题 UI 升级

## 任务类型
- [x] 前端 (→ Gemini)
- [ ] 后端 (→ Codex)
- [ ] 全栈 (→ 并行)

## 交叉验证摘要

| 维度 | Codex 观点 | Gemini 观点 | 共识 |
|------|-----------|-------------|------|
| 架构方案 | 混合改造：Naive darkTheme + 语义 token + 渐进替换 | 同意混合方案，建议 data-theme 属性切换 | ✅ 一致：混合改造 |
| 背景效果 | 深色渐变底 + SVG 噪声纹理 + 低透明度光斑 | Aurora 极光效果：模糊色块 + 噪声纹理 | ✅ 互补：渐变 + 模糊光斑 + 噪声 |
| 卡片分隔 | 边框 + 层级底色差 + 轻阴影三件套 | 双边框（内边框 + 顶部高亮）+ 深色投影 | ✅ 互补：合并为完整方案 |
| glass 改造 | 保持类名，重定义为深色语义 | 提供具体 rgba 值和 blur 参数 | ✅ 互补：Codex 出架构，Gemini 出参数 |
| 性能 | 移动端减半 blur，提供 solid 降级 | 移动端减少复杂渐变，增加纯色对比度 | ✅ 一致 |
| 硬编码问题 | 发现 ~55 处浅色硬编码类需替换 | — | ⚠️ Codex 独有发现 |
| Checkout 动态类 | Checkout.vue:63 动态 Tailwind 类拼接有风险 | — | ⚠️ Codex 独有发现 |

## 技术方案

### 深色配色体系（Gemini 主导 + Codex 架构）

```css
/* 全局 CSS 变量 - web/src/style.css */
:root {
  /* 背景层级 */
  --bg-base: #0B0E14;
  --bg-surface: #14171F;
  --bg-card: rgba(30, 41, 59, 0.5);
  --bg-overlay: #1E293B;

  /* 极光背景色块 */
  --aurora-orange: rgba(249, 115, 22, 0.15);
  --aurora-purple: rgba(139, 92, 246, 0.10);

  /* 毛玻璃 - 深色版 */
  --glass-bg-l1: rgba(15, 23, 42, 0.6);
  --glass-bg-l2: rgba(30, 41, 59, 0.4);
  --glass-bg-l3: rgba(15, 23, 42, 0.9);
  --glass-border-l1: rgba(255, 255, 255, 0.05);
  --glass-border-l2: rgba(255, 255, 255, 0.08);
  --glass-border-l3: rgba(255, 255, 255, 0.10);

  /* 卡片 */
  --card-shadow: 0 10px 40px -10px rgba(0, 0, 0, 0.5);
  --card-shadow-hover: 0 20px 50px -10px rgba(249, 115, 22, 0.15);

  /* 文字 */
  --text-primary: #F8FAFC;
  --text-secondary: #94A3B8;
  --text-muted: #475569;

  /* 强调色 */
  --primary: #FB923C;
  --primary-glow: rgba(249, 115, 22, 0.3);

  /* 状态色 - 深色适配 */
  --status-idle-bg: rgba(71, 85, 105, 0.2);
  --status-idle-text: #94A3B8;
  --status-dining-bg: rgba(249, 115, 22, 0.15);
  --status-dining-text: #FB923C;
  --status-dining-border: rgba(249, 115, 22, 0.3);
  --status-checkout-bg: rgba(34, 197, 94, 0.15);
  --status-checkout-text: #4ADE80;
  --status-checkout-border: rgba(34, 197, 94, 0.3);
}
```

### 毛玻璃层次结构（深色版）

| 层级 | 用途 | 背景 | 模糊 | 边框 |
|------|------|------|------|------|
| L0 基底 | 页面背景 | `#0B0E14` + 极光色块 + 噪声纹理 | — | — |
| L1 面板 | 侧边栏/导航/header | `rgba(15, 23, 42, 0.6)` | 12px | `rgba(255,255,255,0.05)` |
| L2 卡片 | DishCard/TableCard | `rgba(30, 41, 59, 0.4)` | 8px | `rgba(255,255,255,0.08)` + 顶部高亮 |
| L3 浮层 | Modal/Drawer/底部栏 | `rgba(15, 23, 42, 0.9)` | 16px | `rgba(255,255,255,0.10)` |

### 极光背景效果

在 `#0B0E14` 基底上叠加：
1. 2-3 个大尺寸模糊色块（橙色 + 紫色），`blur(100px)`，缓慢位移动画
2. SVG 噪声纹理层（极低透明度），消除大面积纯色的廉价感
3. 整体效果类似暗色仪表盘的炫酷背景

### Naive UI 深色主题集成

```typescript
// web/src/App.vue
import { darkTheme } from 'naive-ui'

const themeOverrides: GlobalThemeOverrides = {
  common: {
    primaryColor: '#FB923C',
    primaryColorHover: '#F97316',
    primaryColorPressed: '#EA580C',
    primaryColorSuppl: '#FB923C',
    borderRadius: '12px',
    bodyColor: '#0B0E14',
    cardColor: 'rgba(30, 41, 59, 0.5)',
    modalColor: '#1E293B',
    popoverColor: '#1E293B',
    tableColor: 'transparent',
    inputColor: 'rgba(30, 41, 59, 0.6)',
    actionColor: 'rgba(30, 41, 59, 0.3)',
    textColorBase: '#F8FAFC',
    textColor1: '#F8FAFC',
    textColor2: '#94A3B8',
    textColor3: '#475569',
    dividerColor: 'rgba(255, 255, 255, 0.06)',
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  Button: { borderRadiusMedium: '12px' },
  Tabs: { tabFontWeightActive: 'bold' },
  Card: { borderRadius: '16px' },
}
```

## 实施步骤

### Step 1：建立深色 Token 基座
- 修改 `web/src/style.css`：替换所有 CSS 变量为深色配色
- 重定义 `glass-l1/l2/l3` utility classes 为深色语义
- 添加极光背景 utility class（`.bg-aurora`）
- 添加 SVG 噪声纹理 utility class
- 修正 `@supports not (backdrop-filter)` 回退为深色（当前回退白色会穿帮）
- 预期产物：全局深色变量体系

### Step 2：Tailwind + Naive UI 深色配置
- 修改 `web/tailwind.config.ts`：映射深色 token 到 Tailwind（`bg-base`, `bg-surface`, `text-primary`, `text-secondary`, `border-glass` 等）
- 修改 `web/src/App.vue`：引入 `darkTheme`，配置深色 `themeOverrides`
- 预期产物：Naive UI 组件自动深色化，Tailwind 语义类可用

### Step 3：极光背景效果实现
- 在 `web/src/style.css` 添加极光背景 CSS（模糊色块 + 噪声纹理 + 缓慢动画）
- 创建可复用的背景容器样式
- 预期产物：炫酷的深色背景效果

### Step 4：PC 端导航升级 - AppSidebar
- 修改 `web/src/components/layout/AppSidebar.vue`：
  - 背景改为深色 glass-l1
  - 替换 `text-orange-600` → 使用 CSS 变量
  - 替换 `text-gray-400/300` → `text-secondary/text-muted`
  - 替换 `border-b/border-t` → 深色边框
  - 菜单选中态：左侧发光条 + 背景微亮
- 预期产物：PC 侧边栏深色化

### Step 5：移动端导航升级 - MobileNav
- 修改 `web/src/components/layout/MobileNav.vue`：
  - 背景改为深色 glass-l3
  - 替换 `text-gray-400` → `text-secondary`
  - 上边缘微光分隔（`border-t border-white/5`）
- 预期产物：移动端底部导航深色化

### Step 6：核心卡片组件升级
- 修改 `web/src/components/business/TableCard.vue`：
  - 替换 glass-l2 为深色版
  - 状态颜色改用 CSS 变量（idle/dining/checkout）
  - 添加顶部高亮边框（`border-t border-white/10`）
  - 替换所有硬编码浅色类（`bg-orange-50`, `bg-green-50`, `bg-gray-50`, `text-gray-400/600`）
- 修改 `web/src/components/business/DishCard.vue`：
  - 替换 glass-l2 为深色版
  - 替换 `text-gray-800` → `text-primary`
  - 替换 `border-gray-200/60` → `border-glass`
  - 选中态改为橙色内发光
  - `+` 按钮深色适配
- 修改 `web/src/components/business/ServingItem.vue`：
  - 替换 `bg-white` → 深色卡片背景
  - 替换 `bg-orange-100/border-orange-200` → 深色状态色
  - 替换 `text-gray-*` 系列
- 修改 `web/src/components/business/CartPanel.vue`：
  - 替换 glass-l3 为深色版
  - 替换 `bg-orange-50/30` → 深色底部区域
  - 替换 `text-gray-500` → `text-secondary`
- 预期产物：所有业务卡片深色化，边框清晰

### Step 7：PC 端页面升级
- 修改 `web/src/views/TableMap.vue`：
  - `bg-warm-gradient` → `bg-aurora`（极光背景）
  - glass-l1 侧边栏深色化
  - 替换 `text-gray-*`、`bg-gray-200/bg-orange-200/bg-green-200` 状态指示器
- 修改 `web/src/views/Ordering.vue`：
  - `bg-warm-gradient` → `bg-aurora`
  - header glass-l1 深色化
  - 分类侧栏深色化（选中态：橙色填充保留）
  - 替换 `hover:bg-white/50` → `hover:bg-white/5`
- 修改 `web/src/views/Serving.vue`：
  - `bg-gray-50` → `bg-aurora`
  - 添加深色侧边栏样式
- 修改 `web/src/views/Stats.vue`：
  - `bg-gray-50` → `bg-aurora`
  - `n-card` 组件自动跟随 Naive darkTheme
  - 替换 `text-gray-*` 系列
- 修改 `web/src/views/MenuConfig.vue`：
  - `bg-gray-50` → `bg-aurora`
  - `n-data-table` 自动跟随 Naive darkTheme
- 修改 `web/src/views/Checkout.vue`：
  - `bg-gray-50` → `bg-aurora`
  - 修复动态 Tailwind 类拼接（L63）为静态类映射
  - 替换 `bg-orange-50` → 深色状态背景
  - 替换 `hover:bg-gray-50` → `hover:bg-white/5`
- 预期产物：所有 PC 页面深色化 + 极光背景

### Step 8：移动端页面升级
- 修改 `web/src/views/mobile/MobileHome.vue`：
  - `bg-warm-gradient` → `bg-aurora`
  - header glass-l1 深色化
  - 替换 `text-gray-400` → `text-secondary`
- 修改 `web/src/views/mobile/MobileOrdering.vue`：
  - `bg-warm-gradient` → `bg-aurora`
  - header/底部操作栏深色化
  - CategoryTabs 深色适配
- 修改 `web/src/views/mobile/MobileServing.vue`：
  - `bg-gray-100` → `bg-aurora`
  - `bg-white` header → 深色 glass-l1
  - 替换硬编码浅色类
- 修改 `web/src/views/mobile/MobileStats.vue`：
  - `bg-gray-100` → `bg-aurora`
  - `bg-white` 卡片 → 深色卡片背景
  - 替换所有 `text-gray-*`、`bg-gray-200`、`bg-white` 硬编码
  - `border-b-4 border-orange-500` 保留（深色下效果更好）
- 预期产物：所有移动端页面深色化

### Step 9：辅助组件深色适配
- 检查并修改 `web/src/components/business/CategoryTabs.vue`：深色适配
- 检查并修改 `web/src/components/common/QuantityStepper.vue`：深色适配
- 检查并修改 `web/src/components/common/PriceDisplay.vue`：深色适配
- 预期产物：所有辅助组件一致深色化

### Step 10：验证与回归
- 所有页面视觉一致性检查（无浅色穿帮）
- 卡片/区块边框清晰度验证
- 极光背景效果验证
- 导航栏深色效果验证
- 状态颜色可读性验证（空闲/就餐/待结账）
- 移动端滚动性能检查（backdrop-filter）
- `@supports not (backdrop-filter)` 降级验证
- Naive UI 组件（Modal/Drawer/DataTable/Card）深色一致性

## 关键文件

| 文件 | 操作 | 说明 |
|------|------|------|
| `web/src/style.css` | 重写 | 深色 CSS 变量 + 极光背景 + 噪声纹理 |
| `web/tailwind.config.ts` | 修改 | 映射深色语义 token |
| `web/src/App.vue` | 修改 | 引入 darkTheme + 深色 themeOverrides |
| `web/src/components/layout/AppSidebar.vue` | 修改 | 深色侧边栏 |
| `web/src/components/layout/MobileNav.vue` | 修改 | 深色底部导航 |
| `web/src/components/business/TableCard.vue` | 修改 | 深色卡片 + 状态色适配 |
| `web/src/components/business/DishCard.vue` | 修改 | 深色卡片 + 选中态 |
| `web/src/components/business/ServingItem.vue` | 修改 | 深色列表项 |
| `web/src/components/business/CartPanel.vue` | 修改 | 深色购物车面板 |
| `web/src/views/TableMap.vue` | 修改 | 极光背景 + 深色化 |
| `web/src/views/Ordering.vue` | 修改 | 极光背景 + 深色化 |
| `web/src/views/Serving.vue` | 修改 | 极光背景 + 深色化 |
| `web/src/views/Stats.vue` | 修改 | 极光背景 + 深色化 |
| `web/src/views/MenuConfig.vue` | 修改 | 极光背景 + 深色化 |
| `web/src/views/Checkout.vue` | 修改 | 极光背景 + 修复动态类 |
| `web/src/views/mobile/MobileHome.vue` | 修改 | 极光背景 + 深色化 |
| `web/src/views/mobile/MobileOrdering.vue` | 修改 | 极光背景 + 深色化 |
| `web/src/views/mobile/MobileServing.vue` | 修改 | 极光背景 + 深色化 |
| `web/src/views/mobile/MobileStats.vue` | 修改 | 极光背景 + 深色化 |

## 风险与缓解

| 风险 | 缓解措施 |
|------|----------|
| ~55 处硬编码浅色类遗漏 | 逐文件 grep 检查 `bg-white`, `bg-gray`, `text-gray`, `border-gray` |
| Naive UI 组件与自定义深色不一致 | darkTheme 基础 + themeOverrides 精细覆盖 |
| backdrop-filter 回退穿帮 | @supports 回退改为深色实底 |
| 移动端 blur 性能 | 固定元素减半 blur，提供 solid 降级 |
| Checkout.vue 动态类失效 | 改为静态类映射对象 |
| 深色下橙/绿状态色对比度不足 | 使用高饱和度暗底 + 亮色文字/边框 |

## SESSION_ID（供 /ccg:execute 使用）
- CODEX_SESSION: 019c6db1-a64d-75f2-97fa-97e2f801d51c
- GEMINI_SESSION: 8aea5667-4e4a-422c-bea5-a00ca9f5f5bd
