from __future__ import annotations

from dataclasses import dataclass, asdict
from datetime import datetime, timezone
import json
from pathlib import Path
import sqlite3
import tempfile
from typing import Any, Callable

from .postgres_schema import (
    POSTGRES_SCHEMA_STATEMENTS,
    POSTGRES_SCHEMA_VERSION,
    POSTGRES_SERIAL_TABLES,
    POSTGRES_TABLE_COLUMNS,
    POSTGRES_TABLE_ORDER,
)
from .sqlite_runtime import snapshot_sqlite_bytes


MIGRATION_FORMAT = "logbook-sqlite-to-postgresql"
MIGRATION_FORMAT_VERSION = 1


class PostgresMigrationError(RuntimeError):
    pass


@dataclass(frozen=True)
class MigrationPlan:
    format: str
    format_version: int
    created_at: str
    source_path: str
    sqlite_schema_version: int
    postgres_schema_version: int
    table_counts: dict[str, int]
    total_rows: int
    world_airports_migrated: bool
    notes: tuple[str, ...]

    def as_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass(frozen=True)
class MigrationReport:
    ok: bool
    source_counts: dict[str, int]
    target_counts: dict[str, int]
    copied_rows: int
    tenant_checks: dict[str, int]
    sqlite_schema_version: int
    postgres_schema_version: int

    def as_dict(self) -> dict[str, Any]:
        return asdict(self)


def _sqlite_connection(path: Path) -> sqlite3.Connection:
    uri = f"file:{path.resolve().as_posix()}?mode=ro"
    con = sqlite3.connect(uri, uri=True, timeout=10.0)
    con.row_factory = sqlite3.Row
    con.execute("PRAGMA foreign_keys = ON")
    return con


def _sqlite_tables(con: sqlite3.Connection) -> set[str]:
    return {
        str(row[0])
        for row in con.execute(
            "SELECT name FROM sqlite_master WHERE type='table'"
        ).fetchall()
    }


def _sqlite_schema_version(con: sqlite3.Connection) -> int:
    try:
        row = con.execute(
            "SELECT value FROM app_meta WHERE key='schema_version'"
        ).fetchone()
        return int(row[0]) if row and row[0] is not None else 0
    except Exception:
        return 0


def build_sqlite_migration_plan(sqlite_path: str | Path) -> MigrationPlan:
    path = Path(sqlite_path)
    if not path.exists():
        raise FileNotFoundError(path)

    con = _sqlite_connection(path)
    try:
        tables = _sqlite_tables(con)
        missing = [table for table in POSTGRES_TABLE_ORDER if table not in tables]
        if missing:
            raise PostgresMigrationError(
                "SQLite zdroji chybí tabulky: " + ", ".join(missing)
            )
        counts = {
            table: int(con.execute(f'SELECT COUNT(*) FROM "{table}"').fetchone()[0])
            for table in POSTGRES_TABLE_ORDER
        }
        schema_version = _sqlite_schema_version(con)
    finally:
        con.close()

    return MigrationPlan(
        format=MIGRATION_FORMAT,
        format_version=MIGRATION_FORMAT_VERSION,
        created_at=datetime.now(timezone.utc).isoformat(timespec="seconds"),
        source_path=str(path),
        sqlite_schema_version=schema_version,
        postgres_schema_version=POSTGRES_SCHEMA_VERSION,
        table_counts=counts,
        total_rows=sum(counts.values()),
        world_airports_migrated=False,
        notes=(
            "Migrace zachovává primární ID i user_id.",
            "Globální data/airports_full.sqlite se nemigruje; zůstává read-only souborem aplikace.",
            "Cílová PostgreSQL databáze musí být prázdná.",
            "Migrační nástroj nikdy nemaže existující PostgreSQL řádky.",
            "Runtime cutover není součástí v0.70.",
        ),
    )


def migration_plan_json(plan: MigrationPlan) -> bytes:
    return json.dumps(
        plan.as_dict(),
        ensure_ascii=False,
        indent=2,
        sort_keys=True,
    ).encode("utf-8")


def _pg_imports():
    try:
        import psycopg
        from psycopg.rows import dict_row
        return psycopg, dict_row
    except Exception as exc:
        raise PostgresMigrationError(
            "PostgreSQL driver není dostupný. Nainstaluj requirements.txt."
        ) from exc


def _initialize_postgres_schema(con: Any) -> None:
    for statement in POSTGRES_SCHEMA_STATEMENTS:
        con.execute(statement)


