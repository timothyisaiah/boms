<template>
  <div v-if="error && rows.length" class="retail-records__error" role="alert">
    <span>{{ error }} Showing the last records loaded.</span>
    <q-btn
      outline
      no-caps
      color="primary"
      icon="refresh"
      label="Retry"
      @click="refresh"
    />
  </div>
  <ResponsiveRecordView
    v-model:pagination="pagination"
    class="retail-records"
    title="Dispatch records"
    :rows="rows"
    :columns="columns"
    row-key="id"
    :loading="loading"
    :rows-per-page-options="HISTORY_ROWS_PER_PAGE_OPTIONS"
    @request="onRequest"
  >
    <template #toolbar>
      <q-input
        v-model="search"
        class="retail-records__search"
        outlined
        dense
        clearable
        type="search"
        label="Search dispatches"
        hint="Reference, retailer or notes"
        @clear="search = ''"
      >
        <template #prepend>
          <q-icon name="search" aria-hidden="true" />
        </template>
      </q-input>
    </template>

    <template #cell-items="{ row }">
      <ul v-if="(row.items ?? []).length" class="retail-records__lines">
        <li v-for="item in row.items" :key="item.id">
          {{ item.variant?.sku ?? 'Variant' }} /
          {{ item.batch?.batch_code ?? 'Batch' }} /
          {{ formatQuantity(item.quantity_issued) }} jars
        </li>
      </ul>
      <span v-else class="retail-records__muted">No line detail</span>
    </template>

    <template #empty>
      <div v-if="error" class="retail-records__error" role="alert">
        <span>{{ error }}</span>
        <q-btn
          outline
          no-caps
          color="primary"
          icon="refresh"
          label="Retry"
          @click="refresh"
        />
      </div>
      <EmptyState
        v-else
        icon="local_shipping"
        :title="search ? 'No matching dispatches' : 'No dispatches yet'"
        :message="
          search
            ? 'Try another reference, retailer or note.'
            : 'Dispatch records will appear here after the first retailer issue is saved.'
        "
      />
    </template>
  </ResponsiveRecordView>
</template>

<script setup>
import EmptyState from '@/components/EmptyState.vue'
import ResponsiveRecordView from '@/components/ResponsiveRecordView.vue'
import { formatDate, formatMoney, formatQuantity } from '@/lib/format'
import { HISTORY_ROWS_PER_PAGE_OPTIONS } from '@/services/history'
import { issueDocumentLabel } from '@/services/retail'
import { useRetailHistory } from './useRetailHistory'

// Column `name`s are /api/history sort keys for `stockIssues`; columns
// without a server sort key are not sortable.
const columns = [
  {
    name: 'issue_reference',
    label: 'Dispatch',
    field: row => issueDocumentLabel(row),
    align: 'left',
    sortable: true,
    mobile: 'title'
  },
  {
    name: 'retailer_name',
    label: 'Retailer',
    field: row => row.retailer?.retailer_name ?? 'Retailer',
    align: 'left',
    sortable: true,
    mobile: 'subtitle'
  },
  {
    name: 'issued_at',
    label: 'Issued',
    field: 'issued_at',
    format: value => formatDate(value),
    align: 'left',
    sortable: true
  },
  {
    name: 'total_quantity',
    label: 'Jars',
    field: 'total_quantity',
    format: value => `${formatQuantity(value)} jars`,
    align: 'right',
    sortable: true
  },
  {
    name: 'total_cost',
    label: 'Stock value',
    field: 'total_cost',
    format: value => formatMoney(value),
    align: 'right',
    sortable: true
  },
  {
    name: 'items',
    label: 'Lines',
    field: row => row.items ?? [],
    format: items => `${items.length}`,
    align: 'left',
    sortable: false
  }
]

const { rows, loading, error, search, pagination, onRequest, refresh } =
  useRetailHistory('stockIssues')

defineExpose({ refresh })
</script>

<style scoped>
.retail-records__search {
  width: min(100%, 20rem);
}
.retail-records__search :deep(.q-icon) {
  overflow: hidden;
}
.retail-records__lines {
  margin: 0;
  padding: 0;
  list-style: none;
  font-weight: 400;
}
.retail-records__muted {
  color: var(--boms-color-text-muted);
  font-weight: 400;
}
.retail-records__error {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--boms-space-2);
  padding: var(--boms-space-3);
  border: 1px solid var(--boms-color-warning-border);
  border-radius: var(--boms-radius-md);
  background: var(--boms-color-warning-bg);
  color: var(--boms-color-warning-text);
}
</style>
