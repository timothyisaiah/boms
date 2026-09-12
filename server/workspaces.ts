import { sql } from 'drizzle-orm'
import { database } from './db.js'
import {
  ALL_ROLES,
  SUPPLY,
  RETAIL,
  REVIEW,
  FINANCE,
  type Session
} from './auth.js'

// These are static, allowlisted SQL projections. No browser-supplied table names,
// joins, roles or SQL fragments enter a query. Nested shapes preserve the Vue UI.
const variant = `(select to_jsonb(v)||jsonb_build_object('product',to_jsonb(p)) from product_variants v join products p on p.id=v.product_id where v.id=t.variant_id)`
const batch = `(select to_jsonb(b) from production_batches b where b.id=t.production_batch_id)`
const retailer = `(select to_jsonb(r) from retailers r where r.id=t.retailer_id)`
const supplier = `(select to_jsonb(s) from suppliers s where s.id=t.supplier_id)`
const projections = {
  variants: `select to_jsonb(t)||jsonb_build_object('product',to_jsonb(p),'current_price',c.unit_price) data from product_variants t join products p on p.id=t.product_id left join current_variant_prices c on c.variant_id=t.id where t.is_active order by t.pack_size_grams`,
  materials: `select to_jsonb(t) data from materials t where is_active order by kind,name`,
  suppliers: `select to_jsonb(t) data from suppliers t where is_active order by supplier_name`,
  purchases: `select to_jsonb(t)||jsonb_build_object('supplier',${supplier},'items',coalesce((select jsonb_agg(to_jsonb(i)||jsonb_build_object('material',to_jsonb(m)) order by i.line_number) from purchase_items i join materials m on m.id=i.material_id where i.purchase_id=t.id),'[]')) data from purchases t order by purchased_at desc,id desc`,
  inventoryLots: `select to_jsonb(t)||jsonb_build_object('supplier',${supplier},'material',to_jsonb(m)) data from inventory_lots t join materials m on m.id=t.material_id where t.status='open' order by received_at,t.id`,
  batches: `select to_jsonb(t)||jsonb_build_object('variant',${variant},'inputs',coalesce((select jsonb_agg(to_jsonb(i)||jsonb_build_object('material',to_jsonb(m),'lot',to_jsonb(l)) order by i.line_number) from production_inputs i join materials m on m.id=i.material_id join inventory_lots l on l.id=i.inventory_lot_id where i.production_batch_id=t.id),'[]'),'outputs',coalesce((select jsonb_agg(to_jsonb(o) order by o.line_number) from production_outputs o where o.production_batch_id=t.id),'[]')) data from production_batches t order by started_at desc,t.id desc`,
  productionOutputs: `select to_jsonb(t)||jsonb_build_object('variant',${variant},'batch',${batch}) data from production_outputs t where t.quantity_remaining>0 order by t.created_at,t.id`,
  retailers: `select to_jsonb(t) data from retailers t where is_active order by retailer_name`,
  stockIssues: `select to_jsonb(t)||jsonb_build_object('retailer',${retailer},'items',coalesce((select jsonb_agg(to_jsonb(i)||jsonb_build_object('batch',to_jsonb(b),'variant',to_jsonb(v)) order by i.line_number) from stock_issue_items i join production_batches b on b.id=i.production_batch_id join product_variants v on v.id=i.variant_id where i.stock_issue_id=t.id),'[]')) data from stock_issues t order by issued_at desc,t.id desc`,
  retailerMovements: `select to_jsonb(t)||jsonb_build_object('retailer',${retailer},'batch',${batch},'variant',to_jsonb(v)) data from retailer_stock_ledgers t join product_variants v on v.id=t.product_variant_id order by moved_at desc,t.id desc`,
  openIssueLines: `select to_jsonb(t)||jsonb_build_object('unit_price',c.unit_price) data from retailer_issue_open_balances t left join current_variant_prices c on c.variant_id=t.variant_id order by t.issued_at,t.stock_issue_item_id`,
  reconciliations: `select to_jsonb(t)||jsonb_build_object('retailer',${retailer},'items',coalesce((select jsonb_agg(to_jsonb(i)||jsonb_build_object('batch',to_jsonb(b),'variant',to_jsonb(v)) order by i.line_number) from reconciliation_items i join production_batches b on b.id=i.production_batch_id join product_variants v on v.id=i.variant_id where i.reconciliation_id=t.id),'[]')) data from reconciliations t order by reconciled_at desc,t.id desc`,
  remittances: `select to_jsonb(t)||jsonb_build_object('retailer',${retailer},'reconciliation',(select to_jsonb(r) from reconciliations r where r.id=t.reconciliation_id)) data from remittances t order by received_at desc,t.id desc`,
  expenses: `select to_jsonb(t) data from expenses t order by incurred_at desc,t.id desc`,
  retailerBalances: `select to_jsonb(t) data from retailer_outstanding_balances t order by outstanding_amount desc,retailer_name`,
  profitSummary: `select to_jsonb(t) data from finance_profit_summary t`,
  recipes: `select to_jsonb(t)||jsonb_build_object('items',coalesce((select jsonb_agg(to_jsonb(i)||jsonb_build_object('material',to_jsonb(m)) order by i.id) from production_recipe_items i join materials m on m.id=i.material_id where i.recipe_id=t.id),'[]')) data from production_recipes t order by t.id`,
  pricing: `select to_jsonb(t) data from pricing t order by effective_from desc,id desc`
} satisfies Record<string, string>
const access: Record<keyof typeof projections, readonly string[]> = {
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
  pricing: ALL_ROLES
}
export const workspaceRoles = {
  operations: SUPPLY,
  retail: RETAIL,
  finance: REVIEW,
  dashboard: ALL_ROLES,
  settings: ['admin_owner', 'operations_manager']
}
const groups: Record<
  keyof typeof workspaceRoles,
  (keyof typeof projections)[]
> = {
  operations: [
    'variants',
    'materials',
    'suppliers',
    'purchases',
    'inventoryLots',
    'batches',
    'recipes'
  ],
  retail: [
    'retailers',
    'productionOutputs',
    'stockIssues',
    'retailerMovements'
  ],
  finance: [
    'retailers',
    'openIssueLines',
    'reconciliations',
    'remittances',
    'expenses',
    'retailerBalances',
    'profitSummary',
    'pricing'
  ],
  dashboard: [
    'purchases',
    'inventoryLots',
    'batches',
    'productionOutputs',
    'stockIssues',
    'retailers',
    'reconciliations',
    'remittances',
    'retailerBalances',
    'openIssueLines',
    'expenses'
  ],
  settings: ['variants', 'materials', 'recipes', 'pricing']
}
export async function readWorkspace(
  name: keyof typeof workspaceRoles,
  session: Session
) {
  const { db } = database()
  const entries = await Promise.all(
    groups[name].map(async key => {
      if (!access[key].includes(session.role))
        return [key, key === 'profitSummary' ? null : []]
      const result = await db.execute(sql.raw(projections[key]))
      const data = result.rows.map(row => row.data as Record<string, unknown>)
      // The legacy sales role could read batches, but not material inputs/lots.
      if (key === 'batches' && !SUPPLY.includes(session.role))
        for (const batch of data) delete batch.inputs
      return [
        name === 'retail' && key === 'productionOutputs'
          ? 'finishedStock'
          : key,
        key === 'profitSummary' ? data[0] : data
      ]
    })
  )
  return { mode: 'live', ...Object.fromEntries(entries) }
}
