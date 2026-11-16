import { sql, type SQL } from 'drizzle-orm'
import { database } from './db.js'
import { HttpError } from './http.js'
import type { Session } from './auth.js'
import {
  access,
  historySources,
  stripRestricted,
  type HistoryResource
} from './projections.js'

// Paginated, server-sorted history reads. Every identifier below is a static
// allowlisted SQL fragment; browser values only ever travel as bound parameters.
const retailerName = `(select r.retailer_name from retailers r where r.id=t.retailer_id)`
type Filter =
  | { column: string; kind: 'id' }
  | { column: string; kind: 'enum'; values: readonly string[] }
  | { column: string; kind: 'text' }
type Spec = {
  date: string
  defaultSort: string
  sorts: Record<string, string>
  search: readonly string[]
  filters: Record<string, Filter>
}
const purchaseStatus = ['draft', 'received', 'voided'] as const
const batchStatus = ['draft', 'completed', 'voided'] as const
const issueStatus = ['draft', 'issued', 'voided'] as const
const movementTypes = [
  'issue',
  'reconciliation_sale',
  'return_to_warehouse',
  'damage',
  'adjustment_in',
  'adjustment_out',
  'transfer_in',
  'transfer_out',
  'expiry'
] as const
export const historySpecs: Record<HistoryResource, Spec> = {
  purchases: {
    date: 't.purchased_at',
    defaultSort: 'purchased_at',
    sorts: {
      purchased_at: 't.purchased_at',
      purchase_reference: 't.purchase_reference',
      status: 't.status',
      total_amount: 't.total_amount',
      supplier_name: `(select s.supplier_name from suppliers s where s.id=t.supplier_id)`
    },
    search: [
      't.purchase_reference',
      't.notes',
      `(select s.supplier_name from suppliers s where s.id=t.supplier_id)`
    ],
    filters: {
      supplierId: { column: 't.supplier_id', kind: 'id' },
      status: { column: 't.status::text', kind: 'enum', values: purchaseStatus }
    }
  },
  batches: {
    date: 't.started_at',
    defaultSort: 'started_at',
    sorts: {
      started_at: 't.started_at',
      completed_at: 't.completed_at',
      batch_code: 't.batch_code',
      status: 't.status',
      total_output_quantity: 't.total_output_quantity',
      total_input_cost: 't.total_input_cost',
      output_unit_cost: 't.output_unit_cost'
    },
    search: [
      't.batch_code',
      't.notes',
      `(select v.sku||' '||v.variant_name from product_variants v where v.id=t.variant_id)`
    ],
    filters: {
      variantId: { column: 't.variant_id', kind: 'id' },
      status: { column: 't.status::text', kind: 'enum', values: batchStatus }
    }
  },
  stockIssues: {
    date: 't.issued_at',
    defaultSort: 'issued_at',
    sorts: {
      issued_at: 't.issued_at',
      issue_reference: 't.issue_reference',
      status: 't.status',
      total_quantity: 't.total_quantity',
      total_cost: 't.total_cost',
      retailer_name: retailerName
    },
    search: ['t.issue_reference', 't.notes', retailerName],
    filters: {
      retailerId: { column: 't.retailer_id', kind: 'id' },
      status: { column: 't.status::text', kind: 'enum', values: issueStatus }
    }
  },
  retailerMovements: {
    date: 't.moved_at',
    defaultSort: 'moved_at',
    sorts: {
      moved_at: 't.moved_at',
      movement_type: 't.movement_type',
      quantity_delta: 't.quantity_delta',
      unit_cost: 't.unit_cost',
      retailer_name: retailerName,
      sku: 'v.sku'
    },
    search: [
      retailerName,
      'v.sku',
      'v.variant_name',
      `(select b.batch_code from production_batches b where b.id=t.production_batch_id)`,
      't.movement_type::text',
      't.notes'
    ],
    filters: {
      retailerId: { column: 't.retailer_id', kind: 'id' },
      variantId: { column: 't.product_variant_id', kind: 'id' },
      batchId: { column: 't.production_batch_id', kind: 'id' },
      stockIssueId: { column: 't.stock_issue_id', kind: 'id' },
      movementType: {
        column: 't.movement_type::text',
        kind: 'enum',
        values: movementTypes
      }
    }
  },
  reconciliations: {
    date: 't.reconciled_at',
    defaultSort: 'reconciled_at',
    sorts: {
      reconciled_at: 't.reconciled_at',
      reconciliation_reference: 't.reconciliation_reference',
      total_sales_value: 't.total_sales_value',
      total_sold_quantity: 't.total_sold_quantity',
      total_cogs_value: 't.total_cogs_value',
      retailer_name: retailerName
    },
    search: ['t.reconciliation_reference', 't.notes', retailerName],
    filters: { retailerId: { column: 't.retailer_id', kind: 'id' } }
  },
  remittances: {
    date: 't.received_at',
    defaultSort: 'received_at',
    sorts: {
      received_at: 't.received_at',
      remittance_reference: 't.remittance_reference',
      amount: 't.amount',
      retailer_name: retailerName
    },
    search: ['t.remittance_reference', 't.notes', retailerName],
    filters: {
      retailerId: { column: 't.retailer_id', kind: 'id' },
      reconciliationId: { column: 't.reconciliation_id', kind: 'id' }
    }
  },
  expenses: {
    date: 't.incurred_at',
    defaultSort: 'incurred_at',
    sorts: {
      incurred_at: 't.incurred_at',
      expense_category: 't.expense_category',
      amount: 't.amount',
      vendor_name: 't.vendor_name',
      expense_reference: 't.expense_reference'
    },
    search: [
      't.expense_category',
      't.vendor_name',
      't.expense_reference',
      't.notes'
    ],
    filters: { category: { column: 't.expense_category', kind: 'text' } }
  }
}