def _postgres_existing_counts(con: Any) -> dict[str, int]:
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
    counts: dict[str, int] = {}
    for table in POSTGRES_TABLE_ORDER:
        if table not in existing:
            counts[table] = -1
        else:
            counts[table] = int(
                con.execute(f'SELECT COUNT(*) AS n FROM "{table}"').fetchone()["n"]
            )
    return counts


def _assert_empty_target(con: Any) -> None:
    counts = _postgres_existing_counts(con)
    nonempty = {table: count for table, count in counts.items() if count > 0}
    if nonempty:
        detail = ", ".join(f"{table}={count}" for table, count in sorted(nonempty.items()))
        raise PostgresMigrationError(
            "Cílová PostgreSQL databáze není prázdná: " + detail
        )


def _copy_table(
    sqlite_con: sqlite3.Connection,
    pg_con: Any,
    table: str,
    *,
    batch_size: int,
    progress: Callable[[str, int, int], None] | None = None,
) -> int:
    columns = POSTGRES_TABLE_COLUMNS[table]
    quoted_columns = ", ".join(f'"{column}"' for column in columns)
    placeholders = ", ".join(["%s"] * len(columns))
    insert_sql = f'INSERT INTO "{table}" ({quoted_columns}) VALUES ({placeholders})'

    sqlite_cursor = sqlite_con.execute(
        f'SELECT {quoted_columns} FROM "{table}"'
    )
    total = int(
        sqlite_con.execute(f'SELECT COUNT(*) FROM "{table}"').fetchone()[0]
    )
    copied = 0
    while True:
        rows = sqlite_cursor.fetchmany(max(1, int(batch_size)))
        if not rows:
            break
        values = [tuple(row[column] for column in columns) for row in rows]
        with pg_con.cursor() as cur:
            cur.executemany(insert_sql, values)
        copied += len(values)
        if progress:
            progress(table, copied, total)
    return copied


def _reset_postgres_sequences(con: Any) -> None:
    for table in POSTGRES_SERIAL_TABLES:
        row = con.execute(f'SELECT MAX(id) AS max_id FROM "{table}"').fetchone()
        max_id = row["max_id"]
        if max_id is None:
            con.execute(
                "SELECT setval(pg_get_serial_sequence(%s, 'id'), 1, false)",
                (table,),
            )
        else:
            con.execute(
                "SELECT setval(pg_get_serial_sequence(%s, 'id'), %s, true)",
                (table, int(max_id)),
            )


def postgres_tenant_checks(con: Any) -> dict[str, int]:
    checks = {
        "orphan_user_expiries": """
            SELECT COUNT(*) AS n FROM user_expiries x
            LEFT JOIN users u ON u.id=x.user_id WHERE u.id IS NULL
        """,
        "orphan_flights": """
            SELECT COUNT(*) AS n FROM flights x
            LEFT JOIN users u ON u.id=x.user_id WHERE u.id IS NULL
        """,
        "orphan_aircraft": """
            SELECT COUNT(*) AS n FROM aircraft x
            LEFT JOIN users u ON u.id=x.user_id WHERE u.id IS NULL
        """,
        "orphan_rates": """
            SELECT COUNT(*) AS n FROM rates x
            LEFT JOIN users u ON u.id=x.user_id WHERE u.id IS NULL
        """,
        "orphan_airports": """
            SELECT COUNT(*) AS n FROM airports x
            LEFT JOIN users u ON u.id=x.user_id WHERE u.id IS NULL
        """,
        "track_owner_mismatch": """
            SELECT COUNT(*) AS n FROM flight_tracks t
            JOIN flights f ON f.id=t.flight_id
            WHERE t.user_id <> f.user_id
        """,
        "point_owner_mismatch": """
            SELECT COUNT(*) AS n FROM track_points p
            JOIN flight_tracks t ON t.id=p.track_id
            WHERE p.user_id <> t.user_id
        """,
        "orphan_tracks": """
            SELECT COUNT(*) AS n FROM flight_tracks t
            LEFT JOIN flights f ON f.id=t.flight_id WHERE f.id IS NULL
        """,
        "orphan_points": """
            SELECT COUNT(*) AS n FROM track_points p
            LEFT JOIN flight_tracks t ON t.id=p.track_id WHERE t.id IS NULL
        """,
    }
    return {
        name: int(con.execute(sql).fetchone()["n"])
        for name, sql in checks.items()
    }


