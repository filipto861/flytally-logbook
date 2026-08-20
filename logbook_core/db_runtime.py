from __future__ import annotations

from dataclasses import dataclass
import os
import re
import sqlite3
from typing import Any, Iterable, Iterator, Mapping, Sequence

import pandas as pd

from .database_foundation import PostgresTargetConfig, postgres_target_config
from .postgres_runtime import get_postgres_pool


POSTGRES_CUTOVER_CONFIRM = "POSTGRESQL_PRODUCTION"
SQLITE_FALLBACK_CONFIRM = "SQLITE_EMERGENCY_FALLBACK"
VALID_BACKENDS = frozenset({"sqlite", "postgresql"})


class DatabaseBackendError(RuntimeError):
    """Base error for production storage selection/runtime failures."""


class DatabaseBackendConfigurationError(DatabaseBackendError):
    pass


class PostgresDatabaseError(DatabaseBackendError):
    pass


class PostgresIntegrityError(PostgresDatabaseError):
    pass


DATABASE_ERRORS = (sqlite3.DatabaseError, PostgresDatabaseError)
DATABASE_INTEGRITY_ERRORS = (sqlite3.IntegrityError, PostgresIntegrityError)


@dataclass(frozen=True)
class RuntimeDatabaseConfig:
    backend: str
    postgres: PostgresTargetConfig
    cutover_confirmed: bool
    sqlite_fallback_confirmed: bool

    @property
    def is_postgresql(self) -> bool:
        return self.backend == "postgresql"

    @property
    def is_sqlite(self) -> bool:
        return self.backend == "sqlite"


def resolve_runtime_database_config(
    *,
    secrets_database: Mapping[str, Any] | None = None,
    environ: Mapping[str, str] | None = None,
) -> RuntimeDatabaseConfig:
    """Resolve production backend with fail-closed cutover/fallback semantics.

    Default remains SQLite. PostgreSQL activation requires both an explicit
    backend name and an exact confirmation token. Once the PostgreSQL cutover
    token is present, switching the backend back to SQLite also requires an exact
    emergency-fallback token so a typo cannot silently create two sources of
    truth.
    """
    sec = secrets_database or {}
    env = environ if environ is not None else os.environ

    requested = str(
        sec.get("production_backend")
        or env.get("LOGBOOK_DATABASE_BACKEND")
        or "sqlite"
    ).strip().lower()
    if requested not in VALID_BACKENDS:
        raise DatabaseBackendConfigurationError(
            "Neplatný database.production_backend. Povolené hodnoty: sqlite, postgresql."
        )

    pg = postgres_target_config(secrets_database=sec, environ=env)
    cutover_token = str(
        sec.get("cutover_confirm")
        or env.get("LOGBOOK_POSTGRES_CUTOVER_CONFIRM")
        or ""
    ).strip()
    fallback_token = str(
        sec.get("fallback_confirm")
        or env.get("LOGBOOK_SQLITE_FALLBACK_CONFIRM")
        or ""
    ).strip()

    cutover_confirmed = cutover_token == POSTGRES_CUTOVER_CONFIRM
    fallback_confirmed = fallback_token == SQLITE_FALLBACK_CONFIRM

    if requested == "postgresql":
        if not pg.configured:
            raise DatabaseBackendConfigurationError(
                "PostgreSQL runtime byl vyžádán, ale chybí database.postgres_dsn."
            )
        if not cutover_confirmed:
            raise DatabaseBackendConfigurationError(
                "PostgreSQL runtime vyžaduje přesné database.cutover_confirm = "
                f"{POSTGRES_CUTOVER_CONFIRM!r}."
            )

    # If an explicit PostgreSQL cutover token remains in Secrets, an accidental
    # backend='sqlite' must not silently write into an old local copy.
    if (
        requested == "sqlite"
        and pg.configured
        and cutover_confirmed
        and not fallback_confirmed
    ):
        raise DatabaseBackendConfigurationError(
            "SQLite návrat po PostgreSQL cutoveru vyžaduje přesné "
            f"database.fallback_confirm = {SQLITE_FALLBACK_CONFIRM!r}."
        )

    return RuntimeDatabaseConfig(
        backend=requested,
        postgres=pg,
        cutover_confirmed=cutover_confirmed,
        sqlite_fallback_confirmed=fallback_confirmed,
    )


