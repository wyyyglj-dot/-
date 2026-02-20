export interface ApiResponse<T = unknown> {
  ok: boolean
  data?: T
  error?: { code: string; message: string }
  meta: { requestId: string; ts: string }
}

export function success<T>(data: T, requestId: string): ApiResponse<T> {
  return { ok: true, data, meta: { requestId, ts: new Date().toISOString() } }
}

export function fail(code: string, message: string, requestId: string): ApiResponse {
  return { ok: false, error: { code, message }, meta: { requestId, ts: new Date().toISOString() } }
}
