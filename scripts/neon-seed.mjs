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
loadEnv(modeArg())
const query = neon(process.env.DATABASE_URL)
await query.transaction([
  ...productSeeds.map(
    p =>
      query`insert into products(name,slug,description,is_active) values(${p.name},${p.slug},${p.description},${p.is_active}) on conflict(slug) do nothing`
  ),
  ...variantSeeds.map(
    v =>
      query`insert into product_variants(product_id,sku,variant_name,flavor,pack_size_grams,packaging_type,is_active) values((select id from products where slug=${v.product_slug}),${v.sku},${v.variant_name},${v.flavor},${v.pack_size_grams},${v.packaging_type},${v.is_active}) on conflict(sku) do nothing`
  ),
  ...materialSeeds.map(
    m =>
      query`insert into materials(code,name,kind,unit_of_measure,description,is_active) values(${m.code},${m.name},${m.kind},${m.unit_of_measure},${m.description},${m.is_active}) on conflict(code) do nothing`
  ),
  ...supplierSeeds.map(
    s =>
      query`insert into suppliers(supplier_name,supplier_kind,contact_name,phone,email,notes,is_active) values(${s.supplier_name},${s.supplier_kind},${s.contact_name},${s.phone},${s.email},${s.notes},${s.is_active}) on conflict do nothing`
  ),
  // Recipes are only created when a variant has none; edited recipes are kept.
  ...recipeSeeds.flatMap(r => [
    query`insert into production_recipes(variant_id,name) select id,${r.name} from product_variants where sku=${r.sku} on conflict(variant_id) do nothing`,
    query`insert into production_recipe_items(recipe_id,material_id,quantity_per_unit) select recipe.id,m.id,item.quantity_per_unit::numeric from production_recipes recipe join product_variants v on v.id=recipe.variant_id cross join jsonb_to_recordset(${JSON.stringify(r.items)}::jsonb) as item(material_code text,quantity_per_unit text) join materials m on m.code=item.material_code where v.sku=${r.sku} and not exists(select 1 from production_recipe_items existing where existing.recipe_id=recipe.id)`
  ]),
  ...retailerSeeds.map(
    r =>
      query`insert into retailers(retailer_name,contact_name,phone,email,delivery_location,notes,is_active) values(${r.retailer_name},${r.contact_name},${r.phone},${r.email},${r.delivery_location},${r.notes},${r.is_active}) on conflict do nothing`
  )
])
console.log(
  'Reference seed complete. Existing records, prices and recipes preserved.'
)
