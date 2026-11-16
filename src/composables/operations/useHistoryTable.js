import { onBeforeUnmount, ref, shallowRef, watch } from 'vue'
import { loadHistoryPage } from '@/services/history'
import { classifyWorkspaceError } from '@/composables/useWorkspace'

/**
 * Server-paged history for ResponsiveRecordView (cards and QTable share the
 * same rows and pagination). Column `name`s must be the resource's server
 * sort keys (docs/audits/history-api.md §2).
 *
 * Previous rows stay visible while a page loads or after a failed request.
 */
export function useHistoryTable(resource, { rowsPerPage = 10 } = {}) {
  const rows = shallowRef([])
  const loading = ref(false)
  const loaded = ref(false)
  const error = shallowRef(null)
  const search = ref('')
  const pagination = ref({
    page: 1,
    rowsPerPage,
    sortBy: null, // server default: date, newest first
    descending: true,
    rowsNumber: 0
  })
  let controller = null
  let searchTimer = null

  async function request({ pagination: next = pagination.value } = {}) {
    controller?.abort()
    const own = new AbortController()
    controller = own
    loading.value = true
    try {
      const q = String(search.value ?? '').trim()
      const result = await loadHistoryPage(resource, next, q ? { q } : {}, {
        signal: own.signal
      })
      if (controller !== own) return
      if (!Array.isArray(result.rows) || !Number.isFinite(result.total))
        throw new Error('The history response could not be read.')
      rows.value = result.rows
      pagination.value = { ...result.pagination, rowsNumber: result.total }
      error.value = null
      loaded.value = true
    } catch (cause) {
      if (controller !== own || own.signal.aborted) return
      error.value = classifyWorkspaceError(cause)
    } finally {
      if (controller === own) {
        controller = null
        loading.value = false
      }
    }
  }

  /** Reload the page currently shown (after a write or a retry). */
  function reload() {
    return request({ pagination: pagination.value })
  }

  watch(search, () => {
    clearTimeout(searchTimer)
    searchTimer = setTimeout(
      () => request({ pagination: { ...pagination.value, page: 1 } }),
      300
    )
  })

  onBeforeUnmount(() => {
    clearTimeout(searchTimer)
    controller?.abort()
  })

  return { rows, loading, loaded, error, search, pagination, request, reload }
}
