<template>
  <q-page class="page-layout operations-page">
    <PageHeader
      title="Supply and production"
      :subtitle="subtitle"
      :actions="headerActions"
    >
      <template #status>
        <WorkspaceState
          display="chip"
          :mode="workspaceState.mode.value"
          :error="workspaceState.error.value"
          :last-loaded-at="workspaceState.lastLoadedAt.value"
        />
      </template>

      <template v-if="primaryTask" #primary>
        <q-btn
          color="primary"
          unelevated
          no-caps
          :icon="primaryTask.icon"
          :label="primaryTask.primaryLabel"
          @click="openPrimaryTask"
        />
      </template>
    </PageHeader>

    <WorkspaceState
      class="operations-page__workspace-state"
      display="banner"
      :mode="workspaceState.mode.value"
      :error="workspaceState.error.value"
      :last-loaded-at="workspaceState.lastLoadedAt.value"
      @retry="refreshAll"
    />

    <TaskSelector
      v-model="task"
      class="operations-page__tasks"
      label="Supply and production tasks"
      :items="tasks"
    />

    <main class="operations-page__content">
      <!-- Keep both write forms mounted so switching tasks never loses input. -->
      <ReceiptForm
        v-show="task === 'receipt-entry'"
        ref="receiptFormView"
        :form="receiptForm"
        :supplier-options="supplierOptions"
        :material-options="materialOptions"
        :disabled="purchaseWritesDisabled"
        :submitting="isSubmittingPurchase"
        :draft-restored="receiptDraft.restored.value"
        :confirmation="receiptConfirmation"
        :can-create-batch="mayRecordProduction"
        @submit="submitPurchase"
        @saved="purchaseSaved()"
        @discard-draft="discardReceiptDraft"
        @another="startAnother('receipt-entry')"
        @navigate="openTask"
        @dismiss-confirmation="receiptConfirmation = null"
      />

      <BatchForm
        v-show="task === 'batch-entry'"
        ref="batchFormView"
        :form="batchForm"
        :disabled="batchWritesDisabled"
        :submitting="isSubmittingBatch"
        :needs-lots="workspaceIsLive && openInventoryLots.length === 0"
        :draft-restored="batchDraft.restored.value"
        :confirmation="batchConfirmation"
        @submit="submitBatch"
        @saved="batchSaved()"
        @discard-draft="discardBatchDraft"
        @another="startAnother('batch-entry')"
        @navigate="openTask"
        @dismiss-confirmation="batchConfirmation = null"
      />

      <HistoryRecords
        v-if="task === 'purchases'"
        :table="purchaseHistory"
        title="Purchase history"
        :columns="purchaseColumns"
        search-label="Search purchases"
        empty-title="No receipts yet"
        empty-message="Recorded material receipts will appear here."
      />

      <HistoryRecords
        v-if="task === 'batches'"
        :table="batchHistory"
        title="Batch history"
        :columns="batchColumns"
        search-label="Search batches"
        empty-title="No production batches yet"
        empty-message="Created production batches will appear here."
      />

      <OperationsSnapshot
        v-if="task === 'snapshot'"
        :workspace="workspace"
        :open-lots="openInventoryLots"
      />
    </main>

    <OperationsManagers
      ref="managersRef"
      @saved="refreshAll"
      @supplier-added="supplierAdded"
    />

    <DirtyGuardDialog
      :when="receiptDraft.isDirty.value || batchDraft.isDirty.value"
    />
  </q-page>
</template>

