"""Minimal SQLite compatibility shim for the logbook runtime.

Only the live ``logbook.sqlite`` connection is wrapped.  The previous shim
inspected/modified every SQLite database opened by the process, including the
large read-only airport catalogue.  That added avoidable work to many reruns.

The current app performs normal schema migration in ``app.py``.  This module is
kept only as a last-resort repair path for an older ``audit_log`` schema if an
audit statement fails at runtime.
"""
from __future__ import annotations

import os
import sqlite3

_ORIGINAL_CONNECT = sqlite3.connect


def _columns(conn: sqlite3.Connection, table: str) -> set[str]:
    try:
        return {row[1] for row in conn.execute(f"PRAGMA table_info({table})").fetchall()}
    except Exception:
        return set()


def _add_column_if_missing(conn: sqlite3.Connection, table: str, column: str, ddl: str) -> None:
    if column not in _columns(conn, table):
        conn.execute(f"ALTER TABLE {table} ADD COLUMN {ddl}")


def _ensure_audit_schema(conn: sqlite3.Connection) -> None:
    try:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS audit_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                created_at TEXT NOT NULL,
                actor TEXT,
                action TEXT NOT NULL,
                object_type TEXT,
                object_id TEXT,
                detail_json TEXT
            )
            """
        )
        _add_column_if_missing(conn, "audit_log", "actor", "actor TEXT")
        _add_column_if_missing(conn, "audit_log", "action", "action TEXT")
        _add_column_if_missing(conn, "audit_log", "object_type", "object_type TEXT")
        _add_column_if_missing(conn, "audit_log", "object_id", "object_id TEXT")
        _add_column_if_missing(conn, "audit_log", "detail_json", "detail_json TEXT")
    except Exception:
        pass


class PatchedConnection(sqlite3.Connection):
    def execute(self, sql, parameters=(), /):  # type: ignore[override]
        try:
            return super().execute(sql, parameters)
        except sqlite3.OperationalError:
            if isinstance(sql, str) and "audit_log" in sql:
                _ensure_audit_schema(self)
                return super().execute(sql, parameters)
            raise


def _is_logbook_database(database) -> bool:
    try:
        text = os.fspath(database)
    except Exception:
        text = str(database or "")
    # Covers a normal path as well as a SQLite URI such as file:/.../logbook.sqlite.
    return "logbook.sqlite" in text.replace("\\", "/").lower()


def connect(*args, **kwargs):
    database = args[0] if args else kwargs.get("database")
    if not _is_logbook_database(database):
        return _ORIGINAL_CONNECT(*args, **kwargs)
    kwargs.setdefault("factory", PatchedConnection)
    return _ORIGINAL_CONNECT(*args, **kwargs)


sqlite3.connect = connect
