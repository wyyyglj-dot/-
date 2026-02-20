<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { useOrderStore } from '../../stores/orders'
import ServingQueue from '../../components/business/ServingQueue.vue'
import MobileNav from '../../components/layout/MobileNav.vue'
import ThemeToggle from '../../components/common/ThemeToggle.vue'
import { sseClient } from '../../api/sse'

const orderStore = useOrderStore()
let unsubs: (() => void)[] = []

onMounted(() => {
  orderStore.fetchServingQueue()
  sseClient.connect()
  unsubs.push(
    sseClient.on('serving.updated', () => orderStore.fetchServingQueue()),
    sseClient.on('ticket.created', () => orderStore.fetchServingQueue()),
  )
})

onUnmounted(() => {
  unsubs.forEach(fn => fn())
})
</script>

<template>
  <div class="min-h-[100dvh] flex flex-col bg-aurora">
    <header class="flex-none p-4 glass-l1 sticky top-0 z-10 border-b border-[var(--glass-border-l1)] flex justify-between items-center">
      <h1 class="text-xl font-black text-[var(--primary)]">上菜队列</h1>
      <div class="flex items-center gap-3">
        <ThemeToggle />
        <div class="bg-[var(--primary)] text-white px-2 py-0.5 rounded text-xs font-bold">
          {{ orderStore.servingQueue.length }} 待上菜
        </div>
      </div>
    </header>
    <div class="flex-1 overflow-y-auto pb-20">
      <ServingQueue />
    </div>
    <MobileNav />
  </div>
</template>
