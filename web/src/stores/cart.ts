import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { CartItem, Dish } from '../types'
import { createTicket } from '../api/orders'
import { useMenuStore } from './menu'

export const useCartStore = defineStore('cart', () => {
  const sessionId = ref<number | null>(null)
  const tableId = ref<number | null>(null)
  const items = ref<CartItem[]>([])
  let tempKeySeed = 0

  const totalCents = computed(() =>
    items.value.reduce((sum, i) => sum + i.price_cents * i.quantity, 0)
  )
  const itemCount = computed(() =>
    items.value.reduce((sum, i) => sum + i.quantity, 0)
  )

  function setSession(sid: number, tid: number) {
    sessionId.value = sid
    tableId.value = tid
  }

  function nextTempKey(): string {
    tempKeySeed += 1
    return `tmp_${Date.now()}_${tempKeySeed}`
  }

  function migrateLegacyItems() {
    let changed = false
    items.value = items.value.map(item => {
      if (item._key) return item
      changed = true
      return {
        ...item,
        _key: item.dish_id !== null ? String(item.dish_id) : nextTempKey(),
      }
    })
    return changed
  }

  migrateLegacyItems()

  function addItem(dish: Dish | { id: number; name: string; price_cents: number }, spiceLevel?: string | null) {
    if ('sell_price_cents' in dish) {
      const itemKey = spiceLevel ? `${dish.id}_${spiceLevel}` : String(dish.id)
      const existing = items.value.find(i => i._key === itemKey)
      if (existing) {
        existing.quantity++
        return
      }

      const menuStore = useMenuStore()
      const category = menuStore.categories.find(c => c.id === dish.category_id)
      let finalPrice = dish.sell_price_cents

      if (dish.is_discount_enabled && dish.discount_rate > 0 && dish.discount_rate < 1) {
        finalPrice = Math.round(dish.sell_price_cents * dish.discount_rate)
      } else if (category?.is_discount_enabled && category.discount_rate > 0 && category.discount_rate < 1) {
        finalPrice = Math.round(dish.sell_price_cents * category.discount_rate)
      }

      items.value.push({
        _key: itemKey,
        dish_id: dish.id,
        name: dish.name,
        price_cents: finalPrice,
        cost_cents: dish.cost_price_cents,
        quantity: 1,
        spice_level: spiceLevel || null,
      })
      return
    }

    items.value.push({
      _key: nextTempKey(),
      dish_id: null,
      name: (dish.name || '').trim() || '临时菜品',
      price_cents: dish.price_cents,
      cost_cents: 0,
      quantity: 1,
    })
  }

  function removeItem(itemKey: string) {
    if (!itemKey) return
    items.value = items.value.filter(i => i._key !== itemKey)
  }

  function updateQty(itemKey: string, qty: number) {
    if (!itemKey) return
    if (qty <= 0) return removeItem(itemKey)
    const item = items.value.find(i => i._key === itemKey)
    if (item) item.quantity = qty
  }

  async function submitOrder(): Promise<number> {
    if (!sessionId.value) throw new Error('未关联会话，请返回重新选桌')
    if (items.value.length === 0) throw new Error('购物车为空')
    const ticketItems = items.value.map(i => ({
      dish_id: i.dish_id,
      name: i.dish_id ? undefined : i.name,
      sell_price_cents: i.dish_id ? undefined : i.price_cents,
      cost_price_cents: i.dish_id ? undefined : i.cost_cents,
      qty: i.quantity,
      spice_level: i.spice_level,
    }))
    const result = await createTicket(sessionId.value, ticketItems)
    items.value = []
    return result.ticket_id
  }

  function clear() {
    items.value = []
  }

  function reset() {
    sessionId.value = null
    tableId.value = null
    items.value = []
  }

  return {
    sessionId, tableId, items,
    totalCents, itemCount,
    setSession, addItem, removeItem, updateQty, submitOrder, clear, reset,
  }
}, {
  persist: true,
})
