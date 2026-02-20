import { get, post, del } from './client'
import type { ClosedSessionListItem, ClosedSessionDetail, RestoreResult } from '../types'

export interface HistoryParams {
  page?: number
  pageSize?: number
  from?: string
  to?: string
  tableNo?: string
}

interface HistoryListResponse {
  list: ClosedSessionListItem[]
  page: number
  pageSize: number
  total: number
}

export const getClosedSessions = (params?: HistoryParams) => {
  const qs = new URLSearchParams()
  if (params?.page) qs.set('page', String(params.page))
  if (params?.pageSize) qs.set('pageSize', String(params.pageSize))
  if (params?.from) qs.set('from', params.from)
  if (params?.to) qs.set('to', params.to)
  if (params?.tableNo) qs.set('tableNo', params.tableNo)
  const query = qs.toString()
  return get<HistoryListResponse>(`/history/sessions${query ? `?${query}` : ''}`)
}

export const getSessionDetail = (id: number) =>
  get<ClosedSessionDetail>(`/history/sessions/${id}`)

export const restoreSession = (id: number) =>
  post<RestoreResult>(`/history/sessions/${id}/restore`, {})

export const deleteSession = (id: number) =>
  del<{ session_id: number; deleted_payments: number; deleted_items: number; deleted_tickets: number }>(`/history/sessions/${id}`)
