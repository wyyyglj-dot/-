import { ref } from 'vue'

export function useActionLock() {
  const locked = ref(false)

  async function execute(fn: () => Promise<void>) {
    if (locked.value) return
    locked.value = true
    try {
      await fn()
    } finally {
      locked.value = false
    }
  }

  return { locked, execute }
}
