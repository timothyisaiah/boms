# BOMS Agent Charter

## Mission

Initiate, guide, and accelerate the ideation, architecture, and development of the Beecone Operations Management System (BOMS).

BOMS exists to make Beecone's operations fully traceable from raw honey purchase to retailer remittance and profitability reporting.

Core promise:

> Every kilogram of honey, every packaging item, every finished jar, and every payment should be accounted for.

## Product Context

- Business: Beecone Honey
- Product: Beecone Raw Natural Honey
- Current complexity: one product with multiple sizes and flavors, with future expansion expected
- Business model: production, warehousing, distribution, retail reconciliation, and financial reporting
- Reference stack (current, post Supabase → Neon migration):
  - Frontend: Vue 3 + Quasar + TypeScript, mobile-first responsive layout
  - API layer: Vercel Serverless Functions (Node.js/TypeScript) — thin REST/RPC
    layer between the Vue app and the database. Required because Neon has no
    built-in PostgREST-equivalent; the browser never talks to Postgres
    directly. **This lives in the same repo as the Vue+Quasar app**, as a
    top-level `/api` directory of plain TypeScript handler files — Vercel
    deploys any `/api/*.ts` file as a serverless function regardless of
    frontend framework. No migration to Next.js is needed for this. Next.js
    would only earn its keep if BOMS later needs server-side rendering,
    edge middleware, or tighter file-based routing conventions — none of
    which apply here; it would mean rewriting a working Quasar app for no
    functional gain. Revisit only if a concrete need for SSR/edge shows up.
  - Database: Neon (serverless Postgres), accessed via the
    `@neondatabase/serverless` driver (HTTP/fetch-based, no long-lived pool —
    fits serverless function lifecycles better than a traditional `pg` pool)
  - ORM/query layer: Drizzle ORM with the `neon-http` adapter for simple
    queries; hand-written SQL for existing Postgres functions (see Domain
    Rules) called through the same driver inside a transaction
  - Auth: custom, database-backed sessions (see "Auth Replacement" below) —
    no Supabase Auth
  - Authorization: enforced in the API layer per request (role checks in
    each endpoint), not via Postgres RLS — see "RLS Replacement" below
  - Platform capabilities previously provided by Supabase and now DIY:
    Auth, RLS enforcement, scheduled jobs (Vercel Cron, free on Hobby tier,
    daily-granularity), storage (defer — not yet used; if needed later use
    Vercel Blob or Cloudflare R2 free tier)
  - Deployment: Vercel (frontend static build + serverless functions in one
    project, same platform as the database for lowest latency and a single
    place to manage env vars/previews). Cloudflare Pages/Workers is retired
    as the deployment target for this project.
- Currency: UGX

## Architecture Change Log

- **2026 — Supabase → Neon + Vercel migration.** The Supabase-hosted
  Postgres, Auth, and RLS layer was replaced with Neon (serverless
  Postgres) fronted by Vercel Serverless Functions. Reason: an architectural
  issue was found with the Supabase layer during development. Both are
  Postgres, so the schema, data, and business rules below are unaffected —
  what changes is how the app authenticates users, enforces permissions, and
  talks to the database. Priority for the migration is **simplicity and
  zero paid services**, not maximum scalability. See "Database & Backend
  Migration to Neon" under the Implementation Progress Tracker, and "Neon +
  Vercel Process" for the concrete
  workflow. Do not reintroduce Supabase-specific assumptions (RLS policies,
  `supabase.rpc()`, `auth.users`) in new work.
- **2026 — Mobile-first UI.** Most BOMS users (warehouse, sales/distribution,
  retail reconciliation staff) work primarily on phones. All UI work goes
  mobile-first from this point forward — design and build for a phone
  viewport first, then scale up to tablet/desktop. See "Mobile-First UI
  Standard" under UX Expectations. Existing desktop-oriented screens should
  be revisited opportunistically, not necessarily all at once.

- **November 2026 — Simple operations (one-tap home).** Daily work moved to a
  `/home` screen with five big actions: Make jars, Stock in, Give to retailer,
  Sell, Check in retailer. Each is one server action that composes the
  existing audited functions (FIFO lots, batch costing, reconciliation,
  remittance), so ledgers and reports are unchanged in meaning. The detailed
  module screens remain for corrections and history. See "Simple Operations"
  under Domain Rules and migration `202611160014_simple_operations.sql`.

## Primary Goal

Build a system that mirrors Beecone's real operating flow:

1. Raw honey purchased
2. Packaging materials purchased
3. Production batch created
4. Finished jars produced
5. Warehouse inventory updated
6. Stock issued to retail partners
7. Retail sales and reconciliation recorded
8. Retailer remittances tracked
9. Profitability and operational reports generated

