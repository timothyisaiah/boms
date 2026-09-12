import {
  getSession,
  requireRole,
  ALL_ROLES,
  SUPPLY,
  REVIEW,
  FINANCE
} from '../server/auth.js'
import { database } from '../server/db.js'
import { HttpError, method, route } from '../server/http.js'
export default route(async (req, res) => {
  const session = requireRole(await getSession(req), ALL_ROLES)
  method(req, 'GET')
  const { start, end } = req.query
  if (
    typeof start !== 'string' ||
    typeof end !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(start) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(end) ||
    !(Date.parse(end) > Date.parse(start)) ||
    Date.parse(end) - Date.parse(start) > 32 * 86400000
  )
    throw new HttpError(422, 'Choose a valid week or month.')
  const { query } = database()
  const [result] =
    await query`select public.business_report(${start}::date,${end}::date) report`
  const report = result.report
  if (!SUPPLY.includes(session.role as (typeof ALL_ROLES)[number])) {
    report.valuation = []
    report.digest.materials = []
    report.movements = report.movements.filter(
      (v: { movement: string }) => v.movement !== 'received'
    )
  }
  if (!REVIEW.includes(session.role)) {
    report.aging = []
    report.reconciliations = []
    report.retailers = []
    report.profit = null
  }
  if (!FINANCE.includes(session.role)) {
    report.expenses = []
    if (report.profit) {
      delete report.profit.operating_expenses
      delete report.profit.net_profit
    }
  }
  return res.json(report)
})
