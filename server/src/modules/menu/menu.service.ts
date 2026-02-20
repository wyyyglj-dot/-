import { DomainError } from '../../shared/errors'
import {
  optionalString,
  requireNonNegativeInt,
  requirePositiveInt,
  requireString,
} from '../../shared/validation'
import { sseHub } from '../sse/sse.hub'
import { Category, Dish } from '../../shared/types'
import * as repo from './menu.repo'

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

function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new DomainError('VALIDATION_ERROR', 'Request body must be an object')
  }
  return value as Record<string, unknown>
}

function firstQueryValue(value: unknown): unknown {
  if (Array.isArray(value)) return value[0]
  return value
}

function parseEnabled(value: unknown, field: string): number {
  if (value === 1 || value === '1' || value === true || value === 'true') return 1
  if (value === 0 || value === '0' || value === false || value === 'false') return 0
  throw new DomainError('VALIDATION_ERROR', `${field} must be 0 or 1`)
}

function parseDiscountRate(value: unknown, field: string): number {
  const n = Number(value)
  if (!Number.isFinite(n) || n < 0 || n > 1) {
    throw new DomainError('VALIDATION_ERROR', `${field} must be between 0 and 1`)
  }
  return n
}

export function listCategories(): Category[] {
  return repo.listCategories()
}

export function createCategory(input: unknown): Category {
  const body = asObject(input)
  const name = requireString(body.name, 'name')
  const sortOrder = body.sort_order === undefined ? 0 : requireNonNegativeInt(body.sort_order, 'sort_order')
  const isEnabled = body.is_enabled === undefined ? 1 : parseEnabled(body.is_enabled, 'is_enabled')
  const skipQueue = body.skip_queue === undefined ? 0 : parseEnabled(body.skip_queue, 'skip_queue')
  const discountRate = body.discount_rate === undefined ? 1 : parseDiscountRate(body.discount_rate, 'discount_rate')
  const isDiscountEnabled = body.is_discount_enabled === undefined
    ? 0
    : parseEnabled(body.is_discount_enabled, 'is_discount_enabled')
  return repo.createCategory(name, sortOrder, isEnabled, skipQueue, discountRate, isDiscountEnabled)
}

export function updateCategory(id: number, input: unknown): Category {
  const body = asObject(input)
  const patch: CategoryPatch = {}

  if (body.name !== undefined) patch.name = requireString(body.name, 'name')
  if (body.sort_order !== undefined) patch.sort_order = requireNonNegativeInt(body.sort_order, 'sort_order')
  if (body.is_enabled !== undefined) patch.is_enabled = parseEnabled(body.is_enabled, 'is_enabled')
  if (body.skip_queue !== undefined) patch.skip_queue = parseEnabled(body.skip_queue, 'skip_queue')
  if (body.discount_rate !== undefined) patch.discount_rate = parseDiscountRate(body.discount_rate, 'discount_rate')
  if (body.is_discount_enabled !== undefined) patch.is_discount_enabled = parseEnabled(body.is_discount_enabled, 'is_discount_enabled')

  if (Object.keys(patch).length === 0) {
    throw new DomainError('VALIDATION_ERROR', 'At least one updatable field is required')
  }

  return repo.updateCategory(id, patch)
}

export function deleteCategory(id: number): { id: number } {
  return repo.deleteCategory(id)
}

export function listDishes(query: Record<string, unknown>): Dish[] {
  const q = optionalString(firstQueryValue(query.q))
  const categoryIdRaw = firstQueryValue(query.categoryId)
  const enabledRaw = firstQueryValue(query.enabled)

  const categoryId = categoryIdRaw === undefined ? undefined : requirePositiveInt(categoryIdRaw, 'categoryId')
  const enabled = enabledRaw === undefined ? undefined : parseEnabled(enabledRaw, 'enabled')

  return repo.listDishes({
    q,
    categoryId,
    enabled,
  })
}

export function createDish(input: unknown): Dish {
  const body = asObject(input)
  const categoryId = requirePositiveInt(body.category_id, 'category_id')
  const name = requireString(body.name, 'name')
  const sellPrice = requireNonNegativeInt(body.sell_price_cents, 'sell_price_cents')
  const costPrice = body.cost_price_cents === undefined
    ? 0
    : requireNonNegativeInt(body.cost_price_cents, 'cost_price_cents')
  const sortOrder = body.sort_order === undefined ? 0 : requireNonNegativeInt(body.sort_order, 'sort_order')
  const isEnabled = body.is_enabled === undefined ? 1 : parseEnabled(body.is_enabled, 'is_enabled')
  const discountRate = body.discount_rate === undefined ? 1 : parseDiscountRate(body.discount_rate, 'discount_rate')
  const isDiscountEnabled = body.is_discount_enabled === undefined
    ? 0
    : parseEnabled(body.is_discount_enabled, 'is_discount_enabled')
  const hasSpiceOption = body.has_spice_option === undefined
    ? 0
    : parseEnabled(body.has_spice_option, 'has_spice_option')

  const created = repo.createDish({
    category_id: categoryId,
    name,
    sell_price_cents: sellPrice,
    cost_price_cents: costPrice,
    discount_rate: discountRate,
    is_discount_enabled: isDiscountEnabled,
    has_spice_option: hasSpiceOption,
    sort_order: sortOrder,
    is_enabled: isEnabled,
  })
  sseHub.broadcast('menu.updated', { action: 'created', dish_id: created.id })
  return created
}

export function updateDish(id: number, input: unknown): Dish {
  const body = asObject(input)
  const patch: DishPatch = {}

  if (body.category_id !== undefined) patch.category_id = requirePositiveInt(body.category_id, 'category_id')
  if (body.name !== undefined) patch.name = requireString(body.name, 'name')
  if (body.sell_price_cents !== undefined) {
    patch.sell_price_cents = requireNonNegativeInt(body.sell_price_cents, 'sell_price_cents')
  }
  if (body.cost_price_cents !== undefined) {
    patch.cost_price_cents = requireNonNegativeInt(body.cost_price_cents, 'cost_price_cents')
  }
  if (body.discount_rate !== undefined) patch.discount_rate = parseDiscountRate(body.discount_rate, 'discount_rate')
  if (body.is_discount_enabled !== undefined) patch.is_discount_enabled = parseEnabled(body.is_discount_enabled, 'is_discount_enabled')
  if (body.has_spice_option !== undefined) patch.has_spice_option = parseEnabled(body.has_spice_option, 'has_spice_option')
  if (body.sort_order !== undefined) patch.sort_order = requireNonNegativeInt(body.sort_order, 'sort_order')
  if (body.is_enabled !== undefined) patch.is_enabled = parseEnabled(body.is_enabled, 'is_enabled')

  if (Object.keys(patch).length === 0) {
    throw new DomainError('VALIDATION_ERROR', 'At least one updatable field is required')
  }

  const updated = repo.updateDish(id, patch)
  sseHub.broadcast('menu.updated', { action: 'updated', dish_id: updated.id })
  return updated
}

export function deleteDish(id: number): { id: number } {
  const deleted = repo.deleteDish(id)
  sseHub.broadcast('menu.updated', { action: 'deleted', dish_id: id })
  return deleted
}
