-- Supabase seed files run after migrations during `supabase db reset`.
-- This seed creates a deterministic local admin-shaped auth user and lets the
-- profile trigger create a matching `public.user_profiles` row.
--
-- Per Supabase docs, a SQL-seeded auth row is useful for relational data and
-- repeatable local state, but it is not a password-based sign-in account.
-- Use `yarn supabase:seed-admin` after reset to create the real login-capable
-- administrator via the Auth Admin API.

-- insert into auth.users (
--   id,
--   email,
--   raw_app_meta_data,
--   raw_user_meta_data
-- )
-- values (
--   '11111111-1111-4111-8111-111111111111',
--   'admin@beecone.local',
--   jsonb_build_object(
--     'provider',
--     'email',
--     'providers',
--     jsonb_build_array('email'),
--     'role',
--     'admin_owner',
--     'is_active',
--     true
--   ),
--   jsonb_build_object(
--     'full_name',
--     'Beecone Administrator'
--   )
-- )
-- on conflict (id) do update
-- set
--   email = excluded.email,
--   raw_app_meta_data = excluded.raw_app_meta_data,
--   raw_user_meta_data = excluded.raw_user_meta_data;

insert into public.products (
  id,
  name,
  slug,
  description,
  is_active
)
values (
  1001,
  'Beecone Raw Natural Honey',
  'beecone-raw-natural-honey',
  'Core Beecone honey catalogue used for supply, production, and retail traceability.',
  true
)
on conflict (id) do update
set
  name = excluded.name,
  slug = excluded.slug,
  description = excluded.description,
  is_active = excluded.is_active;

insert into public.product_variants (
  id,
  product_id,
  sku,
  variant_name,
  flavor,
  pack_size_grams,
  packaging_type,
  is_active
)
values
  (
    2001,
    1001,
    'BEE-RAW-250',
    '250g Classic Jar',
    'Classic',
    250,
    'Jar',
    true
  ),
  (
    2002,
    1001,
    'BEE-RAW-500',
    '500g Classic Jar',
    'Classic',
    500,
    'Jar',
    true
  ),
  (
    2003,
    1001,
    'BEE-RAW-1000',
    '1kg Classic Jar',
    'Classic',
    1000,
    'Jar',
    true
  ),
  (
    2004,
    1001,
    'BEE-GIN-500',
    '500g Ginger Infused Jar',
    'Ginger Infused',
    500,
    'Jar',
    true
  )
on conflict (id) do update
set
  product_id = excluded.product_id,
  sku = excluded.sku,
  variant_name = excluded.variant_name,
  flavor = excluded.flavor,
  pack_size_grams = excluded.pack_size_grams,
  packaging_type = excluded.packaging_type,
  is_active = excluded.is_active;

insert into public.materials (
  id,
  code,
  name,
  kind,
  unit_of_measure,
  description,
  is_active
)
values
  (
    3001,
    'RAW-HONEY-KG',
    'Raw Honey',
    'raw_honey',
    'kg',
    'Primary honey input measured by kilogram.',
    true
  ),
  (
    3002,
    'JAR-250',
    '250g PET Jar',
    'packaging',
    'piece',
    'Primary 250g jar used for finished stock.',
    true
  ),
  (
    3003,
    'JAR-500',
    '500g PET Jar',
    'packaging',
    'piece',
    'Primary 500g jar used for finished stock.',
    true
  ),
  (
    3004,
    'JAR-1000',
    '1kg PET Jar',
    'packaging',
    'piece',
    'Primary 1kg jar used for finished stock.',
    true
  ),
  (
    3005,
    'LID-63MM',
    '63mm Gold Twist Lid',
    'packaging',
    'piece',
    'Shared lid used across Beecone jar formats.',
    true
  ),
  (
    3006,
    'LABEL-FRONT',
    'Beecone Front Label',
    'packaging',
    'piece',
    'Printed front label applied to finished jars.',
    true
  ),
  (
    3007,
    'SEAL-TAMPER',
    'Tamper Seal',
    'packaging',
    'piece',
    'Tamper-evident seal for traceable retail stock.',
    true
  ),
  (
    3008,
    'CARTON-12',
    '12-Jar Master Carton',
    'packaging',
    'piece',
    'Outer carton for warehouse handling and retail dispatch.',
    true
  )
