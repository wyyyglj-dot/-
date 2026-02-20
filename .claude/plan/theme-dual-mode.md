# 📋 实施计划：深色/浅色双模式主题系统

## 任务类型
- [x] 前端 (→ Gemini)
- [ ] 后端 (→ Codex)
- [ ] 全栈 (→ 并行)

## 交叉验证摘要

| 维度 | Codex 观点 | Gemini 观点 | 共识 |
|------|-----------|-------------|------|
| 切换机制 | `data-theme` 属性 + Pinia store | `data-theme` 属性 + Pinia store | ✅ 完全一致 |
| 按钮对比度根因 | `white/5` 在深色底上仅 1.11:1 | 半透明背景叠加深色表面不可见 | ✅ 一致：语义 token 替换 |
| 浅色配色 | 建议定义 token 表 | "Warm Bistro" 暖奶油色系 | ✅ 互补：采用 Gemini 配色 |
| Glass 适配 | 保持类名，重定义为主题感知变量 | "Frosted White" + 阴影替代边框 | ✅ 互补：合并方案 |
| Aurora 适配 | — | 降低透明度 + 增大模糊 | ✅ Gemini 独有，采纳 |
| Toggle 位置 | — | 桌面侧边栏底部 / 移动端 header | ✅ Gemini 独有，采纳 |
| 防闪烁 | index.html 内联脚本预设 data-theme | body transition 过渡 | ✅ 互补：两者都需要 |
| Tailwind 透明度 | RGB 通道 token 保留 /opacity 语法 | 直接变量映射 | ⚠️ 采用 Codex RGB 方案更灵活 |

## 技术方案

### 架构：`data-theme` + 语义 CSS 变量 + Pinia Store

数据流：
```
ThemeToggle → Pinia(preference) → html[data-theme] → CSS vars → Tailwind/Glass/Aurora
                                                    → App.vue(computed) → Naive UI theme
```

### 双主题 CSS 变量体系

