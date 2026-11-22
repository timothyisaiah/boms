// Shared API fixture data and `/api` route mocking for browser specs.
//
// Every spec gets a fresh deep copy of the fixtures (createFixtures), so a
// test that mutates data can never leak into another test.
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

export const day = '2026-09-10T12:00:00.000Z'

export const ROLES = [
  'admin_owner',
  'operations_manager',
  'production_staff',
  'warehouse_staff',
  'sales_or_distribution_staff',
  'finance_accountant',
  'read_only_management'
]

function buildFixtures() {
  const variant = {
    id: 1,
    sku: 'TEST-500',
    variant_name: '500g Classic Jar',
    pack_size_grams: 500,
    flavor: 'Classic',
    packaging_type: 'Jar',
    product: { id: 1, name: 'Beecone Raw Natural Honey' }
  }
  const retailer = {
    id: 1,
    retailer_name: 'Ntinda Health Market',
    delivery_location: 'Ntinda, Kampala'
  }
  const material = {
    id: 1,
    name: 'Raw Honey',
    kind: 'raw_honey',
    unit_of_measure: 'kg'
  }
  const jar = {
    id: 2,
    name: '500g Jar',
    kind: 'packaging',
    unit_of_measure: 'piece'
  }
  const supplier = {
    id: 1,
    supplier_name: 'Honey Cooperative',
    supplier_kind: 'mixed'
  }
  const batch = {
    id: 1,
    batch_code: 'PB-20260910-001',
    started_at: day,
    completed_at: day,
    total_output_quantity: 20,
    total_input_cost: 110000,
    output_unit_cost: 5500,
    variant,
    inputs: [],
    outputs: []
  }
  const stock = {
    id: 1,
    quantity_produced: 20,
    quantity_remaining: 20,
    unit_cost: 5500,
    batch,
    variant,
    created_at: day
  }
  const openIssueLine = {
    retailer_id: 1,
    retailer_name: retailer.retailer_name,
    stock_issue_item_id: 1,
    stock_issue_id: 1,
    issue_reference: 'DN-001',
    issued_at: day,
    variant_id: 1,
    sku: variant.sku,
    variant_name: variant.variant_name,
    batch_code: batch.batch_code,
    quantity_open: 10,
    unit_cost: 5500,
    unit_price: 20000
  }
  const balance = {
    retailer_id: 1,
    retailer_name: retailer.retailer_name,
    remaining_quantity: 10,
    outstanding_amount: 50000,
    recognized_sales_value: 100000,
    remitted_amount: 50000,
    sold_quantity: 5,
    issued_quantity: 15,
    stock_cost: 55000,
    stock_value: 200000
  }
  const purchases = [
    {
      id: 1,
      purchase_reference: 'PUR-001',
      purchased_at: day,
      total_amount: 110000,
      supplier,
      items: [{ id: 1, material, quantity: 10 }]
    }
  ]
  const inventoryLots = [
    {
      id: 1,
      lot_code: 'H-001',
      quantity_remaining: 10,
      unit_cost: 10000,
      received_at: day,
      material,
      supplier
    },
    {
      id: 2,
      lot_code: 'J-001',
      quantity_remaining: 20,
      unit_cost: 500,
      received_at: day,
      material: jar,
      supplier
    }
  ]
  const stockIssues = [
    {
      id: 1,
      issue_reference: 'DN-001',
      issued_at: day,
      total_quantity: 15,
      total_cost: 82500,
      retailer,
      items: []
    }
  ]
  const reconciliations = [
    {
      id: 1,
      reconciliation_reference: 'REC-001',
      reconciled_at: day,
      retailer,
      total_sold_quantity: 5,
      total_sales_value: 100000,
      items: []
    }
  ]
  const workspaces = {
    operations: {
      mode: 'live',
      variants: [variant],
      materials: [material, jar],
      suppliers: [supplier],
      purchases,
      inventoryLots,
      batches: [batch],
      recipes: [
        {
          id: 1,
          variant_id: 1,
          name: '500g recipe',
          items: [
            { material_id: 1, quantity_per_unit: '0.5' },
            { material_id: 2, quantity_per_unit: '1' }
          ]
        }
      ]
    },
    retail: {
      mode: 'live',
      retailers: [retailer],
      finishedStock: [stock],
      stockIssues,
      retailerMovements: [
        {
          id: 1,
          retailer,
          batch,
          variant,
          movement_type: 'issue',
          quantity_delta: 15,
          unit_cost: 5500,
          moved_at: day
        }
      ]
    },
    finance: {
      mode: 'live',
      retailers: [retailer],
      openIssueLines: [openIssueLine],
      reconciliations,
      remittances: [],
      expenses: [],
      // `view=summary` additions (docs/audits/history-api.md §3).
      reconciliationOptions: reconciliations.map(
        ({ items: _items, ...option }) => ({
          ...option,
          retailer_id: option.retailer.id
        })
      ),
      historyCounts: {
        reconciliations: reconciliations.length,
        remittances: 0,
        expenses: 0
      },
      retailerBalances: [balance],
      profitSummary: {
        active_retailers: 1,
        recognized_sales_value: 100000,
        cost_of_goods_sold: 27500,
        gross_profit: 72500,
        operating_expenses: 0,
        net_profit: 72500,
        outstanding_amount: 50000,
        remaining_quantity: 10,
        stock_at_retailers_cost: 55000,
        stock_at_retailers_value: 200000
      },
      pricing: [
        {
          variant_id: 1,
          unit_price: 20000,
          effective_from: '2026-01-01T00:00:00.000Z'
        }
      ]
    },
    settings: {
      mode: 'live',
      variants: [variant],
      materials: [material, jar],
      recipes: [],
      pricing: []
    },
    // One-tap home: 2 products x sizes, supplies, one retailer holding jars.
    home: {
      mode: 'live',
      variants: [
        {
          id: 11,
          sku: 'BEE-RAW-60',
          variant_name: 'Raw Honey 60g',
          flavor: 'Classic',
          pack_size_grams: 60,
          current_price: '5000',
          barcode: '6151100000601',
          low_stock_threshold: 20
        },
        {
          id: 12,
          sku: 'BEE-RAW-400',
          variant_name: 'Raw Honey 400g',
          flavor: 'Classic',
          pack_size_grams: 400,
          current_price: '25000',
          barcode: null,
          low_stock_threshold: 10
        },
        {
          id: 13,
          sku: 'BEE-GIN-400',
          variant_name: 'Ginger Infused Honey 400g',
          flavor: 'Ginger Infused',
          pack_size_grams: 400,
          current_price: '30000',
          barcode: null,
          low_stock_threshold: 0
        }
      ],
      materialStock: [
        {
          id: 21,
          code: 'RAW-HONEY-KG',
          name: 'Raw Honey',
          kind: 'raw_honey',
          unit_of_measure: 'kg',
          purchase_unit_label: 'jerrican',
          purchase_unit_size: '20.000',
          on_hand: '30.000',
          low_stock_threshold: '20'
        },
        {
          id: 22,
          code: 'GINGER-POWDER-KG',
          name: 'Ginger Powder',
          kind: 'spice',
          unit_of_measure: 'kg',
          purchase_unit_label: null,
          purchase_unit_size: '1.000',
          on_hand: '0.500',
          low_stock_threshold: '0'
        },
        {
          id: 23,
          code: 'JAR-60',
          name: '60g Jar',
          kind: 'packaging',
          unit_of_measure: 'piece',
          purchase_unit_label: null,
          purchase_unit_size: '1.000',
          on_hand: '200.000',
          low_stock_threshold: '0'
        },
        {
          id: 24,
          code: 'JAR-400',
          name: '400g Jar',
          kind: 'packaging',
          unit_of_measure: 'piece',
          purchase_unit_label: null,
          purchase_unit_size: '1.000',
          on_hand: '10.000',
          low_stock_threshold: '0'
        },
        {
          id: 25,
          code: 'LABEL-60',
          name: '60g Label',
          kind: 'packaging',
          unit_of_measure: 'piece',
          purchase_unit_label: null,
          purchase_unit_size: '1.000',
          on_hand: '200.000',
          low_stock_threshold: '0'
        },
        {
          id: 26,
          code: 'LABEL-400',
          name: '400g Label',
          kind: 'packaging',
          unit_of_measure: 'piece',
          purchase_unit_label: null,
          purchase_unit_size: '1.000',
          on_hand: '50.000',
          low_stock_threshold: '0'
        }
      ],
      finishedByVariant: [
        { variant_id: 11, quantity: 120 },
        { variant_id: 12, quantity: 8 }
      ],
      recipes: [
        {
          id: 31,
          variant_id: 11,
          name: 'Raw 60g',
          items: [
            { material_id: 21, quantity_per_unit: '0.060000' },
            { material_id: 23, quantity_per_unit: '1.000000' },
            { material_id: 25, quantity_per_unit: '1.000000' }
          ]
        },
        {
          id: 32,
          variant_id: 12,
          name: 'Raw 400g',
          items: [
            { material_id: 21, quantity_per_unit: '0.400000' },
            { material_id: 24, quantity_per_unit: '1.000000' },
            { material_id: 26, quantity_per_unit: '1.000000' }
          ]
        },
        {
          id: 33,
          variant_id: 13,
          name: 'Ginger 400g',
          items: [
            { material_id: 21, quantity_per_unit: '0.380952' },
            { material_id: 22, quantity_per_unit: '0.019048' },
            { material_id: 24, quantity_per_unit: '1.000000' },
            { material_id: 26, quantity_per_unit: '1.000000' }
          ]
        }
      ],
      suppliers: [supplier],
      retailers: [retailer],
      retailerHoldings: [
        { retailer_id: 1, variant_id: 11, quantity: 30, unit_price: '5000' }
      ],
      retailerBalances: [{ retailer_id: 1, outstanding_amount: '20000' }]
    },
    dashboard: {
      mode: 'live',
      purchases,
      inventoryLots,
      batches: [batch],
      productionOutputs: [stock],
      stockIssues,
      retailers: [retailer],
      reconciliations,
      remittances: [],
      retailerBalances: [balance],
      openIssueLines: [openIssueLine],
      expenses: []
    }
  }
  const reports = {
    profit: {
      revenue: 100000,
      cogs: 27500,
      gross_profit: 72500,
      operating_expenses: 10000,
      net_profit: 62500
    },
    valuation: [{ category: 'raw_honey', value: 100000 }],
    retailers: [{ retailer_name: 'Ntinda', revenue: 100000 }],
    expenses: [{ expense_category: 'Transport', amount: 10000 }],
    aging: [{ retailer_name: 'Ntinda', outstanding: 50000 }],
    digest: { materials: [], variants: [], expiring: [] },
    movements: [
      {
        movement: 'received',
        item: 'Honey',
        quantity: 10,
        unit: 'kg',
        value: 100000
      }
    ],
    reconciliations: [],
    costTrend: []
  }
  return {
    variant,
    retailer,
    material,
    jar,
    supplier,
    batch,
    stock,
    openIssueLine,
    balance,
    workspaces,
    reports,
    users: [],
    // Shapes served by the management endpoints (`/api/materials` etc.).
    managedMaterials: [
      {
        ...material,
        code: 'RAW-HONEY',
        is_active: true,
        quantity_on_hand: 10,
        low_stock_threshold: 2
      },
      {
        ...jar,
        code: 'JAR-500',
        is_active: true,
        quantity_on_hand: 20,
        low_stock_threshold: 5
      }
    ],
    managedVariants: [{ ...variant, is_active: true }],
    products: [variant.product],
    partners: []
  }
}

