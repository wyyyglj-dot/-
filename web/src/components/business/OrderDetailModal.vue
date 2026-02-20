<script setup lang="ts">
import { ref, watch } from 'vue'
import { NModal, NButton, NTag, NSpin, NEmpty, useDialog, useMessage } from 'naive-ui'
import type { SessionDetail, OrderTicketItem } from '../../types'
import { SPICE_LABELS, SPICE_COLORS } from '../../types'
import { centsToYuan } from '../../utils/currency'
import { getSession, updateTicketItem, forceDeleteSession } from '../../api/orders'

const props = defineProps<{
  show: boolean
  sessionId: number
  tableNo: string
  readonly?: boolean
}>()

const emit = defineEmits<{
  'update:show': [value: boolean]
  'session-deleted': []
  'item-updated': []
}>()

const dialog = useDialog()
const message = useMessage()
const loading = ref(false)
const detail = ref<SessionDetail | null>(null)
const operating = ref(false)

function formatTableName(no: string): string {
  return /^\d+$/.test(no) ? `${no}号桌` : no
}

async function loadDetail() {
  loading.value = true
  try {
    detail.value = await getSession(props.sessionId)
  } catch (e: any) {
    handleError(e)
  } finally {
    loading.value = false
  }
}

watch(() => props.show, (val) => {
  if (val && props.sessionId) loadDetail()
})

function pendingQty(item: OrderTicketItem): number {
  return item.qty_ordered - item.qty_served - item.qty_voided
}

function minQty(item: OrderTicketItem): number {
  return item.qty_served + item.qty_voided
}

function totalCents(): number {
  if (!detail.value) return 0
  let sum = 0
  for (const t of detail.value.tickets) {
    for (const item of t.items) {
      sum += item.unit_sell_price_cents * (item.qty_ordered - item.qty_voided)
    }
  }
  return sum
}

async function changeQty(item: OrderTicketItem, delta: number) {
  const newQty = item.qty_ordered + delta
  if (newQty < minQty(item) || newQty < 1) return
  operating.value = true
  try {
    await updateTicketItem(item.id, { qty_ordered: newQty })
    await loadDetail()
    emit('item-updated')
  } catch (e: any) {
    handleError(e)
  } finally {
    operating.value = false
  }
}

async function voidItem(item: OrderTicketItem) {
  const pending = pendingQty(item)
  if (pending <= 0) return
  operating.value = true
  try {
    await updateTicketItem(item.id, { qty_voided: pending })
    await loadDetail()
    emit('item-updated')
  } catch (e: any) {
    handleError(e)
  } finally {
    operating.value = false
  }
}

function confirmDeleteOrder() {
  dialog.warning({
    title: '删除订单',
    content: '将删除所有数据（含结账记录），不可恢复！',
    positiveText: '确认删除',
    negativeText: '取消',
    onPositiveClick: deleteOrder,
  })
}

async function deleteOrder() {
  operating.value = true
  try {
    await forceDeleteSession(props.sessionId)
    message.success('订单已删除')
    emit('update:show', false)
    emit('session-deleted')
  } catch (e: any) {
    handleError(e)
  } finally {
    operating.value = false
  }
}

function handleError(e: any) {
  const msg = e.message || ''
  if (msg.includes('已被修改') || msg.includes('CONCURRENT')) {
    message.warning('数据已被修改，正在刷新...')
    loadDetail()
  } else if (msg.includes('不存在') || msg.includes('Not Found')) {
    message.warning('订单已被删除')
    emit('update:show', false)
    emit('session-deleted')
  } else {
    message.error(msg || '操作失败')
  }
}

function itemStatus(item: OrderTicketItem): 'served' | 'partial' | 'unserved' {
  const effective = item.qty_ordered - item.qty_voided
  if (effective <= 0 || item.qty_served >= effective) return 'served'
  if (item.qty_served > 0) return 'partial'
  return 'unserved'
}
</script>

<template>
  <n-modal
    :show="show"
    preset="card"
    :title="`${formatTableName(tableNo)} - 订单详情`"
    class="max-w-md w-[92vw] rounded-2xl"
    :segmented="{ content: true, footer: true }"
    @update:show="emit('update:show', $event)"
  >
    <n-spin :show="loading">
      <n-empty v-if="!loading && !detail" description="暂无数据" />
      <div v-else-if="detail" class="max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar">
        <template v-for="ticket in detail.tickets" :key="ticket.id">
          <div
            v-for="item in ticket.items"
            :key="item.id"
            class="flex items-center justify-between py-3 border-b border-[var(--action-border)] last:border-0"
            :class="itemStatus(item) === 'served' ? 'opacity-50' : ''"
          >
            <div class="flex-1 min-w-0 pr-3">
              <div class="font-medium truncate text-base" :class="pendingQty(item) <= 0 ? 'line-through' : ''">
                {{ item.dish_name_snapshot }}
                <NTag
                  v-if="item.spice_level"
                  :color="{ color: '#fff0', textColor: SPICE_COLORS[item.spice_level as keyof typeof SPICE_COLORS], borderColor: SPICE_COLORS[item.spice_level as keyof typeof SPICE_COLORS] }"
                  size="small" class="ml-1 scale-75 origin-left"
                >{{ SPICE_LABELS[item.spice_level as keyof typeof SPICE_LABELS] }}</NTag>
              </div>
              <div class="text-xs text-[var(--text-secondary)]">{{ centsToYuan(item.unit_sell_price_cents) }} / 份</div>
            </div>
            <div class="flex items-center gap-2">
              <!-- qty controls -->
              <template v-if="!readonly && pendingQty(item) > 0">
                <n-button size="tiny" circle :disabled="operating || item.qty_ordered <= Math.max(minQty(item), 1)" @click="changeQty(item, -1)">-</n-button>
                <span class="font-mono font-bold w-6 text-center">{{ item.qty_ordered }}</span>
                <n-button size="tiny" circle :disabled="operating" @click="changeQty(item, 1)">+</n-button>
                <n-button size="tiny" type="error" :disabled="operating" @click="voidItem(item)">删</n-button>
              </template>
              <template v-else>
                <span class="font-mono font-bold">×{{ item.qty_ordered }}</span>
              </template>
              <!-- status tag -->
              <n-tag v-if="itemStatus(item) === 'unserved'" size="small" :bordered="false">未上</n-tag>
              <n-tag v-else-if="itemStatus(item) === 'partial'" size="small" type="warning" :bordered="false">
                {{ item.qty_served }}/{{ item.qty_ordered - item.qty_voided }}已上
              </n-tag>
              <n-tag v-else size="small" type="success" :bordered="false">已上</n-tag>
            </div>
          </div>
        </template>
      </div>
    </n-spin>
    <template #footer>
      <div class="flex justify-between items-center w-full">
        <n-button v-if="!readonly" type="error" size="small" :disabled="operating" @click="confirmDeleteOrder">
          删除订单
        </n-button>
        <span v-else />
        <div class="text-right">
          <span class="text-xs text-[var(--text-secondary)]">总计：</span>
          <span class="text-xl font-bold text-[var(--primary)]">{{ centsToYuan(totalCents()) }}</span>
        </div>
      </div>
    </template>
  </n-modal>
</template>
