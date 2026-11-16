-- Simple operations: one-tap production runs, barcode scanning, direct sales
-- and retailer check-ins. Each new action composes the existing audited
-- functions (FIFO lots, batch costing, reconciliation, remittance) so the
-- ledgers stay the single source of truth.

-- One retail barcode per product variant (shared by every jar of that variant).
alter table public.product_variants add column barcode text
  check (barcode is null or barcode ~ '^[0-9A-Za-z-]{4,64}$');
create unique index product_variants_barcode_key
  on public.product_variants (barcode) where barcode is not null;

-- How a material is bought, e.g. raw honey arrives in 20 kg jerricans.
alter table public.materials
  add column purchase_unit_label text,
  add column purchase_unit_size numeric(14, 3) not null default 1
    check (purchase_unit_size > 0);
update public.materials
set purchase_unit_label = 'jerrican', purchase_unit_size = 20
where kind = 'raw_honey' and lower(unit_of_measure) in ('kg', 'l', 'litre', 'liter', 'litres', 'liters');
create function private.default_purchase_unit()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.purchase_unit_label is null and new.kind = 'raw_honey'
    and lower(new.unit_of_measure) in ('kg', 'l', 'litre', 'liter', 'litres', 'liters') then
    new.purchase_unit_label := 'jerrican';
    new.purchase_unit_size := 20;
  end if;
  return new;
end; $$;
create trigger materials_default_purchase_unit
before insert on public.materials
for each row execute function private.default_purchase_unit();

-- Direct sales to walk-in customers. Unlike consignment, a direct sale is
-- recognised immediately at the variant price effective on the sale date.
create table public.direct_sales (
  id bigint generated always as identity primary key,
  sale_reference text,
  sold_at timestamptz not null default now(),
  customer_name text,
  payment_method text not null default 'cash'
    check (payment_method in ('cash', 'mobile_money', 'bank', 'other')),
  total_quantity integer not null default 0 check (total_quantity >= 0),
  total_amount numeric(14, 2) not null default 0 check (total_amount >= 0),
  total_cost numeric(14, 2) not null default 0 check (total_cost >= 0),
  notes text,
  warehouse_id bigint not null default 1 references public.warehouses (id),
  created_by uuid not null,
  created_at timestamptz not null default now()
);
create index direct_sales_sold_at_idx on public.direct_sales (sold_at desc);

create table public.direct_sale_items (
  id bigint generated always as identity primary key,
  direct_sale_id bigint not null references public.direct_sales (id) on delete cascade,
  line_number integer not null,
  production_output_id bigint not null references public.production_outputs (id),
  production_batch_id bigint not null references public.production_batches (id),
  variant_id bigint not null references public.product_variants (id),
  quantity integer not null check (quantity > 0),
  unit_price numeric(14, 2) not null check (unit_price >= 0),
  unit_cost numeric(14, 2) not null check (unit_cost >= 0),
  line_total numeric(14, 2) generated always as (round(quantity * unit_price, 2)) stored,
  cost_total numeric(14, 2) generated always as (round(quantity * unit_cost, 2)) stored,
  unique (direct_sale_id, line_number)
);
create index direct_sale_items_output_idx on public.direct_sale_items (production_output_id);
create index direct_sale_items_variant_idx on public.direct_sale_items (variant_id);

-- Price of a variant effective at a moment (no retailer/campaign dimension).
create function private.variant_price_at(p_variant_id bigint, p_at timestamptz)
returns numeric language sql stable set search_path = '' as $$
  select unit_price from public.pricing
  where variant_id = p_variant_id and effective_from <= p_at
  order by effective_from desc limit 1
$$;

-- Make jars of several sizes in one action. Each variant becomes its own
-- traceable, costed batch; inputs come from the variant recipe and are drawn
-- from material lots first-in first-out.
create function public.record_production_run(
  p_produced_at timestamptz,
  p_notes text,
  p_items jsonb
)
returns bigint
language plpgsql
set search_path = ''
as $$
declare
  v_at timestamptz := coalesce(p_produced_at, now());
  v_item record;
  v_shortage record;
  v_inputs jsonb;
  v_base text;
  v_code text;
  v_suffix integer;
  v_batch_id bigint;
  v_first_id bigint;
  v_run jsonb;
