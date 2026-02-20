import { ConflictError, DomainError, NotFoundError } from '../../shared/errors'
import {
  optionalString,
  requireNonNegativeInt,
  requirePositiveInt,
  requireString,
} from '../../shared/validation'
import { OrderTicket, OrderTicketItem } from '../../shared/types'
import { getDb } from '../../db/client'
import { sseHub } from '../sse/sse.hub'
import * as sessionsRepo from '../sessions/sessions.repo'
import * as repo from './tickets.repo'

export interface TicketWithItems extends OrderTicket {
  items: OrderTicketItem[]
}

function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new DomainError('VALIDATION_ERROR', 'Request body must be an object')
  }
  return value as Record<string, unknown>
}

function asItemObject(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new DomainError('VALIDATION_ERROR', `${field} must be an object`)
  }
  return value as Record<string, unknown>
}

const SPICE_LEVELS = new Set(['MILD', 'MEDIUM', 'HOT'])

function parseSpiceLevel(value: unknown, field: string): string | null {
  if (value === undefined || value === null) return null
  if (typeof value !== 'string' || !SPICE_LEVELS.has(value)) {
    throw new DomainError('VALIDATION_ERROR', `${field} must be one of MILD, MEDIUM, HOT or null`)
  }
  return value
}

export function createTicket(sessionId: number, input: unknown): TicketWithItems {
  const session = repo.getSessionContext(sessionId)
  if (!session) throw new NotFoundError('Session')
  if (session.status === 'CLOSED') {
    throw new ConflictError('Cannot modify a CLOSED session', 'SESSION_CLOSED')
  }

  const body = asObject(input)
  if (!Array.isArray(body.items) || body.items.length === 0) {
    throw new DomainError('VALIDATION_ERROR', 'items must be a non-empty array')
  }

  const normalizedItems: repo.NewTicketItem[] = []
  for (let i = 0; i < body.items.length; i += 1) {
    const raw = asItemObject(body.items[i], `items[${i}]`)
    const qty = requirePositiveInt(raw.qty, `items[${i}].qty`)
    const spiceLevel = parseSpiceLevel(raw.spice_level, `items[${i}].spice_level`)

    if (raw.dish_id !== undefined && raw.dish_id !== null) {
      const dishId = requirePositiveInt(raw.dish_id, `items[${i}].dish_id`)
      const dish = repo.getDishSnapshot(dishId)
      if (!dish) throw new NotFoundError('Dish')
      if (!dish.has_spice_option && spiceLevel !== null) {
        throw new DomainError('VALIDATION_ERROR', `items[${i}].spice_level is not allowed for this dish`)
      }

      const discountRate = dish.dish_is_discount_enabled
        ? dish.dish_discount_rate
        : (dish.is_discount_enabled ? dish.discount_rate : 1)
      const unitSellPrice = Math.round(dish.sell_price_cents * discountRate)
      const qtyServed = dish.skip_queue ? qty : 0

      normalizedItems.push({
        source_dish_id: dish.id,
        dish_name_snapshot: dish.name,
        category_snapshot: dish.category_name,
        spice_level: spiceLevel,
        unit_sell_price_cents: unitSellPrice,
        unit_cost_price_cents: dish.cost_price_cents,
        qty_ordered: qty,
        qty_served: qtyServed,
        skip_queue_snapshot: dish.skip_queue ? 1 : 0,
      })
      continue
    }

    const name = requireString(raw.name, `items[${i}].name`)
    const sellPrice = requireNonNegativeInt(raw.sell_price_cents, `items[${i}].sell_price_cents`)
    const costPrice = raw.cost_price_cents === undefined
      ? 0
      : requireNonNegativeInt(raw.cost_price_cents, `items[${i}].cost_price_cents`)

    normalizedItems.push({
      source_dish_id: null,
      dish_name_snapshot: name,
      category_snapshot: 'TEMP',
      spice_level: spiceLevel,
      unit_sell_price_cents: sellPrice,
      unit_cost_price_cents: costPrice,
      qty_ordered: qty,
      qty_served: 0,
      skip_queue_snapshot: 0,
    })
  }

  const note = optionalString(body.note) ?? null

  // Atomic: revert PENDING_CHECKOUT + create ticket in one transaction
  const needsRevert = session.status === 'PENDING_CHECKOUT'
  const db = getDb()
  const atomicCreate = db.transaction(() => {
    if (needsRevert) sessionsRepo.revertToDining(sessionId)
    return repo.createTicketWithItems(sessionId, note, normalizedItems)
  })
  const created = atomicCreate()

  sseHub.broadcast('ticket.created', {
    ticket_id: created.ticket.id,
    session_id: session.id,
    table_id: session.table_id,
    item_count: created.items.length,
  })
  sseHub.broadcast('table.updated', {
    table_id: session.table_id,
    session_id: session.id,
    ...(needsRevert ? { status: 'dining' } : {}),
  })

  return {
    ...created.ticket,
    items: created.items,
  }
}

