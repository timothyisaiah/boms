<template>
  <q-page class="page-layout finance-page">
    <PageHeader
      title="Reconciliation and cash"
      subtitle="Settle retailer stock, record cash and review margin."
      :actions="headerActions"
    >
      <template #status>
        <WorkspaceState display="chip" :mode="ws.mode.value" />
      </template>
    </PageHeader>

    <WorkspaceState
      display="banner"
      skeleton
      :mode="ws.mode.value"
      :error="ws.error.value"
      :last-loaded-at="ws.lastLoadedAt.value"
      @retry="ws.refresh"
    />

    <TaskSelector v-model="task" :items="taskItems" label="Finance tasks" />

    <MetricStrip
      title="Finance figures"
      :items="metrics"
      :loading="!ws.hasData.value"
    />

    <q-tab-panels
      v-model="task"
      keep-alive
      class="finance-page__panels"
      data-finance-panels
    >
      <q-tab-panel
        v-if="canRecord.reconciliations"
        name="reconciliation"
        class="finance-page__panel"
      >
        <ReconciliationForm
          :data="workspace"
          :mode="ws.mode.value"
          :can-write="canRecord.reconciliations"
          :can-record-remittance="canRecord.remittances"
          :after-save="afterSave"
          @dirty="value => (dirty.reconciliation = value)"
          @navigate="navigate"
        />
      </q-tab-panel>

      <q-tab-panel
        v-if="canRecord.remittances"
        name="remittance"
        class="finance-page__panel"
      >
        <RemittanceForm
          :data="workspace"
          :mode="ws.mode.value"
          :can-write="canRecord.remittances"
          :prefill="remittancePrefill"
          :after-save="afterSave"
          @dirty="value => (dirty.remittance = value)"
          @navigate="navigate"
        />
      </q-tab-panel>

      <q-tab-panel
        v-if="canRecord.expenses"
        name="expense"
        class="finance-page__panel"
      >
        <ExpenseForm
          :mode="ws.mode.value"
          :can-write="canRecord.expenses"
          :after-save="afterSave"
          @dirty="value => (dirty.expense = value)"
          @navigate="navigate"
        />
      </q-tab-panel>

      <q-tab-panel name="records" class="finance-page__panel">
        <FinanceRecords :refresh-key="historyRevision" />
      </q-tab-panel>

      <q-tab-panel name="snapshot" class="finance-page__panel">
        <FinanceSnapshot
          :balances="workspace.retailerBalances ?? []"
          :profit="profitSummary"
        />
      </q-tab-panel>
    </q-tab-panels>

    <DirtyGuardDialog :when="isDirty" />
  </q-page>
</template>

<script setup>
import { computed, reactive, ref } from 'vue'
import DirtyGuardDialog from '@/components/DirtyGuardDialog.vue'
import MetricStrip from '@/components/MetricStrip.vue'
import PageHeader from '@/components/PageHeader.vue'
import TaskSelector from '@/components/TaskSelector.vue'
import WorkspaceState from '@/components/WorkspaceState.vue'
import ExpenseForm from '@/components/finance/ExpenseForm.vue'
import FinanceRecords from '@/components/finance/FinanceRecords.vue'
import FinanceSnapshot from '@/components/finance/FinanceSnapshot.vue'
import ReconciliationForm from '@/components/finance/ReconciliationForm.vue'
import RemittanceForm from '@/components/finance/RemittanceForm.vue'
import { useWorkspace } from '@/composables/useWorkspace'
import { can, canWrite } from '@/constants/capabilities'
import { authState } from '@/services/auth'
import { emptyFinanceSummary, fetchFinanceSummary } from '@/services/finance'
import { asNumber, formatMoney, formatQuantity } from '@/lib/format'

const ws = useWorkspace(({ signal }) => fetchFinanceSummary({ signal }), {
  initialData: emptyFinanceSummary()
})
const workspace = computed(() => ({
  ...emptyFinanceSummary(),
  ...ws.data.value
}))

