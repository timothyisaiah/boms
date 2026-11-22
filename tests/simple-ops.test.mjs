import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { PGlite } from '@electric-sql/pglite'

const actor = 'c0c9a933-e11f-4db0-bfc5-462c116d8863'

async function setup() {
  const db = new PGlite()
  for (const file of readdirSync('neon/migrations').sort())
    await db.exec(readFileSync(`neon/migrations/${file}`, 'utf8'))
  await db.query(
    "insert into users(id,email,password_hash,app_role) values($1,'test@example.invalid','test-only','admin_owner')",
    [actor]
  )
  await db.exec(`
    insert into products(id,name,slug) values(1,'Honey','honey');
    insert into product_variants(id,product_id,sku,variant_name,flavor,pack_size_grams) values
      (1,1,'RAW-60','Raw Honey 60g','Raw',60),
      (2,1,'GIN-400','Ginger Honey 400g','Ginger Infused',400);
    insert into materials(id,code,name,kind,unit_of_measure) values
      (1,'HONEY','Raw Honey','raw_honey','kg'),
      (2,'GINGER','Ginger Powder','spice','kg'),
      (3,'JAR-60','60g Jar','packaging','piece'),
      (4,'JAR-400','400g Jar','packaging','piece'),
      (5,'LABEL','Label','packaging','piece');
    insert into suppliers(id,supplier_name) values(1,'Supplier');
    insert into retailers(id,retailer_name) values(1,'Shop');`)
  const run = async (action, body) =>
    db.transaction(async tx => {
      await tx.query("select set_config('boms.actor_id',$1,true)", [actor])
      return (
        await tx.query('select * from execute_idempotent($1,$2,$3,$4)', [
          randomUUID(),
          action,
          JSON.stringify(body),
          body
        ])
      ).rows[0]
    })
  const query = async (sql, args = []) => (await db.query(sql, args)).rows
  return { db, run, query }
}