If a feature does not support or improve this flow, it is lower priority.

## Product Principles

- Model the real business, not an abstract inventory app.
- Preserve batch traceability end to end.
- Keep physical inventory movement separate from financial recognition.
- Make the product catalogue extensible without code changes.
- Prefer auditable records over hidden automation.
- Design for low-friction data entry by operations staff.
- Support historical accuracy; avoid overwriting transactional truth.
- Optimize for operational clarity before advanced polish.

## Core Capabilities

The system should cover these domains:

1. Product catalogue with variants, SKUs, and future flavor expansion
2. Raw materials inventory for honey and packaging
3. Supplier management
4. Purchasing and material receipts
5. Production batching and costing, with optional recipe templates that pre-fill (but never lock) input quantities
6. Batch traceability
7. Warehouse stock by batch
8. Retail partner management
9. Stock distribution to shops
10. Retail inventory monitoring
11. Retail reconciliation and remittance tracking
12. Shop-to-shop transfers
13. Returns and damage handling
14. Operating expense tracking
15. Costing engine and profitability analysis
16. Dashboard and monthly business review analytics

## Users and Roles

Plan for role-based access from the beginning:

- Admin / Owner
- Operations Manager
- Production Staff
- Warehouse Staff
- Sales or Distribution Staff
- Finance / Accountant
- Read-only Management

Each role should only see and do what is necessary.

## Domain Rules To Preserve

- A production batch must consume raw materials and packaging.
- Finished goods must exist at the batch level, not only at product level.
- Warehouse inventory should support FIFO by batch.
- Distribution to a retailer is an inventory movement, not automatically a finalized sale.
- All retailers operate on consignment (confirmed) — stock issued to a
  retailer remains Beecone's inventory liability until reconciled as sold;
  there is no "outright purchase by retailer" flow to build.
- Retail reconciliation must support sold, returned, damaged, remaining, remitted, and outstanding values.
- Damaged and expired quantities reduce retailer financial liability
  automatically at reconciliation time (confirmed) — only the "sold"
  quantity creates a payment obligation; damaged/expired never requires a
  manual adjustment step to remove it from what the retailer owes.
- Returns must retain batch, reason, condition, and disposition.
- Product, packaging, and supplier prices should remain historically accurate per transaction.
- Every product variant has a single current price, not a per-retailer or
  per-campaign price (confirmed) — the `pricing` entity tracks price
  history over time per variant, not a price matrix across retailers.
- Remittances may be partial and multiple against a single reconciliation
  period (confirmed) — outstanding balance is always (total liability from
  reconciliations to date) minus (sum of remittances to date), never a
  single expected-payment record that a remittance either satisfies or doesn't.
- Cost per jar should be derived, explainable, and reproducible.
- Production inputs may optionally be pre-filled from a recipe template,
  but actual recorded consumption per batch always remains manually
  editable (confirmed) — a recipe is a convenience default, never a locked
  source of truth, since real input quantities vary batch to batch.
- The system currently assumes a single warehouse (confirmed no near-term
  need for multi-warehouse). Keep a `warehouse_id` foreign key on
  warehouse-scoped tables now, pointed at one seeded warehouse row, so
  multi-warehouse can be added later without a schema rewrite — but do not
  build any multi-warehouse UI or logic until it's actually needed.

### Simple Operations (confirmed November 2026)

- Catalogue: two products (Raw Honey, Ginger Infused Honey) in 60g, 400g and
  1kg jars. Raw honey is bought in 20 kg jerricans (`materials.purchase_unit_*`
  converts jerricans to kg at entry). Ginger honey mixes 20 kg honey with
  1 kg ginger powder, so a jar is 20/21 honey and 1/21 ginger by weight.
- Barcodes are one shared code per variant (`product_variants.barcode`), not
  per jar. Scanning a jar adds one unit of that variant; the batch is chosen
  FIFO. Context decides the movement: Give = consignment issue, Sell = direct
  sale, Check in = count of jars still on the retailer's shelf.
- Selling price is preset per variant (`pricing`); production cost is still
  derived from consumed lots.
- "Make jars" (`record_production_run`) creates one costed batch per variant
  from its recipe and refuses the whole run with a per-material shortage
  message if any input is short. Recipes stay editable defaults.
- Retailers remain consignment. A check-in (`record_retailer_checkin`) treats
  held − on shelf − damaged as sold (oldest issue lines first) and can record
  the money collected as a remittance in the same transaction.
- Direct sales to customers (`direct_sales`) are a second sales channel:
  revenue is recognised immediately at the preset price and is included in
  `finance_profit_summary`, `business_report`, stock valuation and digests.

## Recommended Data Foundations

Design the early schema around these entities:

