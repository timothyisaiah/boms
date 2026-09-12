import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
test('all forward Neon migrations apply to an isolated Postgres engine', async () => {
  const db = new PGlite()
  try {
    for (const file of readdirSync('neon/migrations').sort())
      await db.exec(readFileSync(`neon/migrations/${file}`, 'utf8'))
    const result = await db.query(
      "select count(*)::int count from information_schema.tables where table_schema='public'"
    )
    assert.ok(result.rows[0].count >= 30)
  } finally {
    await db.close()
  }
})
