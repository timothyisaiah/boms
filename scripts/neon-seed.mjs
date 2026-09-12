import { neon } from '@neondatabase/serverless'
import { loadEnv, modeArg } from './env.mjs'
import {
  productSeeds,
  variantSeeds,
  materialSeeds,
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
  ...retailerSeeds.map(
    r =>
      query`insert into retailers(retailer_name,contact_name,phone,email,delivery_location,notes,is_active) values(${r.retailer_name},${r.contact_name},${r.phone},${r.email},${r.delivery_location},${r.notes},${r.is_active}) on conflict do nothing`
  )
])
console.log(
  'Reference seed complete. Existing records, prices and recipes preserved.'
)
