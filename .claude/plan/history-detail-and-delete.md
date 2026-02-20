# 📋 实施计划：历史记录详情查看 + 删除功能

## 任务类型
- [x] 前端 (→ Gemini)
- [x] 后端 (→ Codex)
- [x] 全栈 (→ 并行)

## 交叉验证摘要

**一致观点（强信号）：**
- 详情展示使用 NDrawer（抽屉），比展开行更适合完整信息展示
- 删除必须在单事务中级联执行，按外键依赖顺序：payment → order_ticket_item → order_ticket → table_session
- 删除前校验 session 状态为 CLOSED
- 删除需要二次确认（NPopconfirm）
- 统计模块从 payment + order_ticket_item 实时查询，删除后统计自动更新，无需额外处理

**分歧决策：**
- 按钮样式：Gemini 建议图标按钮 + Tooltip，Codex 未指定 → 采用文字小按钮（中文场景下文字更直观）
- 展开行去留：移除展开行，Drawer 已提供更好的详情体验，避免功能重复

---

## 技术方案

### 架构概览
- 后端 `history` 模块新增 `deleteClosedSession` repo 函数 + service 函数 + DELETE 路由
- 前端 `History.vue` 移除展开行，操作列改为3个按钮（详情/恢复/删除），新增 NDrawer 展示详情
- 前端 `api/history.ts` 新增 `deleteSession` 方法

### 删除级联顺序（外键约束决定）
```
payment (session_id → table_session.id)
  ↓ 先删
order_ticket_item (ticket_id → order_ticket.id)
  ↓ 再删
order_ticket (session_id → table_session.id)
  ↓ 再删
table_session (id)
  ↓ 最后删
```

---

## 实施步骤

### Step 1：后端 - history.repo.ts 新增 deleteClosedSession

**文件**：`server/src/modules/history/history.repo.ts`
**操作**：新增函数

```typescript
export interface DeleteResult {
  session_id: number
  deleted_payments: number
  deleted_items: number
  deleted_tickets: number
}

export function deleteClosedSession(sessionId: number): DeleteResult {
  const db = getDb()
  // 事务内执行级联删除
  const tx = db.transaction((sid: number): DeleteResult => {
    // 1. 校验 session 存在且为 CLOSED
    const session = db.prepare(
      'SELECT id, status FROM table_session WHERE id = ?'
    ).get(sid)
    if (!session) throw new NotFoundError('Session')
    if (session.status !== 'CLOSED')
      throw new ConflictError('Session must be CLOSED', 'SESSION_NOT_CLOSED')

    // 2. 删除 payment
    const delPayment = db.prepare('DELETE FROM payment WHERE session_id = ?').run(sid)

    // 3. 删除 order_ticket_item（通过子查询）
    const delItems = db.prepare(`
      DELETE FROM order_ticket_item
      WHERE ticket_id IN (SELECT id FROM order_ticket WHERE session_id = ?)
    `).run(sid)

    // 4. 删除 order_ticket
    const delTickets = db.prepare('DELETE FROM order_ticket WHERE session_id = ?').run(sid)

    // 5. 删除 table_session
    db.prepare('DELETE FROM table_session WHERE id = ?').run(sid)

    return {
      session_id: sid,
      deleted_payments: delPayment.changes,
      deleted_items: delItems.changes,
      deleted_tickets: delTickets.changes,
    }
  })
  return tx(sessionId)
}
```

### Step 2：后端 - history.service.ts 新增 deleteFromHistory

**文件**：`server/src/modules/history/history.service.ts`
**操作**：新增函数

```typescript
export function deleteFromHistory(sessionId: number) {
  return repo.deleteClosedSession(sessionId)
}
```

### Step 3：后端 - history.router.ts 新增 DELETE 路由

**文件**：`server/src/modules/history/history.router.ts`
**操作**：在 restore 路由后新增

```typescript
historyRouter.delete('/history/sessions/:sessionId', (req, res, next) => {
  try {
    const sessionId = requirePositiveInt(req.params.sessionId, 'sessionId')
    const data = service.deleteFromHistory(sessionId)
    res.json(success(data, getRequestId(req)))
  } catch (err) {
    next(err)
  }
})
```

### Step 4：前端 - api/history.ts 新增 deleteSession

**文件**：`web/src/api/history.ts`
**操作**：新增导出

```typescript
import { get, post, del } from './client'

export const deleteSession = (id: number) =>
  del<{ session_id: number; deleted_payments: number; deleted_items: number; deleted_tickets: number }>(
    `/history/sessions/${id}`
  )
```

### Step 5：前端 - History.vue 重构

**文件**：`web/src/views/History.vue`
**操作**：修改

#### 5a. 移除展开行相关代码
- 移除 `expandedKeys` ref
- 移除 `handleExpandChange` 函数
- 移除 `renderExpand` 函数
- 移除 `detailColumns` 定义
- 移除 NDataTable 的 `expanded-row-keys`、`render-expand`、`@update:expanded-row-keys` 属性

