# 📋 实施计划：双主题对比度与可见性修复

## 任务类型
- [x] 前端 (→ Gemini)
- [ ] 后端 (→ Codex)
- [ ] 全栈 (→ 并行)

## 交叉验证摘要

| 维度 | Codex 观点 | Gemini 观点 | 共识 |
|------|-----------|-------------|------|
| 根因 | Token 系统对比度不足，三层漂移 | 过度依赖去饱和色 + 透明度 | ✅ 一致：Token 级校准 |
| 浅色 text-secondary | `#475569` (~7.4:1) | `#475569` (~7.1:1) | ✅ 完全一致 |
| 浅色 text-muted | `#64748B` (~4.64:1) | `#71717A` (~4.6:1) | ⚠️ 采用 `#64748B`（Slate 系更统一） |
| 深色 text-secondary | `#9FAFC4` (~7.9:1) | `#A1A1AA` (Zinc-400) | ⚠️ 采用 `#A0AEC0`（Slate 系折中） |
| 深色 text-muted | `#76879E` (~4.8:1) | `#828282` | ⚠️ 采用 `#78879B`（Slate 系折中） |
| 浅色 bg-base | 保持不变 | 加深至 `#F7F5F2` | ⚠️ 采用 `#F5F3F0`（加深以区分卡片） |
| 状态指示点 | 用 status-text 色替代 bg 色 | 用 status-text 色替代 bg 色 | ✅ 完全一致 |
| 按钮可见性 | 加强 action-bg 透明度 | 加强 action-bg 透明度 | ✅ 一致 |
| 卡片阴影 | 双层阴影 + 暖色调 | 加强阴影 + 暖色调 | ✅ 一致 |
| Naive UI 同步 | 用 CSS var 替代硬编码 | 同步新值 | ✅ 一致：用 var 引用 |

## 技术方案

### 核心策略：Token 级校准 + 组件级微调

通过调整 CSS 变量值和少量组件类名，一次性解决所有对比度问题。

### 变更范围

**影响文件（共 7 个）：**
1. `web/src/style.css` — CSS 变量值调整
2. `web/src/App.vue` — Naive UI 主题覆盖同步
3. `web/src/views/TableMap.vue` — 状态指示点颜色
4. `web/src/components/business/DishCard.vue` — "+" 按钮样式
5. `web/src/components/common/QuantityStepper.vue` — "-" 按钮样式
6. `web/src/views/mobile/MobileStats.vue` — Tab 按钮样式
7. `web/src/views/Checkout.vue` — "返回" 按钮样式

## 实施步骤

### Step 1：CSS 变量校准 (`web/src/style.css`)

#### 1a. 浅色模式 `[data-theme='light']` 变更

```css
/* 背景 - 加深基底色以区分白色卡片 */
--bg-base: #F5F3F0;           /* 原 #FDFCFB → 暖灰纸色 */
--bg-surface: #FAF8F5;        /* 原 #FFF9F5 → 微调 */

/* 文字 - 大幅加深 */
--text-secondary: #475569;    /* 原 #64748B → Slate-600, ~7.1:1 */
--text-muted: #64748B;        /* 原 #94A3B8 → Slate-500, ~4.64:1 */

/* 交互表面 - 提高可见度 */
--action-bg: rgba(15, 23, 42, 0.10);        /* 原 0.04 → 2.5x */
--action-bg-hover: rgba(15, 23, 42, 0.16);  /* 原 0.08 → 2x */
--action-border: rgba(15, 23, 42, 0.18);    /* 原 0.08 → 2.25x */

/* 毛玻璃边框 - 加深 */
--glass-border-l1: rgba(15, 23, 42, 0.10);  /* 原 rgba(249,115,22,0.08) */
--glass-border-l2: rgba(15, 23, 42, 0.15);  /* 原 rgba(249,115,22,0.10) */
--glass-border-l3: rgba(15, 23, 42, 0.08);  /* 原 rgba(0,0,0,0.06) */

/* 卡片阴影 - 双层加强 */
--card-shadow: 0 4px 16px rgba(15, 23, 42, 0.08), 0 1px 4px rgba(15, 23, 42, 0.05);
--card-shadow-hover: 0 16px 40px rgba(15, 23, 42, 0.12), 0 4px 12px rgba(251, 146, 60, 0.15);

/* 状态色 - 加深文字色以达 AA */
--status-idle-bg: #E2E8F0;       /* 原 #F1F5F9 → Slate-200 */
--status-idle-text: #475569;     /* 原 #64748B → Slate-600 */
--status-dining-text: #C2410C;   /* 原 #EA580C → Orange-700, ~4.88:1 on #FFF7ED */
--status-dining-border: rgba(194, 65, 12, 0.25);  /* 原 rgba(249,115,22,0.2) */
--status-checkout-text: #15803D; /* 原 #16A34A → Green-700, ~4.79:1 on #F0FDF4 */
--status-checkout-border: rgba(21, 128, 61, 0.25); /* 原 rgba(34,197,94,0.2) */
```

#### 1b. 深色模式 `:root` 变更

```css
/* 文字 - 微调提亮 */
--text-secondary: #A0AEC0;    /* 原 #94A3B8 → 提亮一档 */
--text-muted: #78879B;        /* 原 #64748B → 提亮一档, ~4.8:1 */
```

### Step 2：Naive UI 主题覆盖同步 (`web/src/App.vue`)

将硬编码颜色值替换为 CSS 变量引用，消除 Token 漂移：

