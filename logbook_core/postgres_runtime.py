from __future__ import annotations

from contextlib import contextmanager
from dataclasses import asdict
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
                    "application_name": "logbook-v070",
                },
                open=True,
                name="logbook-postgres-target",
            )
            _POOLS[key] = pool
        return pool


@contextmanager
def postgres_connection(config: PostgresTargetConfig) -> Iterator[Any]:
    pool = get_postgres_pool(config)
    with pool.connection(timeout=float(config.connect_timeout_s)) as con:
        yield con


def close_postgres_pools() -> None:
    with _POOL_LOCK:
        pools = list(_POOLS.values())
        _POOLS.clear()
    for pool in pools:
        try:
            pool.close()
        except Exception:
            pass


def postgres_healthcheck(config: PostgresTargetConfig) -> dict[str, Any]:
    """Test target connectivity and return non-secret diagnostics."""
    if not config.configured:
        return {
            "ok": False,
            "configured": False,
            "error": "PostgreSQL target není nakonfigurovaný.",
        }
    try:
        with postgres_connection(config) as con:
            row = con.execute(
                """
                SELECT
                    current_database() AS database_name,
                    current_user AS user_name,
                    current_schema() AS schema_name,
                    current_setting('server_version') AS server_version
                """
            ).fetchone()
            has_meta = bool(
                con.execute(
                    "SELECT to_regclass('public.app_meta') IS NOT NULL AS present"
                ).fetchone()["present"]
            )
            schema_version = None
            if has_meta:
                meta_row = con.execute(
                    "SELECT value FROM app_meta WHERE key = 'schema_version'"
                ).fetchone()
                schema_version = str(meta_row["value"]) if meta_row else None
            return {
                "ok": True,
                "configured": True,
                "database_name": str(row["database_name"]),
                "user_name": str(row["user_name"]),
                "schema_name": str(row["schema_name"]),
                "server_version": str(row["server_version"]),
                "app_meta_present": has_meta,
                "logbook_schema_version": schema_version,
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
    """Read Logbook target counts without modifying PostgreSQL."""
    counts: dict[str, int] = {}
    with postgres_connection(config) as con:
        existing = {
            str(row["table_name"])
            for row in con.execute(
                """
                SELECT table_name
                FROM information_schema.tables
                WHERE table_schema = 'public'
                """
            ).fetchall()
        }
        for table in POSTGRES_TABLE_ORDER:
            if table not in existing:
                counts[table] = -1
                continue
            # Table names come from a static allow-list above.
            row = con.execute(f'SELECT COUNT(*) AS n FROM "{table}"').fetchone()
            counts[table] = int(row["n"])
    return counts