test('one-tap production, direct sale, retailer check-in and barcodes reconcile', async () => {
  const { db, run, query } = await setup()
  try {
    // Materials in purchase units are converted by the client; the database
    // stores kilograms and pieces.
    const [honey] = await query(
      'select purchase_unit_label,purchase_unit_size from materials where id=1'
    )
    assert.equal(honey.purchase_unit_label, 'jerrican')
    assert.equal(Number(honey.purchase_unit_size), 20)

    await run('purchases', {
      supplierId: 1,
      purchasedAt: '2026-11-01T08:00:00Z',
      items: [
        { material_id: 1, quantity: '20', unit_cost: '10000' },
        { material_id: 2, quantity: '1', unit_cost: '20000' },
        { material_id: 3, quantity: '200', unit_cost: '300' },
        { material_id: 4, quantity: '50', unit_cost: '800' },
        { material_id: 5, quantity: '300', unit_cost: '100' }
      ]
    })
    await run('recipes', {
      variantId: 1,
      name: 'Raw 60g',
      items: [
        { materialId: 1, quantityPerUnit: '0.06' },
        { materialId: 3, quantityPerUnit: '1' },
        { materialId: 5, quantityPerUnit: '1' }
      ]
    })
    for (const [variantId, unitPrice] of [
      [1, '5000'],
      [2, '30000']
    ])
      await run('prices', {
        variantId,
        unitPrice,
        effectiveFrom: '2026-10-01T00:00:00Z'
      })

    // A variant without a recipe is refused with a plain explanation.
    await assert.rejects(
      run('production-run', {
        producedAt: '2026-11-02T08:00:00Z',
        items: [{ variant_id: 2, quantity: 5 }]
      }),
      /No recipe is set for Ginger Honey 400g/
    )
    await run('recipes', {
      variantId: 2,
      name: 'Ginger 400g',
      items: [
        { materialId: 1, quantityPerUnit: '0.4' },
        { materialId: 2, quantityPerUnit: '0.02' },
        { materialId: 4, quantityPerUnit: '1' },
        { materialId: 5, quantityPerUnit: '1' }
      ]
    })

    // Shortage is reported per material before anything is written.
    await assert.rejects(
      run('production-run', {
        producedAt: '2026-11-02T08:00:00Z',
        items: [{ variant_id: 1, quantity: 400 }]
      }),
      /Not enough Raw Honey: need 24 kg, only 20 kg in stock/
    )
    assert.equal(
      (await query('select count(*)::int n from production_batches'))[0].n,
      0
    )

    const made = await run('production-run', {
      producedAt: '2026-11-02T08:00:00Z',
      items: [
        { variant_id: 1, quantity: 100 },
        { variant_id: 2, quantity: 10 },
        { variant_id: 2, quantity: 0 }
      ]
    })
    assert.equal(made.response_status, 201)
    const batches = await query(
      'select batch_code,variant_id,total_output_quantity,total_input_cost,output_unit_cost from production_batches order by id'
    )
    assert.deepEqual(
      batches.map(b => [b.batch_code, b.total_output_quantity]),
      [
        ['RAW-60-261102', 100],
        ['GIN-400-261102', 10]
      ]
    )
    // 100 x (0.06 kg x 10,000 + 300 + 100) = 100,000 => 1,000 per jar.
    assert.equal(Number(batches[0].total_input_cost), 100000)
    assert.equal(Number(batches[0].output_unit_cost), 1000)
    // 10 x (0.4 x 10,000 + 0.02 x 20,000 + 800 + 100) = 53,000
    assert.equal(Number(batches[1].total_input_cost), 53000)
    const lots = await query(
      'select material_id,quantity_remaining from inventory_lots order by material_id'
    )
    assert.deepEqual(
      lots.map(l => Number(l.quantity_remaining)),
      [10, 0.8, 100, 40, 190]
    )

    // A second run on the same day gets a unique batch code.
    await run('production-run', {
      producedAt: '2026-11-02T15:00:00Z',
      items: [{ variant_id: 1, quantity: 10 }]
    })
    assert.equal(
      (
        await query(
          "select count(*)::int n from production_batches where batch_code='RAW-60-261102-2'"
        )
      )[0].n,
      1
    )

    // Give 30 jars to a retailer (consignment) by variant, oldest batch first.
    await run('stock-issues', {
      retailerId: 1,
      issuedAt: '2026-11-03T08:00:00Z',
      items: [{ variant_id: 1, quantity: 30 }]
    })

    // Sell 5 jars directly; revenue uses the preset price, cost the batch cost.
    await run('direct-sales', {
      soldAt: '2026-11-03T10:00:00Z',
      paymentMethod: 'mobile_money',
      items: [
        { variant_id: 1, quantity: 5 },
        { variant_id: 2, quantity: 2 }
      ]
    })
    const [sale] = await query(
      'select total_quantity,total_amount,total_cost,payment_method from direct_sales'
    )
    assert.equal(sale.total_quantity, 7)
    assert.equal(Number(sale.total_amount), 5 * 5000 + 2 * 30000)
    assert.equal(Number(sale.total_cost), 5 * 1000 + 2 * 5300)
    assert.equal(sale.payment_method, 'mobile_money')
    const [stock] = await query(
      'select sum(quantity_remaining)::int n from production_outputs where variant_id=1'
    )
    assert.equal(stock.n, 110 - 30 - 5)
    await assert.rejects(
      run('direct-sales', {
        soldAt: '2026-11-03T10:00:00Z',
        items: [{ variant_id: 2, quantity: 50 }]
      }),
      /Insufficient/
    )

    // Check-in: 10 still on the shelf, 2 damaged => 18 sold; collect 50,000.
    await run('retailer-checkins', {
      retailerId: 1,
      checkedAt: '2026-11-10T08:00:00Z',
      counts: [{ variant_id: 1, remaining: 10, damaged: 2 }],
      amount: '50000'
    })
    const [rec] = await query(
      'select total_sold_quantity,total_damaged_quantity,total_remaining_quantity,total_sales_value from reconciliations'
    )
    assert.equal(rec.total_sold_quantity, 18)
    assert.equal(rec.total_damaged_quantity, 2)
    assert.equal(rec.total_remaining_quantity, 10)
    assert.equal(Number(rec.total_sales_value), 18 * 5000)
    const [balance] = await query(
      'select outstanding_amount,remaining_quantity from retailer_outstanding_balances where retailer_id=1'
    )
    assert.equal(Number(balance.outstanding_amount), 18 * 5000 - 50000)
    assert.equal(balance.remaining_quantity, 10)
    await assert.rejects(
      run('retailer-checkins', {
        retailerId: 1,
        checkedAt: '2026-11-11T08:00:00Z',
        counts: [{ variant_id: 1, remaining: 11 }]
      }),
      /only holds 10 jars/
    )
    await assert.rejects(
      run('retailer-checkins', {
        retailerId: 1,
        checkedAt: '2026-11-11T08:00:00Z',
        counts: [{ variant_id: 1, remaining: 10 }]
      }),
      /Nothing changed/
    )
    // Money only (no count change) records a remittance.
    await run('retailer-checkins', {
      retailerId: 1,
      checkedAt: '2026-11-12T08:00:00Z',
      counts: [{ variant_id: 1, remaining: 10 }],
      amount: '40000'
    })
    assert.equal(
      Number(
        (
          await query(
            'select outstanding_amount from retailer_outstanding_balances where retailer_id=1'
          )
        )[0].outstanding_amount
      ),
      0
    )

    // Profit includes reconciled retail sales and direct sales.
    const [profit] = await query('select * from finance_profit_summary')
    assert.equal(Number(profit.direct_sales_value), 85000)
    assert.equal(Number(profit.recognized_sales_value), 90000 + 85000)
    assert.equal(profit.sold_quantity, 18 + 7)
    const [report] = await query(
      "select business_report('2026-11-01','2026-12-01') r"
    )
    assert.equal(Number(report.r.profit.revenue), 175000)
    assert.equal(Number(report.r.profit.direct_revenue), 85000)
    const valuation = report.r.valuation.find(
      v => v.category === 'finished_goods_including_consignment'
    )
    // Remaining owned jars: variant 1 = 110 - 5 sold - 18 sold - 2 damaged = 85 @1000
    // variant 2 = 10 - 2 = 8 @5300.
    assert.equal(Number(valuation.value), 85 * 1000 + 8 * 5300)

    // Barcodes: one shared code per variant, never two variants per code.
    await run('variant-barcode', { variantId: 1, barcode: '6151100000601' })
    await assert.rejects(
      run('variant-barcode', { variantId: 2, barcode: '6151100000601' }),
      /already linked to Raw Honey 60g/
    )
    await run('variant-barcode', { variantId: 1, barcode: '' })
    assert.equal(
      (await query('select barcode from product_variants where id=1'))[0]
        .barcode,
      null
    )
  } finally {
    await db.close()
  }
})

