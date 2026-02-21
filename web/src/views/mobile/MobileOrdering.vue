<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { NButton, NDrawer, NDrawerContent, NInput, NInputNumber, NModal, NSpin, NTag, useMessage } from 'naive-ui'
import { useMenuStore } from '../../stores/menu'
import { useCartStore } from '../../stores/cart'
import { useTableStore } from '../../stores/tables'
import CategoryTabs from '../../components/business/CategoryTabs.vue'
import DishCard from '../../components/business/DishCard.vue'
import SpiceRadialMenu from '../../components/business/SpiceRadialMenu.vue'
import QuantityStepper from '../../components/common/QuantityStepper.vue'
import PriceDisplay from '../../components/common/PriceDisplay.vue'
import ThemeToggle from '../../components/common/ThemeToggle.vue'
import { useStickySpice } from '../../composables/useStickySpice'
import { useActionLock } from '../../composables/useActionLock'
import { yuanToCents } from '../../utils/currency'
import { SPICE_LABELS, SPICE_COLORS, type Dish, type SpiceLevel } from '../../types'

const route = useRoute()
const router = useRouter()
const message = useMessage()
const menuStore = useMenuStore()
const cartStore = useCartStore()
const tableStore = useTableStore()
const { setSticky } = useStickySpice()
const { locked: submitLocked, execute: executeSubmit } = useActionLock()

const tableId = Number(route.params.tableId)
const activeCategory = ref<number | 'all'>('all')
const showCart = ref(false)
const loading = ref(true)
const showQuickAddModal = ref(false)
const quickAddForm = ref({ name: '', price: 0 })

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
  loading.value = false
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

const filteredDishes = computed(() => {
  const ds = menuStore.dishes.filter(d => d.is_enabled)
  if (activeCategory.value === 'all') return ds
  return ds.filter(d => d.category_id === activeCategory.value)
})

async function handleSubmit() {
  await executeSubmit(async () => {
    try {
      await cartStore.submitOrder()
      message.success('下单成功')
      router.push('/m')
    } catch (e: any) {
      message.error(e.message)
    }
  })
}

function isSkipQueue(dishId: number | null) {
  if (!dishId) return false
  const dish = menuStore.dishes.find(d => d.id === dishId)
  if (!dish) return false
  const cat = menuStore.categories.find(c => c.id === dish.category_id)
  return !!cat?.skip_queue
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
  <div class="min-h-[100dvh] bg-aurora flex flex-col">
    <header class="flex-none h-14 px-4 glass-l1 border-b border-[var(--glass-border-l1)] flex items-center justify-between sticky top-0 z-30">
      <n-button quaternary @click="router.push('/m')">←</n-button>
      <div class="font-bold text-lg">{{ formatTableName(currentTable?.table_no) }}</div>
      <div class="flex items-center gap-2">
        <ThemeToggle />
        <n-button quaternary circle @click="showQuickAddModal = true">+</n-button>
      </div>
    </header>

    <CategoryTabs :categories="menuStore.categories" v-model:active="activeCategory" />

    <div class="flex-1 min-h-0">
      <n-spin :show="loading" :content-style="{ minHeight: '100%' }">
        <div class="p-3 grid grid-cols-2 gap-3 pb-24 min-h-full content-start">
          <DishCard
            v-for="dish in filteredDishes"
            :key="dish.id"
            :dish="dish"
            :count="getDishCount(dish.id)"
            :has-spice-option="!!dish.has_spice_option"
            @add="(d, s) => cartStore.addItem(d, s)"
            @open-spice="handleOpenSpice"
            compact
          />
        </div>
      </n-spin>
    </div>

    <div class="fixed bottom-0 left-0 right-0 glass-l3 p-4 z-30 border-t border-[var(--glass-border-l1)]" style="box-shadow: var(--nav-shadow)">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2" @click="showCart = true">
          <div class="relative">
            <span class="text-2xl">🛒</span>
            <span
              v-if="cartStore.itemCount > 0"
              class="absolute -top-1 -right-2 bg-[var(--primary)] text-white text-[10px] rounded-full w-5 h-5 flex items-center justify-center font-bold"
            >{{ cartStore.itemCount }}</span>
          </div>
          <PriceDisplay :cents="cartStore.totalCents" class="text-2xl" />
        </div>
        <n-button
          type="primary" size="large"
          class="px-8 font-bold rounded-full"
          :disabled="cartStore.items.length === 0 || loading || submitLocked"
          @click="handleSubmit"
        >下单并起菜</n-button>
      </div>
    </div>

    <n-drawer v-model:show="showCart" placement="bottom" :height="400" class="rounded-t-2xl">
      <n-drawer-content title="已选菜品" closable>
        <div v-for="item in cartStore.items" :key="item._key" class="flex justify-between items-center py-4 border-b border-[var(--glass-border-l1)] last:border-0">
          <div>
            <div class="font-bold text-lg flex items-center gap-1">
              {{ item.name }}
              <n-tag
                v-if="item.spice_level"
                :color="{ color: '#fff0', textColor: SPICE_COLORS[item.spice_level as keyof typeof SPICE_COLORS], borderColor: SPICE_COLORS[item.spice_level as keyof typeof SPICE_COLORS] }"
                size="small" :bordered="true" class="scale-75 origin-left"
              >{{ SPICE_LABELS[item.spice_level as keyof typeof SPICE_LABELS] }}</n-tag>
              <n-tag v-if="isSkipQueue(item.dish_id)" type="info" size="small" :bordered="false" class="scale-75 origin-left">免排</n-tag>
            </div>
            <PriceDisplay :cents="item.price_cents" class="text-sm" />
          </div>
          <QuantityStepper :value="item.quantity" @update:value="q => cartStore.updateQty(item._key, q)" />
        </div>
        <template #footer>
          <div class="flex justify-between items-center w-full">
            <n-button quaternary type="error" @click="cartStore.clear()">清空</n-button>
            <n-button type="primary" size="large" class="px-10" @click="showCart = false">确定</n-button>
          </div>
        </template>
      </n-drawer-content>
    </n-drawer>
  </div>

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
