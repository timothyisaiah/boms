import { apiRequest } from '@/lib/api'

const listOf = value => (Array.isArray(value) ? value : [])

/** Shape of the home workspace before the first successful load. */
export function emptyHomeWorkspace() {
  return {
    variants: [],
    materialStock: [],
    finishedByVariant: [],
    recipes: [],
    suppliers: [],
    retailers: [],
    retailerHoldings: [],
    retailerBalances: []
  }
}

/** Bounded totals for the one-tap home screen (GET /api/workspace?name=home). */
export async function fetchHomeWorkspace(options = {}) {
  const data = await apiRequest('workspace?name=home', options)
  const empty = emptyHomeWorkspace()
  return Object.fromEntries(
    Object.keys(empty).map(key => [key, listOf(data?.[key])])
  )
}

/** `{ [variantId]: jarsInStore }` */
export function finishedStockMap(rows) {
  const map = {}
  for (const row of listOf(rows))
    map[Number(row.variant_id)] = Number(row.quantity) || 0
  return map
}
