# History API and workspace summary view (MF-06)

Status: implemented on `ux/paginated-reads`. Read API only; every write endpoint
and payload is unchanged. This is the contract page agents adopt for MF-06
(bounded reads), MF-12 (desktop `QTable` record views) and MF-15 (first useful
content without full history).

## 1. What changed

| Endpoint                                 | Change                                                                                                   |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `GET /api/workspace?name=…`              | **Unchanged by default.** Byte-for-byte the same payload for every role (tested against the old reader). |
| `GET /api/workspace?name=…&view=summary` | New opt-in. Omits unbounded history arrays; adds `view`, `historyCounts` and open-state replacements.    |
| `GET /api/history?resource=…`            | New. One page of one history collection, server-sorted, filtered and counted.                            |

Server code: `server/projections.ts` (shared SQL projections and the `access`
role map, moved from `workspaces.ts` without textual change),
`server/workspaces.ts` (summary view), `server/history.ts` (parsing, allowlists,
query), `api/history.ts` (Vercel function, routed automatically as
`/api/history`; `scripts/api-dev.ts` routes it locally). Client:
`src/services/history.js`.

## 2. `GET /api/history`

### Authorization

1. No/expired session → `401 { kind: 'authentication' }`.
2. Unknown `resource` → `404`.
3. Role not in the collection's existing `access` entry → `403 { kind: 'authorization' }`.
4. Non-GET → `405`.

The role map is the same object the workspace reader uses, so a role can read a
history page exactly when it can see that collection in a workspace:

| resource            | roles allowed (`access`)                     | denied                                                         |
| ------------------- | -------------------------------------------- | -------------------------------------------------------------- |
| `purchases`         | SUPPLY                                       | sales_or_distribution_staff                                    |
| `batches`           | ALL_ROLES (sales gets rows without `inputs`) | —                                                              |
| `stockIssues`       | RETAIL                                       | production_staff                                               |
| `retailerMovements` | RETAIL                                       | production_staff                                               |
| `reconciliations`   | REVIEW                                       | production_staff, warehouse_staff                              |
| `remittances`       | REVIEW                                       | production_staff, warehouse_staff                              |
| `expenses`          | FINANCE                                      | production_staff, warehouse_staff, sales_or_distribution_staff |

### Common parameters

| param    | default              | rules                                                                                                                                  |
| -------- | -------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `limit`  | 25                   | Integer. Clamped to 1…100 (`0`, `-4` → 1; `1000` → 100). Non-integer → 422.                                                            |
| `offset` | 0                    | Integer 0…1,000,000, else 422.                                                                                                         |
| `sort`   | resource date column | Must be a key in the resource's sort list below, else **422** (not silently ignored).                                                  |
| `order`  | `desc`               | `asc` or `desc`, else 422. Ties always break on `id` in the same direction, so paging is stable. Nulls sort last.                      |
| `from`   | —                    | `YYYY-MM-DD` = start of that **Africa/Kampala** day (same zone as `business_report`), or an ISO timestamp with `Z`/offset (inclusive). |
| `to`     | —                    | `YYYY-MM-DD` = through the end of that Kampala day, or an ISO timestamp with `Z`/offset (inclusive). `from` after `to` → 422.          |
| `q`      | —                    | Trimmed, ≤100 chars. Case-insensitive substring over the resource's search fields; `%`, `_` and `\` match literally.                   |

Every parameter may appear once; a repeated parameter → 422. Unknown
parameters, including filters that belong to another resource, are ignored.
Values are always bound parameters; sort columns, filters and search fields
are static SQL fragments chosen from allowlists.

### Response

```json
{ "rows": [ ... ], "total": 57, "limit": 25, "offset": 25, "sort": "purchased_at", "order": "desc" }
```

`rows` have exactly the shape of the matching workspace array (same projection,
including nested line items), so existing card templates render them unchanged.
`total` is the count after filters. An offset past the end returns
`rows: []` with the real `total`.

### Per-resource reference

