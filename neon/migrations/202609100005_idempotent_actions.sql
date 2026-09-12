create function public.execute_idempotent(p_key uuid, p_endpoint text, p_hash text, p_body jsonb)
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
    when 'stock-issues' then record_id := public.record_stock_issue((p_body->>'retailerId')::bigint,(p_body->>'issuedAt')::timestamptz,p_body->>'issueReference',p_body->>'notes',p_body->'items');
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
revoke execute on function public.execute_idempotent(uuid,text,text,jsonb) from public;
