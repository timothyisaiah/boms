<template>
  <section class="stock-issue" :aria-labelledby="headingId">
    <h2 :id="headingId" class="section-title stock-issue__title">
      Issue stock to a retailer
    </h2>
    <p class="stock-issue__intro">
      Issued stock stays on consignment until it is reconciled.
    </p>

    <SaveConfirmation
      v-if="confirmation"
      class="stock-issue__confirmation"
      :title="confirmation.title"
      :details="confirmation.details"
      @dismiss="confirmation = null"
    >
      <q-btn
        unelevated
        no-caps
        color="primary"
        icon="add"
        label="Issue more stock"
        @click="startAnother"
      />
      <q-btn
        flat
        no-caps
        color="primary"
        icon="local_shipping"
        label="View dispatches"
        @click="viewDispatches"
      />
    </SaveConfirmation>

    <p v-if="issueWriteMessage" class="stock-issue__notice" role="status">
      <q-icon name="info" size="16px" aria-hidden="true" />
      <span>{{ issueWriteMessage }}</span>
    </p>

    <div v-if="restored" class="stock-issue__draft" role="status">
      <q-icon name="history" size="20px" aria-hidden="true" />
      <span class="stock-issue__draft-text"
        >Draft restored from this device.</span
      >
      <q-btn
        flat
        dense
        no-caps
        color="primary"
        type="button"
        label="Discard draft"
        :disable="isSubmittingIssue"
        @click="discardDraft"
      />
    </div>

    <q-form
      ref="formRef"
      class="stock-issue__form"
      greedy
      no-error-focus
      @submit="submitStockIssue"
      @validation-error="onValidationError"
    >
      <FormErrorSummary ref="summaryRef" :errors="errors" />

      <div class="inline-form-grid">
        <q-select
          v-model="issueForm.retailerId"
          for="stock-issue-retailer"
          outlined
          :behavior="selectBehavior"
          lazy-rules
          :rules="[required]"
          emit-value
          map-options
          :disable="issueWritesDisabled || retailerOptions.length === 0"
          :options="retailerOptions"
          label="Retail partner"
        />

        <q-input
          v-model="issueForm.issuedOn"
          for="stock-issue-date"
          outlined
          type="date"
          lazy-rules
          :rules="[required]"
          :disable="issueWritesDisabled"
          label="Issue date"
        />

        <q-input
          v-model="issueForm.issueReference"
          for="stock-issue-reference"
          outlined
          :disable="issueWritesDisabled"
          label="Dispatch reference"
          hint="Optional delivery note or van sheet"
        />

        <q-input
          v-model="issueForm.notes"
          for="stock-issue-notes"
          outlined
          type="textarea"
          autogrow
          :disable="issueWritesDisabled"
          label="Notes"
        />
      </div>

      <h3 class="stock-issue__subheading">Issued lines</h3>

      <ol class="line-item-stack stock-issue__lines">
        <li
          v-for="(item, index) in issueForm.items"
          :key="item.key"
          class="line-item-card"
        >
          <div class="stock-issue__line-header">
            <strong>Line {{ index + 1 }}</strong>
            <q-btn
              v-if="issueForm.items.length > 1"
              flat
              round
              dense
              type="button"
              color="negative"
              icon="delete"
              :aria-label="`Remove line ${index + 1}`"
              :disable="issueWritesDisabled"
              @click="removeIssueLine(item.key)"
            />
          </div>

          <div class="line-item-grid line-item-grid--two q-mt-md">
            <q-select
              v-model="item.productionOutputId"
              :for="lineFieldId(index, 'batch')"
              outlined
              :behavior="selectBehavior"
              lazy-rules
              :rules="[required]"
              emit-value
              map-options
              :disable="
                issueWritesDisabled || finishedStockOptions.length === 0
              "
              :options="finishedStockOptions"
              label="Finished batch"
            />

            <q-input
              v-model="item.quantity"
              :for="lineFieldId(index, 'quantity')"
              outlined
              type="number"
              inputmode="numeric"
              lazy-rules
              :rules="[positive, whole]"
              min="1"
              step="1"
              :disable="issueWritesDisabled"
              label="Jars issued"
            />
          </div>

          <p
            v-if="resolveFinishedStock(item.productionOutputId)"
            class="stock-issue__availability"
          >
            {{
              availabilityText(resolveFinishedStock(item.productionOutputId))
            }}
          </p>
        </li>
      </ol>

      <FormActionBar
        submit-label="Issue stock"
        submit-icon="local_shipping"
        action="stock-issues"
        :loading="isSubmittingIssue"
        :disabled="issueWritesDisabled"
        @saved="onRetrySaved"
      >
        <q-btn
          flat
          color="primary"
          no-caps
          icon="add"
          type="button"
          label="Add line"
          :disable="issueWritesDisabled"
          @click="addIssueLine"
        />
        <template #summary>
          <span class="status-chip status-chip--neutral">
            Estimated issue: {{ formatQuantity(estimatedIssueQuantity) }} jars
          </span>
          <span class="status-chip status-chip--info">
            Estimated stock value: {{ formatMoney(estimatedIssueCost) }}
          </span>
        </template>
      </FormActionBar>
    </q-form>

    <DirtyGuardDialog :when="isDirty" />
  </section>
