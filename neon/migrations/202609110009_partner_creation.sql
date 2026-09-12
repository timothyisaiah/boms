-- Restore supplier and retailer creation through the same atomic retry contract.
create function public.execute_partner_create(p_key uuid, p_endpoint text, p_hash text, p_body jsonb)
returns table(response_status integer, response_body jsonb)
language plpgsql security invoker set search_path = '' as $$
declare
  actor uuid := nullif(current_setting('boms.actor_id',true),'')::uuid;
  actor_role public.app_role;
  saved public.idempotency_keys%rowtype;
  partner_id bigint;
  partner_name text := nullif(btrim(p_body->>'name'),'');
begin
  select app_role into actor_role from public.users where id=actor and is_active;
  if actor_role is null or not (
    (p_endpoint='suppliers' and actor_role in ('admin_owner','operations_manager','warehouse_staff')) or
    (p_endpoint='retailers' and actor_role in ('admin_owner','operations_manager','warehouse_staff','sales_or_distribution_staff'))
  ) then raise exception 'Your role cannot add this partner.'; end if;
  insert into public.idempotency_keys(key,endpoint,request_hash,actor_id)
    values(p_key,p_endpoint,p_hash,actor) on conflict(key) do nothing;
  select * into saved from public.idempotency_keys where key=p_key for update;
  if saved.endpoint <> p_endpoint or saved.request_hash <> p_hash or saved.actor_id <> actor then
    return query select 409,jsonb_build_object('error','This retry key belongs to a different request.','kind','conflict'); return;
  end if;
  if saved.response_status is not null then
    return query select saved.response_status,saved.response_body; return;
  end if;
  if partner_name is null then raise exception 'A partner name is required.'; end if;
  if p_endpoint='suppliers' then
    insert into public.suppliers(supplier_name,supplier_kind,contact_name,phone,email,notes)
    values(partner_name,(p_body->>'supplierKind')::public.supplier_kind,nullif(btrim(p_body->>'contactName'),''),nullif(btrim(p_body->>'phone'),''),nullif(lower(btrim(p_body->>'email')),''),nullif(btrim(p_body->>'notes'),'')) returning id into partner_id;
  else
    insert into public.retailers(retailer_name,contact_name,phone,email,delivery_location,notes)
    values(partner_name,nullif(btrim(p_body->>'contactName'),''),nullif(btrim(p_body->>'phone'),''),nullif(lower(btrim(p_body->>'email')),''),nullif(btrim(p_body->>'deliveryLocation'),''),nullif(btrim(p_body->>'notes'),'')) returning id into partner_id;
  end if;
  insert into public.audit_logs(actor_id,action,record_id,request_key) values(actor,p_endpoint,partner_id,p_key);
  update public.idempotency_keys set response_status=201,response_body=jsonb_build_object('id',partner_id) where key=p_key;
  return query select 201,jsonb_build_object('id',partner_id);
end; $$;
revoke execute on function public.execute_partner_create(uuid,text,text,jsonb) from public;
