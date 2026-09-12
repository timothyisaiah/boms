import { database } from '../server/db.js'
import { getSession, requireRole, SUPPLY } from '../server/auth.js'
import { method, route } from '../server/http.js'

export default route(async (req, res) => {
  requireRole(await getSession(req), SUPPLY)
  method(req, 'GET')
  const { query } = database()
  const materials = await query`
    select m.*,coalesce(stock.quantity_on_hand,0) quantity_on_hand
    from public.materials m
    left join (
      select material_id,sum(quantity_remaining) quantity_on_hand
      from public.inventory_lots where status='open'
      group by material_id
    ) stock on stock.material_id=m.id
    order by m.is_active desc,m.kind,lower(m.name),m.id
  `
  return res.json({ materials })
})
