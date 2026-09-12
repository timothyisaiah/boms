import { hasAllowedRole } from '@/constants/roles'
import { apiRequest } from '@/lib/api'

const SUPPLY_ROLES = [
  'admin_owner',
  'operations_manager',
  'production_staff',
  'warehouse_staff',
  'finance_accountant',
  'read_only_management'
]

const PRODUCTION_ROLES = [
  'admin_owner',
  'operations_manager',
  'production_staff',
  'warehouse_staff',
  'sales_or_distribution_staff',
  'finance_accountant',
  'read_only_management'
]

const RETAIL_ROLES = [
  'admin_owner',
  'operations_manager',
  'warehouse_staff',
  'sales_or_distribution_staff',
  'finance_accountant',
  'read_only_management'
]

const REVIEW_ROLES = [
  'admin_owner',
  'operations_manager',
  'sales_or_distribution_staff',
  'finance_accountant',
  'read_only_management'
]

const EXPENSE_ROLES = [
  'admin_owner',
  'operations_manager',
  'finance_accountant',
  'read_only_management'
]

const MONTH_LABEL_FORMATTER = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC'
})

const MONTH_SHORT_FORMATTER = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  timeZone: 'UTC'
})

function asNumber(value) {
  const parsedValue = Number(value)

  return Number.isFinite(parsedValue) ? parsedValue : 0
}

function roundCurrency(value) {
  return Math.round(asNumber(value) * 100) / 100
}

function startOfMonth(date) {
  return new Date(`${toMonthKey(date)}-01T00:00:00Z`)
}

function shiftMonth(date, offset) {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + offset, 1)
  )
}

function toMonthKey(value) {
  if (!value) {
    return null
  }

  const date = value instanceof Date ? value : new Date(value)

  if (Number.isNaN(date.getTime())) {
    return null
  }

  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Kampala',
    year: 'numeric',
    month: '2-digit'
  }).formatToParts(date)
  return `${parts.find(part => part.type === 'year').value}-${parts.find(part => part.type === 'month').value}`
}

function buildMonthTimeline(count = 6, referenceDate = new Date()) {
  const currentMonthStart = startOfMonth(referenceDate)
  const timeline = []

  for (let offset = count - 1; offset >= 0; offset -= 1) {
    const date = shiftMonth(currentMonthStart, -offset)

    timeline.push({
      key: toMonthKey(date),
      label: MONTH_LABEL_FORMATTER.format(date),
      shortLabel: MONTH_SHORT_FORMATTER.format(date)
    })
  }

  return timeline
}

function createMonthSummary(month) {
  return {
    key: month.key,
    label: month.label,
    shortLabel: month.shortLabel,
    purchasesAmount: 0,
    purchasesCount: 0,
    batchesCompleted: 0,
    outputQuantity: 0,
    stockIssueCount: 0,
    issuedQuantity: 0,
    salesValue: 0,
    cogsValue: 0,
    grossProfit: 0,
    remittedAmount: 0,
    expenseAmount: 0,
    netProfit: null,
    soldQuantity: 0,
    returnedQuantity: 0,
    damagedQuantity: 0,
    remainingQuantity: 0
  }
}

function getDashboardAccess(role) {
  return {
    supply: hasAllowedRole(role, SUPPLY_ROLES),
    production: hasAllowedRole(role, PRODUCTION_ROLES),
    retail: hasAllowedRole(role, RETAIL_ROLES),
    review: hasAllowedRole(role, REVIEW_ROLES),
    expenses: hasAllowedRole(role, EXPENSE_ROLES),
    admin: hasAllowedRole(role, ['admin_owner'])
  }
}

function createRetailerState(balance) {
  if (asNumber(balance.outstanding_amount) > 0) {
    return {
      label: 'Collect',
      tone: 'warning'
    }
  }

  if (asNumber(balance.remaining_quantity) > 0) {
    return {
      label: 'In store',
      tone: 'positive'
    }
  }

  return {
    label: 'Settled',
    tone: 'neutral'
  }
}

