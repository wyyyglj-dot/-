import { getDb } from '../../db/client'
import { ConflictError, NotFoundError } from '../../shared/errors'
import { Category, Dish } from '../../shared/types'

export interface DishFilters {
  q?: string
  categoryId?: number
  enabled?: number
}

interface CategoryPatch {
  name?: string
  sort_order?: number
  is_enabled?: number
  skip_queue?: number
  discount_rate?: number
  is_discount_enabled?: number
}

interface DishPatch {
  category_id?: number
  name?: string
  sell_price_cents?: number
  cost_price_cents?: number
  discount_rate?: number
  is_discount_enabled?: number
  has_spice_option?: number
  sort_order?: number
  is_enabled?: number
}

function isUniqueConstraint(err: unknown): boolean {
  return err instanceof Error && err.message.includes('UNIQUE constraint failed')
}

function ensureCategoryExists(categoryId: number): void {
  const db = getDb()
  const row = db.prepare('SELECT id FROM menu_category WHERE id = ?').get(categoryId) as { id: number } | undefined
  if (!row) throw new NotFoundError('Category')
}

function getCategoryById(id: number): Category {
  const db = getDb()
  const row = db.prepare(`
    SELECT id, name, sort_order, is_enabled, skip_queue, discount_rate, is_discount_enabled
    FROM menu_category
    WHERE id = ?
  `).get(id) as Category | undefined
  if (!row) throw new NotFoundError('Category')
  return row
}

function getDishById(id: number): Dish {
  const db = getDb()
  const row = db.prepare(`
    SELECT id, category_id, name, sell_price_cents, cost_price_cents, discount_rate, is_discount_enabled, has_spice_option, sort_order, is_enabled
    FROM menu_dish
    WHERE id = ?
  `).get(id) as Dish | undefined
  if (!row) throw new NotFoundError('Dish')
  return row
}

export function listCategories(): Category[] {
  const db = getDb()
  return db.prepare(`
    SELECT id, name, sort_order, is_enabled, skip_queue, discount_rate, is_discount_enabled
    FROM menu_category
    ORDER BY sort_order ASC, id ASC
  `).all() as Category[]
}

