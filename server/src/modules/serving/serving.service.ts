import { ConflictError, DomainError, NotFoundError } from '../../shared/errors'
import { requirePositiveInt } from '../../shared/validation'
import { sseHub } from '../sse/sse.hub'
import * as repo from './serving.repo'

function asOptionalObject(value: unknown): Record<string, unknown> {
  if (value === undefined || value === null) return {}
  if (typeof value !== 'object' || Array.isArray(value)) {
    throw new DomainError('VALIDATION_ERROR', 'Request body must be an object')
  }
  return value as Record<string, unknown>
}

export function getServingQueue() {
  return repo.listServingQueue()
}

export function getServedItems() {
  return repo.listServedItems()
}

export function serveTicketItem(itemId: number, input: unknown) {
  const body = asOptionalObject(input)
  const qty = body.qty === undefined ? 1 : requirePositiveInt(body.qty, 'qty')

  const item = repo.getServingItemContext(itemId)
  if (!item) throw new NotFoundError('Ticket item')
  if (item.session_status === 'CLOSED') {
    throw new ConflictError('Cannot serve items from a closed session', 'SESSION_CLOSED')
  }
  if (item.pending_qty <= 0) {
    throw new ConflictError('No pending quantity left to serve', 'NO_PENDING_QTY')
  }
  if (qty > item.pending_qty) {
    throw new ConflictError('Serve quantity exceeds pending quantity', 'SERVE_EXCEEDS_PENDING')
  }

  const applied = repo.tryIncrementServedQuantity(itemId, qty)
  if (!applied) {
    throw new ConflictError('Concurrent modification detected, please retry', 'CONCURRENT_MODIFICATION')
  }

  const updated = repo.getServingItemContext(itemId)
  if (!updated) throw new NotFoundError('Ticket item')

  sseHub.broadcast('serving.updated', {
    item_id: updated.item_id,
    ticket_id: updated.ticket_id,
    session_id: updated.session_id,
    table_id: updated.table_id,
    served_delta: qty,
    pending_qty: updated.pending_qty,
  })

  // 检查该 session 是否全部上齐，自动转为 PENDING_CHECKOUT
  const pendingCount = repo.getSessionPendingCount(updated.session_id)
  if (pendingCount <= 0 && updated.session_status === 'DINING') {
    repo.tryTransitionToPendingCheckout(updated.session_id)
  }

  sseHub.broadcast('table.updated', {
    table_id: updated.table_id,
    session_id: updated.session_id,
  })

  return updated
}

export function unserveTicketItem(itemId: number, input: unknown) {
  const body = asOptionalObject(input)
  const qty = body.qty === undefined ? 1 : requirePositiveInt(body.qty, 'qty')

  const item = repo.getServingItemContext(itemId)
  if (!item) throw new NotFoundError('Ticket item')
  if (item.session_status === 'CLOSED') {
    throw new ConflictError('Cannot unserve items from a closed session', 'SESSION_CLOSED')
  }
  if (item.qty_served <= 0) {
    throw new ConflictError('No served quantity left to restore', 'NO_SERVED_QTY')
  }
  if (qty > item.qty_served) {
    throw new ConflictError('Unserve quantity exceeds served quantity', 'UNSERVE_EXCEEDS_SERVED')
  }

  const applied = repo.tryDecrementServedQuantity(itemId, qty)
  if (!applied) {
    throw new ConflictError('Concurrent modification detected, please retry', 'CONCURRENT_MODIFICATION')
  }

  const updated = repo.getServingItemContext(itemId)
  if (!updated) throw new NotFoundError('Ticket item')

  sseHub.broadcast('serving.updated', {
    item_id: updated.item_id,
    ticket_id: updated.ticket_id,
    session_id: updated.session_id,
    table_id: updated.table_id,
    served_delta: -qty,
    pending_qty: updated.pending_qty,
  })

  let finalItem = updated
  if (item.session_status === 'PENDING_CHECKOUT') {
    const transitioned = repo.tryTransitionToDining(updated.session_id)
    if (transitioned) {
      const refreshed = repo.getServingItemContext(itemId)
      if (refreshed) finalItem = refreshed
    }
  }

  sseHub.broadcast('table.updated', {
    table_id: finalItem.table_id,
    session_id: finalItem.session_id,
  })

  return finalItem
}
