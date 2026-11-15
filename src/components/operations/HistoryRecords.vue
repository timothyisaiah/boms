<template>
  <ResponsiveRecordView
    :title="title"
    :heading-level="2"
    :rows="table.rows.value"
    :columns="columns"
    row-key="id"
    :loading="table.loading.value"
    :pagination="table.pagination.value"
    :rows-per-page-options="HISTORY_ROWS_PER_PAGE_OPTIONS"
    :empty-title="emptyTitle"
    :empty-message="emptyMessage"
    @update:pagination="value => (table.pagination.value = value)"
    @request="table.request"
  >
    <template #toolbar>
      <q-input
        v-model="table.search.value"
        class="history-records__search"
        dense
        outlined
        clearable
        type="search"
        :label="searchLabel"
      >
        <template #prepend
          ><q-icon name="search" aria-hidden="true"
        /></template>
      </q-input>
    </template>
  </ResponsiveRecordView>

  <div v-if="table.error.value" class="history-records__error" role="alert">
    <p class="history-records__error-text">
      {{
        table.loaded.value
          ? `Could not refresh ${title.toLowerCase()}. Showing the last page loaded.`
          : `Could not load ${title.toLowerCase()}.`
      }}
      {{ table.error.value.message }}
    </p>
    <q-btn
      outline
      no-caps
      color="primary"
      icon="refresh"
      label="Retry"
      @click="table.reload"
    />
  </div>
</template>

<script setup>
import ResponsiveRecordView from '@/components/ResponsiveRecordView.vue'
import { HISTORY_ROWS_PER_PAGE_OPTIONS } from '@/services/history'

defineProps({
  /** useHistoryTable() result. */
  table: { type: Object, required: true },
  title: { type: String, required: true },
  columns: { type: Array, required: true },
  searchLabel: { type: String, required: true },
  emptyTitle: { type: String, default: 'No records yet' },
  emptyMessage: { type: String, default: '' }
})
</script>

<style scoped>
.history-records__search {
  width: min(100%, 18rem);
}
.history-records__error {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--boms-space-2) var(--boms-space-3);
  margin-top: var(--boms-space-3);
  padding: var(--boms-space-3) var(--boms-space-4);
  border: 1px solid var(--boms-color-warning-border);
  border-radius: var(--boms-radius-md);
  background: var(--boms-color-warning-bg);
  color: var(--boms-color-warning-text);
}
.history-records__error-text {
  flex: 1 1 14rem;
  margin: 0;
  overflow-wrap: anywhere;
}
</style>
