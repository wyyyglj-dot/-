import { defineStore } from 'pinia'
import { ref } from 'vue'
import * as authApi from '../api/auth'
import type { AuthSetupRequest, AuthRecoverRequest } from '../types'

const TOKEN_KEY = 'auth_token'

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(localStorage.getItem(TOKEN_KEY))
  const setupRequired = ref(false)
  const securityQuestion = ref<string | null>(null)

  function setToken(t: string | null) {
    token.value = t
    if (t) localStorage.setItem(TOKEN_KEY, t)
    else localStorage.removeItem(TOKEN_KEY)
  }

  async function checkState() {
    const state = await authApi.getAuthState()
    setupRequired.value = state.setupRequired
    securityQuestion.value = state.securityQuestion ?? null
    return state
  }

  async function login(pin: string) {
    const res = await authApi.login(pin)
    setToken(res.token)
  }

  async function setup(data: AuthSetupRequest) {
    const res = await authApi.setupPin(data)
    setToken(res.token)
  }

  async function recover(data: AuthRecoverRequest) {
    const res = await authApi.recover(data)
    setToken(res.token)
  }

  async function logout() {
    try { await authApi.logout() } catch { /* ignore */ }
    setToken(null)
  }

  return { token, setupRequired, securityQuestion, checkState, login, setup, recover, logout }
})
