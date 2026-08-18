from __future__ import annotations

import base64
import json
import math
import os
import re
import shutil
import sqlite3
import tempfile
import xml.etree.ElementTree as ET
from datetime import date, datetime, time, timedelta, timezone
from io import BytesIO
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo

import folium
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
import streamlit as st
from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter
from streamlit_folium import st_folium

try:
    import requests
except Exception:
    requests = None

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
DB_PATH = DATA_DIR / "logbook.sqlite"
AIRPORTS_CSV_PATH = DATA_DIR / "airports.csv"
OURAIRPORTS_AIRPORTS_URL = "https://davidmegginson.github.io/ourairports-data/airports.csv"
APP_VERSION = "v0.26"
LOCAL_TZ = ZoneInfo("Europe/Prague")
DB_SCHEMA_VERSION = 3
_DB_READY = False

EVIDENCE_OPTIONS = ["ULL", "EASA"]
CLASS_OPTIONS = ["ULL", "SEP", "TMG", "MEP", "SET", "OTHER", "GLIDER"]
ROLE_OPTIONS = ["PIC", "DUAL", "INSTRUKTOR", "SAFETY PILOT", "CO-PILOT", "PAX", "OBSERVER"]

NAV_ITEMS = [
    ("Dashboard", "Souhrn"),
    ("Lety", "Lety"),
    ("Nový let", "Přidat let"),
    ("Mapa", "Mapa"),
    ("Ceník", "Ceník"),
    ("Databáze", "Databáze"),
    ("Export", "Export"),
]

SCHEMA = """
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS app_meta (
    key TEXT PRIMARY KEY,
    value TEXT,
    updated_at TEXT
);
CREATE TABLE IF NOT EXISTS flights (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    evidence TEXT,
    registration TEXT,
    aircraft_type TEXT,
    aircraft_class TEXT,
    departure TEXT,
    arrival TEXT,
    off_block TEXT,
    takeoff TEXT,
    landing TEXT,
    on_block TEXT,
    starts INTEGER DEFAULT 1,
    commander TEXT,
    instructor TEXT,
    role TEXT,
    task TEXT,
    price_per_hour REAL,
    note TEXT
);
CREATE TABLE IF NOT EXISTS rates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    registration TEXT NOT NULL,
    aircraft_type TEXT,
    valid_from TEXT,
    price_per_hour REAL,
    dry_price_per_hour REAL,
    source TEXT,
    UNIQUE(registration, valid_from)
);
CREATE TABLE IF NOT EXISTS aircraft (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    registration TEXT NOT NULL UNIQUE,
    aircraft_type TEXT,
    icao_type TEXT,
    aircraft_class TEXT,
    evidence TEXT,
    default_price_per_hour REAL,
    active INTEGER DEFAULT 1,
    note TEXT,
    created_at TEXT,
    updated_at TEXT
);
CREATE TABLE IF NOT EXISTS flight_tracks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    flight_id INTEGER NOT NULL,
    file_name TEXT,
    imported_at TEXT,
    point_count INTEGER,
    distance_km REAL,
    start_utc TEXT,
    end_utc TEXT,
    min_alt_m REAL,
    max_alt_m REAL,
    coordinates_json TEXT NOT NULL,
    FOREIGN KEY(flight_id) REFERENCES flights(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS track_points (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    track_id INTEGER NOT NULL,
    seq INTEGER NOT NULL,
    timestamp_utc TEXT,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    altitude_m REAL,
    speed_kmh REAL,
    FOREIGN KEY(track_id) REFERENCES flight_tracks(id) ON DELETE CASCADE,
    UNIQUE(track_id, seq)
);
CREATE TABLE IF NOT EXISTS airports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ident TEXT NOT NULL UNIQUE,
    icao_code TEXT,
    iata_code TEXT,
    local_code TEXT,
    name TEXT,
    type TEXT,
    latitude_deg REAL NOT NULL,
    longitude_deg REAL NOT NULL,
    elevation_ft REAL,
    continent TEXT,
    iso_country TEXT,
    iso_region TEXT,
    municipality TEXT,
    scheduled_service TEXT,
    gps_code TEXT,
    home_link TEXT,
    wikipedia_link TEXT,
    keywords TEXT,
    source TEXT DEFAULT 'manual',
    active INTEGER DEFAULT 1,
    priority INTEGER DEFAULT 0,
    note TEXT,
    updated_at TEXT
);
CREATE TABLE IF NOT EXISTS airport_overrides (
    ident TEXT PRIMARY KEY,
    name TEXT,
    type TEXT,
    latitude_deg REAL,
    longitude_deg REAL,
    elevation_ft REAL,
    iso_country TEXT,
    municipality TEXT,
    active INTEGER DEFAULT 1,
    priority INTEGER DEFAULT 200,
    note TEXT,
    updated_at TEXT
);
CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at TEXT NOT NULL,
    actor TEXT,
    action TEXT,
    object_type TEXT,
    object_id TEXT,
    detail_json TEXT
);
CREATE INDEX IF NOT EXISTS idx_flights_date ON flights(date);
CREATE INDEX IF NOT EXISTS idx_flights_registration ON flights(registration);
CREATE INDEX IF NOT EXISTS idx_aircraft_registration ON aircraft(registration);
CREATE INDEX IF NOT EXISTS idx_track_points_track_seq ON track_points(track_id, seq);
CREATE INDEX IF NOT EXISTS idx_airports_ident ON airports(ident);
CREATE INDEX IF NOT EXISTS idx_airports_country ON airports(iso_country);
CREATE INDEX IF NOT EXISTS idx_airports_active ON airports(active);
"""

# -----------------------------------------------------------------------------
# Database
# -----------------------------------------------------------------------------

def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _safe_json(value: Any) -> str:
    try:
        return json.dumps(value, ensure_ascii=False, default=str)
    except Exception:
        return str(value)


def connect() -> sqlite3.Connection:
    global _DB_READY
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    con = sqlite3.connect(DB_PATH)
    con.row_factory = sqlite3.Row
    con.execute("PRAGMA foreign_keys = ON")
    if not _DB_READY:
        con.executescript(SCHEMA)
        migrate_database(con)
        _DB_READY = True
    return con


def table_columns(con: sqlite3.Connection, table: str) -> set[str]:
    return {row[1] for row in con.execute(f"PRAGMA table_info({table})").fetchall()}


def add_column_if_missing(con: sqlite3.Connection, table: str, column: str, ddl: str) -> None:
    if column not in table_columns(con, table):
        con.execute(f"ALTER TABLE {table} ADD COLUMN {ddl}")


def table_exists(con: sqlite3.Connection, table: str) -> bool:
    row = con.execute("SELECT name FROM sqlite_master WHERE type='table' AND name=?", (table,)).fetchone()
    return row is not None


def migrate_database(con: sqlite3.Connection) -> None:
    add_column_if_missing(con, "flight_tracks", "min_alt_m", "min_alt_m REAL")
    add_column_if_missing(con, "flight_tracks", "max_alt_m", "max_alt_m REAL")
    add_column_if_missing(con, "flights", "note", "note TEXT")
    add_column_if_missing(con, "aircraft", "created_at", "created_at TEXT")
    add_column_if_missing(con, "aircraft", "updated_at", "updated_at TEXT")
    add_column_if_missing(con, "aircraft", "icao_type", "icao_type TEXT")
    add_column_if_missing(con, "aircraft", "active", "active INTEGER DEFAULT 1")

    # Compatibility with older v0.5/v0.6 audit schemas.
    for col, ddl in [
        ("actor", "actor TEXT"),
        ("action", "action TEXT"),
        ("object_type", "object_type TEXT"),
        ("object_id", "object_id TEXT"),
        ("detail_json", "detail_json TEXT"),
        ("user", "user TEXT"),
        ("entity", "entity TEXT"),
        ("entity_id", "entity_id TEXT"),
        ("detail", "detail TEXT"),
    ]:
        add_column_if_missing(con, "audit_log", col, ddl)

    con.execute("INSERT OR REPLACE INTO app_meta (key, value, updated_at) VALUES (?, ?, ?)", ("schema_version", str(DB_SCHEMA_VERSION), _now_iso()))
    con.commit()

    # Normalize old track blobs to point rows when missing.
    rows = con.execute("SELECT id, coordinates_json FROM flight_tracks WHERE id NOT IN (SELECT DISTINCT track_id FROM track_points)").fetchall()
    for r in rows:
        try:
            pts = json.loads(r["coordinates_json"] or "[]")
        except Exception:
            pts = []
        prof = profile_from_points(pts) if pts else pd.DataFrame()
        if not prof.empty:
            for _, p in prof.iterrows():
                con.execute(
                    "INSERT OR IGNORE INTO track_points (track_id, seq, timestamp_utc, latitude, longitude, altitude_m, speed_kmh) VALUES (?, ?, ?, ?, ?, ?, ?)",
                    (r["id"], int(p["idx"]), p["time_utc"].isoformat() if pd.notna(p["time_utc"]) else None, float(p["lat"]), float(p["lon"]), None if pd.isna(p["alt_m"]) else float(p["alt_m"]), None if pd.isna(p["speed_kmh"]) else float(p["speed_kmh"])),
                )
    con.commit()


def read_table_uncached(table: str) -> pd.DataFrame:
    with connect() as con:
        return pd.read_sql_query(f"SELECT * FROM {table}", con)


@st.cache_data(show_spinner=False)
def read_table_cached(table: str, db_mtime_ns: int) -> pd.DataFrame:
    return read_table_uncached(table)


def db_version_key() -> int:
    try:
        return DB_PATH.stat().st_mtime_ns
    except FileNotFoundError:
        return 0


def read_table(table: str) -> pd.DataFrame:
    return read_table_cached(table, db_version_key())


def clear_data_cache() -> None:
    try:
        st.cache_data.clear()
    except Exception:
        pass


def get_meta(key: str, default: str = "") -> str:
    try:
        with connect() as con:
            row = con.execute("SELECT value FROM app_meta WHERE key=?", (key,)).fetchone()
            return row["value"] if row else default
    except Exception:
        return default


def set_meta(con: sqlite3.Connection, key: str, value: str) -> None:
    con.execute("INSERT OR REPLACE INTO app_meta (key, value, updated_at) VALUES (?, ?, ?)", (key, value, _now_iso()))


def _get_secret(*path: str, default: Any = None) -> Any:
    cur: Any = st.secrets
    try:
        for p in path:
            cur = cur[p]
        return cur
    except Exception:
        return default


def github_config() -> dict[str, Any]:
    return {
        "token": _get_secret("github", "token", default=""),
        "repo": _get_secret("github", "repo", default="filipto861/Logbook"),
        "db_path": _get_secret("github", "db_path", default="data/logbook.sqlite"),
        "branch": _get_secret("github", "branch", default="main"),
        "auto_backup": bool(_get_secret("github", "auto_backup", default=False)),
    }


