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
    title="Movement history"
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
        label="Search movements"
        hint="Retailer, SKU, batch or type"
        @clear="search = ''"
      >
        <template #prepend>
          <q-icon name="search" aria-hidden="true" />
        </template>
      </q-input>
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
        icon="swap_horiz"
        :title="search ? 'No matching movements' : 'No movements yet'"
        :message="
          search
            ? 'Try another retailer, SKU, batch or movement type.'
            : 'Retail movement history will start once warehouse stock is issued to a partner.'
        "
      />
    </template>
  </ResponsiveRecordView>
</template>

<script setup>
import EmptyState from '@/components/EmptyState.vue'
import ResponsiveRecordView from '@/components/ResponsiveRecordView.vue'
import {
  formatDate,
  formatMoney,
  formatMovementType,
  formatSignedQuantity
} from '@/lib/format'
import { HISTORY_ROWS_PER_PAGE_OPTIONS } from '@/services/history'
import { useRetailHistory } from './useRetailHistory'

// Column `name`s are /api/history sort keys for `retailerMovements`.
const columns = [
  {
    name: 'retailer_name',
    label: 'Retailer',
    field: row => row.retailer?.retailer_name ?? 'Retailer',
    align: 'left',
    sortable: true,
    mobile: 'title'
  },
  {
    name: 'movement_type',
    label: 'Movement',
    field: 'movement_type',
    format: value => formatMovementType(value),
    align: 'left',
    sortable: true,
    mobile: 'subtitle'
  },
  {
    name: 'sku',
    label: 'Variant / batch',
    field: row =>
      `${row.variant?.sku ?? 'Variant'} / ${row.batch?.batch_code ?? 'Batch'}`,
    align: 'left',
    sortable: true
  },
  {
    name: 'quantity_delta',
    label: 'Jars',
    field: 'quantity_delta',
    format: value => `${formatSignedQuantity(value)} jars`,
    align: 'right',
    sortable: true
  },
  {
    name: 'unit_cost',
    label: 'Cost per jar',
    field: 'unit_cost',
    format: value => formatMoney(value),
    align: 'right',
    sortable: true
  },
  {
    name: 'moved_at',
    label: 'Date',
    field: 'moved_at',
    format: value => formatDate(value),
    align: 'left',
    sortable: true
  }
]

const { rows, loading, error, search, pagination, onRequest, refresh } =
  useRetailHistory('retailerMovements')

defineExpose({ refresh })
</script>

<style scoped>
.retail-records__search {
  width: min(100%, 20rem);
}
.retail-records__search :deep(.q-icon) {
  overflow: hidden;
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
