import { computed, ref } from 'vue'
import {
  isWriteLocked,
  retryWrite,
  writeAction,
  writeStates
} from '@/services/writes'

/**
 * Submit state for a one-tap home flow. Keeps the idempotent retry contract of
 * writeAction: an uncertain (network/5xx) outcome is retried with the same
 * key and body, never resubmitted as a new record.
 */
export function useFlowWrite(action) {
  const submitting = ref(false)
  const error = ref('')
  const done = ref(null)
  let lastDescribe = null
  const retryable = computed(
    () => !done.value && isWriteLocked(action) && !submitting.value
  )

  async function attempt(call, describe) {
    submitting.value = true
    error.value = ''
    try {
      const result = await call()
      done.value = describe(result)
      return result
    } catch (cause) {
      error.value =
        cause?.message ||
        writeStates[action]?.message ||
        'This could not be saved. Try again.'
      return null
    } finally {
      submitting.value = false
    }
  }

  return {
    submitting,
    error,
    done,
    retryable,
    /** `describe(result)` returns the success screen `{ title, lines }`. */
    submit(body, describe) {
      lastDescribe = describe
      return attempt(() => writeAction(action, body), describe)
    },
    retry: () =>
      attempt(
        () => retryWrite(action),
        lastDescribe ??
          (() => ({ title: 'Saved', lines: ['Your earlier entry was saved.'] }))
      ),
    reset() {
      error.value = ''
      done.value = null
    }
  }
}
