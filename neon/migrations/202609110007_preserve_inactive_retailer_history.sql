-- Deactivation must never erase stock or financial history from totals.
create or replace view public.retailer_issue_open_balances
with (security_invoker = true)
as
with line_balances as (
  select
    ledger.retailer_id,
    ledger.stock_issue_id,
    ledger.stock_issue_item_id,
    ledger.production_output_id,
    ledger.production_batch_id,
    ledger.product_variant_id as variant_id,
    sum(ledger.quantity_delta)::integer as quantity_open
  from public.retailer_stock_ledgers as ledger
  where ledger.stock_issue_item_id is not null
  group by
    ledger.retailer_id,
    ledger.stock_issue_id,
    ledger.stock_issue_item_id,
    ledger.production_output_id,
    ledger.production_batch_id,
    ledger.product_variant_id
)
select
  balance.retailer_id,
  retailer.retailer_name,
  retailer.delivery_location,
  balance.stock_issue_id,
  balance.stock_issue_item_id,
  issue.issue_reference,
  issue.issued_at,
  balance.production_output_id,
  balance.production_batch_id,
  batch.batch_code,
  balance.variant_id,
  variant.sku,
  variant.variant_name,
  issue_item.quantity_issued as original_quantity_issued,
  balance.quantity_open,
  issue_item.unit_cost,
  round(balance.quantity_open * issue_item.unit_cost, 2) as open_stock_value
from line_balances as balance
join public.retailers as retailer
  on retailer.id = balance.retailer_id
join public.stock_issues as issue
  on issue.id = balance.stock_issue_id
join public.stock_issue_items as issue_item
  on issue_item.id = balance.stock_issue_item_id
join public.production_batches as batch
  on batch.id = balance.production_batch_id
join public.product_variants as variant
  on variant.id = balance.variant_id
where issue.status = 'issued'
  and balance.quantity_open > 0
order by issue.issued_at asc, balance.stock_issue_item_id asc;

create or replace view public.retailer_outstanding_balances
with (security_invoker = true)
as
with issue_totals as (
  select
    ledger.retailer_id,
    coalesce(
      sum(
        case
          when ledger.movement_type = 'issue' then ledger.quantity_delta
          else 0
        end
      ),
      0
    )::integer as issued_quantity
  from public.retailer_stock_ledgers as ledger
  group by ledger.retailer_id
),
reconciliation_totals as (
  select
    reconciliation.retailer_id,
    count(distinct reconciliation.id)::integer as reconciliation_count,
    max(reconciliation.reconciled_at) as last_reconciled_at,
    coalesce(sum(item.quantity_sold), 0)::integer as sold_quantity,
    coalesce(sum(item.quantity_returned), 0)::integer as returned_quantity,
    coalesce(sum(item.quantity_damaged), 0)::integer as damaged_quantity,
    coalesce(sum(item.sales_value), 0)::numeric(14, 2) as recognized_sales_value,
    coalesce(sum(item.cogs_value), 0)::numeric(14, 2) as cost_of_goods_sold
  from public.reconciliations as reconciliation
  join public.reconciliation_items as item
    on item.reconciliation_id = reconciliation.id
  group by reconciliation.retailer_id
),
open_totals as (
  select
    open_balance.retailer_id,
    coalesce(sum(open_balance.quantity_open), 0)::integer as remaining_quantity
  from public.retailer_issue_open_balances as open_balance
  group by open_balance.retailer_id
),
remittance_totals as (
  select
    remittance.retailer_id,
    count(*)::integer as remittance_count,
    max(remittance.received_at) as last_remitted_at,
    coalesce(sum(remittance.amount), 0)::numeric(14, 2) as remitted_amount
  from public.remittances as remittance
  group by remittance.retailer_id
)
select
  retailer.id as retailer_id,
  retailer.retailer_name,
  retailer.delivery_location,
  coalesce(issue_totals.issued_quantity, 0) as issued_quantity,
  coalesce(reconciliation_totals.reconciliation_count, 0) as reconciliation_count,
  coalesce(remittance_totals.remittance_count, 0) as remittance_count,
  coalesce(reconciliation_totals.sold_quantity, 0) as sold_quantity,
  coalesce(reconciliation_totals.returned_quantity, 0) as returned_quantity,
  coalesce(reconciliation_totals.damaged_quantity, 0) as damaged_quantity,
  coalesce(open_totals.remaining_quantity, 0) as remaining_quantity,
  coalesce(reconciliation_totals.recognized_sales_value, 0)::numeric(14, 2)
    as recognized_sales_value,
  coalesce(reconciliation_totals.cost_of_goods_sold, 0)::numeric(14, 2)
    as cost_of_goods_sold,
  round(
    coalesce(reconciliation_totals.recognized_sales_value, 0)
    - coalesce(reconciliation_totals.cost_of_goods_sold, 0),
    2
  ) as gross_profit,
  coalesce(remittance_totals.remitted_amount, 0)::numeric(14, 2)
    as remitted_amount,
  round(
    coalesce(reconciliation_totals.recognized_sales_value, 0)
    - coalesce(remittance_totals.remitted_amount, 0),
    2
  ) as outstanding_amount,
  reconciliation_totals.last_reconciled_at,
  remittance_totals.last_remitted_at
from public.retailers as retailer
left join issue_totals
  on issue_totals.retailer_id = retailer.id
left join reconciliation_totals
  on reconciliation_totals.retailer_id = retailer.id
left join open_totals
  on open_totals.retailer_id = retailer.id
left join remittance_totals
  on remittance_totals.retailer_id = retailer.id
order by outstanding_amount desc, retailer.retailer_name asc;

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
expense_totals as (
  select
    count(*)::integer as expense_count,
    coalesce(sum(expense.amount), 0)::numeric(14, 2) as operating_expenses
  from public.expenses as expense
)
select
  retailer_totals.active_retailers,
  retailer_totals.issued_quantity,
  retailer_totals.sold_quantity,
  retailer_totals.returned_quantity,
  retailer_totals.damaged_quantity,
  retailer_totals.remaining_quantity,
  retailer_totals.recognized_sales_value,
  retailer_totals.cost_of_goods_sold,
  retailer_totals.gross_profit,
  expense_totals.expense_count,
  expense_totals.operating_expenses,
  round(
    retailer_totals.gross_profit - expense_totals.operating_expenses,
    2
  ) as net_profit,
  retailer_totals.remitted_amount,
  retailer_totals.outstanding_amount
from retailer_totals
cross join expense_totals;