def migrate_sqlite_to_postgres(
    sqlite_path: str | Path,
    dsn: str,
    *,
    batch_size: int = 1000,
    progress: Callable[[str, int, int], None] | None = None,
) -> MigrationReport:
    """Copy a consistent SQLite snapshot into an empty PostgreSQL target.

    This function never truncates PostgreSQL. If any Logbook target table
    contains rows, migration is refused.
    """
    source_path = Path(sqlite_path)
    plan = build_sqlite_migration_plan(source_path)
    if not str(dsn or "").strip():
        raise PostgresMigrationError("Chybí PostgreSQL DSN.")

    psycopg, dict_row = _pg_imports()
    snapshot_raw = snapshot_sqlite_bytes(source_path)
    temp = tempfile.NamedTemporaryFile(
        prefix=".logbook_pg_migration_",
        suffix=".sqlite",
        delete=False,
    )
    temp_path = Path(temp.name)
    temp.close()
    temp_path.write_bytes(snapshot_raw)

    sqlite_con: sqlite3.Connection | None = None
    pg_con: Any = None
    try:
        sqlite_con = _sqlite_connection(temp_path)
        pg_con = psycopg.connect(
            dsn,
            row_factory=dict_row,
            connect_timeout=10,
            application_name="logbook-v070-migration",
        )
        with pg_con.transaction():
            pg_con.execute(
                "SELECT pg_advisory_xact_lock(hashtext('logbook-v070-sqlite-migration'))"
            )
            _initialize_postgres_schema(pg_con)
            _assert_empty_target(pg_con)

            copied_rows = 0
            for table in POSTGRES_TABLE_ORDER:
                copied_rows += _copy_table(
                    sqlite_con,
                    pg_con,
                    table,
                    batch_size=batch_size,
                    progress=progress,
                )

            _reset_postgres_sequences(pg_con)
            pg_con.execute(
                """
                INSERT INTO app_meta(key, value, updated_at)
                VALUES ('storage_backend', 'postgresql', %s)
                ON CONFLICT(key) DO UPDATE
                SET value=EXCLUDED.value, updated_at=EXCLUDED.updated_at
                """,
                (datetime.now(timezone.utc).isoformat(timespec="seconds"),),
            )
            pg_con.execute(
                """
                INSERT INTO app_meta(key, value, updated_at)
                VALUES ('postgres_foundation_schema', %s, %s)
                ON CONFLICT(key) DO UPDATE
                SET value=EXCLUDED.value, updated_at=EXCLUDED.updated_at
                """,
                (
                    str(POSTGRES_SCHEMA_VERSION),
                    datetime.now(timezone.utc).isoformat(timespec="seconds"),
                ),
            )

            target_counts = _postgres_existing_counts(pg_con)
            source_counts = dict(plan.table_counts)
            for table in POSTGRES_TABLE_ORDER:
                expected = source_counts[table]
                actual = target_counts[table]
                if table == "app_meta":
                    # Two migration metadata keys may be new in PostgreSQL.
                    if actual < expected:
                        raise PostgresMigrationError(
                            f"Počet řádků nesedí pro {table}: SQLite={expected}, PostgreSQL={actual}"
                        )
                elif actual != expected:
                    raise PostgresMigrationError(
                        f"Počet řádků nesedí pro {table}: SQLite={expected}, PostgreSQL={actual}"
                    )

            tenant_checks = postgres_tenant_checks(pg_con)
            bad = {name: count for name, count in tenant_checks.items() if count != 0}
            if bad:
                raise PostgresMigrationError(
                    "Tenant/FK kontrola po migraci selhala: "
                    + ", ".join(f"{name}={count}" for name, count in sorted(bad.items()))
                )

        return MigrationReport(
            ok=True,
            source_counts=dict(plan.table_counts),
            target_counts=target_counts,
            copied_rows=copied_rows,
            tenant_checks=tenant_checks,
            sqlite_schema_version=plan.sqlite_schema_version,
            postgres_schema_version=POSTGRES_SCHEMA_VERSION,
        )
    except PostgresMigrationError:
        if pg_con is not None:
            try:
                pg_con.rollback()
            except Exception:
                pass
        raise
    except Exception as exc:
        if pg_con is not None:
            try:
                pg_con.rollback()
            except Exception:
                pass
        raise PostgresMigrationError(str(exc)) from exc
    finally:
        if pg_con is not None:
            pg_con.close()
        if sqlite_con is not None:
            sqlite_con.close()
        try:
            temp_path.unlink(missing_ok=True)
        except Exception:
            pass
