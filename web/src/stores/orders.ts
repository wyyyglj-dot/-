import { defineStore } from 'pinia'
import { ref } from 'vue'
import { createDiscreteApi } from 'naive-ui'
import type { ServingQueueItem, ServedItem } from '../types'
import * as api from '../api/serving'

const { message } = createDiscreteApi(['message'])

let _localOpTimestamp = 0
let _debounceTimer: ReturnType<typeof setTimeout> | null = null

export const useOrderStore = defineStore('orders', () => {
  const servingQueue = ref<ServingQueueItem[]>([])
  const servingLoading = ref(false)
  const servingError = ref<string | null>(null)

  const servedItems = ref<ServedItem[]>([])
  const servedLoading = ref(false)
  const servedError = ref<string | null>(null)

  async function fetchServingQueue() {
    servingLoading.value = true
    servingError.value = null
    try {
      servingQueue.value = await api.getServingQueue()
    } catch (e: any) {
      servingError.value = e?.message || '获取上菜队列失败'
      console.error('[orders] fetchServingQueue failed:', e)
    } finally {
      servingLoading.value = false
    }
  }

  async function fetchServedItems() {
    servedLoading.value = true
    servedError.value = null
    try {
      servedItems.value = await api.getServedItems()
    } catch (e: any) {
      servedError.value = e?.message || '获取已上菜列表失败'
      console.error('[orders] fetchServedItems failed:', e)
    } finally {
      servedLoading.value = false
    }
  }

  async function markServed(itemId: number, qty?: number) {
    const snapshot = [...servingQueue.value]
    servingQueue.value = servingQueue.value.filter(i => i.item_id !== itemId)
    _localOpTimestamp = Date.now()
    try {
      await api.markServed(itemId, qty)
    } catch (e: any) {
      servingQueue.value = snapshot
      message.error('上菜失败，已恢复')
      throw e
    }
  }

  async function unserveItem(itemId: number, qty?: number) {
    try {
      await api.unserveItem(itemId, qty)
      servedItems.value = servedItems.value.filter(i => i.item_id !== itemId)
    } catch (e: any) {
      console.error('[orders] unserveItem failed:', e)
      throw e
    }
  }

  function isLocalOpDebouncing(): boolean {
    return Date.now() - _localOpTimestamp < 2000
  }

  function handleServingUpdated(data: { item_id: number; served_delta: number; pending_qty: number }) {
    if (data.served_delta > 0) {
      const idx = servingQueue.value.findIndex(i => i.item_id === data.item_id)
      if (idx >= 0) {
        if (data.pending_qty <= 0) {
          servingQueue.value.splice(idx, 1)
        } else {
          servingQueue.value[idx] = { ...servingQueue.value[idx], quantity: data.pending_qty }
        }
      }
    } else if (data.served_delta < 0) {
      const idx = servingQueue.value.findIndex(i => i.item_id === data.item_id)
      if (idx < 0) debouncedRefetch()
    }
  }

  function removeBySessionId(sessionId: number) {
    servingQueue.value = servingQueue.value.filter(i => i.session_id !== sessionId)
  }

  function debouncedRefetch() {
    if (_debounceTimer) clearTimeout(_debounceTimer)
    _debounceTimer = setTimeout(() => fetchServingQueue(), 500)
  }

  return {
    servingQueue, servingLoading, servingError, fetchServingQueue, markServed,
    servedItems, servedLoading, servedError, fetchServedItems, unserveItem,
    isLocalOpDebouncing, handleServingUpdated, removeBySessionId, debouncedRefetch,
  }
})
