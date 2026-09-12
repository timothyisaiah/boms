<template>
  <q-page class="page-layout dashboard-page">
    <section class="page-hero dashboard-hero">
      <div>
        <p class="page-hero__eyebrow">Business review</p>
        <h1 class="page-hero__title">Beecone dashboard</h1>
        <p class="page-hero__body">
          Monthly review, stock health, and cash visibility in one place.
        </p>

        <div class="summary-pill-row q-mt-md">
          <q-chip square color="amber-2" text-color="brown-10">
            {{ selectedMonth?.label ?? 'Monthly review' }}
          </q-chip>
          <q-chip
            square
            :color="workspace.mode !== 'live' ? 'orange-2' : 'green-1'"
            :text-color="workspace.mode === 'preview' ? 'brown-10' : 'green-10'"
          >
            {{ workspace.mode === 'preview' ? 'Unavailable' : 'Live data' }}
          </q-chip>
          <q-chip square color="brown-2" text-color="brown-10">
            {{ roleLabel }}
          </q-chip>
        </div>
      </div>

      <div class="dashboard-hero__controls">
        <q-btn-toggle
          v-model="activeView"
          spread
          no-caps
          unelevated
          toggle-color="primary"
          text-color="brown-9"
          class="dashboard-view-toggle"
          :options="viewOptions"
        />

        <q-btn
          color="primary"
          no-caps
          icon="refresh"
          label="Refresh"
          :loading="isLoading"
          @click="loadWorkspace"
        />
      </div>
    </section>

    <q-banner
      v-if="workspace.mode === 'preview'"
      rounded
      class="surface-card operations-banner bg-amber-1 text-brown-10"
    >
      Live data is unavailable. Refresh when your connection is restored.
    </q-banner>

    <q-banner
      v-if="loadError"
      rounded
      class="surface-card operations-banner bg-orange-1 text-brown-10"
    >
      {{ loadError }}
    </q-banner>

    <section class="card-grid card-grid--four">
      <q-card
        v-for="card in metricCards"
        :key="card.title"
        flat
        class="surface-card metric-card operations-metric-card"
      >
        <q-card-section>
          <div class="section-label">{{ card.label }}</div>
          <div class="section-title">{{ card.title }}</div>
          <div class="operations-metric-card__value">{{ card.value }}</div>
          <p class="text-body2 text-grey-8 q-mt-sm">{{ card.text }}</p>
        </q-card-section>
      </q-card>
    </section>

    <template v-if="activeView === 'dashboard'">
      <section class="card-grid dashboard-card-grid--feature">
        <q-card flat class="surface-card dashboard-trend-card">
          <q-btn
            v-if="$q.screen.lt.md"
            class="full-width"
            flat
            no-caps
            :label="showTrends ? 'Hide trends' : 'Explore monthly trends'"
            :aria-expanded="showTrends"
            @click="showTrends = !showTrends"
          />
          <template v-if="$q.screen.gt.sm || showTrends">
            <q-card-section>
              <div class="section-label">Trend</div>
              <div class="section-title">{{ trendTitle }}</div>
            </q-card-section>

            <q-card-section class="dashboard-trend-shell">
              <div v-if="selectedMonth" class="dashboard-trend-focus">
                <div class="dashboard-trend-focus__eyebrow">Selected month</div>

                <div class="dashboard-trend-focus__header">
                  <div>
                    <div class="dashboard-trend-focus__month">
                      {{ selectedMonth.label }}
                    </div>
                    <div class="dashboard-trend-focus__value">
                      {{ formatTrendValue(selectedMonth) }}
                    </div>
                  </div>

                  <q-chip square color="amber-2" text-color="brown-10">
                    {{ trendModeChip }}
                  </q-chip>
                </div>

                <p class="dashboard-trend-focus__summary">
                  {{ trendMeta(selectedMonth) }}
                </p>

                <div class="dashboard-trend-focus__delta">
                  {{ selectedTrendComparison }}
                </div>

                <div class="dashboard-trend-focus__stats">
                  <div
                    v-for="item in trendFocusStats"
                    :key="item.label"
                    class="dashboard-trend-focus__stat"
                  >
                    <div class="dashboard-trend-focus__stat-label">
                      {{ item.label }}
                    </div>
                    <div class="dashboard-trend-focus__stat-value">
                      {{ item.value }}
                    </div>
                  </div>
                </div>
              </div>

              <div class="dashboard-trend-list">
                <button
                  v-for="month in workspace.months"
                  :key="month.key"
                  type="button"
                  class="dashboard-trend-row"
                  :class="{
                    'dashboard-trend-row--active':
                      month.key === selectedMonthKey
                  }"
                  :aria-pressed="month.key === selectedMonthKey"
                  @click="selectedMonthKey = month.key"
                >
                  <div class="dashboard-trend-row__meta">
                    <span class="dashboard-trend-row__label">{{
                      month.label
                    }}</span>
                    <span class="dashboard-trend-row__hint">{{
                      trendMeta(month)
                    }}</span>
                  </div>

                  <div class="dashboard-trend-row__bar">
                    <span
                      class="dashboard-trend-row__fill"
                      :style="{ width: `${trendWidth(month)}%` }"
                    />
                  </div>

                  <div class="dashboard-trend-row__value">
                    {{ formatTrendValue(month) }}
                  </div>
                </button>
              </div>
            </q-card-section>
          </template>
        </q-card>

        <q-card flat class="surface-card">
          <q-card-section>
            <div class="section-label">Stock watchlist</div>
            <div class="section-title">What needs attention now</div>
          </q-card-section>

          <q-card-section
            v-if="workspace.stockSections.length > 0"
            class="dashboard-section-stack"
          >
            <div
              v-for="section in workspace.stockSections"
              :key="section.key"
              class="dashboard-subsection"
            >
              <div class="dashboard-subsection__title">{{ section.title }}</div>

              <div class="dashboard-list">
                <article
                  v-for="item in section.items"
                  :key="`${section.key}-${item.id}`"
                  class="dashboard-list__item"
                >
                  <div>
                    <div class="dashboard-list__title">{{ item.title }}</div>
                    <div class="dashboard-list__detail">{{ item.detail }}</div>
                    <div class="dashboard-list__meta">{{ item.meta }}</div>
                  </div>

                  <div class="dashboard-list__value">
                    {{ formatQuantity(item.value) }} {{ item.unit }}
                  </div>
                </article>
              </div>
            </div>
          </q-card-section>

          <q-card-section v-else>
            <div class="empty-state">
              No stock watch items are available for your current access.
            </div>
          </q-card-section>
        </q-card>
      </section>

      <section class="card-grid card-grid--two">
        <q-card flat class="surface-card">
          <q-card-section>
            <div class="section-label">Retailer watchlist</div>
            <div class="section-title">Collections and in-store stock</div>
          </q-card-section>

          <q-card-section
            v-if="workspace.retailerWatchlist.length > 0"
            class="dashboard-list"
          >
            <article
              v-for="item in workspace.retailerWatchlist"
              :key="item.id"
              class="dashboard-list__item"
            >
              <div>
                <div class="dashboard-list__title">{{ item.title }}</div>
                <div class="dashboard-list__detail">{{ item.subtitle }}</div>
                <div class="dashboard-list__meta">
                  {{ formatMoney(item.recognizedSalesValue) }} recognized /
                  {{ formatMoney(item.remittedAmount) }} remitted
                </div>
              </div>

              <div class="dashboard-status">
                <q-chip
                  square
                  :color="statusColor(item.statusTone)"
                  :text-color="statusTextColor(item.statusTone)"
                >
                  {{ item.statusLabel }}
                </q-chip>
                <div class="dashboard-status__value">
                  {{
                    item.outstandingAmount > 0
                      ? formatMoney(item.outstandingAmount)
                      : `${formatQuantity(item.remainingQuantity)} jars`
                  }}
                </div>
              </div>
            </article>
          </q-card-section>

          <q-card-section v-else>
            <div class="empty-state">
              Retailer review metrics are not available for your current access.
            </div>
          </q-card-section>
        </q-card>

        <q-card flat class="surface-card">
          <q-card-section>
            <div class="section-label">Recent activity</div>
            <div class="section-title">Latest posted work</div>
          </q-card-section>

          <q-card-section
            v-if="workspace.activityFeed.length > 0"
            class="dashboard-list"
          >
            <article
              v-for="item in workspace.activityFeed"
              :key="item.id"
              class="dashboard-list__item"
            >
              <div>
                <div class="dashboard-list__title">{{ item.title }}</div>
                <div class="dashboard-list__detail">
                  {{ item.type }} / {{ item.subtitle }}
                </div>
                <div class="dashboard-list__meta">
                  {{ formatDate(item.timestamp) }}
                </div>
              </div>

              <div class="dashboard-list__value">
                {{ formatActivityValue(item) }}
              </div>
            </article>
          </q-card-section>

          <q-card-section v-else>
            <div class="empty-state">
              No recent dashboard activity is available yet.
            </div>
          </q-card-section>
        </q-card>
      </section>
    </template>

    <BusinessReport v-else-if="activeView === 'weekly'" weekly />
    <template v-else>
      <section class="card-grid card-grid--two">
        <q-card flat class="surface-card">
          <q-card-section>
            <div class="section-label">Month picker</div>
            <div class="section-title">Choose a review window</div>
          </q-card-section>

          <q-card-section>
            <div class="dashboard-month-picker">
              <q-btn
                v-for="month in workspace.months"
                :key="month.key"
                no-caps
                unelevated
                :outline="month.key !== selectedMonthKey"
                :color="month.key === selectedMonthKey ? 'primary' : 'brown-3'"
                :text-color="
                  month.key === selectedMonthKey ? 'white' : 'brown-9'
                "
                :label="month.label"
                @click="selectedMonthKey = month.key"
              />
            </div>
          </q-card-section>
        </q-card>

        <q-card flat class="surface-card">
          <q-card-section>
            <div class="section-label">Review summary</div>
            <div class="section-title">
              {{ selectedMonth?.label ?? 'Current month' }}
            </div>
          </q-card-section>

          <q-card-section class="dashboard-review-grid">
            <div
              v-for="stat in monthlyReviewStats"
              :key="stat.label"
              class="dashboard-review-stat"
            >
              <div class="dashboard-review-stat__label">{{ stat.label }}</div>
              <div class="dashboard-review-stat__value">{{ stat.value }}</div>
              <div class="dashboard-review-stat__hint">{{ stat.hint }}</div>
            </div>
          </q-card-section>
        </q-card>
      </section>

      <section class="card-grid card-grid--two">
        <q-card flat class="surface-card">
          <q-card-section>
            <div class="section-label">Review notes</div>
            <div class="section-title">What stands out in the month</div>
          </q-card-section>

          <q-card-section class="dashboard-note-stack">
            <article
              v-for="note in monthlyNotes"
              :key="note.title"
              class="dashboard-note"
              :class="`dashboard-note--${note.tone}`"
            >
              <div class="dashboard-note__title">{{ note.title }}</div>
              <div class="dashboard-note__text">{{ note.text }}</div>
            </article>
          </q-card-section>
        </q-card>

        <q-card flat class="surface-card">
          <q-card-section>
            <div class="section-label">Month breakdown</div>
            <div class="section-title">Core review lines</div>
          </q-card-section>

          <q-card-section class="detail-list">
            <div
              v-for="row in monthlyBreakdownRows"
              :key="row.label"
              class="detail-row"
            >
              <span>{{ row.label }}</span>
              <strong>{{ row.value }}</strong>
            </div>
          </q-card-section>
        </q-card>
      </section>
      <BusinessReport :month="selectedMonthKey" />
    </template>
  </q-page>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useQuasar } from 'quasar'
