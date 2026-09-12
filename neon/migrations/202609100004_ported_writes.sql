-- Business functions ported with explicit concurrency, variant pricing and expiry changes.
create or replace function public.record_production_batch(
  p_variant_id bigint,
  p_batch_code text,
  p_started_at timestamptz,
  p_notes text,
  p_output_quantity integer,
  p_inputs jsonb
)
returns bigint
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_actor_id uuid;
  v_batch_id bigint;
  v_input jsonb;
  v_line_number integer := 0;
  v_inventory_lot_id bigint;
  v_material_id bigint;
  v_quantity_consumed numeric(14, 3);
  v_quantity_remaining numeric(14, 3);
  v_unit_cost numeric(14, 2);
  v_next_remaining numeric(14, 3);
  v_total_input_cost numeric(14, 2) := 0;
  v_output_unit_cost numeric(14, 2);
begin
  v_actor_id := nullif(current_setting('boms.actor_id', true), '')::uuid;

  if v_actor_id is null then
    raise exception 'Authentication is required to create production batches.';
  end if;


  if nullif(btrim(p_batch_code), '') is null then
    raise exception 'A batch code is required.';
  end if;

  if p_output_quantity is null or p_output_quantity <= 0 then
    raise exception 'Output quantity must be greater than zero.';
  end if;

  if p_inputs is null
    or jsonb_typeof(p_inputs) <> 'array'
    or jsonb_array_length(p_inputs) = 0
  then
    raise exception 'At least one production input is required.';
  end if;

  if not exists (
    select 1
    from public.product_variants as variant
    where variant.id = p_variant_id
      and variant.is_active
  ) then
    raise exception 'The selected product variant is not available.';
  end if;

  insert into public.production_batches (
    batch_code,
    variant_id,
    started_at,
    completed_at,
    status,
    notes,
    created_by
  )
  values (
    btrim(p_batch_code),
    p_variant_id,
    coalesce(p_started_at, timezone('utc', now())),
    coalesce(p_started_at, timezone('utc', now())),
    'completed'::public.production_batch_status,
    nullif(btrim(p_notes), ''),
    v_actor_id
  )
  returning id into v_batch_id;

  p_inputs := private.resolve_production_inputs(p_inputs, coalesce(p_started_at, now()));

  for v_input in
    select value
    from jsonb_array_elements(p_inputs) order by (value->>'inventory_lot_id')::bigint
  loop
    v_line_number := v_line_number + 1;
    v_inventory_lot_id := nullif(
      btrim(v_input ->> 'inventory_lot_id'),
      ''
    )::bigint;
    v_quantity_consumed := nullif(
      btrim(v_input ->> 'quantity'),
      ''
    )::numeric(14, 3);

    if v_quantity_consumed is null or v_quantity_consumed <= 0 then
      raise exception 'Production input quantities must be greater than zero.';
    end if;

    select
      lot.material_id,
      lot.quantity_remaining,
      lot.unit_cost
    into
      v_material_id,
      v_quantity_remaining,
      v_unit_cost
    from public.inventory_lots as lot
    where lot.id = v_inventory_lot_id
      and lot.status = 'open'::public.inventory_lot_status and lot.received_at <= coalesce(p_started_at, now())
    for update;

    if not found then
      raise exception 'A selected inventory lot is no longer available.';
    end if;

    if v_quantity_consumed > v_quantity_remaining then
      raise exception 'Cannot consume more material than the lot currently holds.';
    end if;

    v_next_remaining := v_quantity_remaining - v_quantity_consumed;

    update public.inventory_lots
    set
      quantity_remaining = v_next_remaining,
      status = case
        when v_next_remaining = 0
          then 'depleted'::public.inventory_lot_status
        else 'open'::public.inventory_lot_status
      end
    where id = v_inventory_lot_id;

    insert into public.production_inputs (
      production_batch_id,
      line_number,
      inventory_lot_id,
      material_id,
      quantity_consumed,
      unit_cost
    )
    values (
      v_batch_id,
      v_line_number,
      v_inventory_lot_id,
      v_material_id,
      v_quantity_consumed,
      v_unit_cost
    );

    v_total_input_cost := v_total_input_cost
      + round(v_quantity_consumed * v_unit_cost, 2);
  end loop;

  v_output_unit_cost := round(
    v_total_input_cost / p_output_quantity,
    2
  );

  insert into public.production_outputs (
    production_batch_id,
    line_number,
    variant_id,
    quantity_produced,
    quantity_remaining,
    unit_cost
  )
  values (
    v_batch_id,
    1,
    p_variant_id,
    p_output_quantity,
    p_output_quantity,
    v_output_unit_cost
  );

  update public.production_batches
  set
    total_input_cost = v_total_input_cost,
    total_output_quantity = p_output_quantity,
    output_unit_cost = v_output_unit_cost
  where id = v_batch_id;

  return v_batch_id;