<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import { useQuasar } from 'quasar'
import { authState } from '@/services/auth'
import { can, canWrite } from '@/constants/capabilities'
import PageHeader from '@/components/PageHeader.vue'
import TaskSelector from '@/components/TaskSelector.vue'
import WorkspaceState from '@/components/WorkspaceState.vue'
import DirtyGuardDialog from '@/components/DirtyGuardDialog.vue'
import ReceiptForm from '@/components/operations/ReceiptForm.vue'
import BatchForm from '@/components/operations/BatchForm.vue'
import HistoryRecords from '@/components/operations/HistoryRecords.vue'
import OperationsManagers from '@/components/operations/OperationsManagers.vue'
import OperationsSnapshot from '@/components/operations/OperationsSnapshot.vue'
import {
  batchColumns,
  purchaseColumns
} from '@/components/operations/historyColumns'
import { useWorkspace } from '@/composables/useWorkspace'
import { useFormDraft } from '@/composables/useFormDraft'
import { useReceiptForm } from '@/composables/operations/useReceiptForm'
import { useBatchForm } from '@/composables/operations/useBatchForm'
import { useHistoryTable } from '@/composables/operations/useHistoryTable'
import { asNumber, formatMoney, formatQuantity } from '@/lib/format'
import { isWriteLocked } from '@/services/writes'
import {
  emptyOperationsWorkspace,
  fetchBatchesStartedOn,
  fetchOperationsSummary,
  findBatchesByCode,
  formatOperationsError,
  historyCount,
  recordProductionBatch,
  recordPurchase
} from '@/services/operations'

const $q = useQuasar()
const task = ref('')
const receiptFormView = ref(null)
const batchFormView = ref(null)
const managersRef = ref(null)
const isSubmittingPurchase = ref(false)
const isSubmittingBatch = ref(false)
// `{ title, details }` shown above each form after a successful save.
const receiptConfirmation = ref(null)
const batchConfirmation = ref(null)

const workspaceState = useWorkspace(
  ({ signal }) => fetchOperationsSummary({ signal }),
  { initialData: emptyOperationsWorkspace() }
)
const workspace = computed(
  () => workspaceState.data.value ?? emptyOperationsWorkspace()
)
const workspaceIsLive = computed(() => workspaceState.mode.value === 'live')

const receiptForm = useReceiptForm()
// Inputs only: writes.js keeps the idempotency key and retry body separately.
const receiptDraft = useFormDraft('operations:receipt', receiptForm.state, {
  deserialize: receiptForm.deserialize
})
const batchForm = useBatchForm(workspace, {
  loadDayBatches: fetchBatchesStartedOn,
  findBatchesByCode
})
const batchDraft = useFormDraft('operations:batch', batchForm.state, {
  exclude: ['batchCode'],
  deserialize: batchForm.deserialize
})

const purchaseHistory = useHistoryTable('purchases')
const batchHistory = useHistoryTable('batches')

const mayRecordPurchases = computed(() => canWrite(authState.role, 'purchases'))
const mayRecordProduction = computed(() =>
  canWrite(authState.role, 'production')
)

const tasks = computed(() => {
  const result = []
  if (mayRecordPurchases.value)
    result.push({
      name: 'receipt-entry',
      label: 'Receipt form',
      icon: 'add_shopping_cart',
      primaryLabel: 'New receipt',
      group: 'do'
    })
  if (mayRecordProduction.value)
    result.push({
      name: 'batch-entry',
      label: 'Batch form',
      icon: 'precision_manufacturing',
      primaryLabel: 'New batch',
      group: 'do'
    })
  result.push(
    {
      name: 'purchases',
      label: 'Purchases',
      icon: 'receipt_long',
      count: workspaceState.hasData.value
        ? historyCount(workspace.value, 'purchases')
        : undefined,
      group: 'review'
    },
    {
      name: 'batches',
      label: 'Batches',
      icon: 'inventory_2',
      count: workspaceState.hasData.value
        ? historyCount(workspace.value, 'batches')
        : undefined,
      group: 'review'
    },
    {
      name: 'snapshot',
      label: 'Snapshot',
      icon: 'warehouse',
      group: 'review'
    }
  )
  return result
})

const primaryTask = computed(() => {
  if (mayRecordPurchases.value)
    return tasks.value.find(item => item.name === 'receipt-entry')
  if (mayRecordProduction.value)
    return tasks.value.find(item => item.name === 'batch-entry')
  return null
})

const openInventoryLots = computed(() =>
  (workspace.value.inventoryLots ?? []).filter(
    lot => asNumber(lot.quantity_remaining) > 0
  )
)
const supplierOptions = computed(() =>
  (workspace.value.suppliers ?? []).map(supplier => ({
    label: supplier.supplier_name,
    value: supplier.id
  }))
)
const materialOptions = computed(() =>
  (workspace.value.materials ?? []).map(material => ({
    label: `${material.name} / ${material.unit_of_measure}`,
    value: material.id
  }))
)

