// Runs the real /api/history and /api/workspace handlers against an in-memory
// PGlite database built from neon/migrations. No Neon connection is used.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { randomBytes, randomUUID } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import { sql } from 'drizzle-orm'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import history from '../api/history.js'
import workspace from '../api/workspace.js'
import { setTestDatabase } from '../server/db.js'
import { ALL_ROLES, SUPPLY } from '../server/auth.js'
import { access, projections } from '../server/projections.js'
import { workspaceRoles } from '../server/workspaces.js'
import { historySpecs } from '../server/history.js'

const RESOURCES = [
  'purchases',
  'batches',
  'stockIssues',
  'retailerMovements',
  'reconciliations',
  'remittances',
  'expenses'
] as const
type Resource = (typeof RESOURCES)[number]
const DATE_FIELD: Record<Resource, string> = {
  purchases: 'purchased_at',
  batches: 'started_at',
  stockIssues: 'issued_at',
  retailerMovements: 'moved_at',
  reconciliations: 'reconciled_at',
  remittances: 'received_at',
  expenses: 'incurred_at'
}
const client = new PGlite()
const tokens = {} as Record<(typeof ALL_ROLES)[number], string>
const admin = randomUUID()

type Result = { status: number; body: any }
async function invoke(
  handler: typeof history,
  query: Record<string, string | string[]>,
  token?: string
): Promise<Result> {
  let status = 200,
    body: unknown = null
  const req = {
    method: 'GET',
    query,
    headers: {
      host: 'localhost',
      origin: 'http://localhost',
      ...(token ? { cookie: `boms_session=${token}` } : {})
    }
  } as unknown as VercelRequest
  const res = {
    setHeader() {},
    status(code: number) {
      status = code
      return this
    },
    json(value: unknown) {
      body = value
      return this
    },
    end() {
      return this
    }
  } as unknown as VercelResponse
  await handler(req, res)
  return { status, body: body as any }
}
const getHistory = (
  resource: string,
  params: Record<string, string | string[]> = {},
  role: (typeof ALL_ROLES)[number] = 'admin_owner'
) => invoke(history, { resource, ...params }, tokens[role])
const getWorkspace = (
  name: string,
  params: Record<string, string> = {},
  role: (typeof ALL_ROLES)[number] = 'admin_owner'
) => invoke(workspace, { name, ...params }, tokens[role])
const ids = (rows: { id: number }[]) => rows.map(row => row.id)
const kampalaDay = (value: string) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Kampala',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date(value))