- products
- product_variants
- raw_materials
- packaging_materials
- suppliers
- purchases
- purchase_items
- inventory_lots
- production_recipes
- production_recipe_items
- production_batches
- production_inputs
- production_outputs
- warehouses (single seeded row for now; see Domain Rules)
- warehouse_stock
- retailers
- stock_issues
- retailer_stock_ledgers
- reconciliations
- remittances
- returns
- expenses
- pricing (one active/historical price per variant — no retailer or
  campaign dimension; see Domain Rules)
- users
- sessions
- roles
- audit_logs
- idempotency_keys (see Idempotency & Concurrency Requirements)

`production_recipes` defines the standard raw-material and packaging
quantities per output unit for a given product variant;
`production_recipe_items` is its line items. When starting a new
production batch, the UI pre-fills `production_inputs` from the matching
recipe if one exists, but every quantity stays editable before the batch is
recorded — the recipe is a data-entry shortcut, not a constraint enforced
by the schema.

Use append-only ledgers for movements where possible instead of storing only current balances.

## Ideation Workflow

When planning features, work in this order:

1. Clarify the real-world workflow and business rule.
2. Define the source of truth and transactional events.
3. Identify required actors, permissions, and approvals.
4. Model the data and lifecycle states.
5. Define the operational UI flow for data entry and review.
6. Define reports, calculations, and exception handling.
7. Decide what is MVP versus later enhancement.

## MVP Scope

The first usable release should focus on the smallest system that gives Beecone end-to-end visibility.

### MVP Modules

- Authentication and roles
- Product catalogue and variants
- Raw materials and packaging inventory
- Supplier management
- Purchasing
- Production batches with costing
- Warehouse stock by batch
- Retail partners
- Stock issue to retailers
- Retail reconciliation
- Remittance tracking
- Core dashboard metrics

### Post-MVP Modules

- Shop-to-shop transfers
- Advanced returns workflows
- Scheduled low-stock and expiry alerts
- Deeper profitability analytics
- File attachments and document storage
- Forecasting and procurement planning

## Phased Delivery Plan

### Phase 0: Discovery and Alignment

- Confirm user roles and approval flows
- Confirm whether all retailers are consignment-based or mixed
- Confirm pricing rules by size, flavor, and retailer
- Confirm how returns affect stock and accounting
- Confirm batch naming, shelf life, and expiry rules
- Confirm expense categories and reporting periods

### Phase 1: Foundation

- Initialize Vue 3 + Quasar + TypeScript app
- Set up Supabase project structure
- Implement authentication and role model
- Create core database schema and RLS policies
- Seed product variants, materials, and sample suppliers

### Phase 2: Supply and Production

- Build purchasing workflows
- Build raw material and packaging stock updates
- Build production batch creation
- Implement cost calculations and batch output records

### Phase 3: Warehouse and Distribution

- Track finished stock by batch
- Implement stock issue to retailers
- Add retailer stock views and movement history

### Phase 4: Reconciliation and Finance

- Capture sold, returned, damaged, remaining, and remitted values
- Track retailer outstanding balances
- Add expenses and gross profit views

### Phase 5: Reporting and Hardening

- Build dashboards and monthly review views
- Add alerts for low stock and expiring batches
- Improve audit logs, validation, and usability

## Implementation Progress Tracker

Last updated: September 12, 2026

Use this checklist as the implementation source of truth. Update it whenever a
phase item materially changes from planned to delivered.

### Phase 0: Discovery and Alignment

- [ ] Confirm user roles and approval flows
- [ ] Confirm whether all retailers are consignment-based or mixed
- [ ] Confirm pricing rules by size, flavor, and retailer
- [ ] Confirm how returns affect stock and accounting
- [ ] Confirm batch naming, shelf life, and expiry rules
- [ ] Confirm expense categories and reporting periods

### Phase 1: Foundation

- [x] Initialize Vue 3 + Quasar app scaffold
- [x] Set up Supabase project structure
- [x] Implement authentication and role model
- [x] Create core database schema and RLS policies
- [x] Seed product variants, materials, and sample suppliers
- [x] Add and manage product variants for production batches

### Phase 2: Supply and Production

- [x] Build purchasing workflows
- [x] Build raw material and packaging stock updates
- [x] Add and manage supply materials, stock thresholds, and active status
- [x] Build production batch creation
- [x] Implement cost calculations and batch output records

### Phase 3: Warehouse and Distribution

- [x] Track finished stock by batch
- [x] Implement stock issue to retailers
- [x] Add retailer stock views and movement history

### Phase 4: Reconciliation and Finance

- [x] Capture sold, returned, damaged, remaining, and remitted values
- [x] Track retailer outstanding balances
- [x] Add expenses and gross profit views

