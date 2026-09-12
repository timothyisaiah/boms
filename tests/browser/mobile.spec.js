import { test, expect } from '@playwright/test'
import { validateAction } from '../../server/validation.ts'
const day = '2026-09-10T12:00:00.000Z'
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
const open = {
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
  issued_quantity: 15
}
const workspaces = {
  operations: {
    mode: 'live',
    variants: [variant],
    materials: [material, jar],
    suppliers: [supplier],
    purchases: [
      {
        id: 1,
        purchase_reference: 'PUR-001',
        purchased_at: day,
        total_amount: 110000,
        supplier,
        items: [{ id: 1, material, quantity: 10 }]
      }
    ],
    inventoryLots: [
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
    ],
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
    stockIssues: [
      {
        id: 1,
        issue_reference: 'DN-001',
        issued_at: day,
        total_quantity: 15,
        total_cost: 82500,
        retailer,
        items: []
      }
    ],
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
    openIssueLines: [open],
    reconciliations: [
      {
        id: 1,
        reconciliation_reference: 'REC-001',
        reconciled_at: day,
        retailer,
        total_sold_quantity: 5,
        total_sales_value: 100000,
        items: []
      }
    ],
    remittances: [],
    expenses: [],
    retailerBalances: [balance],
    profitSummary: {
      active_retailers: 1,
      recognized_sales_value: 100000,
      cost_of_goods_sold: 27500,
      gross_profit: 72500,
      operating_expenses: 0,
      net_profit: 72500,
      outstanding_amount: 50000
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
  }
}
workspaces.dashboard = {
  mode: 'live',
  purchases: workspaces.operations.purchases,
  inventoryLots: workspaces.operations.inventoryLots,
  batches: [batch],
  productionOutputs: [stock],
  stockIssues: workspaces.retail.stockIssues,
  retailers: [retailer],
  reconciliations: workspaces.finance.reconciliations,
  remittances: [],
  retailerBalances: [balance],
  openIssueLines: [open],
  expenses: []
}
async function setup(page) {
  await page.route('**/api/**', route => {
    const url = new URL(route.request().url())
    if (url.pathname === '/api/auth')
      return route.fulfill({
        json: {
          user: {
            id: 'test',
            email: 'test@example.invalid',
            full_name: 'Test operator',
            role: 'admin_owner',
            is_active: true
          }
        }
      })
    if (url.pathname === '/api/users')
      return route.fulfill({ json: { users: [] } })
    if (url.pathname === '/api/workspace')
      return route.fulfill({ json: workspaces[url.searchParams.get('name')] })
    if (url.pathname === '/api/reports')
      return route.fulfill({
        json: {
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
      })
    return route.fulfill({ status: 201, json: { id: 99 } })
  })
}
for (const width of [375, 390, 1280])
  test(`all workspaces fit at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 })
    await setup(page)
    const errors = []
    page.on('pageerror', e => errors.push(e.message))
    for (const route of [
      '/',
      '/operations',
      '/retail',
      '/finance',
      '/admin',
      '/access-denied'
    ]) {
      await page.goto(`/#${route}`)
      await expect(page.locator('.q-page')).toBeVisible()
      await expect
        .poll(() =>
          page.evaluate(
            () => document.documentElement.scrollWidth <= window.innerWidth
          )
        )
        .toBe(true)
      await page.screenshot({
        path: `test-results/${width}-${route.replaceAll('/', '') || 'dashboard'}.png`,
        fullPage: true
      })
    }
    expect(errors).toEqual([])
  })
