import { get, post, patch, del } from './client'
import type { DiningTable, TableSummary } from '../types'

export const getTables = () => get<DiningTable[]>('/tables')
export const getTablesSummary = () => get<TableSummary[]>('/tables/summary')
export const getTableSummary = (tableId: number) => get<TableSummary>(`/tables/${tableId}/summary`)
export const createTable = (data: { table_no: string; sort_order?: number }) => post<DiningTable>('/tables', data)
export const updateTable = (id: number, data: Partial<DiningTable>) => patch<DiningTable>(`/tables/${id}`, data)
export const deleteTable = (id: number) => patch<DiningTable>(`/tables/${id}`, { is_enabled: 0 })
export const openTable = (tableId: number) =>
  post<{ id: number; session_id?: number }>(`/tables/${tableId}/sessions`, {})
    .then(data => ({ session_id: data.session_id ?? data.id }))

export const cancelSession = (sessionId: number) => del<void>(`/sessions/${sessionId}`)