before(async () => {
  for (const file of readdirSync('neon/migrations').sort())
    await client.exec(readFileSync(`neon/migrations/${file}`, 'utf8'))
  setTestDatabase({ db: drizzle(client), query: null })
  await client.query(
    "insert into users(id,email,password_hash,app_role) values($1,'admin@example.invalid','test-only','admin_owner')",
    [admin]
  )
  for (const role of ALL_ROLES) {
    const id = role === 'admin_owner' ? admin : randomUUID()
    if (role !== 'admin_owner')
      await client.query(
        'insert into users(id,email,password_hash,app_role) values($1,$2,$3,$4)',
        [id, `${role}@example.invalid`, 'test-only', role]
      )
    tokens[role] = randomBytes(32).toString('base64url')
    await client.query(
      "insert into sessions(id,user_id,expires_at) values($1,$2,now()+interval '1 day')",
      [tokens[role], id]
    )
  }
  await client.exec(
    "insert into products(id,name,slug) values(1,'Honey','honey'); insert into product_variants(id,product_id,sku,variant_name,pack_size_grams) values(1,1,'H-500','500g',500); insert into materials(id,code,name,kind,unit_of_measure) values(1,'H','Honey','raw_honey','kg'),(2,'J','Jar','packaging','piece'); insert into suppliers(id,supplier_name) values(1,'Hive Co'),(2,'Jar Works'); insert into retailers(id,retailer_name) values(1,'Corner Shop'),(2,'Other Retailer');"
  )
  const run = (action: string, body: Record<string, unknown>) =>
    client.transaction(async tx => {
      await tx.query("select set_config('boms.actor_id',$1,true)", [admin])
      const row = (
        await tx.query<{ response_status: number; response_body: any }>(
          'select * from execute_idempotent($1,$2,$3,$4)',
          [randomUUID(), action, JSON.stringify(body), body]
        )
      ).rows[0]
      assert.ok(row.response_status < 300, JSON.stringify(row))
      return row.response_body
    })
  await run('prices', {
    variantId: 1,
    unitPrice: '20000.00',
    effectiveFrom: '2026-07-01T00:00:00Z'
  })
  const cycles = [
    ['PO-ALPHA', 1, '2026-08-01', 'PB-20260802-001', '2026-08-02'],
    ['PO-BETA', 1, '2026-08-10', 'PB-20260811-001', '2026-08-11'],
    ['PO-GAMMA', 2, '2026-08-20', 'PB-20260821-001', '2026-08-21']
  ] as const
  for (const [reference, supplierId, day, batchCode, batchDay] of cycles) {
    await run('purchases', {
      supplierId,
      purchaseReference: reference,
      purchasedAt: `${day}T10:00:00Z`,
      items: [
        { material_id: 1, quantity: '10.000', unit_cost: '10000.00' },
        { material_id: 2, quantity: '20.000', unit_cost: '500.00' }
      ]
    })
    await run('production', {
      variantId: 1,
      batchCode,
      startedAt: `${batchDay}T10:00:00Z`,
      outputQuantity: 20,
      inputs: [
        { material_id: 1, quantity: '10.000' },
        { material_id: 2, quantity: '20.000' }
      ]
    })
  }
  for (const [reference, retailerId, day, output, quantity] of [
    ['ISS-1', 1, '2026-08-03', 1, 15],
    ['ISS-2', 2, '2026-08-12', 2, 10],
    ['ISS-3', 1, '2026-08-22', 3, 5]
  ] as const)
    await run('stock-issues', {
      retailerId,
      issueReference: reference,
      issuedAt: `${day}T10:00:00Z`,
      items: [{ production_output_id: output, quantity }]
    })
  const rec1 = await run('reconciliations', {
    retailerId: 1,
    reconciliationReference: 'REC-NORTH',
    reconciledAt: '2026-08-04T10:00:00Z',
    items: [
      {
        stock_issue_item_id: 1,
        quantity_sold: 5,
        quantity_returned: 2,
        quantity_damaged: 1,
        quantity_expired: 1,
        quantity_remaining: 6,
        return_reason: 'Shelf check'
      }
    ]
  })
  const rec2 = await run('reconciliations', {
    retailerId: 2,
    reconciliationReference: 'REC-SOUTH',
    reconciledAt: '2026-08-13T10:00:00Z',
    items: [
      {
        stock_issue_item_id: 2,
        quantity_sold: 4,
        quantity_returned: 0,
        quantity_damaged: 0,
        quantity_expired: 0,
        quantity_remaining: 6
      }
    ]
  })
  for (const [reference, retailerId, reconciliationId, day, amount] of [
    ['REM-1', 1, rec1.id, '2026-08-05', '30000.00'],
    ['REM-2', 1, rec1.id, '2026-08-06', '20000.00'],
    ['REM-3', 2, rec2.id, '2026-08-14', '10000.00']
  ] as const)
    await run('remittances', {
      retailerId,
      reconciliationId,
      remittanceReference: reference,
      receivedAt: `${day}T10:00:00Z`,
      amount
    })
  await client.exec(
    "insert into expenses(expense_category,incurred_at,amount,vendor_name,expense_reference) select (array['Transport','Utilities','Rent'])[g%3+1], timestamptz '2026-07-01T12:00:00Z' + g*interval '1 day', g*1000, 'Vendor '||g, 'EXP-'||lpad(g::text,3,'0') from generate_series(1,30) g; update expenses set vendor_name='Fuel 100% Ltd' where expense_reference='EXP-007'; update expenses set vendor_name='Fuel_Depot' where expense_reference='EXP-008';"
  )
})
after(async () => {
  setTestDatabase(null)
  await client.close()
})

