do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'suppliers_supplier_name_key'
      and conrelid = 'public.suppliers'::regclass
  ) then
    alter table public.suppliers
    add constraint suppliers_supplier_name_key unique (supplier_name);
  end if;
end $$;

grant all on
  public.products,
  public.product_variants,
  public.materials,
  public.suppliers,
  public.purchases,
  public.purchase_items,
  public.inventory_lots,
  public.production_batches,
  public.production_inputs,
  public.production_outputs
to service_role;

grant usage, select on sequence public.products_id_seq to service_role;
grant usage, select on sequence public.product_variants_id_seq to service_role;
grant usage, select on sequence public.materials_id_seq to service_role;
grant usage, select on sequence public.suppliers_id_seq to service_role;
grant usage, select on sequence public.purchases_id_seq to service_role;
grant usage, select on sequence public.purchase_items_id_seq to service_role;
grant usage, select on sequence public.inventory_lots_id_seq to service_role;
grant usage, select on sequence public.production_batches_id_seq to service_role;
grant usage, select on sequence public.production_inputs_id_seq to service_role;
grant usage, select on sequence public.production_outputs_id_seq to service_role;
