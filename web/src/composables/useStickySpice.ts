import { ref } from 'vue'
import type { SpiceLevel } from '../types'

const stickyDishId = ref<number | null>(null)
const stickySpiceLevel = ref<SpiceLevel | null>(null)
let timer: ReturnType<typeof setTimeout> | null = null

export function useStickySpice() {
  function clearSticky() {
    stickyDishId.value = null
    stickySpiceLevel.value = null
    if (timer) clearTimeout(timer)
    timer = null
  }

  function setSticky(dishId: number, spice: SpiceLevel) {
    clearSticky()
    stickyDishId.value = dishId
    stickySpiceLevel.value = spice
    timer = setTimeout(clearSticky, 5000)
  }

  return { stickyDishId, stickySpiceLevel, setSticky, clearSticky }
}
