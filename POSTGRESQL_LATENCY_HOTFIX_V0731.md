# v0.73.1 – Navigation & PostgreSQL Latency Hotfix

## Evidence
Runtime performance after v0.73 deployment showed:
- SQL p50 about 148 ms
- SQL p95 about 331 ms
- SELECT flights p95 about 450 ms
- PostgreSQL pool checkout p95 0 ms
- Dashboard page-render p95 about 1.17 s
- Map page-render p95 about 0.95 s

The connection pool was therefore not the bottleneck. The dominant cost was repeated network round-trips from Streamlit reruns to Neon.

## Changes
- Session-hot `current_user_profile` snapshot.
- Session-hot computed flights dataframe shared by the main navigation pages.
- Session-hot compact logbook counts.
- 45-second hot-cache TTL to avoid indefinite cross-session staleness.
- Immediate hot-cache invalidation after flight, track, aircraft, profile, restore, and database mutations where relevant.
- Normal current-user profile query no longer joins `user_credentials`.
- Existing Streamlit caches remain as the second-level cache.
- Database health remains independent of session hot caches.

## Safety
The session cache is per browser session and tenant-keyed. It is cleared on account switch/logout because Streamlit session state is reset. Durable writes invalidate the affected hot data immediately. The 45-second TTL bounds stale reads if another session changes the same account.

## Schema
- APP_VERSION: v0.73.1
- SQLite schema: 10
- PostgreSQL schema: 1
- no migration
- no Secrets change
