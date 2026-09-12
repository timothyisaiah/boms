import { apiRequest } from '@/lib/api'
import { writeAction } from '@/services/writes'

function clonePreviewWorkspace() {
  return {
    mode: 'unavailable',
    variants: [],
    materials: [],
    suppliers: [],
    purchases: [],
    inventoryLots: [],
    batches: [],
    recipes: []
  }
}

export function getPreviewOperationsWorkspace() {
  return clonePreviewWorkspace()
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

export function fetchOperationsWorkspace() {
  return apiRequest('workspace?name=operations')
}
export function recordPurchase(payload) {
  return writeAction('purchases', payload)
}
export function recordProductionBatch(payload) {
  return writeAction('production', payload)
}
