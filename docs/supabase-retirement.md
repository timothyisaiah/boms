# Supabase retirement record

Completed September 12, 2026. The hosted Supabase project **boms**
(`uaulteduyuqrquicuhnq`, eu-west-1) was deleted after a final backup and successful
restore verification. The authenticated project list returned no projects after
deletion. Neon remains the BOMS database and authentication source.

The owner explicitly chose to keep the August operational records in the backup
only. They were not imported into Neon.

## Retained backup

The private local directory `.backups/supabase-2026-09-12/` contains:

- A complete PostgreSQL 17 custom archive (`database.dump`), decoded SQL and
  archive table of contents.
- Database role definitions without role passwords.
- The original Supabase source/configuration and legacy environment file.
- Restore verification results and a SHA-256 file manifest.

This directory is ignored by Git and contains authentication data and credentials.
Keep a private copy in durable backup storage. It is historical data, not a build
cache. Recovery instructions are in its `README.md`. Supabase deletion also removes
provider-held data and backups, so the retained export is the recovery source.
See [Supabase's deletion documentation](https://supabase.com/docs/guides/platform/delete-project).

## Verification

The complete custom archive was decoded successfully. Its `public`, `auth` and
`private` objects were restored into an isolated PGlite database, including all
42 application/authentication tables, their data, constraints, indexes, sequences,
functions and RLS policies. Every restored table's row count matched the archive.

| Archived operational records | Count |
| ---------------------------- | ----: |
| Purchases                    |     2 |
| Production batches           |     2 |
| Stock issues                 |     2 |
| Reconciliations              |     2 |
| Remittances                  |     1 |

Restored totals matched the source: UGX 600,000 in purchases, UGX 120,000 in sales,
and UGX 90,000 in remittances. The source had no storage objects/buckets, vault
secrets, or deployed Edge Functions. The full archive includes the remaining
platform schemas; those schemas were decoded but were not restored in PGlite.

Before deletion, the existing Neon administrator password and active owner role
verified, and `npm run test:neon` passed real API authorization, operational
validation and concurrent-write checks. After dependency removal, all seven local
database/domain tests and the production Quasar build passed. A scan of all 39
browser artifacts found no configured server-only credentials or Supabase code.
Final TypeScript and formatting/lint checks passed as well.

## Repository cleanup

Supabase client/CLI dependencies and package scripts, hosted seed/provision tools,
CLI linkage/configuration, legacy environment variables, and administrator
fallbacks were removed. Runtime code and browser checks use Neon and `BOMS_ADMIN_*`.
Historical SQL is retained under `docs/archive/supabase/migrations/`, including
local changes that had not been applied to the old hosted database.

Use `neon/migrations/` and the `neon:*` package scripts for all current database
work. The Vercel deployment item remains separate in the phase tracker.