begin
  if nullif(current_setting('boms.actor_id', true), '') is null then
    raise exception 'Authentication is required to make jars.';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception 'Choose how many jars to make.';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object('variant_id', variant_id, 'quantity', quantity)), '[]'::jsonb)
  into v_run
  from (
    select (value->>'variant_id')::bigint variant_id, sum((value->>'quantity')::integer)::integer quantity
    from jsonb_array_elements(p_items)
    where coalesce((value->>'quantity')::integer, 0) > 0
    group by 1
  ) grouped;
  if jsonb_array_length(v_run) = 0 then
    raise exception 'Choose how many jars to make.';
  end if;

  for v_item in
    select r.variant_id, v.variant_name
    from jsonb_to_recordset(v_run) as r(variant_id bigint, quantity integer)
    join public.product_variants v on v.id = r.variant_id
    left join public.production_recipes recipe on recipe.variant_id = v.id
    where not v.is_active
      or recipe.id is null
      or not exists (select 1 from public.production_recipe_items i where i.recipe_id = recipe.id)
  loop
    raise exception 'No recipe is set for %. Add one in Catalogue settings first.', v_item.variant_name;
  end loop;
  if exists (select 1 from jsonb_to_recordset(v_run) as r(variant_id bigint, quantity integer) left join public.product_variants v on v.id = r.variant_id where v.id is null) then
    raise exception 'A selected product is not available.';
  end if;

  -- One friendly shortage message before anything is written.
  for v_shortage in
    with needed as (
      select i.material_id, sum(round(i.quantity_per_unit * r.quantity, 3)) quantity
      from jsonb_to_recordset(v_run) as r(variant_id bigint, quantity integer)
      join public.production_recipes recipe on recipe.variant_id = r.variant_id
      join public.production_recipe_items i on i.recipe_id = recipe.id
      group by i.material_id
    )
    select m.name, m.unit_of_measure, n.quantity needed,
      coalesce((select sum(l.quantity_remaining) from public.inventory_lots l
        where l.material_id = n.material_id and l.status = 'open' and l.received_at <= v_at), 0) on_hand
    from needed n join public.materials m on m.id = n.material_id
  loop
    if v_shortage.on_hand < v_shortage.needed then
      raise exception 'Not enough %: need % %, only % % in stock.',
        v_shortage.name, trim_scale(v_shortage.needed), v_shortage.unit_of_measure,
        trim_scale(v_shortage.on_hand), v_shortage.unit_of_measure;
    end if;
  end loop;

  for v_item in
    select r.variant_id, r.quantity, v.sku, recipe.id recipe_id
    from jsonb_to_recordset(v_run) as r(variant_id bigint, quantity integer)
    join public.product_variants v on v.id = r.variant_id
    join public.production_recipes recipe on recipe.variant_id = r.variant_id
    order by v.pack_size_grams, v.id
  loop
    select jsonb_agg(jsonb_build_object(
      'material_id', i.material_id,
      'quantity', round(i.quantity_per_unit * v_item.quantity, 3)))
    into v_inputs
    from public.production_recipe_items i
    where i.recipe_id = v_item.recipe_id
      and round(i.quantity_per_unit * v_item.quantity, 3) > 0;

    v_base := v_item.sku || '-' || to_char(v_at at time zone 'Africa/Kampala', 'YYMMDD');
    v_code := v_base;
    v_suffix := 1;
    while exists (select 1 from public.production_batches where batch_code = v_code) loop
      v_suffix := v_suffix + 1;
      v_code := v_base || '-' || v_suffix;
    end loop;

    v_batch_id := public.record_production_batch(
      v_item.variant_id, v_code, v_at, p_notes, v_item.quantity, v_inputs);
    v_first_id := coalesce(v_first_id, v_batch_id);
  end loop;

  return v_first_id;
end;
$$;

-- Sell jars straight to a customer. Batches are drawn oldest first.
create function public.record_direct_sale(
  p_sold_at timestamptz,
  p_customer_name text,
  p_payment_method text,
  p_reference text,
  p_notes text,
  p_items jsonb
)
returns bigint
language plpgsql
set search_path = ''
as $$
declare
  v_actor uuid := nullif(current_setting('boms.actor_id', true), '')::uuid;
  v_at timestamptz := coalesce(p_sold_at, now());
  v_sale_id bigint;
  v_line jsonb;
  v_line_number integer := 0;
  v_output record;
  v_quantity integer;
  v_price numeric(14, 2);
  v_missing text;