```css
/* ===== 深色模式（默认） ===== */
:root {
  /* 背景层级 */
  --bg-base: #0B0E14;
  --bg-surface: #14171F;
  --bg-card: rgba(30, 41, 59, 0.5);
  --bg-overlay: #1E293B;

  /* 极光色块 */
  --aurora-orange: rgba(249, 115, 22, 0.15);
  --aurora-purple: rgba(139, 92, 246, 0.10);

  /* 毛玻璃 */
  --glass-bg-l1: rgba(15, 23, 42, 0.6);
  --glass-bg-l2: rgba(30, 41, 59, 0.4);
  --glass-bg-l3: rgba(15, 23, 42, 0.9);
  --glass-border-l1: rgba(255, 255, 255, 0.05);
  --glass-border-l2: rgba(255, 255, 255, 0.08);
  --glass-border-l3: rgba(255, 255, 255, 0.10);
  --glass-blur: 12px;

  /* 卡片 */
  --card-shadow: 0 10px 40px -10px rgba(0, 0, 0, 0.5);
  --card-shadow-hover: 0 20px 50px -10px rgba(249, 115, 22, 0.15);

  /* 文字 */
  --text-primary: #F8FAFC;
  --text-secondary: #94A3B8;
  --text-muted: #64748B;  /* 从 #475569 调亮，提升对比度到 ~4.5:1 */

  /* 交互 token（新增） */
  --surface-soft-rgb: 255 255 255;  /* 用于 Tailwind opacity: bg-surface-soft/10 */
  --action-bg: rgba(255, 255, 255, 0.08);
  --action-bg-hover: rgba(255, 255, 255, 0.12);
  --action-border: rgba(255, 255, 255, 0.10);
  --focus-ring: rgba(249, 115, 22, 0.5);

  /* 强调色 */
  --primary: #FB923C;
  --primary-glow: rgba(249, 115, 22, 0.3);

  /* 状态色 */
  --status-idle-bg: rgba(71, 85, 105, 0.2);
  --status-idle-text: #94A3B8;
  --status-dining-bg: rgba(249, 115, 22, 0.15);
  --status-dining-text: #FB923C;
  --status-dining-border: rgba(249, 115, 22, 0.3);
  --status-checkout-bg: rgba(34, 197, 94, 0.15);
  --status-checkout-text: #4ADE80;
  --status-checkout-border: rgba(34, 197, 94, 0.3);
}

/* ===== 浅色模式 "Warm Bistro" ===== */
[data-theme='light'] {
  /* 背景层级 */
  --bg-base: #FDFCFB;
  --bg-surface: #FFF9F5;
  --bg-card: #FFFFFF;
  --bg-overlay: #FFFFFF;

  /* 极光色块（降低透明度） */
  --aurora-orange: rgba(249, 115, 22, 0.06);
  --aurora-purple: rgba(139, 92, 246, 0.04);

  /* 毛玻璃 - "Frosted White" */
  --glass-bg-l1: rgba(255, 255, 255, 0.70);
  --glass-bg-l2: rgba(255, 255, 255, 0.85);
  --glass-bg-l3: rgba(255, 255, 255, 0.92);
  --glass-border-l1: rgba(249, 115, 22, 0.08);
  --glass-border-l2: rgba(249, 115, 22, 0.10);
  --glass-border-l3: rgba(0, 0, 0, 0.06);
  --glass-blur: 12px;

  /* 卡片 */
  --card-shadow: 0 8px 30px rgba(0, 0, 0, 0.04);
  --card-shadow-hover: 0 20px 50px rgba(251, 146, 60, 0.10);

  /* 文字 */
  --text-primary: #1A1C1E;
  --text-secondary: #64748B;
  --text-muted: #94A3B8;

  /* 交互 token */
  --surface-soft-rgb: 0 0 0;
  --action-bg: rgba(0, 0, 0, 0.04);
  --action-bg-hover: rgba(0, 0, 0, 0.08);
  --action-border: rgba(0, 0, 0, 0.08);
  --focus-ring: rgba(249, 115, 22, 0.4);

  /* 强调色（浅色模式稍加饱和） */
  --primary: #F97316;
  --primary-glow: rgba(249, 115, 22, 0.15);

  /* 状态色（浅色模式提高可见度） */
  --status-idle-bg: #F1F5F9;
  --status-idle-text: #64748B;
  --status-dining-bg: #FFF7ED;
  --status-dining-text: #EA580C;
  --status-dining-border: rgba(249, 115, 22, 0.2);
  --status-checkout-bg: #F0FDF4;
  --status-checkout-text: #16A34A;
  --status-checkout-border: rgba(34, 197, 94, 0.2);
}
```

### Naive UI 双主题 Overrides

```typescript
// App.vue - computed theme
const naiveTheme = computed(() =>
  themeStore.resolved === 'dark' ? darkTheme : null
)

const themeOverrides = computed<GlobalThemeOverrides>(() => {
  const isDark = themeStore.resolved === 'dark'
  return {
    common: {
      primaryColor: isDark ? '#FB923C' : '#F97316',
      primaryColorHover: '#F97316',
      primaryColorPressed: '#EA580C',
      primaryColorSuppl: '#FB923C',
      borderRadius: '12px',
      bodyColor: isDark ? '#0B0E14' : '#FDFCFB',
      cardColor: isDark ? 'rgba(30, 41, 59, 0.5)' : '#FFFFFF',
      modalColor: isDark ? '#1E293B' : '#FFFFFF',
      popoverColor: isDark ? '#1E293B' : '#FFFFFF',
      tableColor: 'transparent',
      inputColor: isDark ? 'rgba(30, 41, 59, 0.6)' : '#F8FAFC',
      actionColor: isDark ? 'rgba(30, 41, 59, 0.3)' : 'rgba(0, 0, 0, 0.03)',
      textColorBase: isDark ? '#F8FAFC' : '#1A1C1E',
      textColor1: isDark ? '#F8FAFC' : '#1A1C1E',
      textColor2: isDark ? '#94A3B8' : '#64748B',
      textColor3: isDark ? '#64748B' : '#94A3B8',
      dividerColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)',
      borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)',
    },
    Button: { borderRadiusMedium: '12px' },
    Tabs: { tabFontWeightActive: 'bold' },
    Card: { borderRadius: '16px' },
  }
})
```

