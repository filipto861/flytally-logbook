# PostgreSQL Production Cutover — v0.72

## Goal
Move Logbook production CRUD from SQLite to the already verified PostgreSQL shadow without losing rollback visibility or creating an automatic split-brain fallback.

## Preconditions
- PostgreSQL target came from the Logbook shadow migration workflow
- target is not production yet
- deep shadow verification is MATCH
- CUTOVER READY marker is current
- SQLite source watermark has not changed after readiness

## Activation
Runtime PostgreSQL is enabled only through Streamlit Secrets:
```toml
production_backend = "postgresql"
cutover_confirm = "POSTGRESQL_PRODUCTION"
```

The code does not provide a UI button that secretly changes runtime backend. The configuration change remains explicit and deployment-visible.

## Fail-closed rules
- PostgreSQL configured but missing exact token → startup fails
- PostgreSQL unavailable → startup fails
- stale CUTOVER READY watermark → startup fails
- target no longer a valid shadow → startup fails
- no automatic fallback to SQLite

## Shadow refresh
v0.72 adds an explicit transactional refresh for a non-production shadow. It is intended for the normal case where SQLite changed after the original v0.71 shadow snapshot.

It is impossible through this workflow once `production_mode=1` or `production_cutover_at` exists.

## Fallback
Emergency SQLite fallback requires a second exact token. It is intentionally visible in the UI.

If SQLite receives durable writes during fallback, returning to PostgreSQL is blocked because the frozen SQLite watermark no longer matches the original cutover baseline.

v0.72 does not auto-merge divergent databases.

## Backup
Per-user portable backups remain backend-neutral. Full PostgreSQL disaster recovery is provider-managed; the legacy GitHub SQLite backup is not continued as if it were a PostgreSQL backup.
