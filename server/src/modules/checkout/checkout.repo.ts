import { getDb } from '../../db/client'
import { ConflictError, NotFoundError } from '../../shared/errors'
import { Payment, PaymentMethod, TableSession } from '../../shared/types'

export interface CheckoutResult {
  payment: Payment
  created: boolean
}

export function getSessionById(sessionId: number): TableSession | null {
  const db = getDb()
  const row = db.prepare(`
    SELECT id, table_id, status, opened_at, closed_at
    FROM table_session
    WHERE id = ?
  `).get(sessionId) as TableSession | undefined
  return row ?? null
}

export function getPaymentBySessionId(sessionId: number): Payment | null {
  const db = getDb()
  const row = db.prepare(`
    SELECT id, session_id, method, amount_cents, paid_at, business_day, idempotency_key
    FROM payment
    WHERE session_id = ?
  `).get(sessionId) as Payment | undefined
  return row ?? null
}

export function getPaymentByIdempotencyKey(idempotencyKey: string): Payment | null {
  const db = getDb()
  const row = db.prepare(`
    SELECT id, session_id, method, amount_cents, paid_at, business_day, idempotency_key
    FROM payment
    WHERE idempotency_key = ?
  `).get(idempotencyKey) as Payment | undefined
  return row ?? null
}

export function calculateSessionAmount(sessionId: number): number {
  const db = getDb()
  const row = db.prepare(`
    SELECT COALESCE(SUM(i.unit_sell_price_cents * (i.qty_ordered - i.qty_voided)), 0) AS amount_cents
    FROM order_ticket_item i
    JOIN order_ticket t ON t.id = i.ticket_id
    WHERE t.session_id = ?
  `).get(sessionId) as { amount_cents: number } | undefined

  return row?.amount_cents ?? 0
}

export function finalizeCheckout(input: {
  sessionId: number
  method: PaymentMethod
  businessDay: string
  idempotencyKey: string
}): CheckoutResult {
  const db = getDb()

  const selectSessionStmt = db.prepare(`
    SELECT id, table_id, status, opened_at, closed_at
    FROM table_session
    WHERE id = ?
  `)

  const selectPaymentBySessionStmt = db.prepare(`
    SELECT id, session_id, method, amount_cents, paid_at, business_day, idempotency_key
    FROM payment
    WHERE session_id = ?
  `)

  const selectPaymentByKeyStmt = db.prepare(`
    SELECT id, session_id, method, amount_cents, paid_at, business_day, idempotency_key
    FROM payment
    WHERE idempotency_key = ?
  `)

  const calculateAmountStmt = db.prepare(`
    SELECT COALESCE(SUM(i.unit_sell_price_cents * (i.qty_ordered - i.qty_voided)), 0) AS amount_cents
    FROM order_ticket_item i
    JOIN order_ticket t ON t.id = i.ticket_id
    WHERE t.session_id = ?
  `)

  const insertPaymentStmt = db.prepare(`
    INSERT INTO payment (
      session_id,
      method,
      amount_cents,
      business_day,
      idempotency_key
    ) VALUES (?, ?, ?, ?, ?)
  `)

  const closeSessionStmt = db.prepare(`
    UPDATE table_session
    SET status = 'CLOSED',
        closed_at = datetime('now')
    WHERE id = ?
  `)

  const selectPaymentByIdStmt = db.prepare(`
    SELECT id, session_id, method, amount_cents, paid_at, business_day, idempotency_key
    FROM payment
    WHERE id = ?
  `)

  const tx = db.transaction((txInput: {
    sessionId: number
    method: PaymentMethod
    businessDay: string
    idempotencyKey: string
  }): CheckoutResult => {
    const session = selectSessionStmt.get(txInput.sessionId) as TableSession | undefined
    if (!session) throw new NotFoundError('Session')

    const existingBySession = selectPaymentBySessionStmt.get(txInput.sessionId) as Payment | undefined
    if (existingBySession) {
      return { payment: existingBySession, created: false }
    }

    const existingByKey = selectPaymentByKeyStmt.get(txInput.idempotencyKey) as Payment | undefined
    if (existingByKey) {
      if (existingByKey.session_id !== txInput.sessionId) {
        throw new ConflictError(
          'idempotency_key is already used by another session',
          'IDEMPOTENCY_KEY_CONFLICT',
        )
      }
      return { payment: existingByKey, created: false }
    }

    if (session.status === 'CLOSED') {
      throw new ConflictError('Session is already closed', 'SESSION_CLOSED')
    }
    if (session.status !== 'PENDING_CHECKOUT') {
      throw new ConflictError('Session must be in PENDING_CHECKOUT status', 'SESSION_NOT_PENDING_CHECKOUT')
    }

    const amountRow = calculateAmountStmt.get(txInput.sessionId) as { amount_cents: number } | undefined
    const amountCents = amountRow?.amount_cents ?? 0

    const insertResult = insertPaymentStmt.run(
      txInput.sessionId,
      txInput.method,
      amountCents,
      txInput.businessDay,
      txInput.idempotencyKey,
    )

    closeSessionStmt.run(txInput.sessionId)

    const payment = selectPaymentByIdStmt.get(Number(insertResult.lastInsertRowid)) as Payment | undefined
    if (!payment) throw new Error('Failed to read created payment')

    return { payment, created: true }
  })

  return tx(input)
}
