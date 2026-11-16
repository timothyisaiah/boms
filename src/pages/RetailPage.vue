<template>
  <q-page class="page-layout retail-page">
    <PageHeader
      title="Warehouse and retail stock"
      :subtitle="subtitle"
      :actions="headerActions"
    >
      <template #status>
        <WorkspaceState display="chip" :mode="ws.mode.value" />
      </template>
      <template v-if="canIssueStock" #primary>
        <q-btn
          color="primary"
          unelevated
          no-caps
          icon="local_shipping"
          label="New stock issue"
          @click="startStockIssue"
        />
      </template>
    </PageHeader>

    <WorkspaceState
      display="banner"
      :mode="ws.mode.value"
      :error="ws.error.value"
      :last-loaded-at="ws.lastLoadedAt.value"
      @retry="refreshAll"
    />

    <TaskSelector v-model="task" label="Distribution tasks" :items="tasks" />

    <MetricStrip
      title="Distribution summary"
      :items="metrics"
      :loading="!ws.hasData.value"
    />

    <div class="retail-page__content">
      <StockIssueForm
        v-if="canIssueStock"
        v-show="task === 'issue'"
        ref="issueFormRef"
        :retailers="workspace.retailers"
        :open-finished-stock="openFinishedStock"
        :workspace-mode="ws.mode.value"
        :can-issue="canIssueStock"
        :after-save="refreshAll"
        @view-dispatches="task = 'dispatches'"
      />
      <DispatchRecords v-if="task === 'dispatches'" ref="historyRef" />
      <MovementRecords v-else-if="task === 'movements'" ref="historyRef" />
      <RetailSnapshot
        v-else-if="task === 'snapshot'"
        ref="historyRef"
        :open-finished-stock="openFinishedStock"
        :balances="retailerBalances"
        :ready="ws.hasData.value"
        @view-movements="task = 'movements'"
      />
    </div>

    <RetailPartnerActions
      v-if="canManageRetailers"
      ref="partnerActionsRef"
      @added="retailerAdded"
      @updated="refreshAll"
    />
  </q-page>
</template>

<script setup>
import { computed, nextTick, ref } from 'vue'
import { useQuasar } from 'quasar'
import { useRoute } from 'vue-router'
import MetricStrip from '@/components/MetricStrip.vue'
import PageHeader from '@/components/PageHeader.vue'
import TaskSelector from '@/components/TaskSelector.vue'
import WorkspaceState from '@/components/WorkspaceState.vue'
import DispatchRecords from '@/components/retail/DispatchRecords.vue'
import MovementRecords from '@/components/retail/MovementRecords.vue'
import RetailPartnerActions from '@/components/retail/RetailPartnerActions.vue'
import RetailSnapshot from '@/components/retail/RetailSnapshot.vue'
import StockIssueForm from '@/components/retail/StockIssueForm.vue'
import { useWorkspace } from '@/composables/useWorkspace'
import { can, canWrite } from '@/constants/capabilities'
import { asNumber, formatQuantity } from '@/lib/format'
import { authState } from '@/services/auth'
import {
  emptyRetailWorkspace,
  fetchRetailWorkspace,
  mergeRetailerBalances
} from '@/services/retail'

const $q = useQuasar()
const route = useRoute()
// Phones skip the subtitle so the task selector and form start higher (MF-02).
const subtitle = computed(() =>
  $q.screen.gt.xs
    ? 'Issue batch-traced stock and keep retailer balances visible.'
    : ''
)
const ws = useWorkspace(({ signal }) => fetchRetailWorkspace({ signal }), {
  initialData: emptyRetailWorkspace()
})
const workspace = computed(() => ws.data.value ?? emptyRetailWorkspace())

const canIssueStock = computed(() => canWrite(authState.role, 'stock-issues'))
const canManageRetailers = computed(() => canWrite(authState.role, 'retailers'))
const canOpenFinance = computed(() => can(authState.role, 'route:finance'))

// TaskSelector owns ?view= (validation, fallback, back/forward); seeding the
// model from the URL avoids rendering the default task first.
const initialView = route.query.view
const task = ref(typeof initialView === 'string' ? initialView : '')
const issueFormRef = ref(null)
const historyRef = ref(null)
const partnerActionsRef = ref(null)

const counts = computed(() =>
  ws.hasData.value ? (workspace.value.historyCounts ?? {}) : {}
)

const tasks = computed(() => [
  ...(canIssueStock.value
    ? [
        {
          name: 'issue',
          label: 'Issue stock',
          icon: 'local_shipping',
          group: 'do'
        }
      ]
    : []),
  {
    name: 'dispatches',
    label: 'Dispatches',
    icon: 'inventory_2',
    group: 'review',
    count: counts.value.stockIssues
  },
  {
    name: 'movements',
    label: 'Movements',
    icon: 'swap_horiz',
    group: 'review',
    count: counts.value.retailerMovements
  },
  { name: 'snapshot', label: 'Snapshot', icon: 'insights', group: 'review' }
])

const openFinishedStock = computed(() =>
  (workspace.value.finishedStock ?? []).filter(
    stock => asNumber(stock.quantity_remaining) > 0
  )
)

const totalOpenUnits = computed(() =>
  openFinishedStock.value.reduce(
    (total, stock) => total + asNumber(stock.quantity_remaining),
    0
  )
)

const retailerBalances = computed(() =>
  mergeRetailerBalances(
    workspace.value.retailers,
    workspace.value.retailerStockPositions
  )
)

const activeRetailerBalances = computed(
  () => retailerBalances.value.filter(balance => balance.totalUnits > 0).length
)

const metrics = computed(() => [
  {
    label: 'Retailers',
    value: `${workspace.value.retailers.length} listed`
  },
  {
    label: 'Open jars',
    value: `${formatQuantity(totalOpenUnits.value)} jars`,
    hint: `${openFinishedStock.value.length} batch lines`
  },
  {
    label: 'With stock',
    value: `${activeRetailerBalances.value} ${
      activeRetailerBalances.value === 1 ? 'retailer' : 'retailers'
    }`
  }
])

const headerActions = computed(() => [
  {
    label: 'Add retailer',
    icon: 'add_business',
    visible: canManageRetailers.value,
    handler: () => partnerActionsRef.value?.openAdd()
  },
  {
    label: 'Manage retailers',
    icon: 'manage_search',
    visible: canManageRetailers.value,
    handler: () => partnerActionsRef.value?.openManage()
  },
  {
    label: 'Refresh workspace',
    icon: 'refresh',
    disable: ws.isLoading.value,
    handler: refreshAll
  },
  {
    label: 'Open reconciliation and finance',
    icon: 'account_balance',
    to: '/finance',
    visible: canOpenFinance.value
  }
])

/** Summary (counts, balances, open stock) plus the visible history view. */
async function refreshAll() {
  await Promise.all([ws.refresh(), historyRef.value?.refresh?.()])
}

async function startStockIssue() {
  task.value = 'issue'
  await nextTick()
  issueFormRef.value?.focusFirstField()
}

async function retailerAdded(result) {
  await refreshAll()
  issueFormRef.value?.selectRetailer(result?.id)
}
</script>

<style scoped>
.retail-page {
  gap: var(--boms-space-4);
}
.retail-page__content {
  min-width: 0;
}
</style>
