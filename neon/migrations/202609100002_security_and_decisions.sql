create table public.users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique check (email = lower(btrim(email))),
  full_name text not null default '',
  password_hash text not null,
  app_role public.app_role not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.sessions (
  id text primary key check (length(id) = 43),
  user_id uuid not null references public.users(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index sessions_user_id_idx on public.sessions(user_id);
create index sessions_expires_at_idx on public.sessions(expires_at);
create table public.login_attempts (
  key text primary key,
  attempts integer not null default 1,
  window_start timestamptz not null default now()
);
create table public.idempotency_keys (
  key uuid primary key,
  endpoint text not null,
  request_hash text not null,
  actor_id uuid not null references public.users(id),
  response_status integer,
  response_body jsonb,
  created_at timestamptz not null default now(),
  check ((response_status is null) = (response_body is null))
);
create index idempotency_keys_created_at_idx on public.idempotency_keys(created_at);
create index idempotency_keys_actor_id_idx on public.idempotency_keys(actor_id);
create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid not null references public.users(id),
  action text not null,
  record_id bigint not null,
  request_key uuid not null,
  created_at timestamptz not null default now()
);
create index audit_logs_actor_created_idx on public.audit_logs(actor_id, created_at desc);
create table public.warehouses (
  id bigint primary key check (id = 1),
  name text not null
);
insert into public.warehouses values (1, 'Beecone main warehouse');
alter table public.inventory_lots add column warehouse_id bigint not null default 1 references public.warehouses(id);
alter table public.production_batches add column warehouse_id bigint not null default 1 references public.warehouses(id), add column expires_at date;
alter table public.production_outputs add column warehouse_id bigint not null default 1 references public.warehouses(id);
alter table public.stock_issues add column warehouse_id bigint not null default 1 references public.warehouses(id);
alter table public.materials add column low_stock_threshold numeric(14,3) not null default 0 check (low_stock_threshold >= 0);
alter table public.product_variants add column low_stock_threshold integer not null default 0 check (low_stock_threshold >= 0);
create index inventory_lots_fifo_idx on public.inventory_lots(material_id, received_at, id) where status = 'open' and quantity_remaining > 0;
create index production_batches_expiry_idx on public.production_batches(expires_at) where status = 'completed';
create index retailer_stock_ledgers_output_idx on public.retailer_stock_ledgers(production_output_id);

-- A price is effective until the next row for the same variant. No retailer/campaign dimension.
create table public.pricing (
  id bigint generated always as identity primary key,
  variant_id bigint not null references public.product_variants(id),
  unit_price numeric(14,2) not null check (unit_price >= 0),
  effective_from timestamptz not null,
  created_by uuid not null references public.users(id),
  created_at timestamptz not null default now(),
  unique (variant_id, effective_from)
);
create view public.current_variant_prices as
select distinct on (variant_id) variant_id, unit_price, effective_from
from public.pricing where effective_from <= now() order by variant_id, effective_from desc;
create table public.production_recipes (
  id bigint generated always as identity primary key,
  variant_id bigint not null unique references public.product_variants(id),
  name text not null check (btrim(name) <> ''),
  updated_at timestamptz not null default now()
);
create table public.production_recipe_items (
  id bigint generated always as identity primary key,
  recipe_id bigint not null references public.production_recipes(id) on delete cascade,
  material_id bigint not null references public.materials(id),
  quantity_per_unit numeric(14,6) not null check (quantity_per_unit > 0),
  unique (recipe_id, material_id)
);
create index production_recipe_items_material_idx on public.production_recipe_items(material_id);
alter type public.retailer_stock_movement_type add value 'expiry';
alter table public.reconciliations add column total_expired_quantity integer not null default 0 check (total_expired_quantity >= 0),
  add column total_expired_value numeric(14,2) not null default 0 check (total_expired_value >= 0);
alter table public.reconciliation_items add column quantity_expired integer not null default 0 check (quantity_expired >= 0),
  add column expired_value numeric(14,2) generated always as (round(quantity_expired * unit_price,2)) stored,
  drop constraint reconciliation_items_quantity_split_check,
  add constraint reconciliation_items_quantity_split_check check
    (quantity_sold + quantity_returned + quantity_damaged + quantity_expired + quantity_remaining = quantity_open);
create table public.returns (
  id bigint generated always as identity primary key,
  reconciliation_item_id bigint not null references public.reconciliation_items(id),
  production_batch_id bigint not null references public.production_batches(id),
  retailer_id bigint not null references public.retailers(id),
  warehouse_id bigint not null default 1 references public.warehouses(id),
  quantity integer not null check (quantity > 0),
  reason text not null check (btrim(reason) <> ''),
  condition text not null check (condition in ('good', 'damaged', 'expired')),
  disposition text not null check (disposition in ('restock', 'write_off')),
  created_at timestamptz not null default now(),
  check ((condition = 'good' and disposition = 'restock') or (condition <> 'good' and disposition = 'write_off'))
);
create index returns_reconciliation_item_idx on public.returns(reconciliation_item_id);
create index returns_batch_idx on public.returns(production_batch_id);
create index returns_retailer_idx on public.returns(retailer_id);

-- The API is the authorization boundary. No browser or public execution grants.
revoke all on all tables in schema public from public;
revoke all on all sequences in schema public from public;
revoke execute on all functions in schema public from public;
