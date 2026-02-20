<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { NLayout, NLayoutSider, NInput, NInputNumber, NGrid, NGridItem, useMessage, useDialog, NButton, NModal } from 'naive-ui'
import { useMenuStore } from '../stores/menu'
import { useCartStore } from '../stores/cart'
import { useTableStore } from '../stores/tables'
import DishCard from '../components/business/DishCard.vue'
import CartPanel from '../components/business/CartPanel.vue'
import SpiceRadialMenu from '../components/business/SpiceRadialMenu.vue'
import { useStickySpice } from '../composables/useStickySpice'
import { pinyinMatch } from '../utils/search'
import { yuanToCents } from '../utils/currency'
import type { Dish, SpiceLevel } from '../types'

const route = useRoute()
const router = useRouter()
const message = useMessage()
const dialog = useDialog()
const menuStore = useMenuStore()
const cartStore = useCartStore()
const tableStore = useTableStore()
const { setSticky } = useStickySpice()

const tableId = Number(route.params.tableId)
const activeCategory = ref<number | 'all'>('all')
const searchText = ref('')
const showQuickAddModal = ref(false)
const quickAddForm = ref({ name: '', price: 0 })
const sessionReady = ref(false)

const spiceMenuVisible = ref(false)
const spiceDish = ref<Dish | null>(null)
const menuRect = ref<DOMRect | null>(null)

onMounted(async () => {
  // 切桌时立即清空残留购物车，防止订单提交到旧 session
  if (cartStore.tableId !== null && cartStore.tableId !== tableId) {
    cartStore.clear()
  }
  await menuStore.fetchMenu()
  if (!tableStore.tables.length) await tableStore.fetchTables()
  const table = tableStore.tables.find(t => t.id === tableId)
  if (table?.status === 'idle') {
    const sessionId = await tableStore.openTable(tableId)
    cartStore.setSession(sessionId, tableId)
  } else if (table?.session_id) {
    cartStore.setSession(table.session_id, tableId)
  }
  sessionReady.value = true
})

const currentTable = computed(() => tableStore.tables.find(t => t.id === tableId))

function formatTableName(tableNo?: string | null): string {
  if (!tableNo) return ''
  return /^\d+$/.test(tableNo) ? `${tableNo}号桌` : tableNo
}

function handleQuickAddConfirm() {
  if (quickAddForm.value.price > 0) {
    cartStore.addItem({
      id: -Date.now(),
      name: quickAddForm.value.name || '临时菜品',
      price_cents: yuanToCents(quickAddForm.value.price),
    })
    showQuickAddModal.value = false
    quickAddForm.value = { name: '', price: 0 }
  }
}

const filteredDishes = computed(() =>
  menuStore.dishes.filter(d => {
    if (!d.is_enabled) return false
    const matchCat = activeCategory.value === 'all' || d.category_id === activeCategory.value
    const matchSearch = !searchText.value || pinyinMatch(searchText.value, d.name)
    return matchCat && matchSearch
  })
)

async function handleBack() {
  const table = tableStore.tables.find(t => t.id === tableId)
  // 如果是新开的空桌台（无订单且未结账），提示取消会话
  if (table?.status === 'dining' && table.unserved_count === 0 && table.total_cents === 0) {
    dialog.warning({
      title: '取消点餐',
      content: '当前尚未下单，返回将取消本次点餐，是否确认？',
      positiveText: '确认取消',
      negativeText: '暂不取消',
      onPositiveClick: async () => {
        if (table.session_id) {
          await tableStore.cancelSession(table.session_id)
          message.success('已取消点餐')
        }
        router.push('/')
      }
    })
  } else {
    router.push('/')
  }
}

async function handleSubmit() {
  if (!sessionReady.value) return
  try {
    await cartStore.submitOrder()
    message.success('下单成功')
    router.push('/')
  } catch (e: any) {
    message.error(e.message)
  }
}

function handleOpenSpice(rect: DOMRect, dish: Dish) {
  menuRect.value = rect
  spiceDish.value = dish
  spiceMenuVisible.value = true
}

function handleSpiceSelect(level: SpiceLevel) {
  if (spiceDish.value) {
    cartStore.addItem(spiceDish.value, level)
    setSticky(spiceDish.value.id, level)
  }
  spiceMenuVisible.value = false
}

function getDishCount(dishId: number) {
  return cartStore.items.filter(i => i.dish_id === dishId).reduce((s, i) => s + i.quantity, 0)
}
</script>

<template>
  <n-layout class="h-screen bg-aurora" has-sider sider-placement="right">
    <div class="flex-1 flex flex-col h-full overflow-hidden bg-transparent">
      <header class="p-4 glass-l1 border-b border-[var(--glass-border-l1)] flex items-center justify-between shrink-0">
        <div class="flex items-center gap-4">
          <n-button quaternary @click="handleBack">← 返回</n-button>
          <h2 class="text-xl font-bold">{{ formatTableName(currentTable?.table_no) }} 点餐</h2>
        </div>
        <div class="flex items-center gap-2">
          <n-input v-model:value="searchText" placeholder="输入菜名或拼音首字母搜索" class="w-64" clearable />
          <n-button secondary @click="showQuickAddModal = true">临时加菜</n-button>
        </div>
      </header>
      <div class="flex flex-1 min-h-0 overflow-hidden">
        <div class="w-36 glass-l1 border-r border-[var(--glass-border-l1)] p-2 space-y-1 overflow-y-auto shrink-0">
          <div
            v-for="cat in [{ id: 'all' as const, name: '全部' }, ...menuStore.categories]"
            :key="cat.id"
            class="p-3 rounded-xl cursor-pointer transition-colors text-sm"
            :class="activeCategory === cat.id ? 'bg-[var(--primary)] text-white font-bold' : 'hover:bg-[var(--action-bg)]'"
            @click="activeCategory = cat.id as any"
          >{{ cat.name }}</div>
        </div>
        <main class="flex-1 min-h-0 p-6 overflow-y-auto">
          <n-grid x-gap="16" y-gap="16" cols="2 l:3 xl:4" responsive="screen">
            <n-grid-item v-for="dish in filteredDishes" :key="dish.id">
              <DishCard
                :dish="dish"
                :count="getDishCount(dish.id)"
                :has-spice-option="!!dish.has_spice_option"
                @add="(d, s) => cartStore.addItem(d, s)"
                @open-spice="handleOpenSpice"
              />
            </n-grid-item>
          </n-grid>
        </main>
      </div>
    </div>
    <n-layout-sider width="350" :native-scrollbar="false" class="glass-l3 shadow-2xl">
      <CartPanel @submit="handleSubmit" />
    </n-layout-sider>
  </n-layout>

  <n-modal v-model:show="showQuickAddModal" preset="dialog" title="临时加菜" positive-text="确定" @positive-click="handleQuickAddConfirm">
    <div class="mt-4 space-y-4">
      <div>
        <label class="block text-sm font-medium mb-1">名称</label>
        <n-input v-model:value="quickAddForm.name" placeholder="请输入菜品名称" />
      </div>
      <div>
        <label class="block text-sm font-medium mb-1">单价 (元)</label>
        <n-input-number
          v-model:value="quickAddForm.price"
          :min="0"
          :precision="2"
          class="w-full"
          placeholder="请输入金额"
        />
      </div>
    </div>
  </n-modal>

  <SpiceRadialMenu
    :visible="spiceMenuVisible"
    :anchor-rect="menuRect"
    @select="handleSpiceSelect"
    @cancel="spiceMenuVisible = false"
  />
</template>
