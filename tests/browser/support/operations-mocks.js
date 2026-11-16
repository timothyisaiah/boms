// Operations summary view and /api/history mocks (docs/audits/history-api.md).
//
// mockApi serves the full workspace payload for every `view`; these handlers
// answer `view=summary` without the histories (plus `historyCounts`) and page,
// sort, search and date-filter the purchase and batch histories like the
// server, recording every history request's parameters.
import { createFixtures } from './fixtures.js'

const SORTS = {
  purchases: {
    default: 'purchased_at',
    keys: {
      purchased_at: row => row.purchased_at,
      purchase_reference: row => row.purchase_reference,
      status: row => row.status,
      total_amount: row => Number(row.total_amount),
      supplier_name: row => row.supplier?.supplier_name
    },
    date: row => row.purchased_at,
    search: row => [
      row.purchase_reference,
      row.notes,
      row.supplier?.supplier_name
    ]
  },
  batches: {
    default: 'started_at',
    keys: {
      started_at: row => row.started_at,
      completed_at: row => row.completed_at,
      batch_code: row => row.batch_code,
      status: row => row.status,
      total_output_quantity: row => Number(row.total_output_quantity),
      total_input_cost: row => Number(row.total_input_cost),
      output_unit_cost: row => Number(row.output_unit_cost)
    },
    date: row => row.started_at,
    search: row => [
      row.batch_code,
      row.notes,
      row.variant?.sku,
      row.variant?.variant_name
    ]
  }
}

const compare = (a, b) =>
  a === b ? 0 : a === undefined || a === null ? 1 : a < b ? -1 : 1

/** Summary payload for the operations workspace (no history arrays). */
export function operationsSummary(fixtures, history) {
  const { purchases: _p, batches: _b, ...rest } = fixtures.workspaces.operations
  return {
    ...rest,
    view: 'summary',
    historyCounts: {
      purchases: history.purchases.length,
      batches: history.batches.length
    }
  }
}

/** `count` purchases with distinct references and descending dates. */
export function makePurchases(fixtures, count) {
  const base = fixtures.workspaces.operations.purchases[0]
  return Array.from({ length: count }, (_, index) => ({
    ...structuredClone(base),
    id: index + 1,
    purchase_reference: `PUR-${String(index + 1).padStart(3, '0')}`,
    purchased_at: new Date(
      Date.UTC(2026, 8, 30 - (index % 28), 12)
    ).toISOString(),
    total_amount: 1000 * (index + 1)
  }))
}

/**
 * mockApi `overrides` for the operations summary and history endpoints.
 *
 * @param {object} [options]
 * @param {ReturnType<typeof createFixtures>} [options.fixtures]
 * @param {{ purchases?: object[], batches?: object[] }} [options.history]
 *   rows served by /api/history (default: the fixture workspace arrays)
 */
export function operationsMocks({ fixtures = createFixtures(), history } = {}) {
  const data = {
    purchases: fixtures.workspaces.operations.purchases,
    batches: fixtures.workspaces.operations.batches,
    ...history
  }
  const historyRequests = []
  const overrides = {
    'workspace:operations': (route, url) =>
      route.fulfill({
        json:
          url.searchParams.get('view') === 'summary'
            ? operationsSummary(fixtures, data)
            : fixtures.workspaces.operations
      }),
    history: (route, url) => {
      const params = Object.fromEntries(url.searchParams)
      historyRequests.push(params)
      const spec = SORTS[params.resource]
      if (!spec)
        return route.fulfill({ status: 404, json: { error: 'Unknown' } })
      const sort = params.sort ?? spec.default
      if (!spec.keys[sort])
        return route.fulfill({ status: 422, json: { error: 'Bad sort.' } })
      const order = params.order ?? 'desc'
      const limit = Math.min(100, Math.max(1, Number(params.limit ?? 25)))
      const offset = Number(params.offset ?? 0)
      const q = params.q?.toLowerCase()
      let rows = [...data[params.resource]]
      if (params.from)
        rows = rows.filter(
          row => new Date(spec.date(row)) >= new Date(params.from)
        )
      if (params.to)
        rows = rows.filter(
          row => new Date(spec.date(row)) <= new Date(params.to)
        )
      if (q)
        rows = rows.filter(row =>
          spec.search(row).some(value =>
            String(value ?? '')
              .toLowerCase()
              .includes(q)
          )
        )
      rows.sort((a, b) => {
        const result =
          compare(spec.keys[sort](a), spec.keys[sort](b)) || compare(a.id, b.id)
        return order === 'asc' ? result : -result
      })
      return route.fulfill({
        json: {
          rows: rows.slice(offset, offset + limit),
          total: rows.length,
          limit,
          offset,
          sort,
          order
        }
      })
    }
  }
  return { fixtures, data, historyRequests, overrides }
}