// The pre-change readWorkspace, kept here as the compatibility oracle.
async function legacyWorkspace(
  name: keyof typeof workspaceRoles,
  role: string
) {
  const groups: Record<string, (keyof typeof projections)[]> = {
    operations: [
      'variants',
      'materials',
      'suppliers',
      'purchases',
      'inventoryLots',
      'batches',
      'recipes'
    ],
    retail: [
      'retailers',
      'productionOutputs',
      'stockIssues',
      'retailerMovements'
    ],
    finance: [
      'retailers',
      'openIssueLines',
      'reconciliations',
      'remittances',
      'expenses',
      'retailerBalances',
      'profitSummary',
      'pricing'
    ],
    dashboard: [
      'purchases',
      'inventoryLots',
      'batches',
      'productionOutputs',
      'stockIssues',
      'retailers',
      'reconciliations',
      'remittances',
      'retailerBalances',
      'openIssueLines',
      'expenses'
    ],
    settings: ['variants', 'materials', 'recipes', 'pricing']
  }
  const db = drizzle(client)
  const entries = []
  for (const key of groups[name]) {
    if (!access[key].includes(role)) {
      entries.push([key, key === 'profitSummary' ? null : []])
      continue
    }
    const data = (await db.execute(sql.raw(projections[key]))).rows.map(
      row => row.data as Record<string, unknown>
    )
    if (key === 'batches' && !SUPPLY.includes(role))
      for (const batch of data) delete batch.inputs
    entries.push([
      name === 'retail' && key === 'productionOutputs' ? 'finishedStock' : key,
      key === 'profitSummary' ? data[0] : data
    ])
  }
  return { mode: 'live', ...Object.fromEntries(entries) }
}

test('default workspace payloads are unchanged for every role', async () => {
  assert.equal((await invoke(workspace, { name: 'finance' })).status, 401)
  for (const role of ALL_ROLES)
    for (const [name, roles] of Object.entries(workspaceRoles)) {
      const result = await getWorkspace(name, {}, role)
      if (!roles.includes(role)) {
        assert.equal(result.status, 403, `${role}/${name}`)
        continue
      }
      assert.equal(result.status, 200, `${role}/${name}`)
      const expected = await legacyWorkspace(
        name as keyof typeof workspaceRoles,
        role
      )
      assert.deepEqual(result.body, expected, `${role}/${name}`)
      assert.deepEqual(
        (await getWorkspace(name, { view: 'full' }, role)).body,
        expected
      )
    }
  // Sanity: the seeded histories are actually present in the default payload.
  const full = (await getWorkspace('dashboard')).body
  assert.equal(full.expenses.length, 30)
  assert.equal(full.purchases.length, 3)
})