### Phase 5: Reporting and Hardening

- [x] Build dashboards and monthly review views
- [x] Add alerts for low stock and expiring batches
- [x] Improve audit logs, validation, and usability

### Phase 6: Database & Backend Migration to Neon

- [x] Provision Neon project (done outside this repo)
- [ ] Stand up Vercel project, link Neon via the Vercel-Neon integration
- [x] Build the API layer (Vercel Serverless Functions) covering every table
      currently accessed directly via `supabase-js` from the Vue app
- [x] Create `users`/`sessions` tables and implement cookie-session auth
- [x] Port `app_role` checks from RLS policies into a shared
      `requireRole()` helper used across API routes
- [x] Port existing Postgres RPC functions (`record_production_batch`,
      stock issue, reconciliation, remittance, expense) to Neon unchanged,
      call them from API routes inside transactions
- [x] Replace all `supabase-js` calls in the Vue app with calls to the new
      API endpoints
- [x] Re-seed reference data (products, variants, materials, suppliers,
      retailers) into Neon
- [x] Re-verify every item in "Current Operational Validation Steps" against
      the Neon-backed stack
- [x] Decommission the Supabase project after a verified final backup/export
      (September 12, 2026; owner chose backup-only retention of legacy records)

### Phase 7: Mobile-First UI Pass

- [x] Audit existing screens against the Mobile-First UI Standard below
- [x] Convert dense desktop tables (retailer ledgers, reconciliation,
      dashboard) to card/list layouts below the `md` breakpoint
- [x] Convert primary navigation to a bottom nav / drawer pattern on mobile
- [x] Verify all data-entry forms (purchase receipt, production batch,
      stock issue, reconciliation, remittance, expense) are usable one-handed
      on a phone

### Phase 8: Resolved Decisions — Implementation

- [x] Remove/avoid any per-retailer or per-campaign pricing path; confirm
      `pricing` is variant-only with history
- [x] Ensure the reconciliation function deducts damaged and expired
      quantities from retailer liability automatically, with no manual
      adjustment step
- [x] Confirm/extend remittance flow to support multiple partial payments
      against one reconciliation period, with outstanding balance computed
      as liability-to-date minus remittances-to-date
- [x] Add `production_recipes` / `production_recipe_items` schema; use to
      pre-fill (not lock) production batch input entry
- [x] Add `idempotency_keys` table; require `Idempotency-Key` header on all
      inventory- and money-moving endpoints
- [x] Add row-locking (`SELECT ... FOR UPDATE`, `FOR UPDATE SKIP LOCKED`
      for FIFO lot selection) to every Postgres function that consumes
      `inventory_lots` or decrements `production_outputs.quantity_remaining`
- [x] Add weekly report views (stock movement, retailer aging, low
      stock/expiry digest, reconciliation summary, cost-per-jar trend)
- [x] Confirm monthly report views cover profitability, inventory
      valuation, retailer performance ranking, and expense breakdown

## Current Delivery Snapshot

As of September 12, 2026, phases 7 and 8 are implemented and verified. Phase 6
code, Neon migrations, reference seed, administrator provisioning, and operational
validation are complete. The API uses database-backed cookie sessions and shared
role checks; all browser data access goes through `/api`. Eleven forward Neon
migrations preserve SQL business transactions and add retry safety, row locking,
variant price history, editable recipes, expired-stock handling, and weekly/monthly
reports. Chrome checks cover 375, 390, and 1280 pixel layouts and all six write forms.
Real Neon integration checks cover the full operational lifecycle, all write-role
combinations, competing writes, replay, FIFO locks, and cleanup.

Administrator user management is delivered in **Access and settings → Users and
access**: add users, assign roles, activate/deactivate accounts, and reset passwords.
The administrator-only `/api/users` handler audits changes, revokes sessions for
deactivation/password resets, and prevents removal of the last active administrator.
Database, Neon API, and phone/desktop browser tests cover this workflow.

Supplier and retailer creation is restored through **Operations → Add supplier**
and **Distribution → Add retailer**. New records include contact details and
supplier type or delivery location, refresh the workspace pickers, and use audited,
idempotent API writes. Existing partner records are preserved. Supplier creation
allows owner/operations/warehouse roles; retailer creation also allows sales staff.

The adjacent **Manage suppliers** and **Manage retailers** views search active and
inactive profiles by their contact fields, edit profile details, and control status.
Deactivation preserves all transactional history while removing the partner from new
transaction pickers. Before/after profile changes are written to an audit table.

