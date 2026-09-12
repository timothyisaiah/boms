// Runs against the provided development Neon branch. Test records use a unique
// actor and references, and only records owned by that actor are removed.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { randomBytes, randomUUID } from 'node:crypto'
import { hash } from 'bcryptjs'
import { neon, Client, neonConfig } from '@neondatabase/serverless'
import { readFileSync } from 'node:fs'
import { parseEnv } from 'node:util'
import auth from '../api/auth.js'
import write from '../api/write.js'
import workspace from '../api/workspace.js'
import reports from '../api/reports.js'
import cleanup from '../api/cleanup.js'
import partners from '../api/partners.js'
import materialsHandler from '../api/materials.js'
import variantsHandler from '../api/variants.js'
import { ALL_ROLES, WRITE_ROLES } from '../server/auth.js'
import type { VercelRequest, VercelResponse } from '@vercel/node'
for (const [key, value] of Object.entries(
  parseEnv(readFileSync('.env.development', 'utf8'))
))
  if (process.env[key] === undefined) process.env[key] = value
if (process.env.BOMS_TEST_DATABASE_URL)
  process.env.DATABASE_URL = process.env.BOMS_TEST_DATABASE_URL
neonConfig.webSocketConstructor = WebSocket
const query = neon(process.env.DATABASE_URL!)
const invoke = async (
  handler: typeof auth,
  options: Record<string, unknown> = {}
) => {
  let status = 200,
    body: unknown = null
  const headers: Record<string, string> = {}
  const req = {
    method: 'GET',
    query: {},
    headers: { host: 'localhost', origin: 'http://localhost' },
    ...options
  } as VercelRequest
  const res = {
    setHeader(key: string, value: string) {
      headers[key.toLowerCase()] = value
    },
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
  return { status, body: body as any, headers }
}
test(
  'Neon API operational validation, authorization and true concurrent writes',
  { timeout: 180000 },
  async () => {
    const actor = randomUUID(),
      prefix = `BOMS-TEST-${actor}`,
      email = `${actor}@example.invalid`,
      password = randomBytes(24).toString('base64url')
    const otherActor = randomUUID()
    const passwordHash = await hash(password, 12)
    const clients: Client[] = []
    let supplierId: string,
      retailerId: string,
      variantId: string,
      materialId: string,
      jarId: string
    try {
      await query`insert into users(id,email,password_hash,app_role) values(${actor}::uuid,${email},${passwordHash},'admin_owner'),(${otherActor}::uuid,${otherActor + '@example.invalid'},${passwordHash},'read_only_management')`
      const unauthorized = await invoke(workspace, {
        query: { name: 'operations' }
      })
      assert.equal(unauthorized.status, 401)
      const login = await invoke(auth, {
        method: 'POST',
        query: { action: 'login' },
        body: { email, password }
      })
      assert.equal(login.status, 200)
      assert.match(
        login.headers['set-cookie'],
        /HttpOnly; Secure; SameSite=Lax/
      )
      assert.ok(!JSON.stringify(login.body).includes(passwordHash))
      const cookie = login.headers['set-cookie'].split(';')[0]
      const headers = { host: 'localhost', origin: 'http://localhost', cookie }
      const call = (action: string, body: unknown, key = randomUUID()) =>
        invoke(write, {
          method: 'POST',
          query: { action },
          headers: { ...headers, 'idempotency-key': key },
          body
        })
      const get = (name: string) =>
        invoke(workspace, { query: { name }, headers })
      for (const name of [
        'operations',
        'retail',
        'finance',
        'dashboard',
        'settings'
      ])
        assert.equal((await get(name)).status, 200, `${name} workspace`)
      assert.equal(
        (
          await invoke(write, {
            method: 'POST',
            query: { action: 'expenses' },
            headers,
            body: {}
          })
        ).status,
        400
      )
      assert.equal(
        (
          await invoke(write, {
            method: 'POST',
            query: { action: 'expenses' },
            headers: { ...headers, origin: 'https://hostile.example' },
            body: {}
          })
        ).status,
        403
      )
      // Every role is tested against every write endpoint, before payload validation.
      for (const role of ALL_ROLES) {
        await query`update users set app_role=${role}::app_role where id=${actor}::uuid`
        for (const [action, allowed] of Object.entries(WRITE_ROLES))
          assert.equal(
            (await call(action, {})).status,
            allowed.includes(role) ? 422 : 403,
            `${role}/${action}`
          )
      }
      await query`update users set app_role='admin_owner' where id=${actor}::uuid`
      const variantBody = {
        productId: null,
        newProductName: prefix,
        newProductDescription: 'Temporary integration product',
        sku: prefix,
        variantName: prefix,
        flavor: 'Classic',
        packSizeGrams: 500,
        packagingType: 'Jar',
        lowStockThreshold: 5,
        isActive: true
      }
      const variantKey = randomUUID()
      const variantSaves = await Promise.all([
        call('variants', variantBody, variantKey),
        call('variants', variantBody, variantKey)
      ])
      assert.equal(
        variantSaves[0].status,
        201,
        JSON.stringify(variantSaves[0].body)
      )
      assert.deepEqual(variantSaves[0].body, variantSaves[1].body)
      variantId = variantSaves[0].body.id
      assert.equal(
        (await call('variants', { ...variantBody, sku: prefix.toLowerCase() }))
          .status,
        409
      )
      assert.equal((await invoke(variantsHandler)).status, 401)
      for (const role of ALL_ROLES) {
        await query`update users set app_role=${role}::app_role where id=${actor}::uuid`
        assert.equal(
          (await invoke(variantsHandler, { headers })).status,
          role === 'sales_or_distribution_staff' ? 403 : 200
        )
      }
      await query`update users set app_role='admin_owner' where id=${actor}::uuid`
      const materialBody = {
        code: prefix + '-H',
        name: prefix + ' honey',
        kind: 'raw_honey',
        unitOfMeasure: 'kg',
        description: 'Temporary integration material',
        lowStockThreshold: '5.125',
        isActive: true
      }
      const materialKey = randomUUID()
      const materialSaves = await Promise.all([
        call('materials', materialBody, materialKey),
        call('materials', materialBody, materialKey)
      ])
      assert.equal(
        materialSaves[0].status,
        201,
        JSON.stringify(materialSaves[0].body)
      )
      assert.deepEqual(materialSaves[0].body, materialSaves[1].body)
      materialId = materialSaves[0].body.id
      assert.equal(
        (
          await call('materials', {
            ...materialBody,
            code: materialBody.code.toLowerCase()
          })
        ).status,
        409
      )
      const jarBody = {
        ...materialBody,
        code: prefix + '-J',
        name: prefix + ' jar',
        kind: 'packaging',
        unitOfMeasure: 'piece'
      }
      const jarSaves = await Promise.all([
        call('materials', jarBody),
        call('materials', jarBody)
      ])
      assert.deepEqual(jarSaves.map(result => result.status).sort(), [201, 409])
      jarId = jarSaves.find(result => result.status === 201)!.body.id
      const spiceBody = {
        ...materialBody,
        code: prefix + '-S',
        name: prefix + ' cinnamon',
        kind: 'spice'
      }
      assert.equal((await call('materials', spiceBody)).status, 201)
      assert.equal((await invoke(materialsHandler)).status, 401)
      for (const role of ALL_ROLES) {
        await query`update users set app_role=${role}::app_role where id=${actor}::uuid`
        assert.equal(
          (await invoke(materialsHandler, { headers })).status,
          role === 'sales_or_distribution_staff' ? 403 : 200
        )
      }
      await query`update users set app_role='admin_owner' where id=${actor}::uuid`
      for (const bad of [
        { code: ' ' },
        { name: ' ' },
        { unitOfMeasure: '' },
        { kind: 'invalid' },
        { lowStockThreshold: '-1' },
        { lowStockThreshold: '0.0001' },
        { lowStockThreshold: '100000000000' },
        { isActive: 'false' },
        { quantity: 20 }
      ])
        assert.equal(
          (await call('materials', { ...materialBody, ...bad })).status,
          422
        )
      const supplierBody = {
        name: prefix,
        supplierKind: 'mixed',
        contactName: 'Test contact',
        phone: '+256700000000',
        email: 'supplier@example.invalid'
      }
      const supplierKey = randomUUID()
      const suppliers = await Promise.all([
        call('suppliers', supplierBody, supplierKey),
        call('suppliers', supplierBody, supplierKey)
      ])
      assert.equal(suppliers[0].status, 201)
      assert.deepEqual(suppliers[0].body, suppliers[1].body)
      supplierId = suppliers[0].body.id
      assert.equal((await call('suppliers', supplierBody)).status, 409)
      assert.equal(
        (
          await call(
            'suppliers',
            { ...supplierBody, name: prefix + '-changed' },
            supplierKey
          )
        ).status,
        409
      )
      const partner = await call('retailers', {
        name: prefix,
        deliveryLocation: 'Kampala test location',
        contactName: 'Retail contact'
      })
      assert.equal(partner.status, 201)
      retailerId = partner.body.id
      assert.ok(
        (await get('operations')).body.suppliers.some(
          (row: any) =>
            String(row.id) === String(supplierId) &&
            row.phone === supplierBody.phone
        )
      )
      assert.ok(
        (await get('retail')).body.retailers.some(
          (row: any) =>
            String(row.id) === String(retailerId) &&
            row.delivery_location === 'Kampala test location'
        )
      )
      const receipt = {
        supplierId,
        purchasedAt: '2026-08-01T10:00:00Z',
        purchaseReference: prefix,
        items: [
          {
            material_id: materialId,
            quantity: '20.000',
            unit_cost: '10000.00'
          },
          { material_id: jarId, quantity: '40.000', unit_cost: '500.00' }
        ]
      }
      const receiptKey = randomUUID()
      const same = await Promise.all([
        call('purchases', receipt, receiptKey),
        call('purchases', receipt, receiptKey)
      ])
      assert.equal(same[0].status, 201, JSON.stringify(same[0].body))
      assert.deepEqual(same[0].body, same[1].body)
      assert.equal(
        (await call('purchases', { ...receipt, notes: 'changed' }, receiptKey))
          .status,
        409
      )
      assert.equal((await call('purchases', {}, receiptKey)).status, 409)
      const beforeMaterialEdit =
        await query`select * from inventory_lots where created_by=${actor}::uuid order by id`
      const materialEdit = {
        ...materialBody,
        id: materialId,
        name: prefix + ' updated honey',
        lowStockThreshold: '25.125',
        isActive: false
      }
      const materialEditKey = randomUUID()
      assert.equal(
        (await call('materials', materialEdit, materialEditKey)).status,
        200
      )
      assert.equal(
        (await call('materials', materialEdit, materialEditKey)).status,
        200
      )
      assert.equal(
        (await call('materials', { ...materialEdit, unitOfMeasure: 'litres' }))
          .status,
        422
      )
      assert.equal(
        (await call('materials', { ...materialEdit, kind: 'packaging' }))
          .status,
        422
      )
      assert.equal((await call('purchases', receipt)).status, 422)
      assert.deepEqual(
        await query`select * from inventory_lots where created_by=${actor}::uuid order by id`,
        beforeMaterialEdit
      )
      assert.ok(
        !(await get('operations')).body.materials.some(
          (row: any) => String(row.id) === String(materialId)
        )
      )
      const inactiveMaterial = (
        await invoke(materialsHandler, { headers })
      ).body.materials.find((row: any) => String(row.id) === String(materialId))
      assert.equal(inactiveMaterial.is_active, false)
      assert.equal(inactiveMaterial.quantity_on_hand, '20.000')
      assert.equal(inactiveMaterial.low_stock_threshold, '25.125')
      assert.equal(
        (await call('materials', { ...materialEdit, isActive: true })).status,
        200
      )
      assert.ok(
        (await get('operations')).body.materials.some(
          (row: any) => String(row.id) === String(materialId)
        )
      )
      assert.equal(
        (
          await query`select count(*)::int n from material_profile_audits where actor_id=${actor}::uuid`
        )[0].n,
        5
      )
      const lots =
        await query`select id,material_id from inventory_lots where created_by=${actor}::uuid order by id`
      const production = {
        variantId,
        batchCode: prefix,
        startedAt: '2026-08-02T10:00:00Z',
        outputQuantity: 20,
        inputs: [
          { material_id: materialId, quantity: '10.000' },
          { material_id: jarId, quantity: '20.000' }
        ]
      }
      const produced = await call('production', production)
      assert.equal(produced.status, 201, JSON.stringify(produced.body))
      const [output] =
        await query`select id,unit_cost from production_outputs where production_batch_id=${produced.body.id}`
      assert.equal(output.unit_cost, '5500.00')
      const issue = {
        retailerId,
        issuedAt: '2026-08-03T10:00:00Z',
        items: [{ production_output_id: output.id, quantity: 15 }]
      }
      const raced = await Promise.all([
        call('stock-issues', issue),
        call('stock-issues', issue)
      ])
      assert.deepEqual(raced.map(r => r.status).sort(), [201, 422])
      assert.equal(
        (
          await query`select quantity_remaining from production_outputs where id=${output.id}`
        )[0].quantity_remaining,
        5
      )
      const [issueLine] =
        await query`select id from stock_issue_items where production_output_id=${output.id}`
      const settlement = {
        retailerId,
        reconciledAt: '2026-08-04T10:00:00Z',
        items: [
          {
            stock_issue_item_id: issueLine.id,
            quantity_sold: 5,
            quantity_returned: 2,
            quantity_damaged: 1,
            quantity_expired: 1,
            quantity_remaining: 6,
            return_reason: 'Test shelf check'
          }
        ]
      }
      assert.equal(
        (
          await call('prices', {
            variantId,
            unitPrice: '20000.00',
            effectiveFrom: '2026-08-01T00:00:00Z'
          })
        ).status,
        201
      )
      assert.equal(
        (
          await call('reconciliations', {
            ...settlement,
            items: [{ ...settlement.items[0], unit_price: 1 }]
          })
        ).status,
        422
      )
      const reconRace = await Promise.all([
        call('reconciliations', settlement),
        call('reconciliations', settlement)
      ])
      assert.deepEqual(reconRace.map(r => r.status).sort(), [201, 422])
      const reconId = reconRace.find(r => r.status === 201)!.body.id
      assert.equal(
        (
          await query`select quantity_remaining from production_outputs where id=${output.id}`
        )[0].quantity_remaining,
        7
      )
      for (const amount of ['30000.00', '20000.00'])
        assert.equal(
          (
            await call('remittances', {
              retailerId,
              reconciliationId: reconId,
              receivedAt: '2026-08-05T10:00:00Z',
              amount
            })
          ).status,
          201
        )
      assert.equal(
        (
          await query`select outstanding_amount from retailer_outstanding_balances where retailer_id=${retailerId}`
        )[0].outstanding_amount,
        '50000.00'
      )
      assert.equal(
        (
          await call('expenses', {
            expenseCategory: prefix,
            incurredAt: '2026-08-06T10:00:00Z',
            amount: '10000.00'
          })
        ).status,
        201
      )
      assert.equal(
        (
          await invoke(reports, {
            query: { start: '2026-08-01', end: '2026-09-01' },
            headers
          })
        ).status,
        200
      )
      await query`update users set app_role='sales_or_distribution_staff' where id=${actor}::uuid`
      const salesDashboard = await get('dashboard')
      assert.equal(salesDashboard.status, 200)
      assert.ok(
        salesDashboard.body.batches.every(
          (b: Record<string, unknown>) => !Object.hasOwn(b, 'inputs')
        )
      )
      assert.deepEqual(salesDashboard.body.expenses, [])
      await query`update users set app_role='admin_owner' where id=${actor}::uuid`
      // A held oldest lot is skipped. The FIFO worker consumes the second receipt.
      await call('purchases', {
        ...receipt,
        purchaseReference: prefix + '-second',
        purchasedAt: '2026-08-02T10:00:00Z'
      })
      const holder = new Client({ connectionString: process.env.DATABASE_URL })
      clients.push(holder)
      await holder.connect()
      await holder.query('begin')
      await holder.query(
        'select id from inventory_lots where id=$1 for update',
        [lots[0].id]
      )
      const fifo = await call('production', {
        ...production,
        batchCode: prefix + '-skip',
        startedAt: '2026-08-07T10:00:00Z',
        inputs: [
          { material_id: materialId, quantity: '2.000' },
          { material_id: jarId, quantity: '2.000' }
        ],
        outputQuantity: 4
      })
      assert.equal(fifo.status, 201, JSON.stringify(fifo.body))
      const consumed =
        await query`select inventory_lot_id from production_inputs where production_batch_id=${fifo.body.id} and material_id=${materialId}`
      assert.notEqual(String(consumed[0].inventory_lot_id), String(lots[0].id))
      await holder.query('rollback')
      await holder.end()
      clients.pop()
      const partnerGet = (kind: string) =>
        invoke(partners, { query: { kind }, headers })
      const supplierProfiles = await partnerGet('supplier')
      assert.equal(supplierProfiles.status, 200)
      assert.ok(
        supplierProfiles.body.partners.some(
          (row: any) => String(row.id) === String(supplierId)
        )
      )
      const supplierProfile = {
        kind: 'supplier',
        id: supplierId,
        name: prefix + '-updated',
        supplierKind: 'raw_honey',
        contactName: 'Updated contact',
        phone: '+256711111111',
        email: 'updated@example.invalid',
        deliveryLocation: '',
        notes: 'Profile audit test',
        isActive: false
      }
      assert.equal(
        (
          await invoke(partners, {
            method: 'PATCH',
            headers,
            body: supplierProfile
          })
        ).status,
        200
      )
      assert.equal(
        (await get('operations')).body.suppliers.some(
          (row: any) => String(row.id) === String(supplierId)
        ),
        false
      )
      assert.equal(
        (
          await invoke(partners, {
            method: 'PATCH',
            headers,
            body: { ...supplierProfile, isActive: true }
          })
        ).status,
        200
      )
      const retailerProfile = {
        kind: 'retailer',
        id: retailerId,
        name: prefix,
        supplierKind: null,
        contactName: 'Retail profile contact',
        phone: '',
        email: '',
        deliveryLocation: 'Wakiso test location',
        notes: '',
        isActive: true
      }
      assert.equal(
        (
          await invoke(partners, {
            method: 'PATCH',
            headers,
            body: retailerProfile
          })
        ).status,
        200
      )
      assert.equal(
        (
          await query`select count(*)::int n from partner_profile_audits where actor_id=${actor}::uuid`
        )[0].n,
        3
      )
      // Instant revocation and deactivation are observed on the very next request.
      await query`update users set is_active=false where id=${actor}::uuid`
      assert.equal((await get('operations')).status, 401)
      await query`update users set is_active=true where id=${actor}::uuid`
      const logout = await invoke(auth, {
        method: 'POST',
        query: { action: 'logout' },
        headers,
        body: {}
      })
      assert.equal(logout.status, 204)
      assert.equal((await get('operations')).status, 401)
      assert.equal((await invoke(cleanup)).status, 401)
      process.env.CRON_SECRET = randomBytes(32).toString('base64url')
      const expiredToken = randomBytes(32).toString('base64url'),
        oldKey = randomUUID()
      await query`insert into sessions(id,user_id,expires_at) values(${expiredToken},${actor}::uuid,now()-interval '1 day')`
      await query`insert into idempotency_keys(key,endpoint,request_hash,actor_id,created_at) values(${oldKey}::uuid,'expenses','old-test',${actor}::uuid,now()-interval '49 hours')`
      assert.equal(
        (
          await invoke(cleanup, {
            headers: { authorization: `Bearer ${process.env.CRON_SECRET}` }
          })
        ).status,
        200
      )
      assert.equal(
        (await query`select id from sessions where id=${expiredToken}`).length,
        0
      )
      assert.equal(
        (
          await query`select key from idempotency_keys where key=${oldKey}::uuid`
        ).length,
        0
      )
    } finally {
      for (const client of clients) {
        await client.query('rollback').catch(() => {})
        await client.end().catch(() => {})
      }
      await query.transaction([
        query`delete from returns where reconciliation_item_id in(select i.id from reconciliation_items i join reconciliations r on r.id=i.reconciliation_id where r.created_by=${actor}::uuid)`,
        query`delete from retailer_stock_ledgers where created_by=${actor}::uuid`,
        query`delete from remittances where created_by=${actor}::uuid`,
        query`delete from reconciliation_items where reconciliation_id in(select id from reconciliations where created_by=${actor}::uuid)`,
        query`delete from reconciliations where created_by=${actor}::uuid`,
        query`delete from stock_issue_items where stock_issue_id in(select id from stock_issues where created_by=${actor}::uuid)`,
        query`delete from stock_issues where created_by=${actor}::uuid`,
        query`delete from production_inputs where production_batch_id in(select id from production_batches where created_by=${actor}::uuid)`,
        query`delete from production_outputs where production_batch_id in(select id from production_batches where created_by=${actor}::uuid)`,
        query`delete from production_batches where created_by=${actor}::uuid`,
        query`delete from inventory_lots where created_by=${actor}::uuid`,
        query`delete from purchase_items where purchase_id in(select id from purchases where created_by=${actor}::uuid)`,
        query`delete from purchases where created_by=${actor}::uuid`,
        query`delete from expenses where created_by=${actor}::uuid`,
        query`delete from pricing where created_by=${actor}::uuid`,
        query`delete from audit_logs where actor_id=${actor}::uuid`,
        query`delete from partner_profile_audits where actor_id=${actor}::uuid`,
        query`delete from material_profile_audits where actor_id=${actor}::uuid`,
        query`delete from variant_profile_audits where actor_id=${actor}::uuid`,
        query`delete from idempotency_keys where actor_id=${actor}::uuid`,
        query`delete from users where id in(${actor}::uuid,${otherActor}::uuid)`,
        query`delete from retailers where retailer_name=${prefix}`,
        query`delete from suppliers where id=${supplierId}::bigint`,
        query`delete from materials where code in(${prefix + '-H'},${prefix + '-J'},${prefix + '-S'})`,
        query`delete from product_variants where sku=${prefix}`,
        query`delete from products where slug=${prefix.toLowerCase()}`
      ])
    }
  }
)