test('client maths mirrors the database: requirements, units, check-in', async () => {
  const {
    computeRequirements,
    formatMaterialAmount,
    toBaseQuantity,
    unitCostFromTotal,
    basketTotal,
    findVariantByCode,
    checkinPreview,
    groupVariants,
    jarLabel
  } = await import('../src/lib/simpleOps.js')
  const variants = [
    {
      id: 3,
      flavor: 'Ginger Infused',
      pack_size_grams: 400,
      sku: 'GIN-400',
      current_price: '30000',
      barcode: '6150001'
    },
    {
      id: 1,
      flavor: 'Classic',
      pack_size_grams: 1000,
      sku: 'RAW-1000',
      current_price: null
    },
    {
      id: 2,
      flavor: 'Classic',
      pack_size_grams: 60,
      sku: 'RAW-60',
      current_price: '5000'
    }
  ]
  assert.deepEqual(
    groupVariants(variants).map(g => [g.label, g.items.map(v => v.id)]),
    [
      ['Raw Honey', [2, 1]],
      ['Ginger Infused Honey', [3]]
    ]
  )
  assert.equal(jarLabel(variants[1]), 'Raw Honey 1kg')
  const honey = {
    id: 10,
    name: 'Raw Honey',
    kind: 'raw_honey',
    unit_of_measure: 'kg',
    purchase_unit_label: 'jerrican',
    purchase_unit_size: '20.000',
    on_hand: '20'
  }
  const ginger = {
    id: 11,
    name: 'Ginger',
    kind: 'spice',
    unit_of_measure: 'kg',
    purchase_unit_size: '1',
    on_hand: '0.1'
  }
  const recipes = [
    {
      variant_id: 3,
      items: [
        { material_id: 10, quantity_per_unit: '0.400000' },
        { material_id: 11, quantity_per_unit: '0.020000' }
      ]
    },
    {
      variant_id: 2,
      items: [{ material_id: 10, quantity_per_unit: '0.060000' }]
    }
  ]
  const { lines, missingRecipes } = computeRequirements(
    { 3: 10, 2: 100, 1: 4 },
    recipes,
    [honey, ginger],
    variants
  )
  assert.deepEqual(
    missingRecipes.map(v => v.id),
    [1]
  )
  assert.deepEqual(
    lines.map(l => [l.material.id, l.needed, l.short]),
    [
      [10, 10, false],
      [11, 0.2, true]
    ]
  )
  assert.equal(formatMaterialAmount(honey, 26), '26 kg (1.3 jerricans)')
  assert.equal(formatMaterialAmount({ unit_of_measure: 'piece' }, 1), '1 piece')
  assert.equal(toBaseQuantity(honey, 2), '40.000')
  assert.equal(unitCostFromTotal(450000, '40.000'), '11250.00')
  assert.deepEqual(basketTotal({ 3: 2, 2: 1, 1: 1 }, variants), {
    total: 65000,
    missing: [variants[1]]
  })
  assert.equal(findVariantByCode(variants, ' 6150001 ').id, 3)
  assert.equal(findVariantByCode(variants, 'raw-60').id, 2)
  assert.equal(findVariantByCode(variants, '999'), null)
  const preview = checkinPreview(
    { 2: { quantity: 30, unitPrice: 5000 } },
    { 2: 10 },
    { 2: 2 }
  )
  assert.deepEqual(
    [preview.soldJars, preview.soldValue, preview.invalid],
    [18, 90000, false]
  )
  assert.equal(
    checkinPreview({ 2: { quantity: 3, unitPrice: 1 } }, { 2: 4 }).invalid,
    true
  )
})

