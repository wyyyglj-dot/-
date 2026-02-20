import { getDb } from '../../db/client'
import { ConflictError, NotFoundError } from '../../shared/errors'
import { OrderTicket, OrderTicketItem, Payment, TableSession } from '../../shared/types'

export interface ClosedSessionFilters {
  page: number
  pageSize: number
  from?: string
  to?: string
  tableNo?: string
}

export interface ClosedSessionListItem {
  session_id: number
  table_id: number
  table_no: string
  opened_at: string
  closed_at: string
  amount_cents: number
  payment_method: Payment['method'] | null
  paid_at: string | null
}

export interface ClosedSessionSummary {
  id: number
  table_id: number
  table_no: string
  status: TableSession['status']
  opened_at: string
  closed_at: string | null
}

export interface ClosedSessionDetail {
  session: ClosedSessionSummary
  payment: Payment | null
  tickets: Array<OrderTicket & { items: OrderTicketItem[] }>
  total_cents: number
}

export interface RestoreResult {
  source_session_id: number
  new_session: TableSession
  restored_tickets: number
  restored_items: number
}

export interface DeleteResult {
  session_id: number
  deleted_payments: number
  deleted_items: number
  deleted_tickets: number
}

interface SessionWithTable extends TableSession {
  table_no: string
}

function getSessionWithTable(sessionId: number): SessionWithTable {
  const db = getDb()
  const row = db.prepare(`
    SELECT s.id, s.table_id, t.table_no, s.status, s.opened_at, s.closed_at
    FROM table_session s
    JOIN dining_table t ON t.id = s.table_id
    WHERE s.id = ?
  `).get(sessionId) as SessionWithTable | undefined
  if (!row) throw new NotFoundError('Session')
  return row
}

export function listClosedSessions(filters: ClosedSessionFilters): {
  list: ClosedSessionListItem[]
  page: number
  pageSize: number
  total: number
} {
  const db = getDb()
  const where: string[] = [`s.status = 'CLOSED'`]
  const params: unknown[] = []

  if (filters.from) {
    where.push('s.closed_at >= ?')
    params.push(filters.from)
  }
  if (filters.to) {
    // next day boundary for inclusive date range
    const d = new Date(filters.to + 'T00:00:00Z')
    d.setUTCDate(d.getUTCDate() + 1)
    const nextDay = d.toISOString().slice(0, 10)
    where.push('s.closed_at < ?')
    params.push(nextDay)
  }
  if (filters.tableNo) {
    where.push('t.table_no LIKE ?')
    params.push(`%${filters.tableNo}%`)
  }

  const whereClause = `WHERE ${where.join(' AND ')}`
  const offset = (filters.page - 1) * filters.pageSize

  const totalRow = db.prepare(`
    SELECT COUNT(*) AS cnt
    FROM table_session s
    JOIN dining_table t ON t.id = s.table_id
    ${whereClause}
  `).get(...params) as { cnt: number } | undefined

  const list = db.prepare(`
    SELECT
      s.id AS session_id,
      s.table_id,
      t.table_no,
      s.opened_at,
      s.closed_at,
      COALESCE(p.amount_cents, 0) AS amount_cents,
      p.method AS payment_method,
      p.paid_at
    FROM table_session s
    JOIN dining_table t ON t.id = s.table_id
    LEFT JOIN payment p ON p.session_id = s.id
    ${whereClause}
    ORDER BY s.closed_at DESC, s.id DESC
    LIMIT ? OFFSET ?
  `).all(...params, filters.pageSize, offset) as ClosedSessionListItem[]

  return {
    list,
    page: filters.page,
    pageSize: filters.pageSize,
    total: totalRow?.cnt ?? 0,
  }
}

