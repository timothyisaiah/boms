# BOMS capability matrix

Status: implemented as the client mirror of server rules (MF-05). Route visibility for the pre-existing routes is unchanged; the only new access is the `/settings` catalogue route for `admin_owner` and `operations_manager`, which matches what the server already authorized. Items marked **pending owner decision** need sign-off before anything is widened or narrowed.

- Source of truth (client): [`src/constants/capabilities.js`](../../src/constants/capabilities.js)
- Authorization boundary (server, unchanged): [`server/auth.ts`](../../server/auth.ts) (`ALL_ROLES`, `SUPPLY`, `RETAIL`, `REVIEW`, `FINANCE`, `FINANCE_WRITE`, `WRITE_ROLES`), [`server/workspaces.ts`](../../server/workspaces.ts) (`workspaceRoles`, per-projection `access`), `api/*.ts`
- Drift test: [`tests/capabilities.test.mjs`](../../tests/capabilities.test.mjs) (part of `npm test`) asserts the client matrix equals the server constants for all seven roles, that every visible route is backed by an authorized workspace read, that every write role can reach the page hosting that write, and that the only hidden-but-readable routes are the asymmetries listed below.
- Browser test: [`tests/browser/navigation.spec.js`](../../tests/browser/navigation.spec.js) checks drawer and bottom navigation against `routesForRole` / `primaryDestinations` at 375 px and 1280 px for every role, and that a direct URL to a non-permitted route lands on `/access-denied`.

## Matrix

Abbreviations: **Dash** `/` · **Ops** `/operations` · **Dist** `/retail` (Distribution) · **Fin** `/finance` · **Cat** `/settings` (Catalogue settings) · **Users** `/admin` (Users & access).

| Role                          | Visible routes (drawer)              | Bottom nav (< 1024 px)                       | Workspace reads (`/api/workspace`)               | Writes (`writeAction` names)                             | Settings                    |
| ----------------------------- | ------------------------------------ | -------------------------------------------- | ------------------------------------------------ | -------------------------------------------------------- | --------------------------- |
| `admin_owner`                 | Dash, Ops, Dist, Fin, **Cat**, Users | Dashboard, Operations, Distribution, Finance | dashboard, operations, retail, finance, settings | all 13                                                   | Catalogue; users and access |
| `operations_manager`          | Dash, Ops, Dist, Fin, **Cat** (new)  | Dashboard, Operations, Distribution, Finance | dashboard, operations, retail, finance, settings | all 13                                                   | Catalogue                   |
| `production_staff`            | Dash, Ops                            | Dashboard, Operations                        | dashboard, operations                            | production                                               | none                        |
| `warehouse_staff`             | Dash, Ops, Dist                      | Dashboard, Operations, Distribution          | dashboard, operations, retail                    | materials, suppliers, purchases, retailers, stock-issues | none                        |
| `sales_or_distribution_staff` | Dash, Dist                           | Dashboard, Distribution                      | dashboard, retail, finance ⚠                     | retailers, stock-issues                                  | none                        |
| `finance_accountant`          | Dash, Dist, Fin                      | Dashboard, Distribution, Finance             | dashboard, operations ⚠, retail, finance         | reconciliations, returns, remittances, expenses          | none                        |
| `read_only_management`        | Dash, Fin                            | Dashboard, Finance                           | dashboard, operations ⚠, retail ⚠, finance       | none                                                     | none                        |

⚠ = readable through the API but no route; see asymmetries.

All 13 write actions: `materials`, `variants`, `suppliers`, `retailers`, `purchases`, `production`, `stock-issues`, `reconciliations`, `returns`, `remittances`, `expenses`, `prices`, `recipes`. Supplier and retailer creation through `POST /api/partners` uses the same `suppliers` / `retailers` role sets.

Other reads: `api/materials` and `api/variants` → `SUPPLY`; `api/partners?kind=supplier` → `SUPPLY`, `?kind=retailer` → `RETAIL`; `api/users` → `admin_owner`. A signed-in account with no role sees only the dashboard route (the server rejects its reads).

Landing route after sign-in (`LANDING_ROUTES`): owner and operations manager → `/`; production and warehouse → `/operations`; sales/distribution → `/retail`; finance and read-only management → `/finance`.

### Where each write lives

| Write                                                 | Page          |
| ----------------------------------------------------- | ------------- |
| materials, variants, suppliers, purchases, production | `/operations` |
| retailers, stock-issues                               | `/retail`     |
| reconciliations, returns, remittances, expenses       | `/finance`    |
| prices, recipes                                       | `/settings`   |

Every role that the server allows to perform a write can open the page that hosts it (asserted in the test).

## Settings route change

- New `/settings` (`SettingsPage.vue`) hosts `CatalogueSettings` (variant prices, recipe defaults) for `admin_owner` and `operations_manager`. It reads `GET /api/workspace?name=settings` (`workspaceRoles.settings`) and writes `prices` / `recipes` (`WRITE_ROLES.prices`/`recipes`), all of which already allow both roles, so nothing inside the page has to stay owner-only.
- `/admin` is now "Users & access": user management, session status and the role list, owner only. Catalogue settings were removed from it and linked instead; the owner reaches them at `/settings`.
- Variant, material and supplier managers stay on `/operations` (unchanged); they already gate their own edit controls by role.

## Asymmetries: pending owner decision

