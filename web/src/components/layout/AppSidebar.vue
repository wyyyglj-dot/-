<script setup lang="ts">
import { h } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { NMenu } from 'naive-ui'
import ThemeToggle from '../common/ThemeToggle.vue'
import MobileConnect from '../common/MobileConnect.vue'
import { sseClient } from '../../api/sse'

const route = useRoute()

const menuOptions = [
  { label: () => h(RouterLink, { to: '/' }, { default: () => '桌位总览' }), key: '/' },
  { label: () => h(RouterLink, { to: '/serving' }, { default: () => '上菜队列' }), key: '/serving' },
  { label: () => h(RouterLink, { to: '/stats' }, { default: () => '营业统计' }), key: '/stats' },
  { label: () => h(RouterLink, { to: '/history' }, { default: () => '历史记录' }), key: '/history' },
  { label: () => h(RouterLink, { to: '/menu-config' }, { default: () => '菜品管理' }), key: '/menu-config' },
  { label: () => h(RouterLink, { to: '/settings' }, { default: () => '系统设置' }), key: '/settings' },
]
</script>

<template>
  <div class="h-full border-r border-[var(--glass-border-l1)] flex flex-col" style="background: var(--glass-bg-l1); backdrop-filter: blur(16px); opacity: 0.97">
    <div class="p-6 border-b border-[var(--glass-border-l1)] text-center">
      <h1 class="text-2xl font-black text-[var(--primary)] tracking-tight">🔥 烧烤点餐</h1>
      <p class="text-[10px] text-[var(--text-secondary)] mt-1">单人操作系统</p>
    </div>
    <n-menu :options="menuOptions" :value="route.path" class="flex-1 pt-4" />
    <div class="p-4 border-t border-[var(--glass-border-l1)] flex flex-col items-center gap-3">
      <div class="flex items-center gap-3">
        <ThemeToggle />
        <MobileConnect />
      </div>
      <div class="text-[10px] text-[var(--text-muted)] text-center flex items-center justify-center gap-1">
        <span
          class="w-2 h-2 rounded-full inline-block"
          :class="sseClient.status.value === 'connected' ? 'bg-green-500' : 'bg-red-500 animate-pulse'"
        />
        v1.0.0
      </div>
    </div>
  </div>
</template>