end;
$$;
create or replace function public.record_stock_issue(
  p_retailer_id bigint,
  p_issued_at timestamptz,
  p_issue_reference text,
  p_notes text,
  p_items jsonb
)
returns bigint
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_actor_id uuid;
  v_stock_issue_id bigint;
  v_item jsonb;
  v_line_number integer := 0;
  v_production_output_id bigint;
  v_quantity_issued integer;
  v_production_batch_id bigint;
  v_variant_id bigint;
  v_quantity_remaining integer;
  v_unit_cost numeric(14, 2);
  v_next_remaining integer;
  v_stock_issue_item_id bigint;
  v_line_total numeric(14, 2);
  v_total_quantity integer := 0;
  v_total_cost numeric(14, 2) := 0;
begin
  v_actor_id := nullif(current_setting('boms.actor_id', true), '')::uuid;

  if v_actor_id is null then
    raise exception 'Authentication is required to issue stock.';
  end if;


  if p_items is null
    or jsonb_typeof(p_items) <> 'array'
    or jsonb_array_length(p_items) = 0
  then
    raise exception 'At least one finished stock line is required.';
  end if;

  if not exists (
    select 1
    from public.retailers as retailer
    where retailer.id = p_retailer_id
      and retailer.is_active
  ) then
    raise exception 'The selected retailer is not available.';
  end if;

  insert into public.stock_issues (
    retailer_id,
    issue_reference,
    issued_at,
    status,
    total_quantity,
    total_cost,
    notes,
    created_by
  )
  values (
    p_retailer_id,
    nullif(btrim(p_issue_reference), ''),
    coalesce(p_issued_at, timezone('utc', now())),
    'issued',
    0,
    0,
    nullif(btrim(p_notes), ''),
    v_actor_id
  )
  returning id into v_stock_issue_id;

  p_items := private.resolve_issue_inputs(p_items, coalesce(p_issued_at, now()));

  for v_item in
    select value
    from jsonb_array_elements(p_items) order by (value->>'production_output_id')::bigint
  loop
    v_line_number := v_line_number + 1;
    v_production_output_id := nullif(
      btrim(v_item ->> 'production_output_id'),
      ''
    )::bigint;
    v_quantity_issued := nullif(
      btrim(v_item ->> 'quantity'),
      ''
    )::integer;

    if v_quantity_issued is null or v_quantity_issued <= 0 then
      raise exception 'Issued stock quantities must be greater than zero.';
    end if;

    select
      output.production_batch_id,
      output.variant_id,
      output.quantity_remaining,
      output.unit_cost
    into
      v_production_batch_id,
      v_variant_id,
      v_quantity_remaining,
      v_unit_cost
    from public.production_outputs as output
    join public.production_batches as batch
      on batch.id = output.production_batch_id
    where output.id = v_production_output_id
      and batch.status = 'completed' and batch.completed_at <= coalesce(p_issued_at, now()) and (batch.expires_at is null or batch.expires_at >= coalesce(p_issued_at, now())::date)
    for update of output;

    if not found then
      raise exception 'A selected finished stock batch is no longer available.';
    end if;

    if v_quantity_issued > v_quantity_remaining then
      raise exception 'Cannot issue more jars than the selected batch currently holds.';
    end if;

    v_next_remaining := v_quantity_remaining - v_quantity_issued;

    update public.production_outputs
    set quantity_remaining = v_next_remaining
    where id = v_production_output_id;

    insert into public.stock_issue_items (
      stock_issue_id,
      line_number,
      production_output_id,
      production_batch_id,
      variant_id,
      quantity_issued,
      unit_cost,
      notes
    )
    values (
      v_stock_issue_id,
      v_line_number,
      v_production_output_id,
      v_production_batch_id,
      v_variant_id,
      v_quantity_issued,
      v_unit_cost,
      nullif(btrim(v_item ->> 'notes'), '')
    )
    returning id, total_cost
    into v_stock_issue_item_id, v_line_total;

    insert into public.retailer_stock_ledgers (
      retailer_id,
      product_variant_id,
      production_batch_id,
      production_output_id,
      stock_issue_id,
      stock_issue_item_id,
      movement_type,
      quantity_delta,
      unit_cost,
      moved_at,
      notes,
      created_by
    )
    values (
      p_retailer_id,
      v_variant_id,
      v_production_batch_id,
      v_production_output_id,
      v_stock_issue_id,
      v_stock_issue_item_id,
      'issue',
      v_quantity_issued,
      v_unit_cost,
      coalesce(p_issued_at, timezone('utc', now())),
      nullif(btrim(v_item ->> 'notes'), ''),
      v_actor_id
    );

    v_total_quantity := v_total_quantity + v_quantity_issued;
    v_total_cost := v_total_cost + v_line_total;
  end loop;

  update public.stock_issues
  set
    total_quantity = v_total_quantity,
    total_cost = v_total_cost
  where id = v_stock_issue_id;

  return v_stock_issue_id;