| resource            | date column     | sort keys (`sort=`)                                                                                                            | `q` searches                                                       | filters                                                                                                    |
| ------------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| `purchases`         | `purchased_at`  | `purchased_at`\*, `purchase_reference`, `status`, `total_amount`, `supplier_name`                                              | reference, notes, supplier name                                    | `supplierId`, `status` (`draft`/`received`/`voided`)                                                       |
| `batches`           | `started_at`    | `started_at`\*, `completed_at`, `batch_code`, `status`, `total_output_quantity`, `total_input_cost`, `output_unit_cost`        | batch code, notes, variant SKU + name                              | `variantId`, `status` (`draft`/`completed`/`voided`)                                                       |
| `stockIssues`       | `issued_at`     | `issued_at`\*, `issue_reference`, `status`, `total_quantity`, `total_cost`, `retailer_name`                                    | reference, notes, retailer name                                    | `retailerId`, `status` (`draft`/`issued`/`voided`)                                                         |
| `retailerMovements` | `moved_at`      | `moved_at`\*, `movement_type`, `quantity_delta`, `unit_cost`, `retailer_name`, `sku`                                           | retailer name, SKU, variant name, batch code, movement type, notes | `retailerId`, `variantId`, `batchId`, `stockIssueId`, `movementType` (enum `retailer_stock_movement_type`) |
| `reconciliations`   | `reconciled_at` | `reconciled_at`\*, `reconciliation_reference`, `total_sales_value`, `total_sold_quantity`, `total_cogs_value`, `retailer_name` | reference, notes, retailer name                                    | `retailerId`                                                                                               |
| `remittances`       | `received_at`   | `received_at`\*, `remittance_reference`, `amount`, `retailer_name`                                                             | reference, notes, retailer name                                    | `retailerId`, `reconciliationId`                                                                           |
| `expenses`          | `incurred_at`   | `incurred_at`\*, `expense_category`, `amount`, `vendor_name`, `expense_reference`                                              | category, vendor, reference, notes                                 | `category` (exact match)                                                                                   |

\* default sort, `desc` — identical to the current workspace ordering.
Id filters must be positive integers (`^\d{1,18}$`), enum filters must be one of
the listed values; anything else → 422.

### Examples

```
GET /api/history?resource=purchases                                     # newest 25
GET /api/history?resource=purchases&limit=50&offset=50&sort=total_amount&order=asc
GET /api/history?resource=stockIssues&retailerId=12&from=2026-08-01&to=2026-08-31
GET /api/history?resource=retailerMovements&limit=8                     # "recent movements" strip
GET /api/history?resource=expenses&q=transport&sort=amount
GET /api/history?resource=batches&from=2026-11-16T00:00:00Z&to=2026-11-16T23:59:59.999Z&limit=100
```

### Nested line items

Rows keep their nested arrays (`purchases.items`, `batches.inputs/outputs`,
`stockIssues.items`, `reconciliations.items`) because a page is at most 100
rows and the card templates already read them. Splitting into on-demand
detail requests (roadmap "fetch nested line detail on demand") is a later,
separable change: it only needs a `data` projection without the aggregate and
a `GET /api/history?resource=…&id=…` detail mode.

## 3. `GET /api/workspace?name=…&view=summary`

`view` accepts `full` (same as omitting it) or `summary`; anything else → 422.
`dashboard` has no summary view (422) — see §4.

Summary keeps every non-history collection exactly as the full view (variants,
materials, suppliers, inventoryLots — open lots only, productionOutputs /
`finishedStock` — remaining quantity > 0 only, retailers, openIssueLines,
recipes, pricing, retailerBalances, profitSummary). These are open-state or
reference data that forms need and are already bounded by business state,
not by time. It omits `purchases`, `batches`, `stockIssues`,
`retailerMovements`, `reconciliations`, `remittances`, `expenses` and adds:

| key                      | workspace | content                                                                                                                                                                                                                                                                                                     |
| ------------------------ | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `view`                   | all       | `'summary'`                                                                                                                                                                                                                                                                                                 |
| `historyCounts`          | all       | `{ <omitted history key>: total rows }` — `0` when the role cannot read it (matches the `[]` the full view returns). Settings has no histories, so `{}`.                                                                                                                                                    |
| `retailerStockPositions` | retail    | One row per retailer with any movement: `{ retailer_id, retailer_name, delivery_location, is_active, total_units, lines: [{ product_variant_id, sku, variant_name, production_batch_id, batch_code, quantity }] }`, lines with net 0 dropped, ordered `total_units desc, retailer_name`. RETAIL roles only. |
| `reconciliationOptions`  | finance   | Every reconciliation without line items: `{ id, reconciliation_reference, reconciled_at, total_sales_value, retailer_id, retailer }`, newest first. REVIEW roles only.                                                                                                                                      |

Payload size: the saving grows linearly with history (MF-06), while
summary size grows only with open lots/outputs/issue lines, catalogue size,
retailer count and reconciliation count (`reconciliationOptions`).

