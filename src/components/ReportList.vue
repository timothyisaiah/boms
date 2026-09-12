<template>
  <div v-if="!rows.length" class="empty-state">No records for this period.</div>
  <div v-else-if="$q.screen.lt.md" class="report-cards">
    <article v-for="(row, index) in rows" :key="index" class="report-row">
      <div
        v-for="column in columns"
        :key="column.name"
        class="report-row__field"
      >
        <span>{{ column.label }}</span
        ><strong>{{ display(row[column.field], column) }}</strong>
      </div>
    </article>
  </div>
  <q-table
    v-else
    flat
    wrap-cells
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
