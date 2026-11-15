import { onBeforeUnmount, ref, watch } from 'vue'
import { HISTORY_DEFAULT_LIMIT, loadHistoryPage } from '@/services/history'
import { formatFinanceError } from '@/services/finance'

/**
 * Server-paged history for one ResponsiveRecordView (GET /api/history).
 * Rows from the previous page stay visible while a request is in flight and
 * after a failure (MF-15). `search` is sent as `q`.
 */
export function useHistoryTable(resource) {
  const rows = ref([])
  const loading = ref(false)
  const error = ref('')
  const search = ref('')
  const pagination = ref({
    page: 1,
    rowsPerPage: HISTORY_DEFAULT_LIMIT,
    sortBy: null, // server default: date desc
    descending: true,
    rowsNumber: 0
  })
  let controller = null

  async function onRequest({ pagination: next }) {
    controller?.abort()
    const own = new AbortController()
    controller = own
    loading.value = true
    try {
      const result = await loadHistoryPage(
        resource,
        next,
        { q: search.value.trim() },
        { signal: own.signal }
      )
      if (controller !== own) return
      rows.value = Array.isArray(result.rows) ? result.rows : []
      const finite = (value, fallback) =>
        Number.isFinite(value) ? value : fallback
      pagination.value = {
        ...result.pagination,
        page: finite(result.pagination.page, 1),
        rowsPerPage: finite(
          result.pagination.rowsPerPage,
          next.rowsPerPage ?? HISTORY_DEFAULT_LIMIT
        ),
        rowsNumber: finite(result.pagination.rowsNumber, rows.value.length)
      }
      error.value = ''
    } catch (cause) {
      if (own.signal.aborted) return
      error.value = formatFinanceError(
        cause,
        'Unable to load these records right now.'
      )
    } finally {
      if (controller === own) {
        loading.value = false
        controller = null
      }
    }
  }

  /** Reload the current page (after a write or on activation). */
  function refresh() {
    return onRequest({ pagination: pagination.value })
  }

  watch(search, () =>
    onRequest({ pagination: { ...pagination.value, page: 1 } })
  )

  onBeforeUnmount(() => controller?.abort())

  return { rows, loading, error, search, pagination, onRequest, refresh }
}
