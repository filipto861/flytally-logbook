# Logbook v0.71 – PostgreSQL shadow verification

## Safety model
- SQLite is production.
- PostgreSQL is a shadow copy only.
- Runtime cutover is disabled.
- Shadow migration requires an empty target.
- The app has no PostgreSQL target reset or destructive resync action.

## First shadow migration
Configure `[database].postgres_dsn` in Streamlit Secrets, open Admin → PostgreSQL, test the connection, type `VYTVOŘIT SHADOW`, acknowledge that account credentials/password hashes are included, and start the migration.

The migration uses a consistent SQLite Backup API snapshot and one PostgreSQL transaction.

## Verification states
- `MATCH`: watermark, normalized counts and pilot metrics match; deep SHA also matches if performed.
- `STALE`: SQLite `last_change_at` changed after the shadow snapshot. This is expected after new production writes.
- `MISMATCH`: counts, pilot metrics or deep fingerprints differ while comparing the snapshot state.
- `NOT_SHADOW`: PostgreSQL was not created by the v0.71 shadow migration protocol.

## Deep verification
Deep verification hashes every migrated table in deterministic key order. It is explicit because `track_points` can be large. It still does not load the world-airport reference database because that database is intentionally outside PostgreSQL migration scope.

## CLI
```bash
python scripts/verify_postgres_shadow.py
python scripts/verify_postgres_shadow.py --deep
```

The command returns exit code 0 only when the shadow is current and matches the production SQLite snapshot.