test('summary view omits histories but keeps open-state and reference data', async () => {
  const histories = new Set<string>(RESOURCES)
  for (const role of ALL_ROLES)
    for (const name of ['operations', 'retail', 'finance', 'settings']) {
      if (!workspaceRoles[name as keyof typeof workspaceRoles].includes(role))
        continue
      const full = (await getWorkspace(name, {}, role)).body
      const summary = await getWorkspace(name, { view: 'summary' }, role)
      assert.equal(summary.status, 200)
      assert.equal(summary.body.view, 'summary')
      for (const [key, value] of Object.entries(full)) {
        if (histories.has(key)) {
          assert.ok(!(key in summary.body), `${name} summary has ${key}`)
          assert.equal(
            summary.body.historyCounts[key],
            (value as unknown[]).length,
            `${role}/${name}/${key} count`
          )
        } else assert.deepEqual(summary.body[key], value, `${name}/${key}`)
      }
    }
  const finance = (await getWorkspace('finance', { view: 'summary' })).body
  const fullFinance = (await getWorkspace('finance')).body
  assert.equal(finance.openIssueLines.length, fullFinance.openIssueLines.length)
  assert.deepEqual(
    finance.reconciliationOptions.map((row: any) => [
      row.id,
      row.retailer.id,
      row.total_sales_value
    ]),
    fullFinance.reconciliations.map((row: any) => [
      row.id,
      row.retailer.id,
      row.total_sales_value
    ])
  )
  assert.ok(!('items' in finance.reconciliationOptions[0]))
  const sales = (
    await getWorkspace(
      'finance',
      { view: 'summary' },
      'sales_or_distribution_staff'
    )
  ).body
  assert.equal(sales.historyCounts.expenses, 0)
  assert.equal(sales.historyCounts.reconciliations, 2)

  // retailerStockPositions must equal RetailPage's sum over every movement.
  const retail = (await getWorkspace('retail', { view: 'summary' })).body
  const movements = (await getWorkspace('retail')).body.retailerMovements
  const expected = new Map<
    number,
    { total: number; lines: Map<string, number> }
  >()
  for (const movement of movements) {
    const entry = expected.get(movement.retailer.id) ?? {
      total: 0,
      lines: new Map()
    }
    entry.total += movement.quantity_delta
    const key = `${movement.variant.sku}::${movement.batch.batch_code}`
    entry.lines.set(key, (entry.lines.get(key) ?? 0) + movement.quantity_delta)
    expected.set(movement.retailer.id, entry)
  }
  assert.equal(retail.retailerStockPositions.length, expected.size)
  for (const position of retail.retailerStockPositions) {
    const entry = expected.get(position.retailer_id)!
    assert.equal(position.total_units, entry.total)
    assert.deepEqual(
      Object.fromEntries(
        position.lines.map((l: any) => [
          `${l.sku}::${l.batch_code}`,
          l.quantity
        ])
      ),
      Object.fromEntries([...entry.lines].filter(([, q]) => q !== 0))
    )
  }
  assert.ok(retail.finishedStock.length > 0)

  assert.equal(
    (await getWorkspace('dashboard', { view: 'summary' })).status,
    422
  )
  assert.equal(
    (await getWorkspace('finance', { view: 'everything' })).status,
    422
  )
})

test('history authorization matches the workspace access map for all roles', async () => {
  assert.equal((await invoke(history, { resource: 'expenses' })).status, 401)
  assert.equal((await getHistory('users')).status, 404)
  assert.equal((await getHistory('__proto__')).status, 404)
  assert.equal((await getHistory('inventoryLots')).status, 404)
  for (const role of ALL_ROLES)
    for (const resource of RESOURCES) {
      const result = await getHistory(resource, {}, role)
      assert.equal(
        result.status,
        access[resource].includes(role) ? 200 : 403,
        `${role}/${resource}`
      )
      if (result.status === 403) assert.equal(result.body.kind, 'authorization')
    }
  const salesBatches = (
    await getHistory('batches', {}, 'sales_or_distribution_staff')
  ).body.rows
  assert.ok(salesBatches.length > 0)
  for (const batch of salesBatches) assert.ok(!('inputs' in batch))
  assert.ok('inputs' in (await getHistory('batches')).body.rows[0])
})

