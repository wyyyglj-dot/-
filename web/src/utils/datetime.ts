/**
 * SQLite datetime('now') 返回无时区的 UTC 字符串 (如 "2026-02-21 03:50:52")。
 * 本模块统一将其解析为 UTC Date，再格式化为本地时间显示。
 */

/** 将 SQLite UTC 字符串解析为 Date（补 'Z' 标记 UTC） */
export function parseUtcString(raw: string): Date {
  if (!raw) return new Date(NaN)
  // 已有时区标记则直接解析
  if (raw.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(raw)) {
    return new Date(raw)
  }
  // SQLite 格式 "YYYY-MM-DD HH:MM:SS" → 补 'Z' 使 JS 按 UTC 解析
  return new Date(raw.replace(' ', 'T') + 'Z')
}

/** 格式化为本地完整时间：M/D HH:mm */
export function formatLocalDateTime(raw: string): string {
  if (!raw) return ''
  const d = parseUtcString(raw)
  if (isNaN(d.getTime())) return raw
  return d.toLocaleString([], {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** 格式化为本地时间：HH:mm */
export function formatLocalTime(raw: string): string {
  if (!raw) return ''
  const d = parseUtcString(raw)
  if (isNaN(d.getTime())) return raw
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

/** 格式化为本地完整日期时间：YYYY-MM-DD HH:mm:ss */
export function formatLocalFull(raw: string): string {
  if (!raw) return ''
  const d = parseUtcString(raw)
  if (isNaN(d.getTime())) return raw
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const h = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  const s = String(d.getSeconds()).padStart(2, '0')
  return `${y}-${m}-${day} ${h}:${min}:${s}`
}
