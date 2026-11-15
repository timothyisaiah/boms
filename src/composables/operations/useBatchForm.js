import { computed, reactive, ref, unref, watch } from 'vue'
import { recipeQuantity } from '@/lib/recipes'
import {
  asNumber,
  formatQuantity,
  getTodayString,
  toIsoTimestamp
} from '@/lib/format'
import { createLineKey, resetArray } from './lineKeys'

export const BATCH_FIELD_IDS = Object.freeze({
  variant: 'batch-variant',
  date: 'batch-date',
  code: 'batch-code',
  output: 'batch-output',
  input: (index, field) => `batch-input-${index}-${field}`
})

function formatBatchDateStamp(dateValue = getTodayString()) {
  return dateValue.replaceAll('-', '')
}

export function createBatchCode(dateValue = getTodayString()) {
  return `PB-${formatBatchDateStamp(dateValue)}-001`
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function getBatchDateString(value) {
  if (!value) {
    return ''
  }

  const parsedDate = new Date(value)

  if (Number.isNaN(parsedDate.getTime())) {
    return ''
  }

  return parsedDate.toISOString().slice(0, 10)
}

/**
 * Next free `PB-YYYYMMDD-NNN` code for `dateValue`, from the batches known
 * to have started on that (UTC) date.
 */
export function suggestNextBatchCode(dateValue, batches = []) {
  const normalizedDateValue = dateValue || getTodayString()
  const batchDateStamp = formatBatchDateStamp(normalizedDateValue)
  const batchCodePattern = new RegExp(
    `^PB-${escapeRegExp(batchDateStamp)}-(\\d{3,})$`
  )

  const nextSequenceNumber =
    (batches ?? []).reduce((highestSequenceNumber, batch) => {
      const batchCode = batch?.batch_code?.trim()

      if (
        !batchCode ||
        getBatchDateString(batch.started_at) !== normalizedDateValue
      ) {
        return highestSequenceNumber
      }

      const codeMatch = batchCode.match(batchCodePattern)

      if (!codeMatch) {
        return highestSequenceNumber
      }

      const parsedSequenceNumber = Number(codeMatch[1])

      if (!Number.isFinite(parsedSequenceNumber)) {
        return highestSequenceNumber
      }

      return Math.max(highestSequenceNumber, parsedSequenceNumber)
    }, 0) + 1

  return `PB-${batchDateStamp}-${String(nextSequenceNumber).padStart(3, '0')}`
}

function createBatchInput() {
  return {
    key: createLineKey('batch'),
    inventoryLotId: null,
    quantity: ''
  }
}

/**
 * Production batch form: state, recipe prefill, FIFO/lot options, cost
 * estimates, batch-code suggestion and the exact `writeAction('production')`
 * payload.
 *
 * @param {import('vue').Ref<object>} workspace operations summary
 * @param {object} options
 * @param {(date: string, ctx: { signal: AbortSignal }) => Promise<object[]>} options.loadDayBatches
 *   batches started on a date (history API, UTC window)
 * @param {(code: string) => Promise<object[]>} options.findBatchesByCode
 *   existing batches with exactly this code
 */
export function useBatchForm(workspace, { loadDayBatches, findBatchesByCode }) {
  const state = reactive({
    variantId: null,
    startedOn: getTodayString(),
    batchCode: createBatchCode(),
    outputQuantity: '',
    notes: '',
    expiresAt: '',
    inputs: [createBatchInput()]
  })
  const lastSuggestedBatchCode = ref(createBatchCode())
  // Batches known to exist per start date (from the history API).
  const knownBatches = ref({ date: '', rows: [] })
  let dayController = null

  const ws = () => unref(workspace) ?? {}

  const openInventoryLots = computed(() =>
    (ws().inventoryLots ?? []).filter(
      lot => asNumber(lot.quantity_remaining) > 0
    )
  )

  const variantOptions = computed(() =>
    (ws().variants ?? []).map(variant => ({
      label: `${variant.sku} / ${variant.variant_name}`,
      value: variant.id
    }))
  )

  const inventoryLotOptions = computed(() => [
    ...(ws().materials ?? []).map(material => ({
      label: `${material.name} / oldest available lots (FIFO)`,
      value: `fifo:${material.id}`
    })),
    ...openInventoryLots.value.map(lot => ({
      label: `${lot.lot_code} / ${lot.material?.name ?? 'Material'} / ${formatQuantity(
        lot.quantity_remaining,
        3
      )} ${lot.material?.unit_of_measure ?? 'units'} left`,
      value: lot.id
    }))
  ])

  function resolveInventoryLot(lotId) {
    return (
      openInventoryLots.value.find(lot =>
        String(lotId).startsWith('fifo:')
          ? String(lot.material?.id) === String(lotId).slice(5)
          : lot.id === lotId
      ) ?? null
    )
  }

  const estimatedInputCost = computed(() =>
    state.inputs.reduce((total, input) => {
      const lot = resolveInventoryLot(input.inventoryLotId)

      if (!lot) {
        return total
      }

      return total + asNumber(input.quantity) * asNumber(lot.unit_cost)
    }, 0)
  )

  const estimatedUnitCost = computed(() => {
    const outputQuantity = asNumber(state.outputQuantity)

    if (outputQuantity <= 0) {
      return 0
    }

    return estimatedInputCost.value / outputQuantity
  })

  // --- Batch code suggestion -------------------------------------------

  function syncSuggestedBatchCode({ force = false } = {}) {
    const dateValue = state.startedOn || getTodayString()
    const rows =
      knownBatches.value.date === dateValue ? knownBatches.value.rows : []
    const nextSuggestedBatchCode = suggestNextBatchCode(state.startedOn, rows)

    if (
      force ||
      !state.batchCode?.trim() ||
      state.batchCode === lastSuggestedBatchCode.value
    ) {
      state.batchCode = nextSuggestedBatchCode
    }

    lastSuggestedBatchCode.value = nextSuggestedBatchCode
  }

  /**
   * Fetch the batches started on the selected date and update the
   * suggestion. A failed fetch keeps the current suggestion; the duplicate
   * check and the server's unique constraint still protect the save.
   */
  async function refreshSuggestion() {
    const dateValue = state.startedOn || getTodayString()
    dayController?.abort()
    const controller = new AbortController()
    dayController = controller
    try {
      const rows = await loadDayBatches(dateValue, {
        signal: controller.signal
      })
      if (dayController !== controller) return
      knownBatches.value = { date: dateValue, rows }
      syncSuggestedBatchCode()
    } catch {
      /* Keep the previous suggestion. */
    } finally {
      if (dayController === controller) dayController = null
    }
  }

  watch(
    () => state.startedOn,
    () => {
      syncSuggestedBatchCode()
      void refreshSuggestion()
    }
  )

  // --- Lines and recipe ----------------------------------------------------

  function addInput() {
    state.inputs.push(createBatchInput())
  }

  function removeInput(lineKey) {
    if (state.inputs.length === 1) {
      return
    }

    resetArray(
      state.inputs,
      state.inputs.filter(item => item.key !== lineKey)
    )
  }

  const matchingRecipe = computed(() =>
    (ws().recipes ?? []).find(recipe => recipe.variant_id === state.variantId)
  )
  let lastRecipeDefaults = ''

  function applyRecipe() {
    if (!matchingRecipe.value || !Number(state.outputQuantity)) return
    resetArray(
      state.inputs,
      matchingRecipe.value.items.map(item => ({
        key: createLineKey('batch'),
        inventoryLotId: 'fifo:' + item.material_id,
        quantity: recipeQuantity(item.quantity_per_unit, state.outputQuantity)
      }))
    )
    lastRecipeDefaults = JSON.stringify(state.inputs)
  }

  watch(
    () => [state.variantId, state.outputQuantity],
    () => {
      if (
        state.inputs.every(input => input.quantity === '') ||
        JSON.stringify(state.inputs) === lastRecipeDefaults
      )
        applyRecipe()
    }
  )

  /** Count a just-saved batch before the history refresh returns. */
  function rememberBatch({ batchCode, startedAt } = {}) {
    const date = getBatchDateString(startedAt)
    if (!batchCode || !date) return
    const rows = knownBatches.value.date === date ? knownBatches.value.rows : []
    knownBatches.value = {
      date,
      rows: [...rows, { batch_code: batchCode, started_at: startedAt }]
    }
  }

  function reset() {
    state.variantId = null
    state.startedOn = getTodayString()
    state.batchCode = createBatchCode(state.startedOn)
    state.outputQuantity = ''
    state.expiresAt = ''
    state.notes = ''
    resetArray(state.inputs, [createBatchInput()])
    syncSuggestedBatchCode({ force: true })
  }

  /** Restored drafts get fresh line keys so they never collide. */
  function deserialize(saved) {
    return {
      ...saved,
      inputs: (Array.isArray(saved?.inputs) ? saved.inputs : []).map(input => ({
        ...createBatchInput(),
        ...input,
        key: createLineKey('batch')
      }))
    }
  }

  // --- Submit checks -------------------------------------------------------

  /**
   * Business rules in their original order. The duplicate batch-code check
   * reads the history API (all batches, not only the summary). If that read
   * fails the save continues and the server's unique constraint decides.
   * Returns `{ errors }` for the summary or `{ payload }` for the write.
   */
  async function prepare() {
    const normalizedInputs = state.inputs.map(input => ({
      inventory_lot_id: String(input.inventoryLotId).startsWith('fifo:')
        ? null
        : input.inventoryLotId,
      material_id: String(input.inventoryLotId).startsWith('fifo:')
        ? Number(String(input.inventoryLotId).slice(5))
        : null,
      quantity:
        input.quantity === '' ? Number.NaN : asNumber(input.quantity, NaN)
    }))

    const outputQuantity =
      state.outputQuantity === ''
        ? Number.NaN
        : Math.trunc(asNumber(state.outputQuantity, NaN))

    if (!state.variantId) {
      return fail(
        BATCH_FIELD_IDS.variant,
        'Finished variant',
        'Select a finished variant before creating a production batch.'
      )
    }

    if (!state.batchCode?.trim()) {
      return fail(
        BATCH_FIELD_IDS.code,
        'Batch code',
        'Enter a batch code before saving the batch.'
      )
    }

    const code = state.batchCode.trim()
    let duplicates = []
    try {
      duplicates = await findBatchesByCode(code)
    } catch {
      duplicates = []
    }

    if (duplicates.length > 0) {
      await refreshSuggestion()
      syncSuggestedBatchCode()
      return fail(
        BATCH_FIELD_IDS.code,
        'Batch code',
        `Batch code "${code}" already exists. Try the next suggested code "${lastSuggestedBatchCode.value}".`
      )
    }

    if (!Number.isFinite(outputQuantity) || outputQuantity <= 0) {
      return fail(
        BATCH_FIELD_IDS.output,
        'Jars produced',
        'Enter a valid jar output quantity for the batch.'
      )
    }

    const invalidIndex = normalizedInputs.findIndex(
      input =>
        (!input.inventory_lot_id && !input.material_id) ||
        !Number.isFinite(input.quantity) ||
        input.quantity <= 0
    )

    if (invalidIndex !== -1) {
      const input = normalizedInputs[invalidIndex]
      return fail(
        BATCH_FIELD_IDS.input(
          invalidIndex,
          !input.inventory_lot_id && !input.material_id ? 'lot' : 'quantity'
        ),
        `Input ${invalidIndex + 1}`,
        'Every production input needs an open lot and a consumed quantity.'
      )
    }

    const requestedQuantityByLot = new Map()

    for (const input of normalizedInputs) {
      if (!input.inventory_lot_id) continue
      requestedQuantityByLot.set(
        input.inventory_lot_id,
        (requestedQuantityByLot.get(input.inventory_lot_id) ?? 0) +
          input.quantity
      )
    }

    for (const [inventoryLotId, requestedQuantity] of requestedQuantityByLot) {
      const selectedLot = resolveInventoryLot(inventoryLotId)
      const index = normalizedInputs.findIndex(
        input => input.inventory_lot_id === inventoryLotId
      )

      if (!selectedLot) {
        return fail(
          BATCH_FIELD_IDS.input(index, 'lot'),
          `Input ${index + 1}`,
          'One of the selected material lots is no longer open. Refresh the workspace and try again.'
        )
      }

      if (requestedQuantity > asNumber(selectedLot.quantity_remaining)) {
        return fail(
          BATCH_FIELD_IDS.input(index, 'quantity'),
          `Input ${index + 1}`,
          `Requested quantity exceeds what remains in lot ${selectedLot.lot_code}. Reduce the consumed quantity before saving the batch.`
        )
      }
    }

    return {
      payload: {
        variantId: state.variantId,
        batchCode: code,
        startedAt: toIsoTimestamp(state.startedOn),
        notes: state.notes,
        outputQuantity,
        expiresAt: state.expiresAt || null,
        inputs: normalizedInputs
      }
    }
  }

  function fail(id, label, message) {
    return { errors: [{ id, label, message }] }
  }

  return {
    state,
    lastSuggestedBatchCode,
    openInventoryLots,
    variantOptions,
    inventoryLotOptions,
    matchingRecipe,
    estimatedInputCost,
    estimatedUnitCost,
    resolveInventoryLot,
    addInput,
    removeInput,
    applyRecipe,
    rememberBatch,
    reset,
    deserialize,
    prepare,
    refreshSuggestion,
    syncSuggestedBatchCode
  }
}
