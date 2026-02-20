import { get, post, patch, del } from './client'
import type { Category, Dish } from '../types'

export const getCategories = () => get<Category[]>('/categories')
export const createCategory = (data: { name: string; sort_order?: number }) => post<Category>('/categories', data)
export const updateCategory = (id: number, data: Partial<Category>) => patch<Category>(`/categories/${id}`, data)
export const deleteCategory = (id: number) => del<{ id: number }>(`/categories/${id}`)

export const getDishes = (params?: { q?: string; categoryId?: number; enabled?: boolean }) => {
  const qs = new URLSearchParams()
  if (params?.q) qs.set('q', params.q)
  if (params?.categoryId) qs.set('categoryId', String(params.categoryId))
  if (params?.enabled !== undefined) qs.set('enabled', String(params.enabled))
  const query = qs.toString()
  return get<Dish[]>(`/dishes${query ? `?${query}` : ''}`)
}
export const createDish = (data: { category_id: number; name: string; sell_price_cents: number; cost_price_cents?: number; discount_rate?: number; is_discount_enabled?: number }) => post<Dish>('/dishes', data)
export const updateDish = (id: number, data: Partial<Dish>) => patch<Dish>(`/dishes/${id}`, data)
export const deleteDish = (id: number) => del<{ id: number }>(`/dishes/${id}`)
