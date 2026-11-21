# Production SQL migrations

These are the manual, schema-first scripts that were applied to the production Neon database. The schema registry is the table `flytally_schema_migrations`. The canonical list of versions and names is in `lib/migration-plan.ts` (currently **v21**).

| Version | Files | Content |
|---|---|---|
| v18 | `v18-preflight.sql`, `v18-migrate.sql`, `v18-postflight.sql` | Aircraft default operation type |
| v19 | `v19-preflight.sql`, `v19-migrate.sql`, `v19-postflight.sql` | Aircraft default engine type |
| v20 | `v20-preflight.sql`, `v20-migrate.sql`, `v20-postflight.sql`, `v20-reconcile-provenance.sql` | Certified flight void archive and provenance |
| v21 | `v21-preflight.sql`, `v21-migrate.sql`, `v21-postflight.sql` | Source-backed currency exact money |
| — | `airport-elevation-additive.sql` | Additive airport elevation columns (no registry version) |

The runtime (`lib/db-optimization.ts`) contains the statements for v1–v21 and applies pending versions at startup. The exception is v21, which it refuses to create anywhere except a disposable local test database. Production v18–v21 was migrated with these reviewed scripts. `tests/currency-v21-release-contract.test.ts` asserts that the v21 runtime DDL is identical to `v21-migrate.sql`.

## Order for a new migration

1. **Preflight** (read-only): verify the database identity and the exact expected starting state. Abort if anything is unexpected.
2. **Migrate**: one atomic transaction that writes the registry row together with the DDL.
3. **Postflight** (read-only): verify the resulting shape.

Run each script with `psql -v ON_ERROR_STOP=1`. Run against production only with the owner's explicit approval and a verified backup or branch. Deploy the code that needs the new schema only afterwards.
