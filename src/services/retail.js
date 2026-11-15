import { fetchWorkspaceSummary, loadHistoryPage } from '@/services/history'
import { asNumber } from '@/lib/format'
import { writeAction } from '@/services/writes'

/**
 * Shape of the retail summary workspace before the first successful load.
 * Templates bind to it; useWorkspace never reports it as live data.
 */
export function emptyRetailWorkspace() {
  return {
    retailers: [],
    finishedStock: [],
    retailerStockPositions: [],
    historyCounts: {}
  }
}

export function formatRetailError(error, fallbackMessage) {
  if (error instanceof Error && error.message) {
    return error.message
  }

  if (typeof error?.message === 'string' && error.message) {
    return error.message
  }

  return fallbackMessage
}

const listOf = value => (Array.isArray(value) ? value : [])

/**
 * Bounded workspace read (`view=summary`): retailers, open finished stock,
 * `retailerStockPositions` and `historyCounts`, without unbounded histories.
 */
export async function fetchRetailWorkspace(options = {}) {
  const data = await fetchWorkspaceSummary('retail', options)
  return {
    ...emptyRetailWorkspace(),
    ...data,
    retailers: listOf(data?.retailers),
    finishedStock: listOf(data?.finishedStock),
    retailerStockPositions: listOf(data?.retailerStockPositions),
    historyCounts: data?.historyCounts ?? {}
  }
}

/**
 * One page of `stockIssues` or `retailerMovements` from /api/history as
 * `{ rows, total, pagination }` for a server-mode table or card list.
 */
export async function fetchRetailHistoryPage(
  resource,
  pagination,
  filters = {},
  options = {}
) {
  const result = await loadHistoryPage(resource, pagination, filters, options)
  const rows = listOf(result?.rows)
  const total = Number.isFinite(result?.total) ? result.total : rows.length
  const next = result?.pagination ?? {}
  return {
    rows,
    total,
    pagination: {
      ...pagination,
      ...next,
      page: Number.isFinite(next.page) ? next.page : 1,
      rowsPerPage: Number.isFinite(next.rowsPerPage)
        ? next.rowsPerPage
        : pagination.rowsPerPage,
      rowsNumber: total
    }
  }
}

/**
 * Stock each retailer currently holds: every listed retailer (zero units
 * included) merged with the server's `retailerStockPositions`, which only
 * holds retailers with movements. Same result and ordering as the former
 * client-side ledger sum: units on hand descending, then retailer name.
 */
export function mergeRetailerBalances(retailers = [], positions = []) {
  const balances = new Map(
    listOf(retailers).map(retailer => [
      retailer.id,
      {
        retailerId: retailer.id,
        retailerName: retailer.retailer_name,
        deliveryLocation: retailer.delivery_location,
        totalUnits: 0,
        lines: []
      }
    ])
  )

  for (const position of listOf(positions)) {
    const listed = balances.get(position.retailer_id)
    balances.set(position.retailer_id, {
      retailerId: position.retailer_id,
      retailerName:
        listed?.retailerName ?? position.retailer_name ?? 'Retailer',
      deliveryLocation: listed ? listed.deliveryLocation : '',
      totalUnits: asNumber(position.total_units),
      lines: listOf(position.lines)
        .map(line => ({
          key: `${line.product_variant_id}::${line.production_batch_id}`,
          variantSku: line.sku ?? 'Variant',
          batchCode: line.batch_code ?? 'Batch',
          quantity: asNumber(line.quantity)
        }))
        .filter(line => line.quantity !== 0)
        .sort((left, right) => right.quantity - left.quantity)
    })
  }

  return [...balances.values()].sort((left, right) => {
    if (right.totalUnits !== left.totalUnits) {
      return right.totalUnits - left.totalUnits
    }

    return String(left.retailerName).localeCompare(String(right.retailerName))
  })
}

export function issueDocumentLabel(issue) {
  return issue.issue_reference?.trim() || `ISSUE-${issue.id}`
}

export function recordStockIssue(payload) {
  return writeAction('stock-issues', payload)
}
