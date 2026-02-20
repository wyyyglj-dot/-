# 📋 实施计划：历史记录页面 + 菜品管理增强

## 任务类型
- [x] 前端 (→ Gemini)
- [x] 后端 (→ Codex)
- [x] 全栈 (→ 并行)

## 交叉验证摘要

**一致观点（强信号）：**
- 恢复功能必须在单事务中完成，不复用 `openSession`（避免早期 SSE 副作用）
- DELETE 菜品需引用检查，被历史订单引用时返回 `409 DISH_IN_USE`
- 新增 `menu.updated` SSE 事件实现跨端售罄同步
- 历史列表使用分页 + 详情懒加载
- 编辑弹窗复用新增弹窗结构，删除使用二次确认

**分歧决策：**
- 恢复 API 路径：采用 Codex 方案 `POST /history/sessions/:id/restore`（模块边界更清晰）
- 恢复时保留 `qty_served/qty_voided` 原值（Codex 建议，避免厨房重复出菜）

---

## 技术方案

### 架构概览
- 后端新增 `history` 模块（router/service/repo），挂载到 `/api/v1`
- 后端 `menu` 模块补充 DELETE 接口 + SSE 广播
- 前端新增 `History.vue` 页面 + 路由 + 侧边栏入口
- 前端增强 `MenuConfig.vue`（编辑/删除/状态切换/按钮样式）
- 前端 `menu store` 补充 `updateDish/deleteDish` 方法
- SSE 新增 `menu.updated` 事件类型

---

## 实施步骤

### Step 1：数据库迁移 - 补充索引
**文件**：`server/src/db/migrations/0004_history_indexes.sql`（新建）

```sql
-- 历史列表查询优化：按结账时间倒序
CREATE INDEX IF NOT EXISTS idx_session_closed_timeline
  ON table_session (closed_at DESC, id DESC)
  WHERE status = 'CLOSED';

-- 菜品删除引用检查
CREATE INDEX IF NOT EXISTS idx_ticket_item_source_dish
  ON order_ticket_item (source_dish_id);
```

### Step 2：后端 - history 模块（3个文件）

#### 2a. `server/src/modules/history/history.repo.ts`

**`listClosedSessions(filters)`**：
- 联表 `table_session + dining_table + payment`
- 筛选 `status='CLOSED'`，支持 `page/pageSize/from/to/tableNo`
- 返回 `{ list, page, pageSize, total }`
- 金额直接取 `payment.amount_cents`（不重算）

**`getClosedSessionDetail(sessionId)`**：
- 校验 session 存在且 status='CLOSED'
- 返回 session 摘要 + payment + tickets/items 树

**`restoreClosedSession(sourceSessionId)`**（单事务）：
1. 校验源 session 为 CLOSED
2. 检查目标桌位无活跃会话（否则 409 ACTIVE_SESSION_EXISTS）
3. INSERT 新 session（status='DINING'）
4. 遍历源 tickets → INSERT 新 tickets（映射 old→new ticket_id）
5. 遍历源 items → INSERT 新 items（保留 qty_ordered/qty_served/qty_voided 原值）
6. 计算 pending 数量，若全部已上菜则设为 PENDING_CHECKOUT
7. 返回 `{ source_session_id, new_session, restored_tickets, restored_items }`

#### 2b. `server/src/modules/history/history.service.ts`

- `listClosedSessions(query)` → 参数校验 + 调用 repo
- `getClosedSessionDetail(sessionId)` → 调用 repo
- `restoreFromHistory(sessionId)` → 调用 repo 事务 → 事务提交后广播 SSE：
  - `session.opened`（含 `restored_from_session_id`）
  - `ticket.created`（含 `restored: true`）
  - `table.updated`