## 4. Client computations that depend on full histories

Inventory of every page-side use of the seven history arrays on `dev`
(`src/pages/*.vue`, `src/services/dashboard.js`) and how to keep it correct on
summary + history:

| Page / function                                                                     | Uses                                                                                  | Needs full history?  | Replacement                                                                                                                                                                                                                                                                    |
| ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Operations tab labels `Purchases (n)`, `Batches (n)`, metric "Receipts / batches"   | `.length`                                                                             | count only           | `historyCounts.purchases/batches` (or `rowsNumber` once a table loaded).                                                                                                                                                                                                       |
| Operations record tabs                                                              | list                                                                                  | no                   | `/api/history` pages.                                                                                                                                                                                                                                                          |
| Operations `suggestNextBatchCode()` (OperationsPage ~L1059)                         | all batches started on a day                                                          | **yes, one day**     | `fetchHistory('batches', { from: '<day>T00:00:00Z', to: '<day>T23:59:59.999Z', limit: 100 })` — the page compares `started_at` as a **UTC** date (`toISOString().slice(0,10)`), so pass UTC instants, not a date-only (Kampala) window. Refresh after a successful batch save. |
| Operations duplicate batch-code check before save (~L1330)                          | all batch codes                                                                       | **yes**              | `fetchHistory('batches', { q: code, limit: 100 })` and compare case-insensitively, or rely on the server: `batch_code` is `unique` and the write returns 409. Note `q` is a substring match, so filter results exactly.                                                        |
| Recipe defaults, FIFO lot choice                                                    | `recipes`, `inventoryLots`                                                            | no                   | Kept in summary.                                                                                                                                                                                                                                                               |
| Retail tab labels `Movements (n)`, `Dispatches (n)`                                 | `.length`                                                                             | count only           | `historyCounts.retailerMovements/stockIssues`.                                                                                                                                                                                                                                 |
| Retail `movementHistory` (latest 8)                                                 | sort + slice                                                                          | no                   | `fetchHistory('retailerMovements', { limit: 8 })` (default sort is `moved_at desc`).                                                                                                                                                                                           |
| Retail `retailerBalances` / `activeRetailerBalances` (RetailPage ~L686)             | sums **every** movement                                                               | **yes**              | `retailerStockPositions` — an exact SQL equivalent (test asserts equality with the page algorithm). Merge with `retailers` to list active retailers with zero units, as the page does today.                                                                                   |
| Retail stock issue form                                                             | `finishedStock`, `retailers`                                                          | no                   | Kept in summary.                                                                                                                                                                                                                                                               |
| Finance tab label `Records (n)`, metric "n receipts posted"                         | `.length`                                                                             | count only           | `historyCounts.reconciliations/remittances/expenses`.                                                                                                                                                                                                                          |
| Finance `remittanceReconciliationOptions` and the retailer watcher (~L1156, ~L1778) | all reconciliations                                                                   | **yes** (selectable) | `reconciliationOptions` (same fields the select and `reconciliationLabel()` read). The write still validates retailer ownership server side.                                                                                                                                   |
| Finance reconciliation form, balances, profit card                                  | `openIssueLines`, `pricing`, `retailerBalances`, `profitSummary`                      | no                   | Kept in summary; these are server aggregates, not client sums of history.                                                                                                                                                                                                      |
| Dashboard `buildLiveWorkspace()` month buckets (`src/services/dashboard.js`)        | purchases, batches, stockIssues, reconciliations, remittances, expenses over 6 months | **yes**              | **No summary.** Stay on the full dashboard payload until a server aggregate (e.g. per-month totals via `business_report` style SQL) replaces it. A 100-row page cannot reproduce monthly totals.                                                                               |
| Dashboard `buildActivityFeed()` (latest 8 across six collections)                   | merge + slice                                                                         | no (8 per type)      | Could use six `limit: 8` history calls, but only worth it together with the month aggregate.                                                                                                                                                                                   |
| Settings workspace                                                                  | no histories                                                                          | —                    | `view=summary` returns the same data plus `view`/`historyCounts: {}`.                                                                                                                                                                                                          |

Roadmap risk "pagination hides records needed for reconciliation": open issue
lines, open lots and outputs with remaining quantity stay complete in summary;
reconciliation selection uses `reconciliationOptions`, not a paged list.

## 5. Adopting it in a page (QTable)

