# Upload v0.73.2 – Map & Database Latency Hotfix

## Deploy

1. Keep the repository `.git` directory.
2. Keep `data/logbook.sqlite` — it is the frozen emergency fallback baseline.
3. Replace application files with the v0.73 package.
4. Do **not** replace your Streamlit Secrets.
5. Commit:
   `v0.73.2 - Map & Database Latency Hotfix`
6. Push `main`.
7. Let Streamlit redeploy.

## Database

No migration is required.

Keep the current production Secrets:

```toml
[database]
postgres_dsn = "YOUR_EXISTING_DIRECT_POSTGRES_DSN"
postgres_pool_min = 0
postgres_pool_max = 4
postgres_connect_timeout = 5
production_backend = "postgresql"
cutover_confirm = "POSTGRESQL_PRODUCTION"
```

Do not add `fallback_confirm` during normal operation.

## Smoke test after deploy

Check:
1. login
2. Dashboard
3. Flights list and flight detail
4. Map / GPS track
5. Add or edit one controlled flight
6. refresh browser and confirm the write persists
7. Profile
8. Database → Aircraft
9. Admin → PostgreSQL

Admin → PostgreSQL should show PostgreSQL as production.

## Performance diagnostics

Use Admin → PostgreSQL → Runtime performance after navigating normally for several minutes.

Useful signals:
- SQL p50/p95
- pool checkout p50/p95
- slowest safe query tags
- page render p50/p95
- Psycopg pool stats

Relation/index statistics are lazy. Click **Načíst velikosti a indexy** only when diagnosing performance.

## Important backup note

The repository SQLite file is no longer a live production backup after PostgreSQL cutover.

Portable per-user ZIP backup remains available.

Provider-managed PostgreSQL backup/recovery is the production database recovery layer.


## v0.73.2 notes

No database migration is required for v0.73.2. Keep the current PostgreSQL
production Secrets unchanged.

After deploy, exercise:
1. Map → GPS tracks, especially the default Rychlá scope
2. Database → Aircraft
3. Database → Airports
4. return to Map and Database a second time to verify cache behavior
5. Admin → PostgreSQL → Runtime performance

The key production signal is that `SELECT track_points` should no longer appear
from normal GPS overview-map navigation.
