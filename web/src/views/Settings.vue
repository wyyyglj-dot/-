<script setup lang="ts">
import { ref, computed, onMounted, reactive } from 'vue'
import {
  NLayout, NLayoutSider, NLayoutContent,
  NCard, NButton, NSpin, NAlert, NModal, NTag,
  NCollapse, NCollapseItem, NForm, NFormItem, NInput,
  useMessage, useDialog,
} from 'naive-ui'
import AppSidebar from '../components/layout/AppSidebar.vue'
import {
  getDbStatus, backupDb, downloadBackup,
  restoreDb, uploadRestore, migrateDb,
  type DbStatus,
} from '../api/system'
import { changePin, changeSecurity } from '../api/auth'

const message = useMessage()
const dialog = useDialog()

const loading = ref(false)
const loadingText = ref('')
const dbStatus = ref<DbStatus | null>(null)
const showRestoreModal = ref(false)
const confirmCountDown = ref(3)
let countdownTimer: number | null = null

const isElectron = computed(() => !!(window as any).electronAPI?.isElectron)

async function fetchStatus() {
  try {
    dbStatus.value = await getDbStatus()
  } catch {
    message.error('获取数据库状态失败')
  }
}

function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const units = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + units[i]
}

function formatDate(dateStr?: string | null): string {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleString()
}

async function handleBackup() {
  loading.value = true
  loadingText.value = '正在备份...'
  try {
    if (isElectron.value) {
      const { canceled, filePath } = await (window as any).electronAPI.showSaveDialog({
        title: '导出数据库备份',
        defaultPath: `backup-${new Date().toISOString().split('T')[0]}.db`,
        filters: [{ name: 'Database', extensions: ['db'] }],
      })
      if (canceled || !filePath) return
      await backupDb(filePath)
      message.success('备份成功')
    } else {
      const blob = await downloadBackup()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `backup-${new Date().toISOString().split('T')[0]}.db`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      message.success('备份下载已开始')
    }
  } catch (e: any) {
    message.error(e.message || '备份失败')
  } finally {
    loading.value = false
  }
}

function openRestoreModal() {
  showRestoreModal.value = true
  confirmCountDown.value = 3
  if (countdownTimer) clearInterval(countdownTimer)
  countdownTimer = window.setInterval(() => {
    confirmCountDown.value--
    if (confirmCountDown.value <= 0 && countdownTimer) {
      clearInterval(countdownTimer)
    }
  }, 1000)
}

async function confirmRestore() {
  if (isElectron.value) {
    const { canceled, filePaths } = await (window as any).electronAPI.showOpenDialog({
      title: '选择备份文件',
      filters: [{ name: 'Database', extensions: ['db'] }],
      properties: ['openFile'],
    })
    if (canceled || !filePaths?.length) return
    await performRestore(() => restoreDb(filePaths[0]))
  } else {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.db'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (file) await performRestore(() => uploadRestore(file))
    }
    input.click()
  }
}

async function performRestore(action: () => Promise<void>) {
  showRestoreModal.value = false
  loading.value = true
  loadingText.value = '正在恢复数据，请勿关闭...'
  try {
    await action()
    message.success('恢复成功，系统即将刷新')
    setTimeout(() => window.location.reload(), 1500)
  } catch (e: any) {
    message.error(e.message || '恢复失败')
    loading.value = false
  }
}

async function handleMigrate() {
  const { canceled, filePaths } = await (window as any).electronAPI.showOpenDialog({
    title: '选择新的存储目录',
    properties: ['openDirectory'],
  })
  if (canceled || !filePaths?.length) return

  dialog.warning({
    title: '确认迁移',
    content: '迁移后数据库将移动到新位置。确定要继续吗？',
    positiveText: '确认迁移',
    negativeText: '取消',
    onPositiveClick: async () => {
      loading.value = true
      loadingText.value = '正在迁移数据...'
      try {
        await migrateDb(filePaths[0], 'move')
        message.success('迁移成功')
        await fetchStatus()
      } catch (e: any) {
        message.error(e.message || '迁移失败')
      } finally {
        loading.value = false
      }
    },
  })
}

