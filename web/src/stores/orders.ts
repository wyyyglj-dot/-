import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { ServingQueueItem, ServedItem } from '../types'
import * as api from '../api/serving'

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
    try {
      await api.markServed(itemId, qty)
      servingQueue.value = servingQueue.value.filter(i => i.item_id !== itemId)
    } catch (e: any) {
      console.error('[orders] markServed failed:', e)
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

  return {
    servingQueue, servingLoading, servingError, fetchServingQueue, markServed,
    servedItems, servedLoading, servedError, fetchServedItems, unserveItem,
  }
})
