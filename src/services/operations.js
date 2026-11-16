import { apiRequest } from '@/lib/api'
import { writeAction } from '@/services/writes'
import { fetchHistory, fetchWorkspaceSummary } from '@/services/history'

/**
 * Shape of the operations summary before the first successful load. Only
 * used so templates can read arrays; useWorkspace never reports it as live.
 */
export function emptyOperationsWorkspace() {
  return {
    variants: [],
    materials: [],
    suppliers: [],
    inventoryLots: [],
    recipes: [],
    historyCounts: {}
  }
}

export function formatOperationsError(error, fallbackMessage) {
  const messageParts = []

  if (error instanceof Error && error.message) {
    messageParts.push(error.message)
  } else if (typeof error?.message === 'string' && error.message) {
    messageParts.push(error.message)
  }

  if (typeof error?.details === 'string' && error.details) {
    messageParts.push(error.details)
  }

  if (typeof error?.hint === 'string' && error.hint) {
    messageParts.push(`Hint: ${error.hint}`)
  }

  if (messageParts.length > 0) {
    return messageParts.join(' ')
  }

  return fallbackMessage
}

/** Full workspace payload (unbounded histories). Kept for compatibility. */
export function fetchOperationsWorkspace(options = {}) {
  return apiRequest('workspace?name=operations', options)
}

/**
 * Summary payload: reference data, open lots and recipes, plus
 * `historyCounts` instead of the purchase and batch histories.
 */
export function fetchOperationsSummary(options = {}) {
  return fetchWorkspaceSummary('operations', options)
}

/**
 * Count of a history collection in a summary payload. Falls back to the
 * array length when a full payload is served; undefined while unknown.
 */
export function historyCount(workspace, key) {
  const count = workspace?.historyCounts?.[key]
  if (Number.isFinite(count)) return count
  return Array.isArray(workspace?.[key]) ? workspace[key].length : undefined
}

const rowsOf = response => (Array.isArray(response?.rows) ? response.rows : [])

/**
 * Batches whose `started_at` falls on `dateValue` (YYYY-MM-DD) as a UTC
 * date. The batch-code suggestion compares `started_at` with
 * `toISOString().slice(0, 10)`, so the window is in UTC instants, not a
 * Kampala business day (docs/audits/history-api.md §4).
 */
export async function fetchBatchesStartedOn(dateValue, options = {}) {
  const response = await fetchHistory(
    'batches',
    {
      from: `${dateValue}T00:00:00Z`,
      to: `${dateValue}T23:59:59.999Z`,
      limit: 100
    },
    options
  )
  return rowsOf(response)
}

/**
 * Batches whose code equals `batchCode` (case-insensitive). `q` is a
 * substring search, so the result is filtered exactly here.
 */
export async function findBatchesByCode(batchCode, options = {}) {
  const code = String(batchCode ?? '').trim()
  if (!code) return []
  const response = await fetchHistory(
    'batches',
    { q: code, limit: 100 },
    options
  )
  const normalized = code.toLowerCase()
  return rowsOf(response).filter(
    batch => batch?.batch_code?.trim()?.toLowerCase() === normalized
  )
}

export function recordPurchase(payload) {
  return writeAction('purchases', payload)
}
export function recordProductionBatch(payload) {
  return writeAction('production', payload)
}