test('history pages match the full ordering, totals and clamped limits', async () => {
  const full = (await getWorkspace('dashboard')).body
  full.retailerMovements = (await getWorkspace('retail')).body.retailerMovements
  for (const resource of RESOURCES) {
    const all = full[resource]
    const first = (await getHistory(resource)).body
    assert.equal(first.limit, 25)
    assert.equal(first.offset, 0)
    assert.equal(first.total, all.length, resource)
    assert.deepEqual(first.rows, all.slice(0, 25), `${resource} default page`)
    const paged = []
    for (let offset = 0; offset < all.length; offset += 2) {
      const page = (
        await getHistory(resource, { limit: '2', offset: String(offset) })
      ).body
      assert.equal(page.total, all.length)
      paged.push(...page.rows)
    }
    assert.deepEqual(ids(paged), ids(all), `${resource} paging`)
    const beyond = (
      await getHistory(resource, { offset: String(all.length + 5) })
    ).body
    assert.deepEqual(beyond.rows, [])
    assert.equal(beyond.total, all.length)
  }
  for (const [limit, expected] of [
    ['1000', 100],
    ['100', 100],
    ['0', 1],
    ['-4', 1],
    ['7', 7]
  ] as const) {
    const page = (await getHistory('expenses', { limit })).body
    assert.equal(page.limit, expected)
    assert.equal(page.rows.length, Math.min(expected, 30))
  }
  for (const bad of [
    { limit: 'ten' },
    { limit: '2.5' },
    { offset: '-1' },
    { offset: '1e3' },
    { limit: ['1', '2'] }
  ])
    assert.equal(
      (await getHistory('expenses', bad)).status,
      422,
      JSON.stringify(bad)
    )
})

test('history sorting is allowlisted and server-authoritative', async () => {
  for (const resource of RESOURCES) {
    for (const sort of Object.keys(historySpecs[resource].sorts))
      for (const order of ['asc', 'desc'])
        assert.equal(
          (await getHistory(resource, { sort, order })).status,
          200,
          `${resource}/${sort}`
        )
    for (const sort of [
      'id; drop table expenses',
      'nope',
      'password_hash',
      't.id',
      '1',
      'constructor'
    ])
      assert.equal(
        (await getHistory(resource, { sort })).status,
        422,
        `${resource}/${sort}`
      )
    assert.equal(
      (await getHistory(resource, { order: 'desc; drop table expenses' }))
        .status,
      422
    )
  }
  const ascending = (
    await getHistory('expenses', { sort: 'amount', order: 'asc', limit: '100' })
  ).body.rows
  assert.deepEqual(
    ascending.map((r: any) => Number(r.amount)),
    Array.from({ length: 30 }, (_, i) => (i + 1) * 1000)
  )
  const byName = (
    await getHistory('stockIssues', { sort: 'retailer_name', order: 'asc' })
  ).body.rows
  assert.deepEqual(
    byName.map((r: any) => r.retailer.retailer_name),
    ['Corner Shop', 'Corner Shop', 'Other Retailer']
  )
  const byCode = (
    await getHistory('batches', { sort: 'batch_code', order: 'asc' })
  ).body.rows
  assert.deepEqual(
    byCode.map((r: any) => r.batch_code),
    ['PB-20260802-001', 'PB-20260811-001', 'PB-20260821-001']
  )
  assert.equal((await getHistory('expenses')).body.total, 30)
})

test('history date windows use Kampala calendar days or exact instants', async () => {
  const full = (await getWorkspace('dashboard')).body
  full.retailerMovements = (await getWorkspace('retail')).body.retailerMovements
  for (const resource of RESOURCES) {
    const all = full[resource]
    const day = kampalaDay(all[all.length - 1][DATE_FIELD[resource]])
    const expected = all.filter(
      (row: any) => kampalaDay(row[DATE_FIELD[resource]]) === day
    )
    const page = (await getHistory(resource, { from: day, to: day })).body
    assert.equal(page.total, expected.length, `${resource} ${day}`)
    assert.deepEqual(ids(page.rows), ids(expected))
  }
  const window = (
    await getHistory('expenses', { from: '2026-07-10', to: '2026-07-12' })
  ).body
  assert.deepEqual(
    window.rows.map((r: any) => r.expense_reference),
    ['EXP-011', 'EXP-010', 'EXP-009']
  )
  const after = (await getHistory('expenses', { from: '2026-07-29' })).body
  assert.equal(after.total, 3)
  const instant = (
    await getHistory('batches', {
      from: '2026-08-11T00:00:00Z',
      to: '2026-08-11T23:59:59.999Z'
    })
  ).body
  assert.deepEqual(
    instant.rows.map((r: any) => r.batch_code),
    ['PB-20260811-001']
  )
  for (const bad of [
    { from: '2026-02-30' },
    { from: 'yesterday' },
    { to: "2026-07-01' or '1'='1" },
    { from: '2026-07-12', to: '2026-07-10' },
    { from: '2026-07-10T10:00:00' }
  ])
    assert.equal(
      (await getHistory('expenses', bad)).status,
      422,
      JSON.stringify(bad)
    )
})

