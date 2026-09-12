# Neon migration and validation record

Updated September 12, 2026. The supplied Neon database was initially empty. Thirteen forward migrations and the preserved reference seed have been applied. The configured legacy administrator was provisioned with the same credentials, hashed with bcrypt. No secrets were placed in source, output, or this document.

## API and permission coverage

The Vue services now call these same-origin handlers. Table names and projections are server allowlists, never client SQL. Drizzle's `neon-http` adapter serves plain reads; the Neon driver runs transaction-wrapped Postgres functions for business writes.

| Handler                          | Coverage                                                                                                                 | Authorization                                                                                             |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| `/api/auth`                      | Credential login, session identity, sign-out                                                                             | Shared role check on identity; login establishes identity; logout can revoke expired/deactivated sessions |
| `/api/workspace?name=operations` | Variants, materials, suppliers, purchases/items, inventory lots, batches/inputs/outputs, recipes                         | Supply roles from legacy policy intent                                                                    |
| `/api/workspace?name=retail`     | Retailers, finished stock, issues/items, retailer ledger                                                                 | Retail roles from legacy policy intent                                                                    |
| `/api/workspace?name=finance`    | Open issue lines, reconciliations/items, remittances, balances, expenses, profit, prices                                 | Review access; expense/profit collections restricted to finance roles                                     |
| `/api/workspace?name=dashboard`  | Allowed operational and finance collections                                                                              | Every collection filtered by role, including nested production inputs                                     |
| `/api/workspace?name=settings`   | Recipes/items and variant price history                                                                                  | Owner or operations manager                                                                               |
| `/api/write?action=…`            | Purchases, production, stock issues, reconciliation, returns, remittance, expenses, prices, recipes, variants, materials | Central `WRITE_ROLES` before payload validation and business queries                                      |
| `/api/reports`                   | Weekly operations and monthly business review                                                                            | Role check and restricted financial sections                                                              |
| `/api/cleanup`                   | Expired sessions, idempotency keys older than 48 hours, old login attempts                                               | Machine-only `CRON_SECRET` authentication                                                                 |
| `/api/partners?kind=…`           | Searchable supplier/retailer profiles, contact details, active status                                                    | Matching operational read roles; edits use partner write roles                                            |

Write roles preserve the existing RLS policy intent:

| Action                                       | Permitted roles                                                      |
| -------------------------------------------- | -------------------------------------------------------------------- |
| Purchase receipt                             | Owner, operations manager, warehouse staff                           |
| Production                                   | Owner, operations manager, production staff                          |
| Stock issue                                  | Owner, operations manager, warehouse staff, sales/distribution staff |
| Reconciliation, returns, remittance, expense | Owner, operations manager, finance/accountant                        |
| Prices and recipes                           | Owner, operations manager                                            |
| Variants                                     | Owner, operations manager                                            |
| Materials                                    | Owner, operations manager, warehouse staff                           |

Sessions use random 32-byte opaque tokens and a seven-day `HttpOnly; Secure; SameSite=Lax` cookie. Every protected request reloads the session and active user role from Neon, so deactivation or role changes take effect immediately. Sign-out deletes the row. Writes also check same-origin requests. Password hashing uses bcrypt cost 12; sign-in attempts are rate-limited in the database. Browser code contains no Neon credentials or Supabase client.

## Transactional behavior

Supply material management lives in **Operations → Add material / Manage materials**.
Migration `202609110011_material_management.sql` adds `/api/write?action=materials`
support for creating, editing, deactivating, and reactivating materials. Owner,
operations manager, and warehouse roles can write; `/api/materials` lists active
and inactive definitions and available open-lot quantities for supply read roles.
Codes reject case/space duplicates, including concurrent creates. Names, codes,
descriptions and exact decimal thresholds can change; type and unit stay fixed
after creation. Receipts determine stock and historical costs. Deactivation removes
a material from new receipt pickers and preserves existing lots and history.
Before/after profiles, actor and retry key are audited in the same transaction.
`tests/materials.test.mjs` covers these invariants; `tests/neon.test.ts` covers real
API permissions, validation, competing creates, retries, stock preservation, and
picker visibility. `tests/browser/materials.spec.js` covers phone/desktop entry,
search, editing, activation, receipt selection, duplicate recovery, and retry after
a lost response and page reload.