const purchaseWritesDisabled = computed(
  () =>
    !workspaceIsLive.value ||
    !mayRecordPurchases.value ||
    isSubmittingPurchase.value ||
    isWriteLocked('purchases')
)
const batchWritesDisabled = computed(
  () =>
    !workspaceIsLive.value ||
    !mayRecordProduction.value ||
    isSubmittingBatch.value ||
    isWriteLocked('production') ||
    openInventoryLots.value.length === 0
)

const subtitle = computed(() => {
  if (workspaceState.mode.value === 'loading')
    return 'Loading current supply and production data.'
  if (workspaceState.mode.value === 'unavailable')
    return workspaceState.hasData.value
      ? 'Reviewing the last data loaded; saves are paused.'
      : 'Current supply and production data is unavailable.'
  if (mayRecordPurchases.value && mayRecordProduction.value)
    return 'Record incoming materials and turn them into traceable batches.'
  if (mayRecordProduction.value)
    return 'Create traceable batches from the material lots available now.'
  return 'Review material receipts, production batches, and stock on hand.'
})

const headerActions = computed(() => [
  {
    label: 'Refresh data',
    icon: 'refresh',
    disable: workspaceState.isLoading.value,
    handler: refreshAll
  },
  {
    label: canWrite(authState.role, 'variants')
      ? 'Manage variants'
      : 'View variants',
    icon: 'category',
    visible: can(authState.role, 'read:variants'),
    handler: () => managersRef.value?.openVariants()
  },
  {
    label: canWrite(authState.role, 'materials')
      ? 'Manage materials'
      : 'View materials',
    icon: 'inventory_2',
    visible: can(authState.role, 'read:materials'),
    handler: () => managersRef.value?.openMaterials()
  },
  {
    label: 'Add supplier',
    icon: 'add_business',
    visible: canWrite(authState.role, 'suppliers'),
    handler: () => managersRef.value?.openAddSupplier()
  },
  {
    label: 'Manage suppliers',
    icon: 'manage_search',
    visible: canWrite(authState.role, 'suppliers'),
    handler: () => managersRef.value?.openSupplierProfiles()
  },
  { label: 'Back to dashboard', icon: 'arrow_back', to: '/' }
])

watch(
  task,
  value => {
    if (value === 'purchases' && !purchaseHistory.loaded.value)
      void purchaseHistory.request()
    if (value === 'batches' && !batchHistory.loaded.value)
      void batchHistory.request()
  },
  { flush: 'post' }
)

async function refreshAll() {
  const refreshes = [workspaceState.refresh()]
  if (purchaseHistory.loaded.value) refreshes.push(purchaseHistory.reload())
  if (batchHistory.loaded.value) refreshes.push(batchHistory.reload())
  await Promise.all(refreshes)
}

async function supplierAdded(result) {
  await refreshAll()
  if (!result?.id) return
  // Preselecting the new supplier on an untouched receipt is not unsaved
  // input: keep the form clean so it neither drafts nor guards navigation.
  const wasClean = !receiptDraft.isDirty.value
  receiptForm.state.supplierId = result.id
  if (wasClean) receiptDraft.clearDraft()
}

async function openPrimaryTask() {
  if (!primaryTask.value) return
  task.value = primaryTask.value.name
  await nextTick()
  if (task.value === 'receipt-entry') receiptFormView.value?.focusFirstField()
  else batchFormView.value?.focusFirstField()
}

async function submitPurchase(payload) {
  if (purchaseWritesDisabled.value) return
  receiptConfirmation.value = null
  isSubmittingPurchase.value = true
  try {
    await recordPurchase(payload)
    await purchaseSaved(describeReceipt(payload))
  } catch (error) {
    $q.notify({
      type: 'negative',
      message: formatOperationsError(
        error,
        'The material receipt could not be saved.'
      )
    })
  } finally {
    isSubmittingPurchase.value = false
  }
}

