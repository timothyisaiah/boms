import { reactive } from 'vue'
import { apiRequest, ApiError } from '@/lib/api'
export const writeStates = reactive({})
let identity = ''
const storeKey = action => `boms:pending:${identity}:${action}`
export function setWriteIdentity(id) {
  identity = id ?? ''
  for (const key of Object.keys(writeStates)) delete writeStates[key]
  if (!identity) return
  for (const action of [
    'variants',
    'materials',
    'suppliers',
    'retailers',
    'purchases',
    'production',
    'stock-issues',
    'reconciliations',
    'remittances',
    'expenses',
    'prices',
    'recipes'
  ]) {
    try {
      const saved = JSON.parse(
        sessionStorage.getItem(storeKey(action)) ?? 'null'
      )
      if (saved)
        writeStates[action] = {
          ...saved,
          status: 'network',
          message:
            'A previous submission needs confirmation. Retry the saved submission.'
        }
    } catch {
      /* An unavailable storage area must not break sign-in. */
    }
  }
}
export function isWriteLocked(action) {
  return ['pending', 'network', 'expired'].includes(writeStates[action]?.status)
}
function persist(action, state) {
  try {
    sessionStorage.setItem(
      storeKey(action),
      JSON.stringify({
        key: state.key,
        body: state.body,
        createdAt: state.createdAt
      })
    )
  } catch {
    /* Keep the same key in memory if storage is unavailable. */
  }
}
export async function writeAction(action, body) {
  const current = writeStates[action]
  if (current?.status === 'pending')
    throw new ApiError('This submission is still pending.', 409, 'conflict')
  if (
    isWriteLocked(action) &&
    JSON.stringify(body) !== JSON.stringify(current.body)
  )
    throw new ApiError(
      'Confirm the saved submission before starting another.',
      409,
      'conflict'
    )
  const state = isWriteLocked(action)
    ? current
    : {
        key: crypto.randomUUID(),
        body: JSON.parse(JSON.stringify(body)),
        createdAt: Date.now()
      }
  if (Date.now() - state.createdAt > 47 * 3600000) {
    writeStates[action] = {
      ...state,
      status: 'expired',
      message:
        'This retry is older than 47 hours. Ask an administrator to check the records using the reference below before entering it again.'
    }
    throw new ApiError(writeStates[action].message, 409, 'conflict')
  }
  writeStates[action] = {
    ...state,
    status: 'pending',
    message: 'Saving. Keep this form open while the result is confirmed.'
  }
  persist(action, state)
  try {
    const result = await apiRequest(
      `write?action=${encodeURIComponent(action)}`,
      {
        method: 'POST',
        headers: { 'Idempotency-Key': state.key },
        body: JSON.stringify(state.body)
      }
    )
    writeStates[action] = { status: 'success', message: 'Saved successfully.' }
    try {
      sessionStorage.removeItem(storeKey(action))
    } catch {
      /* In-memory state is authoritative for this tab. */
    }
    return result
  } catch (error) {
    const uncertain = error.kind === 'network' || error.status >= 500
    writeStates[action] = {
      ...state,
      status: uncertain ? 'network' : 'validation',
      message: error.message
    }
    if (!uncertain) {
      try {
        sessionStorage.removeItem(storeKey(action))
      } catch {
        /* No committed mutation on validation failure. */
      }
    }
    throw error
  }
}
export function retryWrite(action) {
  return writeAction(action, writeStates[action].body)
}