function mapRetailerWatchlist(balance) {
  const state = createRetailerState(balance)

  return {
    id: balance.retailer_id,
    title: balance.retailer_name,
    subtitle: balance.delivery_location || 'Retail partner',
    statusLabel: state.label,
    statusTone: state.tone,
    outstandingAmount: asNumber(balance.outstanding_amount),
    remainingQuantity: asNumber(balance.remaining_quantity),
    remittedAmount: asNumber(balance.remitted_amount),
    recognizedSalesValue: asNumber(balance.recognized_sales_value)
  }
}

function buildStockSections({
  access,
  inventoryLots,
  productionOutputs,
  openIssueLines
}) {
  const sections = []

  if (access.supply && inventoryLots.length > 0) {
    sections.push({
      key: 'materials',
      title: 'Material lots',
      items: inventoryLots
        .slice()
        .sort(
          (left, right) =>
            new Date(left.received_at) - new Date(right.received_at)
        )
        .slice(0, 4)
        .map(lot => ({
          id: lot.id,
          title: lot.lot_code,
          detail: lot.material?.name ?? 'Material lot',
          meta: `${lot.supplier?.supplier_name ?? 'Supplier'} • ${MONTH_LABEL_FORMATTER.format(new Date(lot.received_at))}`,
          value: asNumber(lot.quantity_remaining),
          unit: lot.material?.unit_of_measure ?? 'units'
        }))
    })
  }

  if (access.production && productionOutputs.length > 0) {
    sections.push({
      key: 'warehouse',
      title: 'Warehouse stock',
      items: productionOutputs
        .slice()
        .sort(
          (left, right) =>
            asNumber(right.quantity_remaining) -
            asNumber(left.quantity_remaining)
        )
        .slice(0, 4)
        .map(output => ({
          id: output.id,
          title: output.batch?.batch_code ?? `Batch ${output.id}`,
          detail: output.variant?.variant_name ?? 'Finished stock',
          meta: `${output.variant?.sku ?? 'No SKU'} • ${roundCurrency(output.unit_cost).toLocaleString('en-US')} UGX each`,
          value: asNumber(output.quantity_remaining),
          unit: 'jars'
        }))
    })
  }

  if (access.review && openIssueLines.length > 0) {
    sections.push({
      key: 'retail',
      title: 'Retail stock',
      items: openIssueLines
        .slice()
        .sort(
          (left, right) =>
            asNumber(right.open_stock_value) - asNumber(left.open_stock_value)
        )
        .slice(0, 4)
        .map(line => ({
          id: line.stock_issue_item_id,
          title: line.retailer_name,
          detail: `${line.variant_name ?? line.sku ?? 'Issued stock'} • ${line.batch_code ?? 'Batch'}`,
          meta: `${line.issue_reference ?? 'Issue'} • ${roundCurrency(line.open_stock_value).toLocaleString('en-US')} UGX open`,
          value: asNumber(line.quantity_open),
          unit: 'jars'
        }))
    })
  }

  return sections
}

