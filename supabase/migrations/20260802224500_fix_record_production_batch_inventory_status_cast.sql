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
security definer
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
  v_actor_id := (select auth.uid());

  if v_actor_id is null then
    raise exception 'Authentication is required to create production batches.';
  end if;

  if not (
    select private.current_user_has_any_role(
      array[
        'admin_owner',
        'operations_manager',
        'production_staff'
      ]::public.app_role[]
    )
  ) then
    raise exception 'You do not have permission to create production batches.';
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

  for v_input in
    select value
    from jsonb_array_elements(p_inputs)
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
      and lot.status = 'open'::public.inventory_lot_status
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

grant execute on function public.record_production_batch(
  bigint,
  text,
  timestamptz,
  text,
  integer,
  jsonb
)
to authenticated;