import BusinessReport from '@/components/BusinessReport.vue'
const $q = useQuasar()
const showTrends = ref(false)
import { getRoleLabel } from '@/constants/roles'
import {
  fetchDashboardWorkspace,
  getPreviewDashboardWorkspace
} from '@/services/dashboard'
import { authState } from '@/services/auth'

const viewOptions = [
  {
    label: 'Dashboard',
    value: 'dashboard'
  },
  { label: 'Weekly', value: 'weekly' },
  {
    label: 'Monthly review',
    value: 'review'
  }
]

const workspace = ref(getPreviewDashboardWorkspace(authState.role))
const activeView = ref('dashboard')
const selectedMonthKey = ref(workspace.value.currentMonthKey)
const isLoading = ref(false)
const loadError = ref('')

const roleLabel = computed(() => getRoleLabel(authState.role))
const selectedMonth = computed(() => {
  const matchedMonth = workspace.value.months.find(
    month => month.key === selectedMonthKey.value
  )

  return (
    matchedMonth ??
    workspace.value.months[workspace.value.months.length - 1] ??
    null
  )
})
const previousMonth = computed(() => {
  if (!selectedMonth.value) {
    return null
  }

  const monthIndex = workspace.value.months.findIndex(
    month => month.key === selectedMonth.value.key
  )

  return monthIndex > 0 ? workspace.value.months[monthIndex - 1] : null
})