function buildActivityFeed({
  purchases,
  batches,
  stockIssues,
  reconciliations,
  remittances,
  expenses
}) {
  return [
    ...purchases.map(purchase => ({
      id: `purchase-${purchase.id}`,
      type: 'Purchase',
      title: purchase.purchase_reference?.trim() || `Purchase ${purchase.id}`,
      subtitle: purchase.supplier?.supplier_name ?? 'Supplier',
      timestamp: purchase.purchased_at,
      value: asNumber(purchase.total_amount),
      valueType: 'currency'
    })),
    ...batches.map(batch => ({
      id: `batch-${batch.id}`,
      type: 'Batch',
      title: batch.batch_code,
      subtitle: batch.variant?.variant_name ?? 'Production batch',
      timestamp: batch.started_at,
      value: asNumber(batch.total_output_quantity),
      valueType: 'quantity',
      valueUnit: 'jars'
    })),
    ...stockIssues.map(issue => ({
      id: `issue-${issue.id}`,
      type: 'Issue',
      title: issue.issue_reference?.trim() || `Issue ${issue.id}`,
      subtitle: issue.retailer?.retailer_name ?? 'Retail partner',
      timestamp: issue.issued_at,
      value: asNumber(issue.total_quantity),
      valueType: 'quantity',
      valueUnit: 'jars'
    })),
    ...reconciliations.map(reconciliation => ({
      id: `reconciliation-${reconciliation.id}`,
      type: 'Review',
      title:
        reconciliation.reconciliation_reference?.trim() ||
        `Review ${reconciliation.id}`,
      subtitle: reconciliation.retailer?.retailer_name ?? 'Retail partner',
      timestamp: reconciliation.reconciled_at,
      value: asNumber(reconciliation.total_sales_value),
      valueType: 'currency'
    })),
    ...remittances.map(remittance => ({
      id: `remittance-${remittance.id}`,
      type: 'Cash',
      title:
        remittance.remittance_reference?.trim() ||
        `Remittance ${remittance.id}`,
      subtitle: remittance.retailer?.retailer_name ?? 'Retail partner',
      timestamp: remittance.received_at,
      value: asNumber(remittance.amount),
      valueType: 'currency'
    })),
    ...expenses.map(expense => ({
      id: `expense-${expense.id}`,
      type: 'Expense',
      title: expense.expense_category,
      subtitle: expense.vendor_name?.trim() || 'Operating expense',
      timestamp: expense.incurred_at,
      value: asNumber(expense.amount),
      valueType: 'currency'
    }))
  ]
    .sort((left, right) => new Date(right.timestamp) - new Date(left.timestamp))
    .slice(0, 8)
}

