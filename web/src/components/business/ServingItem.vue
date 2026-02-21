<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { NButton } from 'naive-ui'
import { useOrderStore } from '../../stores/orders'
import { useActionLock } from '../../composables/useActionLock'
import type { ServingQueueItem, ServedItem } from '../../types'
import { SPICE_LABELS } from '../../types'

const props = withDefaults(defineProps<{
  item: ServingQueueItem | ServedItem
  mode?: 'serving' | 'served'
}>(), {
  mode: 'serving',
})

const orderStore = useOrderStore()
const { locked: serveLocked, execute: executeServe } = useActionLock()
const { locked: unserveLocked, execute: executeUnserve } = useActionLock()

const displayQty = computed(() =>
  props.mode === 'serving'
    ? (props.item as ServingQueueItem).quantity
    : (props.item as ServedItem).qty_served
)

const now = ref(Date.now())
let timer: ReturnType<typeof setInterval> | null = null

onMounted(() => {
  timer = setInterval(() => { now.value = Date.now() }, 1000)
})
onUnmounted(() => { if (timer) clearInterval(timer) })

function elapsed(dateStr: string): string {
  const diff = Math.max(0, now.value - new Date(dateStr + 'Z').getTime())
  const totalSec = Math.floor(diff / 1000)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function handleServe() {
  executeServe(async () => {
    await orderStore.markServed(props.item.item_id, displayQty.value)
    orderStore.fetchServedItems()
  }).catch(() => { /* errors handled in store via snapshot rollback */ })
}

function handleUnserve() {
  executeUnserve(async () => {
    await orderStore.unserveItem(props.item.item_id, displayQty.value)
    orderStore.fetchServingQueue()
  }).catch(() => { /* errors handled in store */ })
}
</script>

<template>
  <div class="glass-l2 p-4 rounded-xl shadow-sm border border-[var(--glass-border-l1)] flex items-center justify-between mb-3 hover:shadow-md transition-shadow">
    <div class="flex items-center gap-4">
      <div
        class="w-14 h-14 rounded-lg flex flex-col items-center justify-center border"
        :class="mode === 'serving'
          ? 'bg-[var(--status-dining-bg)] border-[var(--status-dining-border)]'
          : 'bg-[var(--status-idle-bg)] border-transparent'"
      >
        <span class="text-[var(--primary)] font-bold text-lg">{{ item.table_no }}</span>
        <span class="text-[var(--text-secondary)] text-[10px]">号桌</span>
      </div>
      <div>
        <div class="font-bold text-lg">{{ item.dish_name }}<span v-if="item.spice_level" class="text-[var(--primary)] text-base ml-1">({{ SPICE_LABELS[item.spice_level as keyof typeof SPICE_LABELS] }})</span> × {{ displayQty }}</div>
        <div class="text-[var(--primary)] text-sm mt-0.5 font-mono tabular-nums">{{ elapsed(item.ordered_at) }}</div>
      </div>
    </div>
    <n-button
      v-if="mode === 'serving'"
      type="primary"
      size="large"
      class="px-6 font-bold"
      :disabled="serveLocked"
      @click="handleServe"
    >
      已上菜
    </n-button>
    <n-button
      v-else
      type="warning"
      ghost
      size="medium"
      class="px-4 font-bold"
      :disabled="unserveLocked"
      @click="handleUnserve"
    >
      恢复
    </n-button>
  </div>
</template>
