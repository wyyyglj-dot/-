<script setup lang="ts">
import { ref, computed } from 'vue'
import { NEmpty, NSpin, NButton } from 'naive-ui'
import { useOrderStore } from '../../stores/orders'
import ServingItem from './ServingItem.vue'

const orderStore = useOrderStore()
const activeTab = ref<'waiting' | 'served'>('waiting')

function switchTab(tab: 'waiting' | 'served') {
  activeTab.value = tab
  if (tab === 'served') {
    orderStore.fetchServedItems()
  } else {
    orderStore.fetchServingQueue()
  }
}

const isLoading = computed(() =>
  activeTab.value === 'waiting' ? orderStore.servingLoading : orderStore.servedLoading
)
const errorMsg = computed(() =>
  activeTab.value === 'waiting' ? orderStore.servingError : orderStore.servedError
)
</script>

<template>
  <div class="p-4">
    <div class="flex p-1 bg-[var(--status-idle-bg)] rounded-xl mb-4" role="tablist">
      <button
        role="tab"
        :aria-selected="activeTab === 'waiting'"
        class="flex-1 py-2 text-sm font-bold rounded-lg transition-all"
        :class="activeTab === 'waiting'
          ? 'bg-[var(--bg-card)] text-[var(--primary)] shadow-sm'
          : 'text-[var(--text-secondary)]'"
        @click="switchTab('waiting')"
      >
        待上菜 ({{ orderStore.servingQueue.length }})
      </button>
      <button
        role="tab"
        :aria-selected="activeTab === 'served'"
        class="flex-1 py-2 text-sm font-bold rounded-lg transition-all"
        :class="activeTab === 'served'
          ? 'bg-[var(--bg-card)] text-[var(--primary)] shadow-sm'
          : 'text-[var(--text-secondary)]'"
        @click="switchTab('served')"
      >
        已上菜
      </button>
    </div>

    <div v-if="isLoading" class="py-20 flex justify-center">
      <n-spin size="large" />
    </div>
    <div v-else-if="errorMsg" class="py-20 flex flex-col items-center gap-4">
      <n-empty :description="errorMsg!" />
      <n-button type="primary" size="small" @click="switchTab(activeTab)">重试</n-button>
    </div>

    <template v-else-if="activeTab === 'waiting'">
      <div v-if="orderStore.servingQueue.length === 0" class="py-20 flex justify-center">
        <n-empty description="暂无待上菜品" />
      </div>
      <ServingItem
        v-for="item in orderStore.servingQueue"
        :key="item.item_id"
        :item="item"
        mode="serving"
      />
    </template>

    <template v-else>
      <div v-if="orderStore.servedItems.length === 0" class="py-20 flex justify-center">
        <n-empty description="暂无已上菜记录" />
      </div>
      <ServingItem
        v-for="item in orderStore.servedItems"
        :key="item.item_id"
        :item="item"
        mode="served"
      />
    </template>
  </div>
</template>
