import { DomainError, NotFoundError } from '../../shared/errors'
import { requireString } from '../../shared/validation'
import { Payment, PaymentMethod } from '../../shared/types'
import { sseHub } from '../sse/sse.hub'
import * as repo from './checkout.repo'

export interface CheckoutResponse {
  payment: Payment
  idempotent: boolean
}

function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new DomainError('VALIDATION_ERROR', 'Request body must be an object')
  }
  return value as Record<string, unknown>
}

function parsePaymentMethod(value: unknown): PaymentMethod {
  const method = requireString(value, 'method').toUpperCase()
  if (method === 'CASH' || method === 'WECHAT' || method === 'ALIPAY') {
    return method
  }
  throw new DomainError('VALIDATION_ERROR', 'method must be CASH, WECHAT, or ALIPAY')
}

function todayBusinessDay(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function checkoutSession(sessionId: number, input: unknown): CheckoutResponse {
  const session = repo.getSessionById(sessionId)
  if (!session) throw new NotFoundError('Session')

  const body = asObject(input)
  const method = parsePaymentMethod(body.method)
  const idempotencyKey = requireString(body.idempotency_key, 'idempotency_key')

  const result = repo.finalizeCheckout({
    sessionId,
    method,
    businessDay: todayBusinessDay(),
    idempotencyKey,
  })

  if (result.created) {
    sseHub.broadcast('checkout.completed', {
      session_id: sessionId,
      table_id: session.table_id,
      payment_id: result.payment.id,
      amount_cents: result.payment.amount_cents,
      method: result.payment.method,
      business_day: result.payment.business_day,
    })
    sseHub.broadcast('table.updated', {
      table_id: session.table_id,
      session_id: sessionId,
      status: 'idle',
    })
  }

  return {
    payment: result.payment,
    idempotent: !result.created,
  }
}
