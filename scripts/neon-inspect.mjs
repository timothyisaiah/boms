import { neon } from '@neondatabase/serverless'
import { loadEnv } from './env.mjs'
loadEnv()
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL missing')
const query = neon(process.env.DATABASE_URL)
const tables =
  await query`select table_name from information_schema.tables where table_schema='public' order by table_name`
console.log(
  JSON.stringify({ connected: true, tables: tables.map(t => t.table_name) })
)
