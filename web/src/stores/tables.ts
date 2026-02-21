import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { TableSummary } from '../types'
import * as api from '../api/tables'

export const useTableStore = defineStore('tables', () => {
  const tables = ref<TableSummary[]>([])

  const activeTables = computed(() => tables.value.filter(t => t.status !== 'idle'))
  const idleTables = computed(() => tables.value.filter(t => t.status === 'idle'))

  async function fetchTables() {
    tables.value = await api.getTablesSummary()
  }

  async function openTable(tableId: number): Promise<number> {
    const result = await api.openTable(tableId)
    await fetchTables()
    return result.session_id
  }

  async function cancelSession(sessionId: number) {
    await api.cancelSession(sessionId)
    await fetchTables()
  }

  function updateTableLocally(updated: TableSummary) {
    const idx = tables.value.findIndex(t => t.id === updated.id)
    if (idx >= 0) {
      tables.value[idx] = updated
    } else {
      tables.value.push(updated)
    }
  }

  async function addTable(tableNo: string, sortOrder?: number) {
    await api.createTable({ table_no: tableNo, sort_order: sortOrder })
    await fetchTables()
  }

  async function renameTable(id: number, newName: string) {
    await api.updateTable(id, { table_no: newName })
    await fetchTables()
  }

  async function deleteTable(id: number) {
    await api.deleteTable(id)
    await fetchTables()
  }

  return { tables, activeTables, idleTables, fetchTables, openTable, cancelSession, addTable, renameTable, deleteTable, updateTableLocally }
})
