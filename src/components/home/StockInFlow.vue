<template>
  <FlowDialog
    :model-value="modelValue"
    flow="stock-in"
    title="Stock in supplies"
    icon="inventory_2"
    :primary-label="primaryLabel"
    :primary-disabled="!canSubmit"
    :submitting="write.submitting.value"
    :error="write.error.value"
    :retryable="write.retryable.value"
    :done="write.done.value"
    again-label="Add another delivery"
    @update:model-value="emit('update:modelValue', $event)"
    @submit="submit"
    @retry="write.retry"
    @again="start"
  >
    <q-select
      v-model="supplierId"
      outlined
      emit-value
      map-options
      :options="supplierOptions"
      label="Bought from"
      data-stock-in-supplier
    />

    <p class="flow-lead">What arrived? Fill in only what you received.</p>

    <div class="stock-in__list">
      <div
        v-for="material in materials"
        :key="material.id"
        class="stock-in__row"
        :class="{ 'stock-in__row--active': quantityOf(material) > 0 }"
        :data-material="material.code"
      >
        <div class="stock-in__head">
          <span class="stock-in__name">{{ material.name }}</span>
          <span class="stock-in__have">
            Have {{ formatMaterialAmount(material, material.on_hand) }}
          </span>
        </div>
        <div class="stock-in__fields">
          <q-input
            v-model.number="lines[material.id].quantity"
            dense
            outlined
            type="number"
            inputmode="decimal"
            min="0"
            :label="`How many ${purchaseUnitHint(material)}`"
            class="stock-in__qty"
          />
          <q-input
            v-model.number="lines[material.id].paid"
            dense
            outlined
            type="number"
            inputmode="numeric"
            min="0"
            label="Total paid (UGX)"
            class="stock-in__paid"
            :error="quantityOf(material) > 0 && !(lines[material.id].paid > 0)"
            error-message="Enter what you paid"
            hide-bottom-space
          />
        </div>
      </div>
    </div>

    <template #summary>
      <p v-if="received.length" class="flow-total">
        <span>Total paid</span>
        <span class="flow-total__value tabular-nums">{{
          formatMoney(totalPaid)
        }}</span>
      </p>
    </template>
  </FlowDialog>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue'
import FlowDialog from './FlowDialog.vue'
import { useFlowWrite } from '@/composables/useFlowWrite'
import { formatMoney } from '@/lib/format'
import {
  formatMaterialAmount,
  purchaseUnitHint,
  toBaseQuantity,
  unitCostFromTotal
} from '@/lib/simpleOps'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  materials: { type: Array, default: () => [] },
  suppliers: { type: Array, default: () => [] }
})
const emit = defineEmits(['update:modelValue', 'saved'])

const SUPPLIER_KEY = 'boms:home:last-supplier'
const write = useFlowWrite('purchases')
const supplierId = ref(null)
const lines = reactive({})

const supplierOptions = computed(() =>
  props.suppliers.map(s => ({ label: s.supplier_name, value: Number(s.id) }))
)
const quantityOf = material => Number(lines[material.id]?.quantity) || 0
const received = computed(() =>
  props.materials.filter(material => quantityOf(material) > 0)
)
const totalPaid = computed(() =>
  received.value.reduce((sum, m) => sum + (Number(lines[m.id].paid) || 0), 0)
)
const canSubmit = computed(
  () =>
    Boolean(supplierId.value) &&
    received.value.length > 0 &&
    received.value.every(m => Number(lines[m.id].paid) > 0)
)
const primaryLabel = computed(() =>
  received.value.length
    ? `Save ${received.value.length} ${received.value.length === 1 ? 'item' : 'items'}`
    : 'Save delivery'
)

function ensureLines() {
  for (const material of props.materials)
    if (!lines[material.id]) lines[material.id] = { quantity: null, paid: null }
}
watch(() => props.materials, ensureLines, { immediate: true })

function start() {
  for (const key of Object.keys(lines)) delete lines[key]
  ensureLines()
  write.reset()
  let remembered = null
  try {
    remembered = Number(localStorage.getItem(SUPPLIER_KEY)) || null
  } catch {
    /* Storage is a convenience only. */
  }
  const ids = supplierOptions.value.map(o => o.value)
  supplierId.value = ids.includes(remembered) ? remembered : (ids[0] ?? null)
}
watch(
  () => props.modelValue,
  open => {
    if (open && !write.retryable.value) start()
  }
)

async function submit() {
  const items = received.value.map(material => {
    const quantity = toBaseQuantity(material, lines[material.id].quantity)
    return {
      material_id: Number(material.id),
      quantity,
      unit_cost: unitCostFromTotal(lines[material.id].paid, quantity),
      lot_code: null
    }
  })
  const summary = received.value.map(
    material =>
      `${formatMaterialAmount(material, toBaseQuantity(material, lines[material.id].quantity))} ${material.name}`
  )
  const paid = totalPaid.value
  try {
    localStorage.setItem(SUPPLIER_KEY, String(supplierId.value))
  } catch {
    /* Storage is a convenience only. */
  }
  const result = await write.submit(
    {
      supplierId: supplierId.value,
      purchasedAt: new Date().toISOString(),
      purchaseReference: null,
      notes: null,
      items
    },
    () => ({
      title: 'Supplies stocked in',
      lines: [...summary, `Paid ${formatMoney(paid)}`]
    })
  )
  if (result) emit('saved')
}
</script>

<style scoped src="./flow.css"></style>
<style scoped>
.stock-in__list {
  display: flex;
  flex-direction: column;
  gap: var(--boms-space-2);
}
.stock-in__row {
  display: flex;
  flex-direction: column;
  gap: var(--boms-space-2);
  padding: var(--boms-space-3);
  border: 1px solid var(--boms-color-border);
  border-radius: var(--boms-radius-md);
  background: var(--boms-color-surface);
}
.stock-in__row--active {
  border-color: var(--boms-color-border-strong);
  background: var(--boms-color-selected-bg);
}
.stock-in__head {
  display: flex;
  justify-content: space-between;
  gap: var(--boms-space-2);
  flex-wrap: wrap;
}
.stock-in__name {
  font-weight: 800;
  color: var(--boms-color-heading);
}
.stock-in__have {
  font-size: var(--boms-font-size-caption);
  color: var(--boms-color-text-muted);
}
.stock-in__fields {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--boms-space-2);
}
</style>