test('duplicate supply items are recognised by what they are, not their code', async () => {
  const { materialKey, duplicateGroups, sizeInGrams } =
    await import('../src/lib/materialKeys.js')
  // The catalogue that broke Make jars: stock under the owner's items,
  // recipes pointing at the seed's empty copies.
  const materials = [
    {
      id: 13,
      code: 'RAW-20',
      name: 'RAW Honey',
      kind: 'raw_honey',
      on_hand: 20
    },
    {
      id: 24,
      code: 'RAW-HONEY-KG',
      name: 'Raw Honey',
      kind: 'raw_honey',
      on_hand: 0
    },
    {
      id: 9,
      code: 'JAR-1000',
      name: '1 Litre Jar',
      kind: 'packaging',
      on_hand: 90
    },
    {
      id: 12,
      code: 'STICKER-1000',
      name: '1 Litre Sticker',
      kind: 'packaging',
      on_hand: 100
    },
    {
      id: 31,
      code: 'LABEL-1000',
      name: '1kg Label',
      kind: 'packaging',
      on_hand: 0
    },
    {
      id: 7,
      code: 'JAR-400',
      name: '400g Jar',
      kind: 'packaging',
      on_hand: 96
    },
    {
      id: 30,
      code: 'LABEL-400',
      name: '400g Label',
      kind: 'packaging',
      on_hand: 0
    },
    {
      id: 10,
      code: 'STICKER-400',
      name: '400g STICKER',
      kind: 'packaging',
      on_hand: 100
    },
    { id: 8, code: 'JAR-60', name: '60g Jar', kind: 'packaging', on_hand: 230 },
    {
      id: 29,
      code: 'LABEL-60',
      name: '60g Label',
      kind: 'packaging',
      on_hand: 0
    },
    {
      id: 11,
      code: 'STICKER-60',
      name: '60g Sticker',
      kind: 'packaging',
      on_hand: 240
    },
    {
      id: 25,
      code: 'GINGER-POWDER-KG',
      name: 'Ginger Powder',
      kind: 'spice',
      on_hand: 1
    },
    {
      id: 23,
      code: 'GINGER',
      name: 'Ginger Powder',
      kind: 'spice',
      on_hand: 0
    },
    {
      id: 40,
      code: 'CARTON-12',
      name: '12-Jar Master Carton',
      kind: 'packaging',
      on_hand: 0
    }
  ]
  assert.equal(sizeInGrams('1 Litre Sticker'), 1000)
  assert.equal(materialKey(materials[3]), 'label:1000')
  assert.equal(materialKey(materials[2]), 'jar:1000')
  assert.equal(materialKey(materials[13]), 'code:CARTON-12')
  assert.deepEqual(
    duplicateGroups(materials).map(g => [g.key, g.items.map(m => m.id)]),
    [
      ['raw_honey', [13, 24]],
      ['label:1000', [12, 31]],
      ['label:400', [10, 30]],
      ['label:60', [11, 29]],
      ['spice:ginger', [25, 23]]
    ]
  )
  // Inactive items and jars (no duplicates) are left alone.
  assert.deepEqual(
    duplicateGroups(
      materials.map(m => (m.id === 24 ? { ...m, is_active: false } : m))
    )
      .map(g => g.key)
      .includes('raw_honey'),
    false
  )
})
