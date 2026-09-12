import { timingSafeEqual } from 'node:crypto'
import { database } from '../server/db.js'
import { HttpError, method, route } from '../server/http.js'
export default route(async (req, res) => {
  // Machine-only exception to requireRole: authenticate the daily Vercel Cron secret.
  method(req, 'GET')
  const secret = process.env.CRON_SECRET
  const actual = Buffer.from(req.headers.authorization ?? '')
  const expected = Buffer.from(`Bearer ${secret}`)
  if (
    !secret ||
    secret.length < 32 ||
    actual.length !== expected.length ||
    !timingSafeEqual(actual, expected)
  )
    throw new HttpError(401, 'Unauthorized.', 'authentication')
  const { query } = database()
  await query.transaction([
    query`delete from sessions where expires_at <= now()`,
    query`delete from idempotency_keys where created_at < now()-interval '48 hours'`,
    query`delete from login_attempts where window_start < now()-interval '1 day'`
  ])
  return res.json({ ok: true })
})
