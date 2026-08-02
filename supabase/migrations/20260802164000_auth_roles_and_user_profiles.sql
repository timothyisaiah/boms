create type public.app_role as enum (
  'admin_owner',
  'operations_manager',
  'production_staff',
  'warehouse_staff',
  'sales_or_distribution_staff',
  'finance_accountant',
  'read_only_management'
);

create or replace function public.resolve_app_role(input_role text)
returns public.app_role
language plpgsql
immutable
set search_path = ''
as $$
declare
  normalized_role text;
begin
  normalized_role := lower(
    regexp_replace(
      coalesce(input_role, ''),
      '[^a-z0-9]+',
      '_',
      'g'
    )
  );
  normalized_role := regexp_replace(normalized_role, '^_+|_+$', '', 'g');

  case normalized_role
    when 'admin_owner' then
      return 'admin_owner';
    when 'operations_manager' then
      return 'operations_manager';
    when 'production_staff' then
      return 'production_staff';
    when 'warehouse_staff' then
      return 'warehouse_staff';
    when 'sales_or_distribution_staff' then
      return 'sales_or_distribution_staff';
    when 'finance_accountant' then
      return 'finance_accountant';
    else
      return 'read_only_management';
  end case;
end;
$$;

create or replace function public.resolve_profile_active_flag(active_value text)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
begin
  case lower(coalesce(active_value, ''))
    when 'false', 'f', '0', 'no', 'n' then
      return false;
    when 'true', 't', '1', 'yes', 'y' then
      return true;
    else
      return true;
  end case;
end;
$$;

create table public.user_profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text,
  role public.app_role not null default 'read_only_management',
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create unique index user_profiles_email_lower_key
  on public.user_profiles (lower(email));

create index user_profiles_role_idx
  on public.user_profiles (role);

create or replace function public.set_user_profiles_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := timezone('utc', now());
  return new;
end;
$$;

create trigger set_user_profiles_updated_at
before update on public.user_profiles
for each row
execute function public.set_user_profiles_updated_at();

create or replace function public.sync_auth_user_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.user_profiles (
    id,
    email,
    full_name,
    role,
    is_active
  )
  values (
    new.id,
    coalesce(new.email, ''),
    nullif(
      coalesce(
        new.raw_user_meta_data ->> 'full_name',
        new.raw_user_meta_data ->> 'name',
        ''
      ),
      ''
    ),
    public.resolve_app_role(
      coalesce(
        new.raw_app_meta_data ->> 'role',
        new.raw_user_meta_data ->> 'role'
      )
    ),
    public.resolve_profile_active_flag(new.raw_app_meta_data ->> 'is_active')
  )
  on conflict (id) do update
  set
    email = excluded.email,
    full_name = excluded.full_name,
    role = excluded.role,
    is_active = excluded.is_active,
    updated_at = timezone('utc', now());

  return new;
end;
$$;

create trigger on_auth_user_profile_synced
after insert or update of email, raw_user_meta_data, raw_app_meta_data
on auth.users
for each row
execute function public.sync_auth_user_profile();

insert into public.user_profiles (
  id,
  email,
  full_name,
  role,
  is_active
)
select
  users.id,
  coalesce(users.email, ''),
  nullif(
    coalesce(
      users.raw_user_meta_data ->> 'full_name',
      users.raw_user_meta_data ->> 'name',
      ''
    ),
    ''
  ),
  public.resolve_app_role(
    coalesce(
      users.raw_app_meta_data ->> 'role',
      users.raw_user_meta_data ->> 'role'
    )
  ),
  public.resolve_profile_active_flag(users.raw_app_meta_data ->> 'is_active')
from auth.users as users
on conflict (id) do update
set
  email = excluded.email,
  full_name = excluded.full_name,
  role = excluded.role,
  is_active = excluded.is_active,
  updated_at = timezone('utc', now());

alter table public.user_profiles enable row level security;
alter table public.user_profiles force row level security;

grant select on public.user_profiles to authenticated;
grant insert, update, delete on public.user_profiles to service_role;

create or replace function public.current_user_role()
returns public.app_role
language sql
stable
security definer
set search_path = ''
as $$
  select profile.role
  from public.user_profiles as profile
  where profile.id = (select auth.uid())
$$;

create policy "Users can view their own profile"
on public.user_profiles
for select
to authenticated
using ((select auth.uid()) = id);

create policy "Admins can view all user profiles"
on public.user_profiles
for select
to authenticated
using (public.current_user_role() = 'admin_owner');

create policy "Admins can manage user profiles"
on public.user_profiles
for all
to authenticated
using (public.current_user_role() = 'admin_owner')
with check (public.current_user_role() = 'admin_owner');
