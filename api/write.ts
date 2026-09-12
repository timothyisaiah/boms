import { createHash } from 'node:crypto'
import { database } from '../server/db.js'
import { getSession, requireRole, WRITE_ROLES } from '../server/auth.js'
import { HttpError, method, route, sameOrigin } from '../server/http.js'
import { validateAction, canonicalJson } from '../server/validation.js'
export default route(async (req, res) => {
  const action = typeof req.query.action === 'string' ? req.query.action : ''
  const session = requireRole(await getSession(req), WRITE_ROLES[action] ?? [])
  method(req, 'POST')
  sameOrigin(req)
  const key = req.headers['idempotency-key']
  if (
    typeof key !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      key
    )
  )
    throw new HttpError(400, 'A valid Idempotency-Key is required.')
  if (Buffer.byteLength(JSON.stringify(req.body ?? {})) > 128000)
    throw new HttpError(413, 'This request is too large.')
  const hash = createHash('sha256')
    .update(canonicalJson(req.body))
    .digest('hex')
  const { query } = database()
  const [existing] =
    await query`select endpoint,request_hash,actor_id,response_status,response_body from idempotency_keys where key=${key}::uuid`
  if (existing) {
    if (
      existing.endpoint !== action ||
      existing.request_hash !== hash ||
      existing.actor_id !== session.id
    )
      throw new HttpError(
        409,
        'This retry key belongs to a different request.',
        'conflict'
      )
    if (existing.response_status !== null)
      return res.status(existing.response_status).json(existing.response_body)
  }
  const body = validateAction(action, req.body)
  const results = await query.transaction([
    query`select set_config('boms.actor_id',${session.id},true)`,
    action === 'variants'
      ? query`select * from public.execute_variant_save(${key}::uuid,${hash},${JSON.stringify(body)}::jsonb)`
      : action === 'materials'
        ? query`select * from public.execute_material_save(${key}::uuid,${hash},${JSON.stringify(body)}::jsonb)`
        : ['suppliers', 'retailers'].includes(action)
          ? query`select * from public.execute_partner_create(${key}::uuid,${action},${hash},${JSON.stringify(body)}::jsonb)`
          : query`select * from public.execute_idempotent(${key}::uuid,${action},${hash},${JSON.stringify(body)}::jsonb)`
  ])
  const saved = results[1][0]
  return res.status(saved.response_status).json(saved.response_body)
})