begin
  if v_actor is null then
    raise exception 'Authentication is required to record sales.';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Add at least one jar to the sale.';
  end if;

  select string_agg(distinct v.variant_name, ', ') into v_missing
  from jsonb_array_elements(p_items) e
  join public.product_variants v on v.id = (e.value->>'variant_id')::bigint
  where private.variant_price_at(v.id, v_at) is null;
  if v_missing is not null then
    raise exception 'Set a selling price for % in Catalogue settings first.', v_missing;
  end if;

  insert into public.direct_sales (sale_reference, sold_at, customer_name, payment_method, notes, created_by)
  values (nullif(btrim(p_reference), ''), v_at, nullif(btrim(p_customer_name), ''),
    coalesce(nullif(p_payment_method, ''), 'cash'), nullif(btrim(p_notes), ''), v_actor)
  returning id into v_sale_id;

  for v_line in
    select value from jsonb_array_elements(private.resolve_issue_inputs(
      (select jsonb_agg(jsonb_build_object('variant_id', value->>'variant_id', 'quantity', value->>'quantity'))
       from jsonb_array_elements(p_items)), v_at))
    order by (value->>'production_output_id')::bigint
  loop
    v_line_number := v_line_number + 1;
    v_quantity := (v_line->>'quantity')::integer;
    select o.id, o.production_batch_id, o.variant_id, o.quantity_remaining, o.unit_cost
    into v_output
    from public.production_outputs o
    where o.id = (v_line->>'production_output_id')::bigint
    for update;
    if v_output.quantity_remaining < v_quantity then
      raise exception 'Not enough jars in stock for this sale.';
    end if;
    v_price := private.variant_price_at(v_output.variant_id, v_at);
    update public.production_outputs
    set quantity_remaining = quantity_remaining - v_quantity
    where id = v_output.id;
    insert into public.direct_sale_items (direct_sale_id, line_number, production_output_id,
      production_batch_id, variant_id, quantity, unit_price, unit_cost)
    values (v_sale_id, v_line_number, v_output.id, v_output.production_batch_id,
      v_output.variant_id, v_quantity, v_price, v_output.unit_cost);
  end loop;

  update public.direct_sales s set
    total_quantity = t.quantity, total_amount = t.amount, total_cost = t.cost
  from (select coalesce(sum(quantity), 0)::integer quantity, coalesce(sum(line_total), 0) amount,
          coalesce(sum(cost_total), 0) cost
        from public.direct_sale_items where direct_sale_id = v_sale_id) t
  where s.id = v_sale_id;
  return v_sale_id;
end;
$$;

-- Consignment check-in: count what is still on the retailer's shelf, the rest
-- is sold. Optionally record damaged jars and money collected in the same step.
create function public.record_retailer_checkin(
  p_retailer_id bigint,
  p_checked_at timestamptz,
  p_notes text,
  p_counts jsonb,
  p_amount numeric,
  p_payment_reference text
)
returns bigint
language plpgsql
set search_path = ''
as $$
declare
  v_at timestamptz := coalesce(p_checked_at, now());
  v_count record;
  v_line record;
  v_items jsonb := '[]'::jsonb;
  v_sold integer;
  v_damaged integer;
  v_take_sold integer;
  v_take_damaged integer;
  v_reconciliation_id bigint;
  v_remittance_id bigint;
  v_changes boolean := false;