on conflict (id) do update
set
  code = excluded.code,
  name = excluded.name,
  kind = excluded.kind,
  unit_of_measure = excluded.unit_of_measure,
  description = excluded.description,
  is_active = excluded.is_active;

insert into public.suppliers (
  id,
  supplier_name,
  supplier_kind,
  contact_name,
  phone,
  email,
  notes,
  is_active
)
values
  (
    4001,
    'Kayunga Honey Cooperative',
    'raw_honey',
    'Samuel Kintu',
    '+256700100101',
    'procurement@kayungahoney.test',
    'Sample raw honey source for local development and workflow demos.',
    true
  ),
  (
    4002,
    'Kampala Pack House',
    'packaging',
    'Ruth Nansubuga',
    '+256700100202',
    'sales@kampalapackhouse.test',
    'Primary sample supplier for PET jars and lids.',
    true
  ),
  (
    4003,
    'Nile Print and Label',
    'packaging',
    'Martin Ouma',
    '+256700100303',
    'orders@nileprint.test',
    'Sample label and tamper seal supplier.',
    true
  ),
  (
    4004,
    'Beecone Mixed Inputs Depot',
    'mixed',
    'Grace Achieng',
    '+256700100404',
    'ops@mixedinputs.test',
    'Fallback sample supplier that can provide both honey and packaging.',
    true
  )
on conflict (id) do update
set
  supplier_name = excluded.supplier_name,
  supplier_kind = excluded.supplier_kind,
  contact_name = excluded.contact_name,
  phone = excluded.phone,
  email = excluded.email,
  notes = excluded.notes,
  is_active = excluded.is_active;

insert into public.retailers (
  id,
  retailer_name,
  contact_name,
  phone,
  email,
  delivery_location,
  notes,
  is_active
)
values
  (
    5001,
    'Ntinda Health Market',
    'Irene Namubiru',
    '+256700200101',
    'orders@ntindahealth.test',
    'Ntinda, Kampala',
    'Sample consignment partner for central Kampala replenishment.',
    true
  ),
  (
    5002,
    'Entebbe Organics Corner',
    'Paul Ssemanda',
    '+256700200202',
    'stock@entebbeorganics.test',
    'Entebbe Road, Wakiso',
    'Sample airport corridor retailer for jar movement demos.',
    true
  ),
  (
    5003,
    'Jinja Farmers Shop',
    'Naomi Auma',
    '+256700200303',
    'retail@jinjafarmers.test',
    'Jinja Main Street',
    'Sample upcountry retailer for distribution and reconciliation flows.',
    true
  )
on conflict (id) do update
set
  retailer_name = excluded.retailer_name,
  contact_name = excluded.contact_name,
  phone = excluded.phone,
  email = excluded.email,
  delivery_location = excluded.delivery_location,
  notes = excluded.notes,
  is_active = excluded.is_active;

select setval(
  pg_get_serial_sequence('public.products', 'id'),
  (select greatest(coalesce(max(id), 1), 1) from public.products),
  true
);

select setval(
  pg_get_serial_sequence('public.product_variants', 'id'),
  (select greatest(coalesce(max(id), 1), 1) from public.product_variants),
  true
);

select setval(
  pg_get_serial_sequence('public.materials', 'id'),
  (select greatest(coalesce(max(id), 1), 1) from public.materials),
  true
);

select setval(
  pg_get_serial_sequence('public.suppliers', 'id'),
  (select greatest(coalesce(max(id), 1), 1) from public.suppliers),
  true
);

select setval(
  pg_get_serial_sequence('public.retailers', 'id'),
  (select greatest(coalesce(max(id), 1), 1) from public.retailers),
  true
);
