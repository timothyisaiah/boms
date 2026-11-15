import { apiRequest } from '@/lib/api'

// Paginated history reads (GET /api/history). Contract: docs/audits/history-api.md
export const HISTORY_RESOURCES = Object.freeze([
  'purchases',
  'batches',
  'stockIssues',
  'retailerMovements',
  'reconciliations',
  'remittances',
  'expenses'
])
export const HISTORY_DEFAULT_LIMIT = 25
export const HISTORY_MAX_LIMIT = 100
// Use as QTable :rows-per-page-options. No 0 ("All"): the server caps pages at 100.
export const HISTORY_ROWS_PER_PAGE_OPTIONS = Object.freeze([10, 25, 50, 100])

function toQueryString(params) {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value === undefined || value === null || value === '') continue
    search.set(key, String(value))
  }
  return search.toString()
}

/**
 * Fetch one page of a history collection.
 * @param {string} resource One of HISTORY_RESOURCES.
 * @param {object} params limit, offset, sort, order, from, to, q and
 *   resource filters (retailerId, supplierId, variantId, status, ...).
 * @param {{signal?: AbortSignal}} options
 * @returns {Promise<{rows: object[], total: number, limit: number, offset: number, sort: string, order: 'asc'|'desc'}>}
 */
export function fetchHistory(resource, params = {}, options = {}) {
  if (!HISTORY_RESOURCES.includes(resource))
    throw new Error(`Unknown history resource: ${resource}`)
  const query = toQueryString({ ...params, resource })
  return apiRequest(`history?${query}`, options)
}

/**
 * Map QTable server-side pagination ({ page, rowsPerPage, sortBy, descending })
 * plus filter values to /api/history params. sortBy must be one of the
 * resource's sort keys (the QTable column `name`); null keeps the server default.
 */
export function historyParamsFromPagination(pagination = {}, filters = {}) {
  const requested = Number(pagination.rowsPerPage)
  const limit =
    Number.isInteger(requested) && requested > 0
      ? Math.min(requested, HISTORY_MAX_LIMIT)
      : HISTORY_DEFAULT_LIMIT
  const page = Math.max(1, Number(pagination.page) || 1)
  return {
    ...filters,
    limit,
    offset: (page - 1) * limit,
    ...(pagination.sortBy
      ? {
          sort: pagination.sortBy,
          order: pagination.descending ? 'desc' : 'asc'
        }
      : {})
  }
}

/** Merge a /api/history response back into QTable pagination (sets rowsNumber). */
export function paginationFromHistory(response, pagination = {}) {
  return {
    ...pagination,
    page: Math.floor(response.offset / response.limit) + 1,
    rowsPerPage: response.limit,
    rowsNumber: response.total
  }
}

/**
 * One-call helper for QTable @request: returns the rows and the next
 * pagination object to assign to the table's v-model:pagination.
 */
export async function loadHistoryPage(
  resource,
  pagination,
  filters = {},
  options = {}
) {
  const response = await fetchHistory(
    resource,
    historyParamsFromPagination(pagination, filters),
    options
  )
  return {
    rows: response.rows,
    total: response.total,
    pagination: {
      ...paginationFromHistory(response, pagination),
      sortBy: pagination?.sortBy ?? null,
      descending: Boolean(pagination?.descending)
    }
  }
}

/**
 * Workspace payload without unbounded histories. Not available for 'dashboard'.
 * Adds historyCounts and, per workspace, retailerStockPositions (retail) or
 * reconciliationOptions (finance).
 */
export function fetchWorkspaceSummary(name, options = {}) {
  return apiRequest(
    `workspace?${toQueryString({ name, view: 'summary' })}`,
    options
  )
}
