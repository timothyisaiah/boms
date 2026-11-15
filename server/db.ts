import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { pgTable, text, uuid, timestamp, boolean } from 'drizzle-orm/pg-core'

export const users = pgTable('users', {
  id: uuid().primaryKey(),
  email: text().notNull(),
  fullName: text('full_name').notNull(),
  passwordHash: text('password_hash').notNull(),
  appRole: text('app_role').notNull(),
  isActive: boolean('is_active').notNull()
})
export const sessions = pgTable('sessions', {
  id: text().primaryKey(),
  userId: uuid('user_id').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull()
})
function connect(url: string) {
  const query = neon(url)
  return { query, db: drizzle(query) }
}
type Database = ReturnType<typeof connect>
let testDatabase: Database | null = null
// Test seam: lets in-memory PGlite tests run the real read handlers. Production
// code never calls it; passing null restores the configured Neon connection.
export function setTestDatabase(value: unknown) {
  testDatabase = value as Database | null
}
export function database(): Database {
  if (testDatabase) return testDatabase
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('Database connection is not configured')
  return connect(url)
}
