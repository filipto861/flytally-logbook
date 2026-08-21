# Letový zápisník

Current release: **v0.73.1 – Navigation & PostgreSQL Latency Hotfix**


## v0.73.1 – Navigation & PostgreSQL Latency Hotfix

Production diagnostics from v0.73 showed the bottleneck was network SQL latency rather than pool contention: roughly 148 ms SQL p50, 331 ms p95 and effectively 0 ms pool checkout p95.

This hotfix therefore reduces repeated PostgreSQL round-trips during Streamlit reruns:
- session-hot flight table reused across Dashboard / Flights / Map / Export / Profile
- session-hot current-user profile reused across sidebar and page reruns
- session-hot compact logbook counters reused on Profile/Database
- hot data has a bounded 45-second TTL and is invalidated immediately after relevant writes
- profile changes also invalidate flight presentation because currency affects computed cost labels
- normal profile query no longer joins `user_credentials`; last-login remains in the dedicated Admin overview query
- database health keeps its own cached read path and does not depend on session state
- no schema migration and no Secrets change

## v0.73 – PostgreSQL Production Polish & Performance

v0.73 is a cleanup and optimization release after the successful PostgreSQL production cutover. It does not change the user-facing data model and does not require a database migration.

### PostgreSQL runtime
- production remains PostgreSQL when `production_backend = "postgresql"` is present in Streamlit Secrets
- SQLite remains the explicit emergency fallback baseline
- no automatic PostgreSQL → SQLite fallback was introduced
- read-only PostgreSQL helpers now borrow pooled connections in autocommit mode and avoid an extra transaction COMMIT/ROLLBACK round-trip
- write helpers retain explicit transaction semantics
- PostgreSQL pool checkout and query timing are measured locally without storing SQL parameters or credentials

### Query / navigation performance
- `read_connect()` is used for normal read-only production helpers
- database header counts are batched into one production SQL statement
- Profile no longer runs a separate flight-count query; it uses the already loaded flight dataframe
- global Admin user overview is short-cached and invalidated after durable data changes
- PostgreSQL healthcheck is a single SQL round-trip
- PostgreSQL table counts are batched instead of issuing one COUNT query per table
- expensive relation/index diagnostics are lazy and run only after explicit Admin clicks
- Admin PostgreSQL migration/cutover UI was moved out of the main `app.py` execution path and is imported only when that Admin section is opened

### Runtime performance diagnostics
Admin → PostgreSQL includes local worker diagnostics for:
- SQL p50 / p95 / max
- pool checkout latency
- query failures / slow-query count
- query groups by safe operation/table tag
- page-render timing
- Psycopg pool counters
- lazy relation/table/index statistics

Metrics are in-memory diagnostics only. Raw SQL values, query parameters, passwords and DSNs are not recorded.

### Cache cleanup
- removed accidental caching from helpers where it provided no benefit or could mix user-specific state
- tenant-dependent airport caches are keyed by `user_id`
- UI-render helpers are not cached
- cache invalidation now also clears the short Admin aggregate cache after user-data mutations
- flight changes invalidate the combined logbook-count cache

### Failure visibility
PostgreSQL production read failures are no longer converted into plausible empty application data:
- profile reads do not silently become a local fallback profile
- airport override reads do not silently disappear
- database health SQL does not silently become an empty dataframe
- GPS fallback reads do not silently disappear on PostgreSQL outage
- authenticated profile read failure preserves the login session rather than logging the user out
- active-page database failures show a controlled database-unavailable state

This preserves the v0.72 fail-closed principle: an outage is visible and the app does not silently switch data sources.

### Code cleanup
- PostgreSQL Admin/migration UI extracted into `logbook_ui/postgres_admin.py`
- runtime metrics isolated in `logbook_core/runtime_metrics.py`
- removed redundant `read_table_count()` helper
- removed unused imports found by AST audit
- `app.py` reduced from approximately **10,046 lines in v0.72 to ~9,718 lines** while adding production diagnostics
- legacy migration/shadow code remains available for recovery, but it is outside the normal application execution path

### Schema
- `APP_VERSION = v0.73`
- SQLite schema remains **10**
- PostgreSQL schema remains **1**
- cutover protocol remains **1**
- **no database migration**

## Release history

- **v0.72** – PostgreSQL Production Cutover
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
- **v0.62.2** – Dashboard Card Visual Polish
- **v0.61.7** – Stability & Performance Cleanup

## Deployment

Keep the existing `.git` directory and `data/logbook.sqlite` fallback baseline when replacing files.

Real PostgreSQL/GitHub/auth credentials belong only in Streamlit Secrets and must never be committed to GitHub.