end;
$$;
create or replace function public.record_reconciliation(
  p_retailer_id bigint,
  p_reconciled_at timestamptz,
  p_reconciliation_reference text,
  p_notes text,
  p_items jsonb
)
returns bigint
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_actor_id uuid;
  v_reconciliation_id bigint;
  v_item jsonb;
  v_line_number integer := 0;
  v_stock_issue_item_id bigint;
  v_quantity_sold integer;
  v_quantity_returned integer;
  v_quantity_damaged integer;
  v_quantity_expired integer;
  v_quantity_remaining integer;
  v_quantity_accounted_for integer;
  v_stock_issue_id bigint;
  v_source_retailer_id bigint;
  v_production_output_id bigint;
  v_production_batch_id bigint;
  v_variant_id bigint;
  v_quantity_open integer;
  v_unit_cost numeric(14, 2);
  v_unit_price numeric(14, 2);
  v_reconciliation_item_id bigint;
  v_sales_value numeric(14, 2);
  v_returned_value numeric(14, 2);
  v_damaged_value numeric(14, 2);
  v_remaining_value numeric(14, 2);
  v_cogs_value numeric(14, 2);
  v_total_open_quantity integer := 0;
  v_total_sold_quantity integer := 0;
  v_total_returned_quantity integer := 0;
  v_total_damaged_quantity integer := 0;
  v_total_remaining_quantity integer := 0;
  v_total_sales_value numeric(14, 2) := 0;
  v_total_returned_value numeric(14, 2) := 0;
  v_total_damaged_value numeric(14, 2) := 0;
  v_total_remaining_value numeric(14, 2) := 0;
  v_total_cogs_value numeric(14, 2) := 0;
