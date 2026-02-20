<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import * as api from '../../api/stats'
import { sseClient } from '../../api/sse'
import { centsToYuan } from '../../utils/currency'
import MobileNav from '../../components/layout/MobileNav.vue'
import ThemeToggle from '../../components/common/ThemeToggle.vue'
import type { DashboardData } from '../../types'

const dashboard = ref<DashboardData | null>(null)
const activeTab = ref<'today' | 'week' | 'month'>('today')

function toLocalDateStr(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function todayStr() { return toLocalDateStr(new Date()) }
function weekAgoStr() {
  const d = new Date()
  d.setDate(d.getDate() - 7)
  return toLocalDateStr(d)
}
function monthStartStr() {
  const d = new Date()
  d.setDate(1)
  return toLocalDateStr(d)
}

async function loadData() {
  let from = todayStr()
  if (activeTab.value === 'week') from = weekAgoStr()
  else if (activeTab.value === 'month') from = monthStartStr()
  dashboard.value = await api.getDashboard(from, todayStr())
}

const unsubscribers: Array<() => void> = []

onMounted(() => {
  loadData()
  sseClient.connect()
  unsubscribers.push(sseClient.on('checkout.completed', loadData))
  unsubscribers.push(sseClient.on('session.opened', loadData))
})

onUnmounted(() => {
  unsubscribers.forEach(fn => fn())
})

function switchTab(tab: 'today' | 'week' | 'month') {
  activeTab.value = tab
  loadData()
}
</script>

<template>
  <div class="min-h-[100dvh] flex flex-col bg-aurora">
    <header class="flex-none p-4 glass-l1 border-b border-[var(--glass-border-l1)] flex justify-between items-center">
      <h1 class="text-xl font-black text-[var(--primary)]">营业统计</h1>
      <ThemeToggle />
    </header>
    <div class="flex-1 overflow-y-auto">
      <div class="px-4 pt-2 pb-0">
      <div class="flex gap-2">
        <button
          v-for="tab in [{ key: 'today', label: '今日' }, { key: 'week', label: '本周' }, { key: 'month', label: '本月' }]"
          :key="tab.key"
          class="px-4 py-1.5 rounded-full text-sm font-medium transition-colors"
          :class="activeTab === tab.key ? 'bg-[var(--primary)] text-white shadow-lg shadow-orange-500/20' : 'bg-[var(--action-bg)] border border-[var(--action-border)] text-[var(--text-secondary)]'"
          @click="switchTab(tab.key as any)"
        >{{ tab.label }}</button>
      </div>
    </div>

    <div class="p-4 space-y-4 pb-20">
      <div class="glass-l1 p-8 rounded-2xl shadow-sm text-center border-b-4 border-[var(--primary)]">
        <div class="text-[var(--text-secondary)] text-xs font-bold uppercase tracking-widest mb-2">
          {{ activeTab === 'today' ? '今日' : (activeTab === 'week' ? '本周' : '本月') }}营收
        </div>
        <div class="text-5xl font-black text-[var(--primary)] tracking-tighter">
          {{ centsToYuan(dashboard?.revenue_cents || 0) }}
        </div>
        <div class="text-[var(--text-secondary)] text-sm mt-2">共 {{ dashboard?.order_count || 0 }} 单</div>
      </div>

      <div class="glass-l1 p-6 rounded-2xl shadow-sm flex items-center justify-between border border-[var(--glass-border-l1)]">
        <div class="text-center flex-1">
          <div class="text-[var(--text-secondary)] text-xs font-bold mb-1">利润</div>
          <div class="text-2xl font-black text-[var(--status-checkout-text)]">{{ centsToYuan(dashboard?.profit_cents || 0) }}</div>
        </div>
        <div class="w-px h-10 bg-[var(--action-bg-hover)]"></div>
        <div class="text-center flex-1">
          <div class="text-[var(--text-secondary)] text-xs font-bold mb-1">成本</div>
          <div class="text-2xl font-black text-[var(--text-secondary)]">{{ centsToYuan(dashboard?.cost_cents || 0) }}</div>
        </div>
      </div>

      <div class="glass-l2 p-4 rounded-2xl shadow-sm border border-[var(--glass-border-l1)]">
        <div class="font-bold mb-4 border-l-4 border-[var(--primary)] pl-3">热销榜</div>
        <div v-for="(item, idx) in dashboard?.quantity_ranking" :key="item.name" class="flex items-center gap-4 py-3 border-b border-[var(--glass-border-l1)] last:border-0">
          <div class="w-6 text-center font-bold text-[var(--text-secondary)] text-lg">{{ idx + 1 }}</div>
          <div class="flex-1 font-medium">{{ item.name }}</div>
          <div class="text-[var(--primary)] font-bold">{{ item.value }}份</div>
        </div>
      </div>

      <div class="glass-l2 p-4 rounded-2xl shadow-sm border border-[var(--glass-border-l1)]">
        <div class="font-bold mb-4 border-l-4 border-[var(--status-checkout-border)] pl-3">利润榜</div>
        <div v-for="(item, idx) in dashboard?.profit_ranking" :key="item.name" class="flex items-center gap-4 py-3 border-b border-[var(--glass-border-l1)] last:border-0">
          <div class="w-6 text-center font-bold text-[var(--text-secondary)] text-lg">{{ idx + 1 }}</div>
          <div class="flex-1 font-medium">{{ item.name }}</div>
          <div class="text-[var(--status-checkout-text)] font-bold">{{ centsToYuan(item.value) }}</div>
        </div>
      </div>
    </div>
    </div>
    <MobileNav />
  </div>
</template>