const trendMode = computed(() => {
  if (workspace.value.access.review) {
    return 'sales'
  }

  if (workspace.value.access.retail) {
    return 'issued'
  }

  if (workspace.value.access.production) {
    return 'output'
  }

  return 'purchases'
})

const trendTitle = computed(() => {
  switch (trendMode.value) {
    case 'sales':
      return 'Recognized sales trend'

    case 'issued':
      return 'Dispatch trend'

    case 'output':
      return 'Production output trend'

    default:
      return 'Material spend trend'
  }
})

const trendModeChip = computed(() => {
  switch (trendMode.value) {
    case 'sales':
      return 'Sales'

    case 'issued':
      return 'Dispatch'

    case 'output':
      return 'Output'

    default:
      return 'Spend'
  }
})

const maxTrendValue = computed(() =>
  Math.max(...workspace.value.months.map(month => getTrendValue(month)), 0)
)
const selectedTrendComparison = computed(() => {
  if (!selectedMonth.value) {
    return 'No month selected'
  }

  return compareAgainstPrevious(
    getTrendValue(selectedMonth.value),
    previousMonth.value ? getTrendValue(previousMonth.value) : null,
    trendMode.value === 'sales' || trendMode.value === 'purchases'
      ? 'currency'
      : 'quantity',
    trendMode.value === 'sales' || trendMode.value === 'purchases' ? '' : 'jars'
  )
})
const trendFocusStats = computed(() => {
  const month = selectedMonth.value

  if (!month) {
    return []
  }

  switch (trendMode.value) {
    case 'sales':
      return [
        {
          label: 'Gross profit',
          value: formatMoney(month.grossProfit)
        },
        {
          label: 'Cash received',
          value: formatMoney(month.remittedAmount)
        },
        {
          label: 'Open in stores',
          value: `${formatQuantity(month.remainingQuantity)} jars`
        }
      ]

    case 'issued':
      return [
        {
          label: 'Dispatches',
          value: formatQuantity(month.stockIssueCount)
        },
        {
          label: 'Open retail stock',
          value: `${formatQuantity(workspace.value.snapshot.openRetailQuantity)} jars`
        },
        {
          label: 'Retail value',
          value: formatMoney(workspace.value.snapshot.openRetailValue)
        }
      ]

    case 'output':
      return [
        {
          label: 'Completed batches',
          value: formatQuantity(month.batchesCompleted)
        },
        {
          label: 'Material spend',
          value: formatMoney(month.purchasesAmount)
        },
        {
          label: 'Warehouse stock',
          value: `${formatQuantity(workspace.value.snapshot.openWarehouseQuantity)} jars`
        }
      ]

    default:
      return [
        {
          label: 'Receipts posted',
          value: formatQuantity(month.purchasesCount)
        },
        {
          label: 'Open lots',
          value: formatQuantity(workspace.value.snapshot.openMaterialLots)
        },
        {
          label: 'Open lot value',
          value: formatMoney(workspace.value.snapshot.openMaterialValue)
        }
      ]
  }
})

