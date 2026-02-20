<script setup lang="ts">
import { ref, watch } from 'vue'

const props = withDefaults(defineProps<{
  length?: number
  error?: boolean
}>(), { length: 6, error: false })

const emit = defineEmits<{
  complete: [pin: string]
  update: [pin: string]
}>()

const pin = ref('')

function append(digit: string) {
  if (pin.value.length >= props.length) return
  pin.value += digit
  emit('update', pin.value)
  if (pin.value.length === props.length) {
    emit('complete', pin.value)
  }
}

function backspace() {
  pin.value = pin.value.slice(0, -1)
  emit('update', pin.value)
}

watch(() => props.error, (val) => {
  if (val) setTimeout(() => { pin.value = '' }, 500)
})

defineExpose({ clear: () => { pin.value = '' } })
</script>

<template>
  <div class="pin-pad" :class="{ 'max-w-[320px]': true }">
    <div class="flex justify-center gap-3 mb-8" :class="{ 'pin-shake': error }">
      <span
        v-for="i in length" :key="i"
        class="w-4 h-4 rounded-full border-2 border-[var(--primary)] transition-all duration-150"
        :class="i <= pin.length ? 'bg-[var(--primary)] scale-110' : 'bg-transparent'"
      />
    </div>
    <div class="grid grid-cols-3 gap-3">
      <button
        v-for="d in ['1','2','3','4','5','6','7','8','9']" :key="d"
        class="pin-key" @click="append(d)"
      >{{ d }}</button>
      <div class="pin-key invisible pointer-events-none" aria-hidden="true" />
      <button class="pin-key" @click="append('0')">0</button>
      <button class="pin-key text-xl" @click="backspace">⌫</button>
    </div>
  </div>
</template>

<style scoped>
.pin-key {
  @apply h-14 text-xl font-semibold rounded-xl transition-colors select-none;
  background: var(--bg-overlay, #1E293B);
  color: var(--text-primary, #333);
}
.pin-key:active {
  background: var(--primary, #f97316);
  color: #fff;
}
@keyframes shake {
  0%, 100% { transform: translateX(0); }
  20%, 60% { transform: translateX(-8px); }
  40%, 80% { transform: translateX(8px); }
}
.pin-shake {
  animation: shake 0.4s ease-in-out;
}
</style>
