import { get, post } from './client'
import type { ServingQueueItem, ServedItem } from '../types'

export const getServingQueue = () => get<ServingQueueItem[]>('/serving-queue')
export const getServedItems = () => get<ServedItem[]>('/served-items')
export const markServed = (itemId: number, qty?: number) =>
  post<void>(`/ticket-items/${itemId}/serve`, { qty: qty || 1 })
export const unserveItem = (itemId: number, qty?: number) =>
  post<void>(`/ticket-items/${itemId}/unserve`, { qty: qty || 1 })