def _translate_qmark_placeholders(sql: str) -> str:
    """Translate sqlite-style ? placeholders to psycopg %s outside literals."""
    text = str(sql)
    out: list[str] = []
    in_single = False
    in_double = False
    i = 0
    while i < len(text):
        ch = text[i]
        if ch == "'" and not in_double:
            out.append(ch)
            # SQL escapes a single quote as two consecutive single quotes.
            if in_single and i + 1 < len(text) and text[i + 1] == "'":
                out.append("'")
                i += 2
                continue
            in_single = not in_single
            i += 1
            continue
        if ch == '"' and not in_single:
            out.append(ch)
            if in_double and i + 1 < len(text) and text[i + 1] == '"':
                out.append('"')
                i += 2
                continue
            in_double = not in_double
            i += 1
            continue
        if ch == "?" and not in_single and not in_double:
            out.append("%s")
            i += 1
            continue
        if ch == "%" and not in_single and not in_double:
            # psycopg uses percent-style placeholders, so a literal SQL modulo
            # operator must be escaped as %% in the client query string.
            if i + 1 < len(text) and text[i + 1] == "s":
                out.append("%s")
                i += 2
                continue
            if i + 1 < len(text) and text[i + 1] == "%":
                out.append("%%")
                i += 2
                continue
            out.append("%%")
            i += 1
            continue
        out.append(ch)
        i += 1
    return "".join(out)


class CompatRow(dict):
    """Mapping row that also preserves sqlite3.Row-style integer indexing."""

    __slots__ = ("_columns",)

    def __init__(self, mapping: Mapping[str, Any]):
        super().__init__(mapping)
        self._columns = tuple(mapping.keys())

    def __getitem__(self, key: Any) -> Any:
        if isinstance(key, int):
            try:
                key = self._columns[key]
            except IndexError as exc:
                raise IndexError(key) from exc
        return super().__getitem__(key)


class PostgresCursorAdapter:
    def __init__(self, cursor: Any):
        self._cursor = cursor

    @property
    def rowcount(self) -> int:
        try:
            return int(self._cursor.rowcount)
        except Exception:
            return -1

    @property
    def description(self):
        return self._cursor.description

    def _wrap(self, row: Any) -> Any:
        if row is None:
            return None
        if isinstance(row, CompatRow):
            return row
        if isinstance(row, Mapping):
            return CompatRow(row)
        return row

    def fetchone(self):
        return self._wrap(self._cursor.fetchone())

    def fetchall(self):
        return [self._wrap(row) for row in self._cursor.fetchall()]

    def fetchmany(self, size: int | None = None):
        if size is None:
            rows = self._cursor.fetchmany()
        else:
            rows = self._cursor.fetchmany(size)
        return [self._wrap(row) for row in rows]

    def __iter__(self) -> Iterator[Any]:
        for row in self._cursor:
            yield self._wrap(row)

    def close(self) -> None:
        self._cursor.close()


