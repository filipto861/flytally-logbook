"""Runtime compatibility patches for Streamlit Cloud SQLite deployments.

This file is imported automatically by Python when present on sys.path. It keeps
older logbook.sqlite schemas compatible with the current app code and contains a
small UI/runtime patch for the Streamlit deployment.
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
_CSS = """
<style id="logbook-sidebar-toggle-fix">
/* Hide Streamlit's own sidebar collapse/open control. We use our own small
   arrow button because the native Streamlit control conflicts with the hidden
   Cloud toolbar and causes duplicate arrows. */
[data-testid="stSidebarCollapseButton"],
[data-testid="stSidebarCollapsedControl"],
[data-testid="collapsedControl"],
button[title*="sidebar" i],
button[aria-label*="sidebar" i],
section[data-testid="stSidebar"] button[kind="headerNoPadding"],
section[data-testid="stSidebar"] button[data-testid="baseButton-headerNoPadding"],
section[data-testid="stSidebar"] button[data-testid="baseButton-header"],
header[data-testid="stHeader"] button[kind="headerNoPadding"],
header[data-testid="stHeader"] button[data-testid="baseButton-headerNoPadding"] {
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
}
/* Keep normal application buttons, including our custom menu arrow, visible. */
section[data-testid="stSidebar"] div.stButton > button,
div.stButton > button {
    visibility: visible !important;
    pointer-events: auto !important;
}
</style>
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
    """Create/upgrade the airports table before the app tries to use it."""
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


def _float_or_none(value: Any) -> float | None:
    try:
        text = str(value or "").strip()
        if not text:
            return None
        return float(text)
    except Exception:
        return None


def _seed_airports_from_csv(conn: sqlite3.Connection) -> None:
    """Restore the full OurAirports table when the DB only has manual overrides.

    This makes data/logbook.sqlite self-healing on Streamlit Cloud. If GitHub
    contains an older DB with only a handful of airport rows, the app imports the
    bundled data/airports.csv at startup and marks the DB for automatic GitHub
    backup, so the fixed DB becomes persistent.
    """
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
        return

    imported = 0
    try:
        with csv_path.open("r", encoding="utf-8-sig", newline="") as fh:
            reader = csv.DictReader(fh)
            rows = []
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
                rows.append(
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
                        row.get("gps_code") or row.get("icao_code"),
                        row.get("iata_code"),
                        row.get("local_code") or ident,
                        "ourairports_csv",
                        active,
                        closed,
                        "ourairports_public_domain",
                        _now_iso(),
                        _now_iso(),
                        json.dumps(row, ensure_ascii=False),
                    )
                )
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
        imported = len(rows)
        final_count = int(conn.execute("SELECT COUNT(*) FROM airports").fetchone()[0])
        _set_meta(conn, "airports_auto_seeded", "1")
        _set_meta(conn, "airports_auto_seeded_rows", str(imported))
        _set_meta(conn, "airports_count_after_seed", str(final_count))
        _set_meta(conn, "airports_seed_needs_github_backup", "1")
        _set_meta(conn, "dirty", "1")
        conn.commit()
        _AIRPORTS_SEED_CHECKED = True
    except Exception as exc:
        try:
            conn.rollback()
        except Exception:
            pass
        try:
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
# GitHub backup for auto-seeded airports
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
        put_resp = requests.put(api_url, headers=headers, json=payload, timeout=120)
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

    def inject_css() -> None:
        try:
            original_markdown(_CSS, unsafe_allow_html=True)
        except Exception:
            pass

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
        result = original_markdown(body, *args, **kwargs)
        # Inject after Streamlit/app styles as well, so our CSS wins in cascade.
        try:
            if isinstance(body, str) and ("<style" in body or not getattr(st, "_logbook_sidebar_css_once", False)):
                st._logbook_sidebar_css_once = True
                inject_css()
                _backup_pending_airport_seed()
        except Exception:
            pass
        return result

    st.button = compact_button
    st.markdown = patched_markdown
    st._logbook_ui_patch_applied = True


_patch_streamlit_ui()
