import { hash } from 'bcryptjs'
import { z } from 'zod'
import { asc } from 'drizzle-orm'
import { database, users } from '../server/db.js'
import { ALL_ROLES, getSession, requireRole } from '../server/auth.js'
import { HttpError, route, sameOrigin } from '../server/http.js'

const password = z
  .string()
  .min(12)
  .refine(value => Buffer.byteLength(value) <= 72, 'Use at most 72 bytes.')
const fields = {
  fullName: z.string().trim().min(1).max(120),
  role: z.enum(ALL_ROLES),
  isActive: z.boolean()
}
const createSchema = z.strictObject({
  ...fields,
  email: z.email().trim().toLowerCase().max(254),
  password
})
const updateSchema = z.strictObject({
  ...fields,
  id: z.uuid(),
  password: password.optional()
})

export default route(async (req, res) => {
  const actor = requireRole(await getSession(req), ['admin_owner'])
  const { db, query } = database()
  if (req.method === 'GET') {
    const rows = await db
      .select({
        id: users.id,
        email: users.email,
        full_name: users.fullName,
        role: users.appRole,
        is_active: users.isActive
      })
      .from(users)
      .orderBy(asc(users.email))
    return res.json({ users: rows })
  }
  if (!['POST', 'PATCH'].includes(req.method ?? ''))
    throw new HttpError(405, 'Method not allowed.')
  sameOrigin(req)
  const parsed = (
    req.method === 'POST' ? createSchema : updateSchema
  ).safeParse(req.body)
  if (!parsed.success)
    throw new HttpError(
      422,
      parsed.error.issues
        .map(issue => `${issue.path.join('.')}: ${issue.message}`)
        .join('; ')
    )
  const body = parsed.data
  const passwordHash = body.password ? await hash(body.password, 12) : null
  const result = await query
    .transaction([
      query`select set_config('boms.actor_id',${actor.id},true)`,
      query`select public.manage_user(${'id' in body ? body.id : null}::uuid,${'email' in body ? body.email : null},${body.fullName},${body.role}::public.app_role,${body.isActive},${passwordHash}) id`
    ])
    .catch((error: { code?: string }) => {
      if (error.code === '23505')
        throw new HttpError(
          409,
          'An account with this email already exists. Edit that user instead.',
          'conflict'
        )
      throw error
    })
  return res
    .status(req.method === 'POST' ? 201 : 200)
    .json({ id: result[1][0].id })
})