#### 2c. `server/src/modules/history/history.router.ts`

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/history/sessions` | 已结账会话列表（分页） |
| GET | `/history/sessions/:sessionId` | 会话详情（含明细） |
| POST | `/history/sessions/:sessionId/restore` | 从历史恢复桌位 |

#### 2d. `server/src/app.ts` 挂载

```ts
import { historyRouter } from './modules/history/history.router'
app.use('/api/v1', historyRouter)
```

### Step 3：后端 - menu 模块增强

#### 3a. DELETE 接口

**`menu.repo.ts`** 新增 `deleteDish(id)`：
- 检查 `order_ticket_item` 中是否有 `source_dish_id = id` 的引用
- 有引用 → 抛出 `ConflictError('DISH_IN_USE')`
- 无引用 → 执行 `DELETE FROM menu_dish WHERE id = ?`

**`menu.service.ts`** 新增 `deleteDish(id)`：
- 调用 repo.deleteDish → 广播 `menu.updated { action: 'deleted', dish_id }`

**`menu.router.ts`** 新增路由：
```ts
menuRouter.delete('/dishes/:id', handler)
```

#### 3b. SSE 事件扩展

**`sse.hub.ts`** 事件类型新增 `menu.updated`

触发点：
- `createDish` → `menu.updated { action: 'created' }`
- `updateDish` → `menu.updated { action: 'updated' }`（含 is_enabled 切换）
- `deleteDish` → `menu.updated { action: 'deleted' }`

### Step 4：前端 - API 层

#### 4a. `web/src/api/client.ts` 补充 DELETE 方法

```ts
export function del<T>(path: string): Promise<T> {
  return request<T>(path, { method: 'DELETE' })
}
```

#### 4b. `web/src/api/menu.ts` 补充

```ts
export const deleteDish = (id: number) => del<{ id: number }>(`/dishes/${id}`)
```
（`updateDish` 已存在）

#### 4c. `web/src/api/history.ts`（新建）

```ts
export const getClosedSessions = (params?) => get('/history/sessions?' + qs)
export const getSessionDetail = (id: number) => get(`/history/sessions/${id}`)
export const restoreSession = (id: number) => post(`/history/sessions/${id}/restore`, {})
```

### Step 5：前端 - menu store 增强

**`web/src/stores/menu.ts`** 新增：

```ts
async function updateDish(id: number, patch: Partial<Dish>) {
  const updated = await api.updateDish(id, patch)
  const idx = dishes.value.findIndex(d => d.id === id)
  if (idx >= 0) dishes.value[idx] = updated
  return updated
}

