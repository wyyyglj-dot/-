<script setup lang="ts">
import { ref } from 'vue'
import { NModal, NInput, NInputNumber, NButton } from 'naive-ui'
import { yuanToCents } from '../../utils/currency'

const emit = defineEmits<{ add: [item: { id: number; name: string; price_cents: number }] }>()
const showModal = ref(false)
const form = ref({ name: '', price: 0 })

function handleConfirm() {
  if (form.value.price > 0) {
    emit('add', {
      id: -Date.now(),
      name: form.value.name || '临时菜品',
      price_cents: yuanToCents(form.value.price),
    })
    showModal.value = false
    form.value = { name: '', price: 0 }
  }
}
</script>

<template>
  <div
    class="rounded-xl border-2 border-dashed border-[var(--action-border)] bg-[var(--action-bg)] p-4 cursor-pointer flex flex-col items-center justify-center hover:border-[var(--primary)] hover:bg-[var(--action-bg-hover)] transition-colors min-h-[100px]"
    @click="showModal = true"
  >
    <span class="text-3xl text-[var(--text-secondary)]">+</span>
    <span class="text-[var(--text-secondary)] font-medium text-sm mt-1">临时加菜</span>
  </div>

  <n-modal v-model:show="showModal" preset="dialog" title="临时加菜" positive-text="确定" @positive-click="handleConfirm">
    <div class="mt-4 space-y-4">
      <div>
        <label class="block text-sm font-medium mb-1">名称</label>
        <n-input v-model:value="form.name" placeholder="请输入菜品名称" />
      </div>
      <div>
        <label class="block text-sm font-medium mb-1">单价 (元)</label>
        <n-input-number
          v-model:value="form.price"
          :min="0"
          :precision="2"
          class="w-full"
          placeholder="请输入金额"
        />
      </div>
    </div>
  </n-modal>
</template>
