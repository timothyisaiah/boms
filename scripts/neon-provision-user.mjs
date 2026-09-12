import { neon } from '@neondatabase/serverless'
import { hash } from 'bcryptjs'
import { loadEnv, modeArg } from './env.mjs'
loadEnv(modeArg())
const email = process.env.BOMS_ADMIN_EMAIL?.trim().toLowerCase()
const password = process.env.BOMS_ADMIN_PASSWORD
const role = process.env.BOMS_ADMIN_ROLE ?? 'admin_owner'
const name = process.env.BOMS_ADMIN_FULL_NAME ?? ''
if (
  !email?.includes('@') ||
  !password ||
  password.length < 12 ||
  Buffer.byteLength(password) > 72
)
  throw new Error(
    'Set BOMS_ADMIN_EMAIL and BOMS_ADMIN_PASSWORD (12–72 bytes) in a server-only env file.'
  )
const query = neon(process.env.DATABASE_URL)
const passwordHash = await hash(password, 12)
const result =
  await query`insert into users(email,password_hash,app_role,full_name) values(${email},${passwordHash},${role}::app_role,${name}) on conflict(email) do nothing returning id`
console.log(
  result.length
    ? 'User provisioned.'
    : 'User already exists; password and permissions unchanged.'
)
