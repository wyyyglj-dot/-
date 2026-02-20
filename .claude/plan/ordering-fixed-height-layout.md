## 📋 实施计划：PC 端点餐页面分类栏与内容区固定高度

### 任务类型
- [x] 前端 (→ Gemini)

### 问题诊断

**根因**（Codex + Gemini 一致结论）：
- Naive UI 的 `n-layout-content` 在嵌套 flex 布局中不会正确约束高度
- CSS flex 子项默认 `min-height: auto`，阻止内容收缩，导致容器随内容撑高
- 外层 `n-layout-content` 缺少显式高度约束（`h-full` / `overflow-hidden`）

### 技术方案

**方案：替换内层 `n-layout-content` 为原生 `<main>` 标签 + flex 约束修复**

核心修改点：
1. 外层 `n-layout-content` 添加 `h-full overflow-hidden` 防止撑高
2. 中间 flex 容器添加 `min-h-0` 允许 flex 子项收缩
3. 内层 `n-layout-content` 替换为 `<main>` 标签，确保可预测的 flex 行为
4. 内层 `<main>` 使用 `flex-1 min-h-0 overflow-y-auto` 实现固定高度 + 内部滚动

### 实施步骤

#### Step 1：修改 `web/src/views/Ordering.vue` 模板

**变更 1a - 外层 `n-layout-content` 添加高度约束**：

```vue
<!-- 原: -->
<n-layout-content class="flex flex-col bg-transparent">

<!-- 新: -->
<n-layout-content class="flex flex-col h-full overflow-hidden bg-transparent">
```

**变更 1b - flex 行容器添加 `min-h-0`**：

```vue
<!-- 原: -->
<div class="flex flex-1 overflow-hidden">

<!-- 新: -->
<div class="flex flex-1 min-h-0 overflow-hidden">
```

**变更 1c - 替换内层 `n-layout-content` 为 `<main>`**：

```vue
<!-- 原: -->
<n-layout-content class="p-6 overflow-y-auto">
  <n-grid x-gap="16" y-gap="16" cols="2 l:3 xl:4" responsive="screen">
    ...
  </n-grid>
</n-layout-content>

<!-- 新: -->
<main class="flex-1 min-h-0 p-6 overflow-y-auto">
  <n-grid x-gap="16" y-gap="16" cols="2 l:3 xl:4" responsive="screen">
    ...
  </n-grid>
</main>
```

#### Step 2：清理未使用的 Naive UI 导入

移除 `NLayoutContent` 的第二次使用（内层已替换为 `<main>`），确认外层仍需要保留。

### 关键文件

| 文件 | 操作 | 说明 |
|------|------|------|
| `web/src/views/Ordering.vue:85-118` | 修改 | 模板布局：外层加约束、内层替换为 `<main>` |

### 验收标准

1. 分类栏（左侧 w-36）高度固定为视口剩余高度，内容溢出时出现纵向滚动条
2. 菜品卡片区（中间）高度固定为视口剩余高度，内容溢出时出现纵向滚动条
3. 右侧购物车面板不受影响
4. 空状态 / 少量菜品 / 大量菜品三种场景均表现正常
5. 页面不出现全局滚动条（仅区域内滚动）

### 风险与缓解

| 风险 | 缓解措施 |
|------|----------|
| Naive UI `n-layout-content` 内部样式覆盖 `h-full` | 使用 `!important` 或 `:deep()` 选择器强制覆盖 |
| 替换 `n-layout-content` 后丢失自定义滚动条样式 | 当前使用原生滚动条，无影响 |
| 少量菜品时内容区大面积空白 | 可接受，grid 从顶部对齐（`content-start`）|

### SESSION_ID（供 /ccg:execute 使用）
- CODEX_SESSION: 019c70f9-9573-7083-8b3c-1ef9ed0baa1d
- GEMINI_SESSION: 1f716d53-2ee5-4366-b466-f29bf218b6eb
