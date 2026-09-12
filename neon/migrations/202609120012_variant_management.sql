-- Variant identity is retained for existing batch, stock and reconciliation history.
create table public.variant_profile_audits (
  id bigint generated always as identity primary key,
  actor_id uuid not null references public.users(id),
  variant_id bigint not null references public.product_variants(id),
  previous_profile jsonb,
  new_profile jsonb not null,
  request_key uuid not null,
  created_at timestamptz not null default now()
);
create index variant_profile_audits_actor_idx
  on public.variant_profile_audits(actor_id,created_at desc);
create index variant_profile_audits_variant_idx
  on public.variant_profile_audits(variant_id,created_at desc);

create function public.execute_variant_save(p_key uuid,p_hash text,p_body jsonb)
returns table(response_status integer,response_body jsonb)
language plpgsql security invoker set search_path = '' as $$
declare
  actor uuid := nullif(current_setting('boms.actor_id',true),'')::uuid;
  actor_role public.app_role;
  saved public.idempotency_keys%rowtype;
  saved_variant_id bigint := (p_body->>'id')::bigint;
  saved_product_id bigint := (p_body->>'productId')::bigint;
  saved_product_name text := nullif(btrim(p_body->>'newProductName'),'');
  saved_sku text := nullif(btrim(p_body->>'sku'),'');
  saved_variant_name text := nullif(btrim(p_body->>'variantName'),'');
  saved_flavor text := nullif(btrim(p_body->>'flavor'),'');
  saved_pack_size integer := (p_body->>'packSizeGrams')::integer;
  saved_packaging text := nullif(btrim(p_body->>'packagingType'),'');
  saved_threshold integer := (p_body->>'lowStockThreshold')::integer;
  saved_active boolean := (p_body->>'isActive')::boolean;
  previous_profile jsonb;
  new_profile jsonb;
  product_profile jsonb;
  generated_slug text;
  saved_status integer := case when saved_variant_id is null then 201 else 200 end;
begin
  select app_role into actor_role from public.users where id=actor and is_active;
  if actor_role is null or actor_role not in ('admin_owner','operations_manager') then
    raise exception 'Your role cannot manage variants.';
  end if;
  insert into public.idempotency_keys(key,endpoint,request_hash,actor_id)
    values(p_key,'variants',p_hash,actor) on conflict(key) do nothing;
  select * into saved from public.idempotency_keys where key=p_key for update;
  if saved.endpoint <> 'variants' or saved.request_hash <> p_hash or saved.actor_id <> actor then
    return query select 409,jsonb_build_object('error','This retry key belongs to a different request.','kind','conflict'); return;
  end if;
  if saved.response_status is not null then
    return query select saved.response_status,saved.response_body; return;
  end if;
  if saved_sku is null or saved_variant_name is null or saved_flavor is null or saved_packaging is null or saved_active is null
    or saved_pack_size is null or saved_pack_size<1 or saved_threshold is null or saved_threshold<0
    or length(saved_sku)>80 or length(saved_variant_name)>160 or length(saved_flavor)>100 or length(saved_packaging)>100 then
    raise exception 'Enter a SKU, variant name, flavour, pack size, packaging type, status and nonnegative threshold.';
  end if;
  if saved_variant_id is null and ((saved_product_id is null) = (saved_product_name is null)) then
    raise exception 'Select one existing product or enter one new product name.';
  end if;
  if saved_variant_id is not null and saved_product_name is not null then
    raise exception 'An existing variant cannot move to another product.';
  end if;

  -- The locks make case-insensitive uniqueness safe even where legacy unique
  -- constraints only compare exact text.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(lower(saved_sku),612));
  if exists(select 1 from public.product_variants v where lower(btrim(v.sku))=lower(saved_sku)
    and (saved_variant_id is null or v.id<>saved_variant_id)) then
    return query select 409,jsonb_build_object('error','Another variant already uses this SKU. Choose a different SKU.','kind','conflict'); return;
  end if;

  if saved_variant_id is null and saved_product_name is not null then
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(lower(saved_product_name),613));
    if exists(select 1 from public.products p where lower(btrim(p.name))=lower(saved_product_name)) then
      return query select 409,jsonb_build_object('error','Another product already uses this name. Select it from the product list.','kind','conflict'); return;
    end if;
    generated_slug := trim(both '-' from regexp_replace(lower(saved_product_name),'[^a-z0-9]+','-','g'));
    if generated_slug='' then raise exception 'The product name needs letters or numbers.'; end if;
    if exists(select 1 from public.products p where p.slug=generated_slug) then
      return query select 409,jsonb_build_object('error','This product name creates a slug already in use. Choose a more specific product name.','kind','conflict'); return;
    end if;
    insert into public.products as p(name,slug,description)
      values(saved_product_name,generated_slug,nullif(btrim(p_body->>'newProductDescription'),''))
      returning p.id,to_jsonb(p) into saved_product_id,product_profile;
    insert into public.audit_logs(actor_id,action,record_id,request_key)
      values(actor,'products',saved_product_id,p_key);
  end if;

  if saved_variant_id is null then
    select to_jsonb(p) into product_profile from public.products p where p.id=saved_product_id and p.is_active;
    if product_profile is null then raise exception 'This product is unavailable. Refresh the catalogue and try again.'; end if;
    insert into public.product_variants as v(product_id,sku,variant_name,flavor,pack_size_grams,packaging_type,low_stock_threshold,is_active)
      values(saved_product_id,saved_sku,saved_variant_name,saved_flavor,saved_pack_size,saved_packaging,saved_threshold,saved_active)
      returning v.id into saved_variant_id;
  else
    select to_jsonb(v)||jsonb_build_object('product',to_jsonb(p)) into previous_profile
      from public.product_variants v join public.products p on p.id=v.product_id where v.id=saved_variant_id for update;
    if previous_profile is null then raise exception 'This variant no longer exists. Refresh the catalogue.'; end if;
    if saved_product_id is not null and saved_product_id<>(previous_profile->>'product_id')::bigint then
      raise exception 'A variant cannot move to another product. Add a new variant instead.';
    end if;
    saved_product_id := (previous_profile->>'product_id')::bigint;
    update public.product_variants as v set sku=saved_sku,variant_name=saved_variant_name,flavor=saved_flavor,
      pack_size_grams=saved_pack_size,packaging_type=saved_packaging,low_stock_threshold=saved_threshold,is_active=saved_active
      where v.id=saved_variant_id;
  end if;
  select to_jsonb(v)||jsonb_build_object('product',to_jsonb(p)) into new_profile
    from public.product_variants v join public.products p on p.id=v.product_id where v.id=saved_variant_id;
  insert into public.variant_profile_audits(actor_id,variant_id,previous_profile,new_profile,request_key)
    values(actor,saved_variant_id,previous_profile,new_profile,p_key);
  insert into public.audit_logs(actor_id,action,record_id,request_key)
    values(actor,'variants',saved_variant_id,p_key);
  update public.idempotency_keys set response_status=saved_status,response_body=jsonb_build_object('id',saved_variant_id,'productId',saved_product_id) where key=p_key;
  return query select saved_status,jsonb_build_object('id',saved_variant_id,'productId',saved_product_id);
end; $$;
revoke execute on function public.execute_variant_save(uuid,text,jsonb) from public;
