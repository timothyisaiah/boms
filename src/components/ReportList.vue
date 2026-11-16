<template>
  <p v-if="!rows.length" class="empty-state report-empty">
    No records for this period.
  </p>
  <!-- Phones and tablets: one card per row, fields as a description list. -->
  <ul v-else-if="$q.screen.lt.md" class="report-cards" role="list">
    <li v-for="(row, index) in rows" :key="index" class="report-row">
      <dl class="report-row__fields">
        <div
          v-for="column in columns"
          :key="column.name"
          class="report-row__field"
        >
          <dt>{{ column.label }}</dt>
          <dd>{{ display(row[column.field], column) }}</dd>
        </div>
      </dl>
    </li>
  </ul>
  <!-- 1024px and wider: sortable, paginated table for comparison. -->
  <q-table
    v-else
    flat
    bordered
    wrap-cells
    class="report-table"
    :rows="tableRows"
    :columns="tableColumns"
    :rows-per-page-options="[10, 25, 50]"
    row-key="__reportKey"
  />
</template>
<script setup>
import { computed } from 'vue'
import { useQuasar } from 'quasar'
const $q = useQuasar()
const props = defineProps({
  rows: { type: Array, default: () => [] },
  columns: { type: Array, required: true }
})
// en-UG output ("USh 50,000", "10 Sept 2026") differs from src/lib/format.js
// (en-US), so these stay local; see docs/audits/components.md.
function display(value, column) {
  if (value === null || value === undefined) return 'Not recorded'
  if (column.labels) return column.labels[value] ?? value
  if (column.money)
    return new Intl.NumberFormat('en-UG', {
      style: 'currency',
      currency: 'UGX',
      maximumFractionDigits: 0
    }).format(Number(value))
  if (column.date)
    return new Intl.DateTimeFormat('en-UG', { dateStyle: 'medium' }).format(
      new Date(value)
    )
  return value
}
const tableColumns = computed(() =>
  props.columns.map(column => ({
    ...column,
    align: 'left',
    sortable: true,
    format: value => display(value, column)
  }))
)
const tableRows = computed(() =>
  props.rows.map((row, index) => ({ ...row, __reportKey: index }))
)
</script>

<style scoped>
.report-empty {
  margin: 0;
}
.report-cards {
  display: grid;
  gap: var(--boms-space-2);
  margin: 0;
  padding: 0;
  list-style: none;
}
.report-row {
  min-width: 0;
  padding: var(--boms-space-3);
  border: 1px solid var(--boms-color-border);
  border-radius: var(--boms-radius-md);
  background: var(--boms-color-surface);
}
.report-row__fields {
  display: grid;
  gap: var(--boms-space-1);
  margin: 0;
}
.report-row__field {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 0 var(--boms-space-3);
  min-width: 0;
}
.report-row__field dt {
  color: var(--boms-color-text-muted);
}
.report-row__field dd {
  margin: 0 0 0 auto;
  color: var(--boms-color-heading);
  font-weight: 700;
  text-align: right;
  overflow-wrap: anywhere;
}
.report-table {
  border-radius: var(--boms-radius-md);
}
@media (min-width: 600px) {
  .report-cards {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
