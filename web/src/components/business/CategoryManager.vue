<script setup lang="ts">
import { h, ref } from 'vue'
import { NModal, NDataTable, NButton, NInput, NInputNumber, NSwitch, NSpace, NPopconfirm, useMessage } from 'naive-ui'
import { useMenuStore } from '../../stores/menu'
import type { Category } from '../../types'

const props = defineProps<{ show: boolean }>()
const emit = defineEmits<{ 'update:show': [value: boolean] }>()

const menuStore = useMenuStore()
const message = useMessage()
const newCategoryName = ref('')

const columns = [
  {
    title: '排序',
    key: 'sort_order',
    width: 80,
    render: (row: Category) => {
      return h(NInputNumber, {
        value: row.sort_order,
        size: 'small',
        showButton: false,
        onUpdateValue: (v) => handleUpdate(row.id, { sort_order: v || 0 })
      })
    }
  },
  {
    title: '名称',
    key: 'name',
    render: (row: Category) => {
      return h(NInput, {
        value: row.name,
        size: 'small',
        onUpdateValue: (v) => row.name = v, // Optimistic update for UI
        onChange: (v) => handleUpdate(row.id, { name: v }) // Commit on blur/enter
      })
    }
  },
  {
    title: '免排队',
    key: 'skip_queue',
    width: 80,
    render: (row: Category) => {
      return h(NSwitch, {
        value: !!row.skip_queue,
        size: 'small',
        onUpdateValue: (v) => handleUpdate(row.id, { skip_queue: v ? 1 : 0 })
      })
    }
  },
  {
    title: '折扣率(%)',
    key: 'discount_rate',
    width: 100,
    render: (row: Category) => {
      return h(NInputNumber, {
        value: Math.round(row.discount_rate * 100),
        min: 1,
        max: 100,
        size: 'small',
        showButton: false,
        disabled: !row.is_discount_enabled,
        placeholder: '100',
        onUpdateValue: (v) => handleUpdate(row.id, { discount_rate: (v || 100) / 100 })
      })
    }
  },
  {
    title: '开启折扣',
    key: 'is_discount_enabled',
    width: 90,
    render: (row: Category) => {
      return h(NSwitch, {
        value: !!row.is_discount_enabled,
        size: 'small',
        onUpdateValue: (v) => handleUpdate(row.id, { is_discount_enabled: v ? 1 : 0 })
      })
    }
  },
  {
    title: '状态',
    key: 'is_enabled',
    width: 80,
    render: (row: Category) => {
      return h(NSwitch, {
        value: !!row.is_enabled,
        size: 'small',
        checkedChildren: '启用',
        unCheckedChildren: '禁用',
        onUpdateValue: (v) => handleUpdate(row.id, { is_enabled: v ? 1 : 0 })
      })
    }
  },
  {
    title: '操作',
    key: 'actions',
    width: 80,
    render: (row: Category) => {
      return h(NPopconfirm, {
        onPositiveClick: () => handleDelete(row.id),
      }, {
        trigger: () => h(NButton, { size: 'small', type: 'error', text: true }, { default: () => '删除' }),
        default: () => '确定删除此分类？'
      })
    }
  }
]

async function handleUpdate(id: number, data: Partial<Category>) {
  try {
    await menuStore.updateCategory(id, data)
  } catch (e: any) {
    message.error(e.message || '更新失败')
    await menuStore.fetchMenu() // Revert on error
  }
}

async function handleDelete(id: number) {
  // Check if category has dishes
  if (menuStore.dishes.some(d => d.category_id === id)) {
    message.warning('该分类下还有菜品，无法删除')
    return
  }
  try {
    await menuStore.deleteCategory(id)
    message.success('已删除')
  } catch (e: any) {
    message.error(e.message || '删除失败')
  }
}

async function handleAdd() {
  if (!newCategoryName.value.trim()) return
  try {
    await menuStore.addCategory(newCategoryName.value)
    newCategoryName.value = ''
    message.success('添加成功')
  } catch (e: any) {
    message.error(e.message || '添加失败')
  }
}
</script>

<template>
  <n-modal
    :show="show"
    @update:show="$emit('update:show', $event)"
    preset="card"
    title="分类管理"
    style="width: 800px; max-width: 95vw;"
  >
    <div class="mb-4 flex gap-2">
      <n-input v-model:value="newCategoryName" placeholder="输入新分类名称" @keydown.enter="handleAdd" />
      <n-button type="primary" @click="handleAdd" :disabled="!newCategoryName.trim()">
        新增分类
      </n-button>
    </div>
    
    <n-data-table
      :columns="columns"
      :data="menuStore.categories"
      :bordered="false"
      size="small"
      max-height="60vh"
    />
  </n-modal>
</template>
