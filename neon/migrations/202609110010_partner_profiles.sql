create table public.partner_profile_audits (
  id bigint generated always as identity primary key,
  actor_id uuid not null references public.users(id),
  partner_kind text not null check (partner_kind in ('supplier', 'retailer')),
  partner_id bigint not null,
  previous_profile jsonb not null,
  new_profile jsonb not null,
  created_at timestamptz not null default now()
);
create index partner_profile_audits_actor_idx
  on public.partner_profile_audits(actor_id, created_at desc);
create index partner_profile_audits_partner_idx
  on public.partner_profile_audits(partner_kind, partner_id, created_at desc);

create function public.manage_partner_profile(
  p_kind text,
  p_id bigint,
  p_name text,
  p_supplier_kind public.supplier_kind,
  p_contact_name text,
  p_phone text,
  p_email text,
  p_delivery_location text,
  p_notes text,
  p_is_active boolean
) returns bigint
language plpgsql security invoker set search_path = '' as $$
declare
  actor uuid := nullif(current_setting('boms.actor_id', true), '')::uuid;
  actor_role public.app_role;
  previous_profile jsonb;
  new_profile jsonb;
begin
  select app_role into actor_role from public.users where id=actor and is_active;
  if actor_role is null or not (
    (p_kind='supplier' and actor_role in ('admin_owner','operations_manager','warehouse_staff')) or
    (p_kind='retailer' and actor_role in ('admin_owner','operations_manager','warehouse_staff','sales_or_distribution_staff'))
  ) then raise exception 'Your role cannot manage this partner.'; end if;
  if p_kind not in ('supplier','retailer') then raise exception 'Unknown partner type.'; end if;
  if nullif(btrim(p_name),'') is null or p_is_active is null then
    raise exception 'A partner name and status are required.';
  end if;

  if p_kind='supplier' then
    select to_jsonb(s) into previous_profile from public.suppliers s where s.id=p_id for update;
    if previous_profile is null then raise exception 'This supplier no longer exists. Refresh the list.'; end if;
    if p_supplier_kind is null then raise exception 'A supplier type is required.'; end if;
    update public.suppliers as s set
      supplier_name=btrim(p_name), supplier_kind=p_supplier_kind,
      contact_name=nullif(btrim(p_contact_name),''), phone=nullif(btrim(p_phone),''),
      email=nullif(lower(btrim(p_email)),''), notes=nullif(btrim(p_notes),''),
      is_active=p_is_active, updated_at=clock_timestamp()
    where s.id=p_id returning to_jsonb(s) into new_profile;
  else
    select to_jsonb(r) into previous_profile from public.retailers r where r.id=p_id for update;
    if previous_profile is null then raise exception 'This retailer no longer exists. Refresh the list.'; end if;
    update public.retailers as r set
      retailer_name=btrim(p_name), contact_name=nullif(btrim(p_contact_name),''),
      phone=nullif(btrim(p_phone),''), email=nullif(lower(btrim(p_email)),''),
      delivery_location=nullif(btrim(p_delivery_location),''), notes=nullif(btrim(p_notes),''),
      is_active=p_is_active, updated_at=clock_timestamp()
    where r.id=p_id returning to_jsonb(r) into new_profile;
  end if;

  insert into public.partner_profile_audits(
    actor_id,partner_kind,partner_id,previous_profile,new_profile
  ) values(actor,p_kind,p_id,previous_profile,new_profile);
  return p_id;
end; $$;
revoke execute on function public.manage_partner_profile(
  text,bigint,text,public.supplier_kind,text,text,text,text,text,boolean
) from public;
