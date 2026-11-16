<template>
  <section class="finance-form" :aria-labelledby="headingId">
    <div class="finance-form__intro">
      <h2 :id="headingId" class="section-title finance-form__title">
        Record a retailer payment
      </h2>
      <p class="finance-form__lead">
        Post receipts separately from stock recognition so collections stay
        auditable.
      </p>
    </div>

    <SaveConfirmation
      v-if="confirmation"
      :title="confirmation.title"
      :details="confirmation.details"
      @dismiss="confirmation = null"
    >
      <q-btn
        unelevated
        no-caps
        color="primary"
        icon="add"
        label="Record another payment"
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
      <span>Draft restored.</span>
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
          for="remittance-retailer"
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
        <q-select
          v-model="form.reconciliationId"
          for="remittance-reconciliation"
          outlined
          clearable
          :behavior="selectBehavior"
          emit-value
          map-options
          :disable="writesDisabled"
          :options="reconciliationSelectOptions"
          label="Linked reconciliation"
          hint="Optional, for partial or period-specific settlement"
        />
        <q-input
          v-model="form.receivedOn"
          for="remittance-date"
          outlined
          type="date"
          lazy-rules
          :rules="[required]"
          :disable="writesDisabled"
          label="Received date"
        />
        <q-input
          v-model="form.amount"
          for="remittance-amount"
          outlined
          type="number"
          inputmode="decimal"
          lazy-rules
          :rules="[positive]"
          min="0"
          step="100"
          :disable="writesDisabled"
          label="Amount remitted"
        />
        <q-input
          v-model="form.remittanceReference"
          for="remittance-reference"
          outlined
          :disable="writesDisabled"
          label="Payment reference"
          hint="Optional transfer or receipt code"
        />
        <q-input
          v-model="form.notes"
          for="remittance-notes"
          outlined
          type="textarea"
          autogrow
          :disable="writesDisabled"
          label="Notes"
        />
      </div>

      <p class="finance-form__caption">
        Remittances stay separate from stock recognition so partial collections
        remain auditable.
      </p>

      <FormActionBar
        submit-label="Record remittance"
        action="remittances"
        :loading="isSubmitting"
        :disabled="writesDisabled"
        @saved="onRetrySaved"
      >
        <template #summary>
          <span class="status-chip status-chip--warning"
            >Current outstanding:
            {{ formatMoney(selectedRetailerOutstandingAmount) }}</span
          >
        </template>
      </FormActionBar>
    </q-form>
  </section>
</template>

<script setup>
import { computed, nextTick, onMounted, reactive, ref, useId, watch } from 'vue'
import { useQuasar } from 'quasar'
import FormActionBar from '@/components/FormActionBar.vue'
import FormErrorSummary from '@/components/FormErrorSummary.vue'
import SaveConfirmation from '@/components/SaveConfirmation.vue'
import { useFormDraft } from '@/composables/useFormDraft'
import { collectFieldErrors, useFormErrors } from '@/composables/useFormErrors'
import { isWriteLocked } from '@/services/writes'
import { required, positive } from '@/lib/validation'
import { formatDate, formatMoney, getTodayString } from '@/lib/format'
import { formatFinanceError, recordRetailRemittance } from '@/services/finance'
import {
  buildRemittancePayload,
  reconciliationLabel,
  retailerOptionLabel,
  validateRemittance
} from '@/components/finance/financeDomain'

const props = defineProps({
  /** Finance summary workspace (retailers, reconciliationOptions, balances). */
  data: { type: Object, required: true },
  mode: { type: String, required: true },
  canWrite: { type: Boolean, default: false },
  /** `{ retailerId, reconciliationId, token }` from a reconciliation success. */
  prefill: { type: Object, default: null },
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
  reconciliationId: null,
  receivedOn: getTodayString(),
  amount: '',
  remittanceReference: '',
  notes: ''
})
const { isDirty, restored, clearDraft } = useFormDraft(
  'finance:remittance',
  form
)
watch(isDirty, dirty => emit('dirty', dirty), { immediate: true })

const selectBehavior = computed(() => ($q.screen.lt.sm ? 'dialog' : 'menu'))
const isLive = computed(() => ['live', 'refreshing'].includes(props.mode))
const retailers = computed(() => props.data.retailers ?? [])
// Summary view: every reconciliation without line items (history-api.md §3).
const reconciliationOptions = computed(
  () => props.data.reconciliationOptions ?? []
)
const reconciliationRetailerId = reconciliation =>
  reconciliation.retailer_id ?? reconciliation.retailer?.id

