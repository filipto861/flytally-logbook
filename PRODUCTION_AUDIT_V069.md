# Production Audit v0.69

## Scope
Cold-start/bootstrap, SQLite concurrency, backup/restore consistency, cache invalidation, session isolation, authentication abuse resistance, tenant boundaries, admin service behavior, heavy diagnostics, HTML rendering, dead code, and PostgreSQL-readiness.

## High-priority findings fixed
1. `read_flights` had two `st.cache_data` decorators and `read_track_metadata_for_flights` had three. Clearing the outer wrapper could leave an inner cached value stale.
2. Logout cleared only a handful of session keys. Prepared backups/import state could survive an account switch in the same browser session.
3. Technical SQLite backup/download copied the live WAL-mode main file directly. A single-file copy is not the correct consistency boundary for a live WAL database.
4. Full DB restore trusted only the SQLite file header and replaced the live file non-atomically, without integrity/FK/schema validation or forced reauthentication.
5. Concurrent sessions could race on first-process database initialization and on GitHub backup SHA updates.
6. Admin “Safe Service” modified semantic flight fields globally across all tenants. That responsibility now belongs exclusively to explicit Data Quality repairs.
7. Tenant ownership of GPS child rows was enforced in application code but not at the SQLite relationship boundary.
8. Database health JSON validation could decode every stored KML track when no error was found.
9. Cache invalidation cleared whole cached functions for unrelated users after normal writes.
10. Database page contained unreachable legacy Control/Backup/Meta branches and several obsolete helpers/invalidation names.

## Additional hardening
- 10 s SQLite busy timeout.
- process lock for cold DB initialization.
- process lock for GitHub backup serialization.
- consistent SQLite Backup API snapshots.
- validated/atomic full restore with rollback snapshot file.
- session-level exponential login cooldown after repeated failures.
- index-friendly airport ident lookup.
- HTML escaping in map selection mini tables.
- owner guard triggers for flight→track and track→point tenant relations.
- admin health track JSON scan capped to 500 newest rows.
- removed `sitecustomize.py`; startup has no implicit Python hook.

## Deliberately deferred to v0.70
- replacing direct SQLite SQL calls with a PostgreSQL repository/transaction abstraction;
- server-side SQL aggregation/pagination for the full flight logbook;
- durable distributed login rate limiting across multiple app processes;
- external object storage for very large raw KML payloads;
- asynchronous backup worker/queue (current deployment intentionally keeps confirmed writes synchronous with GitHub persistence).

## Offline maintenance script finding
The legacy `scripts/import_excel.py` still used pre-multi-user tables and a global reset that could delete every profile's flights/rates. v0.69 updates it to the current schema and requires a target `--user-id`; reset now deletes only that tenant's rows.
