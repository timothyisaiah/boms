// Record-view columns for the operations histories. Sortable column `name`s
// are the /api/history sort keys (docs/audits/history-api.md §2); columns
// without a server key are not sortable.
import { formatDate, formatMoney, formatQuantity } from '@/lib/format'

export function purchaseLabel(purchase) {
  return purchase.purchase_reference?.trim() || `PUR-${purchase.id}`
}

const materialLine = (material, quantity) =>
  `${material?.name ?? 'Material'} / ${formatQuantity(quantity, 3)} ${
    material?.unit_of_measure ?? 'units'
  }`

export const purchaseColumns = [
  {
    name: 'purchase_reference',
    label: 'Receipt',
    field: purchaseLabel,
    align: 'left',
    sortable: true,
    mobile: 'title'
  },
  {
    name: 'supplier_name',
    label: 'Supplier',
    field: row => row.supplier?.supplier_name ?? 'Unknown supplier',
    align: 'left',
    sortable: true,
    mobile: 'subtitle'
  },
  {
    name: 'purchased_at',
    label: 'Received',
    field: 'purchased_at',
    format: value => formatDate(value),
    align: 'left',
    sortable: true
  },
  {
    name: 'items',
    label: 'Materials',
    field: row =>
      (row.items ?? [])
        .map(item => materialLine(item.material, item.quantity))
        .join(', ') || 'None',
    align: 'left',
    sortable: false
  },
  {
    name: 'total_amount',
    label: 'Total',
    field: 'total_amount',
    format: value => formatMoney(value),
    align: 'right',
    sortable: true
  }
]

export const batchColumns = [
  {
    name: 'batch_code',
    label: 'Batch code',
    field: 'batch_code',
    align: 'left',
    sortable: true,
    mobile: 'title'
  },
  {
    name: 'variant',
    label: 'Variant',
    field: row => row.variant?.variant_name ?? 'Unknown variant',
    align: 'left',
    sortable: false,
    mobile: 'subtitle'
  },
  {
    name: 'started_at',
    label: 'Batch date',
    field: 'started_at',
    format: value => formatDate(value),
    align: 'left',
    sortable: true
  },
  {
    name: 'total_output_quantity',
    label: 'Jars',
    field: 'total_output_quantity',
    align: 'right',
    sortable: true
  },
  {
    name: 'inputs',
    label: 'Inputs',
    field: row =>
      (row.inputs ?? [])
        .map(input => materialLine(input.material, input.quantity_consumed))
        .join(', ') || 'None',
    align: 'left',
    sortable: false
  },
  {
    name: 'output_unit_cost',
    label: 'Cost per jar',
    field: 'output_unit_cost',
    format: value => formatMoney(value),
    align: 'right',
    sortable: true
  }
]