Migration `202609120012_variant_management.sql` adds **Operations → Add variant /
Manage variants**. Owners and operations managers can add a variant under an
existing active product or create the product and variant atomically. SKU uniqueness
is enforced case-insensitively, and the manager supports search, editing, and
activation changes. Variant product assignment stays fixed after creation to protect
completed batch and costing history. Active variants feed the production-batch
picker; inactive variants remain visible in history. The same transaction records
before/after profiles and idempotent retry results. `tests/variants.test.mjs`,
`tests/neon.test.ts`, and `tests/browser/variants.spec.js` cover roles, duplicate
SKUs, replay, lifecycle changes, and batch selection.

Migration `202609120013_add_spice_material_kind.sql` adds `spice` as a forward-only
material and supplier type. Existing raw-honey and packaging records are unchanged.

Supplier and retailer creation is restored in the Operations and Distribution workspace headers. Migration `202609110009_partner_creation.sql` adds the transaction function used by `/api/write?action=suppliers` and `retailers`. The shared role allowlist, validation, UUID retry contract, and audit ledger cover both actions. Names remain case-insensitively unique; existing records are unchanged. The returned ID selects the new supplier/retailer after a workspace refresh. Local database tests and the Neon lifecycle test verify contacts, duplicate prevention, concurrent retries, and subsequent purchases/stock issues. Browser checks cover creation and picker selection on phones and desktops, including a failed connection followed by retry.

Migration `202609110010_partner_profiles.sql` adds audited supplier and retailer profile updates. The profile managers include active and inactive records, search names and contact fields, filter by status, and edit all partner details. Deactivation preserves foreign-key-linked operational history and removes the partner from active workspace pickers. Updates lock the target row for a short transaction, recheck the actor's current role in SQL, and record complete before/after profiles in `partner_profile_audits`.

Administration includes a searchable user list, account creation, role/name edits, activation/deactivation, and password resets through admin-only `/api/users`. Migration `202609110008_user_management.sql` adds a serialized access-change function and `user_access_audits`; passwords and hashes are excluded from audits and responses. Queued changes recheck the acting administrator, the last active administrator is protected, and administrators cannot change their own role/active status. Password resets and deactivation revoke sessions. Sign-in locks the current credential row while creating a session so a concurrent reset cannot leave a session authenticated with an obsolete password. `tests/users.test.mjs`, `tests/users-neon.test.ts`, and phone/desktop `tests/browser/users.spec.js` verify this workflow. These account operations use POST/PATCH with unique email addresses; the inventory/financial idempotency mechanism below is separate and never stores account passwords.

All writes require a UUID `Idempotency-Key`. The server hashes the canonical request body and scopes replay to the same action and actor. A matching committed retry returns its saved status/body; changed payload, action, or actor returns 409. The idempotency result, audit entry, and business mutation commit together. Failed validation rolls back the entire action. Concurrent uses of one key serialize on its row.

The client disables repeat taps, displays pending/validation/network states, and keeps an uncertain submission's original body and key in user-scoped session storage. Retrying sends exactly that body and key, including after reload. Saved retries expire after 47 hours, before the server's 48-hour cleanup horizon; after that, staff must check the recorded reference before making a new submission.

Production and issues select and lock inventory inside their SQL transaction. Explicit selections lock rows in deterministic order; FIFO uses chronological ordering and `FOR UPDATE SKIP LOCKED`. Reconciliation locks output and issue rows before rereading the ledger, preventing two different keys from settling the same remaining stock. No browser or API pre-read authorizes a later independent stock decrement.

Fixed-precision Postgres quantities/money remain authoritative. Variant prices are selected by reconciliation date and stored on each reconciliation item; client-supplied prices are rejected. Sales create retailer liability. Good returns restore warehouse stock; damaged/expired quantities leave consignment without creating sales liability or restoring sellable stock. The SQL records batch, reason, condition, and disposition for those outcomes. Multiple linked remittances reduce cumulative liability, and inactive retailers retain historical balances and profit contributions.

