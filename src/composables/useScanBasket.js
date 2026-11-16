import { computed, ref } from 'vue'
import { findVariantByCode, jarLabel } from '@/lib/simpleOps'

/**
 * Scan-to-basket state shared by "Give to retailer" and "Sell". A scan adds
 * one jar of the matching variant (the barcode is shared by every jar of a
 * variant), capped at what is in store.
 *
 * @param {() => object[]} variants
 * @param {() => Record<number, number> | null} limits
 * @param {import('vue').Ref} picker JarPicker ref (for the row highlight)
 */
export function useScanBasket(variants, limits, picker) {
  const counts = ref({})
  const feedback = ref(null)
  const unknownCode = ref('')
  // Barcodes linked during this session, before the workspace reloads.
  const linked = ref({})

  const withLinks = computed(() =>
    variants().map(v =>
      linked.value[v.id] ? { ...v, barcode: linked.value[v.id] } : v
    )
  )

  function add(variant) {
    const current = Number(counts.value[variant.id]) || 0
    const max = limits() ? Number(limits()[variant.id]) || 0 : Infinity
    if (current >= max) {
      feedback.value = {
        tone: 'warning',
        text: `No more ${jarLabel(variant)} in store.`
      }
      return
    }
    counts.value = { ...counts.value, [variant.id]: current + 1 }
    picker.value?.flash(variant.id)
    feedback.value = {
      tone: 'success',
      text: `✓ ${jarLabel(variant)} — ${current + 1} in this list`
    }
  }

  function onScan(code) {
    const variant = findVariantByCode(withLinks.value, code)
    if (variant) {
      unknownCode.value = ''
      add(variant)
      return
    }
    unknownCode.value = code
    feedback.value = {
      tone: 'warning',
      text: `Barcode ${code} is not linked to a product yet.`
    }
  }

  function onLinked(variantId, code) {
    linked.value = { ...linked.value, [variantId]: code }
    unknownCode.value = ''
    const variant = withLinks.value.find(
      v => Number(v.id) === Number(variantId)
    )
    if (variant) add(variant)
  }

  function reset() {
    counts.value = {}
    feedback.value = null
    unknownCode.value = ''
  }

  return { counts, feedback, unknownCode, onScan, onLinked, reset }
}
