import { defineStore } from 'pinia'

type ThemePreference = 'light' | 'dark' | 'system'
type ResolvedTheme = 'light' | 'dark'

const MQ = '(prefers-color-scheme: dark)'

function querySystemTheme(): ResolvedTheme {
  if (typeof window === 'undefined') return 'light'
  return window.matchMedia?.(MQ).matches ? 'dark' : 'light'
}

export const useThemeStore = defineStore('theme', {
  state: () => ({
    preference: 'system' as ThemePreference,
    _systemTheme: querySystemTheme() as ResolvedTheme,
  }),
  getters: {
    resolved(): ResolvedTheme {
      if (this.preference === 'system') return this._systemTheme
      return this.preference
    },
  },
  actions: {
    init() {
      this._systemTheme = querySystemTheme()
      this.applyTheme()

      if (typeof window === 'undefined' || !window.matchMedia) return
      const mql = window.matchMedia(MQ)
      const handler = () => {
        this._systemTheme = mql.matches ? 'dark' : 'light'
        if (this.preference === 'system') this.applyTheme()
      }
      mql.addEventListener('change', handler)
    },
    setPreference(mode: ThemePreference) {
      this.preference = mode
      this.applyTheme()
    },
    toggle() {
      this.setPreference(this.resolved === 'dark' ? 'light' : 'dark')
    },
    applyTheme() {
      if (typeof document === 'undefined') return
      document.documentElement.setAttribute('data-theme', this.resolved)
      document.documentElement.style.colorScheme = this.resolved
    },
  },
  persist: { paths: ['preference'] },
})