### Theme Store 设计

```typescript
// web/src/stores/theme.ts
export const useThemeStore = defineStore('theme', {
  state: () => ({
    preference: 'system' as 'light' | 'dark' | 'system',
  }),
  getters: {
    resolved(): 'light' | 'dark' {
      if (this.preference === 'system') {
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
      }
      return this.preference
    },
  },
  actions: {
    init() {
      this.applyTheme()
      if (this.preference === 'system') {
        window.matchMedia('(prefers-color-scheme: dark)')
          .addEventListener('change', () => this.applyTheme())
      }
    },
    setPreference(mode: 'light' | 'dark' | 'system') {
      this.preference = mode
      this.applyTheme()
    },
    toggle() {
      this.setPreference(this.resolved === 'dark' ? 'light' : 'dark')
    },
    applyTheme() {
      document.documentElement.setAttribute('data-theme', this.resolved)
      document.documentElement.style.colorScheme = this.resolved
    },
  },
  persist: { paths: ['preference'] },
})
```

### 防闪烁内联脚本（index.html）

```html
<script>
;(function() {
  var p = localStorage.getItem('theme') // pinia-plugin-persistedstate key
  try { p = JSON.parse(p).preference } catch(e) { p = null }
  var t = p === 'light' ? 'light' : p === 'dark' ? 'dark'
    : window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  document.documentElement.setAttribute('data-theme', t)
  document.documentElement.style.colorScheme = t
})()
</script>
```

### Toggle UI 位置

- 桌面端：AppSidebar.vue 底部，版本号上方，Sun/Moon 图标按钮
- 移动端：各移动页面 header 右侧，小型 Sun/Moon 图标

## 实施步骤

### Step 1：Theme Store + 防闪烁基础设施
- 新建 `web/src/stores/theme.ts`：Pinia store（preference/resolved/toggle/init）
- 修改 `web/index.html`：添加防闪烁内联脚本
- 修改 `web/src/main.ts`：初始化 theme store
- 预期产物：主题状态管理 + 无闪烁切换基础

### Step 2：CSS 变量双主题体系
- 重写 `web/src/style.css`：
  - `:root` 保留深色变量（当前默认）
  - 新增 `[data-theme='light']` 浅色变量块
  - 新增交互 token（`--action-bg`, `--action-bg-hover`, `--action-border`, `--surface-soft-rgb`）
  - 修正 `--text-muted` 从 `#475569` → `#64748B`（提升对比度）
  - Aurora 效果适配浅色模式（降低透明度 + 增大模糊）
  - Glass 效果适配浅色模式（"Frosted White"）
  - `@supports not` 回退同步适配双主题
- 预期产物：完整的双主题 CSS 变量体系

### Step 3：Tailwind + Naive UI 主题集成
- 修改 `web/tailwind.config.ts`：新增 `surface-soft` RGB 通道映射
- 修改 `web/src/App.vue`：
  - 引入 theme store
  - `naiveTheme` 改为 computed（dark → darkTheme, light → null）
  - `themeOverrides` 改为 computed（根据 resolved 返回对应配色）
- 预期产物：Naive UI 组件自动跟随主题切换

### Step 4：Toggle UI 组件
- 新建 `web/src/components/common/ThemeToggle.vue`：Sun/Moon 图标切换按钮
- 修改 `web/src/components/layout/AppSidebar.vue`：底部添加 ThemeToggle
- 修改移动端页面 header：添加 ThemeToggle（MobileHome/MobileOrdering/MobileServing/MobileStats）
- 预期产物：用户可通过 UI 切换主题