export function createCategory(
  name: string,
  sortOrder: number,
  isEnabled: number,
  skipQueue: number,
  discountRate: number,
  isDiscountEnabled: number,
): Category {
  const db = getDb()
  try {
    const result = db.prepare(`
      INSERT INTO menu_category (name, sort_order, is_enabled, skip_queue, discount_rate, is_discount_enabled)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(name, sortOrder, isEnabled, skipQueue, discountRate, isDiscountEnabled)
    return getCategoryById(Number(result.lastInsertRowid))
  } catch (err) {
    if (isUniqueConstraint(err)) {
      throw new ConflictError('Category name already exists', 'CATEGORY_NAME_CONFLICT')
    }
    throw err
  }
}

export function updateCategory(id: number, patch: CategoryPatch): Category {
  const db = getDb()
  const fields: string[] = []
  const params: unknown[] = []

  if (patch.name !== undefined) {
    fields.push('name = ?')
    params.push(patch.name)
  }
  if (patch.sort_order !== undefined) {
    fields.push('sort_order = ?')
    params.push(patch.sort_order)
  }
  if (patch.is_enabled !== undefined) {
    fields.push('is_enabled = ?')
    params.push(patch.is_enabled)
  }
  if (patch.skip_queue !== undefined) {
    fields.push('skip_queue = ?')
    params.push(patch.skip_queue)
  }
  if (patch.discount_rate !== undefined) {
    fields.push('discount_rate = ?')
    params.push(patch.discount_rate)
  }
  if (patch.is_discount_enabled !== undefined) {
    fields.push('is_discount_enabled = ?')
    params.push(patch.is_discount_enabled)
  }

  fields.push(`updated_at = datetime('now')`)
  params.push(id)

  try {
    const result = db.prepare(`
      UPDATE menu_category
      SET ${fields.join(', ')}
      WHERE id = ?
    `).run(...params)

    if (result.changes === 0) throw new NotFoundError('Category')
    return getCategoryById(id)
  } catch (err) {
    if (isUniqueConstraint(err)) {
      throw new ConflictError('Category name already exists', 'CATEGORY_NAME_CONFLICT')
    }
    throw err
  }
}

export function deleteCategory(id: number): { id: number } {
  const db = getDb()
  const tx = db.transaction((categoryId: number) => {
    getCategoryById(categoryId)
    const refRow = db.prepare(
      'SELECT COUNT(*) AS cnt FROM menu_dish WHERE category_id = ?'
    ).get(categoryId) as { cnt: number } | undefined
    if ((refRow?.cnt ?? 0) > 0) {
      throw new ConflictError('Category has dishes', 'CATEGORY_HAS_DISHES')
    }
    const result = db.prepare('DELETE FROM menu_category WHERE id = ?').run(categoryId)
    if (result.changes === 0) throw new NotFoundError('Category')
    return { id: categoryId }
  })
  return tx(id)
}

export function listDishes(filters: DishFilters): Dish[] {
  const db = getDb()
  const where: string[] = []
  const params: unknown[] = []

  if (filters.q) {
    where.push('d.name LIKE ?')
    params.push(`%${filters.q}%`)
  }
  if (filters.categoryId !== undefined) {
    where.push('d.category_id = ?')
    params.push(filters.categoryId)
  }
  if (filters.enabled !== undefined) {
    where.push('d.is_enabled = ?')
    params.push(filters.enabled)
  }

  const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : ''
  return db.prepare(`
    SELECT d.id, d.category_id, d.name, d.sell_price_cents, d.cost_price_cents, d.discount_rate, d.is_discount_enabled, d.has_spice_option, d.sort_order, d.is_enabled
    FROM menu_dish d
    ${whereClause}
    ORDER BY d.sort_order ASC, d.id ASC
  `).all(...params) as Dish[]
}

export function createDish(input: {
  category_id: number
  name: string
  sell_price_cents: number
  cost_price_cents: number
  discount_rate: number
  is_discount_enabled: number
  has_spice_option: number
  sort_order: number
  is_enabled: number
}): Dish {
  const db = getDb()
  ensureCategoryExists(input.category_id)

  const result = db.prepare(`
    INSERT INTO menu_dish (
      category_id,
      name,
      sell_price_cents,
      cost_price_cents,
      discount_rate,
      is_discount_enabled,
      has_spice_option,
      sort_order,
      is_enabled
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    input.category_id,
    input.name,
    input.sell_price_cents,
    input.cost_price_cents,
    input.discount_rate,
    input.is_discount_enabled,
    input.has_spice_option,
    input.sort_order,
    input.is_enabled,
  )

  return getDishById(Number(result.lastInsertRowid))
}

export function updateDish(id: number, patch: DishPatch): Dish {
  const db = getDb()
  if (patch.category_id !== undefined) {
    ensureCategoryExists(patch.category_id)
  }

  const fields: string[] = []
  const params: unknown[] = []

  if (patch.category_id !== undefined) {
    fields.push('category_id = ?')
    params.push(patch.category_id)
  }
  if (patch.name !== undefined) {
    fields.push('name = ?')
    params.push(patch.name)
  }
  if (patch.sell_price_cents !== undefined) {
    fields.push('sell_price_cents = ?')
    params.push(patch.sell_price_cents)
  }
  if (patch.cost_price_cents !== undefined) {
    fields.push('cost_price_cents = ?')
    params.push(patch.cost_price_cents)
  }
  if (patch.discount_rate !== undefined) {
    fields.push('discount_rate = ?')
    params.push(patch.discount_rate)
  }
  if (patch.is_discount_enabled !== undefined) {
    fields.push('is_discount_enabled = ?')
    params.push(patch.is_discount_enabled)
  }
  if (patch.has_spice_option !== undefined) {
    fields.push('has_spice_option = ?')
    params.push(patch.has_spice_option)
  }
  if (patch.sort_order !== undefined) {
    fields.push('sort_order = ?')
    params.push(patch.sort_order)
  }
  if (patch.is_enabled !== undefined) {
    fields.push('is_enabled = ?')
    params.push(patch.is_enabled)
  }

  fields.push(`updated_at = datetime('now')`)
  params.push(id)

  const result = db.prepare(`
    UPDATE menu_dish
    SET ${fields.join(', ')}
    WHERE id = ?
  `).run(...params)

  if (result.changes === 0) throw new NotFoundError('Dish')
  return getDishById(id)
}

export function deleteDish(id: number): { id: number } {
  const db = getDb()

  const tx = db.transaction((dishId: number) => {
    getDishById(dishId)

    const refRow = db.prepare(`
      SELECT COUNT(*) AS cnt FROM order_ticket_item WHERE source_dish_id = ?
    `).get(dishId) as { cnt: number } | undefined

    if ((refRow?.cnt ?? 0) > 0) {
      throw new ConflictError('Dish is referenced by order history', 'DISH_IN_USE')
    }

    try {
      const result = db.prepare('DELETE FROM menu_dish WHERE id = ?').run(dishId)
      if (result.changes === 0) throw new NotFoundError('Dish')
    } catch (err) {
      if (err instanceof Error && err.message.includes('FOREIGN KEY constraint failed')) {
        throw new ConflictError('Dish is referenced by order history', 'DISH_IN_USE')
      }
      throw err
    }

    return { id: dishId }
  })

  return tx(id)
}