def backup_database_to_github(auto: bool = False) -> tuple[bool, str]:
    cfg = github_config()
    if auto and not cfg["auto_backup"]:
        return False, "Automatická GitHub záloha je vypnutá."
    if not cfg["token"]:
        return False, "GitHub token není nastavený ve Streamlit Secrets."
    if requests is None:
        return False, "Knihovna requests není dostupná."
    if not DB_PATH.exists():
        return False, "Databáze neexistuje."
    repo = cfg["repo"]
    path = cfg["db_path"]
    branch = cfg["branch"]
    url = f"https://api.github.com/repos/{repo}/contents/{path}"
    headers = {"Authorization": f"Bearer {cfg['token']}", "Accept": "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28"}
    try:
        get_resp = requests.get(url, headers=headers, params={"ref": branch}, timeout=25)
        sha = None
        if get_resp.status_code == 200:
            sha = get_resp.json().get("sha")
        elif get_resp.status_code != 404:
            return False, f"GitHub načtení selhalo: {get_resp.status_code} {get_resp.text[:200]}"
        content_b64 = base64.b64encode(DB_PATH.read_bytes()).decode("ascii")
        now_local = datetime.now(LOCAL_TZ).strftime("%Y-%m-%d %H:%M:%S")
        payload = {"message": f"Backup logbook database {now_local}", "content": content_b64, "branch": branch}
        if sha:
            payload["sha"] = sha
        put_resp = requests.put(url, headers=headers, json=payload, timeout=60)
        if put_resp.status_code not in (200, 201):
            return False, f"GitHub uložení selhalo: {put_resp.status_code} {put_resp.text[:250]}"
        with connect() as con:
            set_meta(con, "dirty", "0")
            set_meta(con, "last_github_backup", now_local)
            con.commit()
        return True, f"Databáze byla uložena na GitHub ({now_local})."
    except Exception as exc:
        return False, f"GitHub záloha selhala: {exc}"


def auto_backup_after_change(reason: str) -> None:
    clear_data_cache()
    with connect() as con:
        set_meta(con, "dirty", "1")
        set_meta(con, "dirty_reason", reason)
        con.commit()
    if is_admin():
        ok, msg = backup_database_to_github(auto=True)
        st.session_state["last_backup_status"] = (ok, msg)


def is_admin() -> bool:
    return st.session_state.get("auth_role") == "admin"


def actor_name() -> str:
    return "admin" if is_admin() else "viewer"


def invalidate_cached_data() -> None:
    """Clear cached database reads after any write operation."""
    try:
        st.cache_data.clear()
    except Exception:
        pass


def render_auth_sidebar() -> None:
    admin_password = _get_secret("auth", "admin_password", default="")
    st.divider()
    with st.expander("Správa aplikace", expanded=is_admin()):
        if admin_password:
            if is_admin():
                st.caption("Přihlášeno jako správce.")
                if st.button("Odhlásit", use_container_width=True):
                    st.session_state.pop("auth_role", None)
                    st.rerun()
            else:
                with st.form("admin_login_form"):
                    pwd = st.text_input("Heslo správce", type="password")
                    submitted = st.form_submit_button("Přihlásit", use_container_width=True)
                if submitted:
                    if pwd == admin_password:
                        st.session_state["auth_role"] = "admin"
                        st.rerun()
                    else:
                        st.error("Nesprávné heslo")
        else:
            st.caption("Správcovské heslo zatím není nastavené. Aplikace běží jen pro čtení.")
        cfg = github_config()
        st.caption(f"Auto GitHub backup: {'zapnuto' if cfg['auto_backup'] else 'vypnuto'}")
        status = st.session_state.get("last_backup_status")
        if status:
            ok, msg = status
            (st.success if ok else st.warning)(msg)


def require_admin() -> bool:
    if is_admin():
        return True
    st.warning("Tato akce je dostupná jen po přihlášení jako admin.")
    return False


def record_audit(con: sqlite3.Connection, action: str, object_type: str | None = None, object_id: Any = None, detail: Any = None) -> None:
    payload = _safe_json(detail) if detail is not None else None
    try:
        cols = table_columns(con, "audit_log")
        if {"actor", "object_type", "object_id", "detail_json"}.issubset(cols):
            con.execute(
                "INSERT INTO audit_log (created_at, actor, action, object_type, object_id, detail_json) VALUES (?, ?, ?, ?, ?, ?)",
                (_now_iso(), actor_name(), action, object_type, str(object_id) if object_id is not None else None, payload),
            )
        else:
            con.execute(
                "INSERT INTO audit_log (created_at, user, action, entity, entity_id, detail) VALUES (?, ?, ?, ?, ?, ?)",
                (_now_iso(), actor_name(), action, object_type, str(object_id) if object_id is not None else None, payload),
            )
    except Exception:
        pass

# -----------------------------------------------------------------------------
# Formatting
# -----------------------------------------------------------------------------

def normalize_text(value: Any) -> str | None:
    if value is None or pd.isna(value):
        return None
    text = str(value).strip()
    return text if text else None


def normalize_date(value: Any) -> str | None:
    if value is None or pd.isna(value):
        return None
    if isinstance(value, pd.Timestamp):
        return value.date().isoformat()
    if isinstance(value, datetime):
        return value.date().isoformat()
    if isinstance(value, date):
        return value.isoformat()
    text = str(value).strip()
    for fmt in ("%Y-%m-%d", "%d.%m.%Y", "%d.%m.%y"):
        try:
            return datetime.strptime(text, fmt).date().isoformat()
        except ValueError:
            pass
    return text or None


def normalize_time(value: Any) -> str | None:
    if value is None or pd.isna(value):
        return None
    if isinstance(value, time):
        return value.strftime("%H:%M")
    if isinstance(value, datetime):
        return value.strftime("%H:%M")
    text = str(value).strip()
    if not text:
        return None
    for fmt in ("%H:%M", "%H:%M:%S"):
        try:
            return datetime.strptime(text, fmt).strftime("%H:%M")
        except ValueError:
            pass
    return text


def parse_time_to_minutes(value: Any) -> int | None:
    if value is None:
        return None
    if isinstance(value, time):
        return value.hour * 60 + value.minute
    text = str(value).strip()
    if not text or text.lower() in {"nan", "none", "nat"}:
        return None
    for fmt in ("%H:%M", "%H:%M:%S"):
        try:
            t = datetime.strptime(text, fmt).time()
            return t.hour * 60 + t.minute
        except ValueError:
            pass
    return None


def minutes_diff(start_value: Any, end_value: Any) -> int | None:
    start = parse_time_to_minutes(start_value)
    end = parse_time_to_minutes(end_value)
    if start is None or end is None:
        return None
    return (end - start) % (24 * 60)


def fmt_minutes(minutes: int | float | None) -> str:
    if minutes is None or pd.isna(minutes):
        return ""
    minutes = int(round(float(minutes)))
    return f"{minutes // 60}:{minutes % 60:02d}"


def fmt_money(value: Any) -> str:
    try:
        if value is None or pd.isna(value):
            return ""
        return f"{float(value):,.0f} Kč".replace(",", " ")
    except Exception:
        return ""


def safe_upper(value: Any) -> str:
    text = normalize_text(value)
    return text.upper() if text else ""


def _safe_str(value: Any) -> str:
    if value is None:
        return ""
    try:
        if pd.isna(value):
            return ""
    except Exception:
        pass
    return str(value)


def _safe_int(value: Any, default: int = 0) -> int:
    try:
        if value is None or pd.isna(value):
            return default
        return int(value)
    except Exception:
        return default


def _safe_float(value: Any, default: float = 0.0) -> float:
    try:
        if value is None or pd.isna(value):
            return default
        return float(value)
    except Exception:
        return default


def compute_metrics(df: pd.DataFrame) -> pd.DataFrame:
    if df.empty:
        return df.copy()
    out = df.copy()
    out["date_dt"] = pd.to_datetime(out["date"], errors="coerce")
    out["year"] = out["date_dt"].dt.year
    out["block_minutes"] = [minutes_diff(a, b) for a, b in zip(out["off_block"], out["on_block"])]
    out["air_minutes"] = [minutes_diff(a, b) for a, b in zip(out["takeoff"], out["landing"])]
    out["block_hours"] = out["block_minutes"].fillna(0) / 60.0
    out["air_hours"] = out["air_minutes"].fillna(0) / 60.0
    out["price_per_hour"] = pd.to_numeric(out["price_per_hour"], errors="coerce")
    out["cost"] = out["block_hours"] * out["price_per_hour"].fillna(0)
    out["role"] = out["role"].fillna("").str.upper().str.strip()
    out["evidence"] = out["evidence"].fillna("").str.upper().str.strip()
    out["registration"] = out["registration"].fillna("").str.upper().str.strip()
    out["aircraft_class"] = out["aircraft_class"].fillna("").str.upper().str.strip()
    out["starts"] = pd.to_numeric(out["starts"], errors="coerce").fillna(0).astype(int)
    out["block_time"] = out["block_minutes"].apply(fmt_minutes)
    out["air_time"] = out["air_minutes"].apply(fmt_minutes)
    out["cost_label"] = out["cost"].apply(fmt_money)
    return out

# -----------------------------------------------------------------------------
# UI
# -----------------------------------------------------------------------------