### Step 5：硬编码类批量替换
- 全局替换 `bg-white/5` → `bg-[var(--action-bg)]`
- 全局替换 `bg-white/10` → `bg-[var(--action-bg-hover)]`
- 全局替换 `border-white/5` → `border-[var(--glass-border-l1)]`
- 全局替换 `border-white/10` → `border-[var(--action-border)]`
- 全局替换 `border-white/20` → `border-[var(--glass-border-l3)]`
- 全局替换 `hover:bg-white/5` → `hover:bg-[var(--action-bg)]`
- 全局替换 `hover:bg-white/10` → `hover:bg-[var(--action-bg-hover)]`
- 涉及文件：QuantityStepper, QuickAddTile, DishCard, CartPanel, Checkout, TableMap, Ordering, MobileStats 等
- 预期产物：所有组件主题感知，无硬编码颜色

### Step 6：页面级适配验证
- 逐页检查 TableMap, Ordering, Serving, Stats, Checkout, MenuConfig
- 逐页检查 MobileHome, MobileOrdering, MobileServing, MobileStats
- 确保浅色/深色模式下：
  - 所有按钮可见且对比度达标
  - 卡片边界清晰
  - 状态色可辨识
  - Aurora 背景效果适当
  - Glass 效果在两种模式下都美观
- 预期产物：全页面双主题视觉一致

### Step 7：过渡动画 + 收尾
- 添加 `body` 过渡：`transition: background-color 0.3s ease, color 0.3s ease`
- 验证 `@supports not (backdrop-filter)` 降级在双主题下正确
- 验证 `prefers-reduced-motion` 下动画关闭
- 预期产物：平滑切换体验

## 关键文件

| 文件 | 操作 | 说明 |
|------|------|------|
| `web/src/stores/theme.ts` | 新建 | 主题 Pinia store |
| `web/src/style.css` | 重写 | 双主题 CSS 变量 + 交互 token |
| `web/src/App.vue` | 修改 | computed theme/overrides |
| `web/tailwind.config.ts` | 修改 | 新增 surface-soft RGB 映射 |
| `web/index.html` | 修改 | 防闪烁内联脚本 |
| `web/src/main.ts` | 修改 | 初始化 theme store |
| `web/src/components/common/ThemeToggle.vue` | 新建 | 主题切换按钮 |
| `web/src/components/layout/AppSidebar.vue` | 修改 | 添加 ThemeToggle |
| `web/src/components/common/QuantityStepper.vue` | 修改 | 替换硬编码类 |
| `web/src/components/business/QuickAddTile.vue` | 修改 | 替换硬编码类 |
| `web/src/components/business/DishCard.vue` | 修改 | 替换硬编码类 |
| `web/src/components/business/CartPanel.vue` | 修改 | 替换硬编码类 |
| `web/src/views/Checkout.vue` | 修改 | 替换硬编码类 |
| `web/src/views/TableMap.vue` | 修改 | 替换硬编码类 |
| `web/src/views/Ordering.vue` | 修改 | 替换硬编码类 |
| `web/src/views/mobile/MobileStats.vue` | 修改 | 替换硬编码类 + header toggle |
| `web/src/views/mobile/MobileHome.vue` | 修改 | header toggle |
| `web/src/views/mobile/MobileOrdering.vue` | 修改 | header toggle |
| `web/src/views/mobile/MobileServing.vue` | 修改 | header toggle |

## 风险与缓解

| 风险 | 缓解措施 |
|------|----------|
| 浅色模式下 Glass 效果不明显 | 浅色模式增加 box-shadow 补偿，减少对 backdrop-filter 依赖 |
| 主题切换闪烁 | index.html 内联脚本 + body transition |
| Naive UI 组件未跟随切换 | computed themeOverrides 确保响应式 |
| 硬编码类遗漏 | 迁移完成后 grep 扫描 `white/` 确认无残留 |
| pinia-plugin-persistedstate key 与内联脚本不匹配 | 统一使用 `theme` 作为 store id |

## SESSION_ID（供 /ccg:execute 使用）
- CODEX_SESSION: 019c6ddd-5dbf-7a23-a6ea-95b062252e53
- GEMINI_SESSION: 1055201b-47f7-4069-96c9-67d13a782f8c
