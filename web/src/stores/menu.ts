import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Category, Dish } from '../types'
import * as api from '../api/menu'

export const useMenuStore = defineStore('menu', () => {
  const categories = ref<Category[]>([])
  const dishes = ref<Dish[]>([])

  async function fetchMenu() {
    const [cats, ds] = await Promise.all([api.getCategories(), api.getDishes()])
    categories.value = cats
    dishes.value = ds
  }

  async function addCategory(name: string, sort_order?: number) {
    const cat = await api.createCategory({ name, sort_order })
    categories.value.push(cat)
    return cat
  }

  async function updateCategory(id: number, data: Partial<Category>) {
    const updated = await api.updateCategory(id, data)
    const idx = categories.value.findIndex(c => c.id === id)
    if (idx !== -1) categories.value[idx] = updated
    return updated
  }

  async function deleteCategory(id: number) {
    await api.deleteCategory(id)
    categories.value = categories.value.filter(c => c.id !== id)
  }

  async function addDish(data: Parameters<typeof api.createDish>[0]) {
    const dish = await api.createDish(data)
    dishes.value.push(dish)
    return dish
  }

  async function updateDish(id: number, data: Partial<Dish>) {
    const updated = await api.updateDish(id, data)
    const idx = dishes.value.findIndex(d => d.id === id)
    if (idx !== -1) dishes.value[idx] = updated
    return updated
  }

  async function deleteDish(id: number) {
    await api.deleteDish(id)
    dishes.value = dishes.value.filter(d => d.id !== id)
  }

  return { categories, dishes, fetchMenu, addCategory, updateCategory, deleteCategory, addDish, updateDish, deleteDish }
})
