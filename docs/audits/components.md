# BOMS shared components and composables

Status: foundation layer for the page refactors (Operations, Retail, Finance, Dashboard).
Source: `src/components/`, `src/composables/`, `src/lib/format.js`, tokens in `src/css/app.scss` and `src/css/quasar.variables.scss`.

Read this before migrating a page. Each section covers responsibility, API, responsive behaviour and a minimal example. Nothing here changes API payloads, permissions or `writes.js` idempotency.

## Test contracts (browser tests depend on these)

| Contract                                                                      | Where                          | Use in Playwright                                                                                                                   |
| ----------------------------------------------------------------------------- | ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| `data-workspace-mode="loading \| live \| refreshing \| unavailable"`          | Root of every `WorkspaceState` | `await page.locator('[data-workspace-mode]:not([data-workspace-mode="loading"])').first().waitFor()` before checking layout or data |
| `data-task-selector` on the `nav`, `data-task="<name>"` on each option or tab | `TaskSelector`                 | Prefer `getByRole('tab', { name })`, which works at every width (see below)                                                         |
| `data-row-key="<rowKey>"` on each phone card                                  | `ResponsiveRecordView`         | Card lookup on phones; `.q-table` exists only at 1024px and wider                                                                   |
| `boms:draft:<userId>:<formKey>` in `sessionStorage`                           | `useFormDraft`                 | Draft assertions; never contains idempotency keys                                                                                   |

Do not rename these attributes or invent extra workspace modes.

## Tokens (app.scss / quasar.variables.scss)

CSS custom properties are defined on `:root`. Each one also has an SCSS variable, and the SCSS variables are injected into every SFC.

- Colors: `--boms-color-primary`, `-on-primary`, `-canvas`, `-surface`, `-surface-subtle`, `-text`, `-text-muted`, `-heading`, `-border`, `-border-strong`, `-focus`. Each status `success | warning | danger | info` has a base token plus `-bg` and `-text` variants. Warning also has `-border`. There is also `--boms-color-neutral-bg`.
- Spacing: `--boms-space-1|2|3|4|6|8` (4/8/12/16/24/32 px), mirrored by `$boms-space-*`.
- Radius: `--boms-radius-sm` 8 (controls), `-md` 12 (cards and rows), `-lg` 16 (major containers and dialogs), `-pill`.
- Elevation: `--boms-elevation-none`, `-sticky` (sticky chrome), `-overlay` (menus and dialogs only). The legacy `--boms-shadow` now resolves to none, so routine surfaces are flat and use a border.
- Type: `--boms-font-size-page-title` (about 26–36 px fluid), `-section-title` (18 px), `-body`, `-label`, `-caption`.
- Safe areas: `--boms-safe-top|right|bottom|left` (`env(safe-area-inset-*)`). `index.html` already has `viewport-fit=cover`.
- Quasar status colors were darkened for 4.5:1 contrast on white: `$positive #1e7a3c`, `$negative #b42318`, `$info #2f6690`. `$warning` is unchanged and must be paired with dark text.

Global utilities:

- `.section-title` looks identical on a `div`, `h2` or `h3`: 18px, bold, line-height 1.35, top margin 0.35rem. Swap `div` for a heading freely.
- `.status-chip` with `--neutral | --success | --info | --warning | --danger` renders a semantic status pill. Always include text, not color alone.
- `.sr-only` hides content visually but keeps it for screen readers.
- `.tabular-nums` aligns digits in numbers.
- `prefers-reduced-motion: reduce` disables transitions and animations globally, including the `QTabPanels animated` slides.
- Safe-area padding is applied to `.shell-header`, the drawer content, `.q-footer`, `.page-layout` and the sticky `.form-footer`.
- Kept as before: 44px minimum button height, 48px fields and tabs, 16px input text.

## useWorkspace (`src/composables/useWorkspace.js`)

Request state for a workspace loader. It replaces the `getPreview*Workspace()` and `workspace.mode` patterns.