begin
  if nullif(current_setting('boms.actor_id', true), '') is null then
    raise exception 'Authentication is required to check in a retailer.';
  end if;
  if p_counts is null or jsonb_typeof(p_counts) <> 'array' then
    raise exception 'Count the jars on the shelf first.';
  end if;

  -- Hold the retailer's open lines so the counts match what is reconciled.
  perform o.id from public.production_outputs o
  where o.id in (select production_output_id from public.retailer_issue_open_balances where retailer_id = p_retailer_id)
  order by o.id for update;

  for v_count in
    select (value->>'variant_id')::bigint variant_id,
      greatest(coalesce((value->>'remaining')::integer, 0), 0) remaining,
      greatest(coalesce((value->>'damaged')::integer, 0), 0) damaged,
      (select coalesce(sum(b.quantity_open), 0)::integer from public.retailer_issue_open_balances b
        where b.retailer_id = p_retailer_id and b.variant_id = (value->>'variant_id')::bigint) held,
      (select variant_name from public.product_variants where id = (value->>'variant_id')::bigint) variant_name
    from jsonb_array_elements(p_counts)
  loop
    if v_count.remaining + v_count.damaged > v_count.held then
      raise exception 'The retailer only holds % jars of %.', v_count.held, coalesce(v_count.variant_name, 'that product');
    end if;
    v_sold := v_count.held - v_count.remaining - v_count.damaged;
    v_damaged := v_count.damaged;
    if v_sold > 0 or v_damaged > 0 then v_changes := true; end if;
    -- Oldest stock is treated as sold first, then damaged; the rest stays on the shelf.
    for v_line in
      select stock_issue_item_id, quantity_open from public.retailer_issue_open_balances
      where retailer_id = p_retailer_id and variant_id = v_count.variant_id
      order by issued_at, stock_issue_item_id
    loop
      v_take_sold := least(v_sold, v_line.quantity_open);
      v_sold := v_sold - v_take_sold;
      v_take_damaged := least(v_damaged, v_line.quantity_open - v_take_sold);
      v_damaged := v_damaged - v_take_damaged;
      v_items := v_items || jsonb_build_array(jsonb_build_object(
        'stock_issue_item_id', v_line.stock_issue_item_id,
        'quantity_sold', v_take_sold,
        'quantity_returned', 0,
        'quantity_damaged', v_take_damaged,
        'quantity_expired', 0,
        'quantity_remaining', v_line.quantity_open - v_take_sold - v_take_damaged,
        'return_reason', case when v_take_damaged > 0 then 'Damaged at retailer (check-in)' end));
    end loop;
  end loop;

  if v_changes then
    v_reconciliation_id := public.record_reconciliation(
      p_retailer_id, v_at, null, coalesce(nullif(btrim(p_notes), ''), 'Retailer check-in'), v_items);
  end if;
  if coalesce(p_amount, 0) > 0 then
    v_remittance_id := public.record_remittance(
      p_retailer_id, v_reconciliation_id, v_at, p_amount, p_payment_reference, p_notes);
  end if;
  if v_reconciliation_id is null and v_remittance_id is null then
    raise exception 'Nothing changed: no jars sold or damaged and no money collected.';
  end if;
  return coalesce(v_reconciliation_id, v_remittance_id);
end;
$$;

-- Link (or clear) the shared barcode printed on a variant's labels.
create function public.set_variant_barcode(p_variant_id bigint, p_barcode text)
returns bigint language plpgsql set search_path = '' as $$
declare v_owner text;
begin
  select variant_name into v_owner from public.product_variants
  where barcode = nullif(btrim(p_barcode), '') and id <> p_variant_id;
  if v_owner is not null then
    raise exception 'This barcode is already linked to %.', v_owner;
  end if;
  update public.product_variants set barcode = nullif(btrim(p_barcode), '') where id = p_variant_id;
  if not found then raise exception 'The selected product is not available.'; end if;
  return p_variant_id;
end; $$;

create or replace function public.execute_idempotent(p_key uuid, p_endpoint text, p_hash text, p_body jsonb)
returns table(response_status integer, response_body jsonb)
language plpgsql set search_path = '' as $$
declare saved public.idempotency_keys%rowtype;
  actor uuid := nullif(current_setting('boms.actor_id',true),'')::uuid;
  record_id bigint; recipe_item jsonb;
