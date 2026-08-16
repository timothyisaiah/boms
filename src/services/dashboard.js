import { hasAllowedRole } from '@/constants/roles'
import { isSupabaseConfigured, supabase } from '@/lib/supabase'

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

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function startOfMonth(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1))
}

function shiftMonth(date, offset) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + offset, 1))
}

function toMonthKey(value) {
  if (!value) {
    return null
  }

  const date = value instanceof Date ? value : new Date(value)

  if (Number.isNaN(date.getTime())) {
    return null
  }

  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
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

function buildStockSections({ access, inventoryLots, productionOutputs, openIssueLines }) {
  const sections = []

  if (access.supply && inventoryLots.length > 0) {
    sections.push({
      key: 'materials',
      title: 'Material lots',
      items: inventoryLots
        .slice()
        .sort((left, right) => new Date(left.received_at) - new Date(right.received_at))
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
        .sort((left, right) => asNumber(right.quantity_remaining) - asNumber(left.quantity_remaining))
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
        .sort((left, right) => asNumber(right.open_stock_value) - asNumber(left.open_stock_value))
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
        remittance.remittance_reference?.trim() || `Remittance ${remittance.id}`,
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
        (total, lot) => total + asNumber(lot.quantity_remaining) * asNumber(lot.unit_cost),
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

function throwIfError(error) {
  if (error) {
    throw error
  }
}

const previewWorkspace = Object.freeze({
  currentMonthKey: '2026-08',
  months: [
    {
      key: '2026-03',
      label: 'Mar 2026',
      shortLabel: 'Mar',
      purchasesAmount: 2180000,
      purchasesCount: 2,
      batchesCompleted: 1,
      outputQuantity: 96,
      stockIssueCount: 1,
      issuedQuantity: 36,
      salesValue: 224000,
      cogsValue: 138400,
      grossProfit: 85600,
      remittedAmount: 180000,
      expenseAmount: 145000,
      netProfit: -59400,
      soldQuantity: 8,
      returnedQuantity: 0,
      damagedQuantity: 0,
      remainingQuantity: 28
    },
    {
      key: '2026-04',
      label: 'Apr 2026',
      shortLabel: 'Apr',
      purchasesAmount: 2640000,
      purchasesCount: 2,
      batchesCompleted: 2,
      outputQuantity: 156,
      stockIssueCount: 2,
      issuedQuantity: 64,
      salesValue: 448000,
      cogsValue: 272000,
      grossProfit: 176000,
      remittedAmount: 310000,
      expenseAmount: 212000,
      netProfit: -36000,
      soldQuantity: 16,
      returnedQuantity: 1,
      damagedQuantity: 1,
      remainingQuantity: 46
    },
    {
      key: '2026-05',
      label: 'May 2026',
      shortLabel: 'May',
      purchasesAmount: 3115000,
      purchasesCount: 3,
      batchesCompleted: 2,
      outputQuantity: 204,
      stockIssueCount: 2,
      issuedQuantity: 88,
      salesValue: 616000,
      cogsValue: 374200,
      grossProfit: 241800,
      remittedAmount: 402000,
      expenseAmount: 228000,
      netProfit: 13800,
      soldQuantity: 22,
      returnedQuantity: 2,
      damagedQuantity: 1,
      remainingQuantity: 63
    },
    {
      key: '2026-06',
      label: 'Jun 2026',
      shortLabel: 'Jun',
      purchasesAmount: 3380000,
      purchasesCount: 3,
      batchesCompleted: 3,
      outputQuantity: 252,
      stockIssueCount: 3,
      issuedQuantity: 112,
      salesValue: 812000,
      cogsValue: 493800,
      grossProfit: 318200,
      remittedAmount: 590000,
      expenseAmount: 274000,
      netProfit: 44200,
      soldQuantity: 29,
      returnedQuantity: 2,
      damagedQuantity: 2,
      remainingQuantity: 79
    },
    {
      key: '2026-07',
      label: 'Jul 2026',
      shortLabel: 'Jul',
      purchasesAmount: 3570000,
      purchasesCount: 3,
      batchesCompleted: 3,
      outputQuantity: 288,
      stockIssueCount: 3,
      issuedQuantity: 124,
      salesValue: 1036000,
      cogsValue: 628500,
      grossProfit: 407500,
      remittedAmount: 742000,
      expenseAmount: 286000,
      netProfit: 121500,
      soldQuantity: 37,
      returnedQuantity: 3,
      damagedQuantity: 2,
      remainingQuantity: 82
    },
    {
      key: '2026-08',
      label: 'Aug 2026',
      shortLabel: 'Aug',
      purchasesAmount: 3265000,
      purchasesCount: 3,
      batchesCompleted: 2,
      outputQuantity: 264,
      stockIssueCount: 2,
      issuedQuantity: 96,
      salesValue: 336000,
      cogsValue: 202200,
      grossProfit: 133800,
      remittedAmount: 250000,
      expenseAmount: 305000,
      netProfit: -171200,
      soldQuantity: 12,
      returnedQuantity: 3,
      damagedQuantity: 2,
      remainingQuantity: 79
    }
  ],
  snapshot: {
    activeRetailers: 3,
    openMaterialLots: 5,
    openMaterialValue: 2915000,
    openWarehouseQuantity: 264,
    openWarehouseValue: 4488120,
    openRetailQuantity: 79,
    openRetailValue: 2052050,
    outstandingAmount: 86000,
    retailersWithOutstanding: 1
  },
  retailerWatchlist: [
    {
      id: 5001,
      title: 'Ntinda Health Market',
      subtitle: 'Ntinda, Kampala',
      statusLabel: 'Collect',
      statusTone: 'warning',
      outstandingAmount: 86000,
      remainingQuantity: 25,
      remittedAmount: 250000,
      recognizedSalesValue: 336000
    },
    {
      id: 5002,
      title: 'Entebbe Organics Corner',
      subtitle: 'Entebbe Road, Wakiso',
      statusLabel: 'In store',
      statusTone: 'positive',
      outstandingAmount: 0,
      remainingQuantity: 54,
      remittedAmount: 0,
      recognizedSalesValue: 0
    }
  ],
  stockSections: [
    {
      key: 'materials',
      title: 'Material lots',
      items: [
        {
          id: 30021,
          title: 'LOT-HON-0801',
          detail: 'Raw Honey',
          meta: 'Kayunga Honey Cooperative • Aug 2026',
          value: 148,
          unit: 'kg'
        },
        {
          id: 30022,
          title: 'LOT-JAR-0730',
          detail: '500g PET Jar',
          meta: 'Kampala Pack House • Jul 2026',
          value: 220,
          unit: 'piece'
        }
      ]
    },
    {
      key: 'warehouse',
      title: 'Warehouse stock',
      items: [
        {
          id: 7003,
          title: 'PB-20260801-002',
          detail: '500g Ginger Infused Jar',
          meta: 'BEE-GIN-500 • 17,120 UGX each',
          value: 144,
          unit: 'jars'
        },
        {
          id: 7001,
          title: 'PB-20260729-001',
          detail: '500g Classic Jar',
          meta: 'BEE-RAW-500 • 16,850 UGX each',
          value: 78,
          unit: 'jars'
        }
      ]
    },
    {
      key: 'retail',
      title: 'Retail stock',
      items: [
        {
          id: 8102,
          title: 'Entebbe Organics Corner',
          detail: '1kg Classic Jar • PB-20260731-001',
          meta: 'DN-ENT-0002 • 1,630,800 UGX open',
          value: 54,
          unit: 'jars'
        },
        {
          id: 8101,
          title: 'Ntinda Health Market',
          detail: '500g Classic Jar • PB-20260729-001',
          meta: 'DN-NTI-0004 • 421,250 UGX open',
          value: 25,
          unit: 'jars'
        }
      ]
    }
  ],
  activityFeed: [
    {
      id: 'expense-9802',
      type: 'Expense',
      title: 'Promoter stipend',
      subtitle: 'Field Team',
      timestamp: '2026-08-02T10:00:00.000Z',
      value: 120000,
      valueType: 'currency'
    },
    {
      id: 'issue-8002',
      type: 'Issue',
      title: 'DN-ENT-0002',
      subtitle: 'Entebbe Organics Corner',
      timestamp: '2026-08-01T16:15:00.000Z',
      value: 54,
      valueType: 'quantity',
      valueUnit: 'jars'
    },
    {
      id: 'remittance-9701',
      type: 'Cash',
      title: 'MMT-772418',
      subtitle: 'Ntinda Health Market',
      timestamp: '2026-08-02T16:30:00.000Z',
      value: 250000,
      valueType: 'currency'
    },
    {
      id: 'reconciliation-9501',
      type: 'Review',
      title: 'REC-NTI-20260802',
      subtitle: 'Ntinda Health Market',
      timestamp: '2026-08-02T15:00:00.000Z',
      value: 336000,
      valueType: 'currency'
    }
  ]
})

export function getPreviewDashboardWorkspace(role) {
  return {
    mode: 'preview',
    access: getDashboardAccess(role),
    ...clone(previewWorkspace)
  }
}

export async function fetchDashboardWorkspace(role) {
  if (!supabase || !isSupabaseConfigured) {
    return getPreviewDashboardWorkspace(role)
  }

  const access = getDashboardAccess(role)
  const months = buildMonthTimeline(6)
  const startDate = `${months[0].key}-01T00:00:00.000Z`

  const [
    purchasesResult,
    inventoryLotsResult,
    batchesResult,
    productionOutputsResult,
    stockIssuesResult,
    retailersResult,
    reconciliationsResult,
    remittancesResult,
    retailerBalancesResult,
    openIssueLinesResult,
    expensesResult
  ] = await Promise.all([
    access.supply
      ? supabase
          .from('purchases')
          .select(
            `
              id,
              purchase_reference,
              purchased_at,
              status,
              total_amount,
              supplier:suppliers (
                supplier_name
              )
            `
          )
          .gte('purchased_at', startDate)
          .order('purchased_at', { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    access.supply
      ? supabase
          .from('inventory_lots')
          .select(
            `
              id,
              lot_code,
              quantity_remaining,
              unit_cost,
              received_at,
              material:materials (
                name,
                unit_of_measure,
                kind
              ),
              supplier:suppliers (
                supplier_name
              )
            `
          )
          .eq('status', 'open')
          .order('received_at', { ascending: true })
      : Promise.resolve({ data: [], error: null }),
    access.production
      ? supabase
          .from('production_batches')
          .select(
            `
              id,
              batch_code,
              started_at,
              status,
              total_output_quantity,
              variant:product_variants (
                variant_name
              )
            `
          )
          .gte('started_at', startDate)
          .order('started_at', { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    access.production
      ? supabase
          .from('production_outputs')
          .select(
            `
              id,
              quantity_produced,
              quantity_remaining,
              unit_cost,
              created_at,
              batch:production_batches (
                batch_code,
                started_at
              ),
              variant:product_variants (
                sku,
                variant_name,
                pack_size_grams,
                flavor
              )
            `
          )
          .gt('quantity_remaining', 0)
          .order('created_at', { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    access.retail
      ? supabase
          .from('stock_issues')
          .select(
            `
              id,
              issue_reference,
              issued_at,
              status,
              total_quantity,
              total_cost,
              retailer:retailers (
                retailer_name
              )
            `
          )
          .gte('issued_at', startDate)
          .order('issued_at', { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    access.retail
      ? supabase
          .from('retailers')
          .select(
            `
              id,
              retailer_name,
              delivery_location
            `
          )
          .eq('is_active', true)
          .order('retailer_name', { ascending: true })
      : Promise.resolve({ data: [], error: null }),
    access.review
      ? supabase
          .from('reconciliations')
          .select(
            `
              id,
              reconciliation_reference,
              reconciled_at,
              total_sold_quantity,
              total_returned_quantity,
              total_damaged_quantity,
              total_remaining_quantity,
              total_sales_value,
              total_cogs_value,
              retailer:retailers (
                retailer_name
              )
            `
          )
          .gte('reconciled_at', startDate)
          .order('reconciled_at', { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    access.review
      ? supabase
          .from('remittances')
          .select(
            `
              id,
              amount,
              remittance_reference,
              received_at,
              retailer:retailers (
                retailer_name
              )
            `
          )
          .gte('received_at', startDate)
          .order('received_at', { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    access.review
      ? supabase
          .from('retailer_outstanding_balances')
          .select(
            `
              retailer_id,
              retailer_name,
              delivery_location,
              remaining_quantity,
              recognized_sales_value,
              remitted_amount,
              outstanding_amount
            `
          )
          .order('outstanding_amount', { ascending: false })
          .order('retailer_name', { ascending: true })
      : Promise.resolve({ data: [], error: null }),
    access.review
      ? supabase
          .from('retailer_issue_open_balances')
          .select(
            `
              retailer_name,
              stock_issue_item_id,
              issue_reference,
              batch_code,
              variant_name,
              sku,
              quantity_open,
              open_stock_value
            `
          )
          .order('open_stock_value', { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    access.expenses
      ? supabase
          .from('expenses')
          .select(
            `
              id,
              expense_category,
              incurred_at,
              amount,
              vendor_name
            `
          )
          .gte('incurred_at', startDate)
          .order('incurred_at', { ascending: false })
      : Promise.resolve({ data: [], error: null })
  ])

  throwIfError(purchasesResult.error)
  throwIfError(inventoryLotsResult.error)
  throwIfError(batchesResult.error)
  throwIfError(productionOutputsResult.error)
  throwIfError(stockIssuesResult.error)
  throwIfError(retailersResult.error)
  throwIfError(reconciliationsResult.error)
  throwIfError(remittancesResult.error)
  throwIfError(retailerBalancesResult.error)
  throwIfError(openIssueLinesResult.error)
  throwIfError(expensesResult.error)

  return buildLiveWorkspace({
    access,
    months,
    purchases: purchasesResult.data ?? [],
    inventoryLots: inventoryLotsResult.data ?? [],
    batches: batchesResult.data ?? [],
    productionOutputs: productionOutputsResult.data ?? [],
    stockIssues: stockIssuesResult.data ?? [],
    retailers: retailersResult.data ?? [],
    reconciliations: reconciliationsResult.data ?? [],
    remittances: remittancesResult.data ?? [],
    retailerBalances: retailerBalancesResult.data ?? [],
    openIssueLines: openIssueLinesResult.data ?? [],
    expenses: expensesResult.data ?? []
  })
}