const task = ref('')
const historyRevision = ref(0)
const remittancePrefill = ref(null)
const dirty = reactive({
  reconciliation: false,
  remittance: false,
  expense: false
})
const isDirty = computed(() => Object.values(dirty).some(Boolean))

const canRecord = computed(() => ({
  reconciliations: canWrite(authState.role, 'reconciliations'),
  remittances: canWrite(authState.role, 'remittances'),
  expenses: canWrite(authState.role, 'expenses')
}))

const historyCounts = computed(() => workspace.value.historyCounts ?? {})
const recordCount = computed(() => {
  const counts = historyCounts.value
  const keys = ['reconciliations', 'remittances', 'expenses']
  if (!keys.some(key => key in counts)) return undefined
  return keys.reduce((total, key) => total + asNumber(counts[key]), 0)
})

// Do: only the writes this role may perform. Review: everyone on /finance.
const taskItems = computed(() => [
  ...(canRecord.value.reconciliations
    ? [
        {
          name: 'reconciliation',
          label: 'Reconciliation',
          icon: 'fact_check',
          group: 'do'
        }
      ]
    : []),
  ...(canRecord.value.remittances
    ? [
        {
          name: 'remittance',
          label: 'Remittance',
          icon: 'payments',
          group: 'do'
        }
      ]
    : []),
  ...(canRecord.value.expenses
    ? [
        {
          name: 'expense',
          label: 'Expense',
          icon: 'receipt_long',
          group: 'do'
        }
      ]
    : []),
  {
    name: 'records',
    label: 'Records',
    icon: 'history',
    group: 'review',
    count: recordCount.value
  },
  { name: 'snapshot', label: 'Snapshot', icon: 'insights', group: 'review' }
])

const headerActions = computed(() => [
  {
    label: 'Refresh workspace',
    icon: 'refresh',
    handler: () => ws.refresh(),
    disable: ws.isLoading.value
  },
  {
    label: 'Open distribution',
    icon: 'storefront',
    to: '/retail',
    visible: can(authState.role, 'route:retail')
  }
])

const profitSummary = computed(() => ({
  active_retailers: 0,
  issued_quantity: 0,
  sold_quantity: 0,
  returned_quantity: 0,
  damaged_quantity: 0,
  remaining_quantity: 0,
  recognized_sales_value: 0,
  cost_of_goods_sold: 0,
  gross_profit: 0,
  expense_count: 0,
  operating_expenses: 0,
  net_profit: 0,
  remitted_amount: 0,
  outstanding_amount: 0,
  ...workspace.value.profitSummary
}))

const retailersWithOutstanding = computed(
  () =>
    (workspace.value.retailerBalances ?? []).filter(
      balance => asNumber(balance.outstanding_amount) > 0
    ).length
)

// Outstanding cash is the exception figure: MetricStrip puts it first.
const metrics = computed(() => [
  {
    label: 'Recognized sales',
    value: formatMoney(profitSummary.value.recognized_sales_value),
    hint: `${formatQuantity(profitSummary.value.sold_quantity)} jars settled`
  },
  {
    label: 'Remitted',
    value: formatMoney(profitSummary.value.remitted_amount),
    hint: `${formatQuantity(historyCounts.value.remittances)} receipts posted`
  },
  {
    label: 'Gross profit',
    value: formatMoney(profitSummary.value.gross_profit),
    hint: 'Before operating expenses'
  },
  {
    label: 'Outstanding',
    value: formatMoney(profitSummary.value.outstanding_amount),
    hint: `${retailersWithOutstanding.value} retailers with payment due`,
    tone:
      asNumber(profitSummary.value.outstanding_amount) > 0 ? 'warning' : null
  }
])

// After a confirmed write: refresh the summary (balances, open lines, counts,
// reconciliationOptions) and any history list that is or will be shown.
async function afterSave() {
  await ws.refresh()
  historyRevision.value += 1
}

function navigate({ view, prefill }) {
  if (view === 'remittance' && prefill)
    remittancePrefill.value = { ...prefill, token: Date.now() }
  task.value = view
}
</script>

<style scoped>
.finance-page__panels {
  background: transparent;
}
.finance-page__panel {
  padding: 0;
}
</style>
