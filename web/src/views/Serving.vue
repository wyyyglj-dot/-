<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { NLayout, NLayoutSider, NLayoutContent } from 'naive-ui'
import AppSidebar from '../components/layout/AppSidebar.vue'
import ServingQueue from '../components/business/ServingQueue.vue'
import { useOrderStore } from '../stores/orders'
import { sseClient } from '../api/sse'

const orderStore = useOrderStore()
let unsubs: (() => void)[] = []

onMounted(() => {
  orderStore.fetchServingQueue()
  sseClient.connect()
  unsubs.push(
    sseClient.on('serving.updated', (data: any) => {
      if (orderStore.isLocalOpDebouncing()) return
      orderStore.handleServingUpdated(data)
    }),
    sseClient.on('ticket.created', () => orderStore.debouncedRefetch()),
    sseClient.on('session.deleted', (data: any) => orderStore.removeBySessionId(data.session_id)),
  )
})

onUnmounted(() => {
  unsubs.forEach(fn => fn())
})
</script>

<template>
  <n-layout has-sider class="h-screen bg-aurora">
    <n-layout-sider width="200" :native-scrollbar="false" content-style="height: 100%"><AppSidebar /></n-layout-sider>
    <n-layout-content class="p-8">
      <div class="max-w-4xl mx-auto">
        <div class="flex justify-between items-center mb-8">
          <h2 class="text-2xl font-bold">上菜队列</h2>
          <div class="text-[var(--text-secondary)] text-sm">按下单时间排序</div>
        </div>
        <ServingQueue />
      </div>
    </n-layout-content>
  </n-layout>
</template>