def apply_ui_theme(dark_mode: bool) -> None:
    if dark_mode:
        bg = "#06101d"; panel = "#0b182a"; panel2 = "#10233a"; text = "#e6f0fb"; muted = "#92a8c0"; border = "rgba(125,211,252,.18)"; accent = "#38bdf8"; good = "#22c55e"; warn = "#f59e0b"; shadow = "rgba(0,0,0,.40)"
    else:
        bg = "#f5f8fc"; panel = "#ffffff"; panel2 = "#eaf3ff"; text = "#0f172a"; muted = "#475569"; border = "rgba(15,23,42,.12)"; accent = "#0284c7"; good = "#16a34a"; warn = "#d97706"; shadow = "rgba(15,23,42,.10)"
    st.markdown(f"""
    <style>
    :root {{--bg:{bg};--panel:{panel};--panel2:{panel2};--text:{text};--muted:{muted};--border:{border};--accent:{accent};--good:{good};--warn:{warn};--shadow:{shadow};}}
    header[data-testid="stHeader"] {{display:none !important; height:0 !important; min-height:0 !important; visibility:hidden !important;}}
    div[data-testid="stToolbar"], div[data-testid="stDecoration"], div[data-testid="stStatusWidget"], #MainMenu, footer {{display:none !important; visibility:hidden !important; height:0 !important;}}
    .stDeployButton {{display:none !important;}}
    section[data-testid="stSidebar"], [data-testid="stSidebar"], [data-testid="collapsedControl"], [data-testid="stSidebarCollapsedControl"] {{display:none !important; visibility:hidden !important; width:0 !important; min-width:0 !important; max-width:0 !important;}}
    [data-testid="stAppViewContainer"] > .main {{padding-top:0 !important; margin-left:0 !important;}}
    [data-testid="stAppViewContainer"] .main .block-container {{padding-top:0 !important; margin-top:0 !important; max-width:1600px;}}
    .stApp {{background: radial-gradient(circle at 16% 10%, rgba(56,189,248,.16), transparent 24%), radial-gradient(circle at 88% 3%, rgba(34,197,94,.08), transparent 26%), var(--bg); color:var(--text);}}
    .custom-sidebar-panel {{background:linear-gradient(180deg,rgba(11,24,42,.98),rgba(6,16,29,.98));border:1px solid var(--border);border-radius:18px;padding:1rem;box-shadow:0 14px 32px var(--shadow);position:sticky;top:.75rem;min-height:calc(100vh - 1.5rem);}}
    .custom-sidebar-rail {{background:linear-gradient(180deg,rgba(11,24,42,.98),rgba(6,16,29,.98));border:1px solid var(--border);border-radius:18px;padding:.55rem;box-shadow:0 14px 32px var(--shadow);position:sticky;top:.75rem;min-height:calc(100vh - 1.5rem);}}
    .custom-sidebar-title {{font-size:1.08rem;font-weight:850;color:var(--text);margin-bottom:.10rem;}}
    .custom-sidebar-label {{font-size:.78rem;color:var(--muted);text-transform:uppercase;letter-spacing:.08em;font-weight:850;margin:.85rem 0 .45rem;}}
    .custom-sidebar-panel hr, .custom-sidebar-rail hr {{border-color:var(--border);}}
    .block-container {{padding-top:0 !important; padding-bottom:3rem; max-width:1600px;}}
    h1,h2,h3 {{letter-spacing:-.025em;}}
    .app-title {{display:flex;align-items:center;justify-content:space-between;gap:1rem;padding:1.05rem 1.25rem;border:1px solid var(--border);background:linear-gradient(135deg,rgba(56,189,248,.14),rgba(15,23,42,.04)),var(--panel);border-radius:20px;box-shadow:0 16px 38px var(--shadow);margin-bottom:1rem;}}
    .app-title-main {{font-size:1.55rem;font-weight:850;color:var(--text);line-height:1.1;}}
    .app-title-sub {{font-size:.86rem;color:var(--muted);margin-top:.18rem;}}
    .sidebar-version {{color:var(--muted);font-size:.78rem;margin-top:-.4rem;margin-bottom:1rem;}}
    .app-badge {{font-size:.78rem;font-weight:800;color:#031421;background:linear-gradient(135deg,var(--accent),#a7f3d0);border-radius:999px;padding:.38rem .72rem;white-space:nowrap;}}
    .metric-card {{border:1px solid var(--border);border-radius:18px;padding:1rem 1.05rem;background:linear-gradient(180deg,rgba(255,255,255,.04),transparent),var(--panel);box-shadow:0 12px 30px var(--shadow);min-height:108px;}}
    .metric-label {{color:var(--muted);font-size:.75rem;text-transform:uppercase;letter-spacing:.08em;font-weight:800;}}
    .metric-value {{color:var(--text);font-size:1.72rem;line-height:1.25;font-weight:850;margin-top:.25rem;}}
    .metric-sub {{color:var(--muted);font-size:.82rem;margin-top:.28rem;}}
    .section-card {{border:1px solid var(--border);border-radius:18px;padding:1rem;background:var(--panel);box-shadow:0 10px 28px var(--shadow);}}
    .pill {{display:inline-block;border:1px solid var(--border);border-radius:999px;background:var(--panel2);padding:.25rem .62rem;margin:.1rem .18rem;font-size:.82rem;color:var(--text);}}
    div[data-testid="stDataFrame"], div[data-testid="stDataEditor"] {{border-radius:16px;overflow:hidden;}}
    .flight-help {{color:var(--muted);font-size:.86rem;margin:.25rem 0 .75rem 0;}}

    .flight-list-note {{color:var(--muted);font-size:.84rem;margin:.25rem 0 .6rem 0;}}
    .flight-list-head {{font-size:.70rem;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;font-weight:850;padding:.10rem .15rem .20rem .15rem;border-bottom:1px solid var(--border);height:1.35rem;display:flex;align-items:flex-end;}}
    .flight-cell {{font-size:.78rem;line-height:1.05;padding:.06rem .15rem;color:var(--text);min-height:1.78rem;display:flex;flex-direction:column;justify-content:flex-start;}}
    .flight-cell-main {{font-weight:750;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}}
    .flight-cell-sub {{font-size:.68rem;color:var(--muted);margin-top:.10rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}}
    .flight-row-sep {{height:1px;background:rgba(148,163,184,.10);margin:.04rem 0 .04rem 0;}}
    .flight-page-info {{color:var(--muted);font-size:.82rem;padding-top:1.85rem;text-align:right;}}
    .selected-flight-box {{border:1px solid var(--border); border-radius:14px; padding:.65rem .85rem; background:rgba(56,189,248,.07); margin:.5rem 0 .75rem 0;}}
    .selected-flight-title {{font-weight:850;color:var(--text);}}
    .selected-flight-sub {{font-size:.82rem;color:var(--muted);margin-top:.1rem;}}
    .stTabs [data-baseweb="tab-list"] {{gap:.45rem;}}
    .stTabs [data-baseweb="tab"] {{border-radius:999px;padding:.45rem .9rem;background:var(--panel2);}}
    div.stButton > button {{border-radius:14px !important; font-weight:800 !important; border:1px solid var(--border) !important; min-height:2.05rem; padding:.22rem .60rem !important;}}
    .stButton {{margin-top:0 !important;}}
    [data-testid="column"] .stButton > button {{min-height:1.72rem !important;padding:.08rem .42rem !important;border-radius:11px !important;font-size:.78rem !important;}}
    div.stButton > button[kind="primary"] {{box-shadow:0 10px 22px rgba(56,189,248,.18) !important;}}
    div[data-testid="stExpander"] {{border:1px solid var(--border); border-radius:16px; background:rgba(255,255,255,.025);}}
    div[data-testid="stDialog"] div[role="dialog"] {{border:1px solid var(--border); border-radius:22px;}}
    button[kind="primary"] {{border-radius:12px;}}
    @media (max-width: 760px) {{.block-container {{padding-left:.75rem;padding-right:.75rem;}} .app-title {{padding:.85rem;border-radius:15px;}} .app-title-main {{font-size:1.2rem;}} .metric-value {{font-size:1.35rem;}}}}
    </style>
    """, unsafe_allow_html=True)


def app_header(subtitle: str = "Lokální pilotní evidence • ULL / EASA • náklady • GPS tracky") -> None:
    st.markdown(f"""
    <div class="app-title">
      <div><div class="app-title-main">Letový zápisník</div><div class="app-title-sub">{subtitle}</div></div>
      <div class="app-badge">{APP_VERSION}</div>
    </div>
    """, unsafe_allow_html=True)


def metric_card(label: str, value: str, sub: str = "") -> None:
    st.markdown(f"""
    <div class="metric-card"><div class="metric-label">{label}</div><div class="metric-value">{value}</div><div class="metric-sub">{sub}</div></div>
    """, unsafe_allow_html=True)


def go_to_page(page: str) -> None:
    st.session_state["page"] = page
    st.rerun()


def render_nav_button(page_name: str, label: str, key: str) -> None:
    current = st.session_state.get("page", "Dashboard") == page_name
    if st.button(label, key=key, use_container_width=True, type="primary" if current else "secondary"):
        go_to_page(page_name)


def render_sidebar_nav() -> None:
    for page_name, label in NAV_ITEMS:
        render_nav_button(page_name, label, f"side_nav_{page_name}")


def get_selected_dataframe_rows(event: Any) -> list[int]:
    if event is None:
        return []
    try:
        return list(event.selection.rows)
    except Exception:
        pass
    try:
        return list(event["selection"]["rows"])
    except Exception:
        return []


def clear_open_flight_dialog() -> None:
    current = st.session_state.get("open_flight_dialog_id")
    if current is not None:
        st.session_state["dismissed_flight_id"] = current
    st.session_state.pop("open_flight_dialog_id", None)
    try:
        if "flight_id" in st.query_params:
            del st.query_params["flight_id"]
    except Exception:
        pass

# -----------------------------------------------------------------------------
# Data reads
# -----------------------------------------------------------------------------

def read_track_counts() -> pd.DataFrame:
    with connect() as con:
        return pd.read_sql_query("SELECT flight_id, COUNT(*) AS track_count, COALESCE(SUM(distance_km),0) AS gps_km FROM flight_tracks GROUP BY flight_id", con)


def read_flights() -> pd.DataFrame:
    flights = read_table("flights")
    flights = compute_metrics(flights)
    tracks = read_track_counts()
    if tracks.empty:
        flights["track_count"] = 0
        flights["gps_km"] = 0.0
    else:
        flights = flights.merge(tracks, how="left", left_on="id", right_on="flight_id")
        flights["track_count"] = flights["track_count"].fillna(0).astype(int)
        flights["gps_km"] = flights["gps_km"].fillna(0.0)
    return flights


def read_tracks_joined() -> pd.DataFrame:
    with connect() as con:
        return pd.read_sql_query("""
        SELECT t.*, f.date, f.evidence, f.registration, f.aircraft_type, f.aircraft_class,
               f.departure, f.arrival, f.off_block, f.takeoff, f.landing, f.on_block,
               f.role, f.starts, f.task, f.commander
        FROM flight_tracks t JOIN flights f ON f.id=t.flight_id
        ORDER BY f.date, f.off_block, t.id
        """, con)


def read_tracks_for_flight(flight_id: int) -> pd.DataFrame:
    with connect() as con:
        return pd.read_sql_query("SELECT * FROM flight_tracks WHERE flight_id=? ORDER BY id", con, params=(flight_id,))


def read_airports(active_only: bool = False) -> pd.DataFrame:
    with connect() as con:
        where = "WHERE active=1" if active_only else ""
        return pd.read_sql_query(f"SELECT * FROM airports {where} ORDER BY priority DESC, ident", con)

# -----------------------------------------------------------------------------
# KML/GPS
# -----------------------------------------------------------------------------

def local_name(tag: str) -> str:
    return tag.split("}", 1)[-1] if "}" in tag else tag


def parse_iso(value: str | None) -> datetime | None:
    if not value:
        return None
    text = value.strip().replace("Z", "+00:00")
    try:
        dt = datetime.fromisoformat(text)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except Exception:
        return None


def extract_coord_tokens(text: str | None) -> list[tuple[float, float, float | None]]:
    if not text:
        return []
    out = []
    for tok in re.split(r"\s+", text.strip()):
        if not tok or "," not in tok:
            continue
        parts = tok.split(",")
        if len(parts) >= 2:
            try:
                lon = float(parts[0]); lat = float(parts[1]); alt = float(parts[2]) if len(parts) > 2 and parts[2] != "" else None
                out.append((lat, lon, alt))
            except ValueError:
                pass
    return out


def normalize_track_points(points: list[dict[str, Any]]) -> list[dict[str, Any]]:
    cleaned: list[dict[str, Any]] = []
    for p in points:
        try:
            lat = float(p["lat"]); lon = float(p["lon"])
        except Exception:
            continue
        alt = None
        try:
            if p.get("alt") is not None:
                alt = float(p.get("alt"))
        except Exception:
            alt = None
        time_val = p.get("time")
        dt = parse_iso(str(time_val)) if time_val else None
        cleaned.append({"lat": lat, "lon": lon, "alt": alt, "time": dt.isoformat() if dt else (str(time_val) if time_val else None)})
    if any(parse_iso(p.get("time")) for p in cleaned):
        cleaned.sort(key=lambda p: parse_iso(p.get("time")) or datetime.min.replace(tzinfo=timezone.utc))
    return cleaned


