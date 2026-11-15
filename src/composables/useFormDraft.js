import {
  computed,
  getCurrentInstance,
  isRef,
  onBeforeUnmount,
  onMounted,
  ref,
  watch
} from 'vue'
import { getWriteIdentity } from '@/services/writes'
import {
  DEFAULT_DRAFT_EXPIRY_MS,
  defaultDraftStorage,
  loadDraft,
  removeDraft,
  sanitizeDraft,
  saveDraft,
  serializeDraft
} from '@/composables/draftStore'

/**
 * Session draft for one form, scoped to the signed-in user.
 *
 * @param {string} formKey stable per form, e.g. 'finance:reconciliation'
 * @param {object} state the form's `reactive()` object or a `ref`
 * @param {object} [options]
 * @param {number} [options.expiryMs=12h]
 * @param {string[]} [options.exclude] top-level fields never stored
 * @param {number} [options.debounceMs=400]
 * @param {(saved: object) => object} [options.deserialize] adjust restored
 *   data before it is applied (e.g. regenerate line `key`s)
 * @param {boolean} [options.restoreOnMount=true]
 */
export function useFormDraft(formKey, state, options = {}) {
  const {
    expiryMs = DEFAULT_DRAFT_EXPIRY_MS,
    exclude = [],
    debounceMs = 400,
    deserialize,
    restoreOnMount = true,
    storage = defaultDraftStorage(),
    identity = getWriteIdentity
  } = options

  const read = () => (isRef(state) ? state.value : state)
  const snapshot = () => serializeDraft(read(), exclude)
  const currentIdentity = () =>
    typeof identity === 'function' ? identity() : identity

  const baseline = ref(snapshot())
  const current = ref(baseline.value)
  const restored = ref(false)
  const savedAt = ref(null)
  const isDirty = computed(() => current.value !== baseline.value)
  let timer = null
  let suspended = false

  function persistNow() {
    clearTimeout(timer)
    timer = null
    const id = currentIdentity()
    if (!id) return
    if (!isDirty.value) {
      removeDraft(storage, id, formKey)
      savedAt.value = null
      return
    }
    const now = Date.now()
    if (saveDraft(storage, id, formKey, read(), { exclude, now }))
      savedAt.value = now
  }

  function apply(data) {
    const next = deserialize ? deserialize(data) : data
    if (isRef(state)) {
      state.value = { ...state.value, ...next }
      return
    }
    for (const [key, value] of Object.entries(next ?? {}))
      if (!exclude.includes(key) && key in state) state[key] = value
  }

  /** Apply the stored draft, if any. Returns true when one was restored. */
  function restore() {
    const draft = loadDraft(storage, currentIdentity(), formKey, {
      expiryMs
    })
    if (!draft) return false
    suspended = true
    apply(draft.data)
    current.value = snapshot()
    suspended = false
    restored.value = true
    savedAt.value = draft.savedAt
    return true
  }

  /**
   * Forget the draft and treat the current values as clean. Call after a
   * successful save (after the form is reset) or when the user discards.
   */
  function clearDraft() {
    clearTimeout(timer)
    timer = null
    removeDraft(storage, currentIdentity(), formKey)
    baseline.value = snapshot()
    current.value = baseline.value
    restored.value = false
    savedAt.value = null
  }

  watch(
    () => snapshot(),
    value => {
      if (suspended) return
      current.value = value
      clearTimeout(timer)
      timer = setTimeout(persistNow, debounceMs)
    },
    { flush: 'sync' }
  )

  // Flush a pending debounce when the tab is hidden or reloaded.
  const onPageHide = () => {
    if (timer) persistNow()
  }

  if (getCurrentInstance()) {
    onMounted(() => {
      if (restoreOnMount) restore()
      globalThis.addEventListener?.('pagehide', onPageHide)
    })
    onBeforeUnmount(() => {
      globalThis.removeEventListener?.('pagehide', onPageHide)
      if (timer) persistNow()
    })
  }

  return {
    isDirty,
    restored,
    savedAt,
    restore,
    clearDraft,
    flush: persistNow,
    /** The data that would be stored (for debugging/tests). */
    peek: () => sanitizeDraft(read(), exclude)
  }
}