const metricCards = computed(() => {
  const month = selectedMonth.value

  if (!month) {
    return []
  }

  if (workspace.value.access.review && workspace.value.access.expenses) {
    return [
      {
        label: 'Sales',
        title: 'Recognized sales',
        value: formatMoney(month.salesValue),
        text: compareAgainstPrevious(
          month.salesValue,
          previousMonth.value?.salesValue,
          'currency'
        )
      },
      {
        label: 'Cash',
        title: 'Cash received',
        value: formatMoney(month.remittedAmount),
        text: compareAgainstPrevious(
          month.remittedAmount,
          previousMonth.value?.remittedAmount,
          'currency'
        )
      },
      {
        label: 'Net',
        title: 'Net result',
        value: formatMoney(month.netProfit),
        text: `${formatMoney(month.expenseAmount)} in operating expenses`
      },
      {
        label: 'Outstanding',
        title: 'Collections open now',
        value: formatMoney(workspace.value.snapshot.outstandingAmount),
        text: `${workspace.value.snapshot.retailersWithOutstanding} retailers need follow-up`
      }
    ]
  }

  if (workspace.value.access.review) {
    return [
      {
        label: 'Sales',
        title: 'Recognized sales',
        value: formatMoney(month.salesValue),
        text: `${formatQuantity(month.soldQuantity)} jars sold in review`
      },
      {
        label: 'Cash',
        title: 'Cash received',
        value: formatMoney(month.remittedAmount),
        text: compareAgainstPrevious(
          month.remittedAmount,
          previousMonth.value?.remittedAmount,
          'currency'
        )
      },
      {
        label: 'Dispatch',
        title: 'Stock issued',
        value: `${formatQuantity(month.issuedQuantity)} jars`,
        text: `${formatQuantity(month.stockIssueCount)} dispatch records posted`
      },
      {
        label: 'Outstanding',
        title: 'Collections open now',
        value: formatMoney(workspace.value.snapshot.outstandingAmount),
        text: `${workspace.value.snapshot.retailersWithOutstanding} retailers still open`
      }
    ]
  }

  if (workspace.value.access.retail) {
    return [
      {
        label: 'Dispatch',
        title: 'Stock issued',
        value: `${formatQuantity(month.issuedQuantity)} jars`,
        text: compareAgainstPrevious(
          month.issuedQuantity,
          previousMonth.value?.issuedQuantity,
          'quantity',
          'jars'
        )
      },
      {
        label: 'Warehouse',
        title: 'Open finished stock',
        value: `${formatQuantity(workspace.value.snapshot.openWarehouseQuantity)} jars`,
        text: `${formatMoney(workspace.value.snapshot.openWarehouseValue)} at current batch cost`
      },
      {
        label: 'Retail',
        title: 'Stock in partner stores',
        value: `${formatQuantity(workspace.value.snapshot.openRetailQuantity)} jars`,
        text: `${formatMoney(workspace.value.snapshot.openRetailValue)} still out in market`
      },
      {
        label: 'Partners',
        title: 'Active retailers',
        value: `${formatQuantity(workspace.value.snapshot.activeRetailers)}`,
        text: `${formatQuantity(month.stockIssueCount)} dispatches posted in the month`
      }
    ]
  }

  return [
    {
      label: 'Supply',
      title: 'Material spend',
      value: formatMoney(month.purchasesAmount),
      text: `${formatQuantity(month.purchasesCount)} receipts recorded`
    },
    {
      label: 'Batches',
      title: 'Completed batches',
      value: formatQuantity(month.batchesCompleted),
      text: compareAgainstPrevious(
        month.batchesCompleted,
        previousMonth.value?.batchesCompleted,
        'quantity',
        'batches'
      )
    },
    {
      label: 'Output',
      title: 'Jars packed',
      value: `${formatQuantity(month.outputQuantity)} jars`,
      text: compareAgainstPrevious(
        month.outputQuantity,
        previousMonth.value?.outputQuantity,
        'quantity',
        'jars'
      )
    },
    {
      label: 'Lots',
      title: 'Open material lots',
      value: formatQuantity(workspace.value.snapshot.openMaterialLots),
      text: `${formatMoney(workspace.value.snapshot.openMaterialValue)} still available for production`
    }
  ]
})

