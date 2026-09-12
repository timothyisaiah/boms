<template>
  <q-card flat class="surface-card q-mt-lg">
    <q-card-section>
      <div class="section-label">{{
        weekly ? 'Weekly operations' : 'Monthly business review'
      }}</div>
      <h2 class="section-title">{{
        weekly
          ? 'Movement, collections and stock health'
          : 'Valuation, profitability and retailer performance'
      }}</h2>
      <q-input
        v-if="weekly"
        v-model="selectedDate"
        outlined
        type="date"
        label="Week containing"
        class="q-mt-md"
      />
      <p class="text-caption q-mt-sm"
        >{{ range.start }} to {{ lastDay }} · Uganda time{{
          isCurrentPeriod ? ' · Period to date' : ''
        }}</p
      >
      <q-linear-progress
        v-if="loading"
        indeterminate
        aria-label="Loading report"
      />
      <q-banner v-if="error" class="bg-orange-1" role="alert"
        >{{ error
        }}<template #action
          ><q-btn flat label="Retry report" @click="load" /></template
      ></q-banner>
    </q-card-section>
    <template v-if="report">
      <q-card-section v-if="!weekly && report.profit" class="detail-list">
        <div
          v-for="column in profitColumns.filter(
            c => report.profit[c.field] !== undefined
          )"
          :key="column.field"
          class="detail-row"
          ><span>{{ column.label }}</span
          ><strong>{{ money(report.profit[column.field]) }}</strong></div
        >
      </q-card-section>
      <q-expansion-item
        v-for="section in sections"
        :key="section.key"
        :label="section.label"
        :caption="section.caption"
        :default-opened="weekly && section.key === 'digest'"
        expand-separator
      >
        <q-card-section>
          <template v-if="section.key === 'digest'">
            <h3 class="text-subtitle1">Low materials</h3
            ><ReportList
              :rows="report.digest.materials"
              :columns="materialColumns"
            />
            <h3 class="text-subtitle1">Low warehouse stock</h3
            ><ReportList
              :rows="report.digest.variants"
              :columns="variantColumns"
            />
            <h3 class="text-subtitle1"
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
        </q-card-section>
      </q-expansion-item>
    </template>
  </q-card>
</template>
<script setup>
import { computed, ref, watch } from 'vue'
import { apiRequest } from '@/lib/api'
import { authState } from '@/services/auth'
import ReportList from './ReportList.vue'
const props = defineProps({ weekly: Boolean, month: String })
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
        ...([
          'admin_owner',
          'operations_manager',
          'sales_or_distribution_staff',
          'finance_accountant',
          'read_only_management'
        ].includes(authState.role)
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
        ...([
          'admin_owner',
          'operations_manager',
          'finance_accountant',
          'read_only_management'
        ].includes(authState.role)
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