const retailerOptions = computed(() =>
  retailers.value.map(retailer => ({
    label: retailerOptionLabel(retailer),
    value: retailer.id
  }))
)
const reconciliationSelectOptions = computed(() =>
  reconciliationOptions.value
    .filter(
      reconciliation =>
        !form.retailerId ||
        reconciliationRetailerId(reconciliation) === form.retailerId
    )
    .map(reconciliation => ({
      label: `${reconciliationLabel(reconciliation)} / ${formatDate(reconciliation.reconciled_at)} / ${formatMoney(reconciliation.total_sales_value)}`,
      value: reconciliation.id
    }))
)
const selectedRetailerOutstandingAmount = computed(() => {
  const balance = (props.data.retailerBalances ?? []).find(
    item => item.retailer_id === form.retailerId
  )
  return balance?.outstanding_amount ?? 0
})

const writesDisabled = computed(
  () =>
    !isLive.value ||
    isSubmitting.value ||
    isWriteLocked('remittances') ||
    !props.canWrite ||
    retailers.value.length === 0
)
const writeMessage = computed(() => {
  if (props.mode === 'loading') return ''
  if (!isLive.value)
    return 'Live entry is unavailable. Refresh the workspace to reconnect.'
  if (!props.canWrite)
    return 'Your role can review remittances, but only admin, operations, and finance roles can record them.'
  if (retailers.value.length === 0)
    return 'Add or seed at least one retailer before recording a remittance.'
  return ''
})

// A linked reconciliation must belong to the selected retailer.
function onRetailerChange(retailerId) {
  const selected = reconciliationOptions.value.find(
    reconciliation => reconciliation.id === form.reconciliationId
  )
  if (selected && reconciliationRetailerId(selected) !== retailerId)
    form.reconciliationId = null
}

// "Record payment for this reconciliation" from a reconciliation success.
// Applied after the draft restore (registered later, so it runs later).
let appliedPrefill = null
function applyPrefill() {
  const prefill = props.prefill
  if (!prefill?.token || prefill.token === appliedPrefill) return
  appliedPrefill = prefill.token
  confirmation.value = null
  form.retailerId = prefill.retailerId ?? null
  const linked = reconciliationOptions.value.some(
    reconciliation => reconciliation.id === prefill.reconciliationId
  )
  form.reconciliationId = linked ? prefill.reconciliationId : null
}
onMounted(applyPrefill)
watch(() => props.prefill?.token, applyPrefill)

function resetForm() {
  form.retailerId = null
  form.reconciliationId = null
  form.receivedOn = getTodayString()
  form.amount = ''
  form.remittanceReference = ''
  form.notes = ''
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

function summarize() {
  const retailer = retailers.value.find(item => item.id === form.retailerId)
  const linked = reconciliationOptions.value.find(
    reconciliation => reconciliation.id === form.reconciliationId
  )
  return {
    title: `Payment of ${formatMoney(form.amount)} recorded for ${retailer?.retailer_name ?? 'the retailer'}`,
    details: [
      linked
        ? `Linked to ${reconciliationLabel(linked)}.`
        : 'Not linked to a specific reconciliation.',
      'The retailer balance has been refreshed.'
    ]
  }
}

async function completeSave({ retry = false } = {}) {
  // A confirmed retry posted the saved body, which may differ from what the
  // form shows now, so describe it generically.
  const outcome = retry
    ? {
        title: 'Saved remittance confirmed',
        details: ['The retailer balance has been refreshed.']
      }
    : summarize()
  resetForm()
  clearDraft()
  await props.afterSave()
  confirmation.value = outcome
}

async function submit() {
  if (writesDisabled.value) return
  const problems = validateRemittance(form)
  if (problems.length) {
    await fail(problems)
    return
  }
  clear()
  confirmation.value = null
  isSubmitting.value = true
  try {
    await recordRetailRemittance(buildRemittancePayload(form))
    await completeSave()
  } catch (error) {
    $q.notify({
      type: 'negative',
      message: formatFinanceError(
        error,
        'Unable to record the remittance right now.'
      )
    })
  } finally {
    isSubmitting.value = false
  }
}

async function onRetrySaved() {
  await completeSave({ retry: true })
}

async function startAnother() {
  confirmation.value = null
  await nextTick()
  document.getElementById('remittance-retailer')?.focus()
}
</script>

<style scoped src="./financeForm.css"></style>