Supply material management is delivered through **Operations → Add material** and
**Manage materials**. Owners, operations managers, and warehouse staff can add raw
honey, packaging, or spices, edit codes, names, descriptions and low-stock thresholds, and
deactivate/reactivate materials. Search and type/status filters include inactive
records, with available quantities derived from open inventory lots. Type and unit
are fixed after creation to preserve quantity and costing consistency. Inactive
materials leave receipt pickers while existing lots and transaction history remain.
Migration `202609110011_material_management.sql` adds atomic, audited, idempotent
saves; database, live Neon API, and phone/desktop browser tests cover this workflow.

Product variant management is delivered through **Operations → Add variant** and
**Manage variants**. Owners and operations managers can attach a variant to an
active product or create the product and variant together, then set its SKU, flavour,
pack size, packaging, threshold, and active status. Active variants feed the new
production-batch selector. Product assignment is fixed after creation so completed
batches and costing history remain traceable. Migration
`202609120012_variant_management.sql` provides atomic, audited, idempotent saves;
the following migration adds `spice` as a material and supplier type.

Vercel project/integration deployment remains unchecked and needs an eligible
business-use arrangement consistent with no added cost. Supabase was retired on
September 12, 2026 after a full export and verified isolated restore. The owner
chose to retain August history only in the private backup, without importing it
into Neon. See [the retirement record](docs/supabase-retirement.md). No paid tier
was introduced.
See [validation evidence and assumptions](docs/neon-migration.md) and the
[screen audit](docs/mobile-audit.md). Low-stock thresholds default to zero and expiry
is explicit/unknown until supplied; prices and recipes require business configuration.

The following historical snapshot records the August 16, 2026 delivery:

- Supabase-backed authentication and role-aware route protection
- `public.user_profiles` sync from `auth.users`
- core catalogue, material, supplier, purchasing, inventory lot, production,
  retailer, and warehouse distribution schema
- RLS policies for the new operational tables
- remote seed flow for Beecone products, variants, materials, suppliers, and
  retailers
- purchase receipt entry that creates inventory lots
- production batch entry that consumes real lots and calculates output unit cost
- finished stock visibility tied to production batch outputs
- stock issue entry that decrements warehouse stock and writes retailer ledger
  movements
- retailer reconciliation entry that records sold, returned, damaged, and
  remaining outcomes against issued stock lines
- remittance entry that tracks retailer cash collections separately from stock
  recognition
- expense entry and finance summary views for outstanding balances, gross
  profit, and net result review
- a role-aware dashboard with monthly review, trend, watchlist, and activity
  views for phase 5 reporting
- phase 2, phase 3, and phase 4 workspaces in the app for supply, production,
  warehouse, distribution, and finance workflows

## Environment Rule: No Docker Workflow

BOMS uses a hosted, serverless workflow (Neon + Vercel) and is not using
Docker for day-to-day development or deployment.

Unless the team explicitly changes direction:

- do not assume Docker Desktop is installed or available
- do not instruct future agents to use `supabase start` or any local Postgres
  container as the default path
- do not use `supabase db reset` (retired) or any destructive local-reset
  workflow as the normal migration or seed workflow
- prefer remote migration push and hosted seeding against the linked Neon
  project; use a Neon branch (not Docker) when an isolated/throwaway
  database is needed to test a risky migration

If Docker is ever introduced later, document that change here before using it
as the standard development path.

## Neon + Vercel Process (current)

### Auth Replacement

Supabase Auth (`auth.users`, JWTs issued by GoTrue) is replaced with a
simple, self-owned session system — no paid auth provider, no JWT
verification infrastructure to build:

1. `users` table lives in Neon: `id`, `email`, `password_hash` (bcrypt/argon2),
   `app_role`, `is_active`, timestamps. This replaces `auth.users` +
   `public.user_profiles` with a single table.
2. On login, an API route verifies the password and creates a row in a
   `sessions` table: `id` (random opaque token, e.g. 32 bytes base64url),
   `user_id`, `expires_at`. The token is set as an `httpOnly`, `Secure`,
   `SameSite=Lax` cookie. Opaque DB-backed sessions are preferred over JWTs
   here because they can be revoked instantly (delete the row) — simpler to
   reason about than JWT expiry/refresh for a small team.
3. Every API route reads the session cookie, loads the session + user +
   `app_role` from Neon, and rejects or scopes the request accordingly.
4. Sign-out deletes the session row. Expired sessions are pruned lazily (on
   lookup) or via a daily Vercel Cron job.

### RLS Replacement

Postgres RLS policies enforced permissions close to the data because the
browser talked to Postgres directly through PostgREST. With an API layer in
front of Neon, the API layer _is_ the trust boundary now:

- Every serverless function endpoint explicitly checks `app_role` against
  what the action requires before running any query (e.g. only
  Warehouse/Ops/Admin roles may call the stock-issue endpoint).
