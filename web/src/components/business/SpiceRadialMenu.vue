<script setup lang="ts">
import { computed, ref, watch, nextTick } from 'vue'
import { SPICE_LABELS, SPICE_COLORS, type SpiceLevel } from '../../types'

const props = defineProps<{
  visible: boolean
  anchorRect: DOMRect | null
}>()

const emit = defineEmits<{
  select: [level: SpiceLevel]
  cancel: []
}>()

const options: { id: SpiceLevel; label: string; color: string }[] = [
  { id: 'MILD', label: SPICE_LABELS.MILD, color: SPICE_COLORS.MILD },
  { id: 'MEDIUM', label: SPICE_LABELS.MEDIUM, color: SPICE_COLORS.MEDIUM },
  { id: 'HOT', label: SPICE_LABELS.HOT, color: SPICE_COLORS.HOT },
]

const MENU_HALF_W = 100
const MENU_HALF_H = 28
const EDGE_PAD = 16

const dialogRef = ref<HTMLElement | null>(null)

watch(
  () => props.visible,
  (v) => {
    if (!v) return
    nextTick(() => dialogRef.value?.focus())
  },
  { immediate: true },
)

const positionStyle = computed(() => {
  if (!props.anchorRect) return {}
  const { left, top, width, height } = props.anchorRect
  const cx = left + width / 2
  const cy = top + height / 2
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1000
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800

  const safeX = Math.max(MENU_HALF_W + EDGE_PAD, Math.min(cx, vw - MENU_HALF_W - EDGE_PAD))
  const safeY = Math.max(MENU_HALF_H + EDGE_PAD, Math.min(cy, vh - MENU_HALF_H - EDGE_PAD))

  return {
    left: `${safeX - MENU_HALF_W}px`,
    top: `${safeY - MENU_HALF_H}px`,
  }
})
</script>

<template>
  <Teleport to="body">
    <Transition name="spice-fade" appear>
      <div
        v-if="visible"
        ref="dialogRef"
        tabindex="-1"
        class="fixed inset-0 z-[9999] outline-none"
        role="dialog"
        aria-modal="true"
        aria-label="选择辣度"
        @keydown.esc="emit('cancel')"
      >
        <div class="absolute inset-0" @click="emit('cancel')" @contextmenu.prevent="emit('cancel')" />

        <div
          class="absolute flex items-center gap-3 p-2 rounded-full glass-l3 border border-white/20 shadow-2xl spice-pill"
          :style="positionStyle"
          @click.stop
          @contextmenu.prevent
        >
          <button
            v-for="opt in options"
            :key="opt.id"
            class="relative flex items-center justify-center w-12 h-12 rounded-full transition-transform active:scale-90 hover:scale-110 shadow-lg"
            :style="{ backgroundColor: opt.color }"
            :aria-label="opt.label"
            @click="emit('select', opt.id)"
          >
            <span class="text-white font-black text-sm drop-shadow-md select-none">{{ opt.label }}</span>
          </button>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.spice-fade-enter-active { transition: opacity 200ms ease-out; }
.spice-fade-leave-active { transition: opacity 150ms ease-in; }
.spice-fade-enter-from,
.spice-fade-leave-to { opacity: 0; }

.spice-pill {
  animation: spice-pop-in 200ms cubic-bezier(0.34, 1.56, 0.64, 1) both;
}

@keyframes spice-pop-in {
  from { opacity: 0; transform: scale(0.8); }
  to   { opacity: 1; transform: scale(1); }
}
</style>