begin
  v_actor_id := nullif(current_setting('boms.actor_id', true), '')::uuid;

  if v_actor_id is null then
    raise exception 'Authentication is required to record reconciliations.';
  end if;


  if p_items is null
    or jsonb_typeof(p_items) <> 'array'
    or jsonb_array_length(p_items) = 0
  then
    raise exception 'At least one open retailer stock line is required.';
  end if;

  if not exists (
    select 1
    from public.retailers as retailer
    where retailer.id = p_retailer_id
      and retailer.is_active
  ) then
    raise exception 'The selected retailer is not available.';
  end if;

  insert into public.reconciliations (
    retailer_id,
    reconciliation_reference,
    reconciled_at,
    notes,
    created_by
  )
  values (
    p_retailer_id,
    nullif(btrim(p_reconciliation_reference), ''),
    coalesce(p_reconciled_at, timezone('utc', now())),
    nullif(btrim(p_notes), ''),
    v_actor_id
  )
  returning id into v_reconciliation_id;

  perform output.id from public.production_outputs output where output.id in
    (select production_output_id from public.stock_issue_items where id in
      (select (value->>'stock_issue_item_id')::bigint from jsonb_array_elements(p_items)))
    order by output.id for update;

  for v_item in
    select value
    from jsonb_array_elements(p_items) order by (value->>'stock_issue_item_id')::bigint
  loop
    v_line_number := v_line_number + 1;
    v_stock_issue_item_id := nullif(
      btrim(v_item ->> 'stock_issue_item_id'),
      ''
    )::bigint;
    v_quantity_sold := coalesce(
      nullif(btrim(v_item ->> 'quantity_sold'), '')::integer,
      0
    );
    v_quantity_returned := coalesce(
      nullif(btrim(v_item ->> 'quantity_returned'), '')::integer,
      0
    );
    v_quantity_damaged := coalesce(
      nullif(btrim(v_item ->> 'quantity_damaged'), '')::integer,
      0
    );
    v_quantity_remaining := coalesce(
      nullif(btrim(v_item ->> 'quantity_remaining'), '')::integer,
      0
    );
    v_quantity_expired := coalesce((v_item->>'quantity_expired')::integer, 0);

    if v_stock_issue_item_id is null then
      raise exception 'Every reconciliation line must reference an issued stock line.';
    end if;

    if v_quantity_sold < 0
      or v_quantity_returned < 0
      or v_quantity_damaged < 0
      or v_quantity_expired < 0
      or v_quantity_remaining < 0
    then
      raise exception 'Reconciliation quantities cannot be negative.';
    end if;

    -- Lock first, then read the ledger in a NEW statement/snapshot. A scalar
    -- ledger subquery in the locking SELECT can see stale data after waiting.
    perform id from public.stock_issue_items where id = v_stock_issue_item_id for update;

    select
      issue_item.stock_issue_id,
      issue.retailer_id,
      issue_item.production_output_id,
      issue_item.production_batch_id,
      issue_item.variant_id,
      coalesce((
        select sum(ledger.quantity_delta)::integer
        from public.retailer_stock_ledgers as ledger
        where ledger.stock_issue_item_id = issue_item.id
      ), 0),
      issue_item.unit_cost
    into
      v_stock_issue_id,
      v_source_retailer_id,
      v_production_output_id,
      v_production_batch_id,
      v_variant_id,
      v_quantity_open,
      v_unit_cost
    from public.stock_issue_items as issue_item
    join public.stock_issues as issue
      on issue.id = issue_item.stock_issue_id
    where issue_item.id = v_stock_issue_item_id
      and issue.status = 'issued' and issue.issued_at <= coalesce(p_reconciled_at, now())
    for update of issue_item;

    if not found then
      raise exception 'A selected retailer stock line is no longer available.';
    end if;

    if v_source_retailer_id <> p_retailer_id then
      raise exception 'A reconciliation line does not belong to the selected retailer.';
    end if;

    if exists (select 1 from public.retailer_stock_ledgers where stock_issue_item_id = v_stock_issue_item_id and moved_at > coalesce(p_reconciled_at, now())) then
      raise exception 'Reconciliation date cannot precede the latest movement for this line.';
    end if;
    select unit_price into v_unit_price from public.pricing
      where variant_id = v_variant_id and effective_from <= coalesce(p_reconciled_at, now())
      order by effective_from desc limit 1;
    if v_unit_price is null then raise exception 'Set a variant price effective on the reconciliation date first.'; end if;
    if v_quantity_returned > 0 and exists (select 1 from public.production_batches where id = v_production_batch_id and expires_at < coalesce(p_reconciled_at, now())::date) then
      raise exception 'Expired stock must be recorded as expired, not restocked.';
    end if;
    if v_quantity_returned + v_quantity_damaged + v_quantity_expired > 0 and nullif(btrim(v_item->>'return_reason'), '') is null then
      raise exception 'A reason is required for returned, damaged or expired stock.';
    end if;
    if v_quantity_open <= 0 then
      raise exception 'A selected retailer stock line no longer has open quantity to reconcile.';
    end if;

    v_quantity_accounted_for := v_quantity_sold
      + v_quantity_returned
      + v_quantity_damaged
      + v_quantity_expired
      + v_quantity_remaining;

    if v_quantity_accounted_for <> v_quantity_open then
      raise exception 'Each reconciliation line must fully explain the retailer stock currently on hand.';
    end if;

    insert into public.reconciliation_items (
      reconciliation_id,
      line_number,
      stock_issue_id,
      stock_issue_item_id,
      production_output_id,
      production_batch_id,
      variant_id,
      quantity_open,
      quantity_sold,
      quantity_returned,
      quantity_damaged,
      quantity_expired,
      quantity_remaining,
      unit_cost,
      unit_price,
      notes
    )
    values (
      v_reconciliation_id,
      v_line_number,
      v_stock_issue_id,
      v_stock_issue_item_id,
      v_production_output_id,
      v_production_batch_id,
      v_variant_id,
      v_quantity_open,
      v_quantity_sold,
      v_quantity_returned,
      v_quantity_damaged,
      v_quantity_expired,
      v_quantity_remaining,
      v_unit_cost,
      v_unit_price,
      nullif(btrim(v_item ->> 'notes'), '')
    )
    returning
      id,
      sales_value,
      returned_value,
      damaged_value,
      remaining_value,
      cogs_value
    into
      v_reconciliation_item_id,
      v_sales_value,
      v_returned_value,
      v_damaged_value,
      v_remaining_value,
      v_cogs_value;

    if v_quantity_sold > 0 then
      insert into public.retailer_stock_ledgers (
        retailer_id,
        product_variant_id,
        production_batch_id,
        production_output_id,
        stock_issue_id,
        stock_issue_item_id,
        reconciliation_id,
        reconciliation_item_id,
        movement_type,
        quantity_delta,
        unit_cost,
        moved_at,
        notes,
        created_by
      )
      values (
        p_retailer_id,
        v_variant_id,
        v_production_batch_id,
        v_production_output_id,
        v_stock_issue_id,
        v_stock_issue_item_id,
        v_reconciliation_id,
        v_reconciliation_item_id,
        'reconciliation_sale',
        -v_quantity_sold,
        v_unit_cost,
        coalesce(p_reconciled_at, timezone('utc', now())),
        nullif(btrim(v_item ->> 'notes'), ''),
        v_actor_id
      );
    end if;

    if v_quantity_returned > 0 then
      insert into public.retailer_stock_ledgers (
        retailer_id,
        product_variant_id,
        production_batch_id,
        production_output_id,
        stock_issue_id,
        stock_issue_item_id,
        reconciliation_id,
        reconciliation_item_id,
        movement_type,
        quantity_delta,
        unit_cost,
        moved_at,
        notes,
        created_by
      )
      values (
        p_retailer_id,
        v_variant_id,
        v_production_batch_id,
        v_production_output_id,
        v_stock_issue_id,
        v_stock_issue_item_id,
        v_reconciliation_id,
        v_reconciliation_item_id,
        'return_to_warehouse',
        -v_quantity_returned,
        v_unit_cost,
        coalesce(p_reconciled_at, timezone('utc', now())),
        nullif(btrim(v_item ->> 'notes'), ''),
        v_actor_id
      );

      perform id from public.production_outputs where id = v_production_output_id for update;
      update public.production_outputs
      set quantity_remaining = quantity_remaining + v_quantity_returned
      where id = v_production_output_id;
    end if;

    if v_quantity_damaged > 0 then
      insert into public.retailer_stock_ledgers (
        retailer_id,
        product_variant_id,
        production_batch_id,
        production_output_id,
        stock_issue_id,
        stock_issue_item_id,
        reconciliation_id,
        reconciliation_item_id,
        movement_type,
        quantity_delta,
        unit_cost,
        moved_at,
        notes,
        created_by
      )
      values (
        p_retailer_id,
        v_variant_id,
        v_production_batch_id,
        v_production_output_id,
        v_stock_issue_id,
        v_stock_issue_item_id,
        v_reconciliation_id,
        v_reconciliation_item_id,
        'damage',
        -v_quantity_damaged,
        v_unit_cost,
        coalesce(p_reconciled_at, timezone('utc', now())),
        nullif(btrim(v_item ->> 'notes'), ''),
        v_actor_id
      );
    end if;

    if v_quantity_expired > 0 then
      insert into public.retailer_stock_ledgers(retailer_id, product_variant_id, production_batch_id, production_output_id, stock_issue_id, stock_issue_item_id, reconciliation_id, reconciliation_item_id, movement_type, quantity_delta, unit_cost, moved_at, notes, created_by)
      values (p_retailer_id, v_variant_id, v_production_batch_id, v_production_output_id, v_stock_issue_id, v_stock_issue_item_id, v_reconciliation_id, v_reconciliation_item_id, 'expiry', -v_quantity_expired, v_unit_cost, coalesce(p_reconciled_at, now()), v_item->>'return_reason', v_actor_id);
    end if;
    insert into public.returns(reconciliation_item_id, production_batch_id, retailer_id, quantity, reason, condition, disposition)
    select v_reconciliation_item_id, v_production_batch_id, p_retailer_id, qty, v_item->>'return_reason', condition, disposition
    from (values (v_quantity_returned, 'good', 'restock'), (v_quantity_damaged, 'damaged', 'write_off'), (v_quantity_expired, 'expired', 'write_off')) as outcomes(qty, condition, disposition) where qty > 0;
    update public.reconciliations set total_expired_quantity = total_expired_quantity + v_quantity_expired,
      total_expired_value = total_expired_value + round(v_quantity_expired * v_unit_price,2) where id = v_reconciliation_id;

    v_total_open_quantity := v_total_open_quantity + v_quantity_open;
    v_total_sold_quantity := v_total_sold_quantity + v_quantity_sold;
    v_total_returned_quantity := v_total_returned_quantity + v_quantity_returned;
    v_total_damaged_quantity := v_total_damaged_quantity + v_quantity_damaged;
    v_total_remaining_quantity := v_total_remaining_quantity + v_quantity_remaining;
    v_total_sales_value := v_total_sales_value + v_sales_value;
    v_total_returned_value := v_total_returned_value + v_returned_value;
    v_total_damaged_value := v_total_damaged_value + v_damaged_value;
    v_total_remaining_value := v_total_remaining_value + v_remaining_value;
    v_total_cogs_value := v_total_cogs_value + v_cogs_value;
  end loop;

  update public.reconciliations
  set
    total_open_quantity = v_total_open_quantity,
    total_sold_quantity = v_total_sold_quantity,
    total_returned_quantity = v_total_returned_quantity,
    total_damaged_quantity = v_total_damaged_quantity,
    total_remaining_quantity = v_total_remaining_quantity,
    total_sales_value = v_total_sales_value,
    total_returned_value = v_total_returned_value,
    total_damaged_value = v_total_damaged_value,
    total_remaining_value = v_total_remaining_value,
    total_cogs_value = v_total_cogs_value
  where id = v_reconciliation_id;

  return v_reconciliation_id;
end;
$$;
revoke execute on all functions in schema public from public;
