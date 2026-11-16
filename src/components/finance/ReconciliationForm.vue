<template>
  <section class="finance-form" :aria-labelledby="headingId">
    <div class="finance-form__intro">
      <h2 :id="headingId" class="section-title finance-form__title">
        Reconcile retailer stock
      </h2>
      <p class="finance-form__lead">
        Count sold, returned, damaged, expired and remaining jars against each
        open retailer line.
      </p>
    </div>

    <SaveConfirmation
      v-if="confirmation"
      :title="confirmation.title"
      :details="confirmation.details"
      @dismiss="confirmation = null"
    >
      <q-btn
        v-if="canRecordRemittance"
        unelevated
        no-caps
        color="primary"
        icon="payments"
        label="Record payment for this reconciliation"
        @click="recordPayment"
      />
      <q-btn
        outline
        no-caps
        color="primary"
        icon="add"
        label="Start another reconciliation"
        @click="startAnother"
      />
      <q-btn
        flat
        no-caps
        color="primary"
        icon="history"
        label="View records"
        @click="emit('navigate', { view: 'records' })"
      />
    </SaveConfirmation>

    <p v-if="writeMessage" class="finance-form__notice" role="note">
      {{ writeMessage }}
    </p>

    <p v-if="restored" class="finance-form__draft" role="status">
      <q-icon name="restore" size="20px" aria-hidden="true" />
      <span>Draft restored{{ savedAtText }}.</span>
      <q-btn
        flat
        dense
        no-caps
        color="primary"
        label="Discard draft"
        @click="discardDraft"
      />
    </p>

    <q-form
      ref="formRef"
      class="finance-form__form"
      @submit="submit"
      @validation-error="reportFieldErrors"
    >
      <FormErrorSummary ref="summaryRef" :errors="errors" />

      <div class="finance-form__grid">
        <q-select
          v-model="form.retailerId"
          for="reconciliation-retailer"
          outlined
          :behavior="selectBehavior"
          lazy-rules
          :rules="[required]"
          emit-value
          map-options
          :disable="writesDisabled || retailerOptions.length === 0"
          :options="retailerOptions"
          label="Retail partner"
          @update:model-value="onRetailerChange"
        />
        <q-input
          v-model="form.reconciledOn"
          for="reconciliation-date"
          outlined
          type="date"
          lazy-rules
          :rules="[required]"
          :disable="writesDisabled"
          label="Reconciliation date"
        />
        <q-input
          v-model="form.reconciliationReference"
          for="reconciliation-reference"
          outlined
          :disable="writesDisabled"
          label="Reconciliation reference"
          hint="Optional visit, count, or van-sheet code"
        />
        <q-input
          v-model="form.notes"
          for="reconciliation-notes"
          outlined
          type="textarea"
          autogrow
          :disable="writesDisabled"
          label="Notes"
        />
      </div>

      <div class="finance-form__lines">
        <ReconciliationLineEditor
          v-for="(item, index) in form.items"
          :key="item.key"
          :line="item"
          :index="index"
          :open-line="resolveOpenLine(item.stockIssueItemId)"
          :price="priceForLine(item)"
          :options="openLineOptions"
          :disabled="writesDisabled"
          :removable="form.items.length > 1"
          :select-behavior="selectBehavior"
          @remove="removeLine(item.key)"
          @select="applyOpenIssueDefaults(item)"
        />
      </div>

      <div class="finance-form__add">
        <q-btn
          outline
          no-caps
          color="primary"
          icon="add"
          type="button"
          label="Add line"
          :disable="writesDisabled"
          @click="addLine"
        />
      </div>

      <FormActionBar
        submit-label="Record reconciliation"
        action="reconciliations"
        :loading="isSubmitting"
        :disabled="writesDisabled"
        @saved="onRetrySaved"
      >
        <template #summary>
          <span class="status-chip status-chip--info"
            >Sales value {{ formatMoney(estimatedSalesValue) }}</span
          >
          <span class="status-chip status-chip--neutral"
            >COGS {{ formatMoney(estimatedCogsValue) }}</span
          >
          <span
            class="status-chip"
            :class="
              totalUnaccounted === 0
                ? 'status-chip--success'
                : 'status-chip--warning'
            "
            data-total-unaccounted
            >{{ unaccountedSummary }}</span
          >
        </template>
      </FormActionBar>
    </q-form>
  </section>
</template>