onMounted(fetchStatus)

// --- 安全设置 ---
const WEAK_PINS = ['000000', '111111', '222222', '333333', '444444', '555555', '666666', '777777', '888888', '999999', '123456', '654321', '123123', '112233']

const pinForm = reactive({ current: '', newPin: '', confirm: '' })
const pinSubmitting = ref(false)

const secForm = reactive({ current: '', question: '', answer: '' })
const secSubmitting = ref(false)

function validatePin(pin: string): string | null {
  if (!/^\d{6}$/.test(pin)) return 'PIN码必须为6位数字'
  if (WEAK_PINS.includes(pin)) return '新PIN码过于简单'
  return null
}

async function handleChangePin() {
  if (!pinForm.current || !pinForm.newPin || !pinForm.confirm) {
    message.warning('请填写所有字段')
    return
  }
  const err = validatePin(pinForm.newPin)
  if (err) { message.warning(err); return }
  if (pinForm.newPin !== pinForm.confirm) {
    message.warning('两次输入的新PIN码不一致')
    return
  }
  pinSubmitting.value = true
  try {
    await changePin({ current_pin: pinForm.current, new_pin: pinForm.newPin })
    message.success('PIN码修改成功')
    pinForm.current = ''; pinForm.newPin = ''; pinForm.confirm = ''
  } catch (e: any) {
    if (e.code === 'INVALID_PIN') message.error('当前PIN码错误')
    else if (e.code === 'WEAK_PIN') message.error('新PIN码过于简单')
    else message.error(e.message || '修改失败')
  } finally {
    pinSubmitting.value = false
  }
}

async function handleChangeSecurity() {
  if (!secForm.current || !secForm.question || !secForm.answer) {
    message.warning('请填写所有字段')
    return
  }
  secSubmitting.value = true
  try {
    await changeSecurity({ current_pin: secForm.current, question: secForm.question, answer: secForm.answer })
    message.success('安全问题修改成功')
    secForm.current = ''; secForm.question = ''; secForm.answer = ''
  } catch (e: any) {
    if (e.code === 'INVALID_PIN') message.error('当前PIN码错误')
    else message.error(e.message || '修改失败')
  } finally {
    secSubmitting.value = false
  }
}
</script>