export const HISTORY_DEFAULT_LIMIT = 25
export const HISTORY_MAX_LIMIT = 100
const MAX_OFFSET = 1_000_000
const BUSINESS_TZ = 'Africa/Kampala'
const BUSINESS_OFFSET = '+03:00' // Africa/Kampala has no daylight saving.
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/
const TIMESTAMP =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,6})?)?(Z|[+-]\d{2}:\d{2})$/

type Query = Record<string, string | string[] | undefined>
function single(query: Query, name: string) {
  const value = query[name]
  if (Array.isArray(value)) throw new HttpError(422, `Send ${name} only once.`)
  if (value === undefined) return undefined
  const trimmed = value.trim()
  return trimmed === '' ? undefined : trimmed
}
function integer(value: string | undefined, name: string) {
  if (value === undefined) return undefined
  if (!/^-?\d{1,9}$/.test(value))
    throw new HttpError(422, `Choose a whole number for ${name}.`)
  return Number(value)
}
type Bound = { text: string; dateOnly: boolean; instant: number }
function bound(value: string | undefined, name: string): Bound | undefined {
  if (value === undefined) return undefined
  if (DATE_ONLY.test(value)) {
    const instant = Date.parse(`${value}T00:00:00${BUSINESS_OFFSET}`)
    // Reject impossible calendar dates such as 2026-02-30.
    if (
      Number.isNaN(instant) ||
      new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) !== value
    )
      throw new HttpError(422, `Choose a valid ${name} date.`)
    return { text: value, dateOnly: true, instant }
  }
  const instant = Date.parse(value)
  if (!TIMESTAMP.test(value) || Number.isNaN(instant))
    throw new HttpError(422, `Choose a valid ${name} date.`)
  return { text: value, dateOnly: false, instant }
}

export type HistoryParams = {
  resource: HistoryResource
  limit: number
  offset: number
  sort: string
  order: 'asc' | 'desc'
  from?: Bound
  to?: Bound
  q?: string
  filters: [Filter, string][]
}

export function isHistoryResource(value: unknown): value is HistoryResource {
  return typeof value === 'string' && Object.hasOwn(historySources, value)
}

