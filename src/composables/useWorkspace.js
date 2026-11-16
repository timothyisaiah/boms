import {
  computed,
  getCurrentInstance,
  onBeforeUnmount,
  onMounted,
  ref,
  shallowRef
} from 'vue'

/**
 * The only workspace availability states. Pages and WorkspaceState must not
 * invent others (no 'preview', no 'empty'): empty data is a `live` state.
 */
export const WORKSPACE_MODE = Object.freeze({
  LOADING: 'loading',
  LIVE: 'live',
  REFRESHING: 'refreshing',
  UNAVAILABLE: 'unavailable'
})

export const WORKSPACE_MODES = Object.freeze(Object.values(WORKSPACE_MODE))

/** Error kinds exposed as `error.kind`. */
export const WORKSPACE_ERROR = Object.freeze({
  TIMEOUT: 'timeout',
  UNAUTHORIZED: 'unauthorized',
  FORBIDDEN: 'forbidden',
  SERVER: 'server',
  NETWORK: 'network',
  REQUEST: 'request'
})

const errorMessages = {
  timeout:
    'The workspace took too long to respond. Check your connection and retry.',
  unauthorized: 'Your session has ended. Sign in again to load current data.',
  forbidden: 'Your account does not have access to this workspace data.',
  server: 'The service could not load this workspace. Retry in a moment.',
  network: 'Connection interrupted. Reconnect and retry.',
  request: 'This workspace could not be loaded. Retry in a moment.'
}

class WorkspaceTimeoutError extends Error {
  constructor() {
    super(errorMessages.timeout)
    this.name = 'TimeoutError'
  }
}

/**
 * Normalise any loader rejection into
 * `{ kind, status, message, detail, cause }`.
 * `kind` distinguishes timeout / 401 / 403 / 5xx / network / other 4xx.
 */
export function classifyWorkspaceError(error) {
  const status = Number(error?.status) || 0
  let kind
  if (error?.name === 'TimeoutError' || error?.kind === 'timeout')
    kind = WORKSPACE_ERROR.TIMEOUT
  else if (status === 401) kind = WORKSPACE_ERROR.UNAUTHORIZED
  else if (status === 403) kind = WORKSPACE_ERROR.FORBIDDEN
  else if (status >= 500) kind = WORKSPACE_ERROR.SERVER
  else if (status === 0) kind = WORKSPACE_ERROR.NETWORK
  else kind = WORKSPACE_ERROR.REQUEST
  const detail = typeof error?.message === 'string' ? error.message : ''
  return {
    kind,
    status,
    // Network/4xx messages from apiRequest are already user-facing; timeouts,
    // auth and 5xx use fixed copy so raw server text never leads the banner.
    message:
      (kind === WORKSPACE_ERROR.NETWORK || kind === WORKSPACE_ERROR.REQUEST) &&
      detail
        ? detail
        : errorMessages[kind],
    detail,
    cause: error
  }
}

/**
 * Workspace request state.
 *
 * @param {(ctx: { signal: AbortSignal }) => Promise<any>} loader
 * @param {object} [options]
 * @param {any} [options.initialData=null] value of `data` before first success
 * @param {boolean} [options.immediate=true] load on mount (or at once outside
 *   a component)
 * @param {number} [options.timeoutMs=25000] reject as `timeout` after this;
 *   0 disables. Shorter than apiRequest's 30 s so timeouts are distinguishable.
 * @param {(error: object) => void} [options.onError]
 */
export function useWorkspace(loader, options = {}) {
  const {
    initialData = null,
    immediate = true,
    timeoutMs = 25000,
    onError
  } = options
  const mode = ref(WORKSPACE_MODE.LOADING)
  const data = shallowRef(initialData)
  const error = shallowRef(null)
  const lastLoadedAt = ref(null)
  let sequence = 0
  let controller = null

  const hasData = computed(() => lastLoadedAt.value !== null)
  const isLoading = computed(
    () =>
      mode.value === WORKSPACE_MODE.LOADING ||
      mode.value === WORKSPACE_MODE.REFRESHING
  )
  /** Unavailable but still showing data from an earlier success. */
  const isStale = computed(
    () => mode.value === WORKSPACE_MODE.UNAVAILABLE && hasData.value
  )

  async function load() {
    const current = ++sequence
    controller?.abort()
    const ownController = new AbortController()
    controller = ownController
    mode.value = hasData.value
      ? WORKSPACE_MODE.REFRESHING
      : WORKSPACE_MODE.LOADING
    let timer
    try {
      const request = Promise.resolve().then(() =>
        loader({ signal: ownController.signal })
      )
      const result = await (timeoutMs > 0
        ? Promise.race([
            request,
            new Promise((_, reject) => {
              timer = setTimeout(() => {
                ownController.abort()
                reject(new WorkspaceTimeoutError())
              }, timeoutMs)
            })
          ])
        : request)
      if (current !== sequence) return data.value
      data.value = result
      error.value = null
      lastLoadedAt.value = Date.now()
      mode.value = WORKSPACE_MODE.LIVE
      return result
    } catch (cause) {
      if (current !== sequence) return data.value
      // Keep the last successful data (stale) but never call it live.
      error.value = classifyWorkspaceError(cause)
      mode.value = WORKSPACE_MODE.UNAVAILABLE
      onError?.(error.value)
      return data.value
    } finally {
      clearTimeout(timer)
      if (controller === ownController) controller = null
    }
  }

  if (getCurrentInstance()) {
    if (immediate) onMounted(load)
    onBeforeUnmount(() => {
      sequence++
      controller?.abort()
    })
  } else if (immediate) {
    load()
  }

  return {
    mode,
    data,
    error,
    lastLoadedAt,
    hasData,
    isLoading,
    isStale,
    load,
    refresh: load
  }
}