export function patchTicketItem(itemId: number, input: unknown): OrderTicketItem {
  const body = asObject(input)

  // Dual-compat: accept both qty/void_qty (legacy) and qty_ordered/qty_voided (new)
  if (body.qty === undefined && body.qty_ordered !== undefined) body.qty = body.qty_ordered
  if (body.void_qty === undefined && body.qty_voided !== undefined) body.void_qty = body.qty_voided

  const hasQty = body.qty !== undefined
  const hasVoidQty = body.void_qty !== undefined

  if ((hasQty && hasVoidQty) || (!hasQty && !hasVoidQty)) {
    throw new DomainError('VALIDATION_ERROR', 'Exactly one of qty or void_qty must be provided')
  }

  const current = repo.getTicketItemContext(itemId)
  if (!current) throw new NotFoundError('Ticket item')
  if (current.session_status === 'CLOSED') {
    throw new ConflictError('Cannot modify a CLOSED session', 'SESSION_CLOSED')
  }

  // Atomic: revert PENDING_CHECKOUT + mutation in one transaction
  const needsRevert = current.session_status === 'PENDING_CHECKOUT'
  const db = getDb()
  const atomicPatch = db.transaction(() => {
    if (needsRevert) sessionsRepo.revertToDining(current.session_id)

    if (hasQty) {
      const qty = requirePositiveInt(body.qty, 'qty')
      const minQty = current.qty_served + current.qty_voided
      if (qty < minQty) {
        throw new ConflictError('qty cannot be less than served + voided quantity', 'INVALID_QTY')
      }
      const applied = repo.updateTicketItemQtyOrdered(itemId, qty)
      if (!applied) {
        throw new ConflictError('Concurrent modification detected, please retry', 'CONCURRENT_MODIFICATION')
      }
    } else {
      const voidQty = requirePositiveInt(body.void_qty, 'void_qty')
      const pending = current.qty_ordered - current.qty_served - current.qty_voided
      if (pending <= 0) {
        throw new ConflictError('No pending quantity left to void', 'NO_PENDING_QTY')
      }
      if (voidQty > pending) {
        throw new ConflictError('void_qty exceeds pending quantity', 'VOID_EXCEEDS_PENDING')
      }
      const applied = repo.incrementTicketItemVoided(itemId, voidQty)
      if (!applied) {
        throw new ConflictError('Concurrent modification detected, please retry', 'CONCURRENT_MODIFICATION')
      }
    }
  })
  atomicPatch()

  const updated = repo.getTicketItemById(itemId)
  if (!updated) throw new NotFoundError('Ticket item')

  sseHub.broadcast('serving.updated', {
    item_id: updated.id,
    ticket_id: updated.ticket_id,
    session_id: current.session_id,
    table_id: current.table_id,
    pending_qty: updated.qty_ordered - updated.qty_served - updated.qty_voided,
  })
  sseHub.broadcast('table.updated', {
    table_id: current.table_id,
    session_id: current.session_id,
    ...(needsRevert ? { status: 'dining' } : {}),
  })

  return updated
}
