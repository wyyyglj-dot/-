# 实施计划：辣度选择 UI 优化

## 任务类型
- [x] 前端 (→ Gemini)

## 需求概述

1. 移除 DishCard 卡片上的辣椒图标 `🌶️`
2. SpiceRadialMenu 弹窗改为屏幕固定位置（居中），不再跟随触摸点
3. 弹窗增加半透明毛玻璃（frosted glass）效果

## Gemini 分析要点

- **移除图标**：减少视觉噪音，界面更简洁；可发现性由 Sticky 模式指示条和引导提示补偿
- **固定位置**：推荐屏幕居中（`top: 50%; left: 50%`），避免底部栏冲突，桌面/移动端通用
- **毛玻璃效果**：在 SVG 外层包裹 `div` 容器应用 `backdrop-filter: blur()`，不直接在 SVG 元素上应用（跨浏览器兼容性）
- **过渡动画**：`scale(0.9) → scale(1)` + `opacity: 0 → 1`，200-300ms
- **交互更新**：`handleMove` 角度计算需改为相对于屏幕中心点，而非触摸点

## 技术方案

### 核心改动

**固定居中定位**：弹窗不再接收 `x/y` 坐标，改为 CSS `fixed` 居中。角度计算基准点改为 `(window.innerWidth / 2, window.innerHeight / 2)`。

**毛玻璃遮罩层**：全屏 `fixed inset-0` 遮罩，应用 `backdrop-filter: blur(12px)` + `bg-black/20`，点击遮罩区域触发取消。

**入场/退场动画**：Vue `<Transition>` 包裹，scale + opacity 过渡。

## 实施步骤

### Step 1: DishCard.vue - 移除辣椒图标
- 文件：`web/src/components/business/DishCard.vue`
- 操作：删除 L111 的 `<NTag v-if="hasSpiceOption && !isSticky" ...>🌶️</NTag>`
- 预期产物：卡片不再显示辣椒图标

### Step 2: SpiceRadialMenu.vue - 重构定位与毛玻璃
- 文件：`web/src/components/business/SpiceRadialMenu.vue`
- 操作：
  1. 移除 `x`/`y` props，改为固定居中定位
  2. 外层 `div` 改为全屏毛玻璃遮罩（`backdrop-filter: blur(12px)` + `bg-black/20`）
  3. SVG 容器居中：`top: 50%; left: 50%; transform: translate(-50%, -50%)`
  4. `handleMove` 角度计算基准改为 `(window.innerWidth / 2, window.innerHeight / 2)`
  5. 遮罩区域点击触发 `cancel`
  6. 添加入场/退场过渡动画（scale + opacity）
- 预期产物：固定居中 + 毛玻璃效果的辣度选择弹窗

### Step 3: Ordering.vue - 移除坐标传递
- 文件：`web/src/views/Ordering.vue`
- 操作：
  1. `handleOpenSpice` 不再捕获坐标，仅设置 `spiceDish` 和 `spiceMenuVisible`
  2. `SpiceRadialMenu` 组件移除 `:x` `:y` props
  3. 可删除 `spiceMenuPos` ref
- 预期产物：PC 端点餐页适配新弹窗

### Step 4: MobileOrdering.vue - 移除坐标传递
- 文件：`web/src/views/mobile/MobileOrdering.vue`
- 操作：同 Step 3
- 预期产物：移动端点餐页适配新弹窗

## 关键文件

| 文件 | 操作 | 说明 |
|------|------|------|
| `web/src/components/business/DishCard.vue:111` | 修改 | 删除辣椒图标 NTag |
| `web/src/components/business/SpiceRadialMenu.vue` | 修改 | 固定居中 + 毛玻璃 + 动画 |
| `web/src/views/Ordering.vue:114-119,196-202` | 修改 | 移除坐标传递逻辑 |
| `web/src/views/mobile/MobileOrdering.vue:97-102,214-220` | 修改 | 移除坐标传递逻辑 |

## 风险与缓解

| 风险 | 缓解措施 |
|------|----------|
| 移除图标后辣度功能可发现性降低 | Sticky 模式指示条仍在；后续可加首次引导 toast |
| `backdrop-filter` 兼容性 | 已有 `@supports not` 降级方案（style.css:208-212） |
| 固定居中后手势交互变化 | 角度计算改为屏幕中心，扇区大小不变，用户适应成本低 |

## SESSION_ID（供 /ccg:execute 使用）
- GEMINI_SESSION: 172dab12-cf4c-49fe-a01b-8bc4240473a1