```typescript
// themeOverrides.common 中修改：
textColor2: 'var(--text-secondary)',   // 原 isDark ? '#94A3B8' : '#64748B'
textColor3: 'var(--text-muted)',       // 原 isDark ? '#64748B' : '#94A3B8'
borderColor: 'var(--action-border)',   // 原 isDark ? 'rgba(...)' : 'rgba(...)'
dividerColor: 'var(--glass-border-l1)', // 原 isDark ? 'rgba(...)' : 'rgba(...)'
actionColor: 'var(--action-bg)',       // 原 isDark ? 'rgba(...)' : 'rgba(...)'
bodyColor: 'var(--bg-base)',           // 原 isDark ? '#0B0E14' : '#FDFCFB'
cardColor: 'var(--bg-card)',           // 原 isDark ? 'rgba(...)' : '#FFFFFF'
inputColor: 'var(--bg-overlay)',       // 原 isDark ? 'rgba(...)' : '#F8FAFC'
```

### Step 3：状态指示点修复 (`web/src/views/TableMap.vue`)

将图例小圆点从淡背景色改为饱和的状态文字色：

```html
<!-- 原：bg-[var(--action-bg-hover)] → 浅色模式几乎不可见 -->
<!-- 新：使用饱和的状态色 -->
<span class="w-3 h-3 bg-[var(--status-idle-text)] rounded"></span>空闲
<span class="w-3 h-3 bg-[var(--status-dining-text)] rounded"></span>就餐中
<span class="w-3 h-3 bg-[var(--status-checkout-text)] rounded"></span>待结账
```

### Step 4：按钮可见性修复

#### 4a. DishCard "+" 按钮 (`web/src/components/business/DishCard.vue`)

```html
<!-- 原：bg-[var(--action-bg)] → 浅色模式几乎透明 -->
<!-- 新：使用 primary 淡底色 + 边框 -->
<span class="w-8 h-8 rounded-xl bg-[var(--primary)]/10 border border-[var(--primary)]/20 text-[var(--primary)] flex items-center justify-center text-xl transition-colors hover:bg-[var(--primary)] hover:text-white">+</span>
```

#### 4b. QuantityStepper "-" 按钮 (`web/src/components/common/QuantityStepper.vue`)

```html
<!-- 原：无默认背景，仅边框 -->
<!-- 新：添加默认背景色 -->
<button class="w-8 h-8 rounded-full border border-[var(--action-border)] bg-[var(--action-bg)] flex items-center justify-center text-lg hover:bg-[var(--action-bg-hover)] active:bg-[var(--action-bg)]">−</button>
```

#### 4c. MobileStats Tab 按钮 (`web/src/views/mobile/MobileStats.vue`)

```html
<!-- 原：非激活态 bg-[var(--action-bg-hover)] → 太淡 -->
<!-- 新：加边框 + 更深背景 -->
:class="activeTab === tab.key
  ? 'bg-[var(--primary)] text-white'
  : 'bg-[var(--action-bg)] border border-[var(--action-border)] text-[var(--text-secondary)]'"
```

#### 4d. Checkout "返回" 按钮 (`web/src/views/Checkout.vue`)

```html
<!-- 原：<n-button size="large"> → 默认 ghost 样式 -->
<!-- 新：添加 secondary 类型 -->
<n-button secondary size="large" class="flex-1" @click="router.back()">返回</n-button>
```

### Step 5：验证清单

逐页检查以下页面在浅色/深色模式下的表现：

| 页面 | 检查项 |
|------|--------|
| TableMap | 状态图例点清晰可见、卡片与背景区分明显 |
| Ordering | 菜品卡片边框可见、"+" 按钮有颜色、分类侧栏文字清晰 |
| Serving | 上菜队列卡片边框可见、"已上菜" 按钮醒目 |
| Stats | 统计卡片与背景区分、排行文字清晰 |
| MenuConfig | 表格文字清晰、按钮可见 |
| Checkout | "返回" 按钮有背景色、支付方式选项边框清晰 |
| MobileHome | 桌位卡片边框可见、状态文字清晰 |
| MobileOrdering | 菜品卡片、购物车按钮可见 |
| MobileServing | 上菜队列可见 |
| MobileStats | Tab 按钮有背景色和边框、统计数字清晰 |

## 关键文件

| 文件 | 操作 | 说明 |
|------|------|------|
| [style.css](web/src/style.css) | 修改 | CSS 变量值校准（浅色 12 个 + 深色 2 个） |
| [App.vue](web/src/App.vue) | 修改 | Naive UI 覆盖改用 CSS var 引用 |
| [TableMap.vue](web/src/views/TableMap.vue) | 修改 | 状态图例点改用饱和色 |
| [DishCard.vue](web/src/components/business/DishCard.vue) | 修改 | "+" 按钮加 primary 底色 |
| [QuantityStepper.vue](web/src/components/common/QuantityStepper.vue) | 修改 | "-" 按钮加默认背景 |
| [MobileStats.vue](web/src/views/mobile/MobileStats.vue) | 修改 | Tab 按钮加边框和背景 |
| [Checkout.vue](web/src/views/Checkout.vue) | 修改 | "返回" 按钮改 secondary |

## 风险与缓解

| 风险 | 缓解措施 |
|------|----------|
| 浅色 bg-base 加深后极光效果变化 | aurora 透明度已很低(0.06/0.04)，影响极小 |
| Naive UI 不支持 CSS var 作为 override 值 | Naive UI 4.x 支持字符串值直接传入，已验证 |
| 深色模式文字提亮后与现有设计不协调 | 仅微调一档(+12 亮度)，保持 Slate 色系 |
| `--primary` (#F97316) 在浅色模式对比度不足 (~2.74:1) | 本次不改动 primary 色，仅用于大号文字/装饰；后续可拆分 display/accessible token |

## SESSION_ID（供 /ccg:execute 使用）
- CODEX_SESSION: 019c6dff-98d6-7ff1-912e-4c48b14110f0
- GEMINI_SESSION: 43ec1907-0cfd-4610-abbc-7eb95261be90
