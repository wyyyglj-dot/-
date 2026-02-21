<script setup lang="ts">
import { useRoute } from 'vue-router'
import { sseClient } from '../../api/sse'
const route = useRoute()

const tabs = [
  { path: '/m', label: '餐桌', icon: '🍽' },
  { path: '/m/serving', label: '上菜', icon: '📋' },
  { path: '/m/stats', label: '统计', icon: '📊' },
]
</script>

<template>
  <nav class="fixed bottom-0 left-0 right-0 glass-l3 border-t border-[var(--glass-border-l1)] flex justify-around items-center h-16 z-50 safe-area-bottom" style="box-shadow: var(--nav-shadow)">
    <router-link
      v-for="tab in tabs"
      :key="tab.path"
      :to="tab.path"
      class="flex flex-col items-center flex-1 py-1 no-underline"
      :class="route.path === tab.path ? 'text-[var(--primary)]' : 'text-[var(--text-secondary)]'"
    >
      <span class="text-xl">{{ tab.icon }}</span>
      <span class="text-[10px] mt-0.5">{{ tab.label }}</span>
    </router-link>
    <span
      class="w-2 h-2 rounded-full inline-block absolute bottom-2 right-2"
      :class="sseClient.status.value === 'connected' ? 'bg-green-500' : 'bg-red-500 animate-pulse'"
    />
  </nav>
</template>