def parse_kml_bytes(raw: bytes) -> list[dict[str, Any]]:
    root = ET.fromstring(raw)
    points: list[dict[str, Any]] = []

    # gx:Track: alternating when/coord lists.
    for node in root.iter():
        if local_name(node.tag) == "Track":
            whens: list[str] = []
            coords: list[tuple[float, float, float | None]] = []
            for child in list(node):
                lname = local_name(child.tag)
                if lname == "when" and child.text:
                    whens.append(child.text.strip())
                elif lname == "coord" and child.text:
                    parts = child.text.strip().split()
                    if len(parts) >= 2:
                        try:
                            lon = float(parts[0]); lat = float(parts[1]); alt = float(parts[2]) if len(parts) > 2 else None
                            coords.append((lat, lon, alt))
                        except Exception:
                            pass
            for i, c in enumerate(coords):
                points.append({"lat": c[0], "lon": c[1], "alt": c[2], "time": whens[i] if i < len(whens) else None})

    if points:
        return normalize_track_points(points)

    # Placemark Point/LineString, optional TimeStamp/when.
    for pm in root.iter():
        if local_name(pm.tag) != "Placemark":
            continue
        pm_time = None
        coords_text = None
        for child in pm.iter():
            lname = local_name(child.tag)
            if lname == "when" and child.text and pm_time is None:
                pm_time = child.text.strip()
            elif lname == "coordinates" and child.text:
                coords_text = child.text
        for lat, lon, alt in extract_coord_tokens(coords_text):
            points.append({"lat": lat, "lon": lon, "alt": alt, "time": pm_time})
    return normalize_track_points(points)


def haversine_km(a: dict[str, Any], b: dict[str, Any]) -> float:
    R = 6371.0
    lat1 = math.radians(float(a["lat"])); lon1 = math.radians(float(a["lon"]))
    lat2 = math.radians(float(b["lat"])); lon2 = math.radians(float(b["lon"]))
    dlat = lat2 - lat1; dlon = lon2 - lon1
    x = math.sin(dlat/2)**2 + math.cos(lat1)*math.cos(lat2)*math.sin(dlon/2)**2
    return 2 * R * math.asin(math.sqrt(x))


def track_stats(points: list[dict[str, Any]]) -> dict[str, Any]:
    points = normalize_track_points(points)
    dist = 0.0
    alts = []
    for i in range(1, len(points)):
        dist += haversine_km(points[i-1], points[i])
    for p in points:
        if p.get("alt") is not None:
            try: alts.append(float(p["alt"]))
            except Exception: pass
    times = [p.get("time") for p in points if p.get("time")]
    return {
        "point_count": len(points),
        "distance_km": round(dist, 3),
        "start_utc": times[0] if times else None,
        "end_utc": times[-1] if times else None,
        "min_alt_m": min(alts) if alts else None,
        "max_alt_m": max(alts) if alts else None,
    }


def profile_from_points(points: list[dict[str, Any]]) -> pd.DataFrame:
    points = normalize_track_points(points)
    rows = []
    cumulative = 0.0
    prev = None
    prev_time = None
    for i, p in enumerate(points):
        t = parse_iso(p.get("time")) if p.get("time") else None
        if prev is not None:
            cumulative += haversine_km(prev, p)
        speed = None
        if prev is not None and t is not None and prev_time is not None:
            dt_h = (t - prev_time).total_seconds() / 3600
            if dt_h > 0:
                leg = haversine_km(prev, p)
                speed = leg / dt_h
                if speed > 900:
                    speed = None
        if speed is None:
            try:
                speed = float(p.get("speed_kmh")) if p.get("speed_kmh") is not None else None
            except Exception:
                speed = None
        rows.append({"idx": i, "time_utc": t, "lat": float(p["lat"]), "lon": float(p["lon"]), "alt_m": p.get("alt"), "distance_km": cumulative, "speed_kmh": speed})
        prev = p
        if t is not None:
            prev_time = t
    return pd.DataFrame(rows)


def clock_times_from_detection(points: list[dict[str, Any]]) -> tuple[dict[str, str | None], bool, dict[str, int]]:
    prof = profile_from_points(points)
    if prof.empty or prof["time_utc"].isna().all():
        return {"off_block": None, "takeoff": None, "landing": None, "on_block": None}, False, {"off_idx":0,"takeoff_idx":0,"landing_idx":max(0,len(points)-1),"on_idx":max(0,len(points)-1)}
    work = prof.copy()
    work["speed_kmh"] = pd.to_numeric(work["speed_kmh"], errors="coerce")
    work["alt_m"] = pd.to_numeric(work["alt_m"], errors="coerce")
    moving = work["speed_kmh"].fillna(0) > 55
    if moving.sum() < 4 and work["alt_m"].notna().sum() > 5:
        base = work["alt_m"].dropna().quantile(.1)
        moving = work["alt_m"].fillna(base) > base + 80
    if moving.sum() == 0:
        ti, li = 0, len(work)-1
    else:
        idx = list(work.index[moving])
        ti, li = int(idx[0]), int(idx[-1])
    to_dt = work.loc[ti, "time_utc"]
    ld_dt = work.loc[li, "time_utc"]
    if pd.isna(to_dt) or pd.isna(ld_dt):
        return {"off_block": None, "takeoff": None, "landing": None, "on_block": None}, False, {"takeoff_idx":ti,"landing_idx":li}
    off_dt = to_dt - timedelta(minutes=5)
    on_dt = ld_dt + timedelta(minutes=5)
    def lt(dt):
        return dt.astimezone(LOCAL_TZ).strftime("%H:%M")
    return {"off_block": lt(off_dt), "takeoff": lt(to_dt), "landing": lt(ld_dt), "on_block": lt(on_dt)}, True, {"off_idx":ti,"takeoff_idx":ti,"landing_idx":li,"on_idx":li}


def render_track_profile(points: list[dict[str, Any]]) -> None:
    prof = profile_from_points(points)
    if prof.empty:
        return
    x = prof["time_utc"] if prof["time_utc"].notna().any() else prof["distance_km"]
    x_title = "Čas" if prof["time_utc"].notna().any() else "Vzdálenost km"
    fig = go.Figure()
    if prof["alt_m"].notna().any():
        fig.add_trace(go.Scatter(x=x, y=prof["alt_m"], mode="lines", name="Altitude ft", line=dict(color="#38bdf8", width=2)))
        fig.update_yaxes(title_text="Altitude ft", secondary_y=False)
    if prof["speed_kmh"].notna().any():
        fig.add_trace(go.Scatter(x=x, y=prof["speed_kmh"], mode="lines", name="GPS speed km/h", line=dict(color="#f59e0b", width=2), yaxis="y2"))
        fig.update_layout(yaxis2=dict(title="GPS speed km/h", overlaying="y", side="right", showgrid=False))
    else:
        st.caption("GPS speed nelze zobrazit: track nemá dostatek použitelných časových údajů pro výpočet rychlosti.")
    fig.update_layout(title="Profil letu", xaxis_title=x_title, template="plotly_dark", paper_bgcolor="rgba(0,0,0,0)", plot_bgcolor="rgba(0,0,0,0)", margin=dict(l=10,r=10,t=45,b=10), legend=dict(orientation="h", y=1.03, x=1, xanchor="right"))
    fig.update_xaxes(gridcolor="rgba(148,163,184,.18)")
    fig.update_yaxes(gridcolor="rgba(148,163,184,.18)")
    st.plotly_chart(fig, use_container_width=True)


def downsample_points(points: list[dict[str, Any]], max_points: int = 1200) -> list[dict[str, Any]]:
    if len(points) <= max_points:
        return points
    step = max(1, math.ceil(len(points) / max_points))
    sampled = points[::step]
    if sampled[-1] != points[-1]:
        sampled.append(points[-1])
    return sampled


