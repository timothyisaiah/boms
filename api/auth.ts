import { createHash, randomBytes } from 'node:crypto'
import { compare } from 'bcryptjs'
import { eq } from 'drizzle-orm'
import { database, users, sessions } from '../server/db.js'
import {
  getSession,
  requireRole,
  ALL_ROLES,
  sessionCookie,
  sessionToken
} from '../server/auth.js'
import { HttpError, method, route, sameOrigin } from '../server/http.js'
const dummyHash = '$2b$12$C6UzMDM.H6dfI/f/IKcEe.8SvPFyEnEOlsQoZM6GR.YWJC2kkwR0e'
export default route(async (req, res) => {
  const action = req.query.action
  if (action === 'login') {
    // Public bootstrap exception: credentials establish the session.
    method(req, 'POST')
    sameOrigin(req)
    const { email, password } = req.body ?? {}
    if (
      typeof email !== 'string' ||
      typeof password !== 'string' ||
      email.length > 254 ||
      Buffer.byteLength(password) > 72 ||
      !password.length
    )
      throw new HttpError(422, 'Enter an email and password.')
    const { query, db } = database()
    const key = createHash('sha256')
      .update(email.trim().toLowerCase())
      .digest('hex')
    const attempts =
      await query`insert into login_attempts(key) values(${key}) on conflict(key) do update set attempts=case when login_attempts.window_start < now()-interval '15 minutes' then 1 else login_attempts.attempts+1 end,window_start=case when login_attempts.window_start < now()-interval '15 minutes' then now() else login_attempts.window_start end returning attempts`
    if (attempts[0].attempts > 10)
      throw new HttpError(
        429,
        'Too many sign-in attempts. Try again in 15 minutes.',
        'authentication'
      )
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email.trim().toLowerCase()))
      .limit(1)
    const valid = await compare(password, user?.passwordHash ?? dummyHash)
    if (!valid || !user?.isActive)
      throw new HttpError(
        401,
        'Email or password is incorrect.',
        'authentication'
      )
    const session = requireRole(
      {
        id: user.id,
        email: user.email,
        full_name: user.fullName,
        role: user.appRole,
        is_active: user.isActive
      },
      ALL_ROLES
    )
    const token = randomBytes(32).toString('base64url')
    const expires = new Date(Date.now() + 7 * 86400000)
    // Serialize session creation with password resets/deactivation. A password
    // verified before an access change cannot create a session afterward.
    const created = await query.transaction([
      query`select id from public.users where id=${user.id}::uuid and is_active and password_hash=${user.passwordHash} for share`,
      query`insert into public.sessions(id,user_id,expires_at) select ${token},id,${expires.toISOString()}::timestamptz from public.users where id=${user.id}::uuid and is_active and password_hash=${user.passwordHash} returning id`
    ])
    if (!created[1].length)
      throw new HttpError(
        401,
        'Your access changed during sign-in. Try again.',
        'authentication'
      )
    res.setHeader('Set-Cookie', sessionCookie(token, expires))
    return res.json({ user: session })
  }
  if (action === 'logout') {
    method(req, 'POST')
    sameOrigin(req)
    // Revocation also works for an expired/deactivated session; it grants no data access.
    const token = sessionToken(req)
    if (token)
      await database().db.delete(sessions).where(eq(sessions.id, token))
    res.setHeader('Set-Cookie', sessionCookie('', new Date(0)))
    return res.status(204).end()
  }
  const session = requireRole(await getSession(req), ALL_ROLES)
  method(req, 'GET')
  return res.json({ user: session })
})
