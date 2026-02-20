<script setup lang="ts">
import { ref, computed, onBeforeUnmount } from 'vue'
import { NTag } from 'naive-ui'
import type { Dish } from '../../types'
import { SPICE_LABELS, SPICE_COLORS } from '../../types'
import { centsToYuan } from '../../utils/currency'
import { useMenuStore } from '../../stores/menu'
import { useStickySpice } from '../../composables/useStickySpice'

const props = defineProps<{
  dish: Dish
  count?: number
  compact?: boolean
  hasSpiceOption?: boolean
}>()
const emit = defineEmits<{
  add: [dish: Dish, spiceLevel?: string | null]
  'open-spice': [rect: DOMRect, dish: Dish]
}>()
const rippling = ref(false)

const menuStore = useMenuStore()
const { stickyDishId, stickySpiceLevel, clearSticky } = useStickySpice()

const category = computed(() => menuStore.categories.find(c => c.id === props.dish.category_id))
const isSkipQueue = computed(() => !!category.value?.skip_queue)
const isCategoryDiscount = computed(() => !!category.value?.is_discount_enabled && (category.value?.discount_rate ?? 1) < 1)
const isDishDiscount = computed(() => !!props.dish.is_discount_enabled && (props.dish.discount_rate ?? 1) < 1)
const isDiscounted = computed(() => isDishDiscount.value || isCategoryDiscount.value)
const isSticky = computed(() => stickyDishId.value === props.dish.id && !!stickySpiceLevel.value)

const cardRef = ref<HTMLElement | null>(null)

const finalPrice = computed(() => {
  if (isDishDiscount.value) return Math.round(props.dish.sell_price_cents * props.dish.discount_rate)
  if (isCategoryDiscount.value && category.value) {
    return Math.round(props.dish.sell_price_cents * category.value.discount_rate)
  }
  return props.dish.sell_price_cents
})

let pressTimer: ReturnType<typeof setTimeout> | null = null
let startX = 0
let startY = 0
let longPressed = false

function cancelPress() {
  if (pressTimer) { clearTimeout(pressTimer); pressTimer = null }
}

function emitOpenSpice() {
  if (!props.hasSpiceOption) return
  const rect = cardRef.value?.getBoundingClientRect()
  if (!rect) return
  emit('open-spice', rect, props.dish)
}

function handlePressStart(e: MouseEvent | TouchEvent) {
  if (!props.hasSpiceOption) return
  longPressed = false
  const pt = e instanceof TouchEvent ? e.touches[0] : e
  startX = pt.clientX; startY = pt.clientY
  pressTimer = setTimeout(() => {
    pressTimer = null
    emitOpenSpice()
    longPressed = true
  }, 300)
}

function handlePressMove(e: TouchEvent) {
  if (!pressTimer) return
  const dx = e.touches[0].clientX - startX
  const dy = e.touches[0].clientY - startY
  if (Math.sqrt(dx * dx + dy * dy) > 10) cancelPress()
}

function handleClick() {
  if (longPressed) { longPressed = false; return }
  rippling.value = true
  emit('add', props.dish, isSticky.value ? stickySpiceLevel.value : null)
  setTimeout(() => (rippling.value = false), 400)
}

onBeforeUnmount(() => cancelPress())
</script>

<template>
  <div
    ref="cardRef"
    role="button"
    tabindex="0"
    :aria-label="`添加 ${dish.name}`"
    class="relative overflow-hidden rounded-[var(--radius-lg)] border glass-l2 p-4 cursor-pointer transition-all duration-300 hover:shadow-card-hover hover:scale-[1.02] active:scale-95 select-none"
    :class="{
      'border-[var(--primary)] shadow-[0_0_15px_var(--primary-glow)]': (count && count > 0) || isSticky,
      'border-[var(--glass-border-l2)] shadow-card': (!count || count === 0) && !isSticky
    }"
    :style="isSticky ? { borderColor: SPICE_COLORS[stickySpiceLevel!] } : {}"
    @click="handleClick"
    @keydown.enter="handleClick"
    @keydown.space.prevent="handleClick"
    @touchstart="handlePressStart"
    @touchmove="handlePressMove"
    @touchend="cancelPress"
    @mousedown="handlePressStart"
    @mouseup="cancelPress"
    @mouseleave="cancelPress"
    @contextmenu.prevent="emitOpenSpice"
  >
    <div v-if="rippling" class="absolute inset-0 bg-[var(--primary)] opacity-10 animate-pulse pointer-events-none"></div>

    <!-- Sticky 指示条 -->
    <div v-if="isSticky" class="absolute bottom-0 left-0 right-0 h-6 flex items-center justify-center gap-1 text-white text-[10px] font-bold z-20 cursor-pointer"
         :style="{ backgroundColor: SPICE_COLORS[stickySpiceLevel!] }"
         @click.stop="clearSticky">
      🔒 {{ SPICE_LABELS[stickySpiceLevel!] }}模式 <span class="opacity-70">✕</span>
    </div>

    <div class="flex justify-between items-start relative z-10">
      <div class="font-bold text-base truncate flex-1 flex flex-col items-start gap-1">
        <span>{{ dish.name }}</span>
        <div class="flex gap-1 flex-wrap">
          <NTag v-if="isSkipQueue" type="info" size="small" :bordered="false" class="h-5 px-1 text-xs">免排队</NTag>
          <NTag v-if="isDishDiscount" type="error" size="small" :bordered="false" class="h-5 px-1 text-xs">
            特价{{ (dish.discount_rate * 10).toFixed(1).replace(/\.0$/, '') }}折
          </NTag>
          <NTag v-else-if="isCategoryDiscount" type="warning" size="small" :bordered="false" class="h-5 px-1 text-xs">
            {{ (category!.discount_rate * 10).toFixed(1).replace(/\.0$/, '') }}折
          </NTag>
        </div>
      </div>
      <div
        v-if="count"
        class="bg-[var(--primary)] text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-black ml-1 shrink-0 shadow-lg shadow-orange-500/20"
      >
        {{ count }}
      </div>
    </div>
    <div class="mt-3 flex justify-between items-end relative z-10">
      <div class="flex flex-col items-baseline text-[var(--primary)] font-black" style="font-variant-numeric: tabular-nums">
         <span v-if="isDiscounted" class="text-xs text-[var(--text-secondary)] line-through decoration-slate-400 decoration-1 font-normal opacity-70">
           {{ centsToYuan(dish.sell_price_cents) }}
         </span>
         <div class="flex items-baseline gap-0.5">
           <span class="text-sm">¥</span>
           <span class="text-2xl">{{ centsToYuan(finalPrice).replace('¥', '') }}</span>
         </div>
      </div>
      <span
        v-if="!compact"
        class="w-8 h-8 rounded-xl bg-[var(--primary-glow)] border border-[var(--primary)]/20 text-[var(--primary)] flex items-center justify-center text-xl transition-all hover:bg-[var(--primary)] hover:text-white hover:rotate-90"
      >+</span>
    </div>
  </div>
</template>