begin
  if actor is null then raise exception 'Authentication required'; end if;
  insert into public.idempotency_keys(key,endpoint,request_hash,actor_id)
    values(p_key,p_endpoint,p_hash,actor) on conflict(key) do nothing;
  -- A concurrent INSERT on the same key waits for the winning transaction.
  -- This new statement sees its committed response, including at READ COMMITTED.
  select * into saved from public.idempotency_keys where key=p_key for update;
  if saved.endpoint <> p_endpoint or saved.request_hash <> p_hash or saved.actor_id <> actor then
    return query select 409, jsonb_build_object('error','This retry key belongs to a different request.','kind','conflict'); return;
  end if;
  if saved.response_status is not null then
    return query select saved.response_status,saved.response_body; return;
  end if;
  case p_endpoint
    when 'purchases' then record_id := public.record_purchase((p_body->>'supplierId')::bigint,(p_body->>'purchasedAt')::timestamptz,p_body->>'purchaseReference',p_body->>'notes',p_body->'items');
    when 'production' then
      record_id := public.record_production_batch((p_body->>'variantId')::bigint,p_body->>'batchCode',(p_body->>'startedAt')::timestamptz,p_body->>'notes',(p_body->>'outputQuantity')::integer,p_body->'inputs');
      if p_body->>'expiresAt' is not null then
        if (p_body->>'expiresAt')::date < (select completed_at::date from public.production_batches where id=record_id) then raise exception 'Expiry date cannot precede production.'; end if;
        update public.production_batches set expires_at=(p_body->>'expiresAt')::date where id=record_id;
      end if;
    when 'production-run' then record_id := public.record_production_run((p_body->>'producedAt')::timestamptz,p_body->>'notes',p_body->'items');
    when 'stock-issues' then record_id := public.record_stock_issue((p_body->>'retailerId')::bigint,(p_body->>'issuedAt')::timestamptz,p_body->>'issueReference',p_body->>'notes',p_body->'items');
    when 'direct-sales' then record_id := public.record_direct_sale((p_body->>'soldAt')::timestamptz,p_body->>'customerName',p_body->>'paymentMethod',p_body->>'saleReference',p_body->>'notes',p_body->'items');
    when 'retailer-checkins' then record_id := public.record_retailer_checkin((p_body->>'retailerId')::bigint,(p_body->>'checkedAt')::timestamptz,p_body->>'notes',p_body->'counts',(p_body->>'amount')::numeric,p_body->>'paymentReference');
    when 'variant-barcode' then record_id := public.set_variant_barcode((p_body->>'variantId')::bigint,p_body->>'barcode');
    when 'reconciliations' then record_id := public.record_reconciliation((p_body->>'retailerId')::bigint,(p_body->>'reconciledAt')::timestamptz,p_body->>'reconciliationReference',p_body->>'notes',p_body->'items');
    when 'returns' then
      if exists(select 1 from jsonb_array_elements(p_body->'items') where coalesce((value->>'quantity_sold')::integer,0) <> 0) then raise exception 'Returns cannot record sales.'; end if;
      record_id := public.record_reconciliation((p_body->>'retailerId')::bigint,(p_body->>'reconciledAt')::timestamptz,p_body->>'reconciliationReference',p_body->>'notes',p_body->'items');
    when 'remittances' then record_id := public.record_remittance((p_body->>'retailerId')::bigint,(p_body->>'reconciliationId')::bigint,(p_body->>'receivedAt')::timestamptz,(p_body->>'amount')::numeric,p_body->>'remittanceReference',p_body->>'notes');
    when 'expenses' then record_id := public.record_expense(p_body->>'expenseCategory',(p_body->>'incurredAt')::timestamptz,(p_body->>'amount')::numeric,p_body->>'vendorName',p_body->>'expenseReference',p_body->>'notes');
    when 'prices' then
      insert into public.pricing(variant_id,unit_price,effective_from,created_by)
        values((p_body->>'variantId')::bigint,(p_body->>'unitPrice')::numeric,(p_body->>'effectiveFrom')::timestamptz,actor) returning id into record_id;
    when 'recipes' then
      insert into public.production_recipes(variant_id,name) values((p_body->>'variantId')::bigint,p_body->>'name')
        on conflict(variant_id) do update set name=excluded.name,updated_at=now() returning id into record_id;
      delete from public.production_recipe_items where recipe_id=record_id;
      for recipe_item in select value from jsonb_array_elements(p_body->'items') loop
        insert into public.production_recipe_items(recipe_id,material_id,quantity_per_unit)
          values(record_id,(recipe_item->>'materialId')::bigint,(recipe_item->>'quantityPerUnit')::numeric);
      end loop;
    else raise exception 'Unknown action';
  end case;
  insert into public.audit_logs(actor_id,action,record_id,request_key) values(actor,p_endpoint,record_id,p_key);
  update public.idempotency_keys set response_status=201,response_body=jsonb_build_object('id',record_id) where key=p_key;
  return query select 201,jsonb_build_object('id',record_id);
end; $$;

