<script setup lang="ts">
import { NInputNumber } from 'naive-ui'

const props = defineProps<{ value: number; min?: number }>()
const emit = defineEmits<{ 'update:value': [val: number] }>()

function decrement() {
  const next = props.value - 1
  if (next >= (props.min ?? 0)) emit('update:value', next)
}
function increment() {
  emit('update:value', props.value + 1)
}
</script>

<template>
  <div class="flex items-center gap-1">
    <button
      aria-label="减少数量"
      class="w-8 h-8 rounded-full bg-[var(--action-bg)] border border-[var(--action-border)] flex items-center justify-center text-lg hover:bg-[var(--action-bg-hover)] active:scale-95 transition-all"
      @click="decrement"
    >−</button>
    <n-input-number
      :value="value"
      :show-button="false"
      :min="min ?? 0"
      size="small"
      class="w-12 text-center"
      @update:value="v => v !== null && emit('update:value', v)"
    />
    <button
      aria-label="增加数量"
      class="w-8 h-8 rounded-full bg-[var(--primary)] text-white flex items-center justify-center text-lg hover:opacity-90 active:scale-95"
      @click="increment"
    >+</button>
  </div>
</template>
