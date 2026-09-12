import { readdirSync, readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { neon } from '@neondatabase/serverless'
import { loadEnv, modeArg } from './env.mjs'
import { statements } from './sql.mjs'
loadEnv(modeArg())
const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL
if (!url) throw new Error('Set server-only DATABASE_URL first.')
const query = neon(url)
await query`create table if not exists public.boms_migrations(name text primary key, checksum text not null, applied_at timestamptz not null default now())`
const applied = await query`select name,checksum from public.boms_migrations`
for (const file of readdirSync('neon/migrations')
  .filter(f => f.endsWith('.sql'))
  .sort()) {
  const source = readFileSync(`neon/migrations/${file}`, 'utf8')
  const checksum = createHash('sha256').update(source).digest('hex')
  const existing = applied.find(m => m.name === file)
  if (existing) {
    if (existing.checksum !== checksum)
      throw new Error(`Applied migration changed: ${file}`)
    continue
  }
  await query.transaction([
    query`select pg_advisory_xact_lock(42406609)`,
    ...statements(source).map(statement => query.query(statement)),
    query`insert into public.boms_migrations(name,checksum) values(${file},${checksum})`
  ])
  console.log(`Applied ${file}`)
}
