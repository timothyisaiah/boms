import { z } from 'zod'
import { database } from '../server/db.js'
import {
  getSession,
  requireRole,
  RETAIL,
  SUPPLY,
  WRITE_ROLES
} from '../server/auth.js'
import { HttpError, route, sameOrigin } from '../server/http.js'

const kindSchema = z.enum(['supplier', 'retailer'])
const bodySchema = z
  .strictObject({
    kind: kindSchema,
    id: z.union([
      z.number().int().positive().safe(),
      z.string().regex(/^[1-9]\d*$/)
    ]),
    name: z.string().trim().min(1).max(160),
    supplierKind: z
      .enum(['raw_honey', 'packaging', 'mixed', 'spice'])
      .nullish(),
    contactName: z.string().trim().max(120).optional(),
    phone: z.string().trim().max(40).optional(),
    email: z.union([z.email(), z.literal('')]).optional(),
    deliveryLocation: z.string().trim().max(300).optional(),
    notes: z.string().trim().max(2000).optional(),
    isActive: z.boolean()
  })
  .superRefine((value, context) => {
    if (value.kind === 'supplier' && !value.supplierKind)
      context.addIssue({
        code: 'custom',
        path: ['supplierKind'],
        message: 'Select a supplier type.'
      })
  })

export default route(async (req, res) => {
  const session = await getSession(req)
  const queryKind = typeof req.query.kind === 'string' ? req.query.kind : ''
  if (req.method === 'GET') {
    const parsedKind = kindSchema.safeParse(queryKind)
    if (!parsedKind.success)
      throw new HttpError(422, 'Select suppliers or retailers.')
    requireRole(session, parsedKind.data === 'supplier' ? SUPPLY : RETAIL)
    const { query } = database()
    const rows =
      parsedKind.data === 'supplier'
        ? await query`select id,supplier_name name,supplier_kind,"contact_name","phone","email","notes","is_active","created_at","updated_at" from suppliers order by is_active desc,lower(supplier_name),id`
        : await query`select id,retailer_name name,"contact_name","phone","email","delivery_location","notes","is_active","created_at","updated_at" from retailers order by is_active desc,lower(retailer_name),id`
    return res.json({ partners: rows })
  }
  if (req.method !== 'PATCH') throw new HttpError(405, 'Method not allowed.')
  sameOrigin(req)
  const parsed = bodySchema.safeParse(req.body)
  if (!parsed.success)
    throw new HttpError(
      422,
      parsed.error.issues
        .map(issue => `${issue.path.join('.')}: ${issue.message}`)
        .join('; ')
    )
  const body = parsed.data
  const actor = requireRole(session, WRITE_ROLES[`${body.kind}s`] ?? [])
  const { query } = database()
  const result = await query
    .transaction([
      query`select set_config('boms.actor_id',${actor.id},true)`,
      query`select public.manage_partner_profile(${body.kind},${body.id}::bigint,${body.name},${body.supplierKind ?? null}::public.supplier_kind,${body.contactName ?? ''},${body.phone ?? ''},${body.email ?? ''},${body.deliveryLocation ?? ''},${body.notes ?? ''},${body.isActive}) id`
    ])
    .catch((error: { code?: string }) => {
      if (error.code === '23505')
        throw new HttpError(
          409,
          `Another ${body.kind} already uses this name.`,
          'conflict'
        )
      throw error
    })
  return res.json({ id: result[1][0].id })
})