-- Direct sales count as recognised revenue alongside reconciled retail sales.
create or replace view public.finance_profit_summary
with (security_invoker = true)
as
with retailer_totals as (
  select
    coalesce(sum(balance.issued_quantity), 0)::integer as issued_quantity,
    coalesce(sum(balance.sold_quantity), 0)::integer as sold_quantity,
    coalesce(sum(balance.returned_quantity), 0)::integer as returned_quantity,
    coalesce(sum(balance.damaged_quantity), 0)::integer as damaged_quantity,
    coalesce(sum(balance.remaining_quantity), 0)::integer as remaining_quantity,
    coalesce(sum(balance.recognized_sales_value), 0)::numeric(14, 2)
      as recognized_sales_value,
    coalesce(sum(balance.cost_of_goods_sold), 0)::numeric(14, 2)
      as cost_of_goods_sold,
    coalesce(sum(balance.gross_profit), 0)::numeric(14, 2) as gross_profit,
    coalesce(sum(balance.remitted_amount), 0)::numeric(14, 2) as remitted_amount,
    coalesce(sum(balance.outstanding_amount), 0)::numeric(14, 2)
      as outstanding_amount,
    count(*) filter (
      where balance.issued_quantity > 0
        or balance.sold_quantity > 0
        or balance.remaining_quantity > 0
    )::integer as active_retailers
  from public.retailer_outstanding_balances as balance
),
direct_totals as (
  select
    coalesce(sum(sale.total_quantity), 0)::integer as direct_sold_quantity,
    coalesce(sum(sale.total_amount), 0)::numeric(14, 2) as direct_sales_value,
    coalesce(sum(sale.total_cost), 0)::numeric(14, 2) as direct_cost_of_goods_sold
  from public.direct_sales as sale
),
expense_totals as (
  select
    count(*)::integer as expense_count,
    coalesce(sum(expense.amount), 0)::numeric(14, 2) as operating_expenses
  from public.expenses as expense
)
select
  retailer_totals.active_retailers,
  retailer_totals.issued_quantity,
  (retailer_totals.sold_quantity + direct_totals.direct_sold_quantity)::integer as sold_quantity,
  retailer_totals.returned_quantity,
  retailer_totals.damaged_quantity,
  retailer_totals.remaining_quantity,
  (retailer_totals.recognized_sales_value + direct_totals.direct_sales_value)::numeric(14, 2)
    as recognized_sales_value,
  (retailer_totals.cost_of_goods_sold + direct_totals.direct_cost_of_goods_sold)::numeric(14, 2)
    as cost_of_goods_sold,
  (retailer_totals.gross_profit + direct_totals.direct_sales_value
    - direct_totals.direct_cost_of_goods_sold)::numeric(14, 2) as gross_profit,
  expense_totals.expense_count,
  expense_totals.operating_expenses,
  round(
    retailer_totals.gross_profit + direct_totals.direct_sales_value
      - direct_totals.direct_cost_of_goods_sold - expense_totals.operating_expenses,
    2
  ) as net_profit,
  retailer_totals.remitted_amount,
  retailer_totals.outstanding_amount,
  direct_totals.direct_sold_quantity,
  direct_totals.direct_sales_value,
  direct_totals.direct_cost_of_goods_sold
from retailer_totals
cross join direct_totals
cross join expense_totals;

-- Historical reports rebuild stock from movements; direct sales leave stock too.
create or replace view public.weekly_stock_movement_summary as
select date_trunc('week',p.purchased_at at time zone 'Africa/Kampala')::date week_start,
  'received'::text movement,m.name item,m.unit_of_measure unit,sum(i.quantity) quantity,sum(i.line_total) value
from public.purchases p join public.purchase_items i on i.purchase_id=p.id join public.materials m on m.id=i.material_id
where p.status='received' group by 1,2,3,4
union all
select date_trunc('week',b.completed_at at time zone 'Africa/Kampala')::date,'produced',v.variant_name,'jars',sum(b.total_output_quantity),sum(b.total_input_cost)
from public.production_batches b join public.product_variants v on v.id=b.variant_id where b.status='completed' group by 1,2,3,4
union all
select date_trunc('week',s.issued_at at time zone 'Africa/Kampala')::date,'issued',v.variant_name,'jars',sum(i.quantity_issued),sum(i.total_cost)
from public.stock_issues s join public.stock_issue_items i on i.stock_issue_id=s.id join public.product_variants v on v.id=i.variant_id where s.status='issued' group by 1,2,3,4
union all
select date_trunc('week',s.sold_at at time zone 'Africa/Kampala')::date,'sold_direct',v.variant_name,'jars',sum(i.quantity),sum(i.line_total)
from public.direct_sales s join public.direct_sale_items i on i.direct_sale_id=s.id join public.product_variants v on v.id=i.variant_id group by 1,2,3,4;