export function getClosedSessionDetail(sessionId: number): ClosedSessionDetail {
  const db = getDb()
  const session = getSessionWithTable(sessionId)

  if (session.status !== 'CLOSED') {
    throw new ConflictError('Session must be CLOSED', 'SESSION_NOT_CLOSED')
  }

  const payment = db.prepare(`
    SELECT id, session_id, method, amount_cents, paid_at, business_day, idempotency_key
    FROM payment WHERE session_id = ?
  `).get(sessionId) as Payment | undefined

  const tickets = db.prepare(`
    SELECT id, session_id, created_at, note
    FROM order_ticket WHERE session_id = ?
    ORDER BY created_at ASC, id ASC
  `).all(sessionId) as OrderTicket[]

  const items = db.prepare(`
    SELECT i.id, i.ticket_id, i.source_dish_id, i.dish_name_snapshot, i.category_snapshot,
      i.spice_level, i.unit_sell_price_cents, i.unit_cost_price_cents, i.qty_ordered, i.qty_served, i.qty_voided
    FROM order_ticket_item i
    JOIN order_ticket t ON t.id = i.ticket_id
    WHERE t.session_id = ?
    ORDER BY t.created_at ASC, i.id ASC
  `).all(sessionId) as OrderTicketItem[]

  const itemsByTicket = new Map<number, OrderTicketItem[]>()
  for (const item of items) {
    const list = itemsByTicket.get(item.ticket_id) ?? []
    list.push(item)
    itemsByTicket.set(item.ticket_id, list)
  }

  const fallbackTotal = items.reduce(
    (sum, item) => sum + item.unit_sell_price_cents * (item.qty_ordered - item.qty_voided), 0,
  )

  return {
    session: {
      id: session.id,
      table_id: session.table_id,
      table_no: session.table_no,
      status: session.status,
      opened_at: session.opened_at,
      closed_at: session.closed_at,
    },
    payment: payment ?? null,
    tickets: tickets.map((ticket) => ({
      ...ticket,
      items: itemsByTicket.get(ticket.id) ?? [],
    })),
    total_cents: payment?.amount_cents ?? fallbackTotal,
  }
}