class PostgresConnectionAdapter:
    """Small sqlite-like facade over a pooled psycopg connection.

    Application SQL can keep qmark placeholders while the adapter translates
    them to psycopg parameters. It intentionally exposes only the subset of the
    sqlite connection API used by Logbook.
    """

    backend = "postgresql"

    def __init__(self, config: PostgresTargetConfig):
        self._config = config
        self._pool = get_postgres_pool(config)
        try:
            self._connection = self._pool.getconn(timeout=float(config.connect_timeout_s))
        except Exception as exc:
            raise PostgresDatabaseError(f"PostgreSQL connection failed: {exc}") from exc
        self._closed = False
        self._total_changes = 0

    @property
    def total_changes(self) -> int:
        return int(self._total_changes)

    def _translate(self, sql: str) -> str:
        translated = _translate_qmark_placeholders(sql)
        # The migrated PostgreSQL schema intentionally preserves historical
        # timestamp fields as TEXT. Make timestamp assignment explicit instead
        # of relying on PostgreSQL assignment-cast rules.
        translated = re.sub(
            r"\bCURRENT_TIMESTAMP\b(?!\s*::)",
            "CURRENT_TIMESTAMP::text",
            translated,
            flags=re.IGNORECASE,
        )
        return translated

    def _raise(self, exc: Exception) -> None:
        try:
            import psycopg
            if isinstance(exc, psycopg.IntegrityError):
                raise PostgresIntegrityError(str(exc)) from exc
        except ImportError:
            pass
        except PostgresIntegrityError:
            raise
        raise PostgresDatabaseError(str(exc)) from exc

    def execute(self, sql: str, params: Sequence[Any] | Mapping[str, Any] | None = None) -> PostgresCursorAdapter:
        try:
            cursor = self._connection.execute(self._translate(sql), params or ())
            head = str(sql).lstrip().split(None, 1)[0].upper() if str(sql).strip() else ""
            if head in {"INSERT", "UPDATE", "DELETE"}:
                try:
                    if int(cursor.rowcount) > 0:
                        self._total_changes += int(cursor.rowcount)
                except Exception:
                    pass
            return PostgresCursorAdapter(cursor)
        except Exception as exc:
            self._raise(exc)
            raise AssertionError("unreachable")

    def executemany(self, sql: str, seq_of_params: Iterable[Sequence[Any]]) -> PostgresCursorAdapter:
        try:
            cursor = self._connection.cursor()
            cursor.executemany(self._translate(sql), seq_of_params)
            try:
                if int(cursor.rowcount) > 0:
                    self._total_changes += int(cursor.rowcount)
            except Exception:
                pass
            return PostgresCursorAdapter(cursor)
        except Exception as exc:
            self._raise(exc)
            raise AssertionError("unreachable")

    def commit(self) -> None:
        try:
            self._connection.commit()
        except Exception as exc:
            self._raise(exc)

    def rollback(self) -> None:
        try:
            self._connection.rollback()
        except Exception as exc:
            self._raise(exc)

    def close(self) -> None:
        if self._closed:
            return
        try:
            # A borrowed pooled connection must never return with an open failed
            # transaction. Rollback is harmless after an already committed tx.
            try:
                self._connection.rollback()
            except Exception:
                pass
            self._pool.putconn(self._connection)
        finally:
            self._closed = True

    def __enter__(self) -> "PostgresConnectionAdapter":
        return self

    def __exit__(self, exc_type, exc, tb) -> bool:
        try:
            if exc_type is None:
                self.commit()
            else:
                self.rollback()
        finally:
            self.close()
        return False


def is_postgres_connection(con: Any) -> bool:
    return isinstance(con, PostgresConnectionAdapter) or getattr(con, "backend", None) == "postgresql"


def insert_and_get_id(con: Any, sql: str, params: Sequence[Any]) -> int:
    """Insert a row and return its generated integer primary key."""
    if is_postgres_connection(con):
        statement = str(sql).rstrip().rstrip(";")
        cursor = con.execute(statement + " RETURNING id", params)
        row = cursor.fetchone()
        if row is None:
            raise PostgresDatabaseError("INSERT RETURNING id nevrátil žádný řádek.")
        return int(row[0])
    cursor = con.execute(sql, params)
    return int(cursor.lastrowid)


def read_sql_query(
    query: str,
    con: Any,
    params: Sequence[Any] | Mapping[str, Any] | None = None,
) -> pd.DataFrame:
    """Backend-neutral small DataFrame reader.

    PostgreSQL is read through the same adapter instead of handing an unknown DBAPI
    wrapper to pandas. SQLite retains pandas' optimized sqlite path.
    """
    if not is_postgres_connection(con):
        return pd.read_sql_query(query, con, params=params)

    cursor = con.execute(query, params or ())
    rows = cursor.fetchall()
    if rows:
        if isinstance(rows[0], Mapping):
            return pd.DataFrame([dict(row) for row in rows])
        return pd.DataFrame(rows)
    columns: list[str] = []
    if cursor.description:
        for item in cursor.description:
            name = getattr(item, "name", None)
            columns.append(str(name if name is not None else item[0]))
    return pd.DataFrame(columns=columns)