create or replace function public.inventory_valuation_at(p_end timestamptz)
returns table(category text,value numeric) language sql stable set search_path = '' as $$
with consumed as (
  select i.inventory_lot_id,sum(i.quantity_consumed) quantity from public.production_inputs i
  join public.production_batches b on b.id=i.production_batch_id where b.status='completed' and b.completed_at<p_end group by i.inventory_lot_id
), recognized as (
  select production_output_id,sum(quantity) quantity from (
    select production_output_id,-quantity_delta quantity from public.retailer_stock_ledgers
    where moved_at<p_end and movement_type in ('reconciliation_sale','damage','expiry')
    union all
    select i.production_output_id,i.quantity from public.direct_sale_items i
    join public.direct_sales s on s.id=i.direct_sale_id where s.sold_at<p_end
  ) movements group by production_output_id
)
select m.kind::text,round(sum((l.quantity_received-coalesce(c.quantity,0))*l.unit_cost),2)
from public.inventory_lots l join public.materials m on m.id=l.material_id left join consumed c on c.inventory_lot_id=l.id
where l.received_at<p_end group by m.kind
union all
select 'finished_goods_including_consignment',coalesce(round(sum((o.quantity_produced-coalesce(r.quantity,0))*o.unit_cost),2),0)
from public.production_outputs o join public.production_batches b on b.id=o.production_batch_id left join recognized r on r.production_output_id=o.id
where b.status='completed' and b.completed_at<p_end;
$$;

create or replace function public.stock_digest_at(p_end timestamptz)
returns jsonb language sql stable set search_path = '' as $$
with material_balances as (
  select m.id,m.name,m.unit_of_measure,m.low_stock_threshold,
    coalesce((select sum(l.quantity_received) from public.inventory_lots l where l.material_id=m.id and l.received_at<p_end),0)
    -coalesce((select sum(i.quantity_consumed) from public.production_inputs i join public.production_batches b on b.id=i.production_batch_id where i.material_id=m.id and b.completed_at<p_end and b.status='completed'),0) quantity
  from public.materials m where m.is_active
), direct_sold as (
  select i.production_output_id,sum(i.quantity) quantity from public.direct_sale_items i
  join public.direct_sales s on s.id=i.direct_sale_id where s.sold_at<p_end group by i.production_output_id
), warehouse_balances as (
  select o.id,b.batch_code,b.expires_at,v.variant_name,o.variant_id,
    o.quantity_produced-coalesce((select sum(i.quantity_issued) from public.stock_issue_items i join public.stock_issues s on s.id=i.stock_issue_id where i.production_output_id=o.id and s.issued_at<p_end and s.status='issued'),0)
      -coalesce((select sum(l.quantity_delta) from public.retailer_stock_ledgers l where l.production_output_id=o.id and l.movement_type='return_to_warehouse' and l.moved_at<p_end),0)
      -coalesce((select d.quantity from direct_sold d where d.production_output_id=o.id),0) quantity
  from public.production_outputs o join public.production_batches b on b.id=o.production_batch_id join public.product_variants v on v.id=o.variant_id
  where b.status='completed' and b.completed_at<p_end
), variant_balances as (
  select v.id,v.variant_name,v.low_stock_threshold,coalesce(sum(w.quantity),0) quantity from public.product_variants v left join warehouse_balances w on w.variant_id=v.id where v.is_active group by v.id
), owned_balances as (
  select o.id,b.batch_code,b.expires_at,v.variant_name,
    o.quantity_produced+coalesce((select sum(l.quantity_delta) from public.retailer_stock_ledgers l where l.production_output_id=o.id and l.moved_at<p_end and l.movement_type in ('reconciliation_sale','damage','expiry')),0)
      -coalesce((select d.quantity from direct_sold d where d.production_output_id=o.id),0) quantity
  from public.production_outputs o join public.production_batches b on b.id=o.production_batch_id join public.product_variants v on v.id=o.variant_id where b.completed_at<p_end and b.status='completed'
)
select jsonb_build_object(
  'materials',coalesce((select jsonb_agg(to_jsonb(m)) from material_balances m where quantity<=low_stock_threshold),'[]'),
  'variants',coalesce((select jsonb_agg(to_jsonb(v)) from variant_balances v where quantity<=low_stock_threshold),'[]'),
  'expiring',coalesce((select jsonb_agg(to_jsonb(w) order by expires_at nulls last) from owned_balances w where quantity>0 and (expires_at is null or expires_at<=p_end::date+30)),'[]')
);
$$;

