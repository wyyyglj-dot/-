import { DomainError } from '../../shared/errors'
import { optionalString, requirePositiveInt } from '../../shared/validation'
import { sseHub } from '../sse/sse.hub'
import * as repo from './history.repo'

function firstQueryValue(value: unknown): unknown {
  if (Array.isArray(value)) return value[0]
  return value
}

function isValidDateString(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [y, m, d] = value.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d
}

function parseDate(value: unknown, field: string): string | undefined {
  const raw = firstQueryValue(value)
  if (raw === undefined || raw === null) return undefined
  if (typeof raw !== 'string') throw new DomainError('VALIDATION_ERROR', `${field} must be YYYY-MM-DD`)
  const trimmed = raw.trim()
  if (!trimmed) return undefined
  if (!isValidDateString(trimmed)) throw new DomainError('VALIDATION_ERROR', `${field} must be YYYY-MM-DD`)
  return trimmed
}

function parsePage(value: unknown): number {
  const raw = firstQueryValue(value)
  if (raw === undefined || raw === null || raw === '') return 1
  return requirePositiveInt(raw, 'page')
}

function parsePageSize(value: unknown): number {
  const raw = firstQueryValue(value)
  if (raw === undefined || raw === null || raw === '') return 20
  const pageSize = requirePositiveInt(raw, 'pageSize')
  if (pageSize > 100) throw new DomainError('VALIDATION_ERROR', 'pageSize must be <= 100')
  return pageSize
}

export function listClosedSessions(query: Record<string, unknown>) {
  const page = parsePage(query.page)
  const pageSize = parsePageSize(query.pageSize)
  const from = parseDate(query.from, 'from')
  const to = parseDate(query.to, 'to')
  if (from && to && from > to) {
    throw new DomainError('VALIDATION_ERROR', 'from must be <= to')
  }
  const tableNo = optionalString(firstQueryValue(query.tableNo))
  return repo.listClosedSessions({ page, pageSize, from, to, tableNo })
}

export function getClosedSessionDetail(sessionId: number) {
  return repo.getClosedSessionDetail(sessionId)
}

export function restoreFromHistory(sessionId: number) {
  const restored = repo.restoreClosedSession(sessionId)

  sseHub.broadcast('session.opened', {
    session_id: restored.new_session.id,
    table_id: restored.new_session.table_id,
    opened_at: restored.new_session.opened_at,
    restored_from_session_id: restored.source_session_id,
  })
  if (restored.restored_items > 0) {
    sseHub.broadcast('ticket.created', {
      session_id: restored.new_session.id,
      table_id: restored.new_session.table_id,
      item_count: restored.restored_items,
      restored: true,
    })
  }
  sseHub.broadcast('table.updated', {
    table_id: restored.new_session.table_id,
    session_id: restored.new_session.id,
    status: restored.new_session.status === 'PENDING_CHECKOUT' ? 'pending_checkout' : 'dining',
  })

  return restored
}

export function deleteFromHistory(sessionId: number) {
  return repo.deleteClosedSession(sessionId)
}