</template>

<script setup>
import { computed, nextTick, reactive, ref, useId } from 'vue'
import { useQuasar } from 'quasar'
import DirtyGuardDialog from '@/components/DirtyGuardDialog.vue'
import FormActionBar from '@/components/FormActionBar.vue'
import FormErrorSummary from '@/components/FormErrorSummary.vue'
import SaveConfirmation from '@/components/SaveConfirmation.vue'
import { useFormDraft } from '@/composables/useFormDraft'
import {
  collectFieldErrors,
  focusField,
  useFormErrors
} from '@/composables/useFormErrors'
import {
  asNumber,
  formatMoney,
  formatQuantity,
  getTodayString,
  toIsoTimestamp
} from '@/lib/format'
import { positive, required, whole } from '@/lib/validation'
import { formatRetailError, recordStockIssue } from '@/services/retail'
import { isWriteLocked } from '@/services/writes'

const props = defineProps({
  /** Active retailers from the workspace summary. */
  retailers: { type: Array, default: () => [] },
  /** Finished stock with quantity remaining > 0. */
  openFinishedStock: { type: Array, default: () => [] },
  /** useWorkspace mode; writes need a confirmed (live/refreshing) workspace. */
  workspaceMode: { type: String, required: true },
  /** can(role, 'write:stock-issues') */
  canIssue: { type: Boolean, default: false },
  /** Awaited after a successful save (workspace + history refresh). */
  afterSave: { type: Function, default: null }
})
const emit = defineEmits(['view-dispatches'])

const $q = useQuasar()
const headingId = useId()
const formRef = ref(null)

let lineKeySeed = 0

function createLineKey(prefix) {
  lineKeySeed += 1
  return `${prefix}-${lineKeySeed}`
}

function createIssueLine() {
  return {
    key: createLineKey('issue'),
    productionOutputId: null,
    quantity: ''
  }
}

function resetArray(target, nextItems) {
  target.splice(0, target.length, ...nextItems)
}

const issueForm = reactive({
  retailerId: null,
  issuedOn: getTodayString(),
  issueReference: '',
  notes: '',
  items: [createIssueLine()]
})

// Inputs only: writes.js keeps the idempotency key and retry body separately.
const { isDirty, restored, clearDraft } = useFormDraft(
  'retail:stock-issue',
  issueForm,
  {
    deserialize: saved => ({
      ...saved,
      items:
        Array.isArray(saved?.items) && saved.items.length > 0
          ? saved.items.map(item => ({
              productionOutputId: item?.productionOutputId ?? null,
              quantity: item?.quantity ?? '',
              key: createLineKey('issue')
            }))
          : [createIssueLine()]
    })
  }
)

const { errors, summaryRef, fail, clear } = useFormErrors()
const isSubmittingIssue = ref(false)
// `{ title, details }` shown above the form after a successful save.
const confirmation = ref(null)

// Phones keep the full-screen option list; tablets and desktops use the menu.
const selectBehavior = computed(() => ($q.screen.lt.sm ? 'dialog' : 'default'))

const workspaceReady = computed(
  () => props.workspaceMode === 'live' || props.workspaceMode === 'refreshing'
)

const retailerOptions = computed(() =>
  props.retailers.map(retailer => ({
    label: retailer.delivery_location
      ? `${retailer.retailer_name} / ${retailer.delivery_location}`
      : retailer.retailer_name,
    value: retailer.id
  }))
)

const finishedStockOptions = computed(() =>
  props.openFinishedStock.map(stock => ({
    label: `${stock.batch?.batch_code ?? `Batch ${stock.id}`} / ${stock.variant?.sku ?? 'Variant'} / ${formatQuantity(
      stock.quantity_remaining
    )} jars left`,
    value: stock.id
  }))
)

