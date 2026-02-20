import { post } from './client'
import type { PaymentMethod } from '../types'

export const checkoutSession = (sessionId: number, data: { method: PaymentMethod; idempotency_key: string }) =>
  post<{ payment_id: number }>(`/sessions/${sessionId}/checkout`, data)
