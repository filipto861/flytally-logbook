"""Runtime SQLite and UI compatibility patches for the logbook app.

This module is imported automatically by Python when present on sys.path.  It is
kept intentionally small: it protects older deployed databases from schema
mismatches and applies small runtime patches that are safe for the hosted app.
"""
from __future__ import annotations

import sqlite3
from typing import Any

_ORIGINAL_CONNECT = sqlite3.connect
_PATCHED_FOLIUM = False


def _columns(conn: sqlite3.Connection, table: str) -> set[str]:
    try:
        return {row[1] for row in conn.execute(f"PRAGMA table_info({table})").fetchall()}
    except Exception:
        return set()


def _add_column_if_missing(conn: sqlite3.Connection, table: str, column: str, ddl: str) -> None:
    try:
        if column not in _columns(conn, table):
            conn.execute(f"ALTER TABLE {table} ADD COLUMN {ddl}")
    except Exception:
        pass


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


def _ensure_airports_schema(conn: sqlite3.Connection) -> None:
    try:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS airports (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                ident TEXT NOT NULL UNIQUE,
                name TEXT,
                airport_type TEXT,
                iso_country TEXT,
                iso_region TEXT,
                municipality TEXT,
                latitude_deg REAL,
                longitude_deg REAL,
                elevation_ft REAL,
                gps_code TEXT,
                iata_code TEXT,
                local_code TEXT,
                source TEXT,
                active INTEGER DEFAULT 1,
                closed INTEGER DEFAULT 0,
                data_quality TEXT,
                imported_at TEXT,
                updated_at TEXT,
                raw_json TEXT
            )
            """
        )
        for column, ddl in [
            ("name", "name TEXT"),
            ("airport_type", "airport_type TEXT"),
            ("iso_country", "iso_country TEXT"),
            ("iso_region", "iso_region TEXT"),
            ("municipality", "municipality TEXT"),
            ("latitude_deg", "latitude_deg REAL"),
            ("longitude_deg", "longitude_deg REAL"),
            ("elevation_ft", "elevation_ft REAL"),
            ("gps_code", "gps_code TEXT"),
            ("iata_code", "iata_code TEXT"),
            ("local_code", "local_code TEXT"),
            ("source", "source TEXT"),
            ("active", "active INTEGER DEFAULT 1"),
            ("closed", "closed INTEGER DEFAULT 0"),
            ("data_quality", "data_quality TEXT"),
            ("imported_at", "imported_at TEXT"),
            ("updated_at", "updated_at TEXT"),
            ("raw_json", "raw_json TEXT"),
        ]:
            _add_column_if_missing(conn, "airports", column, ddl)
        conn.execute("CREATE INDEX IF NOT EXISTS idx_airports_ident ON airports(ident)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_airports_country ON airports(iso_country)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_airports_active ON airports(active, closed)")
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

    def executescript(self, sql_script: str, /):  # type: ignore[override]
        result = super().executescript(sql_script)
        if isinstance(sql_script, str) and "CREATE TABLE IF NOT EXISTS airports" in sql_script:
            _ensure_airports_schema(self)
        if isinstance(sql_script, str) and "CREATE TABLE IF NOT EXISTS audit_log" in sql_script:
            _ensure_audit_schema(self)
        return result


def connect(*args, **kwargs):
    kwargs.setdefault("factory", PatchedConnection)
    conn = _ORIGINAL_CONNECT(*args, **kwargs)
    try:
        _ensure_audit_schema(conn)
        _ensure_airports_schema(conn)
    except Exception:
        pass
    return conn


sqlite3.connect = connect


def _patch_streamlit_folium() -> None:
    """Prevent read-only map pan/zoom from causing full Streamlit reruns."""
    global _PATCHED_FOLIUM
    if _PATCHED_FOLIUM:
        return
    try:
        import streamlit_folium
    except Exception:
        return
    original = getattr(streamlit_folium, "st_folium", None)
    if original is None or getattr(original, "_logbook_no_rerun_patch", False):
        return

    def st_folium_no_rerun(*args: Any, **kwargs: Any):
        kwargs.setdefault("returned_objects", [])
        return original(*args, **kwargs)

    st_folium_no_rerun._logbook_no_rerun_patch = True  # type: ignore[attr-defined]
    streamlit_folium.st_folium = st_folium_no_rerun
    _PATCHED_FOLIUM = True


_patch_streamlit_folium()
