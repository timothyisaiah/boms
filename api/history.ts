import { ALL_ROLES, getSession, requireRole } from '../server/auth.js'
import { method, route, HttpError } from '../server/http.js'
import {
  historyRoles,
  isHistoryResource,
  parseHistoryQuery,
  readHistory
} from '../server/history.js'
export default route(async (req, res) => {
  const signedIn = requireRole(await getSession(req), ALL_ROLES)
  const resource = req.query.resource
  if (!isHistoryResource(resource))
    throw new HttpError(404, 'History not found.')
  // Same role map as the matching workspace collection.
  const session = requireRole(signedIn, historyRoles[resource])
  method(req, 'GET')
  const params = parseHistoryQuery(resource, req.query)
  return res.json(await readHistory(params, session))
})
