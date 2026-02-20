<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useMessage } from 'naive-ui'
import PinPad from '../components/common/PinPad.vue'
import { useAuthStore } from '../stores/auth'

const router = useRouter()
const message = useMessage()
const authStore = useAuthStore()

const error = ref(false)
const loading = ref(false)

const isMobile = () => window.innerWidth < 768

async function onComplete(pin: string) {
  if (loading.value) return
  loading.value = true
  error.value = false
  try {
    await authStore.login(pin)
    router.replace(isMobile() ? '/m' : '/')
  } catch (e: any) {
    error.value = true
    message.error(e.message || '登录失败')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen flex flex-col items-center justify-center bg-aurora px-4">
    <div class="text-center mb-10">
      <h1 class="text-3xl font-bold text-[var(--text-primary)]">点餐系统</h1>
      <p class="text-[var(--text-secondary)] mt-2">请输入 PIN 码登录</p>
    </div>
    <PinPad :error="error" @complete="onComplete" />
    <router-link
      to="/recovery"
      class="mt-8 text-sm text-[var(--primary)] hover:underline"
    >忘记 PIN？</router-link>
  </div>
</template>
