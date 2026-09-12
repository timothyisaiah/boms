import { apiRequest } from '@/lib/api'
import { writeAction } from '@/services/writes'

function clonePreviewWorkspace() {
  return {
    mode: 'unavailable',
    retailers: [],
    openIssueLines: [],
    reconciliations: [],
    remittances: [],
    expenses: [],
    retailerBalances: [],
    pricing: [],
    profitSummary: {}
  }
}

export function getPreviewFinanceWorkspace() {
  return clonePreviewWorkspace()
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

export function fetchFinanceWorkspace() {
  return apiRequest('workspace?name=finance')
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
