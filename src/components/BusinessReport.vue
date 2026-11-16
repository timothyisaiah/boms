<template>
  <section class="surface-card business-report" :aria-labelledby="titleId">
    <header class="business-report__header">
      <h2 :id="titleId" class="section-title business-report__title">{{
        weekly ? 'Weekly operations' : 'Monthly business review'
      }}</h2>
      <p class="business-report__intro">{{
        weekly
          ? 'Movement, collections and stock health'
          : 'Valuation, profitability and retailer performance'
      }}</p>
    </header>
    <div class="business-report__controls">
      <q-input
        v-if="weekly"
        v-model="selectedDate"
        outlined
        type="date"
        label="Week containing"
        class="business-report__date"
      />
      <p class="business-report__period"
        >{{ range.start }} to {{ lastDay }} · Uganda time{{
          isCurrentPeriod ? ' · Period to date' : ''
        }}</p
      >
      <q-linear-progress
        v-if="loading"
        indeterminate
        aria-label="Loading report"
      />
      <div v-if="error" class="business-report__error" role="alert">
        <q-icon name="error_outline" size="20px" aria-hidden="true" />
        <p class="business-report__error-text">{{ error }}</p>
        <q-btn
          outline
          no-caps
          color="primary"
          icon="refresh"
          label="Retry report"
          @click="load"
        />
      </div>
    </div>
    <template v-if="report">
      <dl
        v-if="!weekly && report.profit"
        class="business-report__profit"
        aria-label="Profit for the month"
      >
        <div
          v-for="column in profitColumns.filter(
            c => report.profit[c.field] !== undefined
          )"
          :key="column.field"
          class="business-report__profit-row"
          ><dt>{{ column.label }}</dt
          ><dd class="tabular-nums">{{
            money(report.profit[column.field])
          }}</dd></div
        >
      </dl>
      <q-expansion-item
        v-for="section in sections"
        :key="section.key"
        :label="section.label"
        :caption="section.caption"
        :default-opened="weekly && section.key === 'digest'"
        expand-separator
      >
        <div class="business-report__section">
          <template v-if="section.key === 'digest'">
            <h3 class="business-report__subtitle">Low materials</h3
            ><ReportList
              :rows="report.digest.materials"
              :columns="materialColumns"
            />
            <h3 class="business-report__subtitle">Low warehouse stock</h3
            ><ReportList
              :rows="report.digest.variants"
              :columns="variantColumns"
            />
            <h3 class="business-report__subtitle"
              >Expired, expiring within 30 days, or expiry not recorded</h3
            ><p class="text-caption"
              >Includes stock held on consignment. A missing expiry needs
              review.</p
            ><ReportList
              :rows="report.digest.expiring"
              :columns="expiryColumns"
            />
          </template>
          <ReportList
            v-else
            :rows="report[section.key] ?? []"
            :columns="section.columns"
          />
        </div>
      </q-expansion-item>
    </template>
  </section>
</template>
<script setup>
import { computed, ref, useId, watch } from 'vue'
import { can } from '@/constants/capabilities'
import { apiRequest } from '@/lib/api'
import { authState } from '@/services/auth'
import ReportList from './ReportList.vue'
const props = defineProps({ weekly: Boolean, month: String })
const titleId = useId()
// api/reports.ts withholds aging/reconciliation sections outside REVIEW and
// expenses outside FINANCE; these capabilities carry the same role sets.
const canSeeReview = computed(() => can(authState.role, 'read:finance'))
const canSeeExpenses = computed(() => can(authState.role, 'route:finance'))
const selectedDate = ref(
  new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Kampala' })
)
const report = ref(null),
  loading = ref(false),
  error = ref('')
