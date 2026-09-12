create view public.weekly_stock_movement_summary as
select date_trunc('week',p.purchased_at at time zone 'Africa/Kampala')::date week_start,
  'received'::text movement,m.name item,m.unit_of_measure unit,sum(i.quantity) quantity,sum(i.line_total) value
from public.purchases p join public.purchase_items i on i.purchase_id=p.id join public.materials m on m.id=i.material_id
where p.status='received' group by 1,2,3,4
union all
select date_trunc('week',b.completed_at at time zone 'Africa/Kampala')::date,'produced',v.variant_name,'jars',sum(b.total_output_quantity),sum(b.total_input_cost)
from public.production_batches b join public.product_variants v on v.id=b.variant_id where b.status='completed' group by 1,2,3,4
union all
select date_trunc('week',s.issued_at at time zone 'Africa/Kampala')::date,'issued',v.variant_name,'jars',sum(i.quantity_issued),sum(i.total_cost)
from public.stock_issues s join public.stock_issue_items i on i.stock_issue_id=s.id join public.product_variants v on v.id=i.variant_id where s.status='issued' group by 1,2,3,4;

create view public.weekly_reconciliation_summary as
select date_trunc('week',c.reconciled_at at time zone 'Africa/Kampala')::date week_start,c.retailer_id,r.retailer_name,
  sum(c.total_sold_quantity) sold,sum(c.total_returned_quantity) returned,sum(c.total_damaged_quantity) damaged,
  sum(c.total_expired_quantity) expired,sum(c.total_sales_value) liability
from public.reconciliations c join public.retailers r on r.id=c.retailer_id group by 1,2,3;

create view public.weekly_cost_per_jar as
select date_trunc('week',b.completed_at at time zone 'Africa/Kampala')::date week_start,b.variant_id,v.variant_name,
  sum(b.total_output_quantity) jars,sum(b.total_input_cost) input_cost,
  round(sum(b.total_input_cost)/nullif(sum(b.total_output_quantity),0),2) cost_per_jar
from public.production_batches b join public.product_variants v on v.id=b.variant_id where b.status='completed' group by 1,2,3;

create function public.retailer_aging_at(p_end timestamptz)
returns table(retailer_id bigint,retailer_name text,liability numeric,remitted numeric,outstanding numeric,age_0_7 numeric,age_8_30 numeric,age_31_60 numeric,age_61_plus numeric,oldest_unpaid_at timestamptz)
language sql stable set search_path = '' as $$
with payments as (
  select retailer_id,sum(amount) total from public.remittances where received_at < p_end group by retailer_id
), invoices as (
  select c.id,c.retailer_id,c.reconciled_at,c.total_sales_value,
    sum(c.total_sales_value) over(partition by c.retailer_id order by c.reconciled_at,c.id) cumulative
  from public.reconciliations c where c.reconciled_at < p_end
), residuals as (
  -- Aging uses oldest-liability-first cash allocation. Period links are references;
  -- they do not change the charter's retailer-wide liability minus cash balance.
  select i.*,greatest(0,least(i.total_sales_value,i.cumulative-coalesce(p.total,0))) unpaid,
    (p_end::date-i.reconciled_at::date) age
  from invoices i left join payments p on p.retailer_id=i.retailer_id
), totals as (
  select retailer_id,sum(total_sales_value) liability,
    coalesce(sum(unpaid) filter(where age<=7),0) age_0_7,
    coalesce(sum(unpaid) filter(where age between 8 and 30),0) age_8_30,
    coalesce(sum(unpaid) filter(where age between 31 and 60),0) age_31_60,
    coalesce(sum(unpaid) filter(where age>60),0) age_61_plus,
    min(reconciled_at) filter(where unpaid>0) oldest_unpaid_at
  from residuals group by retailer_id
)
select r.id,r.retailer_name,coalesce(t.liability,0),coalesce(p.total,0),coalesce(t.liability,0)-coalesce(p.total,0),
  coalesce(t.age_0_7,0),coalesce(t.age_8_30,0),coalesce(t.age_31_60,0),coalesce(t.age_61_plus,0),t.oldest_unpaid_at
from public.retailers r left join totals t on t.retailer_id=r.id left join payments p on p.retailer_id=r.id
where r.is_active or t.liability is not null or p.total is not null order by 5 desc,r.retailer_name;
$$;
create view public.retailer_aging as select * from public.retailer_aging_at(now());

