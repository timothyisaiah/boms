import {
  getCurrentInstance,
  onBeforeUnmount,
  onMounted,
  reactive,
  unref
} from 'vue'
import { onBeforeRouteLeave } from 'vue-router'
import { getWriteIdentity } from '@/services/writes'

/**
 * Confirm before leaving a route with unsaved input, and ask the browser to
 * confirm reload/close (`beforeunload`) while dirty.
 *
 * Quasar's Dialog plugin is not installed in this app, so the confirmation
 * is rendered by <DirtyGuardDialog> (a QDialog). Most pages should simply
 * render `<DirtyGuardDialog :when="draft.isDirty.value" />`, which calls this
 * composable; use the composable directly only for a custom dialog.
 *
 * @param {import('vue').Ref<boolean>|(() => boolean)} isDirty
 * @returns {{ prompt: { open: boolean }, confirm(): void, cancel(): void }}
 */
export function useDirtyGuard(isDirty) {
  const dirty = () =>
    Boolean(typeof isDirty === 'function' ? isDirty() : unref(isDirty))
  const prompt = reactive({ open: false })
  let settle = null

  function finish(leave) {
    prompt.open = false
    const resolve = settle
    settle = null
    resolve?.(leave)
  }

  onBeforeRouteLeave(() => {
    // After sign-out the user's drafts are already cleared; never block the
    // redirect to the sign-in page.
    if (!dirty() || !getWriteIdentity()) return true
    settle?.(false)
    prompt.open = true
    return new Promise(resolve => {
      settle = resolve
    })
  })

  function onBeforeUnload(event) {
    if (!dirty()) return
    event.preventDefault()
    // Required by some browsers to show the native prompt.
    event.returnValue = ''
  }

  if (getCurrentInstance()) {
    onMounted(() => window.addEventListener('beforeunload', onBeforeUnload))
    onBeforeUnmount(() => {
      window.removeEventListener('beforeunload', onBeforeUnload)
      if (settle) finish(false)
    })
  }

  return {
    prompt,
    confirm: () => finish(true),
    cancel: () => finish(false)
  }
}
