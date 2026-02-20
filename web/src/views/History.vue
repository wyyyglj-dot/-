<script setup lang="ts">
import { onMounted, ref, reactive, h, computed } from 'vue'
import {
  NLayout, NLayoutSider, NLayoutContent, NDataTable, NButton, NTag, useMessage,
  NDrawer, NDrawerContent, NSpace, NPopconfirm, NDescriptions, NDescriptionsItem
} from 'naive-ui'
import { useRouter } from 'vue-router'
import AppSidebar from '../components/layout/AppSidebar.vue'
import { centsToYuan } from '../utils/currency'
import * as historyApi from '../api/history'
import type { ClosedSessionListItem, ClosedSessionDetail, OrderTicketItem } from '../types'

const message = useMessage()
const router = useRouter()
const loading = ref(false)
const data = ref<ClosedSessionListItem[]>([])

// Drawer state
const drawerVisible = ref(false)
const drawerDetail = ref<ClosedSessionDetail | null>(null)
const drawerLoading = ref(false)
const detailCache = reactive<Record<number, ClosedSessionDetail>>({})

const pagination = reactive({
  page: 1,
  pageSize: 15,
  itemCount: 0,
  showSizePicker: true,
  pageSizes: [10, 15, 30, 50],
  onChange: (page: number) => { pagination.page = page; fetchHistory() },
  onUpdatePageSize: (size: number) => { pagination.pageSize = size; pagination.page = 1; fetchHistory() },
})

async function fetchHistory() {
  loading.value = true
  try {
    const res = await historyApi.getClosedSessions({ page: pagination.page, pageSize: pagination.pageSize })
    data.value = res.list
    pagination.itemCount = res.total
  } catch (e: any) {
    message.error(e.message)
  } finally {
    loading.value = false
  }
}

onMounted(fetchHistory)

const paymentMap: Record<string, string> = { CASH: '现金', WECHAT: '微信', ALIPAY: '支付宝' }

const columns = [
  { title: '桌号', key: 'table_no', width: 100, render: (row: ClosedSessionListItem) => `${row.table_no}号桌` },
  { title: '开台时间', key: 'opened_at', width: 170 },
  { title: '结账时间', key: 'closed_at', width: 170 },
  { title: '消费金额', key: 'amount_cents', width: 120, render: (row: ClosedSessionListItem) => centsToYuan(row.amount_cents) },
  {
    title: '支付方式', key: 'payment_method', width: 100,
    render: (row: ClosedSessionListItem) => row.payment_method
      ? h(NTag, { type: 'info', size: 'small', bordered: false }, { default: () => paymentMap[row.payment_method!] || row.payment_method })
      : '-',
  },
  {
    title: '操作', key: 'actions', width: 200,
    render: (row: ClosedSessionListItem) => h(NSpace, { size: 'small' }, {
      default: () => [
        h(NButton, {
          size: 'small', type: 'info', ghost: true, onClick: () => handleViewDetail(row)
        }, { default: () => '详情' }),
        h(NButton, {
          size: 'small', type: 'warning', ghost: true,
          onClick: () => handleRestore(row.session_id),
        }, { default: () => '恢复' }),
        h(NPopconfirm, {
          onPositiveClick: () => handleDelete(row.session_id)
        }, {
          trigger: () => h(NButton, { size: 'small', type: 'error', ghost: true }, { default: () => '删除' }),
          default: () => '确定删除该历史记录？删除后将影响统计数据且不可恢复。'
        })
      ]
    }),
  },
]

const detailColumns = [
  { title: '菜品', key: 'dish_name_snapshot' },
  { title: '单价', key: 'unit_sell_price_cents', render: (r: OrderTicketItem) => centsToYuan(r.unit_sell_price_cents) },
  { title: '数量', key: 'qty_ordered' },
  { title: '小计', key: 'subtotal', render: (r: OrderTicketItem) => centsToYuan(r.unit_sell_price_cents * (r.qty_ordered - r.qty_voided)) },
]

function rowKey(row: ClosedSessionListItem) {
  return row.session_id
}

const drawerItems = computed(() => drawerDetail.value?.tickets.flatMap(t => t.items) ?? [])

async function handleViewDetail(row: ClosedSessionListItem) {
  drawerVisible.value = true
  if (detailCache[row.session_id]) {
    drawerDetail.value = detailCache[row.session_id]
    return
  }
  drawerLoading.value = true
  drawerDetail.value = null
  try {
    const detail = await historyApi.getSessionDetail(row.session_id)
    detailCache[row.session_id] = detail
    drawerDetail.value = detail
  } catch (e: any) {
    message.error(e.message)
  } finally {
    drawerLoading.value = false
  }
}

async function handleDelete(sessionId: number) {
  try {
    await historyApi.deleteSession(sessionId)
    message.success('记录已删除')
    delete detailCache[sessionId]
    fetchHistory()
  } catch (e: any) {
    message.error(e.message)
  }
}

async function handleRestore(sessionId: number) {
  try {
    await historyApi.restoreSession(sessionId)
    message.success('桌位已恢复')
    router.push('/')
  } catch (e: any) {
    message.error(e.message)
  }
}
</script>

<template>
  <n-layout has-sider class="h-screen bg-aurora">
    <n-layout-sider width="200" :native-scrollbar="false" content-style="height: 100%"><AppSidebar /></n-layout-sider>
    <n-layout-content class="p-8">
      <div class="max-w-6xl mx-auto">
        <h2 class="text-2xl font-bold mb-8">历史消费记录</h2>
        <n-data-table
          remote
          :loading="loading"
          :columns="columns"
          :data="data"
          :pagination="pagination"
          :row-key="rowKey"
          :bordered="false"
        />
      </div>

      <n-drawer v-model:show="drawerVisible" :width="480" placement="right">
        <n-drawer-content title="消费详情" closable>
          <div v-if="drawerLoading" class="p-4 text-center">加载中...</div>
          <div v-else-if="drawerDetail">
            <n-descriptions bordered :column="2" size="small" class="mb-4">
              <n-descriptions-item label="桌号">{{ drawerDetail.session.table_no }}号桌</n-descriptions-item>
              <n-descriptions-item label="状态">已结账</n-descriptions-item>
              <n-descriptions-item label="开台">{{ drawerDetail.session.opened_at }}</n-descriptions-item>
              <n-descriptions-item label="结账">{{ drawerDetail.session.closed_at }}</n-descriptions-item>
              <n-descriptions-item label="总金额">{{ centsToYuan(drawerDetail.total_cents) }}</n-descriptions-item>
              <n-descriptions-item label="支付">
                {{ drawerDetail.payment ? (paymentMap[drawerDetail.payment.method] || drawerDetail.payment.method) : '-' }}
              </n-descriptions-item>
            </n-descriptions>
            <h3 class="font-bold mb-2">菜品明细</h3>
            <n-data-table
              size="small"
              :columns="detailColumns"
              :data="drawerItems"
              :bordered="false"
            />
          </div>
        </n-drawer-content>
      </n-drawer>
    </n-layout-content>
  </n-layout>
</template>
