import { DomainError, NotFoundError } from '../../shared/errors'
import { requireNonNegativeInt, requireString } from '../../shared/validation'
import { sseHub } from '../sse/sse.hub'
import * as repo from './tables.repo'

function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new DomainError('VALIDATION_ERROR', 'Request body must be an object')
  }
  return value as Record<string, unknown>
}

function parseEnabled(value: unknown, field: string): number {
  if (value === 1 || value === '1' || value === true || value === 'true') return 1
  if (value === 0 || value === '0' || value === false || value === 'false') return 0
  throw new DomainError('VALIDATION_ERROR', `${field} must be 0 or 1`)
}

export function listTables() {
  return repo.listTablesWithCurrentSession()
}

export function listTableSummaries() {
  return repo.listTableSummaries()
}

export function getSingleTableSummary(tableId: number) {
  const existing = repo.getTableById(tableId)
  if (!existing) throw new NotFoundError('Table')

  const summary = repo.getTableSummary(tableId)
  if (!summary) throw new NotFoundError('Table')
  return summary
}

export function createTable(input: unknown) {
  const body = asObject(input)
  const tableNo = requireString(body.table_no, 'table_no')
  const sortOrder = body.sort_order === undefined ? 0 : requireNonNegativeInt(body.sort_order, 'sort_order')
  const isEnabled = body.is_enabled === undefined ? 1 : parseEnabled(body.is_enabled, 'is_enabled')

  const created = repo.createTable(tableNo, sortOrder, isEnabled)
  sseHub.broadcast('table.updated', { table: created })
  return created
}

export function updateTable(tableId: number, input: unknown) {
  const body = asObject(input)
  const patch: { table_no?: string; sort_order?: number; is_enabled?: number } = {}

  if (body.table_no !== undefined) patch.table_no = requireString(body.table_no, 'table_no')
  if (body.sort_order !== undefined) patch.sort_order = requireNonNegativeInt(body.sort_order, 'sort_order')
  if (body.is_enabled !== undefined) patch.is_enabled = parseEnabled(body.is_enabled, 'is_enabled')

  if (Object.keys(patch).length === 0) {
    throw new DomainError('VALIDATION_ERROR', 'At least one updatable field is required')
  }

  if (patch.is_enabled === 0 && repo.hasActiveSession(tableId)) {
    throw new DomainError('TABLE_HAS_ACTIVE_SESSION', '该桌位有未结束的用餐，无法删除')
  }

  const updated = repo.updateTable(tableId, patch)
  sseHub.broadcast('table.updated', { table: updated })
  return updated
}
