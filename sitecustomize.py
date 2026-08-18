"""Runtime compatibility patches for Streamlit Cloud SQLite deployments.

This file is imported automatically by Python when present on sys.path. It keeps
older logbook.sqlite schemas compatible with the current app code, seeds the full
airport database from data/airports.csv when needed, and replaces the Streamlit
sidebar collapse control with one CSS-only smooth toggle.
"""
from __future__ import annotations

import base64
import csv
import json
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

_ORIGINAL_CONNECT = sqlite3.connect
_AIRPORTS_SEED_CHECKED = False
_AIRPORTS_BACKUP_CHECKED = False

SIDEBAR_WIDTH = "16.4rem"
APP_DISPLAY_VERSION = "v0.29"

_CSS_AND_TOGGLE = f"""
<style id="logbook-sidebar-toggle-fix">
:root {{ --lb-sidebar-width: {SIDEBAR_WIDTH}; }}

/* Hide every Streamlit-native sidebar arrow. The app uses exactly one custom
   CSS-only toggle below. */
[data-testid="stSidebarCollapseButton"],
[data-testid="stSidebarCollapsedControl"],
[data-testid="collapsedControl"],
button[title*="sidebar" i],
button[aria-label*="sidebar" i],
section[data-testid="stSidebar"] button[kind="headerNoPadding"],
section[data-testid="stSidebar"] button[data-testid="baseButton-headerNoPadding"],
section[data-testid="stSidebar"] button[data-testid="baseButton-header"],
header[data-testid="stHeader"] button[kind="headerNoPadding"],
header[data-testid="stHeader"] button[data-testid="baseButton-headerNoPadding"] {{
    display: none !important;
    visibility: hidden !important;
    pointer-events: none !important;
    width: 0 !important;
    min-width: 0 !important;
    height: 0 !important;
    min-height: 0 !important;
    padding: 0 !important;
    margin: 0 !important;
    overflow: hidden !important;
}}

/* Hide the old Python/rerun menu arrows rendered by app.py. */
button[aria-label="Skrýt menu"],
button[title="Skrýt menu"],
button[aria-label="Zobrazit menu"],
button[title="Zobrazit menu"] {{
    display: none !important;
}}

section[data-testid="stSidebar"],
[data-testid="stSidebar"] {{
    transition: margin-left .24s cubic-bezier(.22,.61,.36,1),
                opacity .18s ease !important;
    will-change: margin-left;
}}

[data-testid="stAppViewContainer"] > .main,
[data-testid="stAppViewContainer"] .main,
[data-testid="stAppViewContainer"] .block-container {{
    transition: margin-left .24s cubic-bezier(.22,.61,.36,1),
                padding-left .24s cubic-bezier(.22,.61,.36,1) !important;
}}

#logbook-nav-toggle {{
    position: fixed;
    left: -9999px;
    width: 1px;
    height: 1px;
    opacity: 0;
}}

label.logbook-nav-toggle {{
    position: fixed;
    top: 5.35rem;
    left: calc(var(--lb-sidebar-width) - 2.65rem);
    z-index: 1000001;
    width: 1.86rem;
    height: 1.86rem;
    border-radius: .58rem;
    border: 1px solid rgba(148, 163, 184, .28);
    background: rgba(15, 31, 52, .94);
    box-shadow: 0 8px 22px rgba(0, 0, 0, .25);
    display: flex;
    align-items: center;
    justify-content: center;
    color: #dbeafe;
    font-weight: 900;
    font-size: 1.1rem;
    line-height: 1;
    cursor: pointer;
    user-select: none;
    transition: left .24s cubic-bezier(.22,.61,.36,1),
                background .14s ease,
                border-color .14s ease,
                transform .14s ease;
}}

label.logbook-nav-toggle:hover {{
    background: rgba(20, 43, 72, .98);
    border-color: rgba(56, 189, 248, .45);
}}

label.logbook-nav-toggle::before {{ content: "‹"; }}

body:has(#logbook-nav-toggle:checked) label.logbook-nav-toggle {{
    left: .7rem;
}}
body:has(#logbook-nav-toggle:checked) label.logbook-nav-toggle::before {{ content: "›"; }}

body:has(#logbook-nav-toggle:checked) section[data-testid="stSidebar"],
body:has(#logbook-nav-toggle:checked) [data-testid="stSidebar"] {{
    margin-left: calc(-1 * var(--lb-sidebar-width)) !important;
    opacity: .98 !important;
}}

@media (max-width: 760px) {{
    label.logbook-nav-toggle {{
        top: 4.6rem;
        left: calc(var(--lb-sidebar-width) - 2.45rem);
        width: 1.72rem;
        height: 1.72rem;
    }}
    body:has(#logbook-nav-toggle:checked) label.logbook-nav-toggle {{
        left: .45rem;
    }}
}}
</style>
<input id="logbook-nav-toggle" type="checkbox" aria-label="Skrýt nebo zobrazit menu" />
<label class="logbook-nav-toggle" for="logbook-nav-toggle" title="Skrýt / zobrazit menu"></label>
"""


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _columns(conn: sqlite3.Connection, table: str) -> set[str]:
    try:
        return {row[1] for row in conn.execute(f"PRAGMA table_info({table})").fetchall()}
    except Exception:
        return set()


