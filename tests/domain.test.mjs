import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { PGlite } from '@electric-sql/pglite'
import { recipeQuantity } from '../src/lib/recipes.js'
const actor = 'c0c9a933-e11f-4db0-bfc5-462c116d8863'
test('operational lifecycle, retry conflicts, partial payments, pricing, expiry and historical reports', async () => {
  const db = new PGlite()
  try {
    for (const file of readdirSync('neon/migrations').sort())
      await db.exec(readFileSync(`neon/migrations/${file}`, 'utf8'))
    await db.query(
      "insert into users(id,email,password_hash,app_role) values($1,'test@example.invalid','test-only','admin_owner')",
      [actor]
    )
    await db.exec(
      "insert into products(id,name,slug) values(1,'Honey','honey'); insert into product_variants(id,product_id,sku,variant_name,pack_size_grams) values(1,1,'H-500','500g',500); insert into materials(id,code,name,kind,unit_of_measure) values(1,'H','Honey','raw_honey','kg'),(2,'J','Jar','packaging','piece'); insert into suppliers(id,supplier_name) values(1,'Test supplier'); insert into retailers(id,retailer_name) values(1,'Test retailer'),(2,'Other retailer');"
    )
    const run = async (
      action,
      body,
      key = randomUUID(),
      hash = JSON.stringify(body)
    ) =>
      db.transaction(async tx => {
        await tx.query("select set_config('boms.actor_id',$1,true)", [actor])
        return (
          await tx.query('select * from execute_idempotent($1,$2,$3,$4)', [
            key,
            action,
            hash,
            body
          ])
        ).rows[0]
      })
    const query = async (sql, args = []) => (await db.query(sql, args)).rows
    const receipt = {
      supplierId: 1,
      purchasedAt: '2026-08-01T10:00:00Z',
      items: [
        { material_id: 1, quantity: '10.000', unit_cost: '10000.00' },
        { material_id: 2, quantity: '20.000', unit_cost: '500.00' }
      ]
    }
    const key = randomUUID(),
      first = await run('purchases', receipt, key)
    assert.deepEqual(await run('purchases', receipt, key), first)
    assert.equal(
      (await run('purchases', { ...receipt, notes: 'different' }, key))
        .response_status,
      409
    )
    assert.equal((await query('select count(*)::int n from purchases'))[0].n, 1)
    assert.equal(
      (await query('select count(*)::int n from inventory_lots'))[0].n,
      2
    )
    await run('prices', {
      variantId: 1,
      unitPrice: '20000.00',
      effectiveFrom: '2026-08-01T00:00:00Z'
    })
    const production = {
      variantId: 1,
      batchCode: 'TEST-001',
      startedAt: '2026-08-02T10:00:00Z',
      outputQuantity: 20,
      inputs: [
        { material_id: 1, quantity: '10.000' },
        { material_id: 2, quantity: '20.000' }
      ],
      expiresAt: '2026-09-30'
    }
    await run('production', production)
    assert.equal(
      (await query('select output_unit_cost from production_batches'))[0]
        .output_unit_cost,
      '5500.00'
    )
    assert.equal(
      (
        await query(
          "select count(*)::int n from inventory_lots where quantity_remaining=0 and status='depleted'"
        )
      )[0].n,
      2
    )
    const issue = {
      retailerId: 1,
      issuedAt: '2026-08-03T10:00:00Z',
      items: [{ production_output_id: 1, quantity: 15 }]
    }
    await run('stock-issues', issue)
    assert.equal(
      (await query('select quantity_remaining from production_outputs'))[0]
        .quantity_remaining,
      5
    )
    const failedKey = randomUUID()
    await assert.rejects(
      run(
        'stock-issues',
        { ...issue, items: [{ production_output_id: 1, quantity: 6 }] },
        failedKey
      ),
      /Cannot issue/
    )
    assert.equal(
      (
        await query(
          'select count(*)::int n from idempotency_keys where key=$1',
          [failedKey]
        )
      )[0].n,
      0
    )
    assert.equal(
      (await query('select count(*)::int n from stock_issues'))[0].n,
      1
    )
    const settlement = {
      retailerId: 1,
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
    }
    const settlementKey = randomUUID(),
      reconciliation = await run('reconciliations', settlement, settlementKey)
    assert.deepEqual(
      await run('reconciliations', settlement, settlementKey),
      reconciliation
    )
    assert.equal(
      (await query('select quantity_remaining from production_outputs'))[0]
        .quantity_remaining,
      7
    )
    assert.equal(
      (await query('select quantity_open from retailer_issue_open_balances'))[0]
        .quantity_open,
      6
    )
    const balance = (
      await query(
        'select * from retailer_outstanding_balances where retailer_id=1'
      )
    )[0]
    assert.equal(balance.recognized_sales_value, '100000.00')
    assert.equal((await query('select count(*)::int n from returns'))[0].n, 3)
    assert.equal(
      (await query('select total_expired_quantity from reconciliations'))[0]
        .total_expired_quantity,
      1
    )
    await run('remittances', {
      retailerId: 1,
      reconciliationId: reconciliation.response_body.id,
      receivedAt: '2026-08-05T10:00:00Z',
      amount: '30000.00'
    })
    await run('remittances', {
      retailerId: 1,
      reconciliationId: reconciliation.response_body.id,
      receivedAt: '2026-08-06T10:00:00Z',
      amount: '20000.00'
    })
    assert.equal(
      (
        await query(
          'select outstanding_amount from retailer_outstanding_balances where retailer_id=1'
        )
      )[0].outstanding_amount,
      '50000.00'
    )
    await assert.rejects(
      run('remittances', {
        retailerId: 2,
        reconciliationId: reconciliation.response_body.id,
        receivedAt: '2026-08-06T10:00:00Z',
        amount: '1000.00'
      }),
      /does not belong/
    )
    await run('expenses', {
      expenseCategory: 'Transport',
      incurredAt: '2026-08-07T10:00:00Z',
      amount: '10000.00'
    })
    const profit = (await query('select * from finance_profit_summary'))[0]
    assert.equal(profit.gross_profit, '72500.00')
    assert.equal(profit.net_profit, '62500.00')
    await run('prices', {
      variantId: 1,
      unitPrice: '25000.00',
      effectiveFrom: '2026-09-01T00:00:00Z'
    })
    assert.equal(
      (await query('select unit_price from reconciliation_items'))[0]
        .unit_price,
      '20000.00'
    )
    await run('recipes', {
      variantId: 1,
      name: 'Standard 500g',
      items: [
        { materialId: 1, quantityPerUnit: '0.500000' },
        { materialId: 2, quantityPerUnit: '1.000000' }
      ]
    })
    assert.equal(
      (await query('select count(*)::int n from production_recipe_items'))[0].n,
      2
    )
    const report = (
      await query("select business_report('2026-08-01','2026-09-01') report")
    )[0].report
    assert.equal(report.profit.net_profit, 62500)
    assert.equal(
      report.valuation.find(
        v => v.category === 'finished_goods_including_consignment'
      ).value,
      71500
    )
    assert.equal(report.retailers[0].revenue, 100000)
    assert.equal(report.expenses[0].amount, 10000)
    assert.equal(report.aging.find(r => r.retailer_id === 1).outstanding, 50000)
    const before = await query(
      "select * from inventory_valuation_at('2026-08-02T00:00:00Z')"
    )
    assert.equal(
      before.find(v => v.category === 'raw_honey').value,
      '100000.00'
    )
    assert.equal(before.find(v => v.category === 'packaging').value, '10000.00')
    assert.equal(
      before.find(v => v.category === 'finished_goods_including_consignment')
        .value,
      '0'
    )
    await assert.rejects(run('reconciliations', settlement), /fully explain/)
    assert.equal(
      (await query('select count(*)::int n from reconciliations'))[0].n,
      1
    )
    assert.equal(
      (await query('select count(*)::int n from audit_logs'))[0].n,
      10
    )
    await db.query('update retailers set is_active=false where id=1')
    assert.equal(
      (
        await query(
          'select outstanding_amount from retailer_outstanding_balances where retailer_id=1'
        )
      )[0].outstanding_amount,
      '50000.00'
    )
    assert.equal(
      (await query('select net_profit from finance_profit_summary'))[0]
        .net_profit,
      '62500.00'
    )
  } finally {
    await db.close()
  }
})
test('recipe quantities multiply without floating-point drift', () => {
  assert.equal(recipeQuantity('0.500000', 20), '10.000')
  assert.equal(recipeQuantity('0.083333', 120), '10.000')
})
