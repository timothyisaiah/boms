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
- Reference stack:
  - Frontend: Vue 3 + Quasar + TypeScript
  - Backend: Supabase
  - Database: PostgreSQL
  - Platform capabilities: Auth, RLS, storage, database functions, scheduled jobs
  - Deployment edge: Cloudflare Pages/Workers
- Currency: UGX

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
5. Production batching and costing
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
- Retail reconciliation must support sold, returned, damaged, remaining, remitted, and outstanding values.
- Returns must retain batch, reason, condition, and disposition.
- Product, packaging, and supplier prices should remain historically accurate per transaction.
- Cost per jar should be derived, explainable, and reproducible.

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
- production_batches
- production_inputs
- production_outputs
- warehouse_stock
- retailers
- stock_issues
- retailer_stock_ledgers
- reconciliations
- remittances
- returns
- expenses
- pricing
- users
- roles
- audit_logs

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

Last updated: August 2, 2026

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

### Phase 2: Supply and Production

- [x] Build purchasing workflows
- [x] Build raw material and packaging stock updates
- [x] Build production batch creation
- [x] Implement cost calculations and batch output records

### Phase 3: Warehouse and Distribution

- [ ] Track finished stock by batch
- [ ] Implement stock issue to retailers
- [ ] Add retailer stock views and movement history

### Phase 4: Reconciliation and Finance

- [ ] Capture sold, returned, damaged, remaining, and remitted values
- [ ] Track retailer outstanding balances
- [ ] Add expenses and gross profit views

### Phase 5: Reporting and Hardening

- [ ] Build dashboards and monthly review views
- [ ] Add alerts for low stock and expiring batches
- [ ] Improve audit logs, validation, and usability

## Current Delivery Snapshot

As of August 2, 2026, the current implementation includes:

- Supabase-backed authentication and role-aware route protection
- `public.user_profiles` sync from `auth.users`
- core catalogue, material, supplier, purchasing, inventory lot, and production
  schema
- RLS policies for the new operational tables
- remote seed flow for Beecone products, variants, materials, and suppliers
- purchase receipt entry that creates inventory lots
- production batch entry that consumes real lots and calculates output unit cost
- a phase 2 operations workspace in the app for supply and production workflows

## Environment Rule: No Docker Workflow

BOMS is currently using a hosted Supabase workflow and is not using Docker for
day-to-day development or deployment.

Unless the team explicitly changes direction:

- do not assume Docker Desktop is installed or available
- do not instruct future agents to use `supabase start` as the default path
- do not use `supabase db reset` as the normal migration or seed workflow
- prefer remote migration push and hosted seeding against the linked Supabase
  project

If Docker is ever introduced later, document that change here before using it
as the standard development path.

## Supabase Process So Far

### Migration History

The current database delivery has been built through forward-only migrations:

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

Rule for future work:

- never rewrite or repurpose an already applied migration on the hosted project
- always add a new forward migration for fixes, privileges, schema changes, or
  policy corrections

### Hosted Supabase Workflow

This is the standard workflow for this project:

1. Update or add a new migration under `supabase/migrations/`.
2. Push migrations to the linked hosted project with `yarn supabase:db:push`.
3. Seed reference data with `yarn supabase:seed` or
   `yarn supabase:seed:production`.
4. Provision or update the admin login with `yarn supabase:seed-admin` or
   `yarn supabase:seed-admin:production`.
5. Sign into the app and verify the user has an active `public.user_profiles`
   row with the correct `app_role`.

### Seed and Provisioning Files

The current seed and setup files serve different purposes:

- `supabase/seed.sql`
  - local SQL seed kept for reset-based workflows, if they are ever needed
- `supabase/seed-reference-data.mjs`
  - hosted reference-data seed for products, variants, materials, and suppliers
- `supabase/provision-admin-user.mjs`
  - creates or updates the password-capable administrator user through the
    Supabase Auth Admin API
- `supabase/env.mjs`
  - shared `.env` file loader for hosted Supabase scripts

### Current Operational Validation Steps

After pushing migrations and seeding hosted data, verify the following:

- the authenticated user can read `products`, `product_variants`, `materials`,
  `suppliers`, `purchases`, `inventory_lots`, and `production_batches`
- the user has an active role in `public.user_profiles`
- the operations workspace loads without `403` responses from Supabase REST
- purchase entry creates inventory lots
- production entry consumes open lots and produces batch output cost

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
- Data entry screens should be fast, simple, and mobile-tolerant.
- Batch references, SKUs, retailer balances, and stock warnings should be visible without digging.
- Reports should explain numbers clearly enough for business review meetings.

## Non-Functional Requirements

- Secure role-based access
- Auditability of every stock and financial event
- Reliable historical costing
- Fast filtering by batch, retailer, date, and variant
- Extensible catalogue and materials model
- Clear validation and error recovery

## Open Questions

These should be resolved early during ideation:

1. Is every retailer managed on consignment, or do some buy outright?
2. Can the same product variant have different prices by retailer or campaign?
3. Should damaged and expired goods reduce retailer liability automatically?
4. Does Beecone need multi-warehouse support later?
5. Are production inputs always manually entered, or can some be templated by recipe?
6. Should the system support partial remittances against a reconciliation period?
7. What reports are required weekly versus monthly?

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

If tradeoffs arise, choose the option that improves traceability, auditability, and operational clarity.
