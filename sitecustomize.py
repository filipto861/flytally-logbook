"""Runtime compatibility patches for Streamlit Cloud SQLite deployments.

This file is imported automatically by Python when present on sys.path. It keeps
older logbook.sqlite schemas compatible with the current app code and contains a
small UI/runtime patch for the Streamlit deployment.
"""
from __future__ import annotations

import csv
import json
import sqlite3
from pathlib import Path
from typing import Any

_ORIGINAL_CONNECT = sqlite3.connect
_AIRPORTS_SEED_CHECKED = False


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


def _float_or_none(value: Any) -> float | None:
    try:
        text = str(value or "").strip()
        if not text:
            return None
        return float(text)
    except Exception:
        return None


def _airport_table_ready(conn: sqlite3.Connection) -> bool:
    cols = _columns(conn, "airports")
    needed = {"ident", "latitude_deg", "longitude_deg", "airport_type"}
    return needed.issubset(cols)


def _set_meta_if_ready(conn: sqlite3.Connection, key: str, value: str) -> None:
    if "key" not in _columns(conn, "app_meta"):
        return
    try:
        conn.execute(
            "INSERT OR REPLACE INTO app_meta (key, value, updated_at) VALUES (?, ?, datetime('now'))",
            (key, value),
        )
    except Exception:
        pass


def _seed_airports_from_csv(conn: sqlite3.Connection) -> None:
    """Automatically restore the full OurAirports table when only manual overrides exist.

    The database can revert to the small manual-airport set if an older SQLite
    file is deployed from GitHub. When data/airports.csv is available, this
    repopulates airports without overwriting manual overrides.
    """
    global _AIRPORTS_SEED_CHECKED
    if _AIRPORTS_SEED_CHECKED:
        return
    if not _airport_table_ready(conn):
        return

    try:
        count = conn.execute("SELECT COUNT(*) FROM airports").fetchone()[0]
    except Exception:
        return

    if count >= 1000:
        _AIRPORTS_SEED_CHECKED = True
        return

    csv_path = Path(__file__).resolve().parent / "data" / "airports.csv"
    if not csv_path.exists():
        return

    imported = 0
    try:
        with csv_path.open("r", encoding="utf-8-sig", newline="") as fh:
            reader = csv.DictReader(fh)
            for row in reader:
                ident = (row.get("ident") or "").strip().upper()
                if not ident:
                    continue
                lat = _float_or_none(row.get("latitude_deg"))
                lon = _float_or_none(row.get("longitude_deg"))
                if lat is None or lon is None:
                    continue
                airport_type = (row.get("type") or "").strip()
                closed = 1 if airport_type == "closed" else 0
                active = 0 if closed else 1
                conn.execute(
                    """
                    INSERT OR IGNORE INTO airports
                    (ident, name, airport_type, iso_country, iso_region, municipality,
                     latitude_deg, longitude_deg, elevation_ft, gps_code, iata_code,
                     local_code, source, active, closed, data_quality, imported_at,
                     updated_at, raw_json)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'), ?)
                    """,
                    (
                        ident,
                        row.get("name"),
                        airport_type,
                        row.get("iso_country"),
                        row.get("iso_region"),
                        row.get("municipality"),
                        lat,
                        lon,
                        _float_or_none(row.get("elevation_ft")),
                        row.get("gps_code"),
                        row.get("iata_code"),
                        row.get("local_code"),
                        "ourairports_csv",
                        active,
                        closed,
                        "ourairports_public_domain",
                        json.dumps(row, ensure_ascii=False),
                    ),
                )
                imported += 1
        _set_meta_if_ready(conn, "airports_auto_seeded", "1")
        _set_meta_if_ready(conn, "airports_auto_seeded_rows", str(imported))
        conn.commit()
        _AIRPORTS_SEED_CHECKED = True
    except Exception:
        try:
            conn.rollback()
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
    try:
        _seed_airports_from_csv(conn)
    except Exception:
        pass
    return conn


sqlite3.connect = connect


# -----------------------------------------------------------------------------
# Small UI compatibility patch
# -----------------------------------------------------------------------------

def _patch_streamlit_ui() -> None:
    """Use compact menu arrows and hide the duplicate native sidebar toggle."""
    try:
        import streamlit as st
    except Exception:
        return

    if getattr(st, "_logbook_ui_patch_applied", False):
        return

    original_button = st.button
    original_markdown = st.markdown

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

    def patched_markdown(body, *args, **kwargs):
        if not getattr(st, "_logbook_sidebar_css_injected", False):
            st._logbook_sidebar_css_injected = True
            original_markdown(
                """
                <style>
                [data-testid="stSidebarCollapseButton"],
                [data-testid="collapsedControl"],
                button[title="Hide sidebar"],
                button[title="Show sidebar"],
                button[aria-label="Hide sidebar"],
                button[aria-label="Show sidebar"],
                button[aria-label="Close sidebar"],
                button[aria-label="Open sidebar"] {
                    display: none !important;
                    visibility: hidden !important;
                    pointer-events: none !important;
                }
                </style>
                """,
                unsafe_allow_html=True,
            )
        return original_markdown(body, *args, **kwargs)

    st.button = compact_button
    st.markdown = patched_markdown
    st._logbook_ui_patch_applied = True


_patch_streamlit_ui()