async function deleteDish(id: number) {
  await api.deleteDish(id)
  dishes.value = dishes.value.filter(d => d.id !== id)
}
```

导出新增 `updateDish, deleteDish`。

### Step 6：前端 - MenuConfig.vue 增强

#### 6a. 表格列新增"操作"列

```ts
{
  title: '操作', key: 'actions',
  render: (row) => h(NSpace, [
    h(NButton, { size: 'small', onClick: () => openEditModal(row) }, '编辑'),
    h(NPopconfirm, { onPositiveClick: () => handleDelete(row.id) }, {
      trigger: () => h(NButton, { size: 'small', type: 'error' }, '删除'),
      default: () => '确定删除此菜品吗？'
    })
  ])
}
```

#### 6b. 状态列改为可点击

```ts
{
  title: '状态', key: 'is_enabled',
  render: (row) => h(NTag, {
    type: row.is_enabled ? 'success' : 'error',
    size: 'small',
    style: { cursor: 'pointer' },
    onClick: () => handleToggleEnabled(row)
  }, { default: () => row.is_enabled ? '在售' : '售罄' })
}
```

#### 6c. 编辑弹窗（复用新增弹窗结构）

- 新增 `editingDish` ref 和 `showEditModal` ref
- `openEditModal(row)` → 填充表单 → 打开弹窗
- `saveEditDish()` → 调用 `menuStore.updateDish(id, patch)` → 关闭弹窗

#### 6d. "新增分类"按钮样式

```html
<n-button type="primary" @click="showCatModal = true">新增分类</n-button>
```

### Step 7：前端 - History.vue 页面（新建）

#### 页面结构
- 布局：`NLayout has-sider` + `AppSidebar` + 内容区
- 样式：`bg-aurora` + `glass-l1`
- 数据表：`NDataTable` 展开行模式

#### 列定义
| 列 | 说明 |
|----|------|
| 桌号 | `table_no`（格式化为"X号桌"） |
| 开台时间 | `opened_at` |
| 结账时间 | `closed_at` |
| 消费金额 | `amount_cents` → `centsToYuan()` |
| 支付方式 | `payment_method`（CASH/WECHAT/ALIPAY 中文映射） |
| 操作 | "恢复桌位"按钮 + "查看详情"展开 |

#### 展开行
- 使用 `render-expand` 渲染子表格
- 子表格列：菜品名称、单价、数量、小计
- 数据来源：点击展开时调用 `getSessionDetail(id)` 懒加载

#### 恢复功能
- 点击"恢复桌位" → 调用 `restoreSession(id)`
- 成功 → `message.success` + 跳转桌位总览
- 409 ACTIVE_SESSION_EXISTS → `message.error('该桌位当前正在用餐，无法恢复')`

### Step 8：前端 - 路由与导航

#### `web/src/router/index.ts` 新增

```ts
{
  path: '/history',
  component: () => import('../views/History.vue'),
  meta: { title: '历史记录' },
}
```

#### `web/src/components/layout/AppSidebar.vue` 新增

```ts
{ label: () => h(RouterLink, { to: '/history' }, { default: () => '历史记录' }), key: '/history' }
```

### Step 9：SSE 监听 menu.updated

在 `TableMap.vue`（或全局 App.vue）中：

```ts
sseClient.on('menu.updated', () => menuStore.fetchMenu())
```

确保点餐页面（Ordering.vue / MobileOrdering.vue）在 SSE 触发后自动刷新菜单，售罄菜品即时消失。

---

## 关键文件

| 文件 | 操作 | 说明 |
|------|------|------|
| `server/src/db/migrations/0004_history_indexes.sql` | 新建 | 历史查询+删除引用检查索引 |
| `server/src/modules/history/history.repo.ts` | 新建 | 历史数据访问层 |
| `server/src/modules/history/history.service.ts` | 新建 | 历史业务逻辑 |
| `server/src/modules/history/history.router.ts` | 新建 | 历史 API 路由 |
| `server/src/app.ts` | 修改 | 挂载 historyRouter |
| `server/src/modules/menu/menu.repo.ts` | 修改 | 新增 deleteDish |
| `server/src/modules/menu/menu.service.ts` | 修改 | 新增 deleteDish + SSE 广播 |
| `server/src/modules/menu/menu.router.ts` | 修改 | 新增 DELETE /dishes/:id |
| `server/src/modules/sse/sse.hub.ts` | 修改 | 新增 menu.updated 事件类型 |
| `web/src/api/client.ts` | 修改 | 新增 del 方法 |
| `web/src/api/menu.ts` | 修改 | 新增 deleteDish |
| `web/src/api/history.ts` | 新建 | 历史记录 API |
| `web/src/stores/menu.ts` | 修改 | 新增 updateDish/deleteDish |
| `web/src/views/History.vue` | 新建 | 历史记录页面 |
| `web/src/views/MenuConfig.vue` | 修改 | 编辑/删除/状态切换/按钮样式 |
| `web/src/router/index.ts` | 修改 | 新增 /history 路由 |
| `web/src/components/layout/AppSidebar.vue` | 修改 | 新增历史记录导航 |
| `web/src/types/index.ts` | 修改 | 新增历史记录相关类型 |

## 风险与缓解

| 风险 | 缓解措施 |
|------|----------|
| 恢复时目标桌位已有活跃会话 | 后端事务内检查 + 返回 409 + 前端友好提示 |
| 删除被历史引用的菜品 | 引用检查 + 409 DISH_IN_USE + 提示用户先停售 |
| 恢复事务中途失败留下半成品 | 单事务保证原子性，SSE 在事务提交后才广播 |
| 跨端售罄不同步 | menu.updated SSE 事件 + 各页面监听刷新 |
| 历史数据量增长导致查询慢 | 分页 + 复合索引 + 详情懒加载 |

## 错误码定义

| 错误码 | HTTP | 场景 |
|--------|------|------|
| `ACTIVE_SESSION_EXISTS` | 409 | 恢复时目标桌位已有活跃会话 |
| `SESSION_NOT_CLOSED` | 409 | 恢复的源会话不是 CLOSED 状态 |
| `DISH_IN_USE` | 409 | 删除的菜品被历史订单引用 |

## SESSION_ID（供 /ccg:execute 使用）
- CODEX_SESSION: 019c6e2a-da51-7893-92a6-c4184cbe49c5
- GEMINI_SESSION: 30966533-0a0a-4fc6-8092-b0c89f8dae2c