const monthlyReviewStats = computed(() => {
  const month = selectedMonth.value

  if (!month) {
    return []
  }

  const stats = []

  if (workspace.value.access.supply) {
    stats.push({
      label: 'Material spend',
      value: formatMoney(month.purchasesAmount),
      hint: `${formatQuantity(month.purchasesCount)} receipts posted`
    })
  }

  if (workspace.value.access.production) {
    stats.push({
      label: 'Batches completed',
      value: formatQuantity(month.batchesCompleted),
      hint: `${formatQuantity(month.outputQuantity)} jars packed`
    })
  }

  if (workspace.value.access.retail) {
    stats.push({
      label: 'Stock issued',
      value: `${formatQuantity(month.issuedQuantity)} jars`,
      hint: `${formatQuantity(month.stockIssueCount)} dispatches recorded`
    })
  }

  if (workspace.value.access.review) {
    stats.push({
      label: 'Sales recognized',
      value: formatMoney(month.salesValue),
      hint: `${formatQuantity(month.soldQuantity)} jars sold`
    })
    stats.push({
      label: 'Cash received',
      value: formatMoney(month.remittedAmount),
      hint: `${formatMoney(Math.max(month.salesValue - month.remittedAmount, 0))} trailing sales`
    })
    stats.push({
      label: 'Returns and damage',
      value: `${formatQuantity(month.returnedQuantity + month.damagedQuantity)} jars`,
      hint: `${formatQuantity(month.returnedQuantity)} returned / ${formatQuantity(month.damagedQuantity)} damaged`
    })
  }

  if (workspace.value.access.expenses) {
    stats.push({
      label: 'Net result',
      value: formatMoney(month.netProfit),
      hint: `${formatMoney(month.expenseAmount)} operating expenses`
    })
  }

  return stats.slice(0, 6)
})

