import { getDb } from '../../db/client'
import { ConflictError, DomainError, NotFoundError } from '../../shared/errors'
import { DiningTable, SessionStatus } from '../../shared/types'

export interface TableWithSession extends DiningTable {
  session_id: number | null
  session_status: SessionStatus | null
  session_opened_at: string | null
}

export interface TableDishSummary {
  name: string
  qty: number
}

export interface TableDishItem {
  name: string
  spice_level: string | null
  qty_ordered: number
  qty_served: number
  qty_unserved: number
  unit_price_cents: number
  skip_queue: number
  status: 'unserved' | 'partial' | 'served'
}

export interface TableSummary {
  id: number
  table_no: string
  sort_order: number
  is_enabled: number
  status: 'idle' | 'dining' | 'pending_checkout'
  session_id: number | null
  total_cents: number
  dishes: TableDishItem[]
  unserved_count: number
}

interface TablePatch {
  table_no?: string
  sort_order?: number
  is_enabled?: number
}

interface SummaryBaseRow {
  id: number
  table_no: string
  sort_order: number
  is_enabled: number
  session_id: number | null
  session_status: SessionStatus | null
  total_cents: number
}

interface UnservedRow {
  table_id: number
  name: string
  qty: number
}

interface AllDishRow {
  table_id: number
  name: string
  spice_level: string | null
  unit_price_cents: number
  qty_ordered: number
  qty_served: number
  qty_voided: number
  qty_effective_ordered: number
  qty_unserved: number
  skip_queue: number
}

function isUniqueConstraint(err: unknown): boolean {
  return err instanceof Error && err.message.includes('UNIQUE constraint failed')
}

function mapSessionStatus(status: SessionStatus | null): 'idle' | 'dining' | 'pending_checkout' {
  if (status === 'DINING') return 'dining'
  if (status === 'PENDING_CHECKOUT') return 'pending_checkout'
  return 'idle'
}

function getTableByIdInternal(id: number): DiningTable | null {
  const db = getDb()
  const row = db.prepare(`
    SELECT id, table_no, sort_order, is_enabled
    FROM dining_table
    WHERE id = ?
  `).get(id) as DiningTable | undefined
  return row ?? null
}

function loadSummaryBase(tableId?: number): SummaryBaseRow[] {
  const db = getDb()
  const whereClause = tableId === undefined ? 'WHERE t.is_enabled = 1' : 'WHERE t.id = ? AND t.is_enabled = 1'
  const params = tableId === undefined ? [] : [tableId]

  return db.prepare(`
    SELECT
      t.id,
      t.table_no,
      t.sort_order,
      t.is_enabled,
      s.id AS session_id,
      s.status AS session_status,
      COALESCE(SUM(oti.unit_sell_price_cents * (oti.qty_ordered - oti.qty_voided)), 0) AS total_cents
    FROM dining_table t
    LEFT JOIN table_session s
      ON s.id = (
        SELECT s2.id
        FROM table_session s2
        WHERE s2.table_id = t.id
          AND s2.status <> 'CLOSED'
        ORDER BY s2.id DESC
        LIMIT 1
      )
    LEFT JOIN order_ticket ot ON ot.session_id = s.id
    LEFT JOIN order_ticket_item oti ON oti.ticket_id = ot.id
    ${whereClause}
    GROUP BY t.id, t.table_no, t.sort_order, t.is_enabled, s.id, s.status
    ORDER BY t.sort_order ASC, t.id ASC
  `).all(...params) as SummaryBaseRow[]
}

function loadUnservedByTable(tableId?: number): Map<number, TableDishSummary[]> {
  const db = getDb()
  const rows = db.prepare(`
    SELECT
      t.id AS table_id,
      oti.dish_name_snapshot AS name,
      SUM(oti.qty_ordered - oti.qty_served - oti.qty_voided) AS qty
    FROM dining_table t
    JOIN table_session s
      ON s.id = (
        SELECT s2.id
        FROM table_session s2
        WHERE s2.table_id = t.id
          AND s2.status <> 'CLOSED'
        ORDER BY s2.id DESC
        LIMIT 1
      )
    JOIN order_ticket ot ON ot.session_id = s.id
    JOIN order_ticket_item oti ON oti.ticket_id = ot.id
    WHERE (oti.qty_ordered - oti.qty_served - oti.qty_voided) > 0
      ${tableId === undefined ? '' : 'AND t.id = ?'}
    GROUP BY t.id, oti.dish_name_snapshot
    ORDER BY t.id ASC, qty DESC, name ASC
  `).all(...(tableId === undefined ? [] : [tableId])) as UnservedRow[]

  const map = new Map<number, TableDishSummary[]>()
  for (const row of rows) {
    const list = map.get(row.table_id) ?? []
    list.push({ name: row.name, qty: row.qty })
    map.set(row.table_id, list)
  }
  return map
}

