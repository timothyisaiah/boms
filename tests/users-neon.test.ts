import { test } from 'node:test'
import assert from 'node:assert/strict'
import { randomBytes, randomUUID } from 'node:crypto'
import { hash, compare } from 'bcryptjs'
import { neon } from '@neondatabase/serverless'
import { loadEnv } from '../scripts/env.mjs'
import usersHandler from '../api/users.js'
import auth from '../api/auth.js'
import type { VercelRequest, VercelResponse } from '@vercel/node'
loadEnv()
if (process.env.BOMS_TEST_DATABASE_URL)
  process.env.DATABASE_URL = process.env.BOMS_TEST_DATABASE_URL
const query = neon(process.env.DATABASE_URL!)
const invoke = async (
  handler: typeof auth,
  options: Record<string, unknown> = {}
) => {
  let status = 200,
    body: any
  const request = {
    method: 'GET',
    query: {},
    headers: { host: 'localhost', origin: 'http://localhost' },
    ...options
  } as VercelRequest
  const response = {
    setHeader() {},
    status(code: number) {
      status = code
      return this
    },
    json(value: unknown) {
      body = value
      return this
    },
    end() {}
  } as unknown as VercelResponse
  await handler(request, response)
  return { status, body }
}
test(
  'Neon user API enforces admin access and serializes competing access changes',
  { timeout: 60000 },
  async () => {
    const actor = randomUUID(),
      other = randomUUID(),
      email = `${randomUUID()}@example.invalid`
    const password = randomBytes(24).toString('base64url'),
      passwordHash = await hash(password, 12)
    const tokenA = randomBytes(32).toString('base64url'),
      tokenB = randomBytes(32).toString('base64url')
    let created: string | null = null
    const headers = (token: string) => ({
      host: 'localhost',
      origin: 'http://localhost',
      cookie: `boms_session=${token}`
    })
    const call = (token: string, method = 'GET', body?: unknown) =>
      invoke(usersHandler, { method, headers: headers(token), body })
    try {
      await query`insert into users(id,email,password_hash,app_role) values(${actor}::uuid,${actor + '@example.invalid'},${passwordHash},'admin_owner'),(${other}::uuid,${other + '@example.invalid'},${passwordHash},'admin_owner')`
      await query`insert into sessions(id,user_id,expires_at) values(${tokenA},${actor}::uuid,now()+interval '1 day'),(${tokenB},${other}::uuid,now()+interval '1 day')`
      assert.equal((await invoke(usersHandler)).status, 401)
      const listing = await call(tokenA)
      assert.equal(listing.status, 200)
      assert.ok(
        listing.body.users.every(
          (user: Record<string, unknown>) => !('password_hash' in user)
        )
      )
      const body = {
        email,
        fullName: 'Temporary test staff',
        role: 'warehouse_staff',
        isActive: true,
        password
      }
      const result = await call(tokenA, 'POST', body)
      assert.equal(result.status, 201)
      created = result.body.id
      assert.equal((await call(tokenA, 'POST', body)).status, 409)
      const [stored] =
        await query`select password_hash from users where id=${created}::uuid`
      assert.ok(await compare(password, stored.password_hash))
      assert.equal(
        (await call(tokenA, 'POST', { ...body, password: 'short' })).status,
        422
      )
      const staffToken = randomBytes(32).toString('base64url')
      await query`insert into sessions(id,user_id,expires_at) values(${staffToken},${created}::uuid,now()+interval '1 day')`
      assert.equal((await call(staffToken)).status, 403)
      assert.equal(
        (
          await call(staffToken, 'PATCH', {
            id: created,
            fullName: body.fullName,
            role: 'admin_owner',
            isActive: true
          })
        ).status,
        403
      )
      const update = {
        id: created,
        fullName: body.fullName,
        role: 'finance_accountant',
        isActive: false
      }
      assert.equal((await call(tokenA, 'PATCH', update)).status, 200)
      assert.equal(
        (await query`select id from sessions where user_id=${created}::uuid`)
          .length,
        0
      )
      assert.equal(
        (
          await invoke(auth, {
            method: 'POST',
            query: { action: 'login' },
            body: { email, password }
          })
        ).status,
        401
      )
      const replacementPassword = randomBytes(24).toString('base64url')
      assert.equal(
        (
          await call(tokenA, 'PATCH', {
            ...update,
            isActive: true,
            password: replacementPassword
          })
        ).status,
        200
      )
      assert.equal(
        (
          await invoke(auth, {
            method: 'POST',
            query: { action: 'login' },
            body: { email, password }
          })
        ).status,
        401
      )
      assert.equal(
        (
          await invoke(auth, {
            method: 'POST',
            query: { action: 'login' },
            body: { email, password: replacementPassword }
          })
        ).status,
        200
      )
      // Both requests start as administrators. Only the first may demote the other.
      const competing = await Promise.all([
        call(tokenA, 'PATCH', {
          id: other,
          fullName: 'Test peer',
          role: 'read_only_management',
          isActive: true
        }),
        call(tokenB, 'PATCH', {
          id: actor,
          fullName: 'Test peer',
          role: 'read_only_management',
          isActive: true
        })
      ])
      assert.equal(competing.filter(result => result.status === 200).length, 1)
      assert.ok(competing.some(result => [403, 422].includes(result.status)))
    } finally {
      await query`delete from user_access_audits where actor_id in(${actor}::uuid,${other}::uuid)`
      await query`delete from users where id in(${actor}::uuid,${other}::uuid,${created}::uuid)`
    }
  }
)