test('phone receipt uses inline validation and retries the original action only once', async ({
  page
}) => {
  await page.setViewportSize({ width: 375, height: 844 })
  await setup(page)
  const calls = []
  await page.route('**/api/write?*', async route => {
    calls.push({
      key: route.request().headers()['idempotency-key'],
      body: route.request().postDataJSON()
    })
    if (calls.length === 1) await route.abort('failed')
    else await route.fulfill({ status: 201, json: { id: 123 } })
  })
  await page.goto('/#/operations')
  await page.getByRole('tab', { name: 'Receipt form' }).click()
  await page
    .getByRole('button', { name: 'Record purchase', exact: true })
    .click()
  await expect(page.getByText('This field is required.').first()).toBeVisible()
  expect(calls).toHaveLength(0)
  await page.getByLabel('Supplier', { exact: true }).click()
  await page
    .getByRole('option')
    .filter({ hasText: 'Honey Cooperative' })
    .click()
  await page.getByLabel('Material', { exact: true }).click()
  await page.getByRole('option').filter({ hasText: 'Raw Honey' }).click()
  await page.getByLabel('Quantity', { exact: true }).fill('10')
  await page.getByLabel('Unit cost (UGX)', { exact: true }).fill('10000')
  await expect(page.getByLabel('Quantity', { exact: true })).toHaveAttribute(
    'inputmode',
    'decimal'
  )
  await page
    .getByRole('button', { name: 'Record purchase', exact: true })
    .click()
  await expect(
    page.getByRole('button', { name: 'Retry saved submission' })
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Record purchase', exact: true })
  ).toBeDisabled()
  await page.getByRole('button', { name: 'Retry saved submission' }).click()
  await expect(page.getByText('Saved successfully.')).toBeVisible()
  expect(calls).toHaveLength(2)
  expect(calls[0]).toEqual(calls[1])
  await expect(page.getByLabel('Quantity', { exact: true })).toHaveValue('')
})
test('recipe inputs prefill and stay editable; reconciliation price is readonly', async ({
  page
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await setup(page)
  await page.goto('/#/operations')
  await page.getByRole('tab', { name: 'Batch form' }).click()
  await page.getByLabel('Finished variant', { exact: true }).click()
  await page.getByRole('option').filter({ hasText: '500g Classic Jar' }).click()
  await page.getByLabel('Jars produced', { exact: true }).fill('20')
  await expect(page.getByLabel('Quantity consumed').first()).toHaveValue(
    '10.000'
  )
  await page.getByLabel('Quantity consumed').first().fill('10.2')
  await expect(page.getByLabel('Quantity consumed').first()).toHaveValue('10.2')
  await page.goto('/#/finance')
  await page.getByRole('tab', { name: /Reconciliation/ }).click()
  await expect(
    page.getByLabel('Variant price on reconciliation date')
  ).toHaveAttribute('readonly', '')
  await expect(page.getByLabel('Expired', { exact: true })).toHaveAttribute(
    'inputmode',
    'numeric'
  )
})

test('all six phone forms send payloads accepted by the API schema', async ({
  page
}) => {
  await page.setViewportSize({ width: 375, height: 844 })
  await setup(page)
  const posted = []
  await page.route('**/api/write?*', async route => {
    const action = new URL(route.request().url()).searchParams.get('action')
    validateAction(action, route.request().postDataJSON())
    posted.push(action)
    await route.fulfill({ status: 201, json: { id: 123 } })
  })
  const choose = async (label, text) => {
    await expect(page.getByLabel(label, { exact: true })).toHaveCount(1)
    await page.getByLabel(label, { exact: true }).click()
    await page.getByRole('option').filter({ hasText: text }).first().click()
  }
  await page.goto('/#/operations')
  await page.getByRole('tab', { name: 'Receipt form' }).click()
  await choose('Supplier', 'Honey Cooperative')
  await choose('Material', 'Raw Honey')
  await page.getByLabel('Quantity', { exact: true }).fill('10')
  await page.getByLabel('Unit cost (UGX)', { exact: true }).fill('10000')
  await page
    .getByRole('button', { name: 'Record purchase', exact: true })
    .click()
  await expect.poll(() => posted.length).toBe(1)
  await page.getByRole('tab', { name: 'Batch form' }).click()
  await choose('Finished variant', '500g Classic Jar')
  await page.getByLabel('Jars produced', { exact: true }).fill('20')
  await page
    .getByRole('button', { name: 'Create production batch', exact: true })
    .click()
  await expect.poll(() => posted.length).toBe(2)
  await page.goto('/#/retail')
  await page.getByRole('tab', { name: 'Issue stock', exact: true }).click()
  await choose('Retail partner', 'Ntinda')
  await choose('Finished batch', 'PB-20260910')
  await page.getByLabel('Jars issued', { exact: true }).fill('10')
  await page.getByRole('button', { name: 'Issue stock', exact: true }).click()
  await expect.poll(() => posted.length).toBe(3)
  await page.goto('/#/finance')
  await page.getByRole('tab', { name: 'Reconciliation', exact: true }).click()
  await choose('Retail partner', 'Ntinda')
  await choose('Issued stock line', 'DN-001')
  await page.getByLabel('Sold', { exact: true }).fill('5')
  await page.getByLabel('Returned', { exact: true }).fill('1')
  await page.getByLabel('Damaged', { exact: true }).fill('1')
  await page.getByLabel('Expired', { exact: true }).fill('1')
  await page.getByLabel('Remaining', { exact: true }).fill('2')
  await page.getByLabel('Return / loss reason').fill('Shelf check')
  await page
    .getByRole('button', { name: 'Record reconciliation', exact: true })
    .click()
  await expect.poll(() => posted.length).toBe(4)
  await page.getByRole('tab', { name: 'Remittance', exact: true }).click()
  await choose('Retail partner', 'Ntinda')
  await choose('Linked reconciliation', 'REC-001')
  await page.getByLabel('Amount remitted', { exact: true }).fill('10000')
  await page
    .getByRole('button', { name: 'Record remittance', exact: true })
    .click()
  await expect.poll(() => posted.length).toBe(5)
  await page.getByRole('tab', { name: 'Expense', exact: true }).click()
  await page.getByLabel('Expense category', { exact: true }).fill('Transport')
  await page.getByLabel('Expense amount', { exact: true }).fill('10000')
  await page
    .getByRole('button', { name: 'Record expense', exact: true })
    .click()
  await expect.poll(() => posted.length).toBe(6)
  expect(posted).toEqual([
    'purchases',
    'production',
    'stock-issues',
    'reconciliations',
    'remittances',
    'expenses'
  ])
})

test('weekly reports use cards on phones and tables on desktop', async ({
  page
}) => {
  await setup(page)
  await page.setViewportSize({ width: 375, height: 844 })
  await page.goto('/#/')
  await page.getByRole('button', { name: 'Weekly', exact: true }).click()
  await page.getByText('Stock movement', { exact: true }).click()
  await expect(page.locator('.report-cards:visible').first()).toBeVisible()
  await expect(page.locator('.q-table')).toHaveCount(0)
  await page.setViewportSize({ width: 1280, height: 844 })
  await expect(page.locator('.q-table:visible').first()).toBeVisible()
  await page
    .getByRole('button', { name: 'Monthly review', exact: true })
    .click()
  await page.getByText('Inventory at month end', { exact: true }).click()
  await expect(page.getByText('Raw honey', { exact: true })).toBeVisible()
})
