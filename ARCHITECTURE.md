# Logbook architecture — v0.72

## Storage model

Logbook now has two production-capable storage implementations behind the application `connect()` boundary:

- **SQLite** – default runtime and pre-cutover source
- **PostgreSQL** – production runtime after explicit cutover

The large world-airport catalogue remains a separate read-only SQLite reference asset and is not part of tenant transactional storage.

## Runtime backend selection

`logbook_core.db_runtime.resolve_runtime_database_config()` is fail-closed.

Default:
```toml
[database]
# no production_backend means sqlite
```

PostgreSQL:
```toml
[database]
postgres_dsn = "..."
production_backend = "postgresql"
cutover_confirm = "POSTGRESQL_PRODUCTION"
```

Emergency SQLite fallback after cutover requires a second explicit token:
```toml
[database]
production_backend = "sqlite"
cutover_confirm = "POSTGRESQL_PRODUCTION"
fallback_confirm = "SQLITE_EMERGENCY_FALLBACK"
```

No runtime path catches a PostgreSQL failure and silently opens SQLite.

## PostgreSQL compatibility layer

`logbook_core.db_runtime.PostgresConnectionAdapter` provides the small sqlite-like API surface used by the app:
- `execute`
- `executemany`
- `commit`
- `rollback`
- context manager
- sqlite-style mapping/integer row access
- backend-neutral generated IDs
- backend-neutral DataFrame reads

The adapter translates qmark parameters to Psycopg parameters and preserves literal question marks. It also escapes SQL modulo operators for Psycopg and normalizes `CURRENT_TIMESTAMP` assignments into the TEXT timestamp schema used by the migrated data model.

## Cutover lifecycle

The PostgreSQL lifecycle is serialized with the shared advisory lock:

`logbook-postgres-lifecycle`

Operations under this lock:
1. first shadow migration
2. shadow refresh
3. CUTOVER READY marker
4. first PostgreSQL production activation

### Shadow refresh invariant

Refresh may delete PostgreSQL rows only after:
- target is `shadow_mode=1`
- shadow protocol matches
- `production_mode != 1`
- `production_cutover_at` is empty

The delete + copy + sequence repair + validation are one PostgreSQL transaction. Any failure restores the prior shadow.

A target previously activated as production can never be refreshed by the shadow tool.

## CUTOVER READY

CUTOVER READY is stored only after a current deep MATCH.

The gate records:
- source watermark
- verification time
- deep-verification marker
- stable aggregate fingerprint of source table fingerprints

First PostgreSQL startup re-checks the SQLite source watermark before writing production lifecycle metadata.

## Deep verification semantics

Deep SHA-256 comparison includes durable migrated application data.

Excluded:
- PostgreSQL-only `shadow_*`, `cutover_*` and `production_*` app metadata
- `user_credentials.last_login_at`

`last_login_at` is deliberately volatile and can change merely because the user logged in after creating the shadow. Password hashes, credential creation/update metadata, users, settings, flights, aircraft, rates, custom airports, tracks, points and audit content remain covered.

## Audit and change watermark

For PostgreSQL production, `record_audit()` is strict: the business mutation, audit event and `app_meta.last_change_at` update are part of the same transaction. Audit failure aborts the business change.

Login timestamp updates are operational and do not advance the durable change watermark.

Account creation/activation explicitly advances `last_change_at`.

## Emergency fallback divergence

SQLite is frozen at the cutover baseline once PostgreSQL becomes production.

If emergency fallback is enabled and a business write advances SQLite `last_change_at`, a later PostgreSQL rejoin is refused. This prevents silently discarding fallback-era writes.

No automatic merge/reconciliation is implemented in v0.72.

## Backup boundary

While SQLite is production:
- GitHub SQLite backup can run as before
- full SQLite snapshot/restore is available to admin

While PostgreSQL is production:
- GitHub SQLite auto-backup is disabled
- full SQLite restore is blocked
- SQLite remains downloadable only as a clearly labelled frozen fallback baseline
- per-user portable ZIP backup/restore works against PostgreSQL

Provider-level PostgreSQL backup/restore remains outside the application runtime.

## Schemas

- SQLite schema: 10
- PostgreSQL schema: 1
- shadow protocol: 1
- production cutover protocol: 1
