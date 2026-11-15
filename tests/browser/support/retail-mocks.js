// Retail (/retail) mocks for the bounded reads in docs/audits/history-api.md:
// `GET /api/workspace?name=retail&view=summary` and
// `GET /api/history?resource=stockIssues|retailerMovements`.
// Both are derived from `fixtures.workspaces.retail`, so a test shapes data
// once (e.g. pushes a retailer or movement) and every read agrees.
import { createFixtures, mockApi } from './fixtures.js'

const HISTORY = {
  stockIssues: {
    key: 'stockIssues',
    date: 'issued_at',
    sort: {
      issued_at: row => row.issued_at,
      issue_reference: row => row.issue_reference,
      status: row => row.status,
      total_quantity: row => Number(row.total_quantity),
      total_cost: row => Number(row.total_cost),
      retailer_name: row => row.retailer?.retailer_name
    },
    search: row => [row.issue_reference, row.notes, row.retailer?.retailer_name]
  },
  retailerMovements: {
    key: 'retailerMovements',
    date: 'moved_at',
    sort: {
      moved_at: row => row.moved_at,
      movement_type: row => row.movement_type,
      quantity_delta: row => Number(row.quantity_delta),
      unit_cost: row => Number(row.unit_cost),
      retailer_name: row => row.retailer?.retailer_name,
      sku: row => row.variant?.sku
    },
    search: row => [
      row.retailer?.retailer_name,
      row.variant?.sku,
      row.variant?.variant_name,
      row.batch?.batch_code,
      row.movement_type,
      row.notes
    ]
  }
}

/** Server-equivalent `retailerStockPositions` from the fixture movements. */
export function retailerStockPositions(retail) {
  const byRetailer = new Map()
  for (const movement of retail.retailerMovements ?? []) {
    const retailer = movement.retailer
    const entry = byRetailer.get(retailer.id) ?? {
      retailer_id: retailer.id,
      retailer_name: retailer.retailer_name,
      delivery_location: retailer.delivery_location ?? null,
      is_active: true,
      total_units: 0,
      lines: new Map()
    }
    entry.total_units += Number(movement.quantity_delta)
    const lineKey = `${movement.variant.id}::${movement.batch.id}`
    const line = entry.lines.get(lineKey) ?? {
      product_variant_id: movement.variant.id,
      sku: movement.variant.sku,
      variant_name: movement.variant.variant_name,
      production_batch_id: movement.batch.id,
      batch_code: movement.batch.batch_code,
      quantity: 0
    }
    line.quantity += Number(movement.quantity_delta)
    entry.lines.set(lineKey, line)
    byRetailer.set(retailer.id, entry)
  }
  return [...byRetailer.values()]
    .map(entry => ({
      ...entry,
      lines: [...entry.lines.values()]
        .filter(line => line.quantity !== 0)
        .sort((a, b) => b.quantity - a.quantity)
    }))
    .sort(
      (a, b) =>
        b.total_units - a.total_units ||
        a.retailer_name.localeCompare(b.retailer_name)
    )
}

/** `view=summary` payload for the retail workspace. */
export function retailSummary(fixtures) {
  const retail = fixtures.workspaces.retail
  return {
    mode: 'live',
    view: 'summary',
    retailers: retail.retailers,
    finishedStock: retail.finishedStock.filter(
      stock => Number(stock.quantity_remaining) > 0
    ),
    historyCounts: {
      stockIssues: retail.stockIssues.length,
      retailerMovements: retail.retailerMovements.length
    },
    retailerStockPositions: retailerStockPositions(retail)
  }
}

/** One `/api/history` page, honouring limit/offset/sort/order/q. */
export function retailHistoryPage(fixtures, url) {
  const params = url.searchParams
  const spec = HISTORY[params.get('resource')]
  if (!spec) return { status: 404, json: { error: 'Unknown resource.' } }
  const limit = Math.min(100, Math.max(1, Number(params.get('limit') ?? 25)))
  const offset = Number(params.get('offset') ?? 0)
  const sort = params.get('sort') ?? spec.date
  const order = params.get('order') ?? 'desc'
  if (!spec.sort[sort])
    return { status: 422, json: { error: `Unknown sort: ${sort}` } }
  const q = (params.get('q') ?? '').trim().toLowerCase()
  const value = spec.sort[sort]
  const rows = fixtures.workspaces.retail[spec.key]
    .filter(
      row =>
        !q ||
        spec
          .search(row)
          .filter(Boolean)
          .some(text => String(text).toLowerCase().includes(q))
    )
    .sort((a, b) => {
      const left = value(a)
      const right = value(b)
      const compared = left === right ? a.id - b.id : left < right ? -1 : 1
      return order === 'asc' ? compared : -compared
    })
  return {
    status: 200,
    json: {
      rows: rows.slice(offset, offset + limit),
      total: rows.length,
      limit,
      offset,
      sort,
      order
    }
  }
}

/** `mockApi` overrides serving the retail summary view and history pages. */
export function retailOverrides() {
  return {
    'workspace:retail': (route, url, fixtures) =>
      route.fulfill({
        json:
          url.searchParams.get('view') === 'summary'
            ? retailSummary(fixtures)
            : fixtures.workspaces.retail
      }),
    history: (route, url, fixtures) => {
      const { status, json } = retailHistoryPage(fixtures, url)
      return route.fulfill({ status, json })
    }
  }
}

/** `mockApi` with the retail summary/history overrides merged in. */
export function mockRetailApi(page, options = {}) {
  return mockApi(page, {
    ...options,
    fixtures: options.fixtures ?? createFixtures(),
    overrides: { ...retailOverrides(), ...options.overrides }
  })
}