```js
import { useWorkspace, WORKSPACE_MODE } from '@/composables/useWorkspace'
const ws = useWorkspace(({ signal }) => fetchOperationsWorkspace(), {
  initialData: emptyOperationsWorkspace(), // shape for templates; NOT shown as live
  timeoutMs: 25000 // default; 0 disables
})
// ws.mode.value: 'loading' | 'live' | 'refreshing' | 'unavailable'
```

Returns `{ mode, data, error, lastLoadedAt, hasData, isLoading, isStale, load, refresh }`. All values are refs or computeds. `refresh` is the same function as `load`.

- The first load is `loading`. It is never `live` or `unavailable` until the request settles.
- A success sets `live` and stores `data` and `lastLoadedAt`. Empty data is still `live`; "empty" is not a mode.
- `load()` after a success sets `refreshing` and keeps the previous `data`, so records do not blank.
- A failure sets `unavailable` with an `error`. Data from an earlier success is kept, and `isStale` is true. **Deviation from design-system.md:** the diagram there says "Refreshing → Live with warning". The coordinator's contract was used instead, so a failed refresh is `unavailable` with stale data.
- `error` has the shape `{ kind, status, message, detail, cause }`. `kind` is one of `timeout | unauthorized (401) | forbidden (403) | server (5xx) | network | request (other 4xx)`. `message` is user-facing copy; raw server text is kept in `detail`.
- Timeouts: the composable rejects after `timeoutMs`, which is shorter than `apiRequest`'s 30 s, and aborts the `signal` passed to the loader. This lets timeouts be told apart from offline errors.
- Overlapping calls: only the latest call can change state, and the previous request's signal is aborted.
- `immediate` (default true): the loader runs on mount, or at once when used outside a component.
- Exports `WORKSPACE_MODE`, `WORKSPACE_MODES`, `WORKSPACE_ERROR` and `classifyWorkspaceError`.

## WorkspaceState (`src/components/WorkspaceState.vue`)

Truthful availability display. It never shows "Live data" without a successful response.

| Prop           | Type                           | Default   | Notes                                                  |
| -------------- | ------------------------------ | --------- | ------------------------------------------------------ |
| `mode`         | String (required)              | —         | One of `WORKSPACE_MODES`                               |
| `error`        | Object                         | null      | `ws.error.value`                                       |
| `lastLoadedAt` | Number                         | null      | Turns on the "Showing data from HH:MM" stale note      |
| `display`      | `'full' \| 'chip' \| 'banner'` | `'full'`  | Chip for `PageHeader #status`, banner in the page body |
| `skeleton`     | Boolean                        | false     | Compact `QSkeleton` while `loading`                    |
| `retryable`    | Boolean                        | true      | Shows the retry button in the banner                   |
| `retryLabel`   | String                         | `'Retry'` |                                                        |

Event: `retry`.

Labels are Loading, Live data, Refreshing and Unavailable. Each has an icon and a semantic tone.

Accessibility: the chip is `role="status"` / `aria-live="polite"` for loading, refreshing and live. When unavailable, the banner is `role="alert"` and contains the retry button. When `display="chip"` is used on its own, the chip becomes the alert. Only one live region speaks per state, so one chip plus one banner per page is the intended pattern. A banner-only instance does not announce loading.

```vue
<PageHeader title="Operations">
  <template #status><WorkspaceState display="chip" :mode="ws.mode.value" /></template>
</PageHeader>
<WorkspaceState
  display="banner"
  skeleton
  :mode="ws.mode.value"
  :error="ws.error.value"
  :last-loaded-at="ws.lastLoadedAt.value"
  @retry="ws.refresh"
/>
```

Every instance renders the `data-workspace-mode` root, including the banner variant when it has nothing to show.

## PageHeader (`src/components/PageHeader.vue`)

Compact replacement for `.page-hero`. It provides one `h1`, an optional subtitle, a status slot, one primary action and an overflow menu.

| Prop               | Default          | Notes                                                                                    |
| ------------------ | ---------------- | ---------------------------------------------------------------------------------------- |
| `title` (required) | —                | Rendered as the page's only `h1`. Use the route title.                                   |
| `subtitle`         | `''`             | One line. Do not restate the title.                                                      |
| `actions`          | `[]`             | `{ label, icon?, to?, handler?, visible? = true, disable? }`, shown in the overflow menu |
| `overflowLabel`    | `'More actions'` | Accessible name and tooltip of the `more_vert` button                                    |