- Keep this centralized: a small `requireRole(session, [...roles])` helper
  used at the top of every handler, not re-implemented per route.
- Existing RLS policies in the migration history remain useful as a
  _reference_ for "who was allowed to do what" — port that logic into the
  API-layer checks rather than re-deriving it from scratch.
- Postgres-level constraints (`CHECK`, `NOT NULL`, foreign keys, enums)
  stay — those are DB integrity rules, not auth, and Neon enforces them
  identically to Supabase.

### RPC / Business Logic Replacement

The existing Postgres functions (`record_production_batch`, the stock-issue
RPC, reconciliation/remittance/expense RPCs) encode important transactional
logic (consuming lots, decrementing `quantity_remaining`, writing ledger
rows) atomically. Keep that logic in Postgres functions — it is not
Supabase-specific SQL, it runs on Neon unchanged:

- Call them from the API layer as plain SQL (`SELECT * FROM
record_production_batch($1, $2, ...)`) through the same
  `@neondatabase/serverless` connection used for everything else, wrapped in
  a transaction started by the API handler.
- Do not rewrite this logic in JavaScript "for simplicity" — keeping
  multi-step inventory math atomic in the database is what makes it safe
  under concurrent mobile writes. See the robustness notes below on
  concurrency.

### Neon-Specific Workflow

- Local/dev migrations: keep using plain forward-only `.sql` migration
  files (same discipline as the Supabase era), applied with `drizzle-kit
push` or `psql` against a Neon connection string. Never edit an applied
  migration; always add a new one.
- **Ephemeral databases without Docker**: Neon's branching feature (a
  branch is a copy-on-write clone of the database, created in seconds)
  replaces what `supabase db reset` / Docker previously would have given
  you. Create a throwaway branch to test a risky migration, verify it, then
  apply the same migration to the main branch. This keeps the existing "No
  Docker Workflow" rule intact.
- Vercel's native Neon integration injects the pooled/HTTP connection
  string as an environment variable automatically and can provision a
  matching Neon branch per Vercel Preview deployment — useful for testing a
  feature branch against isolated data before merging, still on the free
  tier at small scale.
- Reference data seeding: run `yarn neon:seed` using
  `scripts/neon-seed.mjs` and `neon/reference-data.mjs`. Provision administrators
  with `yarn neon:provision-user` and server-only `BOMS_ADMIN_*` variables.

## Retired Supabase History

### Migration History

The retired database used these forward-only migrations, now archived under
`docs/archive/supabase/migrations/`:

- `20260802164000_auth_roles_and_user_profiles.sql`
  - creates app roles, user profiles, sync triggers, and auth RLS foundation
- `20260802183000_supply_and_production_foundation.sql`
  - creates products, variants, materials, suppliers, purchases, purchase
    items, inventory lots, production batches, production inputs, production
    outputs, and operational RLS policies
- `20260802200000_supply_production_remote_alignment.sql`
  - aligns remote supplier uniqueness and service-role grants for hosted seed
    flows
- `20260802203000_rls_helper_access_and_csp_followup.sql`
  - grants access needed for RLS helper evaluation by authenticated users and
    follows up on remote policy access behavior
- `20260802213000_warehouse_distribution_foundation.sql`
  - creates retailers, stock issues, retailer stock ledgers, phase 3 RLS
    policies, and the stock issue RPC that updates finished stock by batch
- `20260802224500_fix_record_production_batch_inventory_status_cast.sql`
  - fixes `record_production_batch` so inventory lot status updates cast
    correctly to the `inventory_lot_status` enum on the hosted project
- `20260802233000_reconciliation_and_finance_foundation.sql`
  - creates reconciliations, reconciliation items, remittances, expenses,
    finance summary views, and the phase 4 RPCs for reconciliation,
    remittance, and expense entry

The hosted project, active tooling and Supabase dependencies have been removed.
Do not resume hosted Supabase seeding or migration pushes. The original source
and configuration are retained with the verified database export in the private,
Git-ignored `.backups/supabase-2026-09-12/` directory. Preserve this backup;
it is the only retained copy of the archived August operational history.

### Current Operational Validation Steps

After applying Neon migrations and seeding reference data, verify the following. These
steps were re-run against Neon on September 11, 2026 using `tests/neon.test.ts`
and the accounting scenarios in `tests/domain.test.mjs`:

- the authenticated user can read `products`, `product_variants`, `materials`,
  `suppliers`, `retailers`, `purchases`, `inventory_lots`,
  `production_batches`, and `production_outputs`
- the user has an active role in `public.users` (replaces `public.user_profiles`)
- the operations workspace loads through the API without unexpected `403` responses
- the distribution workspace loads through the API without unexpected `403` responses
- purchase entry creates inventory lots
- production entry consumes open lots and produces batch output cost
- stock issue entry creates issue records, decrements `production_outputs`
  `quantity_remaining`, and writes retailer ledger movement history