const monthlyNotes = computed(() => {
  const month = selectedMonth.value

  if (!month) {
    return []
  }

  const notes = []

  if (workspace.value.access.review) {
    const cashGap = roundCurrency(month.salesValue - month.remittedAmount)

    if (cashGap > 0) {
      notes.push({
        tone: 'warning',
        title: 'Collection gap',
        text: `${formatMoney(cashGap)} has not been remitted against the month's recognized sales.`
      })
    }

    if (month.returnedQuantity > 0 || month.damagedQuantity > 0) {
      notes.push({
        tone: 'neutral',
        title: 'Stock exceptions',
        text: `${formatQuantity(month.returnedQuantity)} jars were returned and ${formatQuantity(month.damagedQuantity)} were damaged.`
      })
    }

    if (month.remainingQuantity > 0) {
      notes.push({
        tone: 'positive',
        title: 'Retail stock still live',
        text: `${formatQuantity(month.remainingQuantity)} jars remained in stores after review.`
      })
    }
  }

  if (workspace.value.access.production) {
    notes.push({
      tone: month.batchesCompleted > 0 ? 'positive' : 'neutral',
      title: 'Production throughput',
      text:
        month.batchesCompleted > 0
          ? `${formatQuantity(month.outputQuantity)} jars were packed across ${formatQuantity(month.batchesCompleted)} completed batches.`
          : 'No completed batches were posted in this month.'
    })
  }

  if (workspace.value.access.supply) {
    notes.push({
      tone: 'neutral',
      title: 'Material intake',
      text:
        month.purchasesCount > 0
          ? `${formatMoney(month.purchasesAmount)} was recorded across ${formatQuantity(month.purchasesCount)} purchase receipts.`
          : 'No purchase receipts were recorded in this month.'
    })
  }

  if (workspace.value.access.expenses) {
    notes.push({
      tone: month.netProfit < 0 ? 'negative' : 'positive',
      title: 'Bottom line',
      text:
        month.netProfit < 0
          ? `${formatMoney(Math.abs(month.netProfit))} below break-even after expenses.`
          : `${formatMoney(month.netProfit)} above break-even after expenses.`
    })
  }

  return notes.slice(0, 4)
})

const monthlyBreakdownRows = computed(() => {
  const month = selectedMonth.value

  if (!month) {
    return []
  }

  const rows = []

  if (workspace.value.access.supply) {
    rows.push({
      label: 'Purchase spend',
      value: formatMoney(month.purchasesAmount)
    })
  }

  if (workspace.value.access.production) {
    rows.push({
      label: 'Output quantity',
      value: `${formatQuantity(month.outputQuantity)} jars`
    })
  }

  if (workspace.value.access.retail) {
    rows.push({
      label: 'Issued to retailers',
      value: `${formatQuantity(month.issuedQuantity)} jars`
    })
  }

  if (workspace.value.access.review) {
    rows.push(
      {
        label: 'Recognized sales',
        value: formatMoney(month.salesValue)
      },
      {
        label: 'Gross profit',
        value: formatMoney(month.grossProfit)
      },
      {
        label: 'Returned',
        value: `${formatQuantity(month.returnedQuantity)} jars`
      },
      {
        label: 'Damaged',
        value: `${formatQuantity(month.damagedQuantity)} jars`
      },
      {
        label: 'Cash received',
        value: formatMoney(month.remittedAmount)
      }
    )
  }

  if (workspace.value.access.expenses) {
    rows.push(
      {
        label: 'Operating expenses',
        value: formatMoney(month.expenseAmount)
      },
      {
        label: 'Net result',
        value: formatMoney(month.netProfit)
      }
    )
  }

  return rows
})