## Assumptions and configuration

- Reporting dates and form defaults use Africa/Kampala. Weekly periods are seven days; monthly review uses calendar months. Month-end valuation includes owned finished goods still on consignment at recorded historical cost.
- Aging allocates retailer cash to the oldest recognized sales first. A remittance's reconciliation link remains traceability metadata; it does not create a separate balance. Remittance timeliness uses linked payments, so unlinked payments do not invent a period match.
- Recipes hold per-unit material quantities, multiplied to three decimal places for editable actual inputs. No unverified recipes or selling prices were seeded; configure them in Administration.
- No shelf-life duration was supplied. Batch expiry is optional, entered explicitly, and missing expiry is shown as unknown. Low-stock thresholds initially default to zero; configure the `materials` and `product_variants` thresholds to business-approved levels. The digest includes stock/expiry conditions; no paid messaging service was added.
- One warehouse is seeded and stock entities carry a warehouse FK. There is no multi-warehouse UI.
- The existing Vue JavaScript pages remain; the new API is TypeScript. No Next.js rewrite was introduced.

## Verification evidence

`tests/migrations.test.mjs` applies the complete forward history to an isolated embedded Postgres engine. `tests/domain.test.mjs` verifies the operational lifecycle, rollback, audit entries, prices, recipes, partial remittance, damage/expiry, inactive retailer history, and historical report totals.

The accounting scenario receives UGX 110,000 of inputs and produces 20 jars at UGX 5,500 each. From 15 issued jars, 5 sold, 2 returned, 1 damaged, 1 expired, and 6 remaining yield UGX 100,000 liability. Two remittances totaling UGX 50,000 leave UGX 50,000 outstanding; UGX 10,000 expense produces UGX 62,500 net profit. Historical owned finished-goods valuation is UGX 71,500 after those movements.

`tests/neon.test.ts` passed against the supplied Neon database: real credential authentication, all workspace reads, all seven roles against all thirteen write actions, immediate deactivation/sign-out, duplicate-key replay/conflicts, simultaneous competing stock issues and reconciliations, FIFO skipping a held oldest lot, partial payments, reports, and authenticated cleanup. The test cleans its unique actor-owned operational fixtures afterward. This verifies all operational validation steps previously recorded for Supabase against Neon; it is not evidence of a deployed Vercel application or a completed parallel business trial.

`tests/browser/mobile.spec.js` passed seven Chrome tests: six routes at 375/390/1280 pixels without horizontal overflow or runtime errors, inline validation, exact retry payload/key reuse, editable recipe defaults, readonly reconciliation price, all six operational form payloads accepted by the API schema, and report cards on phones/tables on desktop. These use controlled API fixtures. The optional `live-neon.spec.js` also passed with actual browser cookie authentication, four workspace reads through the local API, and sign-out against Neon.

## Remaining rollout gates

Final checks also passed: server TypeScript checking, formatting/lint, and the production Quasar build. A scan of all 31 browser text artifacts found none of the configured server-only database credentials, passwords, or secrets.

1. **Vercel project/integration/deployment:** no project link or eligible account arrangement was available. Configuration is ready, but the published [Hobby plan restriction](https://vercel.com/docs/plans/hobby) is personal, non-commercial use. The business-use assumption in the original prompt therefore needs an eligible arrangement that meets the no-added-cost requirement. No paid service or tier was purchased. Configure server secrets, link the intended Neon branch, deploy, verify HTTPS cookie behavior and the scheduled job before production use.

**Supabase retirement completed September 12, 2026:** the owner chose backup-only retention of the August operational history. A full export was taken and application/authentication data restored and verified before the hosted BOMS project was deleted. The archived history was not imported into Neon. See the [retirement record](supabase-retirement.md) for backup location and evidence.

Use separate migration and restricted application credentials for a production rollout where available. Browser users never receive database credentials; API role checks remain the authorization boundary. Historical SQL is retained under `docs/archive/supabase/migrations/`; the original hosted seed/provision scripts are in the private retirement backup.
