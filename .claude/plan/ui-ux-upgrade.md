# 📋 实施计划：UI/UX 四项改进

## 任务类型
- [x] 前端 (→ Gemini)
- [ ] 后端 (→ Codex)
- [x] 全栈 (→ 并行)

## 交叉验证摘要

| 维度 | Codex 观点 | Gemini 观点 | 共识 |
|------|-----------|-------------|------|
| 桌位编号 | 后端无需改格式，建议加长度软约束 | 改 placeholder + 帮助文案 | ✅ 一致：前端文案修正为主 |
| 临时加菜 | 顶部按钮，修复临时菜 identity bug | Header 按钮（桌面+移动端） | ✅ 一致：移到 header |
| UI 风格 | Token-first 主题化 + 关键页面先升级 | 暖色渐变 + 毛玻璃三层层次 | ✅ 互补：Gemini 出设计，Codex 出架构 |
| 卡片点击 | 组件参数化 showAddAffordance | 整合 action area + ripple 反馈 | ✅ 一致：去掉独立 "+" 按钮 |
| 额外发现 | 临时菜 dish_id=null 导致数量编辑冲突 | — | ⚠️ Codex 独有发现，需修复 |

## 技术方案

### 设计 Token 体系（Gemini 主导）

```css
/* 全局 CSS 变量 - web/src/style.css */
:root {
  /* 渐变背景 */
  --bg-gradient-from: #FFF9F5;
  --bg-gradient-via: #FFF2E8;
  --bg-gradient-to: #FFECD9;

  /* 毛玻璃 */
  --glass-bg: rgba(255, 255, 255, 0.70);
  --glass-border: rgba(255, 255, 255, 0.40);
  --glass-blur: 12px;

  /* 卡片 */
  --card-bg: rgba(255, 255, 255, 0.90);
  --card-shadow: 0 8px 30px rgba(0, 0, 0, 0.04);
  --card-shadow-hover: 0 20px 50px rgba(251, 146, 60, 0.10);

  /* 主色 */
  --primary: #F97316;
  --primary-light: #FFF7ED;
}
```

### 毛玻璃层次结构

| 层级 | 用途 | 样式 |
|------|------|------|
| L0 基底 | 页面背景 | `bg-gradient-to-br from-[#FFF9F5] via-[#FFF2E8] to-[#FFECD9]` |
| L1 面板 | 侧边栏/导航/header | `bg-white/70 backdrop-blur-md border-white/40` |
| L2 卡片 | DishCard/TableCard | `bg-white/90 backdrop-blur-sm border-white/50 shadow-sm` |
| L3 浮层 | Modal/Drawer/底部栏 | `bg-white/95 backdrop-blur-lg` |

## 实施步骤

### Step 1：建立设计 Token 基座
- 修改 `web/src/style.css`：添加 CSS 变量
- 修改 `web/tailwind.config.ts`：映射设计 token 到 Tailwind
- 修改 `web/src/App.vue`：NConfigProvider 注入 themeOverrides（orange 主题）
- 预期产物：全局可用的设计变量体系

### Step 2：桌位编号自由输入
- 修改 `web/src/views/TableMap.vue:77`：placeholder 改为 "桌位名称（如 包间1、大厅3、VIP）"
- 修改 `web/src/views/TableMap.vue:75`：modal title 改为 "添加桌位"（保持不变）
- 修改 `web/src/components/business/TableCard.vue:29`：去掉硬编码 "号桌"，改为智能显示（纯数字加"号桌"，否则直接显示）
- 修改 `web/src/views/Ordering.vue:63`：同上
- 修改 `web/src/views/mobile/MobileOrdering.vue:62`：同上
- 后端可选：`server/src/modules/tables/tables.service.ts:38` 后加长度上限校验（≤20字符）
- 预期产物：支持任意桌位名称

### Step 3：临时加菜改为 Header 按钮
- 修改 `web/src/views/Ordering.vue`：
  - 移除 grid 中的 `<QuickAddTile>`（L79）
  - 在 header 搜索框旁添加 "临时加菜" 按钮，点击弹出 modal
  - 将 QuickAddTile 的 modal 逻辑内联或提取为 composable
- 修改 `web/src/views/mobile/MobileOrdering.vue`：
  - 移除 grid 中的 `<QuickAddTile>`（L70）
  - 在 header 右侧添加 "+" 图标按钮，点击弹出 modal
- 修改 `web/src/stores/cart.ts`：修复临时菜 identity 问题
  - 临时菜用负时间戳作为唯一 key（当前已有 `id: -Date.now()`）
  - `updateQty` 和 `removeItem` 改为同时支持 `dish_id` 和 `name` 匹配
- 预期产物：临时加菜不占网格位，入口在 header

