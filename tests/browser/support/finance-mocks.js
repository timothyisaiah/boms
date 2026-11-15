// Finance-specific API mocks: `/api/history` pages for the finance record
// views. Use after `mockApi(page)`; later routes take priority.
import { day } from './fixtures.js'

/** `count` reconciliation rows shaped like the history projection. */
export function reconciliationRows(retailer, count) {
  return Array.from({ length: count }, (_, index) => ({
    id: index + 1,
    reconciliation_reference: `REC-${String(index + 1).padStart(3, '0')}`,
    reconciled_at: day,
    retailer,
    total_sold_quantity: index + 1,
    total_returned_quantity: 0,
    total_damaged_quantity: 0,
    total_remaining_quantity: 1,
    total_sales_value: (index + 1) * 20000,
    items: [
      {
        id: index + 1,
        variant: { sku: 'TEST-500' },
        batch: { batch_code: 'PB-20260910-001' },
        quantity_sold: index + 1,
        quantity_remaining: 1
      }
    ]
  }))
}

/**
 * Serve `/api/history?resource=…` from `data` (`{ reconciliations: [...],
 * remittances: [...], expenses: [...] }`), honouring limit/offset and a
 * case-insensitive `q` over every string value. Returns the recorded
 * request URLs.
 */
export async function mockFinanceHistory(page, data = {}) {
  const requests = []
  await page.route('**/api/history?*', route => {
    const url = new URL(route.request().url())
    requests.push(url)
    const resource = url.searchParams.get('resource')
    const limit = Number(url.searchParams.get('limit') ?? 25)
    const offset = Number(url.searchParams.get('offset') ?? 0)
    const q = (url.searchParams.get('q') ?? '').toLowerCase()
    const all = (data[resource] ?? []).filter(
      row => !q || JSON.stringify(row).toLowerCase().includes(q)
    )
    return route.fulfill({
      json: {
        rows: all.slice(offset, offset + limit),
        total: all.length,
        limit,
        offset,
        sort: url.searchParams.get('sort') ?? 'reconciled_at',
        order: url.searchParams.get('order') ?? 'desc'
      }
    })
  })
  return requests
}
