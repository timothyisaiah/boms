import { reactive, readonly } from 'vue'
import { getDefaultRouteForRole } from '@/constants/roles'
import { apiRequest } from '@/lib/api'
import { setWriteIdentity } from '@/services/writes'
const state = reactive({
  initialized: false,
  loading: false,
  session: null,
  user: null,
  profile: null,
  role: null,
  errorMessage: ''
})
let initializationPromise
function sync(user) {
  state.user = user
  state.profile = user
  state.role = user?.role ?? null
  state.session = user ? { user } : null
  setWriteIdentity(user?.id)
}
export function resolveSafeRedirect(target, fallback = '/') {
  return typeof target === 'string' &&
    target.startsWith('/') &&
    !target.startsWith('//') &&
    !target.includes('\\')
    ? target
    : fallback
}
export async function initializeAuth() {
  if (state.initialized) return state
  if (initializationPromise) return initializationPromise
  initializationPromise = (async () => {
    try {
      const data = await apiRequest('auth')
      sync(data.user)
      state.errorMessage = ''
    } catch (error) {
      sync(null)
      state.errorMessage = error.status === 401 ? '' : error.message
    } finally {
      state.initialized = true
    }
    return state
  })()
  return initializationPromise
}
export async function signInWithPassword(credentials) {
  if (state.loading) return
  state.loading = true
  try {
    const data = await apiRequest('auth?action=login', {
      method: 'POST',
      body: JSON.stringify(credentials)
    })
    sync(data.user)
    state.errorMessage = ''
    return data
  } finally {
    state.loading = false
  }
}
export async function signOut() {
  if (state.loading) return
  state.loading = true
  try {
    await apiRequest('auth?action=logout', { method: 'POST', body: '{}' })
    sync(null)
  } finally {
    state.loading = false
  }
}
export function signUpWithPassword() {
  throw new Error('Ask an administrator to create your account.')
}
export const isSelfRegistrationEnabled = false
export const authState = readonly(state)
export { getDefaultRouteForRole }
