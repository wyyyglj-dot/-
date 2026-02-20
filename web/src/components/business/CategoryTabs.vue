<script setup lang="ts">
import { NTabs, NTab } from 'naive-ui'
import type { Category } from '../../types'

defineProps<{ categories: Category[]; active: number | string }>()
defineEmits<{ 'update:active': [val: number | string] }>()
</script>

<template>
  <div class="glass-l1 sticky top-14 z-20 border-b border-[var(--glass-border-l1)]">
    <n-tabs :value="active" type="line" @update:value="v => $emit('update:active', v)" class="px-4">
      <n-tab name="all">全部</n-tab>
      <n-tab v-for="cat in categories" :key="cat.id" :name="cat.id">{{ cat.name }}</n-tab>
    </n-tabs>
  </div>
</template>
