-- Resolve editable material/variant defaults into traceable physical lots inside
-- the same handler transaction. Explicit selections wait; FIFO skips held rows.
create function private.resolve_production_inputs(p_inputs jsonb, p_at timestamptz)
returns jsonb language plpgsql set search_path = '' as $$
declare item jsonb; lot record; needed numeric; available numeric; take numeric;
  result jsonb := '[]'::jsonb;
begin
  perform id from public.inventory_lots where id in
    (select (value->>'inventory_lot_id')::bigint from jsonb_array_elements(p_inputs))
    order by id for update;
  for item in select value from jsonb_array_elements(p_inputs) order by value->>'inventory_lot_id' nulls last, value->>'material_id' loop
    needed := (item->>'quantity')::numeric;
    if needed is null or needed <= 0 or needed <> round(needed,3) then raise exception 'Input quantity must be positive with at most three decimal places.'; end if;
    if item->>'inventory_lot_id' is not null then
      result := result || jsonb_build_array(item);
    else
      for lot in select * from public.inventory_lots where material_id = (item->>'material_id')::bigint
        and status = 'open' and quantity_remaining > 0 and received_at <= p_at
        order by received_at, id for update skip locked loop
        select lot.quantity_remaining - coalesce(sum((value->>'quantity')::numeric),0) into available
          from jsonb_array_elements(result) where (value->>'inventory_lot_id')::bigint = lot.id;
        take := least(needed, greatest(available,0));
        if take > 0 then
          result := result || jsonb_build_array(jsonb_build_object('inventory_lot_id',lot.id,'quantity',take));
          needed := needed - take;
        end if;
        exit when needed = 0;
      end loop;
      if needed > 0 then raise exception 'Insufficient unlocked material stock; refresh or retry shortly.'; end if;
    end if;
  end loop;
  return result;
end; $$;

create function private.resolve_issue_inputs(p_items jsonb, p_at timestamptz)
returns jsonb language plpgsql set search_path = '' as $$
declare item jsonb; lot record; needed integer; available integer; take integer;
  result jsonb := '[]'::jsonb;
begin
  perform id from public.production_outputs where id in
    (select (value->>'production_output_id')::bigint from jsonb_array_elements(p_items))
    order by id for update;
  for item in select value from jsonb_array_elements(p_items) order by value->>'production_output_id' nulls last, value->>'variant_id' loop
    needed := (item->>'quantity')::integer;
    if needed is null or needed <= 0 then raise exception 'Issue quantity must be a positive whole number.'; end if;
    if item->>'production_output_id' is not null then
      result := result || jsonb_build_array(item);
    else
      for lot in select output.* from public.production_outputs output join public.production_batches batch on batch.id = output.production_batch_id
        where output.variant_id = (item->>'variant_id')::bigint and output.quantity_remaining > 0
        and batch.status = 'completed' and batch.completed_at <= p_at and (batch.expires_at is null or batch.expires_at >= p_at::date)
        order by batch.completed_at, output.id for update of output skip locked loop
        select lot.quantity_remaining - coalesce(sum((value->>'quantity')::integer),0) into available
          from jsonb_array_elements(result) where (value->>'production_output_id')::bigint = lot.id;
        take := least(needed,greatest(available,0));
        if take > 0 then
          result := result || jsonb_build_array(jsonb_build_object('production_output_id',lot.id,'quantity',take,'notes',item->>'notes'));
          needed := needed - take;
        end if;
        exit when needed = 0;
      end loop;
      if needed > 0 then raise exception 'Insufficient unlocked finished stock; refresh or retry shortly.'; end if;
    end if;
  end loop;
  return result;
end; $$;
revoke execute on all functions in schema private from public;
