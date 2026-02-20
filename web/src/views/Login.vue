<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { NCard, NForm, NFormItem, NInput, NButton, useMessage } from 'naive-ui'

const router = useRouter()
const message = useMessage()

const form = ref({ username: '', password: '' })
const loading = ref(false)

async function handleLogin() {
  if (!form.value.username || !form.value.password) {
    message.warning('请输入用户名和密码')
    return
  }
  loading.value = true
  try {
    // TODO: 对接后端登录接口
    if (form.value.username === 'admin' && form.value.password === 'admin') {
      localStorage.setItem('token', 'demo-token')
      message.success('登录成功')
      router.push('/')
    } else {
      message.error('用户名或密码错误')
    }
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-amber-50 dark:from-slate-900 dark:to-slate-800">
    <n-card class="w-[380px] shadow-xl" :bordered="false">
      <template #header>
        <div class="text-center text-xl font-bold">点餐系统登录</div>
      </template>
      <n-form @submit.prevent="handleLogin">
        <n-form-item label="用户名">
          <n-input v-model:value="form.username" placeholder="请输入用户名" />
        </n-form-item>
        <n-form-item label="密码">
          <n-input v-model:value="form.password" type="password" show-password-on="click" placeholder="请输入密码" />
        </n-form-item>
        <n-button type="primary" block :loading="loading" attr-type="submit">
          登录
        </n-button>
      </n-form>
    </n-card>
  </div>
</template>
