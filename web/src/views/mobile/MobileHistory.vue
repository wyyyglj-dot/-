<script setup lang="ts">
import { ref, reactive, onMounted, onUnmounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useMessage, useDialog } from 'naive-ui'
import * as historyApi from '../../api/history'
import { sseClient } from '../../api/sse'
import { centsToYuan } from '../../utils/currency'
import { useActionLock } from '../../composables/useActionLock'
import MobileNav from '../../components/layout/MobileNav.vue'
import ThemeToggle from '../../components/common/ThemeToggle.vue'
import type { ClosedSessionListItem, ClosedSessionDetail } from '../../types'

const router = useRouter()
const message = useMessage()
const dialog = useDialog()
const { locked, execute } = useActionLock()

// State
const activeTab = ref<'today' | 'week' | 'month'>('today')
const list = ref<ClosedSessionListItem[]>([])
const loading = ref(false)
const page = ref(1)
const PAGE_SIZE = 20
const total = ref(0)
const hasMore = computed(() => list.value.length < total.value)

// Detail Drawer State
const showDrawer = ref(false)
const drawerDetail = ref<ClosedSessionDetail | null>(null)
const drawerLoading = ref(false)
const detailCache = reactive<Record<number, ClosedSessionDetail>>({})
let listSeq = 0
let detailSeq = 0
let clearTimer: ReturnType<typeof setTimeout> | null = null

// Constants
const paymentMap: Record<string, string> = { 
  CASH: '现金', 
  WECHAT: '微信', 
  ALIPAY: '支付宝' 
}

// Date Helpers
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

// Data Loading
async function loadData(reset = false) {
  if (loading.value && !reset) return
  const seq = ++listSeq
  loading.value = true

  if (reset) {
    page.value = 1
    total.value = 0
    list.value = []
  }
  const currentPage = page.value
  const currentTab = activeTab.value

  try {
    let from = todayStr()
    if (currentTab === 'week') from = weekAgoStr()
    else if (currentTab === 'month') from = monthStartStr()

    const res = await historyApi.getClosedSessions({
      page: currentPage,
      pageSize: PAGE_SIZE,
      from,
      to: todayStr()
    })

    if (seq !== listSeq || !res) return
    list.value = currentPage === 1 ? res.list : [...list.value, ...res.list]
    total.value = res.total
    page.value = currentPage + 1
  } catch (err) {
    if (seq === listSeq) {
      message.error('加载历史记录失败')
      console.error(err)
    }
  } finally {
    if (seq === listSeq) loading.value = false
  }
}

function handleTabChange(tab: 'today' | 'week' | 'month') {
  activeTab.value = tab
  loadData(true)
}

// Detail View
async function openDetail(id: number) {
  if (clearTimer) { clearTimeout(clearTimer); clearTimer = null }
  showDrawer.value = true
  const seq = ++detailSeq
  if (detailCache[id]) {
    drawerLoading.value = false
    drawerDetail.value = detailCache[id]
    return
  }
  drawerLoading.value = true
  drawerDetail.value = null
  try {
    const detail = await historyApi.getSessionDetail(id)
    if (seq !== detailSeq) return
    detailCache[id] = detail
    drawerDetail.value = detail
  } catch {
    if (seq !== detailSeq) return
    message.error('加载详情失败')
    showDrawer.value = false
  } finally {
    if (seq === detailSeq) drawerLoading.value = false
  }
}

function closeDrawer() {
  showDrawer.value = false
  detailSeq++
  if (clearTimer) clearTimeout(clearTimer)
  clearTimer = setTimeout(() => {
    if (!showDrawer.value) drawerDetail.value = null
    clearTimer = null
  }, 300)
}

// Operations
function handleRestore() {
  if (!drawerDetail.value) return
  const sessionId = drawerDetail.value.session.id

  dialog.warning({
    title: '确认恢复',
    content: '恢复后原结账记录将被移除，确定要恢复此订单吗？',
    positiveText: '确定恢复',
    negativeText: '取消',
    onPositiveClick: () => {
      execute(async () => {
        try {
          await historyApi.restoreSession(sessionId)
          message.success('桌位已恢复')
          router.push('/m')
        } catch (err: any) {
          if (err.code === 'ACTIVE_SESSION_EXISTS') {
            message.error('该桌位已有进行中的会话')
          } else if (err.code === 'SESSION_NOT_CLOSED') {
            message.error('该会话状态异常，无法恢复')
          } else {
            message.error(err.message || '恢复失败')
          }
        }
      })
    },
  })
}