export function parseHistoryQuery(
  resource: HistoryResource,
  query: Query
): HistoryParams {
  const spec = historySpecs[resource]
  const limit = Math.min(
    HISTORY_MAX_LIMIT,
    Math.max(
      1,
      integer(single(query, 'limit'), 'limit') ?? HISTORY_DEFAULT_LIMIT
    )
  )
  const offset = integer(single(query, 'offset'), 'offset') ?? 0
  if (offset < 0 || offset > MAX_OFFSET)
    throw new HttpError(422, 'Choose a valid page offset.')
  const sort = single(query, 'sort') ?? spec.defaultSort
  if (!Object.hasOwn(spec.sorts, sort))
    throw new HttpError(422, 'This list cannot be sorted by that column.')
  const order = single(query, 'order') ?? 'desc'
  if (order !== 'asc' && order !== 'desc')
    throw new HttpError(422, 'Choose ascending or descending order.')
  const from = bound(single(query, 'from'), 'start')
  const to = bound(single(query, 'to'), 'end')
  if (
    from &&
    to &&
    from.instant > (to.dateOnly ? to.instant + 86400000 - 1 : to.instant)
  )
    throw new HttpError(
      422,
      'The start date must be on or before the end date.'
    )
  const q = single(query, 'q')
  if (q !== undefined && q.length > 100)
    throw new HttpError(422, 'Search text must be 100 characters or fewer.')
  const filters: [Filter, string][] = []
  for (const [name, filter] of Object.entries(spec.filters)) {
    const value = single(query, name)
    if (value === undefined) continue
    if (filter.kind === 'id' && !/^\d{1,18}$/.test(value))
      throw new HttpError(422, `Choose a valid ${name}.`)
    if (filter.kind === 'enum' && !filter.values.includes(value))
      throw new HttpError(422, `Choose a valid ${name}.`)
    if (filter.kind === 'text' && value.length > 100)
      throw new HttpError(422, `${name} must be 100 characters or fewer.`)
    filters.push([filter, value])
  }
  return {
    resource,
    limit,
    offset,
    sort,
    order: order as 'asc' | 'desc',
    from,
    to,
    q,
    filters
  }
}

function conditions(params: HistoryParams) {
  const spec = historySpecs[params.resource]
  const date = sql.raw(spec.date)
  const where: SQL[] = []
  if (params.from)
    where.push(
      params.from.dateOnly
        ? sql`${date} >= (${params.from.text}::date)::timestamp at time zone ${BUSINESS_TZ}`
        : sql`${date} >= ${params.from.text}::timestamptz`
    )
  if (params.to)
    where.push(
      params.to.dateOnly
        ? sql`${date} < ((${params.to.text}::date) + 1)::timestamp at time zone ${BUSINESS_TZ}`
        : sql`${date} <= ${params.to.text}::timestamptz`
    )
  if (params.q !== undefined) {
    // Escape LIKE wildcards so user text always matches literally.
    const pattern = `%${params.q.replace(/[\\%_]/g, '\\$&')}%`
    where.push(
      sql`(${sql.join(
        spec.search.map(
          column => sql`${sql.raw(column)} ilike ${pattern} escape '\\'`
        ),
        sql` or `
      )})`
    )
  }
  for (const [filter, value] of params.filters)
    where.push(
      filter.kind === 'id'
        ? sql`${sql.raw(filter.column)} = ${value}::bigint`
        : sql`${sql.raw(filter.column)} = ${value}`
    )
  return where.length ? sql` where ${sql.join(where, sql` and `)}` : sql``
}

export async function readHistory(params: HistoryParams, session: Session) {
  const source = historySources[params.resource]
  const spec = historySpecs[params.resource]
  const where = conditions(params)
  const direction = sql.raw(params.order)
  const { db } = database()
  const [page, count] = await Promise.all([
    db.execute(
      sql`select ${sql.raw(source.data)} data from ${sql.raw(source.from)}${where} order by ${sql.raw(spec.sorts[params.sort])} ${direction} nulls last, t.id ${direction} limit ${params.limit} offset ${params.offset}`
    ),
    db.execute(sql`select count(*)::int n from ${sql.raw(source.from)}${where}`)
  ])
  const rows = stripRestricted(
    params.resource,
    session.role,
    page.rows.map(row => row.data as Record<string, unknown>)
  )
  return {
    rows,
    total: Number(count.rows[0]?.n ?? 0),
    limit: params.limit,
    offset: params.offset,
    sort: params.sort,
    order: params.order
  }
}

export const historyRoles = Object.fromEntries(
  Object.keys(historySources).map(key => [key, access[key as HistoryResource]])
) as Record<HistoryResource, readonly string[]>