def _add_column_if_missing(conn: sqlite3.Connection, table: str, column: str, ddl: str) -> None:
    if column not in _columns(conn, table):
        conn.execute(f"ALTER TABLE {table} ADD COLUMN {ddl}")


def _ensure_app_meta_schema(conn: sqlite3.Connection) -> None:
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS app_meta (
            key TEXT PRIMARY KEY,
            value TEXT,
            updated_at TEXT
        )
        """
    )


def _set_meta(conn: sqlite3.Connection, key: str, value: str) -> None:
    try:
        _ensure_app_meta_schema(conn)
        conn.execute(
            "INSERT OR REPLACE INTO app_meta (key, value, updated_at) VALUES (?, ?, ?)",
            (key, value, _now_iso()),
        )
    except Exception:
        pass


def _get_meta(conn: sqlite3.Connection, key: str) -> str | None:
    try:
        _ensure_app_meta_schema(conn)
        row = conn.execute("SELECT value FROM app_meta WHERE key = ?", (key,)).fetchone()
        return row[0] if row else None
    except Exception:
        return None


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
            ("name", "name TEXT"), ("airport_type", "airport_type TEXT"),
            ("iso_country", "iso_country TEXT"), ("iso_region", "iso_region TEXT"),
            ("municipality", "municipality TEXT"), ("latitude_deg", "latitude_deg REAL"),
            ("longitude_deg", "longitude_deg REAL"), ("elevation_ft", "elevation_ft REAL"),
            ("gps_code", "gps_code TEXT"), ("iata_code", "iata_code TEXT"),
            ("local_code", "local_code TEXT"), ("source", "source TEXT"),
            ("active", "active INTEGER DEFAULT 1"), ("closed", "closed INTEGER DEFAULT 0"),
            ("data_quality", "data_quality TEXT"), ("imported_at", "imported_at TEXT"),
            ("updated_at", "updated_at TEXT"), ("raw_json", "raw_json TEXT"),
        ]:
            _add_column_if_missing(conn, "airports", column, ddl)
        conn.execute("CREATE INDEX IF NOT EXISTS idx_airports_ident ON airports(ident)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_airports_country ON airports(iso_country)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_airports_active ON airports(active, closed)")
    except Exception:
        pass


def _float_or_none(value: Any) -> float | None:
    try:
        text = str(value or "").strip()
        return float(text) if text else None
    except Exception:
        return None


def _clear_streamlit_cache() -> None:
    try:
        import streamlit as st
        st.cache_data.clear()
    except Exception:
        pass


def _seed_airports_from_csv(conn: sqlite3.Connection) -> None:
    """Import bundled data/airports.csv into SQLite if only manual rows exist."""
    global _AIRPORTS_SEED_CHECKED
    if _AIRPORTS_SEED_CHECKED:
        return

    _ensure_app_meta_schema(conn)
    _ensure_airports_schema(conn)

    try:
        count = int(conn.execute("SELECT COUNT(*) FROM airports").fetchone()[0])
    except Exception:
        return

    if count >= 1000:
        _AIRPORTS_SEED_CHECKED = True
        return

    csv_path = Path(__file__).resolve().parent / "data" / "airports.csv"
    if not csv_path.exists():
        _set_meta(conn, "airports_auto_seed_error", "data/airports.csv not found")
        conn.commit()
        return

    now = _now_iso()
    rows: list[tuple[Any, ...]] = []
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
                airport_type = (row.get("type") or row.get("airport_type") or "").strip()
                closed = 1 if airport_type == "closed" else 0
                active = 0 if closed else 1
                # Keep raw_json small; the CSV remains in the repository for full source data.
                rows.append((
                    ident, row.get("name"), airport_type, row.get("iso_country"),
                    row.get("iso_region"), row.get("municipality"), lat, lon,
                    _float_or_none(row.get("elevation_ft")), row.get("gps_code"),
                    row.get("iata_code"), row.get("local_code") or ident,
                    "ourairports_csv", active, closed, "ourairports_public_domain",
                    now, now, None,
                ))

        conn.executemany(
            """
            INSERT OR IGNORE INTO airports
            (ident, name, airport_type, iso_country, iso_region, municipality,
             latitude_deg, longitude_deg, elevation_ft, gps_code, iata_code,
             local_code, source, active, closed, data_quality, imported_at,
             updated_at, raw_json)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            rows,
        )
        final_count = int(conn.execute("SELECT COUNT(*) FROM airports").fetchone()[0])
        _set_meta(conn, "airports_auto_seeded", "1")
        _set_meta(conn, "airports_auto_seeded_rows", str(len(rows)))
        _set_meta(conn, "airports_count_after_seed", str(final_count))
        _set_meta(conn, "airports_seed_needs_github_backup", "1")
        _set_meta(conn, "dirty", "1")
        conn.commit()
        _AIRPORTS_SEED_CHECKED = True
        _clear_streamlit_cache()
    except Exception as exc:
        try:
            conn.rollback()
            _set_meta(conn, "airports_auto_seed_error", str(exc)[:500])
            conn.commit()
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
            try:
                _seed_airports_from_csv(self)
            except Exception:
                pass
        return result