function asNumber(value) {
  const parsedValue = Number(value)

  return Number.isFinite(parsedValue) ? parsedValue : 0
}

function roundCurrency(value) {
  return Math.round(asNumber(value) * 100) / 100
}

function getTrendValue(month) {
  switch (trendMode.value) {
    case 'sales':
      return asNumber(month.salesValue)

    case 'issued':
      return asNumber(month.issuedQuantity)

    case 'output':
      return asNumber(month.outputQuantity)

    default:
      return asNumber(month.purchasesAmount)
  }
}

function trendWidth(month) {
  const maxValue = maxTrendValue.value
  const currentValue = getTrendValue(month)

  if (maxValue <= 0 || currentValue <= 0) {
    return 0
  }

  return Math.max((currentValue / maxValue) * 100, 8)
}

function formatTrendValue(month) {
  switch (trendMode.value) {
    case 'sales':
    case 'purchases':
      return formatMoney(getTrendValue(month))

    default:
      return `${formatQuantity(getTrendValue(month))} jars`
  }
}

function trendMeta(month) {
  switch (trendMode.value) {
    case 'sales':
      return `${formatQuantity(month.soldQuantity)} jars sold`

    case 'issued':
      return `${formatQuantity(month.stockIssueCount)} dispatches`

    case 'output':
      return `${formatQuantity(month.batchesCompleted)} completed batches`

    default:
      return `${formatQuantity(month.purchasesCount)} receipts`
  }
}

function compareAgainstPrevious(currentValue, previousValue, type, unit = '') {
  if (previousValue == null) {
    return 'No prior month in range'
  }

  const difference = roundCurrency(
    asNumber(currentValue) - asNumber(previousValue)
  )

  if (difference === 0) {
    return 'Flat vs last month'
  }

  const prefix = difference > 0 ? '+' : '-'
  const absoluteDifference = Math.abs(difference)

  if (type === 'currency') {
    return `${prefix}${formatMoney(absoluteDifference)} vs last month`
  }

  return `${prefix}${formatQuantity(absoluteDifference)} ${unit} vs last month`
}

function formatMoney(value) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'UGX',
    maximumFractionDigits: 0
  }).format(asNumber(value))
}

function formatQuantity(value) {
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 0
  }).format(asNumber(value))
}

function formatDate(value) {
  if (!value) {
    return 'No date'
  }

  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium'
  }).format(new Date(value))
}

function formatActivityValue(item) {
  if (item.valueType === 'currency') {
    return formatMoney(item.value)
  }

  if (item.valueType === 'quantity') {
    return `${formatQuantity(item.value)} ${item.valueUnit ?? 'units'}`
  }

  return ''
}

function statusColor(tone) {
  switch (tone) {
    case 'warning':
      return 'amber-2'

    case 'positive':
      return 'green-1'

    case 'negative':
      return 'red-1'

    default:
      return 'grey-2'
  }
}

function statusTextColor(tone) {
  switch (tone) {
    case 'warning':
      return 'brown-10'

    case 'positive':
      return 'green-10'

    case 'negative':
      return 'negative'

    default:
      return 'grey-8'
  }
}

async function loadWorkspace() {
  isLoading.value = true
  loadError.value = ''

  try {
    const nextWorkspace = await fetchDashboardWorkspace(authState.role)
    workspace.value = nextWorkspace
    selectedMonthKey.value =
      nextWorkspace.currentMonthKey ??
      nextWorkspace.months[nextWorkspace.months.length - 1]?.key ??
      null
  } catch (error) {
    workspace.value = getPreviewDashboardWorkspace(authState.role)
    selectedMonthKey.value = workspace.value.currentMonthKey
    loadError.value =
      error instanceof Error ? error.message : 'Unable to load the dashboard.'
  } finally {
    isLoading.value = false
  }
}

watch(
  () => authState.role,
  () => {
    void loadWorkspace()
  },
  { immediate: true }
)
</script>
