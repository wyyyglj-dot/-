import { getDb } from '../../db/client'
import { DiningTable, OrderTicket, OrderTicketItem, TableSession } from '../../shared/types'

export function getTableById(tableId: number): DiningTable | null {
  const db = getDb()
  const row = db.prepare(`
    SELECT id, table_no, sort_order, is_enabled
    FROM dining_table
    WHERE id = ?
  `).get(tableId) as DiningTable | undefined
  return row ?? null
}

export function findActiveSessionByTableId(tableId: number): TableSession | null {
  const db = getDb()
  const row = db.prepare(`
    SELECT id, table_id, status, opened_at, closed_at
    FROM table_session
    WHERE table_id = ?
      AND status <> 'CLOSED'
    ORDER BY id DESC
    LIMIT 1
  `).get(tableId) as TableSession | undefined
  return row ?? null
}

export function createSession(tableId: number): TableSession | null {
  const db = getDb()
  try {
    const result = db.prepare(`
      INSERT INTO table_session (table_id, status)
      VALUES (?, 'DINING')
    `).run(tableId)

    const created = db.prepare(`
      SELECT id, table_id, status, opened_at, closed_at
      FROM table_session
      WHERE id = ?
    `).get(Number(result.lastInsertRowid)) as TableSession | undefined

    return created ?? null
  } catch (err: any) {
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return null
    }
    throw err
  }
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

export function listTicketsBySession(sessionId: number): OrderTicket[] {
  const db = getDb()
  return db.prepare(`
    SELECT id, session_id, created_at, note
    FROM order_ticket
    WHERE session_id = ?
    ORDER BY created_at ASC, id ASC
  `).all(sessionId) as OrderTicket[]
}

export function listTicketItemsBySession(sessionId: number): OrderTicketItem[] {
  const db = getDb()
  return db.prepare(`
    SELECT
      i.id,
      i.ticket_id,
      i.source_dish_id,
      i.dish_name_snapshot,
      i.category_snapshot,
      i.unit_sell_price_cents,
      i.unit_cost_price_cents,
      i.qty_ordered,
      i.qty_served,
      i.qty_voided,
      i.spice_level
    FROM order_ticket_item i
    JOIN order_ticket t ON t.id = i.ticket_id
    WHERE t.session_id = ?
    ORDER BY t.created_at ASC, i.id ASC
  `).all(sessionId) as OrderTicketItem[]
}

export function getSessionTotal(sessionId: number): number {
  const db = getDb()
  const row = db.prepare(`
    SELECT COALESCE(SUM(i.unit_sell_price_cents * (i.qty_ordered - i.qty_voided)), 0) AS total_cents
    FROM order_ticket_item i
    JOIN order_ticket t ON t.id = i.ticket_id
    WHERE t.session_id = ?
  `).get(sessionId) as { total_cents: number } | undefined

  return row?.total_cents ?? 0
}

export function deleteSession(sessionId: number): boolean {
  const db = getDb()
  const result = db.prepare(`
    DELETE FROM table_session
    WHERE id = ?
  `).run(sessionId)
  return result.changes > 0
}
