<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { NModal, useMessage, useDialog } from 'naive-ui'
import { useTableStore } from '../../stores/tables'
import TableCard from '../../components/business/TableCard.vue'
import MobileNav from '../../components/layout/MobileNav.vue'
import ThemeToggle from '../../components/common/ThemeToggle.vue'
import { sseClient } from '../../api/sse'
import { checkoutSession } from '../../api/checkout'
import { centsToYuan } from '../../utils/currency'
import { v4 as uuidv4 } from 'uuid'

const tableStore = useTableStore()
const router = useRouter()
const message = useMessage()
const dialog = useDialog()

const showCheckoutConfirm = ref(false)
const checkoutTarget = ref<{ sessionId: number; tableNo: string; totalCents: number } | null>(null)
const checkoutLoading = ref(false)

onMounted(() => {
  tableStore.fetchTables()
  sseClient.connect()
  sseClient.on('table.updated', () => tableStore.fetchTables())
  sseClient.on('checkout.completed', () => tableStore.fetchTables())
})

function handleCheckout(sessionId: number) {
  const table = tableStore.tables.find(t => t.session_id === sessionId)
  checkoutTarget.value = {
    sessionId,
    tableNo: table?.table_no ?? '',
    totalCents: table?.total_cents ?? 0,
  }
  showCheckoutConfirm.value = true
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
</script>

<template>
  <div class="min-h-[100dvh] flex flex-col bg-aurora">
    <header class="flex-none p-4 glass-l1 sticky top-0 z-10 border-b border-[var(--glass-border-l1)] flex justify-between items-center">
      <h1 class="text-xl font-black text-[var(--primary)]">烧烤点餐</h1>
      <div class="flex items-center gap-3">
        <ThemeToggle />
        <div class="text-xs text-[var(--text-secondary)]">单人模式</div>
      </div>
    </header>
    <div class="flex-1 p-3 grid grid-cols-2 gap-4 pb-24 content-start">
      <TableCard
        v-for="table in tableStore.tables"
        :key="table.id"
        :table="table"
        @click="router.push(`/m/order/${table.id}`)"
        @checkout="handleCheckout"
        @cancel="handleCancel"
      />
    </div>
    <MobileNav />
  </div>

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
</template>
