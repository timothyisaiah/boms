import { nextTick, ref, unref } from 'vue'

let generatedId = 0

function rootElement(target) {
  const value = unref(target)
  if (!value) return null
  return value.$el ?? value
}

function focusableIn(element) {
  if (!element) return null
  if (element.matches?.('input, textarea, select, button, [tabindex]'))
    return element
  return element.querySelector?.(
    'input:not([type="hidden"]), textarea, select, [tabindex]:not([tabindex="-1"])'
  )
}

/**
 * Move focus to a field by element id (QInput/QSelect `for` prop sets the id
 * on the native control). Returns true when something received focus.
 */
export function focusField(id) {
  const target = focusableIn(document.getElementById(id))
  if (!target) return false
  target.focus({ preventScroll: true })
  target.scrollIntoView?.({ block: 'center' })
  return true
}

/**
 * Read Quasar's rendered validation state (`.q-field--error`) inside a form
 * into `[{ id, label, message }]`. Native controls without an id get one so
 * the summary can link to them.
 */
export function collectFieldErrors(target) {
  const root = rootElement(target)
  if (!root?.querySelectorAll) return []
  return [...root.querySelectorAll('.q-field--error')].map(field => {
    const control = focusableIn(field.querySelector('.q-field__native, input'))
    if (control && !control.id) control.id = `boms-field-${++generatedId}`
    return {
      id: control?.id ?? '',
      label:
        field.querySelector('.q-field__label')?.textContent?.trim() || 'Field',
      message:
        field
          .querySelector(
            '.q-field__messages [role="alert"], .q-field__messages div'
          )
          ?.textContent?.trim() || 'Check this value.'
    }
  })
}

/**
 * Form error summary state.
 *
 * - `validate(formRef)`: runs QForm `validate()`, fills `errors` from the
 *   invalid fields and focuses the first one. Resolves true when valid.
 * - `fail(list, { focus })`: report business-rule errors
 *   (`[{ id, label, message }]`) and focus the first field (`'field'`,
 *   default) or the summary (`'summary'`, needs `summaryRef`).
 * - `clear()` after a successful submit or when the user resets the form.
 */
export function useFormErrors() {
  const errors = ref([])
  const summaryRef = ref(null)

  function clear() {
    errors.value = []
  }

  async function focusFirst(focus = 'field') {
    await nextTick()
    const first = errors.value.find(error => error.id)
    if (focus === 'field' && first && focusField(first.id)) return
    unref(summaryRef)?.focus?.()
  }

  async function fail(list, { focus = 'field' } = {}) {
    errors.value = list.map(error => ({ ...error }))
    await focusFirst(focus)
  }

  async function validate(formRef) {
    const form = unref(formRef)
    if (!form?.validate) return true
    const valid = await form.validate(false)
    if (valid) {
      clear()
      return true
    }
    await nextTick()
    await fail(collectFieldErrors(form))
    return false
  }

  return { errors, summaryRef, clear, fail, validate, focusFirst }
}
