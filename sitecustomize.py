"""Runtime compatibility patches for Streamlit Cloud SQLite deployments.

This file is intentionally small and is imported automatically by Python when
present on sys.path. It keeps older logbook.sqlite schemas compatible with the
current app code, mainly older audit_log tables. It also applies a tiny UI patch
for the Streamlit menu toggle buttons so the app can use a discreet arrow
instead of full text labels.
"""
from __future__ import annotations

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
                action TEXT,
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
        _add_column_if_missing(conn, "audit_log", "user", "user TEXT")
        _add_column_if_missing(conn, "audit_log", "entity", "entity TEXT")
        _add_column_if_missing(conn, "audit_log", "entity_id", "entity_id TEXT")
        _add_column_if_missing(conn, "audit_log", "detail", "detail TEXT")
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


def connect(*args, **kwargs):
    kwargs.setdefault("factory", PatchedConnection)
    conn = _ORIGINAL_CONNECT(*args, **kwargs)
    try:
        _ensure_audit_schema(conn)
    except Exception:
        pass
    return conn


sqlite3.connect = connect


# -----------------------------------------------------------------------------
# Small UI compatibility patch
# -----------------------------------------------------------------------------

def _patch_streamlit_buttons() -> None:
    """Replace the two menu-toggle text buttons with compact arrows.

    The app code keeps readable labels for maintainability. At runtime, this
    patch turns only these two exact labels into small, unobtrusive arrow
    buttons and leaves all other Streamlit buttons unchanged.
    """
    try:
        import streamlit as st  # Imported lazily enough for Streamlit Cloud.
    except Exception:
        return

    if getattr(st, "_logbook_button_patch_applied", False):
        return

    original_button = st.button

    def compact_button(label, *args, **kwargs):
        if label == "Menu":
            label = "›"
            kwargs["help"] = kwargs.get("help") or "Zobrazit menu"
            kwargs["type"] = "secondary"
            kwargs["use_container_width"] = False
        elif label == "Skrýt menu":
            label = "‹"
            kwargs["help"] = kwargs.get("help") or "Skrýt menu"
            kwargs["type"] = "secondary"
            kwargs["use_container_width"] = False
        return original_button(label, *args, **kwargs)

    st.button = compact_button
    st._logbook_button_patch_applied = True


_patch_streamlit_buttons()
