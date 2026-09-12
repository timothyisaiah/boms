import { database } from '../server/db.js'
import { getSession, requireRole, SUPPLY } from '../server/auth.js'
import { method, route } from '../server/http.js'

export default route(async (req, res) => {
  requireRole(await getSession(req), SUPPLY)
  method(req, 'GET')
  const { query } = database()
  const variants = await query`
    select to_jsonb(v)||jsonb_build_object(
      'product',to_jsonb(p),
      'quantity_on_hand',coalesce(stock.quantity_on_hand,0)
    ) data
    from public.product_variants v
    join public.products p on p.id=v.product_id
    left join (
      select variant_id,sum(quantity_remaining) quantity_on_hand
      from public.production_outputs
      group by variant_id
    ) stock on stock.variant_id=v.id
    order by v.is_active desc,p.is_active desc,lower(p.name),v.pack_size_grams,lower(v.variant_name),v.id
  `
  const products = await query`
    select * from public.products order by is_active desc,lower(name),id
  `
  return res.json({ variants: variants.map(row => row.data), products })
})
