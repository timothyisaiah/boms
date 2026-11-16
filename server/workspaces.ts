import { sql } from 'drizzle-orm'
import { database } from './db.js'
import { ALL_ROLES, SUPPLY, RETAIL, REVIEW, type Session } from './auth.js'
import { HttpError } from './http.js'
import {
  access,
  historySources,
  projections,
  retailer,
  stripRestricted,
  type HistoryResource,
  type Projection
} from './projections.js'

export const workspaceRoles = {
  operations: SUPPLY,
  retail: RETAIL,
  finance: REVIEW,
  dashboard: ALL_ROLES,
  settings: ['admin_owner', 'operations_manager']
}
type Workspace = keyof typeof workspaceRoles
const groups: Record<Workspace, Projection[]> = {
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

// Summary-only, open-state replacements for client computations that would
// otherwise need a complete history (see docs/audits/history-api.md).
const summaryExtras = {
  // Exact server-side equivalent of RetailPage's per-retailer sum of every
  // retailer_stock_ledgers.quantity_delta. Bounded by retailers with movements.
  retailerStockPositions: {
    roles: RETAIL,
    sql: `select jsonb_build_object('retailer_id',r.id,'retailer_name',r.retailer_name,'delivery_location',r.delivery_location,'is_active',r.is_active,'total_units',g.total_units,'lines',coalesce((select jsonb_agg(jsonb_build_object('product_variant_id',l.product_variant_id,'sku',v.sku,'variant_name',v.variant_name,'production_batch_id',l.production_batch_id,'batch_code',b.batch_code,'quantity',l.quantity) order by l.quantity desc,v.sku,b.batch_code) from (select product_variant_id,production_batch_id,sum(quantity_delta)::int quantity from retailer_stock_ledgers where retailer_id=r.id group by product_variant_id,production_batch_id having sum(quantity_delta)<>0) l join product_variants v on v.id=l.product_variant_id join production_batches b on b.id=l.production_batch_id),'[]')) data from (select retailer_id,sum(quantity_delta)::int total_units from retailer_stock_ledgers group by retailer_id) g join retailers r on r.id=g.retailer_id order by g.total_units desc,r.retailer_name`
  },
  // Compact rows (no line items) for the remittance form's reconciliation select.
  reconciliationOptions: {
    roles: REVIEW,
    sql: `select jsonb_build_object('id',t.id,'reconciliation_reference',t.reconciliation_reference,'reconciled_at',t.reconciled_at,'total_sales_value',t.total_sales_value,'retailer_id',t.retailer_id,'retailer',${retailer}) data from reconciliations t order by reconciled_at desc,t.id desc`
  }
} satisfies Record<string, { roles: readonly string[]; sql: string }>
const summaryExtraGroups: Record<Workspace, (keyof typeof summaryExtras)[]> = {
  operations: [],
  retail: ['retailerStockPositions'],
  finance: ['reconciliationOptions'],
  dashboard: [],
  settings: []
}
const isHistory = (key: string): key is HistoryResource =>
  Object.hasOwn(historySources, key)

export type WorkspaceView = 'full' | 'summary'
export function parseWorkspaceView(
  value: unknown,
  name: Workspace
): WorkspaceView {
  if (value === undefined || value === 'full') return 'full'
  if (value !== 'summary')
    throw new HttpError(422, 'Choose a valid workspace view.')
  // Dashboard metrics aggregate six months of every history collection and its
  // activity feed merges all of them; a summary would silently show wrong totals.
  if (name === 'dashboard')
    throw new HttpError(
      422,
      'The dashboard workspace has no summary view. Request the full workspace.'
    )
  return 'summary'
}

export async function readWorkspace(
  name: Workspace,
  session: Session,
  view: WorkspaceView = 'full'
) {
  const { db } = database()
  const rows = async (text: string) =>
    (await db.execute(sql.raw(text))).rows.map(
      row => row.data as Record<string, unknown>
    )
  const keys =
    view === 'summary'
      ? groups[name].filter(key => !isHistory(key))
      : groups[name]
  const entries = await Promise.all(
    keys.map(async key => {
      if (!access[key].includes(session.role))
        return [key, key === 'profitSummary' ? null : []]
      const data = stripRestricted(
        key,
        session.role,
        await rows(projections[key])
      )
      return [
        name === 'retail' && key === 'productionOutputs'
          ? 'finishedStock'
          : key,
        key === 'profitSummary' ? data[0] : data
      ]
    })
  )
  if (view === 'full') return { mode: 'live', ...Object.fromEntries(entries) }

  const counts = await Promise.all(
    groups[name].filter(isHistory).map(async key => {
      if (!access[key].includes(session.role)) return [key, 0]
      const result = await db.execute(
        sql.raw(`select count(*)::int n from ${historySources[key].from}`)
      )
      return [key, Number(result.rows[0]?.n ?? 0)]
    })
  )
  const extras = await Promise.all(
    summaryExtraGroups[name].map(async key => [
      key,
      summaryExtras[key].roles.includes(session.role)
        ? await rows(summaryExtras[key].sql)
        : []
    ])
  )
  return {
    mode: 'live',
    view: 'summary',
    ...Object.fromEntries(entries),
    ...Object.fromEntries(extras),
    historyCounts: Object.fromEntries(counts)
  }
}
