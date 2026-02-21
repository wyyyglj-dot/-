import { get, post } from './client'

export interface LanInfo {
  primaryIp: string | null
  ips: { address: string; family: string; interface: string }[]
  hostname: string
}

export function getLanInfo(): Promise<LanInfo> {
  return get<LanInfo>('/system/lan')
}

// ---------- Database Management ----------

export interface DbStatus {
  path: string
  sizeBytes: number
  lastModified: string | null
}

export function getDbStatus(): Promise<DbStatus> {
  return get<DbStatus>('/system/db')
}

export function backupDb(targetPath: string): Promise<void> {
  return post<void>('/system/db/backup', { targetPath })
}

export async function downloadBackup(): Promise<Blob> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  const token = localStorage.getItem('auth_token')
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch('/api/v1/system/db/backup', {
    method: 'POST',
    headers,
    body: JSON.stringify({}),
  })
  if (!res.ok) {
    if (res.status === 401) throw new Error('认证已过期，请重新登录')
    throw new Error('下载备份失败')
  }
  return res.blob()
}

export function restoreDb(sourcePath: string): Promise<void> {
  return post<void>('/system/db/restore', { sourcePath })
}

export async function uploadRestore(file: File): Promise<void> {
  const formData = new FormData()
  formData.append('file', file)
  const headers: Record<string, string> = {}
  const token = localStorage.getItem('auth_token')
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch('/api/v1/system/db/restore', {
    method: 'POST',
    headers,
    body: formData,
  })
  if (!res.ok) {
    if (res.status === 401) throw new Error('认证已过期，请重新登录')
    const json = await res.json().catch(() => ({}))
    throw new Error((json as any).error?.message || '恢复失败')
  }
}

export function migrateDb(newPath: string, mode: 'move' | 'copy'): Promise<void> {
  return post<void>('/system/db/migrate', { newPath, mode })
}