create function public.inventory_valuation_at(p_end timestamptz)
returns table(category text,value numeric) language sql stable set search_path = '' as $$
with consumed as (
  select i.inventory_lot_id,sum(i.quantity_consumed) quantity from public.production_inputs i
  join public.production_batches b on b.id=i.production_batch_id where b.status='completed' and b.completed_at<p_end group by i.inventory_lot_id
), recognized as (
  select production_output_id,-sum(quantity_delta) quantity from public.retailer_stock_ledgers
  where moved_at<p_end and movement_type in ('reconciliation_sale','damage','expiry') group by production_output_id
)
select m.kind::text,round(sum((l.quantity_received-coalesce(c.quantity,0))*l.unit_cost),2)
from public.inventory_lots l join public.materials m on m.id=l.material_id left join consumed c on c.inventory_lot_id=l.id
where l.received_at<p_end group by m.kind
union all
select 'finished_goods_including_consignment',coalesce(round(sum((o.quantity_produced-coalesce(r.quantity,0))*o.unit_cost),2),0)
from public.production_outputs o join public.production_batches b on b.id=o.production_batch_id left join recognized r on r.production_output_id=o.id
where b.status='completed' and b.completed_at<p_end;
$$;

create function public.stock_digest_at(p_end timestamptz)
returns jsonb language sql stable set search_path = '' as $$
with material_balances as (
  select m.id,m.name,m.unit_of_measure,m.low_stock_threshold,
    coalesce((select sum(l.quantity_received) from public.inventory_lots l where l.material_id=m.id and l.received_at<p_end),0)
    -coalesce((select sum(i.quantity_consumed) from public.production_inputs i join public.production_batches b on b.id=i.production_batch_id where i.material_id=m.id and b.completed_at<p_end and b.status='completed'),0) quantity
  from public.materials m where m.is_active
), warehouse_balances as (
  select o.id,b.batch_code,b.expires_at,v.variant_name,o.variant_id,
    o.quantity_produced-coalesce((select sum(i.quantity_issued) from public.stock_issue_items i join public.stock_issues s on s.id=i.stock_issue_id where i.production_output_id=o.id and s.issued_at<p_end and s.status='issued'),0)
      -coalesce((select sum(l.quantity_delta) from public.retailer_stock_ledgers l where l.production_output_id=o.id and l.movement_type='return_to_warehouse' and l.moved_at<p_end),0) quantity
  from public.production_outputs o join public.production_batches b on b.id=o.production_batch_id join public.product_variants v on v.id=o.variant_id
  where b.status='completed' and b.completed_at<p_end
), variant_balances as (
  select v.id,v.variant_name,v.low_stock_threshold,coalesce(sum(w.quantity),0) quantity from public.product_variants v left join warehouse_balances w on w.variant_id=v.id where v.is_active group by v.id
), owned_balances as (
  select o.id,b.batch_code,b.expires_at,v.variant_name,
    o.quantity_produced+coalesce((select sum(l.quantity_delta) from public.retailer_stock_ledgers l where l.production_output_id=o.id and l.moved_at<p_end and l.movement_type in ('reconciliation_sale','damage','expiry')),0) quantity
  from public.production_outputs o join public.production_batches b on b.id=o.production_batch_id join public.product_variants v on v.id=o.variant_id where b.completed_at<p_end and b.status='completed'
)
select jsonb_build_object(
  'materials',coalesce((select jsonb_agg(to_jsonb(m)) from material_balances m where quantity<=low_stock_threshold),'[]'),
  'variants',coalesce((select jsonb_agg(to_jsonb(v)) from variant_balances v where quantity<=low_stock_threshold),'[]'),
  'expiring',coalesce((select jsonb_agg(to_jsonb(w) order by expires_at nulls last) from owned_balances w where quantity>0 and (expires_at is null or expires_at<=p_end::date+30)),'[]')
);
$$;

create function public.business_report(p_start date,p_end date)
returns jsonb language sql stable set search_path = '' as $$
with bounds as (select p_start::timestamp at time zone 'Africa/Kampala' a,p_end::timestamp at time zone 'Africa/Kampala' b),
sales as (
  select coalesce(sum(c.total_sales_value),0) revenue,coalesce(sum(c.total_cogs_value),0) cogs
  from public.reconciliations c,bounds where c.reconciled_at>=a and c.reconciled_at<b
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
  'profit', (select jsonb_build_object('revenue',revenue,'cogs',cogs,'gross_profit',revenue-cogs,'gross_margin',round(100*(revenue-cogs)/nullif(revenue,0),2),'operating_expenses',expenses,'net_profit',revenue-cogs-expenses) from sales cross join costs),
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
revoke execute on all functions in schema public from public;
