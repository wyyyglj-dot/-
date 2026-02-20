import { getDb } from '../../db/client'
import { SessionStatus } from '../../shared/types'

export interface ServingQueueItem {
  item_id: number
  ticket_id: number
  table_no: string
  table_id: number
  session_id: number
  dish_name: string
  spice_level: string | null
  quantity: number
  ordered_at: string
}

export interface ServedItem {
  item_id: number
  ticket_id: number
  table_no: string
  table_id: number
  session_id: number
  dish_name: string
  spice_level: string | null
  qty_served: number
  qty_ordered: number
  ordered_at: string
}

export interface ServingItemContext {
  item_id: number
  ticket_id: number
  table_no: string
  table_id: number
  session_id: number
  session_status: SessionStatus
  dish_name: string
  spice_level: string | null
  qty_ordered: number
  qty_served: number
  qty_voided: number
  pending_qty: number
  ordered_at: string
}

export function listServingQueue(): ServingQueueItem[] {
  const db = getDb()
  return db.prepare(`
    SELECT
      i.id AS item_id,
      t.id AS ticket_id,
      dt.table_no AS table_no,
      dt.id AS table_id,
      s.id AS session_id,
      i.dish_name_snapshot AS dish_name,
      i.spice_level AS spice_level,
      (i.qty_ordered - i.qty_served - i.qty_voided) AS quantity,
      t.created_at AS ordered_at
    FROM order_ticket_item i
    JOIN order_ticket t ON t.id = i.ticket_id
    JOIN table_session s ON s.id = t.session_id
    JOIN dining_table dt ON dt.id = s.table_id
    WHERE s.status IN ('DINING', 'PENDING_CHECKOUT')
      AND (i.qty_ordered - i.qty_served - i.qty_voided) > 0
    ORDER BY t.created_at ASC, i.id ASC
  `).all() as ServingQueueItem[]
}

export function listServedItems(): ServedItem[] {
  const db = getDb()
  return db.prepare(`
    SELECT
      i.id AS item_id,
      t.id AS ticket_id,
      dt.table_no AS table_no,
      dt.id AS table_id,
      s.id AS session_id,
      i.dish_name_snapshot AS dish_name,
      i.spice_level AS spice_level,
      i.qty_served,
      i.qty_ordered,
      t.created_at AS ordered_at
    FROM order_ticket_item i
    JOIN order_ticket t ON t.id = i.ticket_id
    JOIN table_session s ON s.id = t.session_id
    JOIN dining_table dt ON dt.id = s.table_id
    WHERE s.status IN ('DINING', 'PENDING_CHECKOUT')
      AND i.qty_served > 0
    ORDER BY t.created_at ASC, i.id ASC
  `).all() as ServedItem[]
}

export function getServingItemContext(itemId: number): ServingItemContext | null {
  const db = getDb()
  const row = db.prepare(`
    SELECT
      i.id AS item_id,
      t.id AS ticket_id,
      dt.table_no AS table_no,
      dt.id AS table_id,
      s.id AS session_id,
      s.status AS session_status,
      i.dish_name_snapshot AS dish_name,
      i.spice_level AS spice_level,
      i.qty_ordered,
      i.qty_served,
      i.qty_voided,
      (i.qty_ordered - i.qty_served - i.qty_voided) AS pending_qty,
      t.created_at AS ordered_at
    FROM order_ticket_item i
    JOIN order_ticket t ON t.id = i.ticket_id
    JOIN table_session s ON s.id = t.session_id
    JOIN dining_table dt ON dt.id = s.table_id
    WHERE i.id = ?
  `).get(itemId) as ServingItemContext | undefined
  return row ?? null
}

export function tryIncrementServedQuantity(itemId: number, qty: number): boolean {
  const db = getDb()
  const result = db.prepare(`
    UPDATE order_ticket_item
    SET qty_served = qty_served + ?
    WHERE id = ?
      AND (qty_ordered - qty_served - qty_voided) >= ?
  `).run(qty, itemId, qty)
  return result.changes > 0
}

export function tryDecrementServedQuantity(itemId: number, qty: number): boolean {
  const db = getDb()
  const result = db.prepare(`
    UPDATE order_ticket_item
    SET qty_served = qty_served - ?
    WHERE id = ?
      AND qty_served >= ?
  `).run(qty, itemId, qty)
  return result.changes > 0
}

export function getSessionPendingCount(sessionId: number): number {
  const db = getDb()
  const row = db.prepare(`
    SELECT COALESCE(SUM(i.qty_ordered - i.qty_served - i.qty_voided), 0) AS pending
    FROM order_ticket_item i
    JOIN order_ticket t ON t.id = i.ticket_id
    WHERE t.session_id = ?
  `).get(sessionId) as { pending: number } | undefined
  return row?.pending ?? 0
}

export function tryTransitionToPendingCheckout(sessionId: number): boolean {
  const db = getDb()
  const result = db.prepare(`
    UPDATE table_session
    SET status = 'PENDING_CHECKOUT'
    WHERE id = ? AND status = 'DINING'
  `).run(sessionId)
  return result.changes > 0
}

export function tryTransitionToDining(sessionId: number): boolean {
  const db = getDb()
  const result = db.prepare(`
    UPDATE table_session
    SET status = 'DINING'
    WHERE id = ? AND status = 'PENDING_CHECKOUT'
  `).run(sessionId)
  return result.changes > 0
}
