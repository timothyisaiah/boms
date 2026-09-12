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
export function database() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('Database connection is not configured')
  const query = neon(url)
  return { query, db: drizzle(query) }
}