test('history search and filters are parameterized', async () => {
  const search = async (resource: string, q: string, extra = {}) =>
    (await getHistory(resource, { q, ...extra })).body
  assert.deepEqual(ids((await search('purchases', 'jar works')).rows).length, 1)
  assert.equal(
    (await search('purchases', 'PO-BETA')).rows[0].purchase_reference,
    'PO-BETA'
  )
  assert.equal(
    (await search('batches', '20260811')).rows[0].batch_code,
    'PB-20260811-001'
  )
  assert.equal((await search('stockIssues', 'other retailer')).total, 1)
  assert.equal(
    (await search('stockIssues', 'ISS-3')).rows[0].issue_reference,
    'ISS-3'
  )
  const movements = await search('retailerMovements', 'Corner')
  assert.ok(movements.total > 0)
  for (const row of movements.rows)
    assert.equal(row.retailer.retailer_name, 'Corner Shop')
  assert.equal(
    (await search('reconciliations', 'south')).rows[0].reconciliation_reference,
    'REC-SOUTH'
  )
  assert.equal((await search('remittances', 'REM-2')).total, 1)
  assert.equal((await search('expenses', 'Utilities')).total, 10)
  // LIKE wildcards in user text are literal.
  assert.deepEqual(
    (await search('expenses', '100%')).rows.map((r: any) => r.vendor_name),
    ['Fuel 100% Ltd']
  )
  assert.deepEqual(
    (await search('expenses', '_')).rows.map((r: any) => r.vendor_name),
    ['Fuel_Depot']
  )
  assert.equal((await search('expenses', '%')).total, 1)
  for (const q of ["' or 1=1 --", "'); drop table expenses; --", '\\'])
    for (const resource of RESOURCES) {
      const result = await getHistory(resource, { q })
      assert.equal(result.status, 200)
      assert.equal(result.body.total, 0, `${resource} ${q}`)
    }
  assert.equal(
    (await getHistory('expenses', { q: 'x'.repeat(101) })).status,
    422
  )
  assert.equal((await search('expenses', '   ')).total, 30)

  assert.equal(
    (await getHistory('stockIssues', { retailerId: '1' })).body.total,
    2
  )
  assert.equal(
    (await getHistory('remittances', { retailerId: '2' })).body.total,
    1
  )
  assert.equal(
    (await getHistory('purchases', { supplierId: '2' })).body.rows[0]
      .purchase_reference,
    'PO-GAMMA'
  )
  assert.equal(
    (await getHistory('purchases', { status: 'received' })).body.total,
    3
  )
  assert.equal(
    (await getHistory('retailerMovements', { movementType: 'issue' })).body
      .total,
    3
  )
  assert.equal(
    (await getHistory('expenses', { category: 'Rent' })).body.total,
    10
  )
  assert.equal(
    (await getHistory('stockIssues', { retailerId: '1', q: 'ISS-3' })).body
      .total,
    1
  )
  for (const [resource, bad] of [
    ['stockIssues', { retailerId: '1 or 1=1' }],
    ['purchases', { status: "received' or '1'='1" }],
    ['retailerMovements', { movementType: 'teleport' }],
    ['remittances', { reconciliationId: '-1' }]
  ] as const)
    assert.equal(
      (await getHistory(resource, bad)).status,
      422,
      JSON.stringify(bad)
    )
  // Filters from other resources are ignored rather than applied.
  assert.equal(
    (await getHistory('expenses', { retailerId: '1' })).body.total,
    30
  )
  assert.equal((await getHistory('expenses')).body.total, 30)
})
