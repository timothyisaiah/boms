-- Supabase seed files run after migrations during `supabase db reset`.
-- This seed creates a deterministic local admin-shaped auth user and lets the
-- profile trigger create a matching `public.user_profiles` row.
--
-- Per Supabase docs, a SQL-seeded auth row is useful for relational data and
-- repeatable local state, but it is not a password-based sign-in account.
-- Use `yarn supabase:seed-admin` after reset to create the real login-capable
-- administrator via the Auth Admin API.

insert into auth.users (
  id,
  email,
  raw_app_meta_data,
  raw_user_meta_data
)
values (
  '11111111-1111-4111-8111-111111111111',
  'admin@beecone.local',
  jsonb_build_object(
    'provider',
    'email',
    'providers',
    jsonb_build_array('email'),
    'role',
    'admin_owner',
    'is_active',
    true
  ),
  jsonb_build_object(
    'full_name',
    'Beecone Administrator'
  )
)
on conflict (id) do update
set
  email = excluded.email,
  raw_app_meta_data = excluded.raw_app_meta_data,
  raw_user_meta_data = excluded.raw_user_meta_data;
