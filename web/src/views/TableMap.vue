<script setup lang="ts">
import { onMounted, ref, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { NLayout, NLayoutSider, NLayoutContent, NGrid, NGridItem, NSpin, NButton, NModal, NInput, useMessage, useDialog } from 'naive-ui'
import { useTableStore } from '../stores/tables'
import AppSidebar from '../components/layout/AppSidebar.vue'
import TableCard from '../components/business/TableCard.vue'
import { sseClient } from '../api/sse'
import { checkoutSession } from '../api/checkout'
import { centsToYuan } from '../utils/currency'
import { v4 as uuidv4 } from 'uuid'

const tableStore = useTableStore()
const router = useRouter()
const message = useMessage()
const dialog = useDialog()
const loading = ref(true)
const showAddModal = ref(false)
const tableForm = ref({ table_no: '' })
const showCheckoutConfirm = ref(false)
const checkoutTarget = ref<{ sessionId: number; tableNo: string; totalCents: number } | null>(null)
const checkoutLoading = ref(false)

const isManageMode = ref(false)
const showRenameModal = ref(false)
const renameTarget = ref<{ id: number; table_no: string } | null>(null)
const renameInput = ref('')
const renameInputRef = ref<InstanceType<typeof NInput> | null>(null)

onMounted(async () => {
  await tableStore.fetchTables()
  loading.value = false
  sseClient.connect()
  sseClient.on('table.updated', () => tableStore.fetchTables())
  sseClient.on('checkout.completed', () => tableStore.fetchTables())
  sseClient.on('session.opened', () => tableStore.fetchTables())
})

function handleTableClick(table: any) {
  router.push(`/order/${table.id}`)
}

async function addTable() {
  try {
    await tableStore.addTable(tableForm.value.table_no)
    showAddModal.value = false
    tableForm.value = { table_no: '' }
    message.success('添加成功')
  } catch (e: any) { message.error(e.message) }
}

function handleCheckout(sessionId: number) {
  const table = tableStore.tables.find(t => t.session_id === sessionId)
  checkoutTarget.value = {
    sessionId,
    tableNo: table?.table_no ?? '',
    totalCents: table?.total_cents ?? 0,
  }
  showCheckoutConfirm.value = true
}

async function confirmCheckout() {
  if (!checkoutTarget.value || checkoutLoading.value) return
  checkoutLoading.value = true
  try {
    await checkoutSession(checkoutTarget.value.sessionId, {
      method: 'CASH',
      idempotency_key: uuidv4(),
    })
    message.success('结账成功')
    showCheckoutConfirm.value = false
    checkoutTarget.value = null
    await tableStore.fetchTables()
  } catch (e: any) {
    message.error(e.message)
  } finally {
    checkoutLoading.value = false
  }
}

function handleRename(tableId: number) {
  const table = tableStore.tables.find(t => t.id === tableId)
  if (!table) return
  renameTarget.value = { id: table.id, table_no: table.table_no }
  renameInput.value = table.table_no
  showRenameModal.value = true
  nextTick(() => renameInputRef.value?.focus())
}

async function confirmRename() {
  if (!renameTarget.value || !renameInput.value.trim()) return
  try {
    await tableStore.renameTable(renameTarget.value.id, renameInput.value.trim())
    message.success('改名成功')
    showRenameModal.value = false
  } catch (e: any) { message.error(e.message) }
}

function handleDelete(tableId: number) {
  const table = tableStore.tables.find(t => t.id === tableId)
  if (!table) return
  dialog.warning({
    title: '确认删除',
    content: `确定要删除「${table.table_no}」吗？删除后将不再显示。`,
    positiveText: '删除',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        await tableStore.deleteTable(tableId)
        message.success('删除成功')
      } catch (e: any) { message.error(e.message) }
    },
  })
}