def map_center_from_tracks(tracks: pd.DataFrame) -> tuple[list[float], int]:
    coords: list[tuple[float, float]] = []
    for _, row in tracks.iterrows():
        try:
            points = json.loads(row["coordinates_json"])
            stride = max(1, len(points) // 50 or 1)
            for p in points[::stride]:
                coords.append((float(p["lat"]), float(p["lon"])))
        except Exception:
            continue
    if not coords:
        return [49.8, 15.5], 7
    min_lat = min(c[0] for c in coords); max_lat = max(c[0] for c in coords); min_lon = min(c[1] for c in coords); max_lon = max(c[1] for c in coords)
    return [(min_lat + max_lat)/2, (min_lon + max_lon)/2], 7


def make_map(tracks: pd.DataFrame, dark_mode: bool = True, line_weight: float = 2.0, line_opacity: float = .55, show_endpoints: bool = False) -> folium.Map:
    center, zoom = map_center_from_tracks(tracks)
    m = folium.Map(location=center, zoom_start=zoom, tiles="CartoDB dark_matter" if dark_mode else "OpenStreetMap")
    for _, row in tracks.iterrows():
        try:
            points = json.loads(row["coordinates_json"])
        except Exception:
            continue
        points = downsample_points(points, 1800)
        coords = [(float(p["lat"]), float(p["lon"])) for p in points]
        if len(coords) < 2:
            continue
        popup = f"{row.get('date','')} {row.get('registration','')} {row.get('departure','')}–{row.get('arrival','')}"
        folium.PolyLine(coords, color="#38bdf8", weight=line_weight, opacity=line_opacity, tooltip=popup).add_to(m)
        if show_endpoints:
            folium.CircleMarker(coords[0], radius=3, color="#22c55e", fill=True, fill_opacity=.9, tooltip="Start").add_to(m)
            folium.CircleMarker(coords[-1], radius=3, color="#f43f5e", fill=True, fill_opacity=.9, tooltip="End").add_to(m)
    return m

# -----------------------------------------------------------------------------
# Forms / storage
# -----------------------------------------------------------------------------

def apply_rate_for_registration(reg: str, date_value: str, rates: pd.DataFrame) -> dict[str, Any] | None:
    if rates.empty or not reg:
        return None
    work = rates.copy()
    work["registration"] = work["registration"].fillna("").astype(str).str.upper().str.replace("OK-", "", regex=False)
    key = reg.upper().replace("OK-", "")
    work = work[work["registration"].eq(key) | work["registration"].eq(reg.upper())]
    if work.empty:
        return None
    work["valid_dt"] = pd.to_datetime(work["valid_from"], errors="coerce")
    target = pd.to_datetime(date_value, errors="coerce")
    if pd.notna(target):
        before = work[work["valid_dt"].le(target)]
        if not before.empty:
            work = before
    row = work.sort_values("valid_dt").iloc[-1]
    return row.to_dict()


def default_class_for(evidence: str) -> str:
    return "ULL" if evidence == "ULL" else "SEP"


def nearest_airport(point: dict[str, Any] | None, max_km: float = 8.0) -> str:
    if not point:
        return ""
    airports = read_airports(active_only=True)
    if airports.empty:
        return ""
    best_ident = ""
    best_d = float("inf")
    p = {"lat": float(point["lat"]), "lon": float(point["lon"])}
    # Fast bounding box before distance calc.
    lat_margin = max_km / 111.0
    lon_margin = max_km / max(30.0, 111.0 * math.cos(math.radians(p["lat"])))
    sub = airports[(airports["latitude_deg"].between(p["lat"]-lat_margin, p["lat"]+lat_margin)) & (airports["longitude_deg"].between(p["lon"]-lon_margin, p["lon"]+lon_margin))]
    if sub.empty:
        sub = airports
    for _, ap in sub.iterrows():
        try:
            d = haversine_km(p, {"lat": float(ap["latitude_deg"]), "lon": float(ap["longitude_deg"])})
        except Exception:
            continue
        if d < best_d:
            best_d = d
            best_ident = str(ap.get("ident") or ap.get("icao_code") or "")
    return best_ident if best_d <= max_km else ""


def guess_registration_from_filename(name: str) -> str:
    up = name.upper()
    m = re.search(r"OK[-_ ]?([A-Z0-9]{3,5})", up)
    if m:
        raw = m.group(1)
        return f"OK-{raw}" if not raw.startswith("-") else f"OK{raw}"
    return ""


def suggest_flight_from_kml(uploaded_name: str, points: list[dict[str, Any]], rates: pd.DataFrame) -> dict[str, Any]:
    stats = track_stats(points)
    clock, has_clock, idx = clock_times_from_detection(points)
    first_time = parse_iso(stats["start_utc"]) if stats.get("start_utc") else None
    local_date = first_time.astimezone(LOCAL_TZ).date().isoformat() if first_time else date.today().isoformat()
    reg = guess_registration_from_filename(uploaded_name)
    rate = apply_rate_for_registration(reg, local_date, rates) if reg else None
    evidence = str(rate.get("evidence") or ("ULL" if reg and len(reg.replace("OK-", "")) > 3 else "EASA")) if rate else "ULL"
    return {
        "date": local_date,
        "evidence": evidence,
        "registration": reg,
        "aircraft_type": normalize_text(rate.get("aircraft_type")) if rate else "",
        "aircraft_class": str(rate.get("aircraft_class") or default_class_for(evidence)) if rate else default_class_for(evidence),
        "departure": nearest_airport(points[idx.get("takeoff_idx", idx.get("off_idx", 0))] if points else None),
        "arrival": nearest_airport(points[idx.get("landing_idx", idx.get("on_idx", len(points)-1))] if points else None),
        "off_block": clock.get("off_block"),
        "takeoff": clock.get("takeoff"),
        "landing": clock.get("landing"),
        "on_block": clock.get("on_block"),
        "starts": 1,
        "commander": "Točík Filip",
        "instructor": "",
        "role": "PIC",
        "task": "",
        "price_per_hour": float(rate.get("price_per_hour")) if rate and pd.notna(rate.get("price_per_hour")) else 0.0,
        "note": "" if has_clock else "KML nemá použitelné časové značky; časy doplnit ručně.",
        "stats": stats,
        "detect_idx": idx,
        "has_clock": has_clock,
    }


def save_track(flight_id: int, file_name: str, points: list[dict[str, Any]], replace_existing: bool = False) -> None:
    stats = track_stats(points)
    with connect() as con:
        if replace_existing:
            con.execute("DELETE FROM flight_tracks WHERE flight_id = ?", (flight_id,))
        cur = con.execute(
            """
            INSERT INTO flight_tracks (flight_id, file_name, imported_at, point_count, distance_km, start_utc, end_utc, min_alt_m, max_alt_m, coordinates_json)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (flight_id, file_name, _now_iso(), stats["point_count"], stats["distance_km"], stats["start_utc"], stats["end_utc"], stats["min_alt_m"], stats["max_alt_m"], json.dumps(normalize_track_points(points), ensure_ascii=False)),
        )
        track_id = int(cur.lastrowid)
        prof = profile_from_points(points)
        for _, p in prof.iterrows():
            con.execute(
                "INSERT OR IGNORE INTO track_points (track_id, seq, timestamp_utc, latitude, longitude, altitude_m, speed_kmh) VALUES (?, ?, ?, ?, ?, ?, ?)",
                (track_id, int(p["idx"]), p["time_utc"].isoformat() if pd.notna(p["time_utc"]) else None, float(p["lat"]), float(p["lon"]), None if pd.isna(p["alt_m"]) else float(p["alt_m"]), None if pd.isna(p["speed_kmh"]) else float(p["speed_kmh"])),
            )
        record_audit(con, "save_track", "flight_tracks", track_id, {"flight_id": flight_id, "file_name": file_name})
        con.commit()
    auto_backup_after_change("save_track")


def create_flight(data: dict[str, Any], auto_backup: bool = True) -> int:
    fields = ["date","evidence","registration","aircraft_type","aircraft_class","departure","arrival","off_block","takeoff","landing","on_block","starts","commander","instructor","role","task","price_per_hour","note"]
    vals = []
    for f in fields:
        v = data.get(f)
        if f == "date":
            v = normalize_date(v)
        elif f in {"off_block", "takeoff", "landing", "on_block"}:
            v = normalize_time(v)
        elif f == "starts":
            v = int(v or 0)
        elif f == "price_per_hour":
            v = float(v or 0)
        elif f in {"evidence", "registration", "aircraft_class", "departure", "arrival", "role"}:
            v = normalize_text(v)
            v = v.upper() if v else None
        else:
            v = normalize_text(v)
        vals.append(v)
    with connect() as con:
        cur = con.execute(
            f"INSERT INTO flights ({','.join(fields)}) VALUES ({','.join(['?']*len(fields))})",
            vals,
        )
        flight_id = int(cur.lastrowid)
        record_audit(con, "create_flight", "flights", flight_id, data)
        con.commit()
    if auto_backup:
        auto_backup_after_change("create_flight")
    return flight_id


def update_flight(flight_id: int, data: dict[str, Any]) -> None:
    fields = ["date","evidence","registration","aircraft_type","aircraft_class","departure","arrival","off_block","takeoff","landing","on_block","starts","commander","instructor","role","task","price_per_hour","note"]
    values = []
    for f in fields:
        v = data.get(f)
        if f == "date":
            v = normalize_date(v)
        elif f in {"off_block", "takeoff", "landing", "on_block"}:
            v = normalize_time(v)
        elif f == "starts":
            v = int(v or 0)
        elif f == "price_per_hour":
            v = float(v or 0)
        elif f in {"evidence", "registration", "aircraft_class", "departure", "arrival", "role"}:
            v = normalize_text(v)
            v = v.upper() if v else None
        else:
            v = normalize_text(v)
        values.append(v)
    with connect() as con:
        con.execute("UPDATE flights SET " + ", ".join(f"{f}=?" for f in fields) + " WHERE id=?", [*values, flight_id])
        record_audit(con, "update_flight", "flights", flight_id, data)
        con.commit()
    auto_backup_after_change("update_flight")


def delete_track(track_id: int) -> None:
    with connect() as con:
        con.execute("DELETE FROM flight_tracks WHERE id = ?", (track_id,))
        record_audit(con, "delete_track", "flight_tracks", track_id, None)
        con.commit()
    auto_backup_after_change("delete_track")


def delete_flight(flight_id: int) -> None:
    with connect() as con:
        row = con.execute("SELECT * FROM flights WHERE id = ?", (flight_id,)).fetchone()
        if row is None:
            return
        track_count = con.execute("SELECT COUNT(*) AS n FROM flight_tracks WHERE flight_id = ?", (flight_id,)).fetchone()["n"]
        audit_detail = {"date": row["date"], "registration": row["registration"], "route": f"{row['departure'] or ''}-{row['arrival'] or ''}", "tracks_deleted": int(track_count or 0)}
        con.execute("DELETE FROM flights WHERE id = ?", (flight_id,))
        record_audit(con, "delete_flight", "flights", flight_id, audit_detail)
        con.commit()
    auto_backup_after_change("delete_flight")


def flight_form(prefix: str, defaults: dict[str, Any], rates: pd.DataFrame, submit_label: str = "Uložit let") -> dict[str, Any] | None:
    c1, c2, c3 = st.columns(3)
    date_val = c1.date_input("Datum", value=pd.to_datetime(defaults.get("date") or date.today()).date(), key=f"{prefix}_date")
    evidence = c2.selectbox("Evidence", EVIDENCE_OPTIONS, index=EVIDENCE_OPTIONS.index(defaults.get("evidence", "ULL")) if defaults.get("evidence", "ULL") in EVIDENCE_OPTIONS else 0, key=f"{prefix}_ev")
    registration = c3.text_input("Imatrikulace", value=str(defaults.get("registration") or ""), key=f"{prefix}_reg").upper()
    rate = apply_rate_for_registration(registration, date_val.isoformat(), rates)
    default_price = defaults.get("price_per_hour") if defaults.get("price_per_hour") not in (None, "") else (rate.get("price_per_hour") if rate else 0)
    with st.form(f"{prefix}_form"):
        col1, col2, col3 = st.columns(3)
        with col1:
            flight_date = st.date_input("Datum letu", value=date_val, key=f"{prefix}_date2")
            aircraft_type = st.text_input("Typ", value=str(defaults.get("aircraft_type") or (rate.get("aircraft_type") if rate else "")), key=f"{prefix}_type")
            cls_def = defaults.get("aircraft_class") or (rate.get("aircraft_class") if rate else default_class_for(evidence))
            aircraft_class = st.selectbox("Třída", CLASS_OPTIONS, index=CLASS_OPTIONS.index(cls_def) if cls_def in CLASS_OPTIONS else 0, key=f"{prefix}_class")
            task = st.text_input("Úloha", value=str(defaults.get("task") or ""), key=f"{prefix}_task1")
        with col2:
            departure = st.text_input("Odlet", value=str(defaults.get("departure") or ""), key=f"{prefix}_dep").upper()
            arrival = st.text_input("Přílet", value=str(defaults.get("arrival") or ""), key=f"{prefix}_arr").upper()
            off_block = st.text_input("Off Block", value=str(defaults.get("off_block") or ""), key=f"{prefix}_off")
            takeoff = st.text_input("Takeoff", value=str(defaults.get("takeoff") or ""), key=f"{prefix}_to")
            landing = st.text_input("Landing", value=str(defaults.get("landing") or ""), key=f"{prefix}_ldg")
            on_block = st.text_input("On Block", value=str(defaults.get("on_block") or ""), key=f"{prefix}_on")
        with col3:
            starts = st.number_input("Starty", min_value=0, step=1, value=int(defaults.get("starts") or 1), key=f"{prefix}_starts")
            commander = st.text_input("Velitel", value=str(defaults.get("commander") or "Točík Filip"), key=f"{prefix}_cmd")
            instructor = st.text_input("Instruktor", value=str(defaults.get("instructor") or ""), key=f"{prefix}_instr")
            role_def = defaults.get("role") or "PIC"
            role = st.selectbox("Funkce", ROLE_OPTIONS, index=ROLE_OPTIONS.index(role_def) if role_def in ROLE_OPTIONS else 0, key=f"{prefix}_role")
            price = st.number_input("Cena Kč/h", min_value=0.0, step=50.0, value=float(default_price or 0), key=f"{prefix}_price")
            task2 = st.text_input("Poznámka / task doplnění", value=str(defaults.get("note") or ""), key=f"{prefix}_note")
        block = minutes_diff(off_block, on_block); air = minutes_diff(takeoff, landing)
        c1, c2, c3 = st.columns(3)
        with c1: metric_card("Block Time", fmt_minutes(block), "")
        with c2: metric_card("Air Time", fmt_minutes(air), "")
        with c3: metric_card("Cena letu", fmt_money((block or 0)/60*price), "")
        submitted = st.form_submit_button(submit_label, type="primary", use_container_width=True)
    if submitted:
        return {"date": flight_date, "evidence": evidence, "registration": registration, "aircraft_type": aircraft_type, "aircraft_class": aircraft_class, "departure": departure, "arrival": arrival, "off_block": off_block, "takeoff": takeoff, "landing": landing, "on_block": on_block, "starts": int(starts), "commander": commander, "instructor": instructor, "role": role, "task": task, "price_per_hour": price, "note": task2}
    return None

# -----------------------------------------------------------------------------
# Pages
# -----------------------------------------------------------------------------

def filter_controls(df: pd.DataFrame, key_prefix: str = "") -> pd.DataFrame:
    if df.empty:
        return df
    work = df.copy()
    with st.expander("Filtry", expanded=False):
        c1, c2, c3, c4 = st.columns(4)
        years = sorted(int(y) for y in work["year"].dropna().unique())
        registrations = sorted(r for r in work["registration"].dropna().unique() if r)
        roles = sorted(r for r in work["role"].dropna().unique() if r)
        selected_years = c1.multiselect("Rok", years, default=years, key=f"{key_prefix}_years")
        selected_evidence = c2.multiselect("Evidence", EVIDENCE_OPTIONS, default=EVIDENCE_OPTIONS, key=f"{key_prefix}_ev")
        selected_roles = c3.multiselect("Funkce", roles, default=roles, key=f"{key_prefix}_roles")
        selected_regs = c4.multiselect("Imatrikulace", registrations, default=[], key=f"{key_prefix}_regs")
    if selected_years:
        work = work[work["year"].isin(selected_years)]
    if selected_evidence:
        work = work[work["evidence"].isin(selected_evidence)]
    if selected_roles:
        work = work[work["role"].isin(selected_roles)]
    if selected_regs:
        work = work[work["registration"].isin(selected_regs)]
    return work


def stat_minutes(df: pd.DataFrame, mask=None) -> int:
    if df.empty:
        return 0
    series = df["block_minutes"].fillna(0)
    if mask is not None:
        series = series[mask]
    return int(series.sum())


def build_summary(df: pd.DataFrame) -> dict[str, Any]:
    if df.empty:
        return {"flights":0,"starts":0,"total":0,"air":0,"pic":0,"pic_ull":0,"pic_easa":0,"dual":0,"safety":0,"ull":0,"easa":0,"cost":0.0,"tracks":0,"gps_km":0.0}
    return {
        "flights": int(len(df)), "starts": int(df["starts"].sum()), "total": int(df["block_minutes"].fillna(0).sum()), "air": int(df["air_minutes"].fillna(0).sum()),
        "pic": stat_minutes(df, df["role"].eq("PIC")), "pic_ull": stat_minutes(df, df["role"].eq("PIC") & df["evidence"].eq("ULL")), "pic_easa": stat_minutes(df, df["role"].eq("PIC") & df["evidence"].eq("EASA")),
        "dual": stat_minutes(df, df["role"].eq("DUAL")), "safety": stat_minutes(df, df["role"].eq("SAFETY PILOT")), "ull": stat_minutes(df, df["evidence"].eq("ULL")), "easa": stat_minutes(df, df["evidence"].eq("EASA")),
        "cost": float(df["cost"].fillna(0).sum()), "tracks": int(df.get("track_count", pd.Series(dtype=int)).fillna(0).sum()) if "track_count" in df else 0, "gps_km": float(df.get("gps_km", pd.Series(dtype=float)).fillna(0).sum()) if "gps_km" in df else 0.0,
    }


def plotly_layout(fig):
    fig.update_layout(template="plotly_dark", paper_bgcolor="rgba(0,0,0,0)", plot_bgcolor="rgba(0,0,0,0)", font=dict(color="#e5edf7"), margin=dict(l=10,r=10,t=45,b=10), legend=dict(orientation="h", yanchor="bottom", y=1.02, xanchor="right", x=1))
    fig.update_xaxes(gridcolor="rgba(148,163,184,.18)")
    fig.update_yaxes(gridcolor="rgba(148,163,184,.18)")
    return fig


def page_dashboard(df: pd.DataFrame):
    st.markdown("## Dashboard")
    filtered = filter_controls(df, "dash")
    s = build_summary(filtered)
    c1, c2, c3, c4 = st.columns(4)
    with c1: metric_card("Celkový nálet", fmt_minutes(s["total"]), f"{s['flights']} letů")
    with c2: metric_card("PIC", fmt_minutes(s["pic"]), f"ULL {fmt_minutes(s['pic_ull'])} • EASA {fmt_minutes(s['pic_easa'])}")
    with c3: metric_card("DUAL / Safety", f"{fmt_minutes(s['dual'])} / {fmt_minutes(s['safety'])}", f"Starty {s['starts']}")
    with c4: metric_card("Náklady", fmt_money(s["cost"]), f"GPS {s['tracks']} tracků • {s['gps_km']:.0f} km")
    if filtered.empty:
        return
    yearly = filtered.groupby(["year","role"], as_index=False)["block_hours"].sum()
    st.plotly_chart(plotly_layout(px.bar(yearly, x="year", y="block_hours", color="role", title="Nálet podle roku a funkce", labels={"block_hours":"hodiny"})), use_container_width=True)
    c1, c2 = st.columns(2)
    with c1:
        by_reg = filtered.groupby("registration", as_index=False)["block_hours"].sum().sort_values("block_hours", ascending=False).head(10)
        st.plotly_chart(plotly_layout(px.bar(by_reg, x="registration", y="block_hours", title="TOP letadla podle block time")), use_container_width=True)
    with c2:
        ev = filtered.groupby("evidence", as_index=False)["block_hours"].sum()
        st.plotly_chart(plotly_layout(px.pie(ev, names="evidence", values="block_hours", title="ULL / EASA", hole=.45)), use_container_width=True)


def _cell(main: Any, sub: Any = "") -> str:
    return f'<div class="flight-cell"><div class="flight-cell-main">{_safe_str(main)}</div><div class="flight-cell-sub">{_safe_str(sub)}</div></div>'


def render_flight_list(table: pd.DataFrame, rates: pd.DataFrame, dark_mode: bool) -> None:
    if table.empty:
        st.info("Žádné lety podle aktuálních filtrů.")
        return
    row_options = [10, 20, 30, 50, 100, "Vše"]
    c1, c2, c3 = st.columns([1,1,2])
    page_size_choice = c1.selectbox("Řádků na stránku", row_options, index=2, key="flight_page_size")
    query = c3.text_input("Rychlé hledání", placeholder="registrace, letiště, typ, funkce...", key="flight_quick_search")
    if query:
        qq = query.lower().strip()
        table = table[table.astype(str).apply(lambda col: col.str.lower().str.contains(qq, na=False)).any(axis=1)]
    if table.empty:
        st.info("Žádné lety po rychlém hledání.")
        return
    if page_size_choice == "Vše":
        page_size = len(table)
        total_pages = 1
    else:
        page_size = int(page_size_choice)
        total_pages = max(1, math.ceil(len(table)/page_size))
    default_page = total_pages
    page = c2.number_input("Stránka", min_value=1, max_value=total_pages, value=min(int(st.session_state.get("flight_page", default_page)), total_pages), step=1, key="flight_page_input")
    st.session_state["flight_page"] = page
    start = (page-1)*page_size
    page_df = table.iloc[start:start+page_size]
    c3.markdown(f'<div class="flight-page-info">{len(table)} letů • stránka {page}/{total_pages}</div>', unsafe_allow_html=True)

    widths = [0.70, 0.55, 0.90, 0.55, 1.05, 1.25, 1.00, 0.85, 0.50, 0.90, 1.05, 0.75, 0.62]
    headers = ["", "ID", "Datum", "Ev.", "Letadlo", "Trasa", "Časy", "Block", "St.", "Funkce", "Velitel", "Cena", "GPS"]
    cols = st.columns(widths)
    for col, h in zip(cols, headers):
        col.markdown(f'<div class="flight-list-head">{h}</div>', unsafe_allow_html=True)
    for _, row in page_df.iterrows():
        cols = st.columns(widths)
        if cols[0].button("Detail", key=f"detail_btn_{int(row['id'])}", use_container_width=True):
            st.session_state["open_flight_dialog_id"] = int(row["id"])
            st.rerun()
        cols[1].markdown(_cell(int(row.get("id") or 0)), unsafe_allow_html=True)
        cols[2].markdown(_cell(row.get("date")), unsafe_allow_html=True)
        cols[3].markdown(_cell(row.get("evidence")), unsafe_allow_html=True)
        aircraft_sub = " • ".join(x for x in [_safe_str(row.get("aircraft_type")), _safe_str(row.get("aircraft_class"))] if x)
        cols[4].markdown(_cell(row.get("registration"), aircraft_sub), unsafe_allow_html=True)
        cols[5].markdown(_cell(f"{row.get('departure') or ''}–{row.get('arrival') or ''}"), unsafe_allow_html=True)
        cols[6].markdown(_cell(f"{row.get('off_block') or ''}–{row.get('on_block') or ''}", f"Air {row.get('takeoff') or ''}–{row.get('landing') or ''}"), unsafe_allow_html=True)
        cols[7].markdown(_cell(row.get("block_time"), f"Air {row.get('air_time') or ''}"), unsafe_allow_html=True)
        cols[8].markdown(_cell(_safe_int(row.get("starts"))), unsafe_allow_html=True)
        cols[9].markdown(_cell(row.get("role"), row.get("task")), unsafe_allow_html=True)
        cols[10].markdown(_cell(row.get("commander"), row.get("instructor")), unsafe_allow_html=True)
        rate_lbl = f"{_safe_float(row.get('price_per_hour')):.0f} Kč/h" if _safe_float(row.get("price_per_hour")) else ""
        cols[11].markdown(_cell(row.get("cost_label"), rate_lbl), unsafe_allow_html=True)
        cols[12].markdown(_cell(_safe_int(row.get("track_count")), f"{_safe_float(row.get('gps_km')):.0f} km"), unsafe_allow_html=True)
        st.markdown('<div class="flight-row-sep"></div>', unsafe_allow_html=True)
    open_id = st.session_state.get("open_flight_dialog_id")
    if open_id is not None and int(open_id) in set(table["id"].astype(int).tolist()):
        render_flight_detail_dialog(int(open_id), table, rates, dark_mode)


def render_flight_detail_dialog(flight_id: int, flights_df: pd.DataFrame, rates: pd.DataFrame, dark_mode: bool):
    row_df = flights_df[flights_df["id"].eq(flight_id)]
    if row_df.empty:
        clear_open_flight_dialog(); return
    row = row_df.iloc[0]
    title = f"Let ID {flight_id} • {row.get('date')} • {row.get('registration') or ''} • {row.get('departure') or ''}–{row.get('arrival') or ''}"
    @st.dialog(title, width="large")
    def _dialog():
        tabs = st.tabs(["Přehled", "Editace", "Track", "Smazání"])
        with tabs[0]:
            c1,c2,c3,c4 = st.columns(4)
            with c1: metric_card("Block", row.get("block_time") or "", f"Air {row.get('air_time') or ''}")
            with c2: metric_card("Trasa", f"{row.get('departure') or ''}–{row.get('arrival') or ''}", row.get("registration") or "")
            with c3: metric_card("Funkce", row.get("role") or "", row.get("evidence") or "")
            with c4: metric_card("Cena", row.get("cost_label") or "", f"GPS {int(row.get('track_count') or 0)}")
            details = pd.DataFrame([{"Datum":row.get("date"),"Evidence":row.get("evidence"),"Imatrikulace":row.get("registration"),"Typ":row.get("aircraft_type"),"Třída":row.get("aircraft_class"),"Odlet":row.get("departure"),"Přílet":row.get("arrival"),"Off block":row.get("off_block"),"Takeoff":row.get("takeoff"),"Landing":row.get("landing"),"On block":row.get("on_block"),"Starty":row.get("starts"),"Velitel":row.get("commander"),"Instruktor":row.get("instructor"),"Funkce":row.get("role"),"Úloha":row.get("task"),"Kč/h":row.get("price_per_hour"),"Poznámka":row.get("note")}])
            st.dataframe(details, hide_index=True, use_container_width=True)
        with tabs[1]:
            if not is_admin(): st.info("Editace je dostupná jen po přihlášení jako admin.")
            else:
                saved = flight_form(f"edit_flight_{flight_id}", row.to_dict(), rates, "Uložit změny")
                if saved is not None:
                    update_flight(flight_id, saved)
                    st.success("Změny uloženy."); clear_open_flight_dialog(); st.rerun()
        with tabs[2]:
            flight_tracks = read_tracks_for_flight(flight_id)
            if not flight_tracks.empty:
                joined = read_tracks_joined()
                st_folium(make_map(joined[joined["flight_id"].eq(flight_id)], dark_mode, line_weight=3.0, line_opacity=.75, show_endpoints=True), height=420, use_container_width=True, key=f"track_map_existing_{flight_id}_{len(flight_tracks)}")
                first_points = json.loads(flight_tracks.iloc[0]["coordinates_json"])
                render_track_profile(first_points)
                show = flight_tracks[["id","file_name","point_count","distance_km","start_utc","end_utc","max_alt_m"]].rename(columns={"id":"Track ID","file_name":"Soubor","point_count":"Body","distance_km":"Km","start_utc":"Start UTC","end_utc":"End UTC","max_alt_m":"Max alt m"})
                st.dataframe(show, hide_index=True, use_container_width=True)
                del_id = st.selectbox("Smazat track", show["Track ID"].tolist(), format_func=lambda x: f"Track ID {x}")
                if st.button("Smazat vybraný track", type="secondary", disabled=not is_admin(), use_container_width=True):
                    if require_admin(): delete_track(int(del_id)); st.success("Track smazán."); st.rerun()
            else:
                st.info("K letu zatím není připojený track.")
            uploaded = st.file_uploader("Přidat / nahradit KML track", type=["kml"], key=f"attach_track_{flight_id}")
            if uploaded is not None:
                try:
                    points = parse_kml_bytes(uploaded.read())
                    if len(points) >= 2:
                        preview = pd.DataFrame([{"id": -1,"flight_id": flight_id,"coordinates_json": json.dumps(points),"file_name": uploaded.name,"distance_km": track_stats(points)["distance_km"],"date": row.get("date"),"registration": row.get("registration"),"departure": row.get("departure"),"arrival": row.get("arrival"),"role": row.get("role"),"evidence": row.get("evidence")}])
                        st_folium(make_map(preview, dark_mode, line_weight=3.0, line_opacity=.75, show_endpoints=True), height=330, use_container_width=True, key=f"track_map_preview_{flight_id}_{uploaded.name}_{len(points)}")
                        render_track_profile(points)
                        replace = st.checkbox("Nahradit existující tracky u tohoto letu", value=True, key=f"replace_track_{flight_id}_{uploaded.name}")
                        if st.button("Uložit track k letu", type="primary", disabled=not is_admin(), use_container_width=True):
                            if require_admin(): save_track(flight_id, uploaded.name, points, replace_existing=replace); st.success("Track uložen."); st.rerun()
                    else: st.error("V KML nejsou použitelné body.")
                except Exception as exc:
                    st.error(f"KML / náhled se nepodařilo zpracovat: {exc}")
        with tabs[3]:
            st.warning("Tato akce trvale smaže let včetně všech připojených KML/GPS tracků. Po smazání proběhne automatická záloha databáze na GitHub, pokud je zapnutá.")
            st.write(f"Vybraný let: ID {flight_id} • {row.get('date')} • {row.get('registration')} • {row.get('departure')}–{row.get('arrival')}")
            confirm = st.text_input("Pro potvrzení napiš ID letu", key=f"delete_confirm_{flight_id}")
            if st.button("Trvale smazat let", disabled=not is_admin() or confirm.strip() != str(flight_id), type="primary", use_container_width=True):
                if require_admin():
                    delete_flight(flight_id)
                    st.success(f"Let ID {flight_id} byl smazán.")
                    clear_open_flight_dialog()
                    st.rerun()
        if st.button("Zavřít detail", use_container_width=True):
            clear_open_flight_dialog(); st.rerun()
    _dialog()


def page_logbook(df: pd.DataFrame, rates: pd.DataFrame, dark_mode: bool):
    st.markdown("## Lety")
    filtered = filter_controls(df, "log")
    s = build_summary(filtered)
    c1,c2,c3,c4 = st.columns(4)
    with c1: metric_card("Zobrazeno", str(s["flights"]), "letů")
    with c2: metric_card("Celkem", fmt_minutes(s["total"]), "block time")
    with c3: metric_card("PIC", fmt_minutes(s["pic"]), "z filtrovaných letů")
    with c4: metric_card("GPS", str(s["tracks"]), f"{s['gps_km']:.0f} km")
    table = filtered.sort_values(["date","off_block","id"], na_position="last").copy()
    render_flight_list(table, rates, dark_mode)


def page_new_flight(rates: pd.DataFrame, dark_mode: bool):
    st.markdown("## Přidat let")
    mode = st.radio("Způsob zadání", ["Ručně", "Z KML tracku"], horizontal=True)
    if mode == "Ručně":
        if not is_admin(): st.info("Pro ukládání se přihlas jako admin.")
        data = flight_form("new_manual", {}, rates)
        if data is not None and require_admin():
            fid = create_flight(data); st.success(f"Let uložen jako ID {fid}.")
    else:
        up = st.file_uploader("Nahraj KML", type=["kml"], key="new_kml_upload")
        if up is not None:
            points = parse_kml_bytes(up.read())
            if len(points) < 2:
                st.error("KML neobsahuje použitelný track."); return
            suggestion = suggest_flight_from_kml(up.name, points, rates)
            if not suggestion.get("has_clock"):
                st.warning("Track nemá dostatek časových/rychlostních dat. Časy doplň ručně.")
            st_folium(make_map(pd.DataFrame([{"coordinates_json": json.dumps(points), "date": suggestion.get("date"), "registration": suggestion.get("registration"), "departure": suggestion.get("departure"), "arrival": suggestion.get("arrival"), "role": suggestion.get("role"), "evidence": suggestion.get("evidence")}]), dark_mode, show_endpoints=True), height=390, use_container_width=True, key=f"new_kml_map_{up.name}_{len(points)}")
            render_track_profile(points)
            data = flight_form("new_from_kml", suggestion, rates, "Uložit let a připojit track")
            if data is not None and require_admin():
                fid = create_flight(data, auto_backup=False)
                save_track(fid, up.name, points, replace_existing=True)
                st.success(f"Let a track uloženy jako ID {fid}.")


def page_maps(df: pd.DataFrame, dark_mode: bool):
    st.markdown("## Mapa")
    tracks = read_tracks_joined()
    if tracks.empty:
        st.info("Zatím nejsou uloženy žádné GPS tracky."); return
    st_folium(make_map(tracks, dark_mode, line_weight=1.35, line_opacity=.38, show_endpoints=False), height=650, use_container_width=True, key="all_tracks_map")


def page_rates(rates: pd.DataFrame):
    st.markdown("## Ceník")
    st.dataframe(rates, hide_index=True, use_container_width=True)


def import_airports_from_df(df: pd.DataFrame, source: str = "ourairports") -> tuple[int, int]:
    inserted = 0; inactive = 0
    with connect() as con:
        for _, r in df.iterrows():
            ident = normalize_text(r.get("ident"))
            if not ident: continue
            typ = normalize_text(r.get("type"))
            active = 0 if typ == "closed" else 1
            inactive += 1 if not active else 0
            try:
                lat = float(r.get("latitude_deg")); lon = float(r.get("longitude_deg"))
            except Exception:
                continue
            con.execute("""
            INSERT INTO airports (ident, icao_code, iata_code, local_code, name, type, latitude_deg, longitude_deg, elevation_ft, continent, iso_country, iso_region, municipality, scheduled_service, gps_code, home_link, wikipedia_link, keywords, source, active, priority, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(ident) DO UPDATE SET
                icao_code=excluded.icao_code, iata_code=excluded.iata_code, local_code=excluded.local_code,
                name=excluded.name, type=excluded.type, latitude_deg=excluded.latitude_deg, longitude_deg=excluded.longitude_deg,
                elevation_ft=excluded.elevation_ft, continent=excluded.continent, iso_country=excluded.iso_country,
                iso_region=excluded.iso_region, municipality=excluded.municipality, scheduled_service=excluded.scheduled_service,
                gps_code=excluded.gps_code, home_link=excluded.home_link, wikipedia_link=excluded.wikipedia_link,
                keywords=excluded.keywords, source=excluded.source, active=excluded.active, priority=excluded.priority, updated_at=excluded.updated_at
            """, (ident, normalize_text(r.get("icao_code")), normalize_text(r.get("iata_code")), normalize_text(r.get("local_code")), normalize_text(r.get("name")), typ, lat, lon, r.get("elevation_ft"), normalize_text(r.get("continent")), normalize_text(r.get("iso_country")), normalize_text(r.get("iso_region")), normalize_text(r.get("municipality")), normalize_text(r.get("scheduled_service")), normalize_text(r.get("gps_code")), normalize_text(r.get("home_link")), normalize_text(r.get("wikipedia_link")), normalize_text(r.get("keywords")), source, active, 0, _now_iso()))
            inserted += 1
        record_audit(con, "import_airports", "airports", None, {"rows": inserted, "source": source})
        con.commit()
    auto_backup_after_change("import_airports")
    return inserted, inactive


def page_database():
    st.markdown("## Databáze")
    tabs = st.tabs(["Letiště", "Letadla", "Záloha", "Meta"])
    with tabs[0]:
        airports = read_airports()
        q = st.text_input("Hledat letiště", placeholder="LKSZ, Sazená, Kaplice...")
        view = airports
        if q:
            qq = q.lower()
            view = view[view.astype(str).apply(lambda col: col.str.lower().str.contains(qq, na=False)).any(axis=1)]
        st.write(f"Letišť v databázi: {len(airports)}")
        st.dataframe(view.head(1000), hide_index=True, use_container_width=True)
        st.download_button("Export letišť CSV", data=airports.to_csv(index=False).encode("utf-8-sig"), file_name="airports_export.csv", mime="text/csv")
        if is_admin():
            with st.expander("Ručně přidat / opravit letiště"):
                c1,c2,c3 = st.columns(3)
                ident = c1.text_input("Ident").upper()
                name = c2.text_input("Název")
                typ = c3.text_input("Typ", value="small_airport")
                lat = st.number_input("Latitude", format="%.6f")
                lon = st.number_input("Longitude", format="%.6f")
                note = st.text_area("Poznámka")
                if st.button("Uložit letiště"):
                    with connect() as con:
                        con.execute("INSERT OR REPLACE INTO airports (ident, name, type, latitude_deg, longitude_deg, source, active, priority, note, updated_at) VALUES (?, ?, ?, ?, ?, 'manual', 1, 200, ?, ?)", (ident, name, typ, lat, lon, note, _now_iso()))
                        record_audit(con, "upsert_airport", "airports", ident, None); con.commit()
                    auto_backup_after_change("upsert_airport"); st.success("Letiště uloženo.")
    with tabs[1]:
        aircraft = read_table("aircraft")
        st.dataframe(aircraft, hide_index=True, use_container_width=True)
        if is_admin():
            with st.expander("Ručně přidat / opravit letadlo"):
                with st.form("aircraft_form"):
                    c1,c2,c3,c4 = st.columns(4)
                    reg = c1.text_input("Registrace")
                    typ = c2.text_input("Typ")
                    cls = c3.selectbox("Třída", CLASS_OPTIONS)
                    ev = c4.selectbox("Evidence", EVIDENCE_OPTIONS)
                    price = st.number_input("Výchozí Kč/h", min_value=0.0, step=10.0)
                    note = st.text_area("Poznámka")
                    if st.form_submit_button("Uložit letadlo"):
                        with connect() as con:
                            con.execute("INSERT OR REPLACE INTO aircraft (registration, aircraft_type, aircraft_class, evidence, default_price_per_hour, active, note, updated_at) VALUES (?, ?, ?, ?, ?, 1, ?, ?)", (reg.upper(), typ, cls, ev, price, note, _now_iso()))
                            record_audit(con, "upsert_aircraft", "aircraft", reg, None); con.commit()
                        auto_backup_after_change("upsert_aircraft"); st.success("Letadlo uloženo."); st.rerun()
    with tabs[2]:
        dirty = get_meta("dirty", "0") == "1"; last = get_meta("last_github_backup", "")
        st.write(f"Stav databáze: {'čeká na zálohu' if dirty else 'zálohováno / čisté'}")
        st.write(f"Poslední GitHub záloha: {last or '—'}")
        if DB_PATH.exists():
            st.download_button("Stáhnout SQLite databázi", data=DB_PATH.read_bytes(), file_name="logbook.sqlite", mime="application/octet-stream")
        uploaded_db = st.file_uploader("Obnovit databázi ze souboru SQLite", type=["sqlite", "db"], disabled=not is_admin())
        if uploaded_db is not None and is_admin():
            if st.button("Obnovit databázi", type="primary"):
                backup = DB_PATH.with_suffix(".sqlite.before_restore")
                if DB_PATH.exists(): shutil.copy2(DB_PATH, backup)
                DB_PATH.write_bytes(uploaded_db.read()); clear_data_cache(); auto_backup_after_change("restore_database"); st.success("Databáze obnovena."); st.rerun()
        if st.button("Uložit aktuální databázi na GitHub", disabled=not is_admin(), use_container_width=True):
            if require_admin():
                ok, msg = backup_database_to_github(auto=False); (st.success if ok else st.error)(msg)
    with tabs[3]:
        st.dataframe(read_table("app_meta"), hide_index=True, use_container_width=True)
        st.dataframe(read_table("audit_log").tail(100), hide_index=True, use_container_width=True)


def make_control_df(df: pd.DataFrame) -> pd.DataFrame:
    rows=[]
    for _, r in df.iterrows():
        issues=[]
        for col,label in [("date","datum"),("registration","registrace"),("departure","odlet"),("arrival","přílet"),("role","funkce")]:
            if not r.get(col): issues.append(label)
        if r.get("starts", 0) <= 0: issues.append("starty")
        if r.get("block_minutes") is None or pd.isna(r.get("block_minutes")): issues.append("block time")
        if r.get("air_minutes") is None or pd.isna(r.get("air_minutes")): issues.append("air time")
        if pd.notna(r.get("air_minutes")) and pd.notna(r.get("block_minutes")) and r["air_minutes"] > r["block_minutes"]: issues.append("air > block")
        if pd.isna(r.get("price_per_hour")) or float(r.get("price_per_hour") or 0) <= 0: issues.append("sazba")
        if issues:
            rows.append({"ID": r.get("id"), "Datum": r.get("date"), "Imatrikulace": r.get("registration"), "Problém": ", ".join(issues)})
    return pd.DataFrame(rows)


def page_control(df: pd.DataFrame):
    st.markdown("## Kontrola")
    control = make_control_df(df)
    if control.empty:
        st.success("OK")
    else:
        st.dataframe(control, hide_index=True, use_container_width=True)


def export_excel(df: pd.DataFrame) -> bytes:
    wb = Workbook(); ws = wb.active; ws.title = "Zápisník letů"
    headers = ["Datum","Evidence","Imatrikulace","Typ","Třída","Odlet","Přílet","Off Block","Takeoff","Landing","On Block","Block Time","Air Time","Starty","Velitel","Instruktor","Funkce","Úloha","Cena Kč/h","Cena letu Kč","GPS tracky","GPS km","Poznámka"]
    ws.append(headers)
    work = df.sort_values(["date_dt","id"]).copy()
    for _, r in work.iterrows():
        ws.append([r.get("date"), r.get("evidence"), r.get("registration"), r.get("aircraft_type"), r.get("aircraft_class"), r.get("departure"), r.get("arrival"), r.get("off_block"), r.get("takeoff"), r.get("landing"), r.get("on_block"), fmt_minutes(r.get("block_minutes")), fmt_minutes(r.get("air_minutes")), int(r.get("starts") or 0), r.get("commander"), r.get("instructor"), r.get("role"), r.get("task"), float(r.get("price_per_hour") or 0), float(r.get("cost") or 0), int(r.get("track_count") or 0), float(r.get("gps_km") or 0), r.get("note")])
    style_worksheet(ws)
    ws2 = wb.create_sheet("Souhrny")
    summary = build_summary(df)
    rows = [["Metrika","Hodnota"],["Celkový nálet",fmt_minutes(summary["total"])],["Air Time",fmt_minutes(summary["air"])],["PIC celkem",fmt_minutes(summary["pic"])],["PIC ULL",fmt_minutes(summary["pic_ull"])],["PIC EASA",fmt_minutes(summary["pic_easa"])],["DUAL",fmt_minutes(summary["dual"])],["Safety Pilot",fmt_minutes(summary["safety"])],["ULL celkem",fmt_minutes(summary["ull"])],["EASA celkem",fmt_minutes(summary["easa"])],["Starty",summary["starts"]],["GPS tracky",summary["tracks"]],["GPS km",summary["gps_km"]],["Náklady",summary["cost"]]]
    for row in rows: ws2.append(row)
    style_worksheet(ws2)
    out = BytesIO(); wb.save(out); return out.getvalue()


def style_worksheet(ws):
    header_fill = PatternFill("solid", fgColor="0F172A"); header_font = Font(color="FFFFFF", bold=True); thin = Side(style="thin", color="D1D5DB")
    for cell in ws[1]:
        cell.fill = header_fill; cell.font = header_font; cell.alignment = Alignment(horizontal="center", vertical="center"); cell.border = Border(bottom=thin)
    ws.freeze_panes = "A2"; ws.auto_filter.ref = ws.dimensions
    for col in range(1, ws.max_column + 1):
        letter = get_column_letter(col); max_len = max(len(str(ws.cell(row, col).value or "")) for row in range(1, min(ws.max_row, 200) + 1)); ws.column_dimensions[letter].width = min(max(max_len + 2, 10), 26)


def page_export(df: pd.DataFrame):
    st.markdown("## Export")
    output = export_excel(df)
    c1, c2 = st.columns(2)
    with c1: st.download_button("Stáhnout Excel export", data=output, file_name="export_letovy_zapisnik.xlsx", mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", type="primary", use_container_width=True)
    with c2:
        with open(DB_PATH, "rb") as f:
            st.download_button("Stáhnout SQLite databázi", f.read(), file_name="logbook.sqlite", use_container_width=True)

# -----------------------------------------------------------------------------
# Main
# -----------------------------------------------------------------------------

def render_custom_sidebar() -> None:
    collapsed = bool(st.session_state.get("custom_sidebar_collapsed", False))
    if collapsed:
        st.markdown('<div class="custom-sidebar-rail">', unsafe_allow_html=True)
        if st.button("Menu", key="show_custom_sidebar", use_container_width=True):
            st.session_state["custom_sidebar_collapsed"] = False
            st.rerun()
        st.markdown(f'<div class="sidebar-version" style="text-align:center;margin-top:.65rem;">{APP_VERSION}</div>', unsafe_allow_html=True)
        st.markdown('</div>', unsafe_allow_html=True)
        return

    st.markdown('<div class="custom-sidebar-panel">', unsafe_allow_html=True)
    c1, c2 = st.columns([1, .55])
    with c1:
        st.markdown('<div class="custom-sidebar-title">Letový zápisník</div>', unsafe_allow_html=True)
        st.markdown(f'<div class="sidebar-version">{APP_VERSION}</div>', unsafe_allow_html=True)
    with c2:
        if st.button("Skrýt", key="hide_custom_sidebar", use_container_width=True):
            st.session_state["custom_sidebar_collapsed"] = True
            st.rerun()
    st.markdown('<div class="custom-sidebar-label">Navigace</div>', unsafe_allow_html=True)
    render_sidebar_nav()
    render_auth_sidebar()
    st.markdown('</div>', unsafe_allow_html=True)


def render_current_page(page: str, flights: pd.DataFrame, rates: pd.DataFrame, dark_mode: bool) -> None:
    app_header()
    if page == "Dashboard":
        page_dashboard(flights)
    elif page == "Lety":
        page_logbook(flights, rates, dark_mode)
    elif page == "Nový let":
        page_new_flight(rates, dark_mode)
    elif page == "Mapa":
        page_maps(flights, dark_mode)
    elif page == "Ceník":
        page_rates(rates)
    elif page == "Databáze":
        page_database()
    elif page == "Kontrola":
        st.session_state["page"] = "Dashboard"
        st.rerun()
    elif page == "Export":
        page_export(flights)


def main():
    st.set_page_config(page_title="Letový zápisník", layout="wide", initial_sidebar_state="collapsed")
    dark_mode = True
    apply_ui_theme(dark_mode)
    with connect():
        pass
    if "page" not in st.session_state:
        st.session_state["page"] = "Dashboard"
    if "custom_sidebar_collapsed" not in st.session_state:
        st.session_state["custom_sidebar_collapsed"] = False

    page = st.session_state.get("page", "Dashboard")
    flights = read_flights()
    rates = read_table("rates")
    if not rates.empty:
        rates["registration"] = rates["registration"].fillna("").str.upper()

    collapsed = bool(st.session_state.get("custom_sidebar_collapsed", False))
    nav_width = 0.075 if collapsed else 0.19
    content_width = 1 - nav_width
    nav_col, content_col = st.columns([nav_width, content_width], gap="large")
    with nav_col:
        render_custom_sidebar()
    with content_col:
        render_current_page(page, flights, rates, dark_mode)

if __name__ == "__main__":
    main()
