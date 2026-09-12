import { test } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'

test('materials preserve inventory history, audit changes, enforce roles and replay safely', async () => {
  const db = new PGlite(),
    actor = randomUUID()
  try {
    for (const file of readdirSync('neon/migrations').sort())
      await db.exec(readFileSync(`neon/migrations/${file}`, 'utf8'))
    await db.query(
      "insert into users(id,email,password_hash,app_role) values($1,'materials@example.invalid','test-only','admin_owner')",
      [actor]
    )
    const run = (body, key = randomUUID()) =>
      db.transaction(async tx => {
        await tx.query("select set_config('boms.actor_id',$1,true)", [actor])
        return (
          await tx.query('select * from execute_material_save($1,$2,$3)', [
            key,
            JSON.stringify(body),
            body
          ])
        ).rows[0]
      })
    const honey = {
      code: ' HONEY-NEW ',
      name: 'Raw honey',
      kind: 'raw_honey',
      unitOfMeasure: 'kg',
      description: 'Local supply',
      lowStockThreshold: '12.345',
      isActive: true
    }
    const key = randomUUID(),
      created = await run(honey, key)
    assert.equal(created.response_status, 201)
    const id = created.response_body.id
    assert.deepEqual(await run(honey, key), created)
    assert.equal(
      (await run({ ...honey, name: 'Different' }, key)).response_status,
      409
    )
    assert.equal(
      (await run({ ...honey, code: 'honey-new' })).response_status,
      409
    )
    const jar = await run({
      ...honey,
      code: 'JAR-NEW',
      name: 'Glass jar',
      kind: 'packaging',
      unitOfMeasure: 'pieces'
    })
    assert.equal(jar.response_status, 201)
    const spice = await run({
      ...honey,
      code: 'SPICE-NEW',
      name: 'Cinnamon',
      kind: 'spice',
      unitOfMeasure: 'kg'
    })
    assert.equal(spice.response_status, 201)
    const get = async () =>
      (await db.query('select * from materials where id=$1', [id])).rows[0]
    assert.equal((await get()).low_stock_threshold, '12.345')
    assert.equal((await get()).code, 'HONEY-NEW')

    await db.exec(
      "insert into suppliers(supplier_name) values('Material test supplier')"
    )
    const receipt = () =>
      db.transaction(async tx => {
        await tx.query("select set_config('boms.actor_id',$1,true)", [actor])
        return tx.query(
          "select record_purchase(1,now(),'MAT-RECEIPT',null,$1)",
          [
            [
              {
                material_id: id,
                quantity: '20.000',
                unit_cost: '4500.00',
                lot_code: 'MAT-LOT'
              }
            ]
          ]
        )
      })
    await receipt()
    const before = (await db.query('select * from inventory_lots')).rows
    const edit = {
      ...honey,
      id,
      code: 'HONEY-UPDATED',
      name: 'Updated raw honey',
      description: 'New description',
      lowStockThreshold: '5.125',
      isActive: false
    }
    const editKey = randomUUID(),
      updated = await run(edit, editKey)
    assert.equal(updated.response_status, 200)
    assert.deepEqual(await run(edit, editKey), updated)
    assert.equal((await get()).is_active, false)
    assert.equal((await get()).name, edit.name)
    assert.deepEqual(
      (await db.query('select * from inventory_lots')).rows,
      before
    )
    assert.equal(
      (await db.query('select unit_cost from purchase_items')).rows[0]
        .unit_cost,
      '4500.00'
    )
    await assert.rejects(receipt(), /unavailable material/)
    await assert.rejects(
      run({ ...edit, unitOfMeasure: 'litres' }),
      /type and unit cannot change/
    )
    await assert.rejects(
      run({ ...edit, kind: 'packaging' }),
      /type and unit cannot change/
    )
    await assert.rejects(
      run({ ...edit, lowStockThreshold: '-1' }),
      /nonnegative threshold/
    )
    await assert.rejects(
      run({ ...edit, lowStockThreshold: '0.0001' }),
      /nonnegative threshold/
    )
    await assert.rejects(
      run({ ...edit, id: 999999, code: 'MISSING' }),
      /no longer exists/
    )
    await assert.rejects(run({ ...honey, code: ' ' }), /material code/)
    assert.equal((await run({ ...edit, code: 'jar-new' })).response_status, 409)
    await run({ ...edit, isActive: true })
    assert.equal((await get()).is_active, true)
    const audits = (
      await db.query(
        'select * from material_profile_audits where material_id=$1 order by id',
        [id]
      )
    ).rows
    assert.equal(audits.length, 3)
    assert.equal(audits[0].previous_profile, null)
    assert.equal(audits[1].previous_profile.name, 'Raw honey')
    assert.equal(audits[1].new_profile.is_active, false)
    assert.equal(audits[2].new_profile.is_active, true)
    assert.equal(
      (await db.query('select count(*)::int n from audit_logs')).rows[0].n,
      5
    )

    for (const role of [
      'production_staff',
      'sales_or_distribution_staff',
      'finance_accountant',
      'read_only_management'
    ]) {
      await db.query('update users set app_role=$1 where id=$2', [role, actor])
      await assert.rejects(
        run({ ...edit, isActive: true }),
        /role cannot manage materials/
      )
    }
    for (const role of ['operations_manager', 'warehouse_staff']) {
      await db.query('update users set app_role=$1 where id=$2', [role, actor])
      assert.equal(
        (await run({ ...edit, isActive: true })).response_status,
        200
      )
    }
    await db.query('update users set is_active=false where id=$1', [actor])
    await assert.rejects(run(edit), /role cannot manage materials/)
  } finally {
    await db.close()
  }
})
