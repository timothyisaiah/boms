-- Material definitions never rewrite stock quantities or historical unit costs.
create table public.material_profile_audits (
  id bigint generated always as identity primary key,
  actor_id uuid not null references public.users(id),
  material_id bigint not null references public.materials(id),
  previous_profile jsonb,
  new_profile jsonb not null,
  request_key uuid not null,
  created_at timestamptz not null default now()
);
create index material_profile_audits_actor_idx
  on public.material_profile_audits(actor_id,created_at desc);
create index material_profile_audits_material_idx
  on public.material_profile_audits(material_id,created_at desc);

create function public.execute_material_save(p_key uuid,p_hash text,p_body jsonb)
returns table(response_status integer,response_body jsonb)
language plpgsql security invoker set search_path = '' as $$
declare
  actor uuid := nullif(current_setting('boms.actor_id',true),'')::uuid;
  actor_role public.app_role;
  saved public.idempotency_keys%rowtype;
  material_id bigint := (p_body->>'id')::bigint;
  material_code text := nullif(btrim(p_body->>'code'),'');
  material_name text := nullif(btrim(p_body->>'name'),'');
  material_kind public.material_kind := (p_body->>'kind')::public.material_kind;
  material_unit text := nullif(btrim(p_body->>'unitOfMeasure'),'');
  threshold numeric := (p_body->>'lowStockThreshold')::numeric;
  active boolean := (p_body->>'isActive')::boolean;
  previous_profile jsonb;
  new_profile jsonb;
  saved_status integer := case when material_id is null then 201 else 200 end;
begin
  select app_role into actor_role from public.users where id=actor and is_active;
  if actor_role is null or actor_role not in ('admin_owner','operations_manager','warehouse_staff') then
    raise exception 'Your role cannot manage materials.';
  end if;
  insert into public.idempotency_keys(key,endpoint,request_hash,actor_id)
    values(p_key,'materials',p_hash,actor) on conflict(key) do nothing;
  select * into saved from public.idempotency_keys where key=p_key for update;
  if saved.endpoint <> 'materials' or saved.request_hash <> p_hash or saved.actor_id <> actor then
    return query select 409,jsonb_build_object('error','This retry key belongs to a different request.','kind','conflict'); return;
  end if;
  if saved.response_status is not null then
    return query select saved.response_status,saved.response_body; return;
  end if;
  if material_code is null or length(material_code)>80 or material_name is null or length(material_name)>160
    or material_kind is null or material_unit is null or length(material_unit)>40 or active is null
    or threshold is null or threshold<0 or threshold>=100000000000 or threshold<>trunc(threshold,3)
    or length(coalesce(p_body->>'description',''))>2000 then
    raise exception 'Enter a material code, name, type, unit, status and a nonnegative threshold with up to three decimal places.';
  end if;

  -- Serialize matching codes, including case/space variants of legacy codes,
  -- without rewriting existing reference data or adding a conflicting index.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(lower(material_code),611));
  if exists(select 1 from public.materials m where lower(btrim(m.code))=lower(material_code)
    and (material_id is null or m.id<>material_id)) then
    return query select 409,jsonb_build_object('error','Another material already uses this code. Choose a different code.','kind','conflict');
    -- Do not retain an unfinished retry row for a rejected write.
    delete from public.idempotency_keys where key=p_key;
    return;
  end if;

  if material_id is null then
    insert into public.materials as m(code,name,kind,unit_of_measure,description,low_stock_threshold,is_active)
      values(material_code,material_name,material_kind,material_unit,nullif(btrim(p_body->>'description'),''),threshold,active)
      returning m.id,to_jsonb(m) into material_id,new_profile;
  else
    select to_jsonb(m) into previous_profile from public.materials m where m.id=material_id for update;
    if previous_profile is null then raise exception 'This material no longer exists. Refresh the list.'; end if;
    if previous_profile->>'kind' <> material_kind::text or previous_profile->>'unit_of_measure' <> material_unit then
      raise exception 'Material type and unit cannot change. Add a new material to use a different type or unit.';
    end if;
    update public.materials as m set code=material_code,name=material_name,
      description=nullif(btrim(p_body->>'description'),''),low_stock_threshold=threshold,is_active=active
      where m.id=material_id returning to_jsonb(m) into new_profile;
  end if;
  insert into public.material_profile_audits(actor_id,material_id,previous_profile,new_profile,request_key)
    values(actor,material_id,previous_profile,new_profile,p_key);
  insert into public.audit_logs(actor_id,action,record_id,request_key) values(actor,'materials',material_id,p_key);
  update public.idempotency_keys set response_status=saved_status,response_body=jsonb_build_object('id',material_id) where key=p_key;
  return query select saved_status,jsonb_build_object('id',material_id);
end; $$;
revoke execute on function public.execute_material_save(uuid,text,jsonb) from public;