<script setup>
import { computed, nextTick, reactive, ref, useId, watch } from 'vue'
import { useQuasar } from 'quasar'
import FormActionBar from '@/components/FormActionBar.vue'
import FormErrorSummary from '@/components/FormErrorSummary.vue'
import ReconciliationLineEditor from '@/components/finance/ReconciliationLineEditor.vue'
import SaveConfirmation from '@/components/SaveConfirmation.vue'
import { useFormDraft } from '@/composables/useFormDraft'
import { collectFieldErrors, useFormErrors } from '@/composables/useFormErrors'
import { isWriteLocked } from '@/services/writes'
import { required } from '@/lib/validation'
import {
  asNumber,
  formatMoney,
  formatQuantity,
  getTodayString
} from '@/lib/format'
import {
  formatFinanceError,
  recordRetailReconciliation
} from '@/services/finance'
import {
  buildReconciliationPayload,
  clearLineCounts,
  createLineKey,
  createReconciliationLine,
  lineAccounting,
  openLineOptionLabel,
  priceForOpenLine,
  retailerOptionLabel,
  validateReconciliation
} from '@/components/finance/financeDomain'

const props = defineProps({
  /** Finance summary workspace (retailers, openIssueLines, pricing). */
  data: { type: Object, required: true },
  /** useWorkspace mode. */
  mode: { type: String, required: true },
  canWrite: { type: Boolean, default: false },
  canRecordRemittance: { type: Boolean, default: false },
  /** Awaited after a confirmed save: refresh summary and history. */
  afterSave: { type: Function, default: async () => {} }
})
const emit = defineEmits(['dirty', 'navigate'])

const $q = useQuasar()
const headingId = useId()
const formRef = ref(null)
const isSubmitting = ref(false)
const confirmation = ref(null)
const { errors, summaryRef, fail, clear } = useFormErrors()

const form = reactive({
  retailerId: null,
  reconciledOn: getTodayString(),
  reconciliationReference: '',
  notes: '',
  items: [createReconciliationLine()]
})

const { isDirty, restored, savedAt, clearDraft } = useFormDraft(
  'finance:reconciliation',
  form,
  {
    // Line keys come from a module counter; regenerate them so a restored
    // draft never collides with lines created in this session.
    deserialize: saved => ({
      ...saved,
      items: (saved.items?.length ? saved.items : [{}]).map(item => ({
        ...createReconciliationLine(),
        ...item,
        key: createLineKey('reconciliation')
      }))
    })
  }
)

const selectBehavior = computed(() => ($q.screen.lt.sm ? 'dialog' : 'menu'))
const isLive = computed(() => ['live', 'refreshing'].includes(props.mode))
const retailers = computed(() => props.data.retailers ?? [])
const openIssueLines = computed(() => props.data.openIssueLines ?? [])

const retailerOptions = computed(() =>
  retailers.value.map(retailer => ({
    label: retailerOptionLabel(retailer),
    value: retailer.id
  }))
)
const openLineOptions = computed(() =>
  openIssueLines.value
    .filter(line => !form.retailerId || line.retailer_id === form.retailerId)
    .map(line => ({
      label: openLineOptionLabel(line),
      value: line.stock_issue_item_id
    }))
)

function resolveOpenLine(stockIssueItemId) {
  return (
    openIssueLines.value.find(
      line => line.stock_issue_item_id === stockIssueItemId
    ) ?? null
  )
}
function priceForLine(item) {
  return priceForOpenLine(
    props.data.pricing,
    resolveOpenLine(item.stockIssueItemId),
    form.reconciledOn
  )
}

const writesDisabled = computed(
  () =>
    !isLive.value ||
    isSubmitting.value ||
    isWriteLocked('reconciliations') ||
    !props.canWrite ||
    retailers.value.length === 0 ||
    openIssueLines.value.length === 0
)

const writeMessage = computed(() => {
  // While the first load is pending, WorkspaceState shows loading instead.
  if (props.mode === 'loading') return ''
  if (!isLive.value)
    return 'Live entry is unavailable. Refresh the workspace to reconnect.'
  if (!props.canWrite)
    return 'Your role can review the finance picture, but only admin, operations, and finance roles can record reconciliations.'
  if (retailers.value.length === 0)
    return 'Add or seed at least one retailer before posting a reconciliation.'
  if (openIssueLines.value.length === 0)
    return 'Open retailer stock lines appear here after warehouse issues are posted and still need reconciliation.'
  return ''
})

