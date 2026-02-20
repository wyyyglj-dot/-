# 📋 实施计划：UI 视觉升级

## 任务类型
- [x] 前端 (→ Gemini)
- [ ] 后端 (→ Codex)
- [ ] 全栈 (→ 并行)

## Gemini 审计摘要

| 维度 | 评分 | 核心问题 |
|------|------|----------|
| 视觉层级 | 6/10 | 毛玻璃过度使用导致层级模糊，信息堆叠严重 |
| 配色方案 | 7/10 | 状态色 `!bg-` 破坏毛玻璃质感，浅色模式对比度边缘 |
| 间距与布局 | 5/10 | 响应式僵硬（PC 固定4列，移动端拥挤），购物车固定350px |
| 组件设计 | 6/10 | DishCard 无图片显得廉价，animate-ping 与风格不搭，圆角不一致 |
| 动效与交互 | 6/10 | 极光动画可能分心，缺乏页面切换微动效 |
| 排版 | 6/10 | 字体单一无品牌感，价格显示不够醒目 |

## 技术方案

### 核心改进策略：从"技术化实现"到"体验式设计"

数据流：
```
减少透明层滥用 → 锚定视觉支柱 → 优化卡片细节 → 响应式布局 → 微动效润色
```

## 实施步骤

### Step 1：卡片状态表现重构（P0）
- 修改 `web/src/components/business/TableCard.vue:L10-L14`
  - 移除 `!bg-[var(--status-*)]` 强制覆盖
  - 改用顶部 4-6px 状态色条 + `inset box-shadow` 表示状态
  - 保留 glass-l2 毛玻璃质感不被破坏
- 修改 `web/src/style.css`
  - 新增 `.status-bar-idle / .status-bar-dining / .status-bar-checkout` 工具类
- 预期产物：桌位卡片恢复通透感，状态通过色条直观表达

### Step 2：响应式动态网格（P0）
- 修改 `web/src/views/TableMap.vue:L100`
  - `:cols="4"` → 响应式 `cols-2 md:cols-3 lg:cols-4 xl:cols-5`
- 修改 `web/src/views/mobile/MobileHome.vue:L68`
  - 优化 2 列网格间距，长桌名截断处理
- 修改 `web/src/views/Ordering.vue:L108`
  - 菜品网格 `:cols="3"` → 响应式 `cols-2 lg:cols-3 xl:cols-4`
- 修改 `web/src/views/Stats.vue:L33,L55`
  - 统计卡片响应式适配
- 预期产物：PC 超宽屏不空旷，笔记本不拥挤，移动端不溢出

### Step 3：DishCard 排版升级（P1）
- 修改 `web/src/components/business/DishCard.vue`
  - 移除 `animate-ping` 效果 (L31)，改为 `hover:scale-[1.02]` + 微弱 glow 阴影
  - 价格符号 `¥` 缩小 (text-sm)，金额数值加粗放大 (text-2xl font-black)
  - 无图模式下增加分类色块占位或渐变背景
  - "+" 按钮增加 hover 过渡动效
- 预期产物：菜品卡片更精致，价格信息更醒目

### Step 4：圆角与间距规范化（P1）
- 修改 `web/src/style.css`
  - 定义圆角体系：`--radius-sm: 8px; --radius-md: 12px; --radius-lg: 20px`
- 修改 `web/src/App.vue:L33,L48,L50`
  - Naive UI `borderRadius` 统一为 `var(--radius-md)`
  - Card `borderRadius` 统一为 `var(--radius-lg)`
- 全局替换 `rounded-2xl` → 使用统一的圆角变量
- 预期产物：消除 12px vs 16px 的微妙不一致

### Step 5：侧边栏视觉锚定（P1）
- 修改 `web/src/components/layout/AppSidebar.vue:L19`
  - glass-l1 提升不透明度或改为实色背景 + 微弱毛玻璃
  - 增加品牌 logo 区域的视觉重量（更大字号或图标）
- 预期产物：侧边栏成为页面的"视觉支柱"

### Step 6：TableCard 信息折叠（P1）
- 修改 `web/src/components/business/TableCard.vue:L48-L55`
  - 未上菜品 > 3 项时，显示前 3 项 + "等 N 项未上"
  - 悬浮展开完整列表（PC）/ 点击展开（移动端）
- 预期产物：卡片高度稳定，网格整齐

### Step 7：排版与字体优化（P2）
- 修改 `web/src/style.css:L108`
  - 引入 `Inter` 字体用于数字/价格显示
  - 中文字体增加 `"PingFang SC", "Microsoft YaHei"` 优化
- 修改 `web/src/components/common/PriceDisplay.vue`
  - 价格使用 `font-variant-numeric: tabular-nums` 等宽数字
- 预期产物：数字排版更专业，中文阅读更舒适

### Step 8：页面切换动效（P2）
- 修改 `web/src/App.vue`
  - `<router-view>` 包裹 `<Transition>` 组件
  - 添加 fade + slide 过渡动画
- 修改 `web/src/style.css`
  - 新增 `.page-enter-active / .page-leave-active` 过渡类
- 预期产物：页面切换流畅自然

### Step 9：极光动画优化（P2）
- 修改 `web/src/style.css:L129`
  - 降低动画频率：`20s` → `40s`
  - 缩小色块范围：`50vmax` → `35vmax`
  - 增加 `@media (prefers-reduced-motion)` 完全禁用
- 预期产物：背景更克制，不分散注意力

## 关键文件

| 文件 | 操作 | 说明 |
|------|------|------|
| web/src/style.css | 修改 | 新增圆角体系、状态色条、页面过渡、极光优化 |
| web/src/components/business/TableCard.vue | 修改 | 状态色条替代 !bg-，信息折叠 |
| web/src/components/business/DishCard.vue | 修改 | 移除 ping，升级排版，增加 hover 效果 |
| web/src/views/TableMap.vue | 修改 | 响应式网格 |
| web/src/views/Ordering.vue | 修改 | 响应式菜品网格 |
| web/src/views/Stats.vue | 修改 | 响应式统计布局 |
| web/src/views/mobile/MobileHome.vue | 修改 | 移动端间距优化 |
| web/src/components/layout/AppSidebar.vue | 修改 | 视觉锚定 |
| web/src/components/common/PriceDisplay.vue | 修改 | 等宽数字排版 |
| web/src/App.vue | 修改 | 圆角统一、页面过渡 |

## 风险与缓解

| 风险 | 缓解措施 |
|------|----------|
| 圆角全局替换可能遗漏 | 使用 CSS 变量统一管理，逐文件检查 |
| 响应式断点可能影响现有布局 | 先在 TableMap 验证，再推广到其他页面 |
| 字体加载影响首屏性能 | Inter 仅用于数字，按需加载 subset |
| 状态色条在移动端可能不够明显 | 同时保留边框色作为辅助 |

## SESSION_ID（供 /ccg:execute 使用）
- GEMINI_SESSION: f6c2ee1d-6518-4e89-a214-96edce6833e9