function handleDelete() {
  if (!drawerDetail.value) return
  const sessionId = drawerDetail.value.session.id

  dialog.error({
    title: '确认删除',
    content: '删除后将影响统计数据且不可恢复，确定要删除吗？',
    positiveText: '确定删除',
    negativeText: '取消',
    onPositiveClick: () => {
      execute(async () => {
        try {
          await historyApi.deleteSession(sessionId)
          message.success('记录已删除')
          delete detailCache[sessionId]
          list.value = list.value.filter(i => i.session_id !== sessionId)
          total.value = Math.max(0, total.value - 1)
          closeDrawer()
        } catch (err: any) {
          message.error(err.message || '删除失败')
        }
      })
    },
  })
}

// Lifecycle
const unsubscribers: Array<() => void> = []

onMounted(() => {
  loadData(true)
  sseClient.connect()
  unsubscribers.push(
    sseClient.on('checkout.completed', () => loadData(true)),
    sseClient.on('reconnected', () => loadData(true)),
  )
})

onUnmounted(() => {
  unsubscribers.forEach(fn => fn())
  if (clearTimer) { clearTimeout(clearTimer); clearTimer = null }
})

// Helpers for detail view
function formatTime(iso: string) {
  if (!iso) return ''
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function formatFullTime(iso: string) {
  if (!iso) return ''
  return new Date(iso).toLocaleString([], { 
    month: 'numeric', 
    day: 'numeric', 
    hour: '2-digit', 
    minute: '2-digit' 
  })
}
</script>

<template>
  <div class="min-h-[100dvh] flex flex-col bg-aurora">
    <!-- Header -->
    <header class="flex-none p-4 glass-l1 border-b border-[var(--glass-border-l1)] flex justify-between items-center">
      <h1 class="text-xl font-black text-[var(--primary)]">历史记录</h1>
      <ThemeToggle />
    </header>

    <!-- Content -->
    <div class="flex-1 overflow-y-auto">
      <!-- Tabs -->
      <div class="px-4 pt-2 pb-0">
        <div class="flex gap-2">
          <button
            v-for="tab in [{ key: 'today', label: '今日' }, { key: 'week', label: '本周' }, { key: 'month', label: '本月' }]"
            :key="tab.key"
            class="px-4 py-1.5 rounded-full text-sm font-medium transition-colors"
            :class="activeTab === tab.key ? 'bg-[var(--primary)] text-white shadow-lg shadow-orange-500/20' : 'bg-[var(--action-bg)] border border-[var(--action-border)] text-[var(--text-secondary)]'"
            @click="handleTabChange(tab.key as any)"
          >{{ tab.label }}</button>
        </div>
      </div>

      <!-- List -->
      <div class="p-4 space-y-3 pb-20">
        <div 
          v-for="item in list" 
          :key="item.session_id"
          class="glass-l1 p-4 rounded-xl active:scale-[0.98] transition-transform cursor-pointer border border-[var(--glass-border-l1)]"
          @click="openDetail(item.session_id)"
        >
          <div class="flex justify-between items-start mb-2">
            <div class="font-bold text-lg text-[var(--text-primary)]">
              {{ item.table_no }}号桌
            </div>
            <div class="text-xl font-black text-[var(--primary)]">
              {{ centsToYuan(item.amount_cents) }}
            </div>
          </div>
          
          <div class="flex justify-between items-center text-xs text-[var(--text-secondary)]">
            <div class="flex items-center gap-2">
              <span>{{ formatFullTime(item.closed_at) }}</span>
            </div>
            <div 
              v-if="item.payment_method"
              class="px-2 py-0.5 rounded text-[10px] font-bold border"
              :class="{
                'bg-green-500/10 text-green-600 border-green-200': item.payment_method === 'WECHAT',
                'bg-blue-500/10 text-blue-600 border-blue-200': item.payment_method === 'ALIPAY',
                'bg-orange-500/10 text-orange-600 border-orange-200': item.payment_method === 'CASH',
              }"
            >
              {{ paymentMap[item.payment_method] }}
            </div>
          </div>
        </div>

        <!-- Empty State -->
        <div v-if="!loading && list.length === 0" class="flex flex-col items-center justify-center py-12 text-[var(--text-muted)]">
          <div class="text-4xl mb-2">📜</div>
          <div class="text-sm">暂无历史订单</div>
        </div>

        <!-- Load More -->
        <div v-if="hasMore" class="py-4 flex justify-center">
          <button 
            @click="loadData(false)"
            :disabled="loading"
            class="px-6 py-2 rounded-full text-sm font-medium bg-[var(--action-bg)] text-[var(--text-secondary)] border border-[var(--action-border)] active:bg-[var(--action-bg-hover)] disabled:opacity-50"
          >
            {{ loading ? '加载中...' : '加载更多' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Drawer Overlay -->
    <div
      class="fixed inset-0 bg-black/50 z-[60] transition-opacity duration-300"
      :class="showDrawer ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'"
      @click="closeDrawer"
    ></div>

    <!-- Detail Drawer -->
    <div
      class="fixed bottom-0 left-0 right-0 h-[70vh] glass-l3 z-[70] rounded-t-3xl flex flex-col shadow-2xl transition-transform duration-300"
      :class="showDrawer ? 'translate-y-0' : 'translate-y-full'"
    >
      <div class="flex-none p-4 flex justify-between items-center border-b border-[var(--glass-border-l1)]">
        <h2 class="font-bold text-lg">订单详情</h2>
        <button
          @click="closeDrawer"
          class="w-8 h-8 rounded-full bg-[var(--action-bg)] flex items-center justify-center text-[var(--text-secondary)]"
        >✕</button>
      </div>

      <div class="flex-1 overflow-y-auto p-4" v-if="drawerDetail">
        <!-- Summary -->
        <div class="glass-l1 rounded-xl p-4 mb-4 border border-[var(--glass-border-l1)]">
          <div class="flex justify-between items-center mb-3">
            <span class="text-[var(--text-secondary)]">桌号</span>
            <span class="font-bold text-lg">{{ drawerDetail.session.table_no }}号桌</span>
          </div>
          <div class="flex justify-between items-center mb-3">
            <span class="text-[var(--text-secondary)]">时间</span>
            <span class="text-sm font-medium">
              {{ formatTime(drawerDetail.session.opened_at) }} -
              {{ drawerDetail.session.closed_at ? formatTime(drawerDetail.session.closed_at) : '' }}
            </span>
          </div>
          <div class="flex justify-between items-center mb-3">
            <span class="text-[var(--text-secondary)]">支付方式</span>
            <span class="font-medium text-[var(--primary)]">
              {{ drawerDetail.payment ? paymentMap[drawerDetail.payment.method] : '-' }}
            </span>
          </div>
          <div class="border-t border-dashed border-[var(--glass-border-l1)] my-3"></div>
          <div class="flex justify-between items-center">
            <span class="font-bold">总计</span>
            <span class="text-2xl font-black text-[var(--primary)]">
              {{ centsToYuan(drawerDetail.total_cents) }}
            </span>
          </div>
        </div>

        <!-- Dish Items -->
        <div>
          <h3 class="font-bold text-sm text-[var(--text-secondary)] mb-3">菜品明细</h3>
          <div class="glass-l2 rounded-xl p-2 space-y-1">
            <template v-for="ticket in drawerDetail.tickets" :key="ticket.id">
              <div
                v-for="item in ticket.items"
                :key="item.id"
                class="flex justify-between items-center p-2"
              >
                <div class="flex-1">
                  <div class="font-medium">{{ item.dish_name_snapshot }}</div>
                  <div v-if="item.spice_level" class="text-xs text-[var(--text-muted)]">
                    {{ item.spice_level }}
                  </div>
                </div>
                <div class="text-right">
                  <div class="text-sm font-bold">x{{ item.qty_ordered }}</div>
                  <div class="text-xs text-[var(--text-secondary)]">
                    {{ centsToYuan(item.unit_sell_price_cents * (item.qty_ordered - item.qty_voided)) }}
                  </div>
                </div>
              </div>
            </template>
          </div>
        </div>
      </div>

      <div v-else-if="drawerLoading" class="flex-1 flex items-center justify-center">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--primary)]"></div>
      </div>

      <!-- Actions -->
      <div v-if="drawerDetail" class="flex-none p-4 border-t border-[var(--glass-border-l1)]">
        <div class="grid grid-cols-2 gap-3">
          <button
            @click="handleDelete"
            class="py-3 rounded-xl font-bold bg-red-500/10 text-red-500 border border-red-500/20 active:bg-red-500/20 transition-colors disabled:opacity-50"
            :disabled="locked"
          >删除记录</button>
          <button
            @click="handleRestore"
            class="py-3 rounded-xl font-bold bg-[var(--primary)] text-white shadow-lg shadow-orange-500/20 active:opacity-90 transition-opacity disabled:opacity-50"
            :disabled="locked"
          >恢复订单</button>
        </div>
      </div>
    </div>

    <MobileNav />
  </div>
</template>
