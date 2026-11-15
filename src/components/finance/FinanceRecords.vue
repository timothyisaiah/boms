<template>
  <div class="finance-records">
    <div
      v-for="table in tables"
      :key="table.resource"
      class="finance-records__table"
    >
      <ResponsiveRecordView
        v-model:pagination="table.state.pagination.value"
        :title="table.title"
        :heading-level="2"
        :rows="table.state.rows.value"
        :columns="table.columns"
        row-key="id"
        :loading="table.state.loading.value"
        :rows-per-page-options="rowsPerPageOptions"
        :empty-title="table.emptyTitle"
        :empty-message="table.emptyMessage"
        :data-history="table.resource"
        @request="table.state.onRequest"
      >
        <template #toolbar>
          <q-input
            v-model="table.state.search.value"
            :for="`finance-search-${table.resource}`"
            dense
            outlined
            clearable
            type="search"
            :debounce="300"
            :label="`Search ${table.noun}`"
            class="finance-records__search"
          >
            <template #prepend>
              <q-icon name="search" aria-hidden="true" />
            </template>
          </q-input>
        </template>

        <template
          v-if="table.resource === 'reconciliations'"
          #cell-lines="{ row }"
        >
          <ul v-if="row.items?.length" class="finance-records__lines">
            <li v-for="item in row.items" :key="item.id">
              {{ item.variant?.sku ?? 'Variant' }} /
              {{ item.batch?.batch_code ?? 'Batch' }} / sold
              {{ formatQuantity(item.quantity_sold) }} / left
              {{ formatQuantity(item.quantity_remaining) }}
            </li>
          </ul>
          <span v-else>None</span>
        </template>
      </ResponsiveRecordView>

      <p
        v-if="table.state.error.value"
        class="finance-records__error"
        role="alert"
      >
        {{ table.title }}: {{ table.state.error.value }}
        <q-btn
          flat
          dense
          no-caps
          color="primary"
          icon="refresh"
          label="Retry"
          @click="table.state.refresh"
        />
      </p>
    </div>
  </div>
</template>

<script setup>
import { onActivated, onMounted, watch } from 'vue'
import ResponsiveRecordView from '@/components/ResponsiveRecordView.vue'
import { HISTORY_ROWS_PER_PAGE_OPTIONS } from '@/services/history'
import { formatDateTime, formatMoney, formatQuantity } from '@/lib/format'
import {
  reconciliationLabel,
  remittanceLabel
} from '@/components/finance/financeDomain'
import { useHistoryTable } from '@/components/finance/useHistoryTable'

const props = defineProps({
  /** Incremented by the page after a confirmed write. */
  refreshKey: { type: Number, default: 0 }
})

const rowsPerPageOptions = [...HISTORY_ROWS_PER_PAGE_OPTIONS]