def connect(*args, **kwargs):
    kwargs.setdefault("factory", PatchedConnection)
    conn = _ORIGINAL_CONNECT(*args, **kwargs)
    try:
        _ensure_audit_schema(conn)
        _seed_airports_from_csv(conn)
    except Exception:
        pass
    return conn


sqlite3.connect = connect


# -----------------------------------------------------------------------------
# GitHub backup for auto-seeded airport DB
# -----------------------------------------------------------------------------

def _secret(section: str, key: str, default: str = "") -> str:
    try:
        import streamlit as st
        sec = st.secrets.get(section, {})
        if hasattr(sec, "get"):
            return str(sec.get(key, default) or default)
    except Exception:
        pass
    return default


def _backup_pending_airport_seed() -> None:
    global _AIRPORTS_BACKUP_CHECKED
    if _AIRPORTS_BACKUP_CHECKED:
        return
    _AIRPORTS_BACKUP_CHECKED = True

    base_dir = Path(__file__).resolve().parent
    db_path = base_dir / "data" / "logbook.sqlite"
    if not db_path.exists():
        return

    try:
        with _ORIGINAL_CONNECT(db_path) as conn:
            pending = _get_meta(conn, "airports_seed_needs_github_backup")
            count = int(conn.execute("SELECT COUNT(*) FROM airports").fetchone()[0])
            if pending != "1" or count < 1000:
                return
    except Exception:
        return

    token = _secret("github", "token") or _secret("github_sync", "token")
    repo = _secret("github", "repo") or _secret("github_sync", "repo", "filipto861/Logbook")
    remote_db_path = _secret("github", "db_path") or _secret("github_sync", "db_path", "data/logbook.sqlite")
    branch = _secret("github", "branch") or _secret("github_sync", "branch", "main")
    auto_backup = (_secret("github", "auto_backup") or _secret("github_sync", "auto_backup", "true")).strip().lower()
    if not token or auto_backup in {"0", "false", "no", "off"}:
        return

    try:
        import requests
        api_url = f"https://api.github.com/repos/{repo}/contents/{remote_db_path}"
        headers = {"Authorization": f"Bearer {token}", "Accept": "application/vnd.github+json"}
        sha = None
        get_resp = requests.get(api_url, headers=headers, params={"ref": branch}, timeout=30)
        if get_resp.status_code == 200:
            sha = get_resp.json().get("sha")
        elif get_resp.status_code != 404:
            raise RuntimeError(f"GitHub GET {get_resp.status_code}: {get_resp.text[:300]}")
        payload = {
            "message": f"Persist full airport database {datetime.now().strftime('%Y-%m-%d %H:%M')}",
            "content": base64.b64encode(db_path.read_bytes()).decode("ascii"),
            "branch": branch,
        }
        if sha:
            payload["sha"] = sha
        put_resp = requests.put(api_url, headers=headers, json=payload, timeout=180)
        if put_resp.status_code not in (200, 201):
            raise RuntimeError(f"GitHub PUT {put_resp.status_code}: {put_resp.text[:500]}")
        with _ORIGINAL_CONNECT(db_path) as conn:
            _set_meta(conn, "airports_seed_needs_github_backup", "0")
            _set_meta(conn, "last_github_backup_at", _now_iso())
            _set_meta(conn, "last_github_backup_error", "")
            _set_meta(conn, "dirty", "0")
            conn.commit()
    except Exception as exc:
        try:
            with _ORIGINAL_CONNECT(db_path) as conn:
                _set_meta(conn, "last_github_backup_error", f"airport seed backup: {str(exc)[:450]}")
                conn.commit()
        except Exception:
            pass


