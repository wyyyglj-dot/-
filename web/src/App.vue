<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue'
import { NConfigProvider, NMessageProvider, NDialogProvider, darkTheme, type GlobalThemeOverrides } from 'naive-ui'
import { useThemeStore } from './stores/theme'
import { sseClient } from './api/sse'
import { useMenuStore } from './stores/menu'

const themeStore = useThemeStore()
const menuStore = useMenuStore()

let unsubMenuUpdated: (() => void) | null = null

onMounted(() => {
  unsubMenuUpdated = sseClient.on('menu.updated', () => menuStore.fetchMenu())
})

onUnmounted(() => {
  unsubMenuUpdated?.()
})

const naiveTheme = computed(() =>
  themeStore.resolved === 'dark' ? darkTheme : null
)

const themeOverrides = computed<GlobalThemeOverrides>(() => {
  const isDark = themeStore.resolved === 'dark'
  return {
    common: {
      primaryColor: isDark ? '#FB923C' : '#F97316',
      primaryColorHover: '#F97316',
      primaryColorPressed: '#EA580C',
      primaryColorSuppl: '#FB923C',
      borderRadius: '12px',
      bodyColor: isDark ? '#0B0E14' : '#F5F3F0',
      cardColor: isDark ? 'rgba(30, 41, 59, 0.5)' : '#FFFFFF',
      modalColor: isDark ? '#1E293B' : '#FFFFFF',
      popoverColor: isDark ? '#1E293B' : '#FFFFFF',
      tableColor: 'transparent',
      inputColor: isDark ? '#1E293B' : '#FFFFFF',
      actionColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(15, 23, 42, 0.10)',
      textColorBase: isDark ? '#F8FAFC' : '#1A1C1E',
      textColor1: isDark ? '#F8FAFC' : '#1A1C1E',
      textColor2: isDark ? '#A0AEC0' : '#475569',
      textColor3: isDark ? '#78879B' : '#5F6F86',
      dividerColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(15, 23, 42, 0.10)',
      borderColor: isDark ? 'rgba(255, 255, 255, 0.10)' : 'rgba(15, 23, 42, 0.18)',
    },
    Button: { borderRadiusMedium: '12px' },
    Tabs: { tabFontWeightActive: 'bold' },
    Card: { borderRadius: '20px' },
  }
})
</script>

<template>
  <n-config-provider :theme="naiveTheme" :theme-overrides="themeOverrides">
    <n-message-provider>
      <n-dialog-provider>
        <router-view />
      </n-dialog-provider>
    </n-message-provider>
  </n-config-provider>
</template>