1. **Workspace load** — switch from `fetchXWorkspace()` to
   `fetchWorkspaceSummary('operations' | 'retail' | 'finance')`. Replace every
   `.length` of an omitted history with `historyCounts.<key>` and the two
   history-derived computations with `retailerStockPositions` /
   `reconciliationOptions` (§4). Do not change the dashboard.
2. **Record view** — one `QTable` (≥ md) and one card list (< md) on the same
   rows/state:

```js
import {
  loadHistoryPage,
  HISTORY_ROWS_PER_PAGE_OPTIONS
} from '@/services/history'

const rows = ref([])
const loading = ref(false)
const filters = reactive({ q: '', from: '', to: '', retailerId: null })
const pagination = ref({
  page: 1,
  rowsPerPage: 25,
  sortBy: null, // null = server default (date desc)
  descending: true,
  rowsNumber: 0
})
let controller

async function onRequest({ pagination: next }) {
  controller?.abort()
  controller = new AbortController()
  loading.value = true
  try {
    const result = await loadHistoryPage('purchases', next, filters, {
      signal: controller.signal
    })
    rows.value = result.rows
    pagination.value = result.pagination // includes rowsNumber = total
  } catch (error) {
    // apiRequest wraps aborts as ApiError; ignore superseded requests.
    if (!controller.signal.aborted) showError(error) // keep previous rows (MF-15)
  } finally {
    loading.value = false
  }
}
onMounted(() => onRequest({ pagination: pagination.value }))
watch(filters, () =>
  onRequest({ pagination: { ...pagination.value, page: 1 } })
) // debounce q
```

```html
<q-table
  :rows="rows"
  :columns="columns"
  row-key="id"
  v-model:pagination="pagination"
  :rows-per-page-options="HISTORY_ROWS_PER_PAGE_OPTIONS"
  :loading="loading"
  binary-state-sort
  @request="onRequest"
/>
```

- Column `name` **must** equal a sort key from §2 for `sortable: true`
  columns (e.g. `{ name: 'total_amount', field: 'total_amount', sortable: true }`).
  Columns without a server sort key must be `sortable: false`; an unknown key
  returns 422.
- Don't offer rows-per-page `0` ("All"); the server caps at 100 and the
  helper maps `0` to 25.
- Mobile cards: same `rows`, `pagination`, `onRequest`; render a
  `q-pagination` (`max = Math.ceil(rowsNumber / rowsPerPage)`) or a
  "Load more" that increments `page`.
- After a successful write, call `onRequest` with the current pagination
  and refresh the summary (counts, open state).

3. Mapping helpers if you don't use `loadHistoryPage`:
   `historyParamsFromPagination({ page, rowsPerPage, sortBy, descending }, filters)`
   → `{ limit, offset: (page-1)*limit, sort, order, ...filters }`;
   `paginationFromHistory(response, pagination)` → adds `rowsNumber: total`.

Recommended order (roadmap Iteration 5): purchases and stock issues, then
batches and movements, then reconciliations/remittances/expenses.

## 6. Tests

`npm run test:history` (`tests/history.test.ts`) runs the real `/api/history`
and `/api/workspace` handlers against in-memory PGlite built from
`neon/migrations` (no Neon; `setTestDatabase()` in `server/db.ts` is the seam)
and covers: default payload deep-equal to the pre-change reader for every role
× workspace; summary omissions, counts, `retailerStockPositions` equality with
the RetailPage algorithm and `reconciliationOptions`; 401/404/403/200 for 7
roles × 7 resources; sales role without batch `inputs`; paging equals full
ordering with correct totals and empty pages past the end; limit clamping and
invalid numbers; every allowlisted sort in both directions and rejected sort /
order injection; Kampala-day and instant windows plus invalid dates; search per
resource, literal `%`/`_`, inert SQL in `q`; id/enum filter validation.

## 7. Risks and follow-ups

- `count(*)` per request is fine at current volumes; at large volumes the date
  indexes cover the default sort, but text search (`ilike '%…%'`) scans. Add
  `pg_trgm` indexes if search becomes slow.
- Offset paging can shift when new rows are inserted between requests; it is
  acceptable for back-office views (sorted newest-first). Keyset paging can be
  added later behind the same response shape.
- `reconciliationOptions` still grows with reconciliation count (small rows).
  If it becomes large, replace the select with a remote search on
  `GET /api/history?resource=reconciliations&retailerId=…&q=…`.
- Dashboard remains a full-history payload until a server-side monthly
  aggregate exists.
