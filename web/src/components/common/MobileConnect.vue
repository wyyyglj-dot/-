<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { NModal, NSpin, NButton, useMessage } from 'naive-ui'
import QrcodeVue from 'qrcode.vue'
import { getLanInfo } from '../../api/system'

const message = useMessage()
const show = ref(false)
const loading = ref(false)
const error = ref('')
const lanIp = ref<string | null>(null)

const connectUrl = computed(() => {
  if (!lanIp.value) return ''
  const { protocol, port } = window.location
  const portSuffix = port ? `:${port}` : ''
  return `${protocol}//${lanIp.value}${portSuffix}/m`
})

async function fetchLanInfo() {
  loading.value = true
  error.value = ''
  lanIp.value = null
  try {
    const res = await getLanInfo()
    lanIp.value = res.primaryIp
    if (!res.primaryIp) error.value = '未检测到局域网连接'
  } catch {
    error.value = '获取局域网信息失败'
  } finally {
    loading.value = false
  }
}

watch(show, (val) => { if (val) fetchLanInfo() })

async function copyUrl() {
  if (!connectUrl.value) return
  try {
    await navigator.clipboard.writeText(connectUrl.value)
    message.success('已复制到剪贴板')
  } catch {
    message.error('复制失败，请手动选中复制')
  }
}
</script>

<template>
  <button
    type="button"
    @click="show = true"
    class="p-2 rounded-xl bg-[var(--action-bg)] border border-[var(--glass-border-l1)] hover:bg-[var(--action-bg-hover)] transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
    aria-label="连接手机端"
  >
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-[var(--text-primary)]">
      <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
      <line x1="12" y1="18" x2="12.01" y2="18" />
    </svg>
  </button>

  <n-modal v-model:show="show">
    <div class="p-6 rounded-2xl border border-[var(--glass-border-l1)] max-w-sm w-full mx-4 shadow-2xl flex flex-col items-center gap-4 text-[var(--text-primary)]" style="background: var(--glass-bg-l1); backdrop-filter: blur(24px)">
      <h3 class="text-lg font-bold">连接手机端</h3>

      <div v-if="loading" class="py-8">
        <n-spin size="medium" />
      </div>

      <div v-else-if="error" class="py-4 text-center">
        <p class="text-red-400 text-sm">{{ error }}</p>
        <n-button size="small" class="mt-4" @click="fetchLanInfo">重试</n-button>
      </div>

      <template v-else>
        <div class="bg-white p-4 rounded-lg shadow-sm">
          <qrcode-vue :value="connectUrl" :size="180" level="H" />
        </div>

        <div class="text-center w-full">
          <p class="text-xs text-[var(--text-muted)] mb-1">局域网地址</p>
          <p class="font-mono text-sm select-all bg-[var(--bg-surface)] p-2 rounded border border-[var(--glass-border-l2)] break-all">
            {{ connectUrl }}
          </p>
        </div>

        <div class="flex gap-2">
          <n-button size="small" secondary @click="copyUrl">复制地址</n-button>
          <n-button size="small" secondary @click="fetchLanInfo">刷新 IP</n-button>
        </div>

        <p class="text-[10px] text-[var(--text-muted)] text-center">
          确保手机与电脑连接同一 Wi-Fi 或局域网
        </p>
      </template>
    </div>
  </n-modal>
</template>
