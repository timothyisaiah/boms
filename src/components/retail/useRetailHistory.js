import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { fetchRetailHistoryPage, formatRetailError } from '@/services/retail'

/**
 * Server-paged /api/history state for one retail record view
 * (ResponsiveRecordView in server mode: QTable at md+, cards below).
 *
 * Previous rows stay visible while a page loads or after a failed load.
 * Superseded requests are aborted and never change state.
 *
 * @param {'stockIssues'|'retailerMovements'} resource
 * @param {{ rowsPerPage?: number, searchDebounceMs?: number }} [options]
 */
export function useRetailHistory(resource, options = {}) {
  const { rowsPerPage = 25, searchDebounceMs = 350 } = options
  const rows = ref([])
  const loading = ref(false)
  const loaded = ref(false)
  const error = ref('')
  const search = ref('')
  const pagination = ref({
    page: 1,
    rowsPerPage,
    sortBy: null, // server default: newest first
    descending: true,
    rowsNumber: 0
  })
  let controller = null
  let searchTimer = null

  async function onRequest({ pagination: next }) {
    controller?.abort()
    const own = new AbortController()
    controller = own
    loading.value = true
    const q = String(search.value ?? '').trim()
    try {
      const result = await fetchRetailHistoryPage(
        resource,
        next,
        q ? { q } : {},
        { signal: own.signal }
      )
      if (controller !== own) return
      rows.value = result.rows
      pagination.value = result.pagination
      error.value = ''
      loaded.value = true
    } catch (cause) {
      if (controller !== own || own.signal.aborted) return
      error.value = formatRetailError(
        cause,
        'These records could not be loaded. Retry in a moment.'
      )
    } finally {
      if (controller === own) {
        controller = null
        loading.value = false
      }
    }
  }

  /** Reload the current page (e.g. after a write). */
  function refresh() {
    return onRequest({ pagination: pagination.value })
  }

  watch(search, () => {
    clearTimeout(searchTimer)
    searchTimer = setTimeout(
      () => onRequest({ pagination: { ...pagination.value, page: 1 } }),
      searchDebounceMs
    )
  })

  onMounted(refresh)
  onBeforeUnmount(() => {
    clearTimeout(searchTimer)
    controller?.abort()
    controller = null
  })

  return {
    rows,
    loading,
    loaded,
    error,
    search,
    pagination,
    onRequest,
    refresh
  }
}
