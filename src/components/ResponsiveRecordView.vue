<template>
  <section class="record-view" :aria-labelledby="title ? headingId : undefined">
    <div v-if="title || $slots.toolbar" class="record-view__header">
      <component
        :is="`h${headingLevel}`"
        v-if="title"
        :id="headingId"
        class="section-title record-view__title"
        >{{ title }}</component
      >
      <div v-if="$slots.toolbar" class="record-view__toolbar">
        <slot name="toolbar" />
      </div>
    </div>

    <!-- Below md (1024px): cards. -->
    <template v-if="isCompact">
      <div v-if="loading && !cardRows.length" class="record-view__cards">
        <q-skeleton
          v-for="index in 3"
          :key="index"
          type="rect"
          height="96px"
          class="record-card record-card--skeleton"
        />
      </div>
      <slot v-else-if="!cardRows.length" name="empty">
        <EmptyState :title="emptyTitle" :message="emptyMessage" />
      </slot>
      <ul v-else class="record-view__cards" :aria-busy="loading">
        <li
          v-for="row in cardRows"
          :key="keyOf(row)"
          class="record-card"
          :data-row-key="keyOf(row)"
        >
          <component
            :is="cardTitleTag"
            v-if="titleColumn"
            class="record-card__title"
            >{{ cellValue(titleColumn, row) }}</component
          >
          <p v-if="subtitleColumn" class="record-card__subtitle">{{
            cellValue(subtitleColumn, row)
          }}</p>
          <dl v-if="metaColumns.length" class="record-card__fields">
            <div
              v-for="column in metaColumns"
              :key="column.name"
              class="record-card__field"
            >
              <dt>{{ column.label }}</dt>
              <dd>
                <slot
                  :name="`cell-${column.name}`"
                  :row="row"
                  :column="column"
                  :value="cellValue(column, row)"
                  >{{ cellValue(column, row) }}</slot
                >
              </dd>
            </div>
          </dl>
          <div v-if="$slots.actions" class="record-card__actions">
            <slot name="actions" :row="row" />
          </div>
        </li>
      </ul>
      <div v-if="pageCount > 1" class="record-view__pagination">
        <q-pagination
          :model-value="currentPage"
          :max="pageCount"
          :max-pages="5"
          boundary-links
          direction-links
          @update:model-value="goToPage"
        />
      </div>
    </template>

    <!-- md and up: table with the same columns and actions. -->
    <q-table
      v-else
      class="record-view__table"
      flat
      bordered
      wrap-cells
      :rows="rows"
      :columns="tableColumns"
      :row-key="rowKey"
      :loading="loading"
      :filter="filter"
      :pagination="pagination"
      :rows-per-page-options="rowsPerPageOptions"
      @update:pagination="value => emit('update:pagination', value)"
      @request="request => emit('request', request)"
    >
      <template v-if="$slots.actions" #body-cell-actions="props">
        <q-td :props="props" class="record-view__actions-cell">
          <slot name="actions" :row="props.row" />
        </q-td>
      </template>
      <template
        v-for="column in slottedColumns"
        :key="column.name"
        #[column.tableSlot]="props"
      >
        <q-td :props="props">
          <slot
            :name="`cell-${column.name}`"
            :row="props.row"
            :column="column"
            :value="props.value"
          />
        </q-td>
      </template>
      <template #no-data>
        <div class="record-view__no-data">
          <slot name="empty">
            <EmptyState :title="emptyTitle" :message="emptyMessage" />
          </slot>
        </div>
      </template>
    </q-table>
  </section>
</template>

<script setup>
import { computed, useId, useSlots } from 'vue'
import { useQuasar } from 'quasar'
import EmptyState from '@/components/EmptyState.vue'

const props = defineProps({
  rows: { type: Array, default: () => [] },
  /**
   * QTable columns, plus optional `mobile: 'title' | 'subtitle' | 'meta' |
   * 'hidden'` (default 'meta'). A column named 'actions' is table-only and
   * is added automatically when the `actions` slot is used.
   */
  columns: { type: Array, required: true },
  rowKey: { type: [String, Function], default: 'id' },
  loading: { type: Boolean, default: false },
  /** v-model:pagination. Set `rowsNumber` for server mode (+ @request). */
  pagination: { type: Object, default: undefined },
  filter: { type: String, default: '' },
  rowsPerPageOptions: { type: Array, default: () => [10, 25, 50, 0] },
  title: { type: String, default: '' },
  headingLevel: {
    type: Number,
    default: 2,
    validator: value => value >= 2 && value <= 5
  },
  emptyTitle: { type: String, default: 'No records yet' },
  emptyMessage: { type: String, default: '' },
  actionsLabel: { type: String, default: 'Actions' }
})
const emit = defineEmits(['update:pagination', 'request'])
const $q = useQuasar()
const slots = useSlots()
const headingId = useId()

