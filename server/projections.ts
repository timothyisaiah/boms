import { ALL_ROLES, SUPPLY, RETAIL, REVIEW, FINANCE } from './auth.js'

// These are static, allowlisted SQL projections. No browser-supplied table names,
// joins, roles or SQL fragments enter a query. Nested shapes preserve the Vue UI.
const variant = `(select to_jsonb(v)||jsonb_build_object('product',to_jsonb(p)) from product_variants v join products p on p.id=v.product_id where v.id=t.variant_id)`
const batch = `(select to_jsonb(b) from production_batches b where b.id=t.production_batch_id)`
export const retailer = `(select to_jsonb(r) from retailers r where r.id=t.retailer_id)`
const supplier = `(select to_jsonb(s) from suppliers s where s.id=t.supplier_id)`

// History collections are split into data/from/order parts so the paginated
// history endpoint and the full workspace read share one projection. Joining the
// parts reproduces the original workspace SQL exactly.
export const historySources = {
  purchases: {
    data: `to_jsonb(t)||jsonb_build_object('supplier',${supplier},'items',coalesce((select jsonb_agg(to_jsonb(i)||jsonb_build_object('material',to_jsonb(m)) order by i.line_number) from purchase_items i join materials m on m.id=i.material_id where i.purchase_id=t.id),'[]'))`,
    from: `purchases t`,
    order: `purchased_at desc,id desc`
  },
  batches: {
    data: `to_jsonb(t)||jsonb_build_object('variant',${variant},'inputs',coalesce((select jsonb_agg(to_jsonb(i)||jsonb_build_object('material',to_jsonb(m),'lot',to_jsonb(l)) order by i.line_number) from production_inputs i join materials m on m.id=i.material_id join inventory_lots l on l.id=i.inventory_lot_id where i.production_batch_id=t.id),'[]'),'outputs',coalesce((select jsonb_agg(to_jsonb(o) order by o.line_number) from production_outputs o where o.production_batch_id=t.id),'[]'))`,
    from: `production_batches t`,
    order: `started_at desc,t.id desc`
  },
  stockIssues: {
    data: `to_jsonb(t)||jsonb_build_object('retailer',${retailer},'items',coalesce((select jsonb_agg(to_jsonb(i)||jsonb_build_object('batch',to_jsonb(b),'variant',to_jsonb(v)) order by i.line_number) from stock_issue_items i join production_batches b on b.id=i.production_batch_id join product_variants v on v.id=i.variant_id where i.stock_issue_id=t.id),'[]'))`,
    from: `stock_issues t`,
    order: `issued_at desc,t.id desc`
  },
  retailerMovements: {
    data: `to_jsonb(t)||jsonb_build_object('retailer',${retailer},'batch',${batch},'variant',to_jsonb(v))`,
    from: `retailer_stock_ledgers t join product_variants v on v.id=t.product_variant_id`,
    order: `moved_at desc,t.id desc`
  },
  reconciliations: {
    data: `to_jsonb(t)||jsonb_build_object('retailer',${retailer},'items',coalesce((select jsonb_agg(to_jsonb(i)||jsonb_build_object('batch',to_jsonb(b),'variant',to_jsonb(v)) order by i.line_number) from reconciliation_items i join production_batches b on b.id=i.production_batch_id join product_variants v on v.id=i.variant_id where i.reconciliation_id=t.id),'[]'))`,
    from: `reconciliations t`,
    order: `reconciled_at desc,t.id desc`
  },
  remittances: {
    data: `to_jsonb(t)||jsonb_build_object('retailer',${retailer},'reconciliation',(select to_jsonb(r) from reconciliations r where r.id=t.reconciliation_id))`,
    from: `remittances t`,
    order: `received_at desc,t.id desc`
  },
  expenses: {
    data: `to_jsonb(t)`,
    from: `expenses t`,
    order: `incurred_at desc,t.id desc`
  }
} as const
export type HistoryResource = keyof typeof historySources
export const HISTORY_RESOURCES = Object.keys(
  historySources
) as HistoryResource[]
const full = (key: HistoryResource) =>
  `select ${historySources[key].data} data from ${historySources[key].from} order by ${historySources[key].order}`

