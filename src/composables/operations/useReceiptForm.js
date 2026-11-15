import { computed, reactive } from 'vue'
import { asNumber, getTodayString, toIsoTimestamp } from '@/lib/format'
import { createLineKey, resetArray } from './lineKeys'

export const RECEIPT_FIELD_IDS = Object.freeze({
  supplier: 'purchase-supplier',
  date: 'purchase-date',
  line: (index, field) => `purchase-line-${index}-${field}`
})

function createPurchaseLine() {
  return {
    key: createLineKey('purchase'),
    materialId: null,
    quantity: '',
    unitCost: '',
    lotCode: ''
  }
}

function findDuplicateLotCode(items) {
  const seenLotCodes = new Set()

  for (const [index, item] of items.entries()) {
    if (typeof item.lot_code !== 'string' || item.lot_code.length === 0) {
      continue
    }

    const normalizedLotCode = item.lot_code.toLowerCase()

    if (seenLotCodes.has(normalizedLotCode)) {
      return { index, lotCode: item.lot_code }
    }

    seenLotCodes.add(normalizedLotCode)
  }

  return null
}

/**
 * Purchase receipt form state, line handling and the exact payload sent to
 * `writeAction('purchases')`. Lives in the page so input survives switching
 * tasks; ReceiptForm.vue only renders it.
 */
export function useReceiptForm() {
  const state = reactive({
    supplierId: null,
    purchasedOn: getTodayString(),
    purchaseReference: '',
    notes: '',
    items: [createPurchaseLine()]
  })

  const total = computed(() =>
    state.items.reduce(
      (sum, item) => sum + asNumber(item.quantity) * asNumber(item.unitCost),
      0
    )
  )

  function addLine() {
    state.items.push(createPurchaseLine())
  }

  function removeLine(lineKey) {
    if (state.items.length === 1) {
      return
    }

    resetArray(
      state.items,
      state.items.filter(item => item.key !== lineKey)
    )
  }

  function reset() {
    state.supplierId = null
    state.purchasedOn = getTodayString()
    state.purchaseReference = ''
    state.notes = ''
    resetArray(state.items, [createPurchaseLine()])
  }

  /** Restored drafts get fresh line keys so they never collide. */
  function deserialize(saved) {
    return {
      ...saved,
      items: (Array.isArray(saved?.items) ? saved.items : []).map(item => ({
        ...createPurchaseLine(),
        ...item,
        key: createLineKey('purchase')
      }))
    }
  }

  /**
   * Business rules checked before saving (field rules run first in QForm).
   * Returns `{ errors }` for the summary or `{ payload }` for the write.
   */
  function build() {
    const normalizedItems = state.items.map(item => ({
      material_id: item.materialId,
      quantity:
        item.quantity === '' ? Number.NaN : asNumber(item.quantity, NaN),
      unit_cost:
        item.unitCost === '' ? Number.NaN : asNumber(item.unitCost, NaN),
      lot_code: item.lotCode?.trim() || null
    }))
    const duplicate = findDuplicateLotCode(normalizedItems)

    if (!state.supplierId) {
      return {
        errors: [
          {
            id: RECEIPT_FIELD_IDS.supplier,
            label: 'Supplier',
            message: 'Select a supplier before recording a purchase.'
          }
        ]
      }
    }

    const incompleteIndex = normalizedItems.findIndex(
      item =>
        !item.material_id ||
        !Number.isFinite(item.quantity) ||
        item.quantity <= 0 ||
        !Number.isFinite(item.unit_cost) ||
        item.unit_cost < 0
    )

    if (incompleteIndex !== -1) {
      const item = normalizedItems[incompleteIndex]
      const field = !item.material_id
        ? 'material'
        : !Number.isFinite(item.quantity) || item.quantity <= 0
          ? 'quantity'
          : 'unit-cost'
      return {
        errors: [
          {
            id: RECEIPT_FIELD_IDS.line(incompleteIndex, field),
            label: `Line ${incompleteIndex + 1}`,
            message:
              'Complete every purchase line with a material, quantity, and unit cost.'
          }
        ]
      }
    }

    if (duplicate) {
      return {
        errors: [
          {
            id: RECEIPT_FIELD_IDS.line(duplicate.index, 'lot-code'),
            label: `Line ${duplicate.index + 1}`,
            message: `Lot code "${duplicate.lotCode}" is repeated in this receipt. Use unique lot codes or leave them blank to auto-generate.`
          }
        ]
      }
    }

    return {
      payload: {
        supplierId: state.supplierId,
        purchasedAt: toIsoTimestamp(state.purchasedOn),
        purchaseReference: state.purchaseReference,
        notes: state.notes,
        items: normalizedItems
      }
    }
  }

  return { state, total, addLine, removeLine, reset, deserialize, build }
}