- reconciliation entry creates reconciliation records, settlement ledger
  movements, and returns good stock to `production_outputs.quantity_remaining`
- remittance entry updates retailer outstanding balances
- expense entry updates gross profit and net result views

## Immediate Deliverables

Start the project with these artifacts:

1. Product requirements document for MVP
2. Domain model and entity relationship diagram
3. User roles and permissions matrix
4. Database schema draft
5. Core user journeys
6. Initial backlog split by phase
7. UI navigation map
8. Seed data for Beecone's current variants and materials

## Suggested First Backlog

Prioritize the first implementation sprint around:

1. App scaffold and environment setup
2. Authentication and role scaffolding
3. Product and variant management
4. Materials inventory schema
5. Supplier and purchase entry
6. Production batch schema and service logic
7. Simple dashboard shell

## UX Expectations

- Dashboard should show operational health at a glance.
- Data entry screens should be fast, simple, and mobile-first (not merely
  "mobile-tolerant" — see Mobile-First UI Standard below).
- Batch references, SKUs, retailer balances, and stock warnings should be visible without digging.
- Reports should explain numbers clearly enough for business review meetings.

### Mobile-First UI Standard

Most BOMS users (warehouse, production, sales/distribution, retail
reconciliation staff) work primarily on a phone in the field. Design and
build every screen phone-first, then scale up — not the reverse.

- Design at a ~375–390px viewport first. Only after that layout works,
  layer on Quasar's `$q.screen` breakpoints (`xs`/`sm`/`md`/`lg`/`xl`) to
  add density for tablet/desktop (extra columns, side-by-side panels,
  denser tables) — never the other way around.
- Primary navigation should be a bottom nav bar or a slide-in drawer on
  mobile, not a permanent desktop sidebar that gets squeezed.
- Any data table that is a primary mobile workflow (retailer ledgers,
  reconciliation lines, stock issues, purchase history) should render as a
  card/list on narrow viewports and only become a dense `q-table` at `md`
  and above. Don't just shrink table columns until they're unreadable.
- Data-entry forms (purchase receipt, production batch, stock issue,
  reconciliation, remittance, expense) must be completable one-handed:
  large touch targets (44px minimum), numeric keypads for quantity/price
  fields, minimal typing (prefer pickers/search-select for batch, retailer,
  product, supplier over free text), and inline validation rather than a
  wall of errors on submit.
- Assume intermittent connectivity (field use, mobile data). Forms should
  disable the submit button on tap (prevent double-submit), show a clear
  pending/retry state, and surface network failures distinctly from
  validation failures.
- Dashboards should have a mobile-first "headline numbers + watchlist"
  view, with deeper charts/trends revealed progressively (accordion,
  drill-in) rather than all rendered at once.

## Non-Functional Requirements

- Secure role-based access, enforced in the API layer (see RLS Replacement)
- Auditability of every stock and financial event
- Reliable historical costing, using fixed-precision numeric types for all
  money and quantity fields — never floating point — given UGX amounts and
  jar-cost math need to reconcile exactly
- Idempotent write endpoints for inventory- and money-moving actions (stock
  issue, reconciliation, remittance, expense, production batch), since
  mobile clients on flaky connections will retry requests — a retried
  request must not double-consume stock or double-record a payment
- Correct concurrency handling when multiple staff act on the same batch or
  lot at once (e.g. two production batches racing to consume the same
  `inventory_lot`) — use row locking (`SELECT ... FOR UPDATE`) or
  serializable transactions inside the Postgres functions that mutate
  shared inventory state
- Fast filtering by batch, retailer, date, and variant
- Extensible catalogue and materials model
- Clear validation and error recovery
- Mobile-first, responsive UI usable one-handed on a phone, scaling up to
  tablet/desktop (see Mobile-First UI Standard)

## Idempotency & Concurrency Requirements

These apply to every endpoint that mutates stock quantities or money:
stock issue, production batch recording, reconciliation entry, remittance
entry, expense entry, returns.

### Idempotency

- Every write request from the client includes an `Idempotency-Key` header
  — a UUID generated once per user action (e.g. once when the "Submit"
  button is first tapped, reused across automatic retries of that same
  tap, regenerated for a genuinely new submission).
- The API layer keeps an `idempotency_keys` table: `key` (PK), `endpoint`,
  `request_hash` (hash of the request body, to detect a key being reused
  for a different payload), `response_status`, `response_body`,
  `created_at`.