/** Fresh, independent copy of all fixture data. */
export function createFixtures() {
  return structuredClone(buildFixtures())
}

export function createUser(role = 'admin_owner') {
  return {
    id: 'test',
    email: 'test@example.invalid',
    full_name: 'Test operator',
    role,
    is_active: true
  }
}

const wait = ms => new Promise(resolve => setTimeout(resolve, ms))

/**
 * Key used for delays/failures/overrides: the path after `/api/`, with the
 * workspace name appended for workspace requests, e.g. `workspace:finance`,
 * `reports`, `users`, `write`. Lookups try the specific key first and then
 * the generic one (`workspace`), so `{ workspace: 1500 }` delays every
 * workspace while `{ 'workspace:finance': 1500 }` delays only finance.
 */
export function apiKeys(url) {
  const base = url.pathname.replace(/^\/api\//, '')
  if (base === 'workspace')
    return [`workspace:${url.searchParams.get('name')}`, 'workspace']
  if (base === 'write')
    return [`write:${url.searchParams.get('action')}`, 'write']
  return [base]
}

function pick(map, keys) {
  for (const key of keys) if (map && key in map) return map[key]
  return undefined
}

async function fulfillFailure(route, failure) {
  if (failure === 'abort') return route.abort('failed')
  if (typeof failure === 'number')
    return route.fulfill({
      status: failure,
      json: { error: `Mocked ${failure} failure.` }
    })
  return route.fulfill({
    status: 500,
    json: { error: 'Mocked failure.' },
    ...failure
  })
}

/**
 * Serve the app's web fonts from disk when the dev server refuses them.
 *
 * Git worktrees share `node_modules` through a junction that resolves
 * outside Vite's `server.fs.allow` list, so font requests 403 and the app
 * falls back to system fonts. That changes text metrics enough to break
 * layout-sensitive tests (tab overflow, horizontal overflow). The dev server
 * is always tried first; disk is only a fallback, so a normal checkout is
 * unaffected.
 */
export async function serveLocalFonts(page) {
  await page.route(/\.woff2?(\?.*)?$/, async route => {
    const response = await route.fetch().catch(() => null)
    if (response?.ok()) return route.fulfill({ response })
    const pathname = decodeURIComponent(new URL(route.request().url()).pathname)
    const index = pathname.lastIndexOf('node_modules/')
    const file =
      index >= 0 ? join(process.cwd(), pathname.slice(index)) : undefined
    if (file && existsSync(file))
      return route.fulfill({
        body: readFileSync(file),
        contentType: file.endsWith('2') ? 'font/woff2' : 'font/woff'
      })
    return response ? route.fulfill({ response }) : route.abort()
  })
}

/**
 * Mock every `/api/**` request.
 *
 * @param {import('@playwright/test').Page} page
 * @param {object} [options]
 * @param {string|null} [options.role='admin_owner'] signed-in role; `null`
 *   makes `/api/auth` answer 401 (signed out).
 * @param {object} [options.user] extra fields merged into the signed-in user.
 * @param {Record<string, number>} [options.delays] ms to wait before
 *   answering, keyed as described in `apiKeys`.
 * @param {Record<string, number|'abort'|object>} [options.failures] status
 *   code, `'abort'` (network failure) or a `route.fulfill` options object.
 * @param {Record<string, object|Function>} [options.overrides] replacement
 *   JSON, or `(route, url, fixtures) => …` handler, keyed as in `apiKeys`.
 * @param {ReturnType<typeof createFixtures>} [options.fixtures] data to serve.
 * @param {boolean} [options.fonts=true] see `serveLocalFonts`.
 * @returns {Promise<{ fixtures, requests: Array<{key, method, url, body}> }>}
 */
export async function mockApi(page, options = {}) {
  const {
    role = 'admin_owner',
    user,
    delays = {},
    failures = {},
    overrides = {},
    fixtures = createFixtures(),
    fonts = true
  } = options
  const requests = []
  if (fonts) await serveLocalFonts(page)
  await page.route('**/api/**', async route => {
    const request = route.request()
    const url = new URL(request.url())
    const keys = apiKeys(url)
    requests.push({
      key: keys[0],
      method: request.method(),
      url: url.pathname + url.search,
      body: request.postData()
    })
    const delay = pick(delays, keys)
    if (delay) await wait(delay)
    const failure = pick(failures, keys)
    if (failure !== undefined) return fulfillFailure(route, failure)
    const override = pick(overrides, keys)
    if (typeof override === 'function') return override(route, url, fixtures)
    if (override !== undefined) return route.fulfill({ json: override })
    switch (url.pathname) {
      case '/api/auth':
        if (url.searchParams.get('action') === 'logout')
          return route.fulfill({ status: 204 })
        return role
          ? route.fulfill({ json: { user: { ...createUser(role), ...user } } })
          : route.fulfill({
              status: 401,
              json: { error: 'Not signed in.' }
            })
      case '/api/users':
        if (request.method() === 'GET')
          return route.fulfill({ json: { users: fixtures.users } })
        break
      case '/api/workspace':
        return route.fulfill({
          json: fixtures.workspaces[url.searchParams.get('name')]
        })
      case '/api/reports':
        return route.fulfill({ json: fixtures.reports })
      case '/api/materials':
        if (request.method() === 'GET')
          return route.fulfill({
            json: { materials: fixtures.managedMaterials }
          })
        break
      case '/api/variants':
        if (request.method() === 'GET')
          return route.fulfill({
            json: {
              variants: fixtures.managedVariants,
              products: fixtures.products
            }
          })
        break
      case '/api/partners':
        if (request.method() === 'GET')
          return route.fulfill({ json: { partners: fixtures.partners } })
        break
    }
    return route.fulfill({ status: 201, json: { id: 99 } })
  })
  return { fixtures, requests }
}