### Step 4：DishCard 移动端优化
- 修改 `web/src/components/business/DishCard.vue`：
  - 添加 prop `compact?: boolean`（移动端传 true）
  - compact 模式：去掉独立 "+" 圆形按钮，改为整合式 action area
  - 添加点击 ripple/pulse 反馈动画（替代当前 ring 闪烁）
  - 有数量时卡片添加 orange 边框发光效果
- 修改 `web/src/views/mobile/MobileOrdering.vue:71-77`：传入 `compact` prop
- 预期产物：移动端整卡点击更直觉

### Step 5：全局 UI 风格升级 - 核心页面
- 修改 `web/src/views/mobile/MobileHome.vue`：
  - 页面背景改为暖色渐变
  - header 改为毛玻璃效果
- 修改 `web/src/views/mobile/MobileOrdering.vue`：
  - 页面背景改为暖色渐变
  - header + 底部操作栏改为毛玻璃
  - CategoryTabs 改为毛玻璃
- 修改 `web/src/components/business/TableCard.vue`：
  - 卡片样式升级为 L2 层级（glass card）
  - 状态颜色保持但融入新设计语言
- 修改 `web/src/components/business/DishCard.vue`：
  - 卡片样式升级为 L2 层级
- 修改 `web/src/components/layout/MobileNav.vue`：
  - 底部导航改为毛玻璃效果
- 修改 `web/src/components/business/CategoryTabs.vue`：
  - 分类标签改为毛玻璃背景

### Step 6：全局 UI 风格升级 - PC 端页面
- 修改 `web/src/views/TableMap.vue`：渐变背景 + 毛玻璃侧边栏
- 修改 `web/src/views/Ordering.vue`：渐变背景 + 毛玻璃分类栏 + 毛玻璃购物车
- 修改 `web/src/components/business/CartPanel.vue`：毛玻璃面板
- 修改 `web/src/components/layout/AppSidebar.vue`：毛玻璃侧边栏
- 预期产物：PC 端视觉统一

### Step 7：验证与回归
- 桌位名称测试：中文、空格、超长、特殊字符
- 移动端整卡点击体验验证
- 低端机 backdrop-blur 性能检查
- 临时加菜数量编辑正确性
- 购物车抽屉内临时菜显示正确性

## 关键文件

| 文件 | 操作 | 说明 |
|------|------|------|
| `web/src/style.css` | 修改 | 添加 CSS 变量 token |
| `web/tailwind.config.ts` | 修改 | 映射设计 token |
| `web/src/App.vue` | 修改 | NConfigProvider themeOverrides |
| `web/src/views/TableMap.vue:75-77` | 修改 | placeholder 文案 |
| `web/src/components/business/TableCard.vue:29` | 修改 | 智能桌位名显示 |
| `web/src/views/Ordering.vue:63,79` | 修改 | 桌位名 + 移除 QuickAddTile grid |
| `web/src/views/mobile/MobileOrdering.vue:62,70` | 修改 | 桌位名 + 移除 QuickAddTile grid |
| `web/src/components/business/QuickAddTile.vue` | 修改 | 提取 modal 逻辑，组件可能废弃 |
| `web/src/components/business/DishCard.vue` | 修改 | compact prop + 视觉升级 |
| `web/src/stores/cart.ts:29,47` | 修改 | 临时菜 identity 修复 |
| `web/src/views/mobile/MobileHome.vue` | 修改 | 渐变背景 + 毛玻璃 header |
| `web/src/components/layout/MobileNav.vue` | 修改 | 毛玻璃底部导航 |
| `web/src/components/business/CategoryTabs.vue` | 修改 | 毛玻璃分类标签 |
| `web/src/components/business/CartPanel.vue` | 修改 | 毛玻璃购物车面板 |
| `web/src/components/layout/AppSidebar.vue` | 修改 | 毛玻璃侧边栏 |

## 风险与缓解

| 风险 | 缓解措施 |
|------|----------|
| backdrop-blur 在低端安卓机卡顿 | 提供 `@supports not (backdrop-filter)` 降级样式 |
| 毛玻璃上文字对比度不足 | 卡片用 bg-white/90（高不透明度），确保 WCAG AA |
| 临时菜 identity 修复可能影响已有购物车数据 | 清空 localStorage 中的旧 cart 数据 |
| "号桌" 去掉后显示不自然 | 智能判断：纯数字→"X号桌"，含字母/中文→直接显示 |

## SESSION_ID（供 /ccg:execute 使用）
- CODEX_SESSION: 019c6caa-9c76-7553-a994-bd6adf7c9e5d
- GEMINI_SESSION: 1416b8e6-175d-40eb-8cc3-2db8db98d5c4
