<script setup lang="ts">
import { NButton, NEmpty, NScrollbar, NTag } from 'naive-ui'
import { useCartStore } from '../../stores/cart'
import { useMenuStore } from '../../stores/menu'
import { SPICE_LABELS, SPICE_COLORS } from '../../types'
import QuantityStepper from '../common/QuantityStepper.vue'
import PriceDisplay from '../common/PriceDisplay.vue'

const cart = useCartStore()
const menuStore = useMenuStore()
defineEmits<{ submit: [] }>()

function isSkipQueue(dishId: number | null) {
  if (!dishId) return false
  const dish = menuStore.dishes.find(d => d.id === dishId)
  if (!dish) return false
  const cat = menuStore.categories.find(c => c.id === dish.category_id)
  return !!cat?.skip_queue
}
</script>

<template>
  <div class="flex flex-col h-full glass-l3 border-l border-[var(--glass-border-l1)]">
    <div class="p-4 border-b border-[var(--glass-border-l1)] font-bold text-lg flex justify-between items-center">
      <span>已选菜品 ({{ cart.itemCount }})</span>
      <n-button quaternary size="small" type="error" @click="cart.clear()">清空</n-button>
    </div>

    <n-scrollbar class="flex-1">
      <div class="p-4">
        <div v-if="cart.items.length === 0" class="py-16 flex items-center justify-center">
          <n-empty description="还没点餐哦" />
        </div>
        <div v-for="item in cart.items" :key="item._key" class="flex justify-between items-center mb-4">
          <div class="flex-1 min-w-0 mr-2">
            <div class="flex items-center gap-2">
              <span class="font-medium truncate">{{ item.name }}</span>
              <NTag
                v-if="item.spice_level"
                :color="{ color: '#fff0', textColor: SPICE_COLORS[item.spice_level as keyof typeof SPICE_COLORS], borderColor: SPICE_COLORS[item.spice_level as keyof typeof SPICE_COLORS] }"
                size="small" :bordered="true" class="scale-75 origin-left"
              >{{ SPICE_LABELS[item.spice_level as keyof typeof SPICE_LABELS] }}</NTag>
              <NTag v-if="isSkipQueue(item.dish_id)" type="info" size="small" class="scale-75 origin-left" :bordered="false">免排</NTag>
            </div>
            <PriceDisplay :cents="item.price_cents" class="text-sm" />
          </div>
          <QuantityStepper :value="item.quantity" @update:value="q => cart.updateQty(item._key, q)" />
        </div>
      </div>
    </n-scrollbar>

    <div class="p-6 border-t border-[var(--glass-border-l1)] bg-[var(--action-bg)]">
      <div class="flex justify-between items-end mb-4">
        <span class="text-[var(--text-secondary)]">合计</span>
        <PriceDisplay :cents="cart.totalCents" class="text-2xl" />
      </div>
      <n-button type="primary" block size="large" :disabled="cart.items.length === 0" @click="$emit('submit')">
        下单并起菜
      </n-button>
    </div>
  </div>
</template>