// Same breakpoint as ReportList; v-if keeps one copy of actions in the DOM.
const isCompact = computed(() => $q.screen.lt.md)
const cardTitleTag = computed(() =>
  props.title ? `h${props.headingLevel + 1}` : 'p'
)

const keyOf = row =>
  typeof props.rowKey === 'function' ? props.rowKey(row) : row[props.rowKey]

function rawValue(column, row) {
  return typeof column.field === 'function'
    ? column.field(row)
    : row[column.field]
}
function cellValue(column, row) {
  const value = rawValue(column, row)
  return column.format ? column.format(value, row) : value
}

const dataColumns = computed(() =>
  props.columns.filter(column => column.name !== 'actions')
)
const titleColumn = computed(() =>
  dataColumns.value.find(column => column.mobile === 'title')
)
const subtitleColumn = computed(() =>
  dataColumns.value.find(column => column.mobile === 'subtitle')
)
const metaColumns = computed(() =>
  dataColumns.value.filter(column => !column.mobile || column.mobile === 'meta')
)
const slottedColumns = computed(() =>
  dataColumns.value
    .filter(column => slots[`cell-${column.name}`])
    .map(column => ({ ...column, tableSlot: `body-cell-${column.name}` }))
)
const tableColumns = computed(() => {
  const columns = props.columns.map(({ mobile: _mobile, ...column }) => column)
  if (slots.actions && !columns.some(column => column.name === 'actions'))
    columns.push({
      name: 'actions',
      label: props.actionsLabel,
      field: () => '',
      align: 'right'
    })
  return columns
})

// Cards follow the same filter/pagination contract as the table.
const isServerMode = computed(() => props.pagination?.rowsNumber !== undefined)
const filteredRows = computed(() => {
  if (isServerMode.value || !props.filter) return props.rows
  const needle = props.filter.toLowerCase()
  return props.rows.filter(row =>
    dataColumns.value.some(column =>
      String(cellValue(column, row) ?? '')
        .toLowerCase()
        .includes(needle)
    )
  )
})
const rowsPerPage = computed(() => props.pagination?.rowsPerPage ?? 0)
const currentPage = computed(() => props.pagination?.page ?? 1)
const pageCount = computed(() => {
  if (!rowsPerPage.value) return 1
  const total = isServerMode.value
    ? props.pagination.rowsNumber
    : filteredRows.value.length
  return Math.max(1, Math.ceil(total / rowsPerPage.value))
})
const cardRows = computed(() => {
  if (isServerMode.value || !rowsPerPage.value) return filteredRows.value
  const start = (currentPage.value - 1) * rowsPerPage.value
  return filteredRows.value.slice(start, start + rowsPerPage.value)
})

function goToPage(page) {
  const next = { ...props.pagination, page }
  emit('update:pagination', next)
  if (isServerMode.value)
    emit('request', {
      pagination: next,
      filter: props.filter,
      getCellValue: cellValue
    })
}
</script>

<style scoped>
.record-view {
  display: flex;
  flex-direction: column;
  gap: var(--boms-space-3);
  min-width: 0;
}
.record-view__header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--boms-space-2) var(--boms-space-4);
}
.record-view__title {
  margin: 0;
}
.record-view__toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: var(--boms-space-2);
  min-width: 0;
}
.record-view__cards {
  display: flex;
  flex-direction: column;
  gap: var(--boms-space-3);
  margin: 0;
  padding: 0;
  list-style: none;
}
.record-card {
  display: flex;
  flex-direction: column;
  gap: var(--boms-space-2);
  min-width: 0;
  padding: var(--boms-space-3) var(--boms-space-4);
  border: 1px solid var(--boms-color-border);
  border-radius: var(--boms-radius-md);
  background: var(--boms-color-surface);
}
.record-card__title {
  margin: 0;
  color: var(--boms-color-heading);
  font-size: 1rem;
  font-weight: 700;
  line-height: 1.35;
  letter-spacing: normal;
  overflow-wrap: anywhere;
}
.record-card__subtitle {
  margin: 0;
  color: var(--boms-color-text-muted);
  overflow-wrap: anywhere;
}
.record-card__fields {
  display: grid;
  gap: var(--boms-space-1);
  margin: 0;
}
.record-card__field {
  display: flex;
  justify-content: space-between;
  gap: var(--boms-space-3);
}
.record-card__field dt {
  color: var(--boms-color-text-muted);
}
.record-card__field dd {
  margin: 0;
  font-weight: 700;
  text-align: right;
  font-variant-numeric: tabular-nums;
  overflow-wrap: anywhere;
}
.record-card__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--boms-space-2);
  padding-top: var(--boms-space-1);
}
.record-view__pagination {
  display: flex;
  justify-content: center;
}
.record-view__table {
  border-radius: var(--boms-radius-md);
  font-variant-numeric: tabular-nums;
}
.record-view__actions-cell {
  white-space: nowrap;
}
.record-view__no-data {
  width: 100%;
}
</style>