Each is encoded as an explicit expectation in `tests/capabilities.test.mjs` (`EXPECTED_ASYMMETRIES`) and in `ROUTE_ASYMMETRIES`, so any change must update the policy deliberately.

| #   | Role                          | Server allows                                                                                                              | Client shows                 | Recommended resolution                                                                                                                                                                                                                                                                                                        |
| --- | ----------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `sales_or_distribution_staff` | `finance` workspace (`REVIEW`): reconciliations, remittances, retailer balances, expenses list, profit summary is withheld | No `/finance` route          | Narrow `workspaceRoles.finance` to `FINANCE`. Keep `REVIEW` on the per-projection `access` entries so the dashboard still shows sales staff their retailer balances. If sales needs to see outstanding balances in context, add a read-only "Retailer balances" panel to `/retail` instead of exposing the finance workspace. |
| 2   | `read_only_management`        | `retail` workspace (`RETAIL`)                                                                                              | No `/retail` route           | Grant `/retail` read-only (management oversight of dispatch and stock on hand). There are no retail writes for this role, so page actions are already hidden by `can('write:stock-issues')` / `can('write:retailers')`.                                                                                                       |
| 3   | `read_only_management`        | `operations` workspace (`SUPPLY`), `api/materials`, `api/variants`, supplier partners                                      | No `/operations` route       | Either grant `/operations` read-only (consistent with #2 for an oversight role), or narrow `workspaceRoles.operations` to the four route roles. Do not narrow the `SUPPLY` projection `access`; the dashboard uses it for inventory and purchase summaries.                                                                   |
| 4   | `finance_accountant`          | `operations` workspace (`SUPPLY`), `api/materials`, `api/variants`, supplier partners                                      | No `/operations` route       | Narrow `workspaceRoles.operations` (and `api/materials`/`api/variants` if no other screen needs them) to the operations route roles; finance sees valuation through the dashboard and reports. Alternative: a read-only purchases/lots view if accountants audit supplier costs.                                              |
| 5   | `finance_accountant`          | `retail` workspace, no retail writes                                                                                       | `/retail` visible, read-only | Keep (existing behaviour). Recorded so the page shows no write actions for this role.                                                                                                                                                                                                                                         |
| 6   | `production_staff`            | `operations` workspace; only `production` write                                                                            | `/operations` with managers  | Keep. Variant/material/supplier managers and receipt forms must stay hidden or disabled for this role (`can('write:materials')`, etc.).                                                                                                                                                                                       |

Not route-related but worth recording: `api/reports.ts` gates report sections with `SUPPLY` / `REVIEW` / `FINANCE`, so sales staff receive review sections on the dashboard report; this matches #1's recommendation to keep `REVIEW` on dashboard data.

## Client API (for page work)

```js
import {
  can,
  canWrite,
  routesForRole,
  primaryDestinations,
  defaultRouteForRole
} from '@/constants/capabilities'
import { authState } from '@/services/auth'

const canIssueStock = computed(() => can(authState.role, 'write:stock-issues'))
// equivalent: canWrite(authState.role, 'stock-issues')
```

- `can(role, capability)` → boolean. Unknown capabilities, unknown roles and `null` are denied; roles are normalized like `normalizeRole`. Capability names:
  - `route:<name>` — `dashboard`, `operations`, `retail`, `finance`, `settings`, `admin`
  - `read:<workspace>` — `dashboard`, `operations`, `retail`, `finance`, `settings`; `read:<api>` — `materials`, `variants`, `partners:supplier`, `partners:retailer`, `users`
  - `write:<action>` — the `writeAction()` action names listed above
  - `settings:catalogue`, `admin:users`
- `canWrite(role, action)` — shorthand for `can(role, 'write:' + action)`.
- `rolesFor(capability)` — the role list, e.g. for tests or labels.
- `routesForRole(role)` — destination objects in drawer order (`name`, `path`, `label`, `caption`, `icon`, `title`, `group: 'primary' | 'settings'`, `workspace`, `roles`).
- `primaryDestinations(role)` — bottom navigation items: the role's `primary` destinations, at most 4; if a role ever has more than 4, the 4th slot is a `{ name: 'more', more: true }` item that opens the drawer; empty when there is only one destination (bar hidden).
- `defaultRouteForRole(role)` — landing route; `getDefaultRouteForRole` in `roles.js` re-exports it.
- Constants: `ROLES`, `ROLE_SETS`, `WORKSPACE_READ_ROLES`, `API_READ_ROLES`, `WRITE_ROLES`, `DESTINATIONS`, `LANDING_ROUTES`, `ROUTE_ASYMMETRIES`.

Router `meta.allowedRoles` and the drawer/bottom navigation are generated from `DESTINATIONS`, so adding or changing a route's roles is a one-line change in `capabilities.js` (plus the drift test's expected table).

### Remaining duplicated role arrays (follow-up)

These predate the matrix and should move to `can()` when their owners next touch them: `FinancePage.vue` (`canRecord*`), `RetailPage.vue` (`canIssueStock`), `OperationsPage.vue`, `MaterialManager.vue`, `VariantManager.vue`, `PartnerProfiles.vue`, `AddPartnerButton.vue`, `BusinessReport.vue`, and the `*_ROLES` arrays in `src/services/dashboard.js`. Their current values agree with the server role sets (checked manually when this matrix was written; they are not covered by the drift test).
