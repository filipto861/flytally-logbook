from __future__ import annotations

from contextlib import contextmanager
import threading
from typing import Any, Iterator

from .database_foundation import PostgresTargetConfig, redact_postgres_dsn
from .postgres_schema import POSTGRES_SCHEMA_VERSION, POSTGRES_TABLE_ORDER


_POOL_LOCK = threading.RLock()
_POOLS: dict[tuple[str, int, int, int], Any] = {}


class PostgresUnavailableError(RuntimeError):
    pass


def _imports():
    try:
        import psycopg
        from psycopg.rows import dict_row
        from psycopg_pool import ConnectionPool
        return psycopg, dict_row, ConnectionPool
    except Exception as exc:
        raise PostgresUnavailableError(
            "PostgreSQL driver není dostupný. Nainstaluj requirements.txt."
        ) from exc


def postgres_driver_available() -> bool:
    try:
        _imports()
        return True
    except PostgresUnavailableError:
        return False


def get_postgres_pool(config: PostgresTargetConfig):
    if not config.configured:
        raise PostgresUnavailableError("PostgreSQL target není nakonfigurovaný.")
    _psycopg, dict_row, ConnectionPool = _imports()
    key = (
        config.dsn,
        int(config.min_pool_size),
        int(config.max_pool_size),
        int(config.connect_timeout_s),
    )
    with _POOL_LOCK:
        pool = _POOLS.get(key)
        if pool is None:
            pool = ConnectionPool(
                conninfo=config.dsn,
                min_size=int(config.min_pool_size),
                max_size=int(config.max_pool_size),
                timeout=float(config.connect_timeout_s),
                kwargs={
                    "connect_timeout": int(config.connect_timeout_s),
                    "row_factory": dict_row,
                    "application_name": "logbook-v073",
                },
                open=True,
                name="logbook-postgres-runtime",
            )
            _POOLS[key] = pool
        return pool


@contextmanager
def postgres_connection(config: PostgresTargetConfig) -> Iterator[Any]:
    pool = get_postgres_pool(config)
    with pool.connection(timeout=float(config.connect_timeout_s)) as con:
        yield con


@contextmanager
def postgres_read_connection(config: PostgresTargetConfig) -> Iterator[Any]:
    """Borrow an autocommit connection for diagnostics/read-only maintenance.

    Unlike ``pool.connection()`` this avoids opening a transaction merely to run
    a health/count query, so the caller does not pay a trailing COMMIT round-trip.
    """
    pool = get_postgres_pool(config)
    con = pool.getconn(timeout=float(config.connect_timeout_s))
    returned = False
    try:
        con.autocommit = True
        yield con
    finally:
        try:
            con.autocommit = False
            pool.putconn(con)
            returned = True
        finally:
            if not returned:
                try:
                    con.close()
                except Exception:
                    pass


def close_postgres_pools() -> None:
    with _POOL_LOCK:
        pools = list(_POOLS.values())
        _POOLS.clear()
    for pool in pools:
        try:
            pool.close()
        except Exception:
            pass


def postgres_pool_stats(config: PostgresTargetConfig) -> dict[str, Any]:
    """Return local Psycopg pool counters without querying PostgreSQL."""
    if not config.configured:
        return {"configured": False}
    try:
        pool = get_postgres_pool(config)
        raw = pool.get_stats() if hasattr(pool, "get_stats") else {}
        safe: dict[str, Any] = {"configured": True}
        for key, value in dict(raw or {}).items():
            if isinstance(value, (int, float, str, bool)) or value is None:
                safe[str(key)] = value
        return safe
    except Exception as exc:
        return {"configured": True, "error": str(exc)}


def postgres_healthcheck(config: PostgresTargetConfig) -> dict[str, Any]:
    """Test target connectivity in one database round-trip."""
    if not config.configured:
        return {
            "ok": False,
            "configured": False,
            "error": "PostgreSQL target není nakonfigurovaný.",
        }
    try:
        with postgres_read_connection(config) as con:
            row = con.execute(
                """
                SELECT
                    current_database() AS database_name,
                    current_user AS user_name,
                    current_schema() AS schema_name,
                    current_setting('server_version') AS server_version,
                    to_regclass('public.app_meta') IS NOT NULL AS app_meta_present,
                    CASE
                        WHEN to_regclass('public.app_meta') IS NOT NULL
                        THEN (SELECT value FROM app_meta WHERE key='schema_version' LIMIT 1)
                        ELSE NULL
                    END AS logbook_schema_version
                """
            ).fetchone()
            return {
                "ok": True,
                "configured": True,
                "database_name": str(row["database_name"]),
                "user_name": str(row["user_name"]),
                "schema_name": str(row["schema_name"]),
                "server_version": str(row["server_version"]),
                "app_meta_present": bool(row["app_meta_present"]),
                "logbook_schema_version": (
                    str(row["logbook_schema_version"])
                    if row["logbook_schema_version"] is not None
                    else None
                ),
                "postgres_foundation_schema": POSTGRES_SCHEMA_VERSION,
                "dsn": redact_postgres_dsn(config.dsn),
            }
    except Exception as exc:
        return {
            "ok": False,
            "configured": True,
            "dsn": redact_postgres_dsn(config.dsn),
            "error": str(exc),
        }


def postgres_table_counts(config: PostgresTargetConfig) -> dict[str, int]:
    """Read all Logbook table counts in at most two PostgreSQL round-trips."""
    counts: dict[str, int] = {table: -1 for table in POSTGRES_TABLE_ORDER}
    with postgres_read_connection(config) as con:
        existing = {
            str(row["table_name"])
            for row in con.execute(
                """
                SELECT table_name
                FROM information_schema.tables
                WHERE table_schema = 'public'
                  AND table_name = ANY(%s)
                """,
                (list(POSTGRES_TABLE_ORDER),),
            ).fetchall()
        }
        if not existing:
            return counts

        # Static allow-list table names from POSTGRES_TABLE_ORDER; no user input.
        selects = [
            f"SELECT '{table}' AS table_name, COUNT(*)::bigint AS n FROM \"{table}\""
            for table in POSTGRES_TABLE_ORDER
            if table in existing
        ]
        rows = con.execute(" UNION ALL ".join(selects)).fetchall()
        for row in rows:
            counts[str(row["table_name"])] = int(row["n"])
    return counts


def postgres_relation_stats(config: PostgresTargetConfig) -> list[dict[str, Any]]:
    """Compact production table/index diagnostics for Admin performance UI."""
    if not config.configured:
        return []
    with postgres_read_connection(config) as con:
        rows = con.execute(
            """
            SELECT
                s.relname AS table_name,
                COALESCE(s.n_live_tup, 0)::bigint AS estimated_rows,
                COALESCE(s.seq_scan, 0)::bigint AS seq_scan,
                COALESCE(s.idx_scan, 0)::bigint AS idx_scan,
                pg_total_relation_size(s.relid)::bigint AS total_bytes,
                pg_relation_size(s.relid)::bigint AS table_bytes,
                pg_indexes_size(s.relid)::bigint AS index_bytes,
                s.last_analyze,
                s.last_autoanalyze
            FROM pg_stat_user_tables s
            WHERE s.schemaname='public'
              AND s.relname = ANY(%s)
            ORDER BY pg_total_relation_size(s.relid) DESC, s.relname
            """,
            (list(POSTGRES_TABLE_ORDER),),
        ).fetchall()
        return [dict(row) for row in rows]
