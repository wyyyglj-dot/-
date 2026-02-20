import { createApp } from 'vue'
import { createPinia } from 'pinia'
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate'
import App from './App.vue'
import router from './router'
import './style.css'
import { useThemeStore } from './stores/theme'

const pinia = createPinia()
pinia.use(piniaPluginPersistedstate)

const app = createApp(App)
app.use(pinia)
app.use(router)

// 全局错误兜底
app.config.errorHandler = (err: any, _instance, info) => {
  console.error(`[Vue Error] ${info}:`, err)
}

// 路由懒加载 chunk 失败时自动刷新
router.onError((err) => {
  if (/Loading chunk|Failed to fetch dynamically imported module/.test(err.message)) {
    window.location.reload()
  }
})

const themeStore = useThemeStore()
themeStore.init()

app.mount('#app')