function loadAllDishesByTable(tableId?: number): Map<number, TableDishItem[]> {
  const db = getDb()
  const rows = db.prepare(`
    SELECT
      t.id AS table_id,
      oti.dish_name_snapshot AS name,
      oti.spice_level AS spice_level,
      oti.unit_sell_price_cents AS unit_price_cents,
      SUM(oti.qty_ordered) AS qty_ordered,
      SUM(oti.qty_served) AS qty_served,
      SUM(oti.qty_voided) AS qty_voided,
      (SUM(oti.qty_ordered) - SUM(oti.qty_voided)) AS qty_effective_ordered,
      (SUM(oti.qty_ordered) - SUM(oti.qty_served) - SUM(oti.qty_voided)) AS qty_unserved,
      COALESCE(oti.skip_queue_snapshot, 0) AS skip_queue
    FROM dining_table t
    JOIN table_session s
      ON s.id = (
        SELECT s2.id
        FROM table_session s2
        WHERE s2.table_id = t.id
          AND s2.status <> 'CLOSED'
        ORDER BY s2.id DESC
        LIMIT 1
      )
    JOIN order_ticket ot ON ot.session_id = s.id
    JOIN order_ticket_item oti ON oti.ticket_id = ot.id
    ${tableId === undefined ? '' : 'WHERE t.id = ?'}
    GROUP BY t.id, oti.dish_name_snapshot, oti.unit_sell_price_cents, COALESCE(oti.skip_queue_snapshot, 0), COALESCE(oti.spice_level, '')
    HAVING (SUM(oti.qty_ordered) - SUM(oti.qty_voided)) > 0
    ORDER BY
      t.id ASC,
      CASE
        WHEN (SUM(oti.qty_ordered) - SUM(oti.qty_served) - SUM(oti.qty_voided)) = 0 THEN 2
        WHEN (SUM(oti.qty_ordered) - SUM(oti.qty_served) - SUM(oti.qty_voided)) < (SUM(oti.qty_ordered) - SUM(oti.qty_voided)) THEN 1
        ELSE 0
      END ASC,
      name ASC
  `).all(...(tableId === undefined ? [] : [tableId])) as AllDishRow[]

  const map = new Map<number, TableDishItem[]>()
  for (const row of rows) {
    const list = map.get(row.table_id) ?? []
    const status: TableDishItem['status'] =
      row.qty_unserved === 0 ? 'served'
        : row.qty_unserved < row.qty_effective_ordered ? 'partial'
          : 'unserved'
    list.push({
      name: row.name,
      spice_level: row.spice_level ?? null,
      qty_ordered: row.qty_ordered,
      qty_served: row.qty_served,
      qty_unserved: row.qty_unserved,
      unit_price_cents: row.unit_price_cents,
      skip_queue: row.skip_queue,
      status,
    })
    map.set(row.table_id, list)
  }
  return map
}

export function getTableById(id: number): DiningTable | null {
  return getTableByIdInternal(id)
}

export function hasActiveSession(tableId: number): boolean {
  const db = getDb()
  const row = db.prepare(`
    SELECT COUNT(*) AS cnt
    FROM table_session
    WHERE table_id = ?
      AND status <> 'CLOSED'
  `).get(tableId) as { cnt: number } | undefined
  return (row?.cnt ?? 0) > 0
}

export function listTablesWithCurrentSession(): TableWithSession[] {
  const db = getDb()
  return db.prepare(`
    SELECT
      t.id,
      t.table_no,
      t.sort_order,
      t.is_enabled,
      s.id AS session_id,
      s.status AS session_status,
      s.opened_at AS session_opened_at
    FROM dining_table t
    LEFT JOIN table_session s
      ON s.id = (
        SELECT s2.id
        FROM table_session s2
        WHERE s2.table_id = t.id
          AND s2.status <> 'CLOSED'
        ORDER BY s2.id DESC
        LIMIT 1
      )
    WHERE t.is_enabled = 1
    ORDER BY t.sort_order ASC, t.id ASC
  `).all() as TableWithSession[]
}

