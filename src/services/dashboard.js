import { can } from '@/constants/capabilities'
import { apiRequest } from '@/lib/api'
import { asNumber, formatMoney, formatQuantity } from '@/lib/format'

// Which dashboard projections a role may see. Each flag mirrors the server
// role set that gates the matching projection in server/projections.ts, read
// through the capability matrix (src/constants/capabilities.js):
//   supply     SUPPLY  (purchases, material lots)     = read:operations
//   production ALL     (batches, warehouse stock)      = read:dashboard
//   retail     RETAIL  (stock issues)                  = read:retail
//   review     REVIEW  (reconciliations, balances)     = read:finance
//   expenses   FINANCE (expenses, net result)          = route:finance
export function getDashboardAccess(role) {
  return {
    supply: can(role, 'read:operations'),
    production: can(role, 'read:dashboard'),
    retail: can(role, 'read:retail'),
    review: can(role, 'read:finance'),
    expenses: can(role, 'route:finance'),
    admin: can(role, 'admin:users')
  }
}

const MONTH_LABEL_FORMATTER = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC'
})

const MONTH_SHORT_FORMATTER = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  timeZone: 'UTC'
})

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

function createRetailerState(balance) {
  if (asNumber(balance.outstanding_amount) > 0) {
    return {
      label: 'Payment due',
      tone: 'warning'
    }
  }

  if (asNumber(balance.remaining_quantity) > 0) {
    return {
      label: 'In store',
      tone: 'success'
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

/**
 * Template shape before the first successful load. It is never presented as
 * data: IndexPage shows skeletons until `useWorkspace` reports a success.
 */
export function createEmptyDashboardWorkspace(role) {
  return buildLiveWorkspace({
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
  })
}

/**
 * Full dashboard workspace. The dashboard must stay on the full payload: its
 * six-month totals and activity feed need every history collection, so the
 * server rejects `view=summary` for it (docs/audits/history-api.md).
 */
export async function fetchDashboardWorkspace(role, { signal } = {}) {
  const data = await apiRequest('workspace?name=dashboard', { signal })
  return buildLiveWorkspace({
    ...data,
    access: getDashboardAccess(role),
    months: buildMonthTimeline(6)
  })
}

// ---------------------------------------------------------------------------
// View models. Pure functions of a built workspace, so IndexPage and the
// components in src/components/dashboard/ only arrange them.
// ---------------------------------------------------------------------------

const jars = value => `${formatQuantity(value)} jars`

/** Text such as "+UGX 5,000 vs last month" or "No prior month in range". */
export function compareAgainstPrevious(
  currentValue,
  previousValue,
  type,
  unit = ''
) {
  if (previousValue == null) {
    return 'No prior month in range'
  }

  const difference = roundCurrency(
    asNumber(currentValue) - asNumber(previousValue)
  )

  if (difference === 0) {
    return 'Flat vs last month'
  }

  const prefix = difference > 0 ? '+' : '-'
  const absoluteDifference = Math.abs(difference)

  if (type === 'currency') {
    return `${prefix}${formatMoney(absoluteDifference)} vs last month`
  }

  return `${prefix}${formatQuantity(absoluteDifference)} ${unit} vs last month`
}

/** The month the dashboard is focused on and the one before it. */
export function getMonthContext(workspace, monthKey) {
  const months = workspace.months
  const index = months.findIndex(month => month.key === monthKey)
  const resolvedIndex = index === -1 ? months.length - 1 : index

  return {
    month: months[resolvedIndex] ?? null,
    previousMonth: resolvedIndex > 0 ? months[resolvedIndex - 1] : null
  }
}

/**
 * The four decision figures for the role, shown as the compact metric strip.
 * Each item is `{ label, value, hint }`.
 */
export function buildMetricStrip(workspace, month, previousMonth) {
  if (!month) {
    return []
  }

  const { access, snapshot } = workspace

  if (access.review && access.expenses) {
    return [
      {
        label: 'Recognized sales',
        value: formatMoney(month.salesValue),
        hint: compareAgainstPrevious(
          month.salesValue,
          previousMonth?.salesValue,
          'currency'
        )
      },
      {
        label: 'Cash received',
        value: formatMoney(month.remittedAmount),
        hint: compareAgainstPrevious(
          month.remittedAmount,
          previousMonth?.remittedAmount,
          'currency'
        )
      },
      {
        label: 'Net result',
        value: formatMoney(month.netProfit),
        hint: `${formatMoney(month.expenseAmount)} in operating expenses`
      },
      {
        label: 'Collections open now',
        value: formatMoney(snapshot.outstandingAmount),
        hint: `${snapshot.retailersWithOutstanding} retailers need follow-up`
      }
    ]
  }

  if (access.review) {
    return [
      {
        label: 'Recognized sales',
        value: formatMoney(month.salesValue),
        hint: `${jars(month.soldQuantity)} sold in review`
      },
      {
        label: 'Cash received',
        value: formatMoney(month.remittedAmount),
        hint: compareAgainstPrevious(
          month.remittedAmount,
          previousMonth?.remittedAmount,
          'currency'
        )
      },
      {
        label: 'Stock issued',
        value: jars(month.issuedQuantity),
        hint: `${formatQuantity(month.stockIssueCount)} dispatch records posted`
      },
      {
        label: 'Collections open now',
        value: formatMoney(snapshot.outstandingAmount),
        hint: `${snapshot.retailersWithOutstanding} retailers still open`
      }
    ]
  }

  if (access.retail) {
    return [
      {
        label: 'Stock issued',
        value: jars(month.issuedQuantity),
        hint: compareAgainstPrevious(
          month.issuedQuantity,
          previousMonth?.issuedQuantity,
          'quantity',
          'jars'
        )
      },
      {
        label: 'Open finished stock',
        value: jars(snapshot.openWarehouseQuantity),
        hint: `${formatMoney(snapshot.openWarehouseValue)} at current batch cost`
      },
      {
        label: 'Stock in partner stores',
        value: jars(snapshot.openRetailQuantity),
        hint: `${formatMoney(snapshot.openRetailValue)} still out in market`
      },
      {
        label: 'Active retailers',
        value: formatQuantity(snapshot.activeRetailers),
        hint: `${formatQuantity(month.stockIssueCount)} dispatches posted in the month`
      }
    ]
  }

  return [
    {
      label: 'Material spend',
      value: formatMoney(month.purchasesAmount),
      hint: `${formatQuantity(month.purchasesCount)} receipts recorded`
    },
    {
      label: 'Completed batches',
      value: formatQuantity(month.batchesCompleted),
      hint: compareAgainstPrevious(
        month.batchesCompleted,
        previousMonth?.batchesCompleted,
        'quantity',
        'batches'
      )
    },
    {
      label: 'Jars packed',
      value: jars(month.outputQuantity),
      hint: compareAgainstPrevious(
        month.outputQuantity,
        previousMonth?.outputQuantity,
        'quantity',
        'jars'
      )
    },
    {
      label: 'Open material lots',
      value: formatQuantity(snapshot.openMaterialLots),
      hint: `${formatMoney(snapshot.openMaterialValue)} still available for production`
    }
  ]
}

const TREND_COPY = {
  sales: { title: 'Recognized sales trend', chip: 'Sales', money: true },
  issued: { title: 'Dispatch trend', chip: 'Dispatch', money: false },
  output: { title: 'Production output trend', chip: 'Output', money: false },
  purchases: { title: 'Material spend trend', chip: 'Spend', money: true }
}

/** Which series the trend shows for the role's access. */
export function getTrendMode(access) {
  if (access.review) return 'sales'
  if (access.retail) return 'issued'
  if (access.production) return 'output'
  return 'purchases'
}

export function getTrendCopy(mode) {
  return TREND_COPY[mode] ?? TREND_COPY.purchases
}

export function getTrendValue(mode, month) {
  switch (mode) {
    case 'sales':
      return asNumber(month.salesValue)
    case 'issued':
      return asNumber(month.issuedQuantity)
    case 'output':
      return asNumber(month.outputQuantity)
    default:
      return asNumber(month.purchasesAmount)
  }
}

export function formatTrendValue(mode, month) {
  const value = getTrendValue(mode, month)
  return getTrendCopy(mode).money ? formatMoney(value) : jars(value)
}

export function trendMeta(mode, month) {
  switch (mode) {
    case 'sales':
      return `${jars(month.soldQuantity)} sold`
    case 'issued':
      return `${formatQuantity(month.stockIssueCount)} dispatches`
    case 'output':
      return `${formatQuantity(month.batchesCompleted)} completed batches`
    default:
      return `${formatQuantity(month.purchasesCount)} receipts`
  }
}

export function trendComparison(mode, month, previousMonth) {
  if (!month) {
    return 'No month selected'
  }

  const money = getTrendCopy(mode).money
  return compareAgainstPrevious(
    getTrendValue(mode, month),
    previousMonth ? getTrendValue(mode, previousMonth) : null,
    money ? 'currency' : 'quantity',
    money ? '' : 'jars'
  )
}

/** Supporting figures beside the selected trend month. */
export function buildTrendFocusStats(mode, month, snapshot) {
  if (!month) {
    return []
  }

  switch (mode) {
    case 'sales':
      return [
        { label: 'Gross profit', value: formatMoney(month.grossProfit) },
        { label: 'Cash received', value: formatMoney(month.remittedAmount) },
        { label: 'Open in stores', value: jars(month.remainingQuantity) }
      ]
    case 'issued':
      return [
        { label: 'Dispatches', value: formatQuantity(month.stockIssueCount) },
        {
          label: 'Open retail stock',
          value: jars(snapshot.openRetailQuantity)
        },
        { label: 'Retail value', value: formatMoney(snapshot.openRetailValue) }
      ]
    case 'output':
      return [
        {
          label: 'Completed batches',
          value: formatQuantity(month.batchesCompleted)
        },
        { label: 'Material spend', value: formatMoney(month.purchasesAmount) },
        {
          label: 'Warehouse stock',
          value: jars(snapshot.openWarehouseQuantity)
        }
      ]
    default:
      return [
        {
          label: 'Receipts posted',
          value: formatQuantity(month.purchasesCount)
        },
        {
          label: 'Open lots',
          value: formatQuantity(snapshot.openMaterialLots)
        },
        {
          label: 'Open lot value',
          value: formatMoney(snapshot.openMaterialValue)
        }
      ]
  }
}

/** Monthly review headline figures (at most six). */
export function buildMonthlyReviewStats(access, month) {
  if (!month) {
    return []
  }

  const stats = []

  if (access.supply) {
    stats.push({
      label: 'Material spend',
      value: formatMoney(month.purchasesAmount),
      hint: `${formatQuantity(month.purchasesCount)} receipts posted`
    })
  }

  if (access.production) {
    stats.push({
      label: 'Batches completed',
      value: formatQuantity(month.batchesCompleted),
      hint: `${jars(month.outputQuantity)} packed`
    })
  }

  if (access.retail) {
    stats.push({
      label: 'Stock issued',
      value: jars(month.issuedQuantity),
      hint: `${formatQuantity(month.stockIssueCount)} dispatches recorded`
    })
  }

  if (access.review) {
    stats.push(
      {
        label: 'Sales recognized',
        value: formatMoney(month.salesValue),
        hint: `${jars(month.soldQuantity)} sold`
      },
      {
        label: 'Cash received',
        value: formatMoney(month.remittedAmount),
        hint: `${formatMoney(Math.max(month.salesValue - month.remittedAmount, 0))} trailing sales`
      },
      {
        label: 'Returns and damage',
        value: jars(month.returnedQuantity + month.damagedQuantity),
        hint: `${formatQuantity(month.returnedQuantity)} returned / ${formatQuantity(month.damagedQuantity)} damaged`
      }
    )
  }

  if (access.expenses) {
    stats.push({
      label: 'Net result',
      value: formatMoney(month.netProfit),
      hint: `${formatMoney(month.expenseAmount)} operating expenses`
    })
  }

  return stats.slice(0, 6)
}

/** "What stands out" notes; `tone` is a status-chip tone. */
export function buildMonthlyNotes(access, month) {
  if (!month) {
    return []
  }

  const notes = []

  if (access.review) {
    const cashGap = roundCurrency(month.salesValue - month.remittedAmount)

    if (cashGap > 0) {
      notes.push({
        tone: 'warning',
        title: 'Collection gap',
        text: `${formatMoney(cashGap)} has not been remitted against the month's recognized sales.`
      })
    }

    if (month.returnedQuantity > 0 || month.damagedQuantity > 0) {
      notes.push({
        tone: 'neutral',
        title: 'Stock exceptions',
        text: `${formatQuantity(month.returnedQuantity)} jars were returned and ${formatQuantity(month.damagedQuantity)} were damaged.`
      })
    }

    if (month.remainingQuantity > 0) {
      notes.push({
        tone: 'success',
        title: 'Retail stock still live',
        text: `${jars(month.remainingQuantity)} remained in stores after review.`
      })
    }
  }

  if (access.production) {
    notes.push({
      tone: month.batchesCompleted > 0 ? 'success' : 'neutral',
      title: 'Production throughput',
      text:
        month.batchesCompleted > 0
          ? `${jars(month.outputQuantity)} were packed across ${formatQuantity(month.batchesCompleted)} completed batches.`
          : 'No completed batches were posted in this month.'
    })
  }

  if (access.supply) {
    notes.push({
      tone: 'neutral',
      title: 'Material intake',
      text:
        month.purchasesCount > 0
          ? `${formatMoney(month.purchasesAmount)} was recorded across ${formatQuantity(month.purchasesCount)} purchase receipts.`
          : 'No purchase receipts were recorded in this month.'
    })
  }

  if (access.expenses) {
    notes.push({
      tone: month.netProfit < 0 ? 'danger' : 'success',
      title: 'Bottom line',
      text:
        month.netProfit < 0
          ? `${formatMoney(Math.abs(month.netProfit))} below break-even after expenses.`
          : `${formatMoney(month.netProfit)} above break-even after expenses.`
    })
  }

  return notes.slice(0, 4)
}

/** "Core review lines" label/value rows. */
export function buildMonthlyBreakdown(access, month) {
  if (!month) {
    return []
  }

  const rows = []

  if (access.supply) {
    rows.push({
      label: 'Purchase spend',
      value: formatMoney(month.purchasesAmount)
    })
  }

  if (access.production) {
    rows.push({ label: 'Output quantity', value: jars(month.outputQuantity) })
  }

  if (access.retail) {
    rows.push({
      label: 'Issued to retailers',
      value: jars(month.issuedQuantity)
    })
  }

  if (access.review) {
    rows.push(
      { label: 'Recognized sales', value: formatMoney(month.salesValue) },
      { label: 'Gross profit', value: formatMoney(month.grossProfit) },
      { label: 'Returned', value: jars(month.returnedQuantity) },
      { label: 'Damaged', value: jars(month.damagedQuantity) },
      { label: 'Cash received', value: formatMoney(month.remittedAmount) }
    )
  }

  if (access.expenses) {
    rows.push(
      { label: 'Operating expenses', value: formatMoney(month.expenseAmount) },
      { label: 'Net result', value: formatMoney(month.netProfit) }
    )
  }

  return rows
}

/** Activity feed value: money or "<n> jars". */
export function formatActivityValue(item) {
  if (item.valueType === 'currency') {
    return formatMoney(item.value)
  }

  if (item.valueType === 'quantity') {
    return `${formatQuantity(item.value)} ${item.valueUnit ?? 'units'}`
  }

  return ''
}
