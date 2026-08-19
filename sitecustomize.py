"""Runtime SQLite compatibility patches for the logbook app.

This module is imported automatically by Python when present on sys.path.  It is
kept intentionally small: it protects older deployed databases from schema
mismatches and applies safe runtime compatibility patches.
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
        # Compatibility with one intermediate version that used these names.
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


def _patch_folium_popup_targets() -> None:
    """Make route-overview detail links break out of Folium/Streamlit iframes.

    Folium popups are rendered inside an iframe by streamlit-folium. A normal
    target="_self" opens the Streamlit app inside that map iframe. For flight
    detail links we need top-window navigation instead.
    """
    try:
        import folium  # Imported here intentionally; Folium is already required by the app.
    except Exception:
        return

    try:
        popup_cls = folium.Popup
        if getattr(popup_cls, "_logbook_target_patch", False):
            return
        original_init = popup_cls.__init__

        def patched_init(self, html=None, *args, **kwargs):  # type: ignore[no-untyped-def]
            if isinstance(html, str) and "flight_id=" in html:
                html = html.replace('target="_self"', 'target="_top" rel="noopener"')
                html = html.replace("target='_self'", "target='_top' rel='noopener'")
            return original_init(self, html, *args, **kwargs)

        popup_cls.__init__ = patched_init
        popup_cls._logbook_target_patch = True
    except Exception:
        pass


_patch_folium_popup_targets()
