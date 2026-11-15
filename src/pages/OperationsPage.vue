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
        @submit="submitPurchase"
        @saved="purchaseSaved"
      />

      <BatchForm
        v-show="task === 'batch-entry'"
        ref="batchFormView"
        :form="batchForm"
        :disabled="batchWritesDisabled"
        :submitting="isSubmittingBatch"
        :needs-lots="workspaceIsLive && openInventoryLots.length === 0"
        :draft-restored="batchDraft.restored.value"
        @submit="submitBatch"
        @saved="batchSaved"
        @discard-draft="discardBatchDraft"
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

    <DirtyGuardDialog :when="batchDraft.isDirty.value" />
  </q-page>
</template>

<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import { useQuasar } from 'quasar'
import { authState } from '@/services/auth'
import { canWrite } from '@/constants/capabilities'
import PageHeader from '@/components/PageHeader.vue'
import TaskSelector from '@/components/TaskSelector.vue'
import WorkspaceState from '@/components/WorkspaceState.vue'
import DirtyGuardDialog from '@/components/DirtyGuardDialog.vue'
import ReceiptForm from '@/components/operations/ReceiptForm.vue'
import BatchForm from '@/components/operations/BatchForm.vue'
import HistoryRecords from '@/components/operations/HistoryRecords.vue'
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
import { asNumber } from '@/lib/format'
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
const isSubmittingPurchase = ref(false)
const isSubmittingBatch = ref(false)

const workspaceState = useWorkspace(
  ({ signal }) => fetchOperationsSummary({ signal }),
  { initialData: emptyOperationsWorkspace() }
)
const workspace = computed(
  () => workspaceState.data.value ?? emptyOperationsWorkspace()
)
const workspaceIsLive = computed(() => workspaceState.mode.value === 'live')

const receiptForm = useReceiptForm()
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

// Management dialogs are intentionally not included here. The managers wave
// will add its PageHeader overflow slot after its shared dialog components land.
const headerActions = computed(() => [
  {
    label: 'Refresh data',
    icon: 'refresh',
    disable: workspaceState.isLoading.value,
    handler: refreshAll
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

async function openPrimaryTask() {
  if (!primaryTask.value) return
  task.value = primaryTask.value.name
  await nextTick()
  if (task.value === 'receipt-entry') receiptFormView.value?.focusFirstField()
  else batchFormView.value?.focusFirstField()
}

async function submitPurchase(payload) {
  if (purchaseWritesDisabled.value) return
  isSubmittingPurchase.value = true
  try {
    await recordPurchase(payload)
    await purchaseSaved()
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

async function purchaseSaved() {
  receiptForm.reset()
  receiptFormView.value?.clearErrors()
  $q.notify({ type: 'positive', message: 'Material receipt saved.' })
  await Promise.all([
    workspaceState.refresh(),
    purchaseHistory.loaded.value ? purchaseHistory.reload() : Promise.resolve()
  ])
}

async function submitBatch(payload) {
  if (batchWritesDisabled.value) return
  isSubmittingBatch.value = true
  try {
    await recordProductionBatch(payload)
    batchForm.rememberBatch(payload)
    await batchSaved()
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

async function batchSaved() {
  batchForm.reset()
  batchDraft.clearDraft()
  batchFormView.value?.clearErrors()
  $q.notify({ type: 'positive', message: 'Production batch saved.' })
  await Promise.all([
    workspaceState.refresh(),
    batchHistory.loaded.value ? batchHistory.reload() : Promise.resolve()
  ])
  void batchForm.refreshSuggestion()
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
     above it; the older `.form-footer` rule does not cover FormActionBar. */
  .operations-page :deep(.form-action-bar--sticky) {
    bottom: calc(56px + var(--boms-safe-bottom));
  }
}
</style>