export function createTable(tableNo: string, sortOrder: number, isEnabled: number): DiningTable {
  const db = getDb()
  try {
    const result = db.prepare(`
      INSERT INTO dining_table (table_no, sort_order, is_enabled)
      VALUES (?, ?, ?)
    `).run(tableNo, sortOrder, isEnabled)

    const created = getTableByIdInternal(Number(result.lastInsertRowid))
    if (!created) throw new Error('Failed to read created table')
    return created
  } catch (err) {
    if (isUniqueConstraint(err)) {
      throw new ConflictError('Table number already exists', 'TABLE_NO_CONFLICT')
    }
    throw err
  }
}

export function updateTable(id: number, patch: TablePatch): DiningTable {
  const db = getDb()
  const fields: string[] = []
  const params: unknown[] = []

  if (patch.table_no !== undefined) {
    fields.push('table_no = ?')
    params.push(patch.table_no)
  }
  if (patch.sort_order !== undefined) {
    fields.push('sort_order = ?')
    params.push(patch.sort_order)
  }
  if (patch.is_enabled !== undefined) {
    fields.push('is_enabled = ?')
    params.push(patch.is_enabled)
  }

  const guardActiveSession = patch.is_enabled === 0
  const whereClause = guardActiveSession
    ? 'WHERE id = ? AND NOT EXISTS (SELECT 1 FROM table_session WHERE table_id = ? AND status <> ?)'
    : 'WHERE id = ?'
  const whereParams: unknown[] = guardActiveSession ? [id, id, 'CLOSED'] : [id]

  try {
    const result = db.prepare(`
      UPDATE dining_table
      SET ${fields.join(', ')}
      ${whereClause}
    `).run(...params, ...whereParams)

    if (result.changes === 0) {
      if (guardActiveSession && hasActiveSession(id)) {
        throw new DomainError('TABLE_HAS_ACTIVE_SESSION', '该桌位有未结束的用餐，无法删除')
      }
      throw new NotFoundError('Table')
    }
    const updated = getTableByIdInternal(id)
    if (!updated) throw new NotFoundError('Table')
    return updated
  } catch (err) {
    if (err instanceof DomainError) throw err
    if (isUniqueConstraint(err)) {
      throw new ConflictError('Table number already exists', 'TABLE_NO_CONFLICT')
    }
    throw err
  }
}

export function listTableSummaries(tableId?: number): TableSummary[] {
  const baseRows = loadSummaryBase(tableId)
  const dishesMap = loadAllDishesByTable(tableId)
  const unservedCountMap = new Map<number, number>()
  const hasNonSkipMap = new Map<number, boolean>()
  for (const [id, dishes] of dishesMap) {
    unservedCountMap.set(id, dishes.filter((d) => d.qty_unserved > 0).length)
    hasNonSkipMap.set(id, dishes.some((d) => !d.skip_queue))
  }

  autoTransitionStuckSessions(baseRows, unservedCountMap, hasNonSkipMap)

  return baseRows.map((row) => ({
    id: row.id,
    table_no: row.table_no,
    sort_order: row.sort_order,
    is_enabled: row.is_enabled,
    status: mapSessionStatus(row.session_status),
    session_id: row.session_id ?? null,
    total_cents: row.total_cents ?? 0,
    dishes: dishesMap.get(row.id) ?? [],
    unserved_count: unservedCountMap.get(row.id) ?? 0,
  }))
}

function autoTransitionStuckSessions(
  baseRows: SummaryBaseRow[],
  unservedCountMap: Map<number, number>,
  hasNonSkipMap: Map<number, boolean>,
) {
  const db = getDb()
  const updateStmt = db.prepare(`
    UPDATE table_session SET status = 'PENDING_CHECKOUT'
    WHERE id = ? AND status = 'DINING'
  `)
  const hasTicketsStmt = db.prepare(`
    SELECT COUNT(*) AS cnt FROM order_ticket WHERE session_id = ?
  `)

  for (const row of baseRows) {
    if (row.session_status !== 'DINING' || !row.session_id) continue
    const unservedCount = unservedCountMap.get(row.id) ?? 0
    if (unservedCount > 0) continue

    const hasNonSkip = hasNonSkipMap.get(row.id)
    if (hasNonSkip === false) continue

    const ticketRow = hasTicketsStmt.get(row.session_id) as { cnt: number } | undefined
    if (!ticketRow || ticketRow.cnt === 0) continue

    updateStmt.run(row.session_id)
    row.session_status = 'PENDING_CHECKOUT'
  }
}

export function getTableSummary(tableId: number): TableSummary | null {
  const rows = listTableSummaries(tableId)
  return rows[0] ?? null
}