/** Confirmation text for a receipt, built before the form is reset. */
function describeReceipt(payload) {
  const supplier = supplierOptions.value.find(
    option => option.value === payload.supplierId
  )
  const lines = payload.items.length
  return {
    title: `Receipt recorded from ${supplier?.label ?? 'the supplier'}`,
    details: [
      `${lines} ${lines === 1 ? 'line' : 'lines'}, estimated total ${formatMoney(receiptForm.total.value)}.`,
      'Material lots and purchase history have been refreshed.'
    ]
  }
}

// A confirmed retry posted the saved body, which may differ from what the
// form shows now, so it is described generically.
async function purchaseSaved(
  outcome = {
    title: 'Saved receipt confirmed',
    details: ['Material lots and purchase history have been refreshed.']
  }
) {
  receiptForm.reset()
  receiptDraft.clearDraft()
  receiptFormView.value?.clearErrors()
  await Promise.all([
    workspaceState.refresh(),
    purchaseHistory.loaded.value ? purchaseHistory.reload() : Promise.resolve()
  ])
  receiptConfirmation.value = outcome
}

function discardReceiptDraft() {
  receiptForm.reset()
  receiptDraft.clearDraft()
  receiptFormView.value?.clearErrors()
}

async function submitBatch(payload) {
  if (batchWritesDisabled.value) return
  batchConfirmation.value = null
  isSubmittingBatch.value = true
  try {
    await recordProductionBatch(payload)
    batchForm.rememberBatch(payload)
    await batchSaved(describeBatch(payload))
  } catch (error) {
    $q.notify({
      type: 'negative',
      message: formatOperationsError(
        error,
        'The production batch could not be saved.'
      )
    })
  } finally {
    isSubmittingBatch.value = false
  }
}

/** Confirmation text for a batch, built before the form is reset. */
function describeBatch(payload) {
  const variant = batchForm.variantOptions.value.find(
    option => option.value === payload.variantId
  )
  return {
    title: `Batch ${payload.batchCode} created`,
    details: [
      `${formatQuantity(payload.outputQuantity)} jars of ${variant?.label ?? 'the selected variant'}.`,
      'Open lots and batch history have been refreshed.'
    ]
  }
}

async function batchSaved(
  outcome = {
    title: 'Saved batch confirmed',
    details: ['Open lots and batch history have been refreshed.']
  }
) {
  batchForm.reset()
  batchDraft.clearDraft()
  batchFormView.value?.clearErrors()
  await Promise.all([
    workspaceState.refresh(),
    batchHistory.loaded.value ? batchHistory.reload() : Promise.resolve()
  ])
  void batchForm.refreshSuggestion()
  batchConfirmation.value = outcome
}

const formViews = {
  'receipt-entry': () => receiptFormView.value,
  'batch-entry': () => batchFormView.value
}

/** "Record another receipt" / "Create another batch": the form is reset. */
async function startAnother(name) {
  if (name === 'receipt-entry') receiptConfirmation.value = null
  else batchConfirmation.value = null
  await nextTick()
  formViews[name]?.()?.focusFirstField()
}

/** Next action from a confirmation: switch task (and `?view=`). */
async function openTask(name) {
  receiptConfirmation.value = null
  batchConfirmation.value = null
  task.value = name
  await nextTick()
  formViews[name]?.()?.focusFirstField()
}

function discardBatchDraft() {
  batchForm.reset()
  batchDraft.clearDraft()
  batchFormView.value?.clearErrors()
}
</script>

<style scoped>
.operations-page {
  display: flex;
  flex-direction: column;
  gap: var(--boms-space-3);
}
.operations-page__workspace-state:empty {
  display: none;
}
.operations-page__tasks {
  min-width: 0;
}
.operations-page__content {
  min-width: 0;
  padding-top: var(--boms-space-2);
}

@media (min-width: 600px) {
  .operations-page {
    gap: var(--boms-space-4);
  }
}

@media (max-width: 1023.98px) {
  /* MainLayout's phone footer is 56px tall. Keep the sticky submit action
     above it. */
  .operations-page :deep(.form-action-bar--sticky) {
    bottom: calc(56px + var(--boms-safe-bottom));
  }
}
</style>
