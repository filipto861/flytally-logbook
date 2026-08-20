# Letový zápisník

Current release: **v0.72 – PostgreSQL Production Cutover**

## v0.72 – PostgreSQL Production Cutover

v0.72 introduces the first production-capable PostgreSQL runtime while keeping the existing SQLite database as the controlled migration/fallback baseline.

### Runtime safety
- default backend after upload remains **SQLite**
- PostgreSQL production requires both:
  - `production_backend = "postgresql"`
  - `cutover_confirm = "POSTGRESQL_PRODUCTION"`
- there is no automatic PostgreSQL → SQLite fallback
- PostgreSQL activation requires a previously recorded **CUTOVER READY** gate
- first activation revalidates the frozen SQLite `last_change_at` watermark
- shadow refresh, CUTOVER READY and production activation share one PostgreSQL advisory lifecycle lock
- production audit + `last_change_at` are committed in the same transaction as business writes

### Shadow refresh
- an existing non-production shadow can be transactionally rebuilt from the current SQLite snapshot
- refresh requires explicit UI confirmation
- refresh is rejected unless the target is a recognized shadow
- refresh is permanently rejected after PostgreSQL has been marked production
- failed refresh rolls back to the previous shadow state
- sequences and tenant/FK relationships are revalidated after refresh

### Deep verification
- table counts and per-user pilot metrics are compared
- deep SHA-256 fingerprints cover durable migrated application content
- PostgreSQL-only lifecycle metadata is excluded
- `user_credentials.last_login_at` is intentionally excluded because a normal login is volatile operational metadata; password hash and all durable credential fields remain verified

### PostgreSQL runtime compatibility
- backend-neutral generated-ID helper replaces SQLite-only `lastrowid`
- backend-neutral DataFrame SQL reader
- qmark `?` SQL parameters are translated for Psycopg
- SQL modulo `%` is safely escaped for Psycopg
- `CURRENT_TIMESTAMP` is stored compatibly in the migrated TEXT timestamp columns
- SQLite-only PRAGMA / ATTACH / initialization paths are isolated from PostgreSQL runtime
- PostgreSQL maintenance uses `ANALYZE`
- world-airport reference data remains the local read-only `airports_full.sqlite` asset

### Backup behavior
- portable per-user backup/restore continues to work on the active production backend
- SQLite GitHub auto-backup is disabled while PostgreSQL is production because the SQLite file is then only a frozen fallback baseline
- full SQLite restore is blocked while PostgreSQL is production
- emergency SQLite fallback is explicit:
  - `production_backend = "sqlite"`
  - `cutover_confirm = "POSTGRESQL_PRODUCTION"`
  - `fallback_confirm = "SQLITE_EMERGENCY_FALLBACK"`
- if SQLite receives business writes during emergency fallback, automatic rejoin to PostgreSQL is blocked to prevent silent data loss

### Schema
- `APP_VERSION = v0.72`
- SQLite schema remains **10**
- PostgreSQL schema remains **1**
- cutover protocol **1**
- no SQLite migration is required for this release

## Release history

- **v0.71** – PostgreSQL Shadow Migration & Verification
- **v0.70** – PostgreSQL & Production Multi-User Foundation
- **v0.69.1** – Navigation Performance Hotfix
- **v0.69** – Production Hardening & Performance Audit
- **v0.68** – Data Quality & Automation
- **v0.67** – Map & Track UX 2.0
- **v0.66** – Flight Detail & Logbook UX Polish
- **v0.65.1** – Manual Entry None Safety Hotfix
- **v0.65** – Flight Entry UX 2.0
- **v0.64** – Data Portability & Backup UX
- **v0.63.1** – Profile Recency Polish
- **v0.63** – Pilot Currency & Recency
- **v0.62.2** – Dashboard Card Visual Polish
- **v0.62.1** – Dashboard Polish
- **v0.62** – Dashboard & Statistics 2.0
- **v0.61.7** – Stability & Performance Cleanup

## Deployment notes

The release ZIP deliberately excludes `data/logbook.sqlite`. Preserve the existing repository database and `.git` directory when replacing application files.

Real PostgreSQL credentials belong only in Streamlit Secrets and must never be committed to GitHub.
