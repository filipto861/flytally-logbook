# Logbook v0.70 – PostgreSQL migration foundation

## What this release does
v0.70 prepares a PostgreSQL target without switching the running application away from SQLite.

## Target setup
Create an empty managed PostgreSQL database. Prefer TLS/SSL and a dedicated database user that owns only the Logbook database.

Configure Streamlit only for diagnostics:

```toml
[database]
postgres_dsn = "postgresql://USER:PASSWORD@HOST:5432/DBNAME?sslmode=require"
postgres_pool_min = 0
postgres_pool_max = 4
postgres_connect_timeout = 5
```

The DSN does **not** enable runtime cutover.

## Review the source first
```bash
python scripts/migrate_sqlite_to_postgres.py --dry-run
```

This reads SQLite only and prints table counts and migration metadata.

## Run the migration
Prefer passing the DSN through a protected environment variable:

```bash
export LOGBOOK_POSTGRES_DSN='postgresql://...'
python scripts/migrate_sqlite_to_postgres.py --confirm MIGRATE
```

The tool:
1. validates the SQLite source structure;
2. creates a transactionally consistent SQLite Backup API snapshot;
3. opens PostgreSQL and takes an advisory transaction lock;
4. creates the versioned PostgreSQL schema if necessary;
5. refuses to continue if any Logbook target table contains rows;
6. copies tables in FK-safe order while preserving IDs/user_id;
7. advances PostgreSQL identity sequences;
8. verifies table counts;
9. verifies orphan and tenant-owner relationships;
10. commits only if every check passes.

No target `TRUNCATE`, `DELETE` or merge operation exists.

## World airport database
`data/airports_full.sqlite` is intentionally not copied. It is a shared read-only reference catalogue rather than transactional user data.

## Cutover
There is no cutover in v0.70. Continue running the production app on SQLite after the migration. The PostgreSQL copy is a target/shadow database for verification until a later release moves CRUD to a backend repository layer.