export function restoreClosedSession(sourceSessionId: number): RestoreResult {
  const db = getDb()

  const selectSessionStmt = db.prepare(`
    SELECT id, table_id, status, opened_at, closed_at FROM table_session WHERE id = ?
  `)
  const selectActiveStmt = db.prepare(`
    SELECT id FROM table_session WHERE table_id = ? AND status <> 'CLOSED' ORDER BY id DESC LIMIT 1
  `)
  const insertSessionStmt = db.prepare(`
    INSERT INTO table_session (table_id, status) VALUES (?, 'DINING')
  `)
  const listTicketsStmt = db.prepare(`
    SELECT id, session_id, created_at, note FROM order_ticket WHERE session_id = ? ORDER BY created_at ASC, id ASC
  `)
  const listItemsStmt = db.prepare(`
    SELECT id, ticket_id, source_dish_id, dish_name_snapshot, category_snapshot, spice_level,
      unit_sell_price_cents, unit_cost_price_cents, qty_ordered, qty_served, qty_voided,
      COALESCE(skip_queue_snapshot, 0) AS skip_queue_snapshot
    FROM order_ticket_item WHERE ticket_id = ? ORDER BY id ASC
  `)
  const insertTicketStmt = db.prepare(`
    INSERT INTO order_ticket (session_id, note) VALUES (?, ?)
  `)
  const insertItemStmt = db.prepare(`
    INSERT INTO order_ticket_item (
      ticket_id, source_dish_id, dish_name_snapshot, category_snapshot, spice_level,
      unit_sell_price_cents, unit_cost_price_cents, qty_ordered, qty_served, qty_voided,
      skip_queue_snapshot
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  const pendingQtyStmt = db.prepare(`
    SELECT COALESCE(SUM(i.qty_ordered - i.qty_served - i.qty_voided), 0) AS pending
    FROM order_ticket_item i
    JOIN order_ticket t ON t.id = i.ticket_id
    WHERE t.session_id = ?
  `)
  const setPendingStmt = db.prepare(`
    UPDATE table_session SET status = 'PENDING_CHECKOUT' WHERE id = ?
  `)
  const deletePaymentStmt = db.prepare(`
    DELETE FROM payment WHERE session_id = ?
  `)

  const tx = db.transaction((sid: number): RestoreResult => {
    const source = selectSessionStmt.get(sid) as TableSession | undefined
    if (!source) throw new NotFoundError('Session')
    if (source.status !== 'CLOSED') {
      throw new ConflictError('Session must be CLOSED', 'SESSION_NOT_CLOSED')
    }

    const active = selectActiveStmt.get(source.table_id) as { id: number } | undefined
    if (active) {
      throw new ConflictError('Table already has an active session', 'ACTIVE_SESSION_EXISTS')
    }

    // 删除原始 session 的 payment 记录，避免恢复后再结账导致统计重复计算
    deletePaymentStmt.run(sid)

    let newSessionId: number
    try {
      const insertResult = insertSessionStmt.run(source.table_id)
      newSessionId = Number(insertResult.lastInsertRowid)
    } catch (err) {
      if (err instanceof Error && err.message.includes('UNIQUE constraint failed')) {
        throw new ConflictError('Table already has an active session', 'ACTIVE_SESSION_EXISTS')
      }
      throw err
    }

    const sourceTickets = listTicketsStmt.all(sid) as OrderTicket[]
    let restoredTickets = 0
    let restoredItems = 0

    for (const ticket of sourceTickets) {
      const newTicketResult = insertTicketStmt.run(newSessionId, ticket.note)
      const newTicketId = Number(newTicketResult.lastInsertRowid)
      restoredTickets += 1

      const sourceItems = listItemsStmt.all(ticket.id) as OrderTicketItem[]
      for (const item of sourceItems) {
        insertItemStmt.run(
          newTicketId, item.source_dish_id, item.dish_name_snapshot, item.category_snapshot,
          (item as any).spice_level ?? null,
          item.unit_sell_price_cents, item.unit_cost_price_cents,
          item.qty_ordered, item.qty_served, item.qty_voided,
          (item as any).skip_queue_snapshot ?? 0,
        )
        restoredItems += 1
      }
    }

    const pendingRow = pendingQtyStmt.get(newSessionId) as { pending: number } | undefined
    if (restoredItems > 0 && (pendingRow?.pending ?? 0) <= 0) {
      setPendingStmt.run(newSessionId)
    }

    const newSession = selectSessionStmt.get(newSessionId) as TableSession | undefined
    if (!newSession) throw new Error('Failed to read restored session')

    return {
      source_session_id: sid,
      new_session: newSession,
      restored_tickets: restoredTickets,
      restored_items: restoredItems,
    }
  })

  return tx(sourceSessionId)
}

export function deleteClosedSession(sessionId: number): DeleteResult {
  const db = getDb()

  const selectSessionStmt = db.prepare(
    'SELECT id, status FROM table_session WHERE id = ?'
  )
  const deletePaymentStmt = db.prepare(
    'DELETE FROM payment WHERE session_id = ?'
  )
  const deleteItemsStmt = db.prepare(`
    DELETE FROM order_ticket_item
    WHERE ticket_id IN (SELECT id FROM order_ticket WHERE session_id = ?)
  `)
  const deleteTicketsStmt = db.prepare(
    'DELETE FROM order_ticket WHERE session_id = ?'
  )
  const deleteSessionStmt = db.prepare(
    'DELETE FROM table_session WHERE id = ?'
  )

  const tx = db.transaction((sid: number): DeleteResult => {
    const session = selectSessionStmt.get(sid) as
      | { id: number; status: TableSession['status'] }
      | undefined
    if (!session) throw new NotFoundError('Session')
    if (session.status !== 'CLOSED') {
      throw new ConflictError('Session must be CLOSED', 'SESSION_NOT_CLOSED')
    }

    const paymentRes = deletePaymentStmt.run(sid)
    const itemsRes = deleteItemsStmt.run(sid)
    const ticketsRes = deleteTicketsStmt.run(sid)
    deleteSessionStmt.run(sid)

    return {
      session_id: sid,
      deleted_payments: paymentRes.changes,
      deleted_items: itemsRes.changes,
      deleted_tickets: ticketsRes.changes,
    }
  })

  return tx(sessionId)
}
