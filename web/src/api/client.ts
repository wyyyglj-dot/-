import type { ApiResponse } from '../types'
import { createDiscreteApi } from 'naive-ui'

const BASE = '/api/v1'
const { message } = createDiscreteApi(['message'])
let _redirecting = false

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  const token = localStorage.getItem('auth_token')
  if (token) headers['Authorization'] = `Bearer ${token}`

  let res: Response
  try {
    res = await fetch(`${BASE}${path}`, { headers, ...options })
  } catch (e) {
    throw new Error(`网络请求失败: ${path}`)
  }

  if (res.status === 401) {
    if (!_redirecting) {
      _redirecting = true
      localStorage.removeItem('auth_token')
      message.warning('登录已过期')
      setTimeout(async () => {
        const { default: router } = await import('../router')
        router.push('/login')
        _redirecting = false
      }, 1500)
    }
    throw new Error('认证已过期，请重新登录')
  }

  let json: ApiResponse<T>
  try {
    json = await res.json()
  } catch {
    throw new Error(`响应解析失败 (${res.status}): ${path}`)
  }

  if (!json.ok) {
    const err = new Error(json.error?.message || `请求失败 (${res.status})`)
    ;(err as any).code = json.error?.code
    throw err
  }
  return json.data as T
}

export function get<T>(path: string): Promise<T> {
  return request<T>(path)
}

export function post<T>(path: string, body: unknown): Promise<T> {
  return request<T>(path, { method: 'POST', body: JSON.stringify(body) })
}

export function patch<T>(path: string, body: unknown): Promise<T> {
  return request<T>(path, { method: 'PATCH', body: JSON.stringify(body) })
}

export function del<T>(path: string): Promise<T> {
  return request<T>(path, { method: 'DELETE' })
}