#### 5b. 新增 Drawer 状态
```typescript
const drawerVisible = ref(false)
const drawerDetail = ref<ClosedSessionDetail | null>(null)
const drawerLoading = ref(false)
```

#### 5c. 新增详情查看函数
```typescript
async function handleViewDetail(sessionId: number) {
  drawerVisible.value = true
  // 复用缓存
  if (detailCache[sessionId]) {
    drawerDetail.value = detailCache[sessionId]
    return
  }
  drawerLoading.value = true
  try {
    const detail = await historyApi.getSessionDetail(sessionId)
    detailCache[sessionId] = detail
    drawerDetail.value = detail
  } catch (e: any) {
    message.error(e.message)
  } finally {
    drawerLoading.value = false
  }
}
```

#### 5d. 新增删除函数
```typescript
async function handleDelete(sessionId: number) {
  try {
    await historyApi.deleteSession(sessionId)
    message.success('记录已删除')
    // 清理缓存
    delete detailCache[sessionId]
    // 刷新列表
    await fetchHistory()
  } catch (e: any) {
    message.error(e.message)
  }
}
```

#### 5e. 重构操作列
```typescript
{
  title: '操作', key: 'actions', width: 220,
  render: (row) => h(NSpace, { size: 'small' }, () => [
    h(NButton, {
      size: 'small', type: 'info', ghost: true,
      onClick: () => handleViewDetail(row.session_id),
    }, { default: () => '详情' }),
    h(NButton, {
      size: 'small', type: 'warning', ghost: true,
      onClick: () => handleRestore(row.session_id),
    }, { default: () => '恢复' }),
    h(NPopconfirm, {
      onPositiveClick: () => handleDelete(row.session_id),
    }, {
      trigger: () => h(NButton, {
        size: 'small', type: 'error', ghost: true,
      }, { default: () => '删除' }),
      default: () => '确定删除该历史记录？删除后将影响统计数据且不可恢复。',
    }),
  ]),
}
```

#### 5f. 新增 Drawer 模板
```html
<n-drawer v-model:show="drawerVisible" :width="480" placement="right">
  <n-drawer-content title="消费详情" closable>
    <template v-if="drawerLoading">
      <div class="text-center py-8 text-[var(--text-secondary)]">加载中...</div>
    </template>
    <template v-else-if="drawerDetail">
      <!-- 摘要信息 -->
      <div class="mb-4 space-y-2">
        <div>桌号：{{ drawerDetail.session.table_no }}号桌</div>
        <div>开台时间：{{ drawerDetail.session.opened_at }}</div>
        <div>结账时间：{{ drawerDetail.session.closed_at }}</div>
        <div>支付方式：{{ drawerDetail.payment ? paymentMap[drawerDetail.payment.method] : '-' }}</div>
        <div class="font-bold">总计：{{ centsToYuan(drawerDetail.total_cents) }}</div>
      </div>
      <!-- 菜品明细表格 -->
      <n-data-table
        :columns="detailColumns"
        :data="allItems"
        size="small"
        :bordered="false"
      />
    </template>
  </n-drawer-content>
</n-drawer>
```

#### 5g. 新增 imports
```typescript
import { NDrawer, NDrawerContent, NSpace, NPopconfirm } from 'naive-ui'
```

---

## 关键文件

| 文件 | 操作 | 说明 |
|------|------|------|
| [history.repo.ts](server/src/modules/history/history.repo.ts) | 修改 | 新增 `deleteClosedSession` 事务函数 |
| [history.service.ts](server/src/modules/history/history.service.ts) | 修改 | 新增 `deleteFromHistory` |
| [history.router.ts](server/src/modules/history/history.router.ts) | 修改 | 新增 `DELETE /history/sessions/:sessionId` |
| [history.ts (API)](web/src/api/history.ts) | 修改 | 新增 `deleteSession` + 补充 `del` import |
| [History.vue](web/src/views/History.vue) | 修改 | 移除展开行，新增 Drawer + 详情/删除按钮 |

## 风险与缓解

| 风险 | 缓解措施 |
|------|----------|
| 误删历史记录导致统计数据丢失 | NPopconfirm 二次确认 + 提示"不可恢复" |
| 外键约束导致删除失败 | 事务内按正确顺序级联删除 |
| 删除后详情缓存残留 | 删除成功后清理 `detailCache` |
| 并发删除同一 session | 事务内校验存在性，不存在则 404 |

## SESSION_ID（供 /ccg:execute 使用）
- CODEX_SESSION: 019c74b4-8f58-7b92-88af-f07c95dbff9c
- GEMINI_SESSION: e9c4eb8a-00d1-4f11-b0b7-8a963e58af3c
