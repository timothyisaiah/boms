import { neon } from '@neondatabase/serverless'
import { loadEnv, modeArg } from './env.mjs'
import {
  productSeeds,
  variantSeeds,
  materialSeeds,
  recipeSeeds,
  supplierSeeds,
  retailerSeeds
} from '../neon/reference-data.mjs'
import { duplicateGroups, materialKey } from '../src/lib/materialKeys.js'
loadEnv(modeArg())
const query = neon(process.env.DATABASE_URL)

// Supply items are matched by what they are, not by code: an existing "RAW
// Honey" (RAW-20) or "60g Sticker" already covers the seed's "Raw Honey" and
// "60g Label", so no empty duplicate is created for recipes to point at.
const existing = await query`
  select m.id, m.code, m.name, m.kind, m.is_active,
    coalesce((select sum(quantity_remaining) from inventory_lots l where l.material_id = m.id and l.status = 'open'), 0)::float on_hand,
    ((select count(*) from inventory_lots l where l.material_id = m.id))::int history
  from materials m where m.is_active`
const existingKeys = new Set(existing.map(materialKey))
const newMaterials = materialSeeds.filter(
  m => !existingKeys.has(materialKey(m))
)

await query.transaction([
  ...productSeeds.map(
    p =>
      query`insert into products(name,slug,description,is_active) values(${p.name},${p.slug},${p.description},${p.is_active}) on conflict(slug) do nothing`
  ),
  ...variantSeeds.map(
    v =>
      query`insert into product_variants(product_id,sku,variant_name,flavor,pack_size_grams,packaging_type,is_active) values((select id from products where slug=${v.product_slug}),${v.sku},${v.variant_name},${v.flavor},${v.pack_size_grams},${v.packaging_type},${v.is_active}) on conflict(sku) do nothing`
  ),
  ...newMaterials.map(
    m =>
      query`insert into materials(code,name,kind,unit_of_measure,description,is_active) values(${m.code},${m.name},${m.kind},${m.unit_of_measure},${m.description},${m.is_active}) on conflict(code) do nothing`
  ),
  ...supplierSeeds.map(
    s =>
      query`insert into suppliers(supplier_name,supplier_kind,contact_name,phone,email,notes,is_active) values(${s.supplier_name},${s.supplier_kind},${s.contact_name},${s.phone},${s.email},${s.notes},${s.is_active}) on conflict do nothing`
  ),
  ...retailerSeeds.map(
    r =>
      query`insert into retailers(retailer_name,contact_name,phone,email,delivery_location,notes,is_active) values(${r.retailer_name},${r.contact_name},${r.phone},${r.email},${r.delivery_location},${r.notes},${r.is_active}) on conflict do nothing`
  )
])

// Recipe lines point at the active material of each kind that holds stock.
const materials = await query`
  select m.id, m.code, m.name, m.kind, m.is_active,
    coalesce((select sum(quantity_remaining) from inventory_lots l where l.material_id = m.id and l.status = 'open'), 0)::float on_hand,
    ((select count(*) from inventory_lots l where l.material_id = m.id))::int history
  from materials m where m.is_active order by m.id`
const preferred = new Map(materials.map(m => [materialKey(m), m]))
for (const group of duplicateGroups(
  materials,
  Object.fromEntries(
    materials.map(m => [m.id, { onHand: m.on_hand, history: m.history }])
  )
))
  preferred.set(group.key, group.items[0])
const seedByCode = new Map(materialSeeds.map(m => [m.code, m]))
const resolve = code => {
  const seed = seedByCode.get(code)
  return seed ? preferred.get(materialKey(seed))?.id : undefined
}

// Recipes are only created when a variant has none; edited recipes are kept.
await query.transaction(
  recipeSeeds.flatMap(r => {
    const items = r.items
      .map(item => ({
        material_id: resolve(item.material_code),
        quantity_per_unit: item.quantity_per_unit
      }))
      .filter(item => item.material_id)
    return [
      query`insert into production_recipes(variant_id,name) select id,${r.name} from product_variants where sku=${r.sku} on conflict(variant_id) do nothing`,
      query`insert into production_recipe_items(recipe_id,material_id,quantity_per_unit) select recipe.id,item.material_id,item.quantity_per_unit::numeric from production_recipes recipe join product_variants v on v.id=recipe.variant_id cross join jsonb_to_recordset(${JSON.stringify(items)}::jsonb) as item(material_id bigint,quantity_per_unit text) where v.sku=${r.sku} and not exists(select 1 from production_recipe_items existing where existing.recipe_id=recipe.id)`
    ]
  })
)
console.log(
  `Reference seed complete. ${newMaterials.length} new supply items; existing records, prices and recipes preserved.`
)
