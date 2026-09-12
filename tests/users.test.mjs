import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import { hash } from 'bcryptjs'

test('user management protects the last admin, revokes sessions, and audits without passwords', async () => {
  const db = new PGlite()
  const admin = 'c0c9a933-e11f-4db0-bfc5-462c116d8863'
  const passwordHash = await hash('test-only-user-password', 12)
  try {
    for (const file of readdirSync('neon/migrations').sort())
      await db.exec(readFileSync(`neon/migrations/${file}`, 'utf8'))
    await db.query(
      "insert into users(id,email,password_hash,app_role) values($1,'admin@example.invalid',$2,'admin_owner')",
      [admin, passwordHash]
    )
    const manage = async (actor, id, email, role, active, password = null) =>
      db.transaction(async tx => {
        await tx.query("select set_config('boms.actor_id',$1,true)", [actor])
        return (
          await tx.query("select manage_user($1,$2,'Test user',$3,$4,$5) id", [
            id,
            email,
            role,
            active,
            password
          ])
        ).rows[0].id
      })
    await assert.rejects(
      manage(admin, admin, null, 'read_only_management', true),
      /at least one active administrator/
    )
    const staff = await manage(
      admin,
      null,
      'Staff@Example.invalid',
      'warehouse_staff',
      true,
      passwordHash
    )
    assert.equal(
      (await db.query('select email from users where id=$1', [staff])).rows[0]
        .email,
      'staff@example.invalid'
    )
    await assert.rejects(
      manage(staff, staff, null, 'admin_owner', true),
      /active administrator is required/
    )
    await assert.rejects(
      manage(
        admin,
        null,
        'staff@example.invalid',
        'warehouse_staff',
        true,
        passwordHash
      ),
      /duplicate key/
    )
    await db.query(
      "insert into sessions(id,user_id,expires_at) values($1,$2,now()+interval '1 day')",
      ['a'.repeat(43), staff]
    )
    await manage(admin, staff, null, 'finance_accountant', false)
    assert.equal(
      (
        await db.query(
          'select count(*)::int n from sessions where user_id=$1',
          [staff]
        )
      ).rows[0].n,
      0
    )
    await manage(admin, staff, null, 'finance_accountant', true, passwordHash)
    const audits = (await db.query('select * from user_access_audits')).rows
    assert.equal(audits.length, 3)
    assert.equal(audits[1].previous_access.role, 'warehouse_staff')
    assert.equal(audits[1].new_access.is_active, false)
    assert.ok(!JSON.stringify(audits).includes(passwordHash))
    await manage(admin, staff, null, 'admin_owner', true)
    await assert.rejects(
      manage(admin, admin, null, 'read_only_management', true),
      /another administrator/
    )
  } finally {
    await db.close()
  }
})
