<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { NLayout, NLayoutSider, NLayoutContent, NGrid, NGridItem, NStatistic, NCard, NRadioGroup, NRadioButton } from 'naive-ui'
import AppSidebar from '../components/layout/AppSidebar.vue'
import * as api from '../api/stats'
import { sseClient } from '../api/sse'
import type { DashboardData } from '../types'
import { centsToYuan } from '../utils/currency'

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

const tabLabel = (suffix: string) => {
  const prefix = activeTab.value === 'today' ? '今日' : activeTab.value === 'week' ? '本周' : '本月'
  return prefix + suffix
}

async function refreshDashboard() {
  let from = todayStr()
  if (activeTab.value === 'week') from = weekAgoStr()
  else if (activeTab.value === 'month') from = monthStartStr()
  dashboard.value = await api.getDashboard(from, todayStr())
}

const unsubscribers: Array<() => void> = []

onMounted(async () => {
  await refreshDashboard()
  sseClient.connect()
  unsubscribers.push(sseClient.on('checkout.completed', refreshDashboard))
  unsubscribers.push(sseClient.on('session.opened', refreshDashboard))
})

onUnmounted(() => {
  unsubscribers.forEach(fn => fn())
})
</script>

<template>
  <n-layout has-sider class="h-screen bg-aurora">
    <n-layout-sider width="200" :native-scrollbar="false" content-style="height: 100%"><AppSidebar /></n-layout-sider>
    <n-layout-content class="p-8">
      <div class="max-w-6xl mx-auto">
        <div class="flex justify-between items-center mb-8">
          <h2 class="text-2xl font-bold">营业统计</h2>
          <n-radio-group v-model:value="activeTab" size="medium" @update:value="refreshDashboard">
            <n-radio-button value="today">今日</n-radio-button>
            <n-radio-button value="week">本周</n-radio-button>
            <n-radio-button value="month">本月</n-radio-button>
          </n-radio-group>
        </div>

        <n-grid x-gap="16" y-gap="16" cols="1 m:2 l:3" responsive="screen" class="mb-8">
          <n-grid-item>
            <n-card>
              <n-statistic :label="tabLabel('营收')">
                <template #prefix>¥</template>
                {{ dashboard ? (dashboard.revenue_cents / 100).toFixed(2) : '0.00' }}
              </n-statistic>
            </n-card>
          </n-grid-item>
          <n-grid-item>
            <n-card>
              <n-statistic :label="tabLabel('利润')">
                <template #prefix>¥</template>
                {{ dashboard ? (dashboard.profit_cents / 100).toFixed(2) : '0.00' }}
              </n-statistic>
            </n-card>
          </n-grid-item>
          <n-grid-item>
            <n-card><n-statistic label="订单数" :value="dashboard?.order_count ?? 0" /></n-card>
          </n-grid-item>
        </n-grid>

        <n-grid x-gap="16" y-gap="16" cols="1 m:2 l:3" responsive="screen">
          <n-grid-item>
            <n-card title="销量排行">
              <div v-for="(item, idx) in dashboard?.quantity_ranking" :key="item.name" class="flex justify-between py-2 border-b border-[var(--glass-border-l1)] last:border-0">
                <span>{{ idx + 1 }}. {{ item.name }}</span>
                <span class="font-bold">{{ item.value }}份</span>
              </div>
            </n-card>
          </n-grid-item>
          <n-grid-item>
            <n-card title="销售额排行">
              <div v-for="(item, idx) in dashboard?.revenue_ranking" :key="item.name" class="flex justify-between py-2 border-b border-[var(--glass-border-l1)] last:border-0">
                <span>{{ idx + 1 }}. {{ item.name }}</span>
                <span class="font-bold text-[var(--primary)]">{{ centsToYuan(item.value) }}</span>
              </div>
            </n-card>
          </n-grid-item>
          <n-grid-item>
            <n-card title="利润排行">
              <div v-for="(item, idx) in dashboard?.profit_ranking" :key="item.name" class="flex justify-between py-2 border-b border-[var(--glass-border-l1)] last:border-0">
                <span>{{ idx + 1 }}. {{ item.name }}</span>
                <span class="font-bold text-[var(--status-checkout-text)]">{{ centsToYuan(item.value) }}</span>
              </div>
            </n-card>
          </n-grid-item>
        </n-grid>
      </div>
    </n-layout-content>
  </n-layout>
</template>
