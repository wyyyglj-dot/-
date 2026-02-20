import { getDb } from '../../db/client'
import { OrderTicket, OrderTicketItem, SessionStatus } from '../../shared/types'

export interface SessionContext {
  id: number
  table_id: number
  status: SessionStatus
}

export interface DishSnapshot {
  id: number
  name: string
  sell_price_cents: number
  cost_price_cents: number
  category_name: string
  skip_queue: number
  has_spice_option: number
  dish_discount_rate: number
  dish_is_discount_enabled: number
  discount_rate: number
  is_discount_enabled: number
}

export interface NewTicketItem {
  source_dish_id: number | null
  dish_name_snapshot: string
  category_snapshot: string
  spice_level: string | null
  unit_sell_price_cents: number
  unit_cost_price_cents: number
  qty_ordered: number
  qty_served: number
  skip_queue_snapshot: number
}

export interface CreatedTicket {
  ticket: OrderTicket
  items: OrderTicketItem[]
}

export interface TicketItemContext extends OrderTicketItem {
  session_id: number
  table_id: number
  session_status: SessionStatus
}

export function getSessionContext(sessionId: number): SessionContext | null {
  const db = getDb()
  const row = db.prepare(`
    SELECT id, table_id, status
    FROM table_session
    WHERE id = ?
  `).get(sessionId) as SessionContext | undefined
  return row ?? null
}

export function getDishSnapshot(dishId: number): DishSnapshot | null {
  const db = getDb()
  const row = db.prepare(`
    SELECT
      d.id,
      d.name,
      d.sell_price_cents,
      d.cost_price_cents,
      d.has_spice_option,
      d.discount_rate AS dish_discount_rate,
      d.is_discount_enabled AS dish_is_discount_enabled,
      c.name AS category_name,
      c.skip_queue,
      c.discount_rate,
      c.is_discount_enabled
    FROM menu_dish d
    JOIN menu_category c ON c.id = d.category_id
    WHERE d.id = ?
  `).get(dishId) as DishSnapshot | undefined
  return row ?? null
}

export function createTicketWithItems(
  sessionId: number,
  note: string | null,
  items: NewTicketItem[],
): CreatedTicket {
  const db = getDb()

  const insertTicketStmt = db.prepare(`
    INSERT INTO order_ticket (session_id, note)
    VALUES (?, ?)
  `)

  const insertItemStmt = db.prepare(`
    INSERT INTO order_ticket_item (
      ticket_id,
      source_dish_id,
      dish_name_snapshot,
      category_snapshot,
      spice_level,
      unit_sell_price_cents,
      unit_cost_price_cents,
      qty_ordered,
      qty_served,
      qty_voided,
      skip_queue_snapshot
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
  `)

  const selectTicketStmt = db.prepare(`
    SELECT id, session_id, created_at, note
    FROM order_ticket
    WHERE id = ?
  `)

  const selectItemsStmt = db.prepare(`
    SELECT
      id,
      ticket_id,
      source_dish_id,
      dish_name_snapshot,
      category_snapshot,
      spice_level,
      unit_sell_price_cents,
      unit_cost_price_cents,
      qty_ordered,
      qty_served,
      qty_voided
    FROM order_ticket_item
    WHERE ticket_id = ?
    ORDER BY id ASC
  `)

  const tx = db.transaction((txSessionId: number, txNote: string | null, txItems: NewTicketItem[]) => {
    const ticketResult = insertTicketStmt.run(txSessionId, txNote)
    const ticketId = Number(ticketResult.lastInsertRowid)

    for (const item of txItems) {
      insertItemStmt.run(
        ticketId,
        item.source_dish_id,
        item.dish_name_snapshot,
        item.category_snapshot,
        item.spice_level,
        item.unit_sell_price_cents,
        item.unit_cost_price_cents,
        item.qty_ordered,
        item.qty_served,
        item.skip_queue_snapshot,
      )
    }

    const ticket = selectTicketStmt.get(ticketId) as OrderTicket | undefined
    if (!ticket) throw new Error('Failed to read created ticket')

    const createdItems = selectItemsStmt.all(ticketId) as OrderTicketItem[]
    return { ticket, items: createdItems }
  })

  return tx(sessionId, note, items)
}

export function getTicketItemContext(itemId: number): TicketItemContext | null {
  const db = getDb()
  const row = db.prepare(`
    SELECT
      i.id,
      i.ticket_id,
      i.source_dish_id,
      i.dish_name_snapshot,
      i.category_snapshot,
      i.spice_level,
      i.unit_sell_price_cents,
      i.unit_cost_price_cents,
      i.qty_ordered,
      i.qty_served,
      i.qty_voided,
      s.id AS session_id,
      s.table_id AS table_id,
      s.status AS session_status
    FROM order_ticket_item i
    JOIN order_ticket t ON t.id = i.ticket_id
    JOIN table_session s ON s.id = t.session_id
    WHERE i.id = ?
  `).get(itemId) as TicketItemContext | undefined
  return row ?? null
}

export function updateTicketItemQtyOrdered(itemId: number, qtyOrdered: number): boolean {
  const db = getDb()
  const result = db.prepare(`
    UPDATE order_ticket_item
    SET qty_ordered = ?
    WHERE id = ?
      AND ? >= (qty_served + qty_voided)
  `).run(qtyOrdered, itemId, qtyOrdered)
  return result.changes > 0
}

export function incrementTicketItemVoided(itemId: number, voidQty: number): boolean {
  const db = getDb()
  const result = db.prepare(`
    UPDATE order_ticket_item
    SET qty_voided = qty_voided + ?
    WHERE id = ?
      AND (qty_ordered - qty_served - qty_voided) >= ?
  `).run(voidQty, itemId, voidQty)
  return result.changes > 0
}

export function getTicketItemById(itemId: number): OrderTicketItem | null {
  const db = getDb()
  const row = db.prepare(`
    SELECT
      id,
      ticket_id,
      source_dish_id,
      dish_name_snapshot,
      category_snapshot,
      spice_level,
      unit_sell_price_cents,
      unit_cost_price_cents,
      qty_ordered,
      qty_served,
      qty_voided
    FROM order_ticket_item
    WHERE id = ?
  `).get(itemId) as OrderTicketItem | undefined
  return row ?? null
}
