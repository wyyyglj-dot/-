import { ConflictError, NotFoundError } from '../../shared/errors'
import { OrderTicket, OrderTicketItem, TableSession } from '../../shared/types'
import { sseHub } from '../sse/sse.hub'
import { getTableSummary } from '../tables/tables.repo'
import * as repo from './sessions.repo'

export interface SessionDetail extends TableSession {
  tickets: Array<OrderTicket & { items: OrderTicketItem[] }>
  total_cents: number
}

export function openSession(tableId: number): TableSession {
  const table = repo.getTableById(tableId)
  if (!table) throw new NotFoundError('Table')

  const active = repo.findActiveSessionByTableId(tableId)
  if (active) {
    throw new ConflictError('Table already has an active session', 'ACTIVE_SESSION_EXISTS')
  }

  const created = repo.createSession(tableId)
  if (!created) {
    throw new ConflictError('Table already has an active session', 'ACTIVE_SESSION_EXISTS')
  }

  sseHub.broadcast('session.opened', {
    session_id: created.id,
    table_id: tableId,
    opened_at: created.opened_at,
  })
  sseHub.broadcast('table.updated', {
    table: getTableSummary(tableId),
  })

  return created
}

export function getSessionDetail(sessionId: number): SessionDetail {
  const session = repo.getSessionById(sessionId)
  if (!session) throw new NotFoundError('Session')

  const tickets = repo.listTicketsBySession(sessionId)
  const items = repo.listTicketItemsBySession(sessionId)
  const total = repo.getSessionTotal(sessionId)

  const itemsByTicket = new Map<number, OrderTicketItem[]>()
  for (const item of items) {
    const list = itemsByTicket.get(item.ticket_id) ?? []
    list.push(item)
    itemsByTicket.set(item.ticket_id, list)
  }

  return {
    ...session,
    tickets: tickets.map((ticket) => ({
      ...ticket,
      items: itemsByTicket.get(ticket.id) ?? [],
    })),
    total_cents: total,
  }
}

export function cancelSession(sessionId: number): void {
  const session = repo.getSessionById(sessionId)
  if (!session) throw new NotFoundError('Session')

  const tickets = repo.listTicketsBySession(sessionId)
  if (tickets.length > 0) {
    throw new ConflictError('Cannot cancel session with orders', 'SESSION_HAS_ORDERS')
  }

  const deleted = repo.deleteSession(sessionId)
  if (!deleted) throw new NotFoundError('Session')

  sseHub.broadcast('table.updated', {
    table: getTableSummary(session.table_id),
  })
}

export function forceDeleteSession(sessionId: number): void {
  const session = repo.getSessionById(sessionId)
  if (!session) throw new NotFoundError('Session')

  repo.forceDeleteSession(sessionId)

  sseHub.broadcast('session.deleted', {
    session_id: sessionId,
    table_id: session.table_id,
  })
  sseHub.broadcast('table.updated', {
    table: getTableSummary(session.table_id),
  })
}
