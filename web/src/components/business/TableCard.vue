<script setup lang="ts">
import { ref } from 'vue'
import { NButton, NTag, NTooltip } from 'naive-ui'
import type { TableSummary } from '../../types'
import { SPICE_LABELS, SPICE_COLORS } from '../../types'
import { centsToYuan } from '../../utils/currency'
import OrderDetailModal from './OrderDetailModal.vue'

defineProps<{ table: TableSummary; manageMode?: boolean }>()
const emit = defineEmits<{ click: [], checkout: [sessionId: number], rename: [id: number], delete: [id: number], cancel: [sessionId: number], refresh: [] }>()

const showDetails = ref(false)

const statusBarClass = (status: string) => {
  switch (status) {
    case 'dining': return 'status-bar-dining'
    case 'pending_checkout': return 'status-bar-checkout'
    default: return 'status-bar-idle'
  }
}

function formatTableName(tableNo: string): string {
  return /^\d+$/.test(tableNo) ? `${tableNo}号桌` : tableNo
}

function statusLabel(status: string): string {
  if (status === 'pending_checkout') return '待结账'
  if (status === 'dining') return '就餐中'
  return '空闲'
}
</script>

<template>
  <div
    role="button"
    :tabindex="manageMode ? -1 : 0"
    :aria-label="`${formatTableName(table.table_no)} ${statusLabel(table.status)}`"
    class="relative overflow-hidden rounded-[var(--radius-lg)] border border-[var(--action-border)] glass-l2 p-5 cursor-pointer transition-all duration-300 hover:shadow-card-hover hover:scale-[1.02] active:scale-[0.98] shadow-card"
    @click="!manageMode && $emit('click')"
    @keydown.enter="!manageMode && $emit('click')"
    @keydown.space.prevent="!manageMode && $emit('click')"
  >
    <!-- 管理模式 Overlay -->
    <div
      v-if="manageMode"
      class="absolute inset-0 z-10 bg-black/40 backdrop-blur-sm rounded-[var(--radius-lg)] flex items-center justify-center gap-3"
      @click.stop
    >
      <n-button type="primary" size="small" @click.stop="$emit('rename', table.id)">改名</n-button>
      <n-tooltip v-if="table.status !== 'idle'" trigger="hover">
        <template #trigger>
          <n-button type="error" size="small" disabled>删除</n-button>
        </template>
        该桌位正在使用中，无法删除
      </n-tooltip>
      <n-button v-else type="error" size="small" @click.stop="$emit('delete', table.id)">删除</n-button>
    </div>
    <div :class="statusBarClass(table.status)" class="absolute top-0 left-0 right-0 h-1.5 opacity-80"></div>

    <div class="flex justify-between items-start mb-2">
      <span class="font-bold text-lg">{{ formatTableName(table.table_no) }}</span>
      <span v-if="table.status !== 'idle' && table.total_cents > 0" class="text-[var(--primary)] font-bold">
        {{ centsToYuan(table.total_cents) }}
      </span>
    </div>

    <div v-if="table.status === 'idle'" class="text-[var(--text-secondary)] text-sm">空闲</div>

    <div v-else class="space-y-0.5">
      <div
        v-for="(dish, index) in table.dishes.slice(0, 3)"
        :key="`preview-${dish.name}-${index}`"
        class="text-sm truncate"
        :class="dish.status === 'served' ? 'opacity-50 line-through text-[var(--text-muted)]' : 'text-[var(--text-secondary)]'"
      >
        <template v-if="dish.status === 'unserved'">· {{ dish.name }}<span v-if="dish.spice_level" :style="{ color: SPICE_COLORS[dish.spice_level as keyof typeof SPICE_COLORS] }" class="text-xs ml-0.5">{{ SPICE_LABELS[dish.spice_level as keyof typeof SPICE_LABELS] }}</span>×{{ dish.qty_ordered }}</template>
        <template v-else-if="dish.status === 'partial'">
          · {{ dish.name }}<span v-if="dish.spice_level" :style="{ color: SPICE_COLORS[dish.spice_level as keyof typeof SPICE_COLORS] }" class="text-xs ml-0.5">{{ SPICE_LABELS[dish.spice_level as keyof typeof SPICE_LABELS] }}</span> <span class="text-[var(--primary)]">{{ dish.qty_unserved }}/{{ dish.qty_ordered }}未上</span>
        </template>
        <template v-else>✓ {{ dish.name }}<span v-if="dish.spice_level" :style="{ color: SPICE_COLORS[dish.spice_level as keyof typeof SPICE_COLORS] }" class="text-xs ml-0.5">{{ SPICE_LABELS[dish.spice_level as keyof typeof SPICE_LABELS] }}</span>×{{ dish.qty_ordered }}</template>
      </div>
      <div v-if="table.unserved_count === 0 && table.status === 'pending_checkout'" class="space-y-2">
        <div class="text-sm text-[var(--status-checkout-text)] font-bold">待结账</div>
        <n-button
          type="success"
          size="small"
          class="w-full"
          @click.stop="$emit('checkout', table.session_id!)"
        >已结账</n-button>
      </div>
      <div v-else-if="table.unserved_count === 0 && table.total_cents === 0" class="space-y-2">
        <div class="text-sm text-[var(--text-secondary)]">等待点餐</div>
        <n-button
          v-if="!manageMode"
          type="warning"
          size="small"
          secondary
          class="w-full"
          @click.stop="$emit('cancel', table.session_id!)"
        >取消点餐</n-button>
      </div>
      <div v-else-if="table.unserved_count === 0" class="text-sm text-[var(--text-secondary)]">
        全部已上菜
      </div>
    </div>

    <div
      v-if="table.status !== 'idle' && (table.dishes?.length ?? 0) > 0"
      class="mt-2 -mx-5 -mb-5 h-11 flex items-center justify-center gap-1.5
             card-footer-gradient rounded-b-[var(--radius-lg)]
             cursor-pointer transition-all duration-200
             active:scale-[0.97] active:opacity-80
             hover:brightness-110"
      role="button"
      tabindex="0"
      aria-haspopup="dialog"
      @click.stop="showDetails = true"
      @keydown.enter.stop="showDetails = true"
      @keydown.space.prevent.stop="showDetails = true"
    >
      <span class="text-xs font-medium text-[var(--primary)]">查看详情</span>
      <span class="text-[10px] text-[var(--primary)] opacity-60">(共{{ table.dishes.length }}项)</span>
      <span class="text-sm text-[var(--primary)] opacity-50">›</span>
    </div>

    <OrderDetailModal
      v-if="table.session_id"
      v-model:show="showDetails"
      :session-id="table.session_id"
      :table-no="table.table_no"
      @session-deleted="showDetails = false; emit('refresh')"
      @item-updated="emit('refresh')"
    />
  </div>
</template>