- On each request: look up the key for that endpoint.
  - Not found → run the transaction normally, then store the result
    against the key before responding.
  - Found with matching `request_hash` → skip re-executing the transaction,
    return the stored response as-is (this is the retry case).
  - Found with a different `request_hash` → reject with `409 Conflict`
    (client reused a key for a different action — a client bug, not a
    retry).
- Prune rows older than ~48 hours via the same daily Vercel Cron job used
  for session cleanup.

### Concurrency on Shared Inventory

- Anywhere a Postgres function consumes `inventory_lots` or decrements
  `production_outputs.quantity_remaining` (production batch recording,
  stock issue), lock the specific rows being consumed with `SELECT ... FOR
UPDATE` before reading/decrementing them, inside the same transaction
  that writes the resulting movement/ledger rows. This is simpler to
  reason about here than full `SERIALIZABLE` isolation plus
  retry-on-conflict application code, and matches the access pattern
  (a small, known set of rows per request).
- When FIFO selection itself is racing (two requests both picking "the
  oldest open lot"), select candidate lots with `... ORDER BY received_at
FOR UPDATE SKIP LOCKED` so concurrent requests fall through to the next
  available lot instead of blocking on, or double-consuming, the same one.
- Never compute "is there enough stock" in the API layer from a prior read
  and then write separately — check and decrement inside the same locked
  transaction, or a concurrent request can pass the same check twice
  against stock that's already spoken for.

## Resolved Product Decisions

Answered from the original Open Questions list. Implications are reflected
in Domain Rules, Recommended Data Foundations, and the Phase 8 tracker
below — this section is the record of the decision itself.

1. **Consignment vs outright purchase**: all retailers are on consignment.
   No outright-purchase retailer flow is needed.
2. **Pricing by retailer/campaign**: no — one current price per variant,
   with history, not a price matrix.
3. **Damaged/expired vs retailer liability**: yes, reduced automatically at
   reconciliation — no manual adjustment step.
4. **Multi-warehouse**: not needed now. Keep the schema forward-compatible
   (a `warehouse_id` FK against a single seeded warehouse) without building
   multi-warehouse UI/logic yet.
5. **Recipe-templated production inputs**: yes, some inputs can be
   pre-filled from a recipe, but actuals stay manually editable per batch.
6. **Partial remittances**: yes, supported — a reconciliation period's
   liability can be paid down across multiple remittances over time.
7. **Weekly vs monthly reports**: see Reporting Cadence below.

### Reporting Cadence

Recommended split, aligned to how the business actually needs to act on
each number:

**Weekly** (operational — catch problems while they're still cheap to fix):

- Stock movement summary: purchases received, batches produced, stock
  issued to retailers this week
- Retailer outstanding balance / aging view — who owes what, and for how
  long, so follow-up happens before it becomes a monthly surprise
- Low-stock and expiring-batch alert digest (ties directly to the pending
  Phase 5 alerting item)
- Reconciliation summary by retailer: sold vs. returned vs. damaged, so
  an unusual damage/return rate is caught within a week, not a month
- Production cost-per-jar trend, if production runs weekly or more often

**Monthly** (business review — the numbers the owner actually sits down with):

- Profitability / gross margin report: revenue − COGS − operating expenses
- Inventory valuation at month end: raw materials, packaging, and finished
  goods, at their recorded historical cost
- Retailer performance ranking: volume moved, remittance timeliness,
  damage/return rate over the month
- Expense breakdown by category
- The existing monthly business review dashboard (already delivered per
  Phase 5) is the natural home for this cadence — weekly items are a new,
  lighter-weight view, not a re-hash of the monthly one at higher frequency.

## Definition of Done for MVP

MVP is complete when Beecone can:

- record purchases of honey and packaging
- create production batches with true cost per jar
- view finished stock by batch in the warehouse
- issue stock to retailers
- reconcile retailer activity and remittances
- view core sales, inventory, and profitability metrics
- trust the numbers enough to run a monthly business review

## Working Instruction for Future Agents

When building BOMS:

- start from transactional truth, not summary dashboards
- protect traceability at every layer
- avoid hardcoding product variants or flavors
- keep business calculations centralized and testable
- treat inventory and finance as connected but distinct concerns
- implement the smallest useful version first, then deepen accuracy and reporting
- the browser never talks to Neon directly — every read/write goes through
  a Vercel Serverless Function that checks the session and role first
- keep transactional, multi-table inventory/finance mutations inside a
  single Postgres function called in a transaction, not spread across
  several client-driven API calls
- design every new screen mobile-first; only add desktop density after the
  phone layout works
- prefer the simplest, free-tier tool that solves the problem — this
  project is intentionally avoiding paid infrastructure while it validates
  the business

If tradeoffs arise, choose the option that improves traceability, auditability, and operational clarity.
