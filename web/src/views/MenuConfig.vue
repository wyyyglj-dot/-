<script setup lang="ts">
import { onMounted, ref, h } from 'vue'
import { NLayout, NLayoutSider, NLayoutContent, NDataTable, NButton, NSpace, NTag, NModal, NInput, NInputNumber, NSelect, NPopconfirm, NSwitch, useMessage } from 'naive-ui'
import AppSidebar from '../components/layout/AppSidebar.vue'
import CategoryManager from '../components/business/CategoryManager.vue'
import { useMenuStore } from '../stores/menu'
import { centsToYuan, centsToYuanNumber, yuanToCents } from '../utils/currency'
import type { Dish } from '../types'

const menuStore = useMenuStore()
const message = useMessage()

const showDishModal = ref(false)
const showCatManager = ref(false)
const editingDish = ref<Dish | null>(null)
const dishForm = ref({ name: '', category_id: 0, sell_price: 0, cost_price: 0, discount_rate: 1, is_discount_enabled: 0, has_spice_option: 1 })

onMounted(() => menuStore.fetchMenu())

const categoryOptions = () => menuStore.categories.map(c => ({ label: c.name, value: c.id }))

const columns = [
  { title: '名称', key: 'name' },
  {
    title: '分类', key: 'category_id',
    render: (row: Dish) => menuStore.categories.find(c => c.id === row.category_id)?.name || '-',
  },
  { title: '售价', key: 'sell_price_cents', render: (row: Dish) => centsToYuan(row.sell_price_cents) },
  { title: '成本', key: 'cost_price_cents', render: (row: Dish) => centsToYuan(row.cost_price_cents) },
  {
    title: '折扣', key: 'discount',
    render: (row: Dish) => row.is_discount_enabled ? `${(row.discount_rate * 10).toFixed(1).replace(/\.0$/, '')}折` : '-',
  },
  {
    title: '状态', key: 'is_enabled',
    render: (row: Dish) => h(NTag, {
      type: row.is_enabled ? 'success' : 'error',
      size: 'small',
      style: { cursor: 'pointer' },
      onClick: () => toggleStatus(row),
    }, { default: () => row.is_enabled ? '在售' : '售罄' }),
  },
  {
    title: '操作', key: 'actions',
    render: (row: Dish) => h(NSpace, null, {
      default: () => [
        h(NButton, { size: 'small', onClick: () => openEdit(row) }, { default: () => '编辑' }),
        h(NPopconfirm, { onPositiveClick: () => handleDelete(row.id) }, {
          trigger: () => h(NButton, { size: 'small', type: 'error', ghost: true }, { default: () => '删除' }),
          default: () => '确定删除此菜品吗？',
        }),
      ],
    }),
  },
]

async function toggleStatus(dish: Dish) {
  try {
    await menuStore.updateDish(dish.id, { is_enabled: dish.is_enabled ? 0 : 1 })
    message.success('状态已更新')
  } catch (e: any) { message.error(e.message) }
}

function openEdit(dish: Dish) {
  editingDish.value = dish
  dishForm.value = {
    name: dish.name,
    category_id: dish.category_id,
    sell_price: centsToYuanNumber(dish.sell_price_cents),
    cost_price: centsToYuanNumber(dish.cost_price_cents),
    discount_rate: dish.discount_rate ?? 1,
    is_discount_enabled: dish.is_discount_enabled ?? 0,
    has_spice_option: dish.has_spice_option ?? 0,
  }
  showDishModal.value = true
}

async function handleDelete(id: number) {
  try {
    await menuStore.deleteDish(id)
    message.success('已删除')
  } catch (e: any) { message.error(e.message) }
}

async function submitDish() {
  try {
    const data = {
      name: dishForm.value.name,
      category_id: dishForm.value.category_id,
      sell_price_cents: yuanToCents(dishForm.value.sell_price),
      cost_price_cents: yuanToCents(dishForm.value.cost_price),
      discount_rate: dishForm.value.discount_rate,
      is_discount_enabled: dishForm.value.is_discount_enabled,
      has_spice_option: dishForm.value.has_spice_option,
    }
    if (editingDish.value) {
      await menuStore.updateDish(editingDish.value.id, data)
      message.success('修改成功')
    } else {
      await menuStore.addDish(data)
      message.success('添加成功')
    }
    closeDishModal()
  } catch (e: any) { message.error(e.message) }
}

function closeDishModal() {
  showDishModal.value = false
  editingDish.value = null
  dishForm.value = { name: '', category_id: 0, sell_price: 0, cost_price: 0, discount_rate: 1, is_discount_enabled: 0, has_spice_option: 1 }
}
</script>

<template>
  <n-layout has-sider class="h-screen bg-aurora">
    <n-layout-sider width="200" :native-scrollbar="false" content-style="height: 100%"><AppSidebar /></n-layout-sider>
    <n-layout-content class="p-8">
      <div class="max-w-6xl mx-auto">
        <div class="flex justify-between items-center mb-8">
          <h2 class="text-2xl font-bold">菜品管理</h2>
          <n-space>
            <n-button type="primary" @click="showDishModal = true">新增菜品</n-button>
            <n-button type="primary" secondary @click="showCatManager = true">分类管理</n-button>
          </n-space>
        </div>
        <n-data-table :columns="columns" :data="menuStore.dishes" :bordered="false" />
      </div>
    </n-layout-content>
  </n-layout>

  <n-modal
    v-model:show="showDishModal"
    preset="dialog"
    :title="editingDish ? '编辑菜品' : '新增菜品'"
    positive-text="确定"
    @positive-click="submitDish"
    @close="closeDishModal"
  >
    <div class="mt-4 space-y-3">
      <n-input v-model:value="dishForm.name" placeholder="菜品名称" />
      <n-select v-model:value="dishForm.category_id" :options="categoryOptions()" placeholder="选择分类" />
      <div>
        <label class="block text-sm text-[var(--text-secondary)] mb-1">售价（元）</label>
        <n-input-number v-model:value="dishForm.sell_price" :min="0" :precision="2" class="w-full" />
      </div>
      <div>
        <label class="block text-sm text-[var(--text-secondary)] mb-1">成本价（元）</label>
        <n-input-number v-model:value="dishForm.cost_price" :min="0" :precision="2" class="w-full" />
      </div>
      <div class="pt-2 border-t border-[var(--glass-border-l1)]">
        <div class="flex items-center justify-between mb-2">
          <label class="text-sm font-bold text-[var(--text-secondary)]">启用商品折扣</label>
          <n-switch v-model:value="dishForm.is_discount_enabled" :checked-value="1" :unchecked-value="0" />
        </div>
        <n-input-number v-if="dishForm.is_discount_enabled" v-model:value="dishForm.discount_rate" :min="0.1" :max="1.0" :step="0.1" :precision="2" class="w-full" />
        <div class="text-[10px] text-[var(--text-muted)] mt-1">启用后将覆盖分类折扣，例如 0.8 代表 8 折</div>
      </div>
      <div class="pt-2 border-t border-[var(--glass-border-l1)]">
        <div class="flex items-center justify-between">
          <label class="text-sm font-bold text-[var(--text-secondary)]">支持辣度选择</label>
          <n-switch v-model:value="dishForm.has_spice_option" :checked-value="1" :unchecked-value="0" />
        </div>
        <div class="text-[10px] text-[var(--text-muted)] mt-1">开启后点餐时可选择微辣/中辣/特辣</div>
      </div>
    </div>
  </n-modal>

  <CategoryManager v-model:show="showCatManager" />
</template>