async function handleCancel(sessionId: number) {
  dialog.warning({
    title: '确认取消',
    content: '确定要取消当前点餐吗？',
    positiveText: '取消点餐',
    negativeText: '返回',
    onPositiveClick: async () => {
      try {
        await tableStore.cancelSession(sessionId)
        message.success('已取消点餐')
      } catch (e: any) { message.error(e.message) }
    },
  })
}
</script>

<template>
  <n-layout has-sider class="h-screen bg-aurora">
    <n-layout-sider width="200" :native-scrollbar="false" class="glass-l1" content-style="height: 100%">
      <AppSidebar />
    </n-layout-sider>
    <n-layout-content class="p-8">
      <div class="max-w-7xl mx-auto">
        <div class="flex justify-between items-center mb-8">
          <h2 class="text-2xl font-bold">桌位状态</h2>
          <div class="flex items-center gap-4">
            <n-button
              :type="isManageMode ? 'warning' : 'default'"
              :ghost="!isManageMode"
              @click="isManageMode = !isManageMode"
            >
              {{ isManageMode ? '✓ 完成管理' : '⚙ 桌位管理' }}
            </n-button>
            <n-button v-if="!isManageMode" type="primary" @click="showAddModal = true">添加桌位</n-button>
            <div class="flex gap-4 text-sm">
              <span class="flex items-center gap-1">
                <span class="w-3 h-3 bg-[var(--status-idle-text)] rounded"></span>空闲
              </span>
              <span class="flex items-center gap-1">
                <span class="w-3 h-3 bg-[var(--status-dining-text)] rounded"></span>就餐中
              </span>
              <span class="flex items-center gap-1">
                <span class="w-3 h-3 bg-[var(--status-checkout-text)] rounded"></span>待结账
              </span>
            </div>
          </div>
        </div>
        <n-spin :show="loading">
          <n-grid x-gap="24" y-gap="24" cols="2 m:3 l:4 xl:5" responsive="screen">
            <n-grid-item v-for="table in tableStore.tables" :key="table.id">
              <TableCard
                :table="table"
                :manage-mode="isManageMode"
                @click="handleTableClick(table)"
                @checkout="handleCheckout"
                @rename="handleRename"
                @delete="handleDelete"
                @cancel="handleCancel"
              />
            </n-grid-item>
          </n-grid>
        </n-spin>
      </div>
    </n-layout-content>
  </n-layout>

  <n-modal v-model:show="showAddModal" preset="dialog" title="添加桌位" positive-text="确定" @positive-click="addTable">
    <div class="mt-4">
      <n-input v-model:value="tableForm.table_no" placeholder="桌位名称（如 包间1、大厅3、VIP）" />
    </div>
  </n-modal>

  <n-modal
    v-model:show="showCheckoutConfirm"
    preset="dialog"
    title="确认结账"
    positive-text="确认结账"
    negative-text="取消"
    :positive-button-props="{ loading: checkoutLoading }"
    @positive-click="confirmCheckout"
  >
    <div v-if="checkoutTarget" class="py-2">
      <p>确认为 <span class="font-bold">{{ checkoutTarget.tableNo }}号桌</span> 结账？</p>
      <p class="text-2xl font-bold text-[var(--primary)] mt-2">{{ centsToYuan(checkoutTarget.totalCents) }}</p>
    </div>
  </n-modal>

  <n-modal
    v-model:show="showRenameModal"
    preset="card"
    title="桌位改名"
    class="max-w-sm w-[90vw]"
    :segmented="{ content: true, footer: true }"
  >
    <n-input ref="renameInputRef" v-model:value="renameInput" placeholder="输入新桌位名" @keydown.enter="confirmRename" />
    <template #footer>
      <div class="flex justify-end gap-2">
        <n-button @click="showRenameModal = false">取消</n-button>
        <n-button type="primary" :disabled="!renameInput.trim()" @click="confirmRename">确认</n-button>
      </div>
    </template>
  </n-modal>
</template>