Slots:

- `status`: usually a `WorkspaceState` chip.
- `primary`: one primary `q-btn`.
- `overflow`: extra `q-item`s appended to the menu.

Responsive behaviour:

- Below 600px: the title and status share one row, and actions sit on a row below. The primary button stretches and the overflow button sits at the right edge. The header is about 120–150px tall.
- 600px and wider: the title, status and actions sit on one row.
- There is no gradient or shadow, only a bottom border.

Caveat: management components such as `VariantManager`, `MaterialManager` and `PartnerProfiles` render their own button and dialog. A dialog placed inside the `QMenu` unmounts when the menu closes. For overflow items, give the manager a `v-model` open state, render its dialog outside the menu, and set it from the item's `handler`.

```vue
<PageHeader
  title="Operations"
  subtitle="Receive materials and post batches"
  :actions="[
    {
      label: 'Manage variants',
      icon: 'category',
      handler: () => (variantsOpen = true)
    },
    { label: 'Refresh', icon: 'refresh', handler: ws.refresh },
    { label: 'Partners', icon: 'groups', to: '/admin', visible: isOwner }
  ]"
>
  <template #status><WorkspaceState display="chip" :mode="ws.mode.value" /></template>
  <template #primary><q-btn color="primary" unelevated no-caps label="New receipt" @click="task = 'purchase-entry'" /></template>
</PageHeader>
```

## TaskSelector (`src/components/TaskSelector.vue`)

Local task navigation kept in the URL. It replaces the in-page `q-tabs`. Keep `q-tab-panels` for the content and bind it to the same `v-model`.

| Prop               | Default   | Notes                                                                                          |
| ------------------ | --------- | ---------------------------------------------------------------------------------------------- |
| `items` (required) | —         | `[{ name, label, icon?, group: 'do' \| 'review', count? }]`. The count renders as `Label (n)`. |
| `modelValue`       | `''`      | v-model holding the selected `name`                                                            |
| `queryKey`         | `'view'`  | Query parameter that stores the selection                                                      |
| `label`            | `'Tasks'` | Accessible name of the `nav` landmark                                                          |

URL behaviour:

- The initial selection comes from `route.query[queryKey]`.
- A missing value falls back to the current v-model if it is valid, otherwise to the first item (Do items first).
- An invalid value always falls back to the first item and is removed from the URL.
- Selecting a task calls `router.replace` and preserves other query keys. The default task leaves the URL clean.
- The selection follows back/forward and reload. The page's own changes to v-model are written to the URL.