function buildLiveWorkspace({
  access,
  months,
  purchases,
  inventoryLots,
  batches,
  productionOutputs,
  stockIssues,
  retailers,
  reconciliations,
  remittances,
  retailerBalances,
  openIssueLines,
  expenses
}) {
  const monthSummaries = months.map(createMonthSummary)
  const monthMap = Object.fromEntries(
    monthSummaries.map(summary => [summary.key, summary])
  )

  purchases.forEach(purchase => {
    if (purchase.status !== 'received') {
      return
    }

    const month = monthMap[toMonthKey(purchase.purchased_at)]

    if (!month) {
      return
    }

    month.purchasesAmount += asNumber(purchase.total_amount)
    month.purchasesCount += 1
  })

  batches.forEach(batch => {
    if (batch.status !== 'completed') {
      return
    }

    const month = monthMap[toMonthKey(batch.started_at)]

    if (!month) {
      return
    }

    month.batchesCompleted += 1
    month.outputQuantity += asNumber(batch.total_output_quantity)
  })

  stockIssues.forEach(issue => {
    if (issue.status !== 'issued') {
      return
    }

    const month = monthMap[toMonthKey(issue.issued_at)]

    if (!month) {
      return
    }

    month.stockIssueCount += 1
    month.issuedQuantity += asNumber(issue.total_quantity)
  })

  reconciliations.forEach(reconciliation => {
    const month = monthMap[toMonthKey(reconciliation.reconciled_at)]

    if (!month) {
      return
    }

    month.soldQuantity += asNumber(reconciliation.total_sold_quantity)
    month.returnedQuantity += asNumber(reconciliation.total_returned_quantity)
    month.damagedQuantity += asNumber(reconciliation.total_damaged_quantity)
    month.remainingQuantity += asNumber(reconciliation.total_remaining_quantity)
    month.salesValue += asNumber(reconciliation.total_sales_value)
    month.cogsValue += asNumber(reconciliation.total_cogs_value)
  })

  remittances.forEach(remittance => {
    const month = monthMap[toMonthKey(remittance.received_at)]

    if (!month) {
      return
    }

    month.remittedAmount += asNumber(remittance.amount)
  })

  expenses.forEach(expense => {
    const month = monthMap[toMonthKey(expense.incurred_at)]

    if (!month) {
      return
    }

    month.expenseAmount += asNumber(expense.amount)
  })

  monthSummaries.forEach(month => {
    month.purchasesAmount = roundCurrency(month.purchasesAmount)
    month.salesValue = roundCurrency(month.salesValue)
    month.cogsValue = roundCurrency(month.cogsValue)
    month.grossProfit = roundCurrency(month.salesValue - month.cogsValue)
    month.expenseAmount = roundCurrency(month.expenseAmount)
    month.remittedAmount = roundCurrency(month.remittedAmount)
    month.netProfit = access.expenses
      ? roundCurrency(month.grossProfit - month.expenseAmount)
      : null
  })

  const snapshot = {
    activeRetailers: retailers.length,
    openMaterialLots: inventoryLots.length,
    openMaterialValue: roundCurrency(
      inventoryLots.reduce(
        (total, lot) =>
          total + asNumber(lot.quantity_remaining) * asNumber(lot.unit_cost),
        0
      )
    ),
    openWarehouseQuantity: productionOutputs.reduce(
      (total, output) => total + asNumber(output.quantity_remaining),
      0
    ),
    openWarehouseValue: roundCurrency(
      productionOutputs.reduce(
        (total, output) =>
          total +
          asNumber(output.quantity_remaining) * asNumber(output.unit_cost),
        0
      )
    ),
    openRetailQuantity: openIssueLines.reduce(
      (total, line) => total + asNumber(line.quantity_open),
      0
    ),
    openRetailValue: roundCurrency(
      openIssueLines.reduce(
        (total, line) => total + asNumber(line.open_stock_value),
        0
      )
    ),
    outstandingAmount: roundCurrency(
      retailerBalances.reduce(
        (total, balance) => total + asNumber(balance.outstanding_amount),
        0
      )
    ),
    retailersWithOutstanding: retailerBalances.filter(
      balance => asNumber(balance.outstanding_amount) > 0
    ).length
  }

  const retailerWatchlist = retailerBalances
    .slice()
    .sort((left, right) => {
      const outstandingGap =
        asNumber(right.outstanding_amount) - asNumber(left.outstanding_amount)

      if (outstandingGap !== 0) {
        return outstandingGap
      }

      return (
        asNumber(right.remaining_quantity) - asNumber(left.remaining_quantity)
      )
    })
    .filter(
      balance =>
        asNumber(balance.outstanding_amount) > 0 ||
        asNumber(balance.remaining_quantity) > 0 ||
        asNumber(balance.recognized_sales_value) > 0
    )
    .slice(0, 5)
    .map(mapRetailerWatchlist)

  return {
    mode: 'live',
    access,
    currentMonthKey: monthSummaries[monthSummaries.length - 1]?.key ?? null,
    months: monthSummaries,
    snapshot,
    retailerWatchlist,
    stockSections: buildStockSections({
      access,
      inventoryLots,
      productionOutputs,
      openIssueLines
    }),
    activityFeed: buildActivityFeed({
      purchases,
      batches,
      stockIssues,
      reconciliations,
      remittances,
      expenses
    })
  }
}

export function getPreviewDashboardWorkspace(role) {
  return {
    ...buildLiveWorkspace({
      access: getDashboardAccess(role),
      months: buildMonthTimeline(6),
      purchases: [],
      inventoryLots: [],
      batches: [],
      productionOutputs: [],
      stockIssues: [],
      retailers: [],
      reconciliations: [],
      remittances: [],
      retailerBalances: [],
      openIssueLines: [],
      expenses: []
    }),
    mode: 'unavailable'
  }
}
export async function fetchDashboardWorkspace(role) {
  const data = await apiRequest('workspace?name=dashboard')
  return buildLiveWorkspace({
    ...data,
    access: getDashboardAccess(role),
    months: buildMonthTimeline(6)
  })
}