export const projections = {
  variants: `select to_jsonb(t)||jsonb_build_object('product',to_jsonb(p),'current_price',c.unit_price) data from product_variants t join products p on p.id=t.product_id left join current_variant_prices c on c.variant_id=t.id where t.is_active order by t.pack_size_grams`,
  materials: `select to_jsonb(t) data from materials t where is_active order by kind,name`,
  suppliers: `select to_jsonb(t) data from suppliers t where is_active order by supplier_name`,
  purchases: full('purchases'),
  inventoryLots: `select to_jsonb(t)||jsonb_build_object('supplier',${supplier},'material',to_jsonb(m)) data from inventory_lots t join materials m on m.id=t.material_id where t.status='open' order by received_at,t.id`,
  batches: full('batches'),
  productionOutputs: `select to_jsonb(t)||jsonb_build_object('variant',${variant},'batch',${batch}) data from production_outputs t where t.quantity_remaining>0 order by t.created_at,t.id`,
  retailers: `select to_jsonb(t) data from retailers t where is_active order by retailer_name`,
  stockIssues: full('stockIssues'),
  retailerMovements: full('retailerMovements'),
  openIssueLines: `select to_jsonb(t)||jsonb_build_object('unit_price',c.unit_price) data from retailer_issue_open_balances t left join current_variant_prices c on c.variant_id=t.variant_id order by t.issued_at,t.stock_issue_item_id`,
  reconciliations: full('reconciliations'),
  remittances: full('remittances'),
  expenses: full('expenses'),
  // Consignment stock earns nothing until sold, so its shelf value is shown
  // separately: at cost and at today's selling price.
  retailerBalances: `select to_jsonb(t)||jsonb_build_object('stock_cost',coalesce(o.cost,0),'stock_value',coalesce(o.value,0)) data from retailer_outstanding_balances t left join (select t.retailer_id,sum(t.open_stock_value) cost,sum(t.quantity_open*coalesce(c.unit_price,0)) value from retailer_issue_open_balances t left join current_variant_prices c on c.variant_id=t.variant_id group by t.retailer_id) o on o.retailer_id=t.retailer_id order by t.outstanding_amount desc,t.remaining_quantity desc,t.retailer_name`,
  profitSummary: `select to_jsonb(t)||jsonb_build_object('stock_at_retailers_cost',(select coalesce(sum(cost),0) from (select t.retailer_id,sum(t.open_stock_value) cost,sum(t.quantity_open*coalesce(c.unit_price,0)) value from retailer_issue_open_balances t left join current_variant_prices c on c.variant_id=t.variant_id group by t.retailer_id) o),'stock_at_retailers_value',(select coalesce(sum(value),0) from (select t.retailer_id,sum(t.open_stock_value) cost,sum(t.quantity_open*coalesce(c.unit_price,0)) value from retailer_issue_open_balances t left join current_variant_prices c on c.variant_id=t.variant_id group by t.retailer_id) o)) data from finance_profit_summary t`,
  recipes: `select to_jsonb(t)||jsonb_build_object('items',coalesce((select jsonb_agg(to_jsonb(i)||jsonb_build_object('material',to_jsonb(m)) order by i.id) from production_recipe_items i join materials m on m.id=i.material_id where i.recipe_id=t.id),'[]')) data from production_recipes t order by t.id`,
  pricing: `select to_jsonb(t) data from pricing t order by effective_from desc,id desc`,
  // Simple operations (home): bounded per-material and per-variant totals.
  materialStock: `select to_jsonb(t)||jsonb_build_object('on_hand',coalesce((select sum(l.quantity_remaining) from inventory_lots l where l.material_id=t.id and l.status='open'),0)) data from materials t where t.is_active order by t.kind,t.name`,
  finishedByVariant: `select jsonb_build_object('variant_id',o.variant_id,'quantity',sum(o.quantity_remaining)::int) data from production_outputs o join production_batches b on b.id=o.production_batch_id where b.status='completed' and o.quantity_remaining>0 and (b.expires_at is null or b.expires_at>=current_date) group by o.variant_id`,
  directSales: `select to_jsonb(t) data from direct_sales t order by sold_at desc,id desc`,
  retailerHoldings: `select jsonb_build_object('retailer_id',t.retailer_id,'variant_id',t.variant_id,'quantity',sum(t.quantity_open)::int,'unit_price',max(c.unit_price)) data from retailer_issue_open_balances t left join current_variant_prices c on c.variant_id=t.variant_id group by t.retailer_id,t.variant_id`
} satisfies Record<string, string>
export type Projection = keyof typeof projections

export const access: Record<Projection, readonly string[]> = {
  variants: ALL_ROLES,
  materials: SUPPLY,
  suppliers: ALL_ROLES,
  purchases: SUPPLY,
  inventoryLots: SUPPLY,
  batches: ALL_ROLES,
  productionOutputs: ALL_ROLES,
  retailers: RETAIL,
  stockIssues: RETAIL,
  retailerMovements: RETAIL,
  openIssueLines: RETAIL,
  reconciliations: REVIEW,
  remittances: REVIEW,
  expenses: FINANCE,
  retailerBalances: REVIEW,
  profitSummary: FINANCE,
  recipes: SUPPLY,
  pricing: ALL_ROLES,
  materialStock: SUPPLY,
  finishedByVariant: ALL_ROLES,
  retailerHoldings: RETAIL,
  directSales: REVIEW
}

// The legacy sales role could read batches, but not material inputs/lots.
export function stripRestricted(
  key: Projection,
  role: string,
  rows: Record<string, unknown>[]
) {
  if (key === 'batches' && !SUPPLY.includes(role))
    for (const row of rows) delete row.inputs
  return rows
}