const estimatedSalesValue = computed(() =>
  form.items.reduce(
    (total, item) =>
      total +
      Math.max(0, Math.trunc(asNumber(item.quantitySold))) *
        Math.max(0, asNumber(priceForLine(item))),
    0
  )
)
const estimatedCogsValue = computed(() =>
  form.items.reduce((total, item) => {
    const openLine = resolveOpenLine(item.stockIssueItemId)
    if (!openLine) return total
    return (
      total +
      Math.max(0, Math.trunc(asNumber(item.quantitySold))) *
        Math.max(0, asNumber(openLine.unit_cost))
    )
  }, 0)
)
const lineStates = computed(() =>
  form.items.map(item =>
    lineAccounting(item, resolveOpenLine(item.stockIssueItemId))
  )
)
const totalUnaccounted = computed(() =>
  lineStates.value.reduce(
    (total, state) => total + Math.abs(state.unaccounted ?? 0),
    0
  )
)
const unaccountedSummary = computed(() => {
  const counted = lineStates.value.filter(state => state.opening !== null)
  if (!counted.length) return 'No lines counted yet'
  const open = lineStates.value.filter(state => state.state !== 'balanced')
  if (!open.length) return 'All lines balanced'
  return `${open.length} of ${lineStates.value.length} ${lineStates.value.length === 1 ? 'line' : 'lines'} not balanced`
})
const savedAtText = computed(() =>
  savedAt.value
    ? ` from ${new Date(savedAt.value).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`
    : ''
)

function onRetailerChange(retailerId) {
  for (const item of form.items) {
    const openLine = resolveOpenLine(item.stockIssueItemId)
    if (item.stockIssueItemId && openLine?.retailer_id !== retailerId) {
      item.stockIssueItemId = null
      clearLineCounts(item)
    }
  }
}

function applyOpenIssueDefaults(line) {
  const openLine = resolveOpenLine(line.stockIssueItemId)
  clearLineCounts(line)
  if (openLine) line.quantityRemaining = `${asNumber(openLine.quantity_open)}`
}

function addLine() {
  form.items.push(createReconciliationLine())
}

function removeLine(lineKey) {
  if (form.items.length === 1) return
  form.items.splice(
    0,
    form.items.length,
    ...form.items.filter(item => item.key !== lineKey)
  )
}

function resetForm() {
  form.retailerId = null
  form.reconciledOn = getTodayString()
  form.reconciliationReference = ''
  form.notes = ''
  form.items.splice(0, form.items.length, createReconciliationLine())
  formRef.value?.resetValidation()
  clear()
}

function discardDraft() {
  resetForm()
  clearDraft()
}

async function reportFieldErrors() {
  await nextTick()
  await fail(collectFieldErrors(formRef.value))
}

function summarize(id) {
  const retailer = retailers.value.find(item => item.id === form.retailerId)
  const sold = form.items.reduce(
    (total, item) =>
      total + Math.max(0, Math.trunc(asNumber(item.quantitySold))),
    0
  )
  return {
    id: id ?? null,
    retailerId: form.retailerId,
    title: `Reconciliation recorded for ${retailer?.retailer_name ?? 'the retailer'}`,
    details: [
      `${form.items.length} ${form.items.length === 1 ? 'line' : 'lines'} settled; ${formatQuantity(sold)} jars sold.`,
      `Sales value ${formatMoney(estimatedSalesValue.value)} is now due from the retailer.`,
      ...(form.reconciliationReference.trim()
        ? [`Reference ${form.reconciliationReference.trim()}.`]
        : [])
    ]
  }
}

async function completeSave(result, { retry = false } = {}) {
  // A confirmed retry posted the saved body, which may differ from what the
  // form shows now, so describe it generically.
  const outcome = retry
    ? {
        id: result?.id ?? null,
        retailerId: null,
        title: 'Saved reconciliation confirmed',
        details: ['Retailer stock balances have been refreshed.']
      }
    : summarize(result?.id)
  resetForm()
  clearDraft()
  await props.afterSave()
  confirmation.value = outcome
}

async function submit() {
  if (writesDisabled.value) return
  const problems = validateReconciliation(form, resolveOpenLine)
  if (problems.length) {
    await fail(problems)
    return
  }
  clear()
  confirmation.value = null
  isSubmitting.value = true
  try {
    const result = await recordRetailReconciliation(
      buildReconciliationPayload(form)
    )
    await completeSave(result)
  } catch (error) {
    $q.notify({
      type: 'negative',
      message: formatFinanceError(
        error,
        'Unable to record the reconciliation right now.'
      )
    })
  } finally {
    isSubmitting.value = false
  }
}

// WriteStatus confirmed a network-uncertain submission on retry.
async function onRetrySaved(result) {
  await completeSave(result, { retry: true })
}

function recordPayment() {
  const outcome = confirmation.value
  const option = (props.data.reconciliationOptions ?? []).find(
    reconciliation => reconciliation.id === outcome?.id
  )
  emit('navigate', {
    view: 'remittance',
    prefill: {
      retailerId:
        outcome?.retailerId ??
        option?.retailer_id ??
        option?.retailer?.id ??
        null,
      reconciliationId: outcome?.id ?? null
    }
  })
}

async function startAnother() {
  confirmation.value = null
  await nextTick()
  document.getElementById('reconciliation-retailer')?.focus()
}

watch(isDirty, dirty => emit('dirty', dirty), { immediate: true })
</script>

<style scoped src="./financeForm.css"></style>