// Column `name`s of sortable columns are /api/history sort keys
// (docs/audits/history-api.md §2); other columns are not sortable.
const tables = [
  {
    resource: 'reconciliations',
    title: 'Reconciliations',
    noun: 'reconciliations',
    emptyTitle: 'No reconciliations yet',
    emptyMessage:
      'Reconciliation history appears here after retailer stock is counted and posted.',
    state: useHistoryTable('reconciliations'),
    columns: [
      {
        name: 'reconciliation_reference',
        label: 'Reference',
        field: row => reconciliationLabel(row),
        mobile: 'title',
        align: 'left',
        sortable: true
      },
      {
        name: 'retailer_name',
        label: 'Retailer',
        field: row => row.retailer?.retailer_name ?? 'Retailer',
        mobile: 'subtitle',
        align: 'left',
        sortable: true
      },
      {
        name: 'reconciled_at',
        label: 'Reconciled',
        field: 'reconciled_at',
        format: value => formatDateTime(value),
        align: 'left',
        sortable: true
      },
      {
        name: 'total_sold_quantity',
        label: 'Sold',
        field: 'total_sold_quantity',
        format: value => formatQuantity(value),
        align: 'right',
        sortable: true
      },
      {
        name: 'total_returned_quantity',
        label: 'Returned',
        field: 'total_returned_quantity',
        format: value => formatQuantity(value),
        align: 'right'
      },
      {
        name: 'total_damaged_quantity',
        label: 'Damaged',
        field: 'total_damaged_quantity',
        format: value => formatQuantity(value),
        align: 'right'
      },
      {
        name: 'total_remaining_quantity',
        label: 'Remaining',
        field: 'total_remaining_quantity',
        format: value => formatQuantity(value),
        align: 'right'
      },
      {
        name: 'total_sales_value',
        label: 'Sales value',
        field: 'total_sales_value',
        format: value => formatMoney(value),
        align: 'right',
        sortable: true
      },
      {
        name: 'lines',
        label: 'Lines',
        field: row => row.items?.length ?? 0,
        align: 'left'
      }
    ]
  },
  {
    resource: 'remittances',
    title: 'Remittances',
    noun: 'remittances',
    emptyTitle: 'No remittances yet',
    emptyMessage:
      'Remittance records appear here after the first retailer payment is posted.',
    state: useHistoryTable('remittances'),
    columns: [
      {
        name: 'remittance_reference',
        label: 'Reference',
        field: row => remittanceLabel(row),
        mobile: 'title',
        align: 'left',
        sortable: true
      },
      {
        name: 'retailer_name',
        label: 'Retailer',
        field: row => row.retailer?.retailer_name ?? 'Retailer',
        mobile: 'subtitle',
        align: 'left',
        sortable: true
      },
      {
        name: 'received_at',
        label: 'Received',
        field: 'received_at',
        format: value => formatDateTime(value),
        align: 'left',
        sortable: true
      },
      {
        name: 'amount',
        label: 'Amount',
        field: 'amount',
        format: value => formatMoney(value),
        align: 'right',
        sortable: true
      },
      {
        name: 'reconciliation',
        label: 'Linked reconciliation',
        field: row =>
          row.reconciliation?.reconciliation_reference || 'Not linked',
        align: 'left'
      }
    ]
  },
  {
    resource: 'expenses',
    title: 'Expenses',
    noun: 'expenses',
    emptyTitle: 'No expenses yet',
    emptyMessage:
      'Expense records appear here after the first operating cost is entered.',
    state: useHistoryTable('expenses'),
    columns: [
      {
        name: 'expense_category',
        label: 'Category',
        field: 'expense_category',
        mobile: 'title',
        align: 'left',
        sortable: true
      },
      {
        name: 'vendor_name',
        label: 'Vendor',
        field: 'vendor_name',
        format: value => value || 'Vendor not specified',
        mobile: 'subtitle',
        align: 'left',
        sortable: true
      },
      {
        name: 'incurred_at',
        label: 'Incurred',
        field: 'incurred_at',
        format: value => formatDateTime(value),
        align: 'left',
        sortable: true
      },
      {
        name: 'amount',
        label: 'Amount',
        field: 'amount',
        format: value => formatMoney(value),
        align: 'right',
        sortable: true
      },
      {
        name: 'expense_reference',
        label: 'Reference',
        field: 'expense_reference',
        format: value => value || 'None',
        align: 'left',
        sortable: true
      }
    ]
  }
]

function refreshAll() {
  for (const table of tables) void table.state.refresh()
}

// Inside the page's keep-alive panels `activated` also fires on first mount;
// load once on mount and again each time the view is reopened.
let mounted = false
onMounted(() => {
  mounted = true
  refreshAll()
})
let firstActivation = true
onActivated(() => {
  if (firstActivation) {
    firstActivation = false
    if (mounted) return
  }
  refreshAll()
})

watch(
  () => props.refreshKey,
  () => refreshAll()
)
</script>

<style scoped>
.finance-records {
  display: flex;
  flex-direction: column;
  gap: var(--boms-space-8);
  min-width: 0;
}
.finance-records__table {
  display: flex;
  flex-direction: column;
  gap: var(--boms-space-3);
  min-width: 0;
}
.finance-records__search {
  width: min(100%, 18rem);
}
.finance-records__search :deep(.q-icon) {
  overflow: hidden;
}
.finance-records__lines {
  margin: 0;
  padding-left: 1rem;
  text-align: left;
}
.finance-records__error {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--boms-space-2);
  margin: 0;
  padding: var(--boms-space-3) var(--boms-space-4);
  border: 1px solid var(--boms-color-warning-border);
  border-radius: var(--boms-radius-md);
  background: var(--boms-color-warning-bg);
  color: var(--boms-color-warning-text);
}
</style>
