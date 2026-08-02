# beecone (boms)

## Install the dependencies

```bash
yarn install
```

### Start the app in development mode (HMR, error reporting, etc.)

```bash
yarn dev
```

### Format & Lint the files

```bash
yarn lint
```

...or just check formatting & linting:

```bash
yarn lint:check
```

### Build the app for production

```bash
yarn build
```

### Customize the configuration

See [Configuring quasar.config.js](https://v2.quasar.dev/quasar-cli-vite/quasar-config-file).

## Auth setup

Copy `.env.example` to `.env` and provide these values:

```bash
VITE_SUPABASE_URL=...
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
VITE_SUPABASE_ALLOW_SIGN_UP=false

SUPABASE_URL=...
SUPABASE_SECRET_KEY=sb_secret_...
SUPABASE_ADMIN_EMAIL=admin@beecone.local
SUPABASE_ADMIN_PASSWORD=ChangeMe123!
SUPABASE_ADMIN_FULL_NAME=Beecone Administrator
SUPABASE_ADMIN_ROLE=admin_owner
```

The app now expects Beecone roles to come from `public.user_profiles` first, then falls back to Supabase `app_metadata`. Supported roles are:

- `admin_owner`
- `operations_manager`
- `production_staff`
- `warehouse_staff`
- `sales_or_distribution_staff`
- `finance_accountant`
- `read_only_management`

Protected routes are already in place for operations, retail, finance, and admin workspaces.

## Supabase migrations and seed

This repo now includes:

- `supabase/config.toml`
- `supabase/migrations/20260802164000_auth_roles_and_user_profiles.sql`
- `supabase/migrations/20260802183000_supply_and_production_foundation.sql`
- `supabase/seed.sql`
- `supabase/seed-reference-data.mjs`
- `supabase/provision-admin-user.mjs`

What they do:

- `supabase/config.toml` turns this repo into a real Supabase local development project for the CLI.
- The migration creates the `public.app_role` enum, the `public.user_profiles` table, sync triggers from `auth.users`, and RLS policies.
- The supply and production migration adds product variants, materials, suppliers, purchasing tables, inventory lots, production batch tables, RLS, and RPC functions for purchase and batch entry.
- The seed file creates a deterministic local admin-shaped auth row plus Beecone sample variants, materials, and suppliers for repeatable development state.
- The hosted seed script upserts the same Beecone reference data directly into a linked or hosted Supabase project without requiring Docker.
- The provisioning script creates or updates a real password-based administrator account through the Supabase Auth Admin API.

Local workflow:

```bash
yarn supabase:start
yarn supabase:db:reset
```

`yarn supabase:start` launches the local stack. `yarn supabase:db:reset` then recreates the local database, applies all migrations, and runs `supabase/seed.sql`.

After the reset succeeds, the `/operations` route can load:

- seeded product variants
- seeded materials and suppliers
- live purchase receipt entry via `public.record_purchase(...)`
- live production batch creation via `public.record_production_batch(...)`

Prerequisite:

- Docker Desktop must be installed and running before local Supabase commands can reach the Docker engine.

Hosted dev or staging workflow without Docker:

```bash
npx supabase login
npx supabase link --project-ref <project-ref>
yarn supabase:db:push
yarn supabase:seed
yarn supabase:seed-admin
```

`yarn supabase:db:push` applies pending migrations to the linked Supabase project. `yarn supabase:seed` then upserts Beecone reference data through the service key in your `.env`, and `yarn supabase:seed-admin` creates or updates the login-capable admin user on whichever project `SUPABASE_URL` points to.

Env file loading for admin provisioning:

- `yarn supabase:seed` reads `.env`, `.env.local`, `.env.development`, and `.env.development.local`
- `yarn supabase:seed:production` reads `.env`, `.env.local`, `.env.production`, and `.env.production.local`
- `yarn supabase:seed-admin` reads `.env`, `.env.local`, `.env.development`, and `.env.development.local`
- `yarn supabase:seed-admin:production` reads `.env`, `.env.local`, `.env.production`, and `.env.production.local`

Important:

- `VITE_SUPABASE_PUBLISHABLE_KEY` and `SUPABASE_SECRET_KEY` are application/runtime credentials. They do not tell the Supabase CLI where to apply migrations.
- CLI migration commands target either a local stack or a linked remote project. For a hosted project, use `supabase login`, `supabase link --project-ref <project-ref>`, and then `yarn supabase:db:push`.
- `supabase db reset` is local by default. If you are not using Docker/local Supabase, use `yarn supabase:db:push`, `yarn supabase:seed`, and `yarn supabase:seed-admin` instead.

Notes:

- `supabase db reset` is local by default and requires the local stack to be started first.
- `yarn supabase:seed:local` is just a convenience alias for the Docker-based local reset workflow.
- `yarn supabase:start`, `yarn supabase:db:reset`, and `yarn supabase:db:push` do not require a globally installed `supabase` binary.
- `yarn supabase:seed` is the Docker-free reference-data seeding path for hosted projects.
- `yarn supabase:seed-admin` now reads `.env` automatically.
- `VITE_SUPABASE_PUBLISHABLE_KEY` is the only supported frontend key in this project.
- `SUPABASE_SECRET_KEY` must be a server-side secret key. A publishable client key will be rejected.
- In Quasar CLI with Vite, plain dotenv vars are backend-visible by default. This project explicitly forwards the Supabase `VITE_*` values through `quasar.config.js > build.defineEnv` so the client app in `src/` can read them.
- Quasar only auto-loads `.env` and `.env.local` by default. This project explicitly registers `.env.development` and `.env.production` in `quasar.config.js > build.env.file`.
