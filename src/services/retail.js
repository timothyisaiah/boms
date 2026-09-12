import { apiRequest } from '@/lib/api'
import { writeAction } from '@/services/writes'

function clonePreviewWorkspace() {
  return {
    mode: 'unavailable',
    retailers: [],
    finishedStock: [],
    stockIssues: [],
    retailerMovements: []
  }
}

export function getPreviewRetailWorkspace() {
  return clonePreviewWorkspace()
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

export function fetchRetailWorkspace() {
  return apiRequest('workspace?name=retail')
}
export function recordStockIssue(payload) {
  return writeAction('stock-issues', payload)
}
