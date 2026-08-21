# Logbook architecture — v0.73

## Production storage

PostgreSQL is the normal production source of truth after the v0.72 cutover.

SQLite remains supported for:
- pre-cutover/dev use
- explicit emergency fallback
- the frozen repository fallback baseline

The application never automatically switches PostgreSQL production to SQLite.

The world-airport catalogue remains a separate read-only SQLite reference asset (`data/airports_full.sqlite`) because it is shared reference data rather than tenant transactional storage.

## Runtime connection model

### Writes
`connect()` returns:
- SQLite transactional connection in SQLite mode
- `PostgresConnectionAdapter(read_only=False)` in PostgreSQL mode

PostgreSQL writes preserve explicit transaction semantics. Business mutation, audit row and durable `app_meta.last_change_at` are part of the same transaction.

### Reads
`read_connect()` uses:
- normal SQLite read connection in SQLite mode
- `PostgresConnectionAdapter(read_only=True)` in PostgreSQL mode

PostgreSQL read-only checkouts temporarily use autocommit. This avoids opening a transaction only to SELECT and then paying a trailing COMMIT/ROLLBACK network round-trip.

The adapter refuses DML through a read-only checkout.

## Connection pooling

`logbook_core.postgres_runtime.get_postgres_pool()` owns one process-local Psycopg pool per effective DSN/pool configuration.

Default deployment settings:
- min pool: 0
- max pool: 4
- connection timeout: 5 seconds

The pool is process-local. Runtime metrics are also process-local and diagnostic only.

## Runtime performance instrumentation

`logbook_core.runtime_metrics` stores bounded in-memory event deques.

Recorded:
- query operation/table tag
- duration
- success/failure
- returned rowcount where available
- batch size
- pool checkout duration
- active-page render duration

Not recorded:
- SQL parameters
- note contents
- passwords
- DSNs
- user-entered values

This is deliberately lightweight and has no database writes.

## PostgreSQL diagnostics

Heavy Admin diagnostics are explicit:
- table counts
- relation/index sizes
- pg_stat_user_tables data
- lifecycle metadata

Opening normal application pages does not execute these diagnostics.

`postgres_table_counts()` batches table counts rather than issuing N separate network queries.

## Cache model

User-scoped cached functions accept explicit `user_id` keys.

Important principles:
- no implicit-current-user cache functions
- airport search index is keyed by user
- rendered Streamlit UI helpers are not cached
- durable writes invalidate the smallest practical user cache surface
- global Admin aggregate overview has a short 30-second cache and is explicitly invalidated on data mutations

## Failure model

PostgreSQL production failures must remain visible.

Critical reads re-raise production database errors rather than returning:
- empty DataFrames
- zero counters
- fallback pilot profiles
- missing custom airports

`main()` provides a controlled database-error boundary around authentication and the active page. A database outage does not silently log an authenticated user out and never changes the configured backend.

## PostgreSQL Admin isolation

Migration/shadow/cutover controls live in `logbook_ui/postgres_admin.py`.

The module is imported lazily only from Admin → PostgreSQL. Normal Dashboard / Flights / Map / Profile execution does not import migration and shadow-verification tooling.

The recovery tooling is intentionally retained after production cutover but kept outside the hot path.

## Schemas

- SQLite schema: 10
- PostgreSQL schema: 1
- PostgreSQL shadow protocol: 1
- production cutover protocol: 1


## v0.73.3 performance architecture

### Track storage layers

`flight_tracks` now intentionally has two geometry layers:

1. canonical/full:
   - `coordinates_json`
   - normalized `track_points`
2. derived overview:
   - `overview_coordinates_json`
   - `overview_version`

Overview geometry is never the source of truth. It exists only to avoid
transferring/analyzing full GPS data for a map thumbnail/overview.

### Runtime schema

`logbook_core.runtime_schema.ensure_postgres_runtime_schema()` performs the
idempotent PostgreSQL v2 upgrade under an advisory lock before production
runtime initialization completes.

### Dashboard data

`read_dashboard_flights()` is a PostgreSQL compact projection and
`session_read_dashboard_flights()` is the navigation hot layer.

Dashboard and Map use this compact data for ordinary rendering. Full
`session_read_flights()` is deferred until a workflow explicitly needs complete
flight records, such as opening a full detail.

### Rendering

The default Dashboard primary chart is a lightweight HTML/CSS component. Plotly
is lazy and reserved for detailed statistics.

Map overview render budgets are deliberately bounded independently of full track
fidelity.
