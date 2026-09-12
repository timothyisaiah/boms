import { test } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'

test('supplier and retailer creation preserves contacts, rejects duplicate names, and replays safely', async () => {
  const db = new PGlite(),
    actor = randomUUID()
  try {
    for (const file of readdirSync('neon/migrations').sort())
      await db.exec(readFileSync(`neon/migrations/${file}`, 'utf8'))
    await db.query(
      "insert into users(id,email,password_hash,app_role) values($1,'partner-test@example.invalid','test-only','admin_owner')",
      [actor]
    )
    const run = (action, body, key = randomUUID()) =>
      db.transaction(async tx => {
        await tx.query("select set_config('boms.actor_id',$1,true)", [actor])
        return (
          await tx.query('select * from execute_partner_create($1,$2,$3,$4)', [
            key,
            action,
            JSON.stringify(body),
            body
          ])
        ).rows[0]
      })
    const key = randomUUID(),
      body = {
        name: 'New supplier',
        supplierKind: 'raw_honey',
        contactName: 'Contact person',
        phone: '+256700000000',
        email: 'CONTACT@EXAMPLE.INVALID',
        notes: 'Collection on Monday'
      }
    const first = await run('suppliers', body, key)
    assert.deepEqual(await run('suppliers', body, key), first)
    assert.equal(
      (await run('suppliers', { ...body, name: 'Different' }, key))
        .response_status,
      409
    )
    await assert.rejects(
      run('suppliers', { ...body, name: 'new SUPPLIER' }),
      /duplicate key/
    )
    const supplier = (await db.query('select * from suppliers')).rows[0]
    assert.equal(supplier.email, 'contact@example.invalid')
    assert.equal(supplier.supplier_kind, 'raw_honey')
    await run('suppliers', {
      ...body,
      name: 'Spice supplier',
      supplierKind: 'spice'
    })
    assert.equal(
      (
        await db.query(
          "select supplier_kind from suppliers where supplier_name='Spice supplier'"
        )
      ).rows[0].supplier_kind,
      'spice'
    )
    await run('retailers', {
      name: 'New retailer',
      deliveryLocation: 'Ntinda',
      phone: '0700000000'
    })
    assert.equal(
      (await db.query('select delivery_location from retailers')).rows[0]
        .delivery_location,
      'Ntinda'
    )
    assert.equal(
      (await db.query('select count(*)::int n from audit_logs')).rows[0].n,
      3
    )
    await db.query(
      "update users set app_role='read_only_management' where id=$1",
      [actor]
    )
    await assert.rejects(run('suppliers', body), /role cannot add/)
    await db.query("update users set app_role='admin_owner' where id=$1", [
      actor
    ])
    const manage = (kind, id, profile) =>
      db.transaction(async tx => {
        await tx.query("select set_config('boms.actor_id',$1,true)", [actor])
        return tx.query(
          'select manage_partner_profile($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',
          [
            kind,
            id,
            profile.name,
            profile.supplierKind ?? null,
            profile.contactName ?? '',
            profile.phone ?? '',
            profile.email ?? '',
            profile.deliveryLocation ?? '',
            profile.notes ?? '',
            profile.isActive
          ]
        )
      })
    await manage('supplier', supplier.id, {
      name: 'Renamed supplier',
      supplierKind: 'packaging',
      contactName: 'New contact',
      phone: '0711111111',
      email: 'new@example.invalid',
      notes: 'Updated',
      isActive: false
    })
    const updatedSupplier = (
      await db.query('select * from suppliers where id=$1', [supplier.id])
    ).rows[0]
    assert.equal(updatedSupplier.supplier_name, 'Renamed supplier')
    assert.equal(updatedSupplier.supplier_kind, 'packaging')
    assert.equal(updatedSupplier.is_active, false)
    assert.equal(
      (await db.query('select count(*)::int n from partner_profile_audits'))
        .rows[0].n,
      1
    )
    assert.equal(
      (await db.query('select count(*)::int n from suppliers')).rows[0].n,
      2
    )
    await assert.rejects(
      manage('retailer', 999999, { name: 'Missing', isActive: true }),
      /no longer exists/
    )
  } finally {
    await db.close()
  }
})
