import { getSession, requireRole } from '../server/auth.js'
import { method, route, HttpError } from '../server/http.js'
import {
  workspaceRoles,
  readWorkspace,
  parseWorkspaceView
} from '../server/workspaces.js'
export default route(async (req, res) => {
  const name = typeof req.query.name === 'string' ? req.query.name : ''
  if (!Object.hasOwn(workspaceRoles, name))
    throw new HttpError(404, 'Workspace not found.')
  const workspace = name as keyof typeof workspaceRoles
  const session = requireRole(await getSession(req), workspaceRoles[workspace])
  method(req, 'GET')
  const view = parseWorkspaceView(req.query.view, workspace)
  return res.json(await readWorkspace(workspace, session, view))
})
