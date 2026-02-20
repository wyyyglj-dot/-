import { DomainError } from '../../shared/errors'
import { requirePositiveInt } from '../../shared/validation'
import * as repo from './stats.repo'

interface DateRange {
  from?: string
  to?: string
}

function firstQueryValue(value: unknown): unknown {
  if (Array.isArray(value)) return value[0]
  return value
}

function isValidDateString(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false

  const [yearStr, monthStr, dayStr] = value.split('-')
  const year = Number(yearStr)
  const month = Number(monthStr)
  const day = Number(dayStr)

  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return false

  const dt = new Date(Date.UTC(year, month - 1, day))
  return (
    dt.getUTCFullYear() === year &&
    dt.getUTCMonth() === month - 1 &&
    dt.getUTCDate() === day
  )
}

function parseDate(value: unknown, field: string): string | undefined {
  const raw = firstQueryValue(value)
  if (raw === undefined || raw === null) return undefined
  if (typeof raw !== 'string') {
    throw new DomainError('VALIDATION_ERROR', `${field} must be YYYY-MM-DD`)
  }

  const trimmed = raw.trim()
  if (!trimmed) return undefined
  if (!isValidDateString(trimmed)) {
    throw new DomainError('VALIDATION_ERROR', `${field} must be YYYY-MM-DD`)
  }
  return trimmed
}

function parseDateRange(query: Record<string, unknown>): DateRange {
  const from = parseDate(query.from, 'from')
  const to = parseDate(query.to, 'to')

  if (from && to && from > to) {
    throw new DomainError('VALIDATION_ERROR', 'from must be less than or equal to to')
  }

  return { from, to }
}

function parseLimit(value: unknown): number {
  const raw = firstQueryValue(value)
  if (raw === undefined || raw === null || raw === '') return 10

  const limit = requirePositiveInt(raw, 'limit')
  if (limit > 100) {
    throw new DomainError('VALIDATION_ERROR', 'limit must be <= 100')
  }
  return limit
}

export function getRevenue(query: Record<string, unknown>) {
  const range = parseDateRange(query)
  return repo.getRevenueStats(range.from, range.to)
}

export function getQuantityRanking(query: Record<string, unknown>) {
  const range = parseDateRange(query)
  const limit = parseLimit(query.limit)
  return repo.getQuantityRanking(range.from, range.to, limit)
}

export function getRevenueRanking(query: Record<string, unknown>) {
  const range = parseDateRange(query)
  const limit = parseLimit(query.limit)
  return repo.getRevenueRanking(range.from, range.to, limit)
}

export function getProfitRanking(query: Record<string, unknown>) {
  const range = parseDateRange(query)
  const limit = parseLimit(query.limit)
  return repo.getProfitRanking(range.from, range.to, limit)
}

export function getDashboard(query: Record<string, unknown>) {
  const range = parseDateRange(query)
  const revenue = repo.getRevenueStats(range.from, range.to)

  return {
    revenue_cents: revenue.revenue_cents,
    cost_cents: revenue.cost_cents,
    profit_cents: revenue.profit_cents,
    order_count: revenue.order_count,
    quantity_ranking: repo.getQuantityRanking(range.from, range.to, 10),
    revenue_ranking: repo.getRevenueRanking(range.from, range.to, 10),
    profit_ranking: repo.getProfitRanking(range.from, range.to, 10),
  }
}
