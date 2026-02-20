<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { NInput, NButton, useMessage } from 'naive-ui'
import PinPad from '../components/common/PinPad.vue'
import { useAuthStore } from '../stores/auth'

const router = useRouter()
const message = useMessage()
const authStore = useAuthStore()

const step = ref<'answer' | 'pin1' | 'pin2'>('answer')
const answerVal = ref('')
const pin1 = ref('')
const error = ref(false)
const loading = ref(false)

const isMobile = () => window.innerWidth < 768

onMounted(async () => {
  try { await authStore.checkState() } catch { /* ignore */ }
})

function submitAnswer() {
  if (!answerVal.value.trim()) return
  step.value = 'pin1'
}

function onPin1Complete(pin: string) {
  pin1.value = pin
  step.value = 'pin2'
}

async function onPin2Complete(pin: string) {
  if (pin !== pin1.value) {
    error.value = true
    message.error('两次输入不一致，请重新输入')
    return
  }
  loading.value = true
  try {
    await authStore.recover({ answer: answerVal.value.trim(), newPin: pin })
    message.success('PIN 已重置')
    router.replace(isMobile() ? '/m' : '/')
  } catch (e: any) {
    error.value = true
    message.error(e.message || '恢复失败')
    step.value = 'answer'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen flex flex-col items-center justify-center bg-aurora px-4">
    <div class="text-center mb-10">
      <h1 class="text-3xl font-bold text-[var(--text-primary)]">PIN 恢复</h1>
      <p class="text-[var(--text-secondary)] mt-2">
        {{ step === 'answer' ? '请回答安全问题' : step === 'pin1' ? '请输入新 PIN 码' : '请再次确认新 PIN' }}
      </p>
    </div>

    <div v-if="step === 'answer'" class="w-full max-w-sm space-y-4">
      <p class="text-center text-[var(--text-primary)] font-medium">
        {{ authStore.securityQuestion || '加载中...' }}
      </p>
      <n-input
        v-model:value="answerVal"
        type="password"
        show-password-on="click"
        placeholder="请输入答案"
        size="large"
        @keyup.enter="submitAnswer"
      />
      <n-button
        type="primary" block size="large"
        :disabled="!answerVal.trim()"
        @click="submitAnswer"
      >下一步</n-button>
      <router-link to="/login" class="block text-center text-sm text-[var(--primary)] hover:underline">
        返回登录
      </router-link>
    </div>

    <PinPad v-else-if="step === 'pin1'" @complete="onPin1Complete" />
    <PinPad v-else :error="error" @complete="onPin2Complete" />
  </div>
</template>
