import { DomainError, NotFoundError } from '../../shared/errors'
import { requireString } from '../../shared/validation'
import { Payment, PaymentMethod } from '../../shared/types'
import { sseHub } from '../sse/sse.hub'
import { getTableSummary } from '../tables/tables.repo'
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
  // 业务时区 UTC+8 (Asia/Shanghai)，中国无夏令时
  const now = new Date(Date.now() + 8 * 3600_000)
  return now.toISOString().slice(0, 10)
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
      table: getTableSummary(session.table_id),
    })
  }

  return {
    payment: result.payment,
    idempotent: !result.created,
  }
}
