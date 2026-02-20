<script setup lang="ts">
import { centsToYuan } from '../../utils/currency'
defineProps<{ cents: number }>()
</script>

<template>
  <span class="text-[var(--primary)] font-bold" style="font-variant-numeric: tabular-nums">{{ centsToYuan(cents) }}</span>
</template>