create or replace function public.business_report(p_start date,p_end date)
returns jsonb language sql stable set search_path = '' as $$
with bounds as (select p_start::timestamp at time zone 'Africa/Kampala' a,p_end::timestamp at time zone 'Africa/Kampala' b),
sales as (
  select
    coalesce((select sum(c.total_sales_value) from public.reconciliations c where c.reconciled_at>=a and c.reconciled_at<b),0)
      +coalesce((select sum(d.total_amount) from public.direct_sales d where d.sold_at>=a and d.sold_at<b),0) revenue,
    coalesce((select sum(c.total_cogs_value) from public.reconciliations c where c.reconciled_at>=a and c.reconciled_at<b),0)
      +coalesce((select sum(d.total_cost) from public.direct_sales d where d.sold_at>=a and d.sold_at<b),0) cogs,
    coalesce((select sum(d.total_amount) from public.direct_sales d where d.sold_at>=a and d.sold_at<b),0) direct_revenue
  from bounds
), costs as (
  select coalesce(sum(e.amount),0) expenses from public.expenses e,bounds where e.incurred_at>=a and e.incurred_at<b
), rankings as (
  select r.id,r.retailer_name,
    coalesce((select sum(s.total_quantity) from public.stock_issues s,bounds where s.retailer_id=r.id and s.status='issued' and s.issued_at>=a and s.issued_at<b),0) issued,
    coalesce(sum(c.total_sold_quantity),0) sold,coalesce(sum(c.total_sales_value),0) revenue,
    coalesce(sum(c.total_returned_quantity),0) returned,coalesce(sum(c.total_damaged_quantity+c.total_expired_quantity),0) lost,
    round(100.0*sum(c.total_returned_quantity+c.total_damaged_quantity+c.total_expired_quantity)/nullif(sum(c.total_sold_quantity+c.total_returned_quantity+c.total_damaged_quantity+c.total_expired_quantity),0),2) loss_return_rate,
    (select round(avg(greatest(0,extract(epoch from (m.received_at-rec.reconciled_at))/86400)),1) from public.remittances m join public.reconciliations rec on rec.id=m.reconciliation_id,bounds where m.retailer_id=r.id and m.received_at>=a and m.received_at<b) linked_payment_days
  from public.retailers r cross join bounds left join public.reconciliations c on c.retailer_id=r.id and c.reconciled_at>=a and c.reconciled_at<b group by r.id
)
select jsonb_build_object(
  'profit', (select jsonb_build_object('revenue',revenue,'direct_revenue',direct_revenue,'cogs',cogs,'gross_profit',revenue-cogs,'gross_margin',round(100*(revenue-cogs)/nullif(revenue,0),2),'operating_expenses',expenses,'net_profit',revenue-cogs-expenses) from sales cross join costs),
  'valuation',coalesce((select jsonb_agg(to_jsonb(v)) from public.inventory_valuation_at((select b from bounds)) v),'[]'),
  'retailers',coalesce((select jsonb_agg(to_jsonb(r) order by revenue desc,sold desc,retailer_name) from rankings r),'[]'),
  'expenses',coalesce((select jsonb_agg(to_jsonb(e)) from (select expense_category,sum(amount) amount from public.expenses,bounds where incurred_at>=a and incurred_at<b group by expense_category order by sum(amount) desc) e),'[]'),
  'aging',coalesce((select jsonb_agg(to_jsonb(v)) from public.retailer_aging_at((select b from bounds)) v),'[]'),
  'digest',public.stock_digest_at((select b from bounds)),
  'movements',coalesce((select jsonb_agg(to_jsonb(v) order by week_start,movement,item) from public.weekly_stock_movement_summary v where week_start>=p_start and week_start<p_end),'[]'),
  'reconciliations',coalesce((select jsonb_agg(to_jsonb(v) order by week_start,retailer_name) from public.weekly_reconciliation_summary v where week_start>=p_start and week_start<p_end),'[]'),
  'costTrend',coalesce((select jsonb_agg(to_jsonb(v) order by week_start,variant_name) from public.weekly_cost_per_jar v where week_start>=p_start-35 and week_start<p_end),'[]')
);
$$;

revoke all on all tables in schema public from public;
revoke all on all sequences in schema public from public;
revoke execute on all functions in schema public from public;
revoke execute on all functions in schema private from public;