<template>
  <n-layout has-sider class="h-screen bg-aurora">
    <n-layout-sider width="200" :native-scrollbar="false" content-style="height: 100%">
      <AppSidebar />
    </n-layout-sider>
    <n-layout-content class="p-8">
      <div class="max-w-3xl mx-auto">
        <h2 class="text-2xl font-bold mb-6">系统设置</h2>

        <n-spin :show="loading" :description="loadingText">
          <div class="space-y-6">
            <!-- 安全设置 -->
            <n-card title="安全设置" size="small">
              <n-collapse>
                <n-collapse-item title="修改 PIN 码" name="pin">
                  <n-form label-placement="top" :show-feedback="false">
                    <n-form-item label="当前 PIN">
                      <n-input v-model:value="pinForm.current" type="password" maxlength="6" placeholder="输入当前6位PIN码" :input-props="{ inputmode: 'numeric', pattern: '[0-9]*' }" />
                    </n-form-item>
                    <n-form-item label="新 PIN">
                      <n-input v-model:value="pinForm.newPin" type="password" maxlength="6" placeholder="输入新的6位PIN码" :input-props="{ inputmode: 'numeric', pattern: '[0-9]*' }" />
                    </n-form-item>
                    <n-form-item label="确认新 PIN">
                      <n-input v-model:value="pinForm.confirm" type="password" maxlength="6" placeholder="再次输入新PIN码" :input-props="{ inputmode: 'numeric', pattern: '[0-9]*' }" />
                    </n-form-item>
                    <n-button type="primary" block :loading="pinSubmitting" @click="handleChangePin">确认修改</n-button>
                  </n-form>
                </n-collapse-item>
                <n-collapse-item title="修改安全问题" name="security">
                  <n-form label-placement="top" :show-feedback="false">
                    <n-form-item label="当前 PIN">
                      <n-input v-model:value="secForm.current" type="password" maxlength="6" placeholder="输入当前6位PIN码" :input-props="{ inputmode: 'numeric', pattern: '[0-9]*' }" />
                    </n-form-item>
                    <n-form-item label="新安全问题">
                      <n-input v-model:value="secForm.question" placeholder="输入新的安全问题" />
                    </n-form-item>
                    <n-form-item label="新安全答案">
                      <n-input v-model:value="secForm.answer" type="password" placeholder="输入新的安全答案" show-password-on="click" />
                    </n-form-item>
                    <n-button type="primary" block :loading="secSubmitting" @click="handleChangeSecurity">确认修改</n-button>
                  </n-form>
                </n-collapse-item>
              </n-collapse>
            </n-card>
            <!-- 存储位置 -->
            <n-card title="数据存储" size="small">
              <template #header-extra>
                <n-tag :type="isElectron ? 'success' : 'info'" size="small" round>
                  {{ isElectron ? '本地客户端' : '网页端' }}
                </n-tag>
              </template>
              <div class="flex items-center justify-between">
                <div class="flex-1 min-w-0">
                  <div class="text-sm text-[var(--text-secondary)] mb-1">当前数据库路径</div>
                  <div class="font-mono text-sm break-all bg-[var(--bg-tertiary,#f5f5f5)] px-3 py-2 rounded border border-[var(--border-color,#e5e5e5)]">
                    {{ dbStatus?.path || '加载中...' }}
                  </div>
                  <div class="mt-2 text-xs text-[var(--text-muted)] flex gap-4">
                    <span>文件大小: {{ formatSize(dbStatus?.sizeBytes || 0) }}</span>
                    <span>最后修改: {{ formatDate(dbStatus?.lastModified) }}</span>
                  </div>
                </div>
                <div v-if="isElectron" class="ml-4 shrink-0">
                  <n-button secondary type="primary" @click="handleMigrate">更改位置</n-button>
                </div>
              </div>
            </n-card>

            <!-- 备份与恢复 -->
            <n-card title="备份与恢复" size="small">
              <n-alert type="info" class="mb-4" :show-icon="true">
                定期备份数据可以防止意外丢失。恢复操作将覆盖当前所有数据，请谨慎操作。
              </n-alert>
              <div class="grid grid-cols-2 gap-4">
                <n-button
                  type="primary"
                  ghost
                  class="h-24 text-base"
                  @click="handleBackup"
                >
                  <div class="text-center">
                    <div class="text-lg mb-1">导出备份</div>
                    <div class="text-xs opacity-70 font-normal">保存 .db 文件到本地</div>
                  </div>
                </n-button>
                <n-button
                  type="error"
                  ghost
                  class="h-24 text-base"
                  @click="openRestoreModal"
                >
                  <div class="text-center">
                    <div class="text-lg mb-1">导入恢复</div>
                    <div class="text-xs opacity-70 font-normal">从 .db 文件恢复数据</div>
                  </div>
                </n-button>
              </div>
            </n-card>
          </div>
        </n-spin>
      </div>

      <!-- 恢复确认弹窗 -->
      <n-modal
        v-model:show="showRestoreModal"
        preset="card"
        title="⚠️ 危险操作确认"
        class="max-w-md"
        :closable="!loading"
        :mask-closable="!loading"
      >
        <div class="space-y-4">
          <p class="text-lg font-bold text-red-500 text-center">确定要恢复数据吗？</p>
          <p class="text-[var(--text-secondary)]">
            此操作将<strong>完全覆盖</strong>当前数据库中的所有数据（包括订单、历史记录、菜单配置）。操作不可撤销，建议先进行备份。
          </p>
          <div class="flex justify-end gap-3 mt-6">
            <n-button @click="showRestoreModal = false" :disabled="loading">取消</n-button>
            <n-button
              type="error"
              :disabled="confirmCountDown > 0 || loading"
              @click="confirmRestore"
            >
              {{ confirmCountDown > 0 ? `请等待 ${confirmCountDown}s` : '我已知晓，确认恢复' }}
            </n-button>
          </div>
        </div>
      </n-modal>
    </n-layout-content>
  </n-layout>
</template>
