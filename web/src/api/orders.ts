import { get, post, patch, del } from './client'
import type { SessionDetail } from '../types'

export const getSession = (sessionId: number) => get<SessionDetail>(`/sessions/${sessionId}`)

interface TicketItemInput {
  dish_id?: number | null
  name?: string
  sell_price_cents?: number
  cost_price_cents?: number
  qty: number
  spice_level?: string | null
}

export const createTicket = (sessionId: number, items: TicketItemInput[], note?: string) =>
  post<{ ticket_id: number }>(`/sessions/${sessionId}/tickets`, { items, note })

export const updateTicketItem = (itemId: number, data: { qty_ordered?: number; qty_voided?: number }) =>
  patch<void>(`/ticket-items/${itemId}`, data)

export const forceDeleteSession = (sessionId: number) =>
  del<void>(`/sessions/${sessionId}/force`)