Responsive behaviour (CSS only, using Quasar's `lt-sm` / `gt-xs`):

- Below 600px: a full-width grid of buttons that names every task without horizontal swiping. Options are grouped under "Do" and "Review" labels, each group is a `role="tablist"`, and options are 44px or taller `role="tab"` with `aria-selected`. Arrow keys, Home and End move focus across all options.
- 600px and wider: `QTabs` with all items. Arrows appear only if the tabs overflow.
- The hidden variant uses `display:none`, so assistive technology sees exactly one set of tabs. As a result, `getByRole('tab', { name: 'Receipt form' })` keeps working in existing tests at 375px and 1280px.

```vue
<TaskSelector
  v-model="task"
  :items="[
    {
      name: 'purchase-entry',
      label: 'Record receipt',
      icon: 'receipt_long',
      group: 'do'
    },
    {
      name: 'batch-entry',
      label: 'Create batch',
      icon: 'science',
      group: 'do'
    },
    { name: 'snapshot', label: 'Snapshot', icon: 'insights', group: 'review' },
    {
      name: 'purchases',
      label: 'Purchases',
      icon: 'inventory_2',
      group: 'review',
      count: purchases.length
    }
  ]"
/>
<q-tab-panels v-model="task">…</q-tab-panels>
```

Do not add `animated` reliance; it is disabled under reduced motion anyway.

## FormActionBar (`src/components/FormActionBar.vue`)

Submit area for long forms. It integrates `WriteStatus`.

| Prop                     | Default    | Notes                                                                                                                             |
| ------------------------ | ---------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `submitLabel` (required) | —          | For example "Record purchase". Existing tests use the exact name.                                                                 |
| `submitIcon`             | `''`       |                                                                                                                                   |
| `loading` / `disabled`   | false      | The button is disabled while loading, which prevents duplicate submits                                                            |
| `type`                   | `'submit'` | `'submit'`: the button submits the enclosing `q-form`; handle `@submit` on the form. `'button'`: the bar emits `submit` on click. |
| `action`                 | `''`       | writes.js action name. When set, renders `<WriteStatus :action>` above the bar.                                                   |
| `sticky`                 | true       | Sticky to the bottom below 1024px. Static at 1024px and wider.                                                                    |

Events:

- `submit`: only when `type="button"`.
- `saved`: re-emitted from `WriteStatus` after a successful retry.

Slots:

- default: secondary actions, such as "Add line".
- `summary`: compact totals chips.

Layout: the component renders two root nodes, `WriteStatus` and the bar. Place it as the last direct child of the form, because a sticky element only sticks within its parent. Below 1024px the bar has a top border, a small sticky shadow and `padding-bottom: calc(12px + env(safe-area-inset-bottom))`, and the submit button is full width. At 1024px and wider, secondary actions sit on the left and the submit button on the right.

```vue
<q-form ref="formRef" @submit="submitPurchase">
  <FormErrorSummary ref="summaryRef" :errors="errors" />
  …fields…
  <FormActionBar submit-label="Record purchase" action="purchases" :loading="saving" @saved="onSaved">
    <q-btn flat no-caps icon="add" label="Add line" type="button" @click="addLine" />
    <template #summary><span class="status-chip status-chip--neutral">Total {{ formatMoney(total) }}</span></template>
  </FormActionBar>
</q-form>
```

## FormErrorSummary and useFormErrors

`FormErrorSummary.vue` props:

- `errors`: `[{ id?, label?, message }]`
- `title`: default "Check the highlighted fields"
- `headingLevel`: default 3

It renders only when there are errors. The root is `role="alert"` and `tabindex="-1"`. Each item is a link `Label: message`. Activating a link focuses the field (the native control with that `id`) and scrolls it to the centre. The component exposes `focus()`.

`useFormErrors()` returns `{ errors, summaryRef, validate(formRef), fail(list, { focus: 'field' | 'summary' }), clear(), focusFirst() }`.

- `validate(formRef)` runs `QForm.validate()`. On failure it reads Quasar's rendered `.q-field--error` fields (label and message) into `errors`, assigns ids to controls that lack one, and focuses the first invalid field. It resolves `true` when the form is valid.
- `fail(list)` handles business-rule errors, such as a duplicate lot code or a missing supplier. Use `focus: 'summary'` for errors that are not tied to a field.
- Give fields stable ids with QInput/QSelect `for="purchase-supplier"`. `for` sets the id on the native control.
- `Notify` remains supplementary. Blocking errors belong in the summary.

```js
const { errors, summaryRef, validate, fail, clear } = useFormErrors()
async function submitPurchase() {
  if (!(await validate(formRef))) return
  if (!form.supplierId) return fail([{ id: 'purchase-supplier', label: 'Supplier', message: 'Select a supplier.' }])
  clear()
  …
}
```

With `ref="summaryRef"` on `<FormErrorSummary>`, `summaryRef` must be a top-level binding in `<script setup>`, as in the destructuring above.

## Drafts: useFormDraft, useDirtyGuard, DirtyGuardDialog

`useFormDraft(formKey, state, options)` stores in-progress inputs in `sessionStorage`, scoped to the signed-in user.

- `formKey`: stable per form, for example `'finance:reconciliation'`.
- `state`: the form's `reactive()` object or a ref.
- Options:
  - `expiryMs`: 12 hours by default.
  - `exclude`: top-level fields that are never stored.
  - `debounceMs`: 400 by default.
  - `deserialize(saved)`: adjusts restored data before it is applied.
  - `restoreOnMount`: true by default.
- Returns `{ isDirty, restored, savedAt, restore(), clearDraft(), flush(), peek() }`.

Behaviour:

- Storage key: `boms:draft:<userId>:<formKey>`. The user id is the writes.js identity (`getWriteIdentity()`). No user means nothing is stored.
- Changes are saved after the debounce. Pending saves are flushed on `pagehide` and on unmount. A clean form removes its stored draft.
- On mount, a same-user draft that has not expired is restored, and `restored` becomes true. Expired, corrupt or foreign entries are deleted.
- Idempotency keys are never stored. Any property matching `/idempotency/i` is stripped at any depth. Drafts are separate from writes.js `boms:pending:*` submissions.
- Sign-out (`signOut`) clears all of the user's drafts. When a different user signs in on the same tab, the other user's drafts are purged, along with expired drafts.

Page responsibilities:

- After a successful save, reset the form first, then call `clearDraft()`.
- Fields filled by the system after load, such as the suggested batch code, make the form dirty. Put them in `exclude`, or call `clearDraft()` after setting defaults when `restored` is false.
- Line `key`s created by a module counter can collide after a restore. Regenerate them in `deserialize`, for example `saved => ({ ...saved, items: saved.items.map(i => ({ ...i, key: createLineKey('rec') })) })`.
- Show a short "Draft restored" note with a Discard action when `restored` is true. Discard should reset the form and call `clearDraft()`.

`useDirtyGuard(isDirty)` confirms before leaving the route and sets a `beforeunload` prompt while dirty. Use it through `DirtyGuardDialog`. **Deviation:** the Quasar Dialog plugin is not installed (`quasar.config.js` only has Notify), so the confirmation is a `QDialog` component rather than `$q.dialog`.

- After sign-out, when there is no identity, the guard never blocks, so the redirect to `/auth` is not interrupted.
- The guard runs only on route leave. Changing a query on the same route, such as with TaskSelector, does not trigger it.

```vue
<script setup>
const form = reactive({ retailerId: null, items: [] })
const { isDirty, restored, clearDraft } = useFormDraft(
  'finance:reconciliation',
  form,
  { deserialize }
)
</script>
<template>
  <DirtyGuardDialog :when="isDirty" />
</template>
```

`DirtyGuardDialog` props:

- `when`: Boolean.
- `title`: default "Leave this form?".
- `message`: default "Your entries are kept as a draft on this device until you sign out."
- `stayLabel`: default "Stay on form".
- `leaveLabel`: default "Leave".

The dialog is a `role="alertdialog"` with an `h2` title. Focus starts on "Stay on form".

## ResponsiveRecordView (`src/components/ResponsiveRecordView.vue`)

One row, column and action definition renders as cards below 1024px and as a `QTable` at 1024px and wider.

| Prop                          | Default                 | Notes                                                                                                                                                                                                   |
| ----------------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `rows`                        | `[]`                    |                                                                                                                                                                                                         |
| `columns` (required)          | —                       | QTable columns plus optional `mobile: 'title' \| 'subtitle' \| 'meta' \| 'hidden'`. The default is `meta`, shown as a label/value pair. `format(value, row)` and function `field`s apply in both modes. |
| `rowKey`                      | `'id'`                  | String or function                                                                                                                                                                                      |
| `loading`                     | false                   | Skeleton cards on phones; QTable loading bar at 1024px and wider                                                                                                                                        |
| `pagination`                  | undefined               | `v-model:pagination`. Add `rowsNumber` for server mode and handle `@request` (QTable shape `{ pagination, filter }`). Phone cards page with `QPagination` and emit the same events.                     |
| `filter`                      | `''`                    | QTable filter. Phone cards apply the same case-insensitive text match in client mode.                                                                                                                   |
| `rowsPerPageOptions`          | `[10, 25, 50, 0]`       |                                                                                                                                                                                                         |
| `title` / `headingLevel`      | `''` / 2                | The title renders as `h{level}.section-title`. Card titles become `h{level+1}`.                                                                                                                         |
| `emptyTitle` / `emptyMessage` | "No records yet" / `''` | Used when the `empty` slot is not provided                                                                                                                                                              |
| `actionsLabel`                | `'Actions'`             | Table column header                                                                                                                                                                                     |

Slots:

- `actions` (`{ row }`): shared by cards and the table. An `actions` column is added to the table automatically.
- `empty`
- `toolbar`: filters next to the title.
- `cell-<name>` (`{ row, column, value }`): custom cell content in both modes.

Switching between modes uses `$q.screen.lt.md` with `v-if`, the same pattern as `ReportList`. This keeps one copy of the action buttons in the DOM and keeps `.q-table` out of the phone DOM, which existing tests check. Permissions belong to the page: render the same actions in the slot for both modes.

```vue
<ResponsiveRecordView
  title="Purchases"
  :rows="purchases"
  row-key="id"
  v-model:pagination="pagination"
  :columns="[
    {
      name: 'ref',
      label: 'Receipt',
      field: 'purchase_reference',
      mobile: 'title',
      sortable: true,
      align: 'left'
    },
    {
      name: 'supplier',
      label: 'Supplier',
      field: r => r.supplier?.supplier_name,
      mobile: 'subtitle',
      align: 'left'
    },
    {
      name: 'date',
      label: 'Received',
      field: 'received_at',
      format: v => formatDate(v),
      sortable: true
    },
    {
      name: 'total',
      label: 'Total',
      field: 'total_amount',
      format: v => formatMoney(v),
      align: 'right',
      sortable: true
    }
  ]"
>
  <template #actions="{ row }"><q-btn flat no-caps label="View" @click="open(row)" /></template>
  <template #empty><EmptyState title="No purchases yet" message="Recorded receipts appear here." /></template>
</ResponsiveRecordView>
```

## EmptyState (`src/components/EmptyState.vue`)

Props:

- `title`: a short reason.
- `message`: one sentence.
- `icon`: default `inbox`.

The default slot overrides `message`. The `actions` slot holds the permitted next action. It reuses `.empty-state` styling with a 12px radius and a subtle surface. Use it for empty lists only. Loading and unavailable states belong to `WorkspaceState`.

## Formatters (`src/lib/format.js`)

These are exact copies of the page helpers, so swapping them in causes no visual change.

| Export                                                                                                          | Behaviour                                                                              |
| --------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `formatMoney(v)`                                                                                                | `en-US` currency UGX, 0 decimals. Non-numeric input gives "UGX 0".                     |
| `formatQuantity(v, maxFractionDigits = 0)`                                                                      | Operations uses `formatQuantity(v, 3)`. Dashboard, Retail and Finance use the default. |
| `formatSignedQuantity(v)`                                                                                       | Retail movements: "+5" or "-3"                                                         |
| `formatDate(v, fallback = 'No date')`                                                                           | `dateStyle: 'medium'`                                                                  |
| `formatDateTime(v, fallback = 'No timestamp')`                                                                  | Medium date with short time                                                            |
| `asNumber(v, fallback = 0)`, `getTodayString()` (Kampala YYYY-MM-DD), `toIsoTimestamp(date)` (`T12:00:00.000Z`) | Shared helpers                                                                         |
| `formatMaterialKind`, `formatSupplierKind`, `formatMovementType`                                                | Label maps                                                                             |

The `en-UG` `toLocaleString` helpers in the manager components and `ReportList` were deliberately not merged, because their output differs.

## Pages touched

- `UnauthorizedPage.vue`: `h1` "Access restricted", with the previous sentence kept in the body text.
- `ErrorNotFound.vue`: `main` containing an `h1` "Page not found"; the 404 numeral is `aria-hidden`.

## Tests

- `tests/drafts.test.mjs`: user scoping, expiry, idempotency-key stripping, sign-out clearing, purging other users, storage failures.
- `tests/foundations.test.mjs`: formatter parity, the workspace mode enum and its transitions, timeout and abort handling, superseded responses, error classification.
- Both run under `npm test`.
