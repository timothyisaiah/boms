import { apiRequest } from '@/lib/api'
import { fetchWorkspaceSummary } from '@/services/history'
import { writeAction } from '@/services/writes'

/**
 * Empty finance summary used as `useWorkspace` initialData so templates can
 * render before the first response. It is never presented as live data.
 */
export function emptyFinanceSummary() {
  return {
    retailers: [],
    openIssueLines: [],
    reconciliationOptions: [],
    retailerBalances: [],
    pricing: [],
    profitSummary: {},
    historyCounts: {}
  }
}

export function formatFinanceError(error, fallbackMessage) {
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

/** Full finance workspace (unbounded histories); kept for other callers. */
export function fetchFinanceWorkspace() {
  return apiRequest('workspace?name=finance')
}

/**
 * Finance summary view: open issue lines, pricing, balances, profit summary,
 * `reconciliationOptions` and `historyCounts`, without the history arrays
 * (docs/audits/history-api.md §3). Histories come from /api/history.
 */
export function fetchFinanceSummary(options = {}) {
  return fetchWorkspaceSummary('finance', options)
}
export function recordRetailReconciliation(payload) {
  return writeAction('reconciliations', payload)
}
export function recordRetailRemittance(payload) {
  return writeAction('remittances', payload)
}
export function recordOperatingExpense(payload) {
  return writeAction('expenses', payload)
}