# -----------------------------------------------------------------------------
# Streamlit UI patch
# -----------------------------------------------------------------------------

def _patch_streamlit_ui() -> None:
    try:
        import streamlit as st
    except Exception:
        return

    try:
        # The app.py session-state sidebar toggle used reruns. We keep it off and
        # use the CSS-only toggle above for smooth client-side animation.
        st.session_state["sidebar_hidden"] = False
    except Exception:
        pass

    if getattr(st, "_logbook_ui_patch_applied", False):
        return

    original_button = st.button
    original_markdown = st.markdown

    def patched_button(label, *args, **kwargs):
        key = kwargs.get("key")
        # Suppress the old app.py Python/rerun sidebar buttons completely.
        if key in {"hide_manual_sidebar", "show_manual_sidebar"}:
            return False
        if label in {"Skrýt menu", "Menu"}:
            return False
        return original_button(label, *args, **kwargs)

    def patched_markdown(body, *args, **kwargs):
        if not getattr(st, "_logbook_sidebar_css_injected", False):
            st._logbook_sidebar_css_injected = True
            original_markdown(_CSS_AND_TOGGLE, unsafe_allow_html=True)
        if isinstance(body, str):
            body = body.replace("v0.28", APP_DISPLAY_VERSION)
        return original_markdown(body, *args, **kwargs)

    st.button = patched_button
    st.markdown = patched_markdown
    st._logbook_ui_patch_applied = True
    try:
        _backup_pending_airport_seed()
    except Exception:
        pass


_patch_streamlit_ui()
