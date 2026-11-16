<template>
  <q-page class="page-layout dashboard-page">
    <PageHeader title="Beecone dashboard" :subtitle="subtitle">
      <template #status>
        <WorkspaceState
          display="chip"
          :mode="ws.mode.value"
          :announce="ws.mode.value !== WORKSPACE_MODE.UNAVAILABLE"
        />
      </template>
      <template #primary>
        <q-btn
          outline
          color="primary"
          no-caps
          icon="refresh"
          label="Refresh"
          :disable="ws.isLoading.value"
          @click="ws.refresh"
        />
      </template>
    </PageHeader>

    <WorkspaceState
      display="banner"
      :mode="ws.mode.value"
      :error="ws.error.value"
      :last-loaded-at="ws.lastLoadedAt.value"
      @retry="ws.refresh"
    />

    <TaskSelector
      v-model="activeView"
      :items="viewItems"
      label="Dashboard views"
    />

    <template v-if="activeView === 'dashboard'">
      <MetricStrip
        v-if="ws.hasData.value || isFirstLoad"
        :title="`Key figures for ${selectedMonth?.label ?? 'this month'}`"
        :items="metricItems"
        :loading="isFirstLoad"
      />

      <div v-if="ws.hasData.value" class="dashboard-layout">
        <DashboardAttention
          class="dashboard-layout__main"
          :retailer-watchlist="workspace.retailerWatchlist"
          :stock-sections="workspace.stockSections"
          :show-retailers="workspace.access.review"
        />
        <div class="dashboard-layout__aside">
          <DashboardTrend
            v-model="selectedMonthKey"
            :mode="trendMode"
            :months="workspace.months"
            :snapshot="workspace.snapshot"
            :collapsible="$q.screen.lt.md"
          />
          <DashboardActivity :items="workspace.activityFeed" />
        </div>
      </div>

      <div
        v-else-if="isFirstLoad"
        class="dashboard-layout"
        aria-hidden="true"
        data-dashboard-skeleton
      >
        <div class="surface-card dashboard-skeleton dashboard-layout__main">
          <q-skeleton type="text" width="45%" height="1.5rem" />
          <q-skeleton
            v-for="index in 4"
            :key="index"
            type="rect"
            height="52px"
          />
        </div>
        <div class="surface-card dashboard-skeleton dashboard-layout__aside">
          <q-skeleton type="text" width="55%" height="1.5rem" />
          <q-skeleton
            v-for="index in 3"
            :key="index"
            type="rect"
            height="44px"
          />
        </div>
      </div>
    </template>

    <BusinessReport v-else-if="activeView === 'weekly'" weekly />

    <template v-else>
      <DashboardMonthlyReview
        v-model="selectedMonthKey"
        :access="workspace.access"
        :months="workspace.months"
        :has-data="ws.hasData.value"
        :loading="isFirstLoad"
      />
      <BusinessReport :month="selectedMonthKey" />
    </template>
  </q-page>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useQuasar } from 'quasar'
import BusinessReport from '@/components/BusinessReport.vue'
import MetricStrip from '@/components/MetricStrip.vue'
import PageHeader from '@/components/PageHeader.vue'
import TaskSelector from '@/components/TaskSelector.vue'
import WorkspaceState from '@/components/WorkspaceState.vue'
import DashboardActivity from '@/components/dashboard/DashboardActivity.vue'
import DashboardAttention from '@/components/dashboard/DashboardAttention.vue'
import DashboardMonthlyReview from '@/components/dashboard/DashboardMonthlyReview.vue'
import DashboardTrend from '@/components/dashboard/DashboardTrend.vue'
import { useWorkspace, WORKSPACE_MODE } from '@/composables/useWorkspace'
import { getRoleLabel } from '@/constants/roles'
import { authState } from '@/services/auth'
import {
  buildMetricStrip,
  createEmptyDashboardWorkspace,
  fetchDashboardWorkspace,
  getMonthContext,
  getTrendMode
} from '@/services/dashboard'

const $q = useQuasar()

// Dashboard, weekly and monthly reports are review modes, kept in ?view=.
const viewItems = [
  {
    name: 'dashboard',
    label: 'Dashboard',
    icon: 'space_dashboard',
    group: 'review'
  },
  { name: 'weekly', label: 'Weekly', icon: 'date_range', group: 'review' },
  {
    name: 'review',
    label: 'Monthly review',
    icon: 'calendar_month',
    group: 'review'
  }
]

// The empty workspace only gives templates their shape (month timeline,
// access flags); nothing from it is shown as data until a load succeeds.
const ws = useWorkspace(
  ({ signal }) => fetchDashboardWorkspace(authState.role, { signal }),
  { initialData: createEmptyDashboardWorkspace(authState.role) }
)

const activeView = ref('dashboard')
const selectedMonthKey = ref(ws.data.value.currentMonthKey)

const workspace = computed(() => ws.data.value)
const isFirstLoad = computed(() => ws.mode.value === WORKSPACE_MODE.LOADING)
const roleLabel = computed(() => getRoleLabel(authState.role))
const monthContext = computed(() =>
  getMonthContext(workspace.value, selectedMonthKey.value)
)
const selectedMonth = computed(() => monthContext.value.month)
const subtitle = computed(() =>
  [selectedMonth.value?.label ?? 'Monthly review', roleLabel.value].join(' · ')
)
const trendMode = computed(() => getTrendMode(workspace.value.access))
const metricItems = computed(() =>
  buildMetricStrip(
    workspace.value,
    monthContext.value.month,
    monthContext.value.previousMonth
  )
)

// Keep the chosen month while it is still in the six-month window.
watch(
  () => ws.data.value,
  next => {
    if (!next.months.some(month => month.key === selectedMonthKey.value))
      selectedMonthKey.value =
        next.currentMonthKey ?? next.months[next.months.length - 1]?.key ?? null
  }
)

watch(
  () => authState.role,
  () => {
    void ws.refresh()
  }
)
</script>

<style scoped>
.dashboard-layout {
  display: grid;
  gap: var(--boms-space-4);
  min-width: 0;
}
.dashboard-layout__main,
.dashboard-layout__aside {
  min-width: 0;
}
.dashboard-layout__aside {
  display: grid;
  gap: var(--boms-space-4);
  align-content: start;
}
.dashboard-skeleton {
  display: grid;
  gap: var(--boms-space-2);
  padding: var(--boms-space-4);
}
@media (min-width: 1024px) {
  .dashboard-layout {
    grid-template-columns: minmax(0, 3fr) minmax(0, 2fr);
    align-items: start;
  }
}
</style>
