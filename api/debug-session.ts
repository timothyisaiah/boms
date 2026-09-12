import { getSession } from '../server/auth.js'
import { method, route } from '../server/http.js'
import { database } from '../server/db.js'

export default route(async (req, res) => {
  method(req, 'GET')

  const session = await getSession(req)

  if (!session) {
    return res.status(401).json({
      error: 'No active session',
      message: 'You are not logged in. Please log in to continue.'
    })
  }

  // The serverless query client parameterizes this value and only returns the
  // signed-in user's own non-sensitive account fields.
  const { query } = database()
  const [userRecord] = await query`
    select id,email,full_name,app_role,is_active
    from public.users where id=${session.id}::uuid
  `

  return res.status(200).json({
    session,
    database_user: userRecord,
    can_manage_variants: ['admin_owner', 'operations_manager'].includes(
      session.role
    ),
    can_manage_materials: [
      'admin_owner',
      'operations_manager',
      'warehouse_staff'
    ].includes(session.role),
    timestamp: new Date().toISOString()
  })
})