function resolveFinishedStock(productionOutputId) {
  return (
    props.openFinishedStock.find(stock => stock.id === productionOutputId) ??
    null
  )
}

function availabilityText(stock) {
  return `${stock.variant?.variant_name ?? 'Finished stock'} / ${
    stock.batch?.batch_code ?? 'Batch'
  } / ${formatQuantity(stock.quantity_remaining)} jars currently open at ${formatMoney(
    stock.unit_cost
  )}`
}

const estimatedIssueQuantity = computed(() =>
  issueForm.items.reduce(
    (total, item) => total + Math.max(0, Math.trunc(asNumber(item.quantity))),
    0
  )
)

const estimatedIssueCost = computed(() =>
  issueForm.items.reduce((total, item) => {
    const stock = resolveFinishedStock(item.productionOutputId)

    if (!stock) {
      return total
    }

    return (
      total + Math.trunc(asNumber(item.quantity)) * asNumber(stock.unit_cost)
    )
  }, 0)
)

const issueWritesDisabled = computed(
  () =>
    !workspaceReady.value ||
    isSubmittingIssue.value ||
    isWriteLocked('stock-issues') ||
    !props.canIssue ||
    props.retailers.length === 0 ||
    props.openFinishedStock.length === 0
)

const issueWriteMessage = computed(() => {
  // The page's WorkspaceState already reports loading.
  if (props.workspaceMode === 'loading') {
    return ''
  }

  if (!workspaceReady.value) {
    return 'Live entry is unavailable. Refresh the workspace to reconnect.'
  }

  if (!props.canIssue) {
    return 'Your role can review warehouse and retailer stock, but only warehouse and distribution roles can issue stock.'
  }

  if (props.retailers.length === 0) {
    return 'Add or seed at least one retailer before issuing stock.'
  }

  if (props.openFinishedStock.length === 0) {
    return 'Finished stock becomes issuable after production batches create open output quantities.'
  }

  return ''
})

function lineFieldId(index, field) {
  return `stock-issue-line-${index + 1}-${field}`
}

function addIssueLine() {
  issueForm.items.push(createIssueLine())
}

function removeIssueLine(lineKey) {
  if (issueForm.items.length === 1) {
    return
  }

  const nextItems = issueForm.items.filter(item => item.key !== lineKey)
  resetArray(issueForm.items, nextItems)
}

function resetIssueForm() {
  issueForm.retailerId = null
  issueForm.issuedOn = getTodayString()
  issueForm.issueReference = ''
  issueForm.notes = ''
  resetArray(issueForm.items, [createIssueLine()])
  formRef.value?.resetValidation()
  clear()
}

function discardDraft() {
  resetIssueForm()
  clearDraft()
}

async function onValidationError() {
  await nextTick()
  await fail(collectFieldErrors(formRef))
}

/** Confirmation text for an issue, built before the form is reset. */
function describeIssue() {
  const retailer = props.retailers.find(
    item => item.id === issueForm.retailerId
  )
  const details = []
  if (issueForm.issueReference.trim())
    details.push(`Dispatch reference ${issueForm.issueReference.trim()}.`)
  details.push('Retailer stock and the movement ledger have been refreshed.')
  return {
    title: `${formatQuantity(estimatedIssueQuantity.value)} jars issued to ${retailer?.retailer_name ?? 'the retailer'}`,
    details
  }
}

// A confirmed retry posted the saved body, which may differ from what the
// form shows now, so it is described generically.
async function onRetrySaved() {
  resetIssueForm()
  clearDraft()
  await props.afterSave?.()
  confirmation.value = {
    title: 'Saved stock issue confirmed',
    details: ['Retailer stock and the movement ledger have been refreshed.']
  }
}

async function startAnother() {
  confirmation.value = null
  await nextTick()
  focusField('stock-issue-retailer')
}

function viewDispatches() {
  confirmation.value = null
  emit('view-dispatches')
}

