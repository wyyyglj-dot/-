# 📋 实施计划：移动端 UI/UX 优化

## 任务类型
- [x] 前端 (→ Gemini)

## 技术方案

综合 Gemini Analyzer + Architect 双模型分析，采用以下方案：

### 方案概述
1. **TableCard "查看详情"** → 全宽渐变色底部行，44px 触摸目标
2. **MobileOrdering 页面** → 修复 sticky 重叠 + 内容区铺满
3. **移动端全局布局** → 统一 flex-col 布局模式 + safe-area 适配

---

## 实施步骤

### Step 1: 新增 CSS 工具类 (style.css)

**文件**: `web/src/style.css`
**操作**: 在 `@layer utilities` 中新增

```css
/* 卡片渐变底栏 */
.card-footer-gradient {
  background: linear-gradient(to top, rgba(var(--primary-rgb), 0.12) 0%, transparent 100%);
}
[data-theme='light'] .card-footer-gradient {
  background: linear-gradient(to top, rgba(var(--primary-rgb), 0.08) 0%, transparent 100%);
}
```

同时需要在 `:root` 和 `[data-theme='light']` 中新增 `--primary-rgb` 变量：
- `:root` → `--primary-rgb: 251, 146, 60;` (对应 #FB923C)
- `[data-theme='light']` → `--primary-rgb: 249, 115, 22;` (对应 #F97316)

### Step 2: 改造 TableCard "查看详情" (TableCard.vue)

**文件**: `web/src/components/business/TableCard.vue`
**操作**: 修改

**变更说明**:
1. 删除原有 `<button>` (L65-L70)
2. 在卡片根 `<div>` 内、`<n-modal>` 之前，新增全宽底部行：

```vue
<!-- 查看详情 - 全宽渐变底栏 -->
<div
  v-if="table.status !== 'idle' && table.dishes.length > 3"
  class="mt-2 -mx-5 -mb-5 h-11 flex items-center justify-center gap-1.5
         card-footer-gradient rounded-b-[var(--radius-lg)]
         cursor-pointer transition-all duration-200
         active:scale-[0.97] active:opacity-80
         hover:brightness-110"
  @click.stop="showDetails = true"
>
  <span class="text-xs font-medium text-[var(--primary)]">
    查看详情
  </span>
  <span class="text-[10px] text-[var(--primary)] opacity-60">
    (共{{ table.dishes.length }}项)
  </span>
  <span class="text-sm text-[var(--primary)] opacity-50">›</span>
</div>
```

**设计要点**:
- `h-11` = 44px，符合 Apple HIG 最小触摸目标
- `-mx-5 -mb-5` 负边距撑满卡片宽度并贴底
- `rounded-b-[var(--radius-lg)]` 底部圆角与卡片一致
- `card-footer-gradient` 从下往上渐变（primary 色调 → 透明）
- `active:scale-[0.97]` 点击反馈
- `@click.stop` 阻止冒泡到卡片的导航事件

### Step 3: 修复 MobileOrdering 页面布局 (MobileOrdering.vue)

**文件**: `web/src/views/mobile/MobileOrdering.vue`
**操作**: 修改

**变更 3a - 根容器升级**:
```vue
<!-- 原: class="min-h-screen bg-aurora flex flex-col" -->
<!-- 新: 使用 100dvh 适配移动端动态视口 -->
<div class="min-h-[100dvh] bg-aurora flex flex-col">
```

**变更 3b - Header 固定高度**:
```vue
<!-- 原: class="p-4 glass-l1 border-b ... sticky top-0 z-20" -->
<!-- 新: h-14 固定高度 + z-30 确保在 CategoryTabs 之上 -->
<header class="flex-none h-14 px-4 glass-l1 border-b border-[var(--glass-border-l1)]
               flex items-center justify-between sticky top-0 z-30">
```
- `flex-none` 防止被 flex 压缩
- `h-14` = 56px 固定高度
- z-30 高于 CategoryTabs 的 z-20

**变更 3c - CategoryTabs sticky 偏移**:

经确认 CategoryTabs 仅在 MobileOrdering 中使用，可直接修改：

**文件**: `web/src/components/business/CategoryTabs.vue`
```vue
<!-- 原: class="glass-l1 sticky top-0 z-30 ..." -->
<!-- 新: top-14 对应 header 的 h-14，z-20 低于 header -->
<div class="glass-l1 sticky top-14 z-20 border-b border-[var(--glass-border-l1)]">
```

**变更 3d - 内容区铺满（关键修复）**:

Naive UI 的 `n-spin` 内部会渲染额外的 wrapper div，直接加 `flex-1` 无法正确传递。
解决方案：用外层 div 承接 flex-1，通过 `content-style` prop 让 n-spin 内容撑满：

```vue
<!-- 原: -->
<n-spin :show="loading" class="flex-1">
  <div class="p-3 grid grid-cols-2 gap-3 pb-32 flex-1">

<!-- 新: -->
<div class="flex-1 min-h-0">
  <n-spin :show="loading" :content-style="{ minHeight: '100%' }">
    <div class="p-3 grid grid-cols-2 gap-3 pb-24 min-h-full content-start">
      <!-- content-start: grid 项从顶部对齐，不会居中分散 -->
      <!-- pb-24: 精确匹配底部购物车栏高度 -->
    </div>
  </n-spin>
</div>
```

**设计要点**:
- 外层 `div.flex-1.min-h-0` 承接 flex 布局，填满剩余空间
- `n-spin` 的 `:content-style="{ minHeight: '100%' }"` 确保内部内容区撑满
- 内层 grid 的 `min-h-full content-start` 确保菜品少时也铺满背景，且从顶部排列
- `pb-24`（96px）替代 `pb-32`（128px），更精确匹配底部固定栏（~72px + 安全边距）

### Step 4: 统一移动端页面布局

**统一模式**:
```
min-h-[100dvh] flex flex-col bg-aurora
  → header (flex-none, sticky)
  → main content (flex-1, overflow-y-auto)
  → spacer for bottom nav (pb-20 或动态计算)
  → MobileNav (fixed bottom)
```

**文件 4a**: `web/src/views/mobile/MobileHome.vue`
```vue
<!-- 原: class="min-h-screen bg-aurora pb-20" -->
<!-- 新: -->
<div class="min-h-[100dvh] flex flex-col bg-aurora">
  <header class="flex-none p-4 glass-l1 sticky top-0 z-10 ...">...</header>
  <div class="flex-1 p-3 grid grid-cols-2 gap-4 pb-20 content-start">
    <!-- content-start 确保 grid 从顶部开始 -->
  </div>
  <MobileNav />
</div>
```

**文件 4b**: `web/src/views/mobile/MobileStats.vue`
```vue
<!-- 原: class="min-h-screen bg-aurora pb-20" -->
<!-- 新: -->
<div class="min-h-[100dvh] flex flex-col bg-aurora">
  <header class="flex-none p-4 glass-l1 ...">...</header>
  <div class="flex-1 overflow-y-auto">
    <!-- tabs + content -->
    <div class="px-4 pt-2 pb-0">...</div>
    <div class="p-4 space-y-4 pb-20">...</div>
  </div>
  <MobileNav />
</div>
```

**文件 4c**: `web/src/views/mobile/MobileServing.vue`
```vue
<!-- 原: class="min-h-screen bg-aurora pb-20" -->
<!-- 新: -->
<div class="min-h-[100dvh] flex flex-col bg-aurora">
  <header class="flex-none p-4 glass-l1 sticky top-0 z-10 ...">...</header>
  <div class="flex-1 overflow-y-auto pb-20">
    <ServingQueue />
  </div>
  <MobileNav />
</div>
```

---

## 关键文件

| 文件 | 操作 | 说明 |
|------|------|------|
| [style.css](web/src/style.css) | 修改 | 新增 `--primary-rgb` 变量 + `card-footer-gradient` 工具类 |
| [TableCard.vue](web/src/components/business/TableCard.vue):L65-L70 | 修改 | 替换小按钮为全宽渐变底栏 |
| [MobileOrdering.vue](web/src/views/mobile/MobileOrdering.vue):L83-L106 | 修改 | 根容器 dvh + header 固定高度 + n-spin wrapper + 内容铺满 |
| [CategoryTabs.vue](web/src/components/business/CategoryTabs.vue):L10 | 修改 | sticky top-14 z-20（仅在 MobileOrdering 使用，无桌面端影响） |
| [MobileHome.vue](web/src/views/mobile/MobileHome.vue):L60 | 修改 | 统一 flex-col 布局 |
| [MobileStats.vue](web/src/views/mobile/MobileStats.vue):L52 | 修改 | 统一 flex-col 布局 |
| [MobileServing.vue](web/src/views/mobile/MobileServing.vue):L27 | 修改 | 统一 flex-col 布局 |

## 风险与缓解

| 风险 | 缓解措施 |
|------|----------|
| `100dvh` 兼容性 | 回退到 `min-h-screen`，dvh 在 iOS 15.4+/Chrome 108+ 支持 |
| 渐变底栏负边距在不同卡片状态下的表现 | 仅在 `dishes.length > 3` 且非 idle 时显示，已有条件守卫 |
| `--primary-rgb` 新变量需要同步到两个主题 | 在 Step 1 中同时修改 `:root` 和 `[data-theme='light']` |
| n-spin 内部结构变化（Naive UI 升级） | 使用官方 `content-style` prop 而非 CSS hack，兼容性更好 |

## SESSION_ID（供 /ccg:execute 使用）
- GEMINI_SESSION (Analyzer): ed355dff-a45a-4b89-9a6d-5cb515908569
- GEMINI_SESSION (Architect): 23d4b4cc-d0e7-483e-aa78-634bd8cc4af6