let sequence = 0
const dateString = date => date.toISOString().slice(0, 10)
const range = computed(() => {
  const start = new Date(
    `${props.weekly ? selectedDate.value : `${props.month}-01`}T00:00:00Z`
  )
  if (Number.isNaN(start.getTime())) return { start: '', end: '' }
  if (props.weekly)
    start.setUTCDate(start.getUTCDate() - ((start.getUTCDay() + 6) % 7))
  const end = new Date(start)
  if (props.weekly) end.setUTCDate(end.getUTCDate() + 7)
  else end.setUTCMonth(end.getUTCMonth() + 1)
  return { start: dateString(start), end: dateString(end) }
})
const lastDay = computed(() =>
  range.value.end
    ? dateString(new Date(Date.parse(range.value.end) - 86400000))
    : ''
)
const isCurrentPeriod = computed(
  () => range.value.end > new Date().toISOString().slice(0, 10)
)
const col = (field, label, options = {}) => ({
  name: field,
  field,
  label,
  ...options
})
const moneyCol = (field, label) => col(field, label, { money: true })
const profitColumns = [
  moneyCol('revenue', 'Recognized revenue'),
  moneyCol('cogs', 'Cost of jars sold'),
  moneyCol('gross_profit', 'Gross profit'),
  moneyCol('operating_expenses', 'Operating expenses'),
  moneyCol('net_profit', 'Net result')
]
const materialColumns = [
  col('name', 'Material'),
  col('quantity', 'On hand'),
  col('unit_of_measure', 'Unit'),
  col('low_stock_threshold', 'Threshold')
]
const variantColumns = [
  col('variant_name', 'Variant'),
  col('quantity', 'Jars available'),
  col('low_stock_threshold', 'Threshold')
]
const expiryColumns = [
  col('batch_code', 'Batch'),
  col('variant_name', 'Variant'),
  col('quantity', 'Jars owned'),
  col('expires_at', 'Expiry', { date: true })
]
const sections = computed(() =>
  props.weekly
    ? [
        {
          key: 'digest',
          label: 'Stock and expiry digest',
          caption: 'Threshold defaults to stockout until configured'
        },
        {
          key: 'movements',
          label: 'Stock movement',
          columns: [
            col('movement', 'Movement'),
            col('item', 'Item'),
            col('quantity', 'Quantity'),
            col('unit', 'Unit'),
            moneyCol('value', 'Historical cost')
          ]
        },
        ...(canSeeReview.value
          ? [
              {
                key: 'aging',
                label: 'Retailer outstanding and aging',
                caption:
                  'Cash allocated to oldest liability first; negative balances are credit',
                columns: [
                  col('retailer_name', 'Retailer'),
                  moneyCol('outstanding', 'Outstanding'),
                  moneyCol('age_0_7', '0–7 days'),
                  moneyCol('age_8_30', '8–30 days'),
                  moneyCol('age_31_60', '31–60 days'),
                  moneyCol('age_61_plus', '61+ days')
                ]
              },
              {
                key: 'reconciliations',
                label: 'Reconciliation by retailer',
                columns: [
                  col('retailer_name', 'Retailer'),
                  col('sold', 'Sold'),
                  col('returned', 'Returned'),
                  col('damaged', 'Damaged'),
                  col('expired', 'Expired'),
                  moneyCol('liability', 'Liability')
                ]
              }
            ]
          : []),
        {
          key: 'costTrend',
          label: 'Cost per jar trend',
          caption: 'Weighted actual input cost over six weeks',
          columns: [
            col('week_start', 'Week', { date: true }),
            col('variant_name', 'Variant'),
            col('jars', 'Jars produced'),
            moneyCol('cost_per_jar', 'Cost per jar')
          ]
        }
      ]
    : [
        {
          key: 'valuation',
          label: 'Inventory at month end',
          caption: 'Historical cost; finished goods include consignment',
          columns: [
            col('category', 'Inventory', {
              labels: {
                raw_honey: 'Raw honey',
                packaging: 'Packaging',
                finished_goods_including_consignment:
                  'Finished goods, including consignment'
              }
            }),
            moneyCol('value', 'Value')
          ]
        },
        {
          key: 'retailers',
          label: 'Retailer performance ranking',
          caption:
            'Ranked by revenue; payment days use remittances linked to a reconciliation',
          columns: [
            col('retailer_name', 'Retailer'),
            col('issued', 'Issued'),
            col('sold', 'Sold'),
            moneyCol('revenue', 'Revenue'),
            col('loss_return_rate', 'Return / loss %'),
            col('linked_payment_days', 'Payment days')
          ]
        },
        ...(canSeeExpenses.value
          ? [
              {
                key: 'expenses',
                label: 'Expenses by category',
                columns: [
                  col('expense_category', 'Category'),
                  moneyCol('amount', 'Amount')
                ]
              }
            ]
          : [])
      ]
)
const money = value =>
  new Intl.NumberFormat('en-UG', {
    style: 'currency',
    currency: 'UGX',
    maximumFractionDigits: 0
  }).format(Number(value))
async function load() {
  const call = ++sequence
  report.value = null
  error.value = ''
  if (!range.value.start) return
  loading.value = true
  try {
    const result = await apiRequest(
      `reports?start=${range.value.start}&end=${range.value.end}`
    )
    if (call === sequence) report.value = result
  } catch (e) {
    if (call === sequence) error.value = e.message
  } finally {
    if (call === sequence) loading.value = false
  }
}
watch(range, load, { immediate: true })
</script>
<style scoped>
.business-report {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.business-report__header,
.business-report__controls {
  padding: 0 var(--boms-space-4);
}
.business-report__header {
  padding-top: var(--boms-space-4);
}
.business-report__controls {
  display: grid;
  gap: var(--boms-space-2);
  padding-top: var(--boms-space-2);
  padding-bottom: var(--boms-space-3);
}
.business-report__title {
  margin: 0;
  color: var(--boms-color-heading);
}
.business-report__intro {
  margin: var(--boms-space-1) 0 0;
  color: var(--boms-color-text-muted);
  font-size: 0.875rem;
}
.business-report__date {
  max-width: 20rem;
}
.business-report__period {
  margin: 0;
  color: var(--boms-color-text-muted);
  font-size: 0.8125rem;
}
.business-report__error {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--boms-space-2) var(--boms-space-3);
  padding: var(--boms-space-3);
  border: 1px solid var(--boms-color-warning-border);
  border-radius: var(--boms-radius-md);
  background: var(--boms-color-warning-bg);
  color: var(--boms-color-warning-text);
}
.business-report__error-text {
  flex: 1 1 12rem;
  margin: 0;
  overflow-wrap: anywhere;
}
.business-report__profit {
  display: grid;
  margin: 0;
  padding: 0 var(--boms-space-4) var(--boms-space-3);
}
.business-report__profit-row {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: var(--boms-space-1) var(--boms-space-3);
  padding: var(--boms-space-2) 0;
  border-top: 1px solid var(--boms-color-border);
}
.business-report__profit-row dd {
  margin: 0;
  color: var(--boms-color-heading);
  font-weight: 700;
}
.business-report__subtitle {
  margin: var(--boms-space-3) 0 var(--boms-space-2);
  color: var(--boms-color-heading);
  font-size: 0.9375rem;
  font-weight: 700;
  line-height: 1.35;
}
.business-report__section {
  padding: var(--boms-space-3) var(--boms-space-4) var(--boms-space-4);
}
.business-report__subtitle:first-child {
  margin-top: 0;
}
@media (max-width: 599px) {
  .business-report__header,
  .business-report__controls,
  .business-report__profit {
    padding-left: var(--boms-space-3);
    padding-right: var(--boms-space-3);
  }
}
</style>
