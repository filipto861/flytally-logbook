# Upload v0.72 – PostgreSQL Production Cutover

## A. Deploy the code safely

1. Keep your local `.git` directory.
2. Keep the current `data/logbook.sqlite`.
3. Replace the application files with the v0.72 release package.
4. Confirm that `data/logbook.sqlite` was not deleted or replaced.
5. In GitHub Desktop use **Fetch** / **Pull origin** first if a newer SQLite auto-backup exists remotely.
6. Commit:
   `v0.72 - PostgreSQL Production Cutover`
7. Push to `main`.
8. Let Streamlit redeploy.

**Important:** uploading v0.72 alone does not switch production to PostgreSQL. With the current Secrets, runtime remains SQLite.

## B. Smoke test before cutover

After deploy:
1. Log in.
2. Open Dashboard, Flights, Map, Database and Profile.
3. Confirm normal SQLite behavior.
4. Open **Admin → PostgreSQL**.
5. Confirm PostgreSQL connection is OK.
6. Run **Hluboká kontrola SHA-256**.

Expected:
- SHADOW MATCH
- Counts MATCH
- Pilot totals MATCH
- SHA-256 MATCH
- Current ANO

If the shadow is STALE or MISMATCH because durable SQLite data changed, use the explicit **Obnovit PostgreSQL shadow** workflow and then run deep verification again.

## C. Prepare CUTOVER READY

When deep verification is MATCH:
1. Type `PŘIPRAVIT CUTOVER`.
2. Click **Označit PostgreSQL jako CUTOVER READY**.
3. Confirm the Admin page shows **CUTOVER READY**.

Do not change flight data between this step and the Secrets cutover.

## D. Activate PostgreSQL

In Streamlit Secrets keep the existing PostgreSQL DSN/pool values and add:

```toml
[database]
postgres_dsn = "YOUR_EXISTING_DIRECT_NEON_DSN"
postgres_pool_min = 0
postgres_pool_max = 4
postgres_connect_timeout = 5
production_backend = "postgresql"
cutover_confirm = "POSTGRESQL_PRODUCTION"
```

Do not add `fallback_confirm`.

Save Secrets. Streamlit restarts.

On first startup v0.72:
- validates CUTOVER READY
- compares the frozen SQLite watermark
- acquires the PostgreSQL lifecycle lock
- marks PostgreSQL production
- opens PostgreSQL runtime

Any failed validation stops the app instead of silently using SQLite.

## E. Post-cutover smoke test

After PostgreSQL production starts:
1. Log in.
2. Admin → PostgreSQL must show **Production: PostgreSQL**.
3. Open Dashboard.
4. Open several flight details.
5. Open a GPS track.
6. Add one small test flight or make one controlled edit.
7. Reload the app and confirm the change remains.
8. Export a portable account backup.
9. Run Database health check.

Do not manually edit the old SQLite database after cutover.

## F. Emergency SQLite fallback

Use only during a real incident:

```toml
[database]
production_backend = "sqlite"
cutover_confirm = "POSTGRESQL_PRODUCTION"
fallback_confirm = "SQLITE_EMERGENCY_FALLBACK"
```

A red global banner will show that fallback is active.

If any business write happens during fallback, SQLite and PostgreSQL intentionally diverge. v0.72 will then refuse an automatic PostgreSQL rejoin until data is manually reconciled.

Never treat the frozen SQLite file as a current PostgreSQL backup.
