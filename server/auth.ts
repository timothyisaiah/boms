import { and, eq, gt } from 'drizzle-orm'
import type { VercelRequest } from '@vercel/node'
import { database, users, sessions } from './db.js'
import { HttpError } from './http.js'

export const ALL_ROLES = [
  'admin_owner',
  'operations_manager',
  'production_staff',
  'warehouse_staff',
  'sales_or_distribution_staff',
  'finance_accountant',
  'read_only_management'
] as const
export const SUPPLY: readonly string[] = ALL_ROLES.filter(
  role => role !== 'sales_or_distribution_staff'
)
export const RETAIL: readonly string[] = ALL_ROLES.filter(
  role => role !== 'production_staff'
)
export const REVIEW = [
  'admin_owner',
  'operations_manager',
  'sales_or_distribution_staff',
  'finance_accountant',
  'read_only_management'
]
export const FINANCE = [
  'admin_owner',
  'operations_manager',
  'finance_accountant',
  'read_only_management'
]
export const FINANCE_WRITE = [
  'admin_owner',
  'operations_manager',
  'finance_accountant'
]
export const WRITE_ROLES: Record<string, readonly string[]> = {
  materials: ['admin_owner', 'operations_manager', 'warehouse_staff'],
  variants: ['admin_owner', 'operations_manager'],
  suppliers: ['admin_owner', 'operations_manager', 'warehouse_staff'],
  retailers: [
    'admin_owner',
    'operations_manager',
    'warehouse_staff',
    'sales_or_distribution_staff'
  ],
  purchases: ['admin_owner', 'operations_manager', 'warehouse_staff'],
  production: ['admin_owner', 'operations_manager', 'production_staff'],
  'production-run': ['admin_owner', 'operations_manager', 'production_staff'],
  'direct-sales': [
    'admin_owner',
    'operations_manager',
    'warehouse_staff',
    'sales_or_distribution_staff'
  ],
  'retailer-checkins': FINANCE_WRITE,
  'variant-barcode': ['admin_owner', 'operations_manager'],
  'stock-issues': [
    'admin_owner',
    'operations_manager',
    'warehouse_staff',
    'sales_or_distribution_staff'
  ],
  reconciliations: FINANCE_WRITE,
  returns: FINANCE_WRITE,
  remittances: FINANCE_WRITE,
  expenses: FINANCE_WRITE,
  prices: ['admin_owner', 'operations_manager'],
  recipes: ['admin_owner', 'operations_manager']
}
export type Session = {
  id: string
  email: string
  full_name: string
  role: string
  is_active: boolean
}
export function requireRole(
  session: Session | null,
  roles: readonly string[]
): Session {
  if (!session?.is_active)
    throw new HttpError(401, 'Sign in to continue.', 'authentication')
  if (!roles.includes(session.role))
    throw new HttpError(
      403,
      'Your role cannot perform this action.',
      'authorization'
    )
  return session
}
export function sessionToken(req: VercelRequest) {
  const value = (req.headers.cookie ?? '')
    .split(';')
    .map(v => v.trim())
    .find(v => v.startsWith('boms_session='))
    ?.slice(13)
  return value && /^[A-Za-z0-9_-]{43}$/.test(value) ? value : null
}
export function sessionCookie(token: string, expires: Date) {
  return `boms_session=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Expires=${expires.toUTCString()}`
}
export async function getSession(req: VercelRequest): Promise<Session | null> {
  const token = sessionToken(req)
  if (!token) return null
  const { db } = database()
  const result = await db
    .select({
      id: users.id,
      email: users.email,
      full_name: users.fullName,
      role: users.appRole,
      is_active: users.isActive
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(
      and(
        eq(sessions.id, token),
        gt(sessions.expiresAt, new Date()),
        eq(users.isActive, true)
      )
    )
    .limit(1)
  return result[0] ?? null
}
