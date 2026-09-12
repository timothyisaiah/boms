# Beecone Operations Management System

Vue 3 + Quasar frontend, TypeScript API functions, Neon Postgres, and Drizzle's HTTP adapter. Inventory and accounting transactions run in Postgres. The browser uses same-origin `/api` endpoints and an opaque session cookie.

## Development without Docker

Use Node 24 and Yarn. Install with `yarn install`. Copy `.env.example` to `.env.development` and configure the server-only `DATABASE_URL` for the intended Neon development branch. Never prefix database credentials with `VITE_` or commit environment files.

```sh
yarn neon:migrate
yarn neon:seed
yarn neon:provision-user
```

Provisioning reads `BOMS_ADMIN_EMAIL`, `BOMS_ADMIN_PASSWORD`, `BOMS_ADMIN_FULL_NAME`, and `BOMS_ADMIN_ROLE`. Passwords must be 12–72 bytes. Existing users and reference records are preserved.

Start these in separate terminals:

```sh
yarn dev:api
```

```sh
yarn dev --host localhost --port 9000
```

Open `http://localhost:9000`. Quasar proxies `/api` to the local API on port 3001. Use localhost for secure-cookie development; hosted use requires HTTPS. Create variant prices and optional production recipes in Administration before recording sales reconciliations.

## Add and manage supply materials

Use **Operations → Add material** for raw honey, packaging, or spices. Enter a unique code,
name, type, unit of measure, and low-stock threshold. Use **Manage materials** to
search by name/code/description, filter by type or active status, view available
stock, edit details and thresholds, or deactivate/reactivate a material.

Owners, operations managers, and warehouse staff can make changes. Type and unit
stay fixed after creation to preserve inventory and costing consistency. Record
a purchase receipt to add stock. Inactive materials leave receipt pickers while
their existing lots and transaction history remain available.

## Add and manage product variants

Use **Operations → Add variant** to add a variant to an existing active product, or
create its product in the same step. Enter the SKU, name, flavour, pack size,
packaging type, and finished-goods low-stock threshold. **Manage variants** lets
owners and operations managers search, edit, deactivate, and reactivate variants.
Active variants appear in the production-batch picker. A variant stays attached to
its original product so completed batches and costing history remain consistent.

## Add suppliers and retailers

Use **Operations → Add supplier** or **Distribution → Add retailer** at the top of the workspace. Enter the name and any contact details; suppliers also have a supplier type, and retailers can have a delivery location. After saving, the new record is selected in the purchase or stock-issue picker. Duplicate names are rejected and interrupted submissions can be retried safely.

Use **Manage suppliers** or **Manage retailers** beside the add button to search every profile by name, contact person, phone, email, or delivery location. Filter by active/inactive status, open a profile, edit its details, and control whether it is active. Inactive partners remain in historical records and reports but disappear from new purchase and stock-issue pickers.

Owners, operations managers, and warehouse staff can add suppliers and retailers. Sales/distribution staff can also add retailers.

## Add users and manage access

Sign in as an **Admin / Owner**, open **Access and settings**, and use **Users and access → Add user**. Enter the person's name, sign-in email, role, and an initial password of at least 12 characters. Share that password securely; it is not emailed automatically.

Use **Edit access** on a user card to change their name or role, deactivate/reactivate the account, or set a new password. Deactivation and password resets revoke existing sessions. Leave the password blank to keep it unchanged. Your own role and active status must be changed by another administrator; the server also protects the last active administrator. Access changes are audited without recording passwords.

## Validation

```sh
yarn typecheck
yarn test
yarn test:neon
yarn test:users:neon
yarn test:mobile
yarn lint:check
yarn build
```

`test` runs migrations and accounting scenarios in embedded PGlite, without Docker. `test:neon` runs real API handlers and concurrent transactions on `.env.development`'s database, then removes its own uniquely identified fixtures; use `BOMS_TEST_DATABASE_URL` to select a separate migrated Neon test branch. It also exercises the normal expired-session/idempotency cleanup job. `test:mobile` runs Chrome at 375, 390, and 1280 pixels using API fixtures. Chrome must be installed.

An optional live browser smoke check is available with `BOMS_LIVE_UI=1` when `dev:api` is running. It reads `BOMS_ADMIN_*` from the process environment or `.env.development.local` / `.env.development`, and signs out after checking the workspaces. Screenshots/traces are disabled for this credential-bearing check.

## Migrations and deployment

Add forward-only SQL files under `neon/migrations/`. The migration runner checks applied-file hashes and uses a transaction per migration; never modify an applied file. Test risky changes on an isolated Neon branch before applying them to a shared database. The supplied Neon database has been migrated and reference-seeded; the existing configured administrator has been provisioned.

`vercel.json` defines the Quasar build (`dist/spa`), serverless `/api` functions, and a daily cleanup schedule. Configure `DATABASE_URL` and a random server-only `CRON_SECRET` of at least 32 characters on the deployment. The Vercel project and Neon integration have **not** been linked or deployed here. Vercel's published [Hobby restrictions](https://vercel.com/docs/plans/hobby) limit it to personal, non-commercial use, so this business deployment needs an eligible existing arrangement consistent with the no-added-cost requirement.

Supabase was decommissioned on September 12, 2026. The hosted project was deleted after a verified database export. At the owner's request, August operational history is retained only in the private `.backups/supabase-2026-09-12/` archive and was not imported into Neon. Legacy SQL is preserved under `docs/archive/supabase/migrations/`; all current database work uses Neon. See the [retirement and backup record](docs/supabase-retirement.md).

See [migration and validation notes](docs/neon-migration.md), [mobile audit](docs/mobile-audit.md), and the authoritative [phase tracker](agent.md).
