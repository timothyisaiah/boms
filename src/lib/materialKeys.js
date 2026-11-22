// What a material physically is, independent of its code or spelling, so
// "RAW Honey" (RAW-20) and "Raw Honey" (RAW-HONEY-KG), or "60g Sticker" and
// "60g Label", are recognised as the same input. Pure (Node + browser).

/** Jar/label size in grams from a name or code: 60g, 400g, 1kg, 1 litre, 1000. */
export function sizeInGrams(text) {
  const value = String(text ?? '').toLowerCase()
  const kg = value.match(/(\d+(?:\.\d+)?)\s*(kg|kilo|l\b|litre|liter|ltr)/)
  if (kg) return Math.round(Number(kg[1]) * 1000)
  const grams = value.match(/(\d+)\s*g\b/)
  if (grams) return Number(grams[1])
  const bare = value.match(/(?:^|[^\d])(60|250|400|500|1000)(?:[^\d]|$)/)
  return bare ? Number(bare[1]) : null
}

/**
 * Stable key: 'raw_honey', 'spice:ginger', 'jar:400', 'label:60', 'lid:…', or
 * `code:<CODE>` when the material is not recognised (never merged).
 */
export function materialKey(material) {
  const kind = String(material?.kind ?? '')
  const text = `${material?.name ?? ''} ${material?.code ?? ''}`.toLowerCase()
  if (kind === 'raw_honey') return 'raw_honey'
  if (kind === 'spice') {
    const word = text
      .match(/[a-z]{3,}/g)
      ?.find(w => !['powder', 'spice', 'kg'].includes(w))
    return `spice:${word ?? 'spice'}`
  }
  const size = sizeInGrams(text)
  if (size) {
    if (/\b(label|sticker)s?\b|label-|sticker-/.test(text))
      return `label:${size}`
    if (/\bjars?\b|jar-/.test(text)) return `jar:${size}`
    if (/\blids?\b|lid-/.test(text)) return `lid:${size}`
  }
  return `code:${String(material?.code ?? material?.id ?? '').toUpperCase()}`
}

/**
 * Groups of active materials that are the same thing. Each group lists the
 * preferred material first: the one holding stock, then the one with more
 * history, then the oldest. `stats` is `{ [id]: { onHand, history } }`.
 */
export function duplicateGroups(materials, stats = {}) {
  const groups = new Map()
  for (const material of materials ?? []) {
    if (material.is_active === false) continue
    const key = materialKey(material)
    if (key.startsWith('code:')) continue
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(material)
  }
  const score = m =>
    stats[m.id] ?? { onHand: Number(m.on_hand) || 0, history: 0 }
  return [...groups.entries()]
    .filter(([, items]) => items.length > 1)
    .map(([key, items]) => ({
      key,
      items: [...items].sort(
        (a, b) =>
          Number(score(b).onHand > 0) - Number(score(a).onHand > 0) ||
          score(b).history - score(a).history ||
          Number(a.id) - Number(b.id)
      )
    }))
}
