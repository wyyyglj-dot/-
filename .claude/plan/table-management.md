# 📋 实施计划：桌位管理功能（改名 + 删除）

## 任务类型
- [x] 全栈 (→ 并行)

## 需求摘要

在 TableMap 桌位总览页面增加"桌位管理"模式，支持：
- 桌位改名（修改 table_no）
- 桌位删除（软删除，is_enabled=0）
- 有活跃会话的桌位禁止删除（后端校验）

## 技术方案

| 层级 | 方案 | 理由 |
|------|------|------|
| 后端 API | 复用 `PATCH /tables/:id` | 已支持 table_no 和 is_enabled 修改 |
| 删除校验 | 后端新增活跃会话检查 | 防止客户端绕过，保证数据完整性 |
| 前端交互 | Toggle 管理模式 | 操作/管理分离，防止误触 |
| 卡片 UI | Overlay 遮罩 + 操作按钮 | 视觉区分明确，阻断正常点击 |
| 改名弹窗 | NModal (Card preset) | 状态提升到 TableMap，避免 N 个实例 |
| 删除确认 | NPopconfirm | 轻量级确认，比 Modal 更快捷 |

## 实施步骤

### Step 1：后端 - 添加删除校验逻辑
- 修改 `server/src/modules/tables/tables.service.ts`：
  - 在 `updateTable` 中，当 `is_enabled=0` 时检查是否有活跃会话
  - 若有活跃会话，抛出 `DomainError('TABLE_HAS_ACTIVE_SESSION', '该桌位有未结束的用餐，无法删除')`
- 修改 `server/src/modules/tables/tables.repo.ts`：
  - 新增 `hasActiveSession(tableId: number): boolean` 查询函数
- 预期产物：PATCH 接口在软删除时自动校验活跃会话

### Step 2：后端 - 过滤已禁用桌位
- 修改 `server/src/modules/tables/tables.repo.ts`：
  - `loadSummaryBase` 和 `listTablesWithCurrentSession` 添加 `WHERE t.is_enabled = 1` 过滤
- 预期产物：软删除的桌位不再出现在列表中

### Step 3：前端 API 层 - 补充 deleteTable
- 修改 `web/src/api/tables.ts`：
  - 新增 `deleteTable(id: number)` → 调用 `patch<DiningTable>(`/tables/${id}`, { is_enabled: 0 })`
- 预期产物：API 层封装完整

### Step 4：前端 Store - 补充管理 actions
- 修改 `web/src/stores/tables.ts`：
  - 新增 `renameTable(id: number, newName: string)` action
  - 新增 `deleteTable(id: number)` action
  - 两者都调用 API 后刷新列表
- 预期产物：Store 层支持改名和删除

### Step 5：前端 TableCard - 支持管理模式
- 修改 `web/src/components/business/TableCard.vue`：
  - 新增 prop `manageMode: boolean`（默认 false）
  - 新增 emit `rename` 和 `delete`
  - 管理模式下：
    - 显示半透明 Overlay 遮罩（`bg-black/40 backdrop-blur-sm`）
    - 居中显示"改名"（Primary）和"删除"（Error）两个按钮
    - 有活跃会话时删除按钮 disabled + tooltip 提示
    - 阻断正常的 click 事件（不跳转点餐页）
- 预期产物：TableCard 支持双模式显示

### Step 6：前端 TableMap - 管理模式 + Modal
- 修改 `web/src/views/TableMap.vue`：
  - Header 区域添加"桌位管理"Toggle 按钮（在"添加桌位"左侧）
    - 未激活：Ghost/Secondary 样式，图标 SettingsOutline
    - 激活：Warning 样式，文案变为"完成管理"
  - 新增 `isManageMode` ref
  - 新增改名 Modal（NModal Card preset）：
    - 输入框预填当前桌位名，auto-focus
    - 确认按钮调用 `tableStore.renameTable`
  - 传递 `manageMode` prop 给 TableCard
  - 管理模式下隐藏"添加桌位"按钮（或保留，视觉上不冲突）
  - 处理 TableCard 的 `rename` 和 `delete` emit
  - 删除使用 NPopconfirm 或简单确认 Modal
- 预期产物：完整的桌位管理交互流程

## 关键文件

| 文件 | 操作 | 说明 |
|------|------|------|
| `server/src/modules/tables/tables.repo.ts:265-302` | 修改 | 新增 hasActiveSession；updateTable 已有 |
| `server/src/modules/tables/tables.service.ts:47-62` | 修改 | updateTable 添加活跃会话校验 |
| `server/src/modules/tables/tables.repo.ts:92-121` | 修改 | loadSummaryBase 过滤 is_enabled=0 |
| `web/src/api/tables.ts` | 修改 | 新增 deleteTable 封装 |
| `web/src/stores/tables.ts` | 修改 | 新增 renameTable/deleteTable actions |
| `web/src/components/business/TableCard.vue` | 修改 | 新增 manageMode prop + overlay UI |
| `web/src/views/TableMap.vue` | 修改 | 管理模式 toggle + 改名 Modal |

## 风险与缓解

| 风险 | 缓解措施 |
|------|----------|
| 竞态：UI 检查时桌位空闲，提交时已开台 | 后端校验兜底，前端展示服务端错误信息 |
| table_no 唯一约束冲突 | 后端已有 ConflictError 处理，前端展示"桌位名已存在" |
| 软删除桌位残留在缓存列表 | SSE table.updated 事件触发刷新；loadSummaryBase 过滤 |
| 管理模式下误触删除 | NPopconfirm 二次确认 + 活跃桌位 disabled |

## SESSION_ID（供 /ccg:execute 使用）
- CODEX_SESSION: 019c716f-aec3-7432-8056-766e0d7218db
- GEMINI_SESSION: 224ec8ad-bc77-474f-bd3d-501ff357b027
