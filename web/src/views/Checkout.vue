<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { NCard, NButton, NRadioGroup, NRadio, NSpace, useMessage } from 'naive-ui'
import { getSession } from '../api/orders'
import { checkoutSession } from '../api/checkout'
import { centsToYuan } from '../utils/currency'
import { v4 as uuidv4 } from 'uuid'
import type { SessionDetail, PaymentMethod } from '../types'

const route = useRoute()
const router = useRouter()
const message = useMessage()
const session = ref<SessionDetail | null>(null)
const paymentMethod = ref<PaymentMethod>('WECHAT')
const loading = ref(false)

onMounted(async () => {
  session.value = await getSession(Number(route.params.sessionId))
})

const paymentStyles: Record<string, string> = {
  WECHAT: 'border-green-500/50 bg-green-500/10',
  ALIPAY: 'border-blue-500/50 bg-blue-500/10',
  CASH: 'border-[var(--glass-border-l3)] bg-[var(--action-bg)]',
}

async function handleCheckout() {
  if (!session.value || loading.value) return
  loading.value = true
  try {
    await checkoutSession(session.value.id, {
      method: paymentMethod.value,
      idempotency_key: uuidv4(),
    })
    message.success('结账成功')
    router.push('/')
  } catch (e: any) {
    message.error(e.message)
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen bg-aurora flex items-center justify-center p-4">
    <n-card title="结账确认" class="max-w-md w-full shadow-lg">
      <div v-if="session" class="space-y-6">
        <div class="text-center p-6 bg-[var(--status-dining-bg)] rounded-lg">
          <div class="text-[var(--text-secondary)] text-sm">应收金额</div>
          <div class="text-4xl font-black text-[var(--primary)] mt-2">
            {{ centsToYuan(session.total_cents) }}
          </div>
        </div>

        <div>
          <div class="font-bold mb-3">支付方式</div>
          <n-radio-group v-model:value="paymentMethod">
            <n-space vertical>
              <div
                v-for="m in [
                  { value: 'WECHAT', label: '微信支付' },
                  { value: 'ALIPAY', label: '支付宝' },
                  { value: 'CASH', label: '现金' },
                ]"
                :key="m.value"
                class="flex items-center gap-4 p-4 border rounded cursor-pointer transition-colors"
                :class="paymentMethod === m.value ? paymentStyles[m.value] : 'hover:bg-[var(--action-bg)] border-[var(--glass-border-l2)]'"
                @click="paymentMethod = m.value as PaymentMethod"
              >
                <span class="font-bold text-lg flex-1">{{ m.label }}</span>
                <n-radio :value="m.value" />
              </div>
            </n-space>
          </n-radio-group>
        </div>

        <div class="flex gap-4">
          <n-button secondary size="large" class="flex-1" @click="router.back()">返回</n-button>
          <n-button type="primary" size="large" class="flex-1" :loading="loading" @click="handleCheckout">
            确认收钱
          </n-button>
        </div>
      </div>
    </n-card>
  </div>
</template>