async function submitStockIssue() {
  if (issueWritesDisabled.value) {
    return
  }

  const normalizedItems = issueForm.items.map(item => ({
    production_output_id: item.productionOutputId,
    quantity:
      item.quantity === '' ? Number.NaN : Math.trunc(asNumber(item.quantity))
  }))

  if (!issueForm.retailerId) {
    await fail([
      {
        id: 'stock-issue-retailer',
        label: 'Retail partner',
        message: 'Select a retailer before issuing stock.'
      }
    ])
    return
  }

  const incompleteIndex = normalizedItems.findIndex(
    item =>
      !item.production_output_id ||
      !Number.isFinite(item.quantity) ||
      item.quantity <= 0
  )

  if (incompleteIndex !== -1) {
    const incomplete = normalizedItems[incompleteIndex]
    await fail([
      {
        id: lineFieldId(
          incompleteIndex,
          incomplete.production_output_id ? 'quantity' : 'batch'
        ),
        label: `Line ${incompleteIndex + 1}`,
        message:
          'Complete every issue line with an open finished batch and a jar quantity.'
      }
    ])
    return
  }

  const requestedQuantityByOutput = new Map()

  for (const item of normalizedItems) {
    requestedQuantityByOutput.set(
      item.production_output_id,
      (requestedQuantityByOutput.get(item.production_output_id) ?? 0) +
        item.quantity
    )
  }

  for (const [
    productionOutputId,
    requestedQuantity
  ] of requestedQuantityByOutput) {
    const stock = resolveFinishedStock(productionOutputId)

    if (!stock || requestedQuantity > asNumber(stock.quantity_remaining)) {
      const lineIndex = normalizedItems.findIndex(
        item => item.production_output_id === productionOutputId
      )
      await fail([
        {
          id: lineFieldId(lineIndex, stock ? 'quantity' : 'batch'),
          label: `Line ${lineIndex + 1}`,
          message:
            'One of the selected batches no longer has enough open stock for this issue.'
        }
      ])
      return
    }
  }

  clear()
  confirmation.value = null
  isSubmittingIssue.value = true

  try {
    await recordStockIssue({
      retailerId: issueForm.retailerId,
      issuedAt: toIsoTimestamp(issueForm.issuedOn),
      issueReference: issueForm.issueReference,
      notes: issueForm.notes,
      items: normalizedItems
    })

    const outcome = describeIssue()
    resetIssueForm()
    clearDraft()
    await props.afterSave?.()
    confirmation.value = outcome
  } catch (error) {
    $q.notify({
      type: 'negative',
      message: formatRetailError(
        error,
        'Unable to record the stock issue right now.'
      )
    })
  } finally {
    isSubmittingIssue.value = false
  }
}

defineExpose({
  /** Preselect a retailer (e.g. one just added from the page header). */
  selectRetailer(id) {
    issueForm.retailerId = id
  },
  /** Move focus to the first field of the form. */
  focusFirstField() {
    return focusField('stock-issue-retailer')
  }
})
</script>

<style scoped>
.stock-issue {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.stock-issue__title {
  margin: 0;
}
.stock-issue__intro {
  margin: var(--boms-space-1) 0 0;
  color: var(--boms-color-text-muted);
  font-size: 0.875rem;
}
.stock-issue__confirmation {
  margin: var(--boms-space-3) 0 0;
}
.stock-issue__notice {
  display: flex;
  align-items: flex-start;
  gap: var(--boms-space-2);
  margin: var(--boms-space-3) 0 0;
  padding: var(--boms-space-2) var(--boms-space-3);
  border-radius: var(--boms-radius-md);
  background: var(--boms-color-neutral-bg);
  color: var(--boms-color-text);
}
.stock-issue__notice .q-icon {
  flex: 0 0 auto;
  margin-top: 2px;
  overflow: hidden;
}
.stock-issue__draft {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--boms-space-2);
  margin-top: var(--boms-space-3);
  padding: var(--boms-space-2) var(--boms-space-3);
  border: 1px solid var(--boms-color-border);
  border-radius: var(--boms-radius-md);
  background: var(--boms-color-surface-subtle);
}
.stock-issue__draft-text {
  flex: 1 1 12rem;
  min-width: 0;
}
.stock-issue__form {
  margin-top: var(--boms-space-4);
}
@media (max-width: 599px) {
  .stock-issue__form {
    margin-top: var(--boms-space-3);
  }
}
.stock-issue__subheading {
  margin: var(--boms-space-4) 0 var(--boms-space-2);
  color: var(--boms-color-heading);
  font-size: 1rem;
  font-weight: 700;
  line-height: 1.4;
  letter-spacing: normal;
}
.stock-issue__lines {
  margin: 0;
  padding: 0;
  list-style: none;
}
.stock-issue__line-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--boms-space-3);
  min-height: 44px;
}
.stock-issue__availability {
  margin: var(--boms-space-2) 0 0;
  color: var(--boms-color-text-muted);
  font-size: 0.8125rem;
  overflow-wrap: anywhere;
}
</style>
