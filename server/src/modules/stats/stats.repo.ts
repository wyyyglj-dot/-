import { getDb } from '../../db/client'

export interface RevenueStats {
  revenue_cents: number
  cost_cents: number
  profit_cents: number
  order_count: number
}

export interface RankingItem {
  name: string
  value: number
}

function buildDateFilter(
  from?: string,
  to?: string,
  extraConditions: string[] = [],
): { clause: string; params: unknown[] } {
  const conditions: string[] = [...extraConditions]
  const params: unknown[] = []

  if (from) {
    conditions.push('p.business_day >= ?')
    params.push(from)
  }
  if (to) {
    conditions.push('p.business_day <= ?')
    params.push(to)
  }

  return {
    clause: conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '',
    params,
  }
}

export function getRevenueStats(from?: string, to?: string): RevenueStats {
  const db = getDb()
  const { clause, params } = buildDateFilter(from, to)

  const row = db.prepare(`
    SELECT
      COALESCE(SUM(p.amount_cents), 0) AS revenue_cents,
      COUNT(*) AS order_count
    FROM payment p
    ${clause}
  `).get(...params) as { revenue_cents: number; order_count: number } | undefined

  const costRow = db.prepare(`
    SELECT
      COALESCE(SUM(oti.unit_cost_price_cents * (oti.qty_ordered - oti.qty_voided)), 0) AS cost_cents
    FROM payment p
    JOIN order_ticket ot ON ot.session_id = p.session_id
    JOIN order_ticket_item oti ON oti.ticket_id = ot.id
    ${clause}
  `).get(...params) as { cost_cents: number } | undefined

  const revenue = row?.revenue_cents ?? 0
  const cost = costRow?.cost_cents ?? 0

  return {
    revenue_cents: revenue,
    cost_cents: cost,
    profit_cents: revenue - cost,
    order_count: row?.order_count ?? 0,
  }
}

function getRanking(metricExpression: string, from?: string, to?: string, limit = 10): RankingItem[] {
  const db = getDb()
  const { clause, params } = buildDateFilter(from, to, ['(oti.qty_ordered - oti.qty_voided) > 0'])

  return db.prepare(`
    SELECT
      oti.dish_name_snapshot AS name,
      ${metricExpression} AS value
    FROM payment p
    JOIN order_ticket ot ON ot.session_id = p.session_id
    JOIN order_ticket_item oti ON oti.ticket_id = ot.id
    ${clause}
    GROUP BY oti.dish_name_snapshot
    ORDER BY value DESC, name ASC
    LIMIT ?
  `).all(...params, limit) as RankingItem[]
}

export function getQuantityRanking(from?: string, to?: string, limit = 10): RankingItem[] {
  return getRanking('SUM(oti.qty_ordered - oti.qty_voided)', from, to, limit)
}

export function getRevenueRanking(from?: string, to?: string, limit = 10): RankingItem[] {
  return getRanking(
    'SUM(oti.unit_sell_price_cents * (oti.qty_ordered - oti.qty_voided))',
    from,
    to,
    limit,
  )
}

export function getProfitRanking(from?: string, to?: string, limit = 10): RankingItem[] {
  return getRanking(
    'SUM((oti.unit_sell_price_cents - oti.unit_cost_price_cents) * (oti.qty_ordered - oti.qty_voided))',
    from,
    to,
    limit,
  )
}
