<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { NInput, NButton, useMessage } from 'naive-ui'
import PinPad from '../components/common/PinPad.vue'
import { useAuthStore } from '../stores/auth'

const router = useRouter()
const message = useMessage()
const authStore = useAuthStore()

const step = ref(1)
const pin1 = ref('')
const pin2 = ref('')
const question = ref('')
const answer = ref('')
const error = ref(false)
const loading = ref(false)

const isMobile = () => window.innerWidth < 768

const pinPadRef = ref<InstanceType<typeof PinPad>>()

function onStep1Complete(pin: string) {
  pin1.value = pin
  step.value = 2
}

function onStep2Complete(pin: string) {
  if (pin !== pin1.value) {
    error.value = true
    message.error('两次输入不一致，请重新输入')
    pin2.value = ''
    return
  }
  pin2.value = pin
  step.value = 3
}

async function handleSubmit() {
  if (!question.value.trim() || !answer.value.trim()) {
    message.error('请填写安全问题和答案')
    return
  }
  loading.value = true
  try {
    await authStore.setup({ pin: pin1.value, question: question.value.trim(), answer: answer.value.trim() })
    message.success('设置成功')
    router.replace(isMobile() ? '/m' : '/')
  } catch (e: any) {
    message.error(e.message || '设置失败')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen flex flex-col items-center justify-center bg-aurora px-4">
    <div class="text-center mb-10">
      <h1 class="text-3xl font-bold text-[var(--text-primary)]">初始设置</h1>
      <p class="text-[var(--text-secondary)] mt-2">
        {{ step === 1 ? '请设置 6 位 PIN 码' : step === 2 ? '请再次输入确认' : '设置安全问题' }}
      </p>
    </div>

    <PinPad v-if="step === 1" @complete="onStep1Complete" />
    <PinPad v-else-if="step === 2" ref="pinPadRef" :error="error" @complete="onStep2Complete" />

    <div v-else class="w-full max-w-sm space-y-4">
      <n-input
        v-model:value="question"
        placeholder="例如：我的宠物叫什么名字？"
        size="large"
      />
      <n-input
        v-model:value="answer"
        type="password"
        show-password-on="click"
        placeholder="安全答案"
        size="large"
      />
      <n-button
        type="primary"
        block
        size="large"
        :loading="loading"
        :disabled="!question.trim() || !answer.trim()"
        @click="handleSubmit"
      >完成设置</n-button>
    </div>
  </div>
</template>
