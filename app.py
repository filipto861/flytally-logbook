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
except Exception:  # pragma: no cover
    requests = None

BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / "data" / "logbook.sqlite"
APP_VERSION = "v0.22"
LOCAL_TZ = ZoneInfo("Europe/Prague")

EVIDENCE_OPTIONS = ["ULL", "EASA"]
CLASS_OPTIONS = ["ULL", "SEP", "TMG", "MEP", "SET", "OTHER", "GLIDER"]
ROLE_OPTIONS = ["PIC", "DUAL", "INSTRUKTOR", "SAFETY PILOT", "CO-PILOT", "PAX", "OBSERVER"]

SCHEMA = """
PRAGMA foreign_keys = ON;
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
CREATE TABLE IF NOT EXISTS app_meta (
    key TEXT PRIMARY KEY,
    value TEXT,
    updated_at TEXT
);
CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at TEXT NOT NULL,
    user TEXT,
    action TEXT,
    entity TEXT,
    entity_id TEXT,
    detail TEXT
);
CREATE INDEX IF NOT EXISTS idx_flights_date ON flights(date);
CREATE INDEX IF NOT EXISTS idx_flights_registration ON flights(registration);
CREATE INDEX IF NOT EXISTS idx_track_points_track_seq ON track_points(track_id, seq);
CREATE INDEX IF NOT EXISTS idx_airports_ident ON airports(ident);
CREATE INDEX IF NOT EXISTS idx_airports_country ON airports(iso_country);
CREATE INDEX IF NOT EXISTS idx_airports_active ON airports(active);
"""

# -----------------------------------------------------------------------------
# Database
# -----------------------------------------------------------------------------

def now_utc_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def connect() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    con = sqlite3.connect(DB_PATH)
    con.row_factory = sqlite3.Row
    con.executescript(SCHEMA)
    migrate_database(con)
    return con


def table_columns(con: sqlite3.Connection, table: str) -> set[str]:
    return {row[1] for row in con.execute(f"PRAGMA table_info({table})").fetchall()}


def add_column_if_missing(con: sqlite3.Connection, table: str, column: str, ddl: str) -> None:
    if column not in table_columns(con, table):
        con.execute(f"ALTER TABLE {table} ADD COLUMN {ddl}")


def migrate_database(con: sqlite3.Connection) -> None:
    # Add fields in old databases without losing data.
    add_column_if_missing(con, "flight_tracks", "min_alt_m", "min_alt_m REAL")
    add_column_if_missing(con, "flight_tracks", "max_alt_m", "max_alt_m REAL")
    add_column_if_missing(con, "flights", "note", "note TEXT")
    con.execute("INSERT OR REPLACE INTO app_meta (key, value, updated_at) VALUES (?, ?, ?)", ("schema_version", "3", now_utc_iso()))
    # Normalize old track blobs to point rows when missing.
    rows = con.execute("SELECT id, coordinates_json FROM flight_tracks WHERE id NOT IN (SELECT DISTINCT track_id FROM track_points)").fetchall()
    for r in rows:
        try:
            points = json.loads(r["coordinates_json"] or "[]")
        except Exception:
            points = []
        for i, p in enumerate(points):
            con.execute(
                "INSERT OR IGNORE INTO track_points (track_id, seq, timestamp_utc, latitude, longitude, altitude_m, speed_kmh) VALUES (?, ?, ?, ?, ?, ?, ?)",
                (r["id"], i, p.get("time"), p.get("lat"), p.get("lon"), p.get("alt"), p.get("speed_kmh")),
            )
    con.commit()


def log_action(action: str, entity: str, entity_id: Any = None, detail: str = "") -> None:
    try:
        with connect() as con:
            con.execute(
                "INSERT INTO audit_log (created_at, user, action, entity, entity_id, detail) VALUES (?, ?, ?, ?, ?, ?)",
                (now_utc_iso(), "admin" if is_admin() else "viewer", action, entity, str(entity_id) if entity_id is not None else None, detail),
            )
            con.commit()
    except Exception:
        pass


def mark_dirty(reason: str = "") -> None:
    try:
        with connect() as con:
            con.execute("INSERT OR REPLACE INTO app_meta (key, value, updated_at) VALUES (?, ?, ?)", ("dirty", "1", now_utc_iso()))
            con.execute("INSERT OR REPLACE INTO app_meta (key, value, updated_at) VALUES (?, ?, ?)", ("dirty_reason", reason, now_utc_iso()))
            con.commit()
    except Exception:
        pass


def mark_clean() -> None:
    with connect() as con:
        con.execute("INSERT OR REPLACE INTO app_meta (key, value, updated_at) VALUES (?, ?, ?)", ("dirty", "0", now_utc_iso()))
        con.commit()


def get_meta(key: str, default: str = "") -> str:
    try:
        with connect() as con:
            row = con.execute("SELECT value FROM app_meta WHERE key = ?", (key,)).fetchone()
            return row["value"] if row else default
    except Exception:
        return default


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


def after_write(action: str, entity: str, entity_id: Any = None, detail: str = "", backup: bool = True) -> None:
    log_action(action, entity, entity_id, detail)
    mark_dirty(f"{action} {entity} {entity_id or ''}".strip())
    clear_data_cache()
    if backup and is_admin():
        ok, msg = github_backup_database(auto=True)
        st.session_state["last_backup_status"] = (ok, msg)


def read_track_counts() -> pd.DataFrame:
    with connect() as con:
        return pd.read_sql_query(
            """
            SELECT flight_id, COUNT(*) AS track_count, COALESCE(SUM(distance_km), 0) AS gps_km
            FROM flight_tracks GROUP BY flight_id
            """,
            con,
        )


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
        return pd.read_sql_query(
            """
            SELECT t.*, f.date, f.evidence, f.registration, f.aircraft_type, f.aircraft_class,
                   f.departure, f.arrival, f.off_block, f.takeoff, f.landing, f.on_block,
                   f.role, f.starts, f.task, f.commander
            FROM flight_tracks t
            JOIN flights f ON f.id = t.flight_id
            ORDER BY f.date, f.off_block, t.id
            """,
            con,
        )


def read_tracks_for_flight(flight_id: int) -> pd.DataFrame:
    with connect() as con:
        return pd.read_sql_query("SELECT * FROM flight_tracks WHERE flight_id = ? ORDER BY id", con, params=(flight_id,))


def read_airports(active_only: bool = False) -> pd.DataFrame:
    with connect() as con:
        where = "WHERE active = 1" if active_only else ""
        return pd.read_sql_query(f"SELECT * FROM airports {where} ORDER BY priority DESC, ident", con)


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


def fmt_money(value: float | int | None) -> str:
    if value is None or pd.isna(value):
        return ""
    return f"{float(value):,.0f} Kč".replace(",", " ")


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
# Authentication / GitHub backup
# -----------------------------------------------------------------------------

def get_secret(path: tuple[str, ...], default: Any = None) -> Any:
    cur: Any = st.secrets
    try:
        for part in path:
            cur = cur[part]
        return cur
    except Exception:
        return default


def configured_admin_password() -> str | None:
    return get_secret(("auth", "admin_password"), None)


def is_admin() -> bool:
    return bool(st.session_state.get("is_admin", False))


def require_admin() -> bool:
    if is_admin():
        return True
    st.error("Tato akce je dostupná pouze v admin režimu.")
    return False


def github_config() -> dict[str, Any]:
    return {
        "token": get_secret(("github", "token"), ""),
        "repo": get_secret(("github", "repo"), "filipto861/Logbook"),
        "db_path": get_secret(("github", "db_path"), "data/logbook.sqlite"),
        "branch": get_secret(("github", "branch"), "main"),
        "auto_backup": bool(get_secret(("github", "auto_backup"), False)),
    }


def github_backup_database(auto: bool = False) -> tuple[bool, str]:
    cfg = github_config()
    if auto and not cfg["auto_backup"]:
        return False, "Automatická GitHub záloha je vypnutá."
    if not cfg["token"]:
        return False, "GitHub token není nastavený ve Streamlit Secrets."
    if requests is None:
        return False, "Knihovna requests není dostupná."
    if not DB_PATH.exists():
        return False, "Soubor databáze neexistuje."

    repo = cfg["repo"]
    path = cfg["db_path"]
    branch = cfg["branch"]
    url = f"https://api.github.com/repos/{repo}/contents/{path}"
    headers = {"Authorization": f"Bearer {cfg['token']}", "Accept": "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28"}
    try:
        get_resp = requests.get(url, headers=headers, params={"ref": branch}, timeout=20)
        sha = None
        if get_resp.status_code == 200:
            sha = get_resp.json().get("sha")
        elif get_resp.status_code not in (404,):
            return False, f"GitHub načtení selhalo: {get_resp.status_code} {get_resp.text[:200]}"
        content_b64 = base64.b64encode(DB_PATH.read_bytes()).decode("ascii")
        now_local = datetime.now(LOCAL_TZ).strftime("%Y-%m-%d %H:%M:%S")
        message = f"Backup logbook database {now_local}"
        payload = {"message": message, "content": content_b64, "branch": branch}
        if sha:
            payload["sha"] = sha
        put_resp = requests.put(url, headers=headers, json=payload, timeout=40)
        if put_resp.status_code not in (200, 201):
            return False, f"GitHub uložení selhalo: {put_resp.status_code} {put_resp.text[:250]}"
        mark_clean()
        with connect() as con:
            con.execute("INSERT OR REPLACE INTO app_meta (key, value, updated_at) VALUES (?, ?, ?)", ("last_github_backup", now_local, now_utc_iso()))
            con.commit()
        return True, f"Databáze byla uložena na GitHub ({now_local})."
    except Exception as exc:
        return False, f"GitHub záloha selhala: {exc}"

# -----------------------------------------------------------------------------
# UI style
# -----------------------------------------------------------------------------

def apply_ui_theme(dark_mode: bool = True) -> None:
    bg = "#06101d"; panel = "#0b182a"; panel2 = "#10233a"; text = "#e6f0fb"; muted = "#92a8c0"; border = "rgba(125,211,252,.18)"; accent = "#38bdf8"; shadow = "rgba(0,0,0,.40)"
    st.markdown(f"""
    <style>
    :root {{--bg:{bg};--panel:{panel};--panel2:{panel2};--text:{text};--muted:{muted};--border:{border};--accent:{accent};--shadow:{shadow};}}
    /* Keep the Streamlit collapsed-sidebar control visible, but hide the rest of the chrome. */
    header[data-testid="stHeader"] {{background:transparent !important; height:2.15rem !important; min-height:2.15rem !important; pointer-events:none !important;}}
    header[data-testid="stHeader"] * {{pointer-events:auto !important;}}
    div[data-testid="stToolbar"], div[data-testid="stDecoration"], div[data-testid="stStatusWidget"], #MainMenu, footer {{display:none !important; visibility:hidden !important; height:0 !important;}}
    .stDeployButton {{display:none !important;}}
    [data-testid="collapsedControl"] {{display:flex !important; visibility:visible !important; opacity:1 !important; pointer-events:auto !important;}}
    [data-testid="stAppViewContainer"] > .main {{padding-top:0 !important;}}
    [data-testid="stAppViewContainer"] .main .block-container {{padding-top:0 !important; margin-top:0 !important;}}
    .stApp {{background: radial-gradient(circle at 16% 10%, rgba(56,189,248,.14), transparent 24%), radial-gradient(circle at 88% 3%, rgba(34,197,94,.06), transparent 26%), var(--bg); color:var(--text);}}
    [data-testid="stSidebar"] {{background: linear-gradient(180deg, rgba(11,24,42,.98), rgba(6,16,29,.98)); border-right:1px solid var(--border);}}
    [data-testid="stSidebar"] * {{color:#e6f0fb;}}
    .block-container {{padding-top:0 !important; padding-bottom:3rem; max-width:1500px;}}
    h1,h2,h3 {{letter-spacing:-.025em;}}
    .app-title {{display:flex;align-items:center;justify-content:space-between;gap:1rem;padding:1.05rem 1.25rem;border:1px solid var(--border);background:linear-gradient(135deg,rgba(56,189,248,.14),rgba(15,23,42,.04)),var(--panel);border-radius:20px;box-shadow:0 16px 38px var(--shadow);margin-bottom:1rem;}}
    .app-title-main {{font-size:1.55rem;font-weight:850;color:var(--text);line-height:1.1;}}
    .app-title-sub {{font-size:.86rem;color:var(--muted);margin-top:.18rem;}}
    .app-badge {{font-size:.78rem;font-weight:800;color:#031421;background:linear-gradient(135deg,var(--accent),#a7f3d0);border-radius:999px;padding:.38rem .72rem;white-space:nowrap;}}
    .metric-card {{border:1px solid var(--border);border-radius:18px;padding:1rem 1.05rem;background:linear-gradient(180deg,rgba(255,255,255,.04),transparent),var(--panel);box-shadow:0 12px 30px var(--shadow);min-height:108px;}}
    .metric-label {{color:var(--muted);font-size:.75rem;text-transform:uppercase;letter-spacing:.08em;font-weight:800;}}
    .metric-value {{color:var(--text);font-size:1.72rem;line-height:1.25;font-weight:850;margin-top:.25rem;}}
    .metric-sub {{color:var(--muted);font-size:.82rem;margin-top:.28rem;}}
    .section-card {{border:1px solid var(--border);border-radius:18px;padding:1rem;background:var(--panel);box-shadow:0 10px 28px var(--shadow);}}
    div[data-testid="stDataFrame"], div[data-testid="stDataEditor"] {{border-radius:16px;overflow:hidden;}}
    button[kind="primary"] {{border-radius:12px;}}
    .nav-button button {{height:2.7rem;border-radius:14px;border:1px solid var(--border);background:var(--panel);font-weight:800;}}
    .nav-active button {{background:linear-gradient(135deg,#38bdf8,#0ea5e9) !important;color:#031421 !important;border-color:rgba(56,189,248,.8) !important;}}
    .sidebar-version {{font-size:.75rem;color:#93a4bb;margin:.2rem 0 1rem 0;}}
    .flight-list-head {{color:#9ec7ee;font-size:.74rem;text-transform:uppercase;letter-spacing:.08em;font-weight:850;border-bottom:1px solid rgba(148,163,184,.22);padding:.35rem .1rem .45rem;}}
    .flight-list-cell {{font-size:.82rem;font-weight:760;line-height:1.16;color:#f8fafc;padding:.12rem .1rem;word-break:break-word;}}
    .flight-list-sub {{font-size:.70rem;color:#8fb3d9;font-weight:500;margin-top:.10rem;}}
    .flight-row-sep {{height:1px;background:rgba(148,163,184,.10);margin:.38rem 0 .42rem;}}
    .flight-list-note {{font-size:.82rem;color:#92a8c0;margin:.15rem 0 .55rem;}}
    .danger-box {{border:1px solid rgba(248,113,113,.45);background:rgba(127,29,29,.18);border-radius:16px;padding:1rem;margin:.5rem 0 1rem 0;}}
    .danger-title {{font-size:.92rem;font-weight:850;color:#fecaca;margin-bottom:.25rem;}}
    .danger-text {{font-size:.82rem;color:#fca5a5;line-height:1.35;}}
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


def nav_button(label: str, target: str, current: str) -> None:
    klass = "nav-button nav-active" if current == target else "nav-button"
    with st.sidebar.container():
        st.markdown(f'<div class="{klass}">', unsafe_allow_html=True)
        if st.button(label, key=f"nav_{target}", use_container_width=True):
            st.session_state["page"] = target
            st.rerun()
        st.markdown('</div>', unsafe_allow_html=True)


def plotly_layout(fig):
    fig.update_layout(template="plotly_dark", paper_bgcolor="rgba(0,0,0,0)", plot_bgcolor="rgba(0,0,0,0)", font=dict(color="#e5edf7"), margin=dict(l=10, r=10, t=45, b=10), legend=dict(orientation="h", yanchor="bottom", y=1.02, xanchor="right", x=1))
    fig.update_xaxes(gridcolor="rgba(148,163,184,.18)")
    fig.update_yaxes(gridcolor="rgba(148,163,184,.18)")
    return fig

# -----------------------------------------------------------------------------
# Filters and summaries
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


def build_summary(df: pd.DataFrame) -> dict[str, int | float]:
    if df.empty:
        return {"flights":0,"starts":0,"total":0,"air":0,"pic":0,"pic_ull":0,"pic_easa":0,"dual":0,"safety":0,"ull":0,"easa":0,"cost":0.0,"tracks":0,"gps_km":0.0}
    return {
        "flights": int(len(df)),
        "starts": int(df["starts"].sum()),
        "total": int(df["block_minutes"].fillna(0).sum()),
        "air": int(df["air_minutes"].fillna(0).sum()),
        "pic": stat_minutes(df, df["role"].eq("PIC")),
        "pic_ull": stat_minutes(df, df["role"].eq("PIC") & df["evidence"].eq("ULL")),
        "pic_easa": stat_minutes(df, df["role"].eq("PIC") & df["evidence"].eq("EASA")),
        "dual": stat_minutes(df, df["role"].eq("DUAL")),
        "safety": stat_minutes(df, df["role"].eq("SAFETY PILOT")),
        "ull": stat_minutes(df, df["evidence"].eq("ULL")),
        "easa": stat_minutes(df, df["evidence"].eq("EASA")),
        "cost": float(df["cost"].fillna(0).sum()),
        "tracks": int(df.get("track_count", pd.Series(dtype=int)).fillna(0).sum()) if "track_count" in df else 0,
        "gps_km": float(df.get("gps_km", pd.Series(dtype=float)).fillna(0).sum()) if "gps_km" in df else 0.0,
    }

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
    except ValueError:
        return None


def normalize_track_points(points: list[dict[str, Any]]) -> list[dict[str, Any]]:
    cleaned = []
    for p in points:
        try:
            lat = float(p["lat"]); lon = float(p["lon"])
        except Exception:
            continue
        if not (-90 <= lat <= 90 and -180 <= lon <= 180):
            continue
        alt = p.get("alt")
        try:
            alt = None if alt is None else float(alt)
        except Exception:
            alt = None
        raw_time = p.get("time")
        dt = parse_iso(raw_time) if raw_time else None
        cleaned.append({"lat": lat, "lon": lon, "alt": alt, "time": dt.isoformat().replace("+00:00", "Z") if dt else None})
    with_time = [p for p in cleaned if p.get("time")]
    if with_time and len(with_time) == len(cleaned):
        cleaned.sort(key=lambda p: parse_iso(p.get("time")) or datetime.min.replace(tzinfo=timezone.utc))
    return cleaned


def parse_kml_bytes(data: bytes) -> list[dict[str, Any]]:
    root = ET.fromstring(data)
    points: list[dict[str, Any]] = []

    # gx:Track / Track: interleaved when + gx:coord entries.
    for track in root.iter():
        if local_name(track.tag).lower() != "track":
            continue
        whens = []
        coords = []
        for child in list(track):
            name = local_name(child.tag).lower()
            if name == "when":
                whens.append((child.text or "").strip())
            elif name == "coord":
                coords.append((child.text or "").strip())
        if coords:
            for i, coord in enumerate(coords):
                parts = coord.split()
                if len(parts) < 2:
                    continue
                try:
                    lon = float(parts[0]); lat = float(parts[1]); alt = float(parts[2]) if len(parts) >= 3 else None
                except ValueError:
                    continue
                if -90 <= lat <= 90 and -180 <= lon <= 180:
                    points.append({"lat": lat, "lon": lon, "alt": alt, "time": whens[i] if i < len(whens) else None})
    if points:
        return normalize_track_points(points)

    # Placemark/Point style with timestamp and coordinates.
    for placemark in root.iter():
        if local_name(placemark.tag).lower() != "placemark":
            continue
        when = None
        coord_text = None
        for elem in placemark.iter():
            lname = local_name(elem.tag).lower()
            if lname == "when":
                when = (elem.text or "").strip()
            elif lname == "coordinates" and coord_text is None:
                coord_text = (elem.text or "").strip()
        if not coord_text:
            continue
        token = coord_text.replace("\n", " ").split()[0]
        parts = token.split(",")
        if len(parts) < 2:
            continue
        try:
            lon = float(parts[0]); lat = float(parts[1]); alt = float(parts[2]) if len(parts) >= 3 and parts[2] else None
        except ValueError:
            continue
        if -90 <= lat <= 90 and -180 <= lon <= 180:
            points.append({"lat": lat, "lon": lon, "alt": alt, "time": when})
    if points:
        return normalize_track_points(points)

    # Fallback: plain LineString coordinates usually do not contain per-point times.
    for elem in root.iter():
        if local_name(elem.tag) != "coordinates":
            continue
        text = (elem.text or "").strip()
        for token in text.replace("\n", " ").replace("\t", " ").split():
            parts = token.split(",")
            if len(parts) < 2:
                continue
            try:
                lon = float(parts[0]); lat = float(parts[1]); alt = float(parts[2]) if len(parts) >= 3 and parts[2] else None
            except ValueError:
                continue
            if -90 <= lat <= 90 and -180 <= lon <= 180:
                points.append({"lat": lat, "lon": lon, "alt": alt, "time": None})
    return normalize_track_points(points)


def haversine_km(a: dict[str, Any], b: dict[str, Any]) -> float:
    r = 6371.0088
    lat1 = math.radians(float(a["lat"])); lat2 = math.radians(float(b["lat"]))
    dlat = lat2 - lat1; dlon = math.radians(float(b["lon"]) - float(a["lon"]))
    h = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    return 2 * r * math.asin(math.sqrt(h))


def track_distance_km(points: list[dict[str, Any]]) -> float:
    if len(points) < 2:
        return 0.0
    return sum(haversine_km(a, b) for a, b in zip(points[:-1], points[1:]))


def track_stats(points: list[dict[str, Any]]) -> dict[str, Any]:
    times = [p.get("time") for p in points if p.get("time")]
    alts = [float(p["alt"]) for p in points if p.get("alt") is not None and float(p.get("alt") or 0) != 0]
    return {
        "point_count": len(points),
        "distance_km": track_distance_km(points),
        "start_utc": times[0] if times else None,
        "end_utc": times[-1] if times else None,
        "min_alt_m": min(alts) if alts else None,
        "max_alt_m": max(alts) if alts else None,
    }


def profile_from_points(points: list[dict[str, Any]], tz: ZoneInfo = LOCAL_TZ) -> pd.DataFrame:
    points = normalize_track_points(points)
    rows = []
    cum = 0.0
    prev = None
    prev_dt = None
    for i, p in enumerate(points):
        dt_utc = parse_iso(p.get("time"))
        dt_local = dt_utc.astimezone(tz) if dt_utc else None
        seg_km = haversine_km(prev, p) if prev is not None else 0.0
        cum += seg_km

        # Prefer speed already present in a future/imported JSON, otherwise compute
        # groundspeed from distance and timestamps. This keeps old and new tracks
        # compatible and fixes KML files exported in reverse chronological order.
        speed = None
        for key in ("speed_kmh", "gps_speed_kmh", "speed"):
            raw = p.get(key)
            if raw is not None:
                try:
                    speed = float(raw)
                    break
                except (TypeError, ValueError):
                    pass
        if speed is None and prev is not None and dt_utc is not None and prev_dt is not None:
            seconds = (dt_utc - prev_dt).total_seconds()
            if seconds > 0:
                speed = seg_km / (seconds / 3600)
                # Reject impossible spikes from malformed KML/timestamp jumps.
                if speed > 900:
                    speed = None

        alt_m = None if p.get("alt") is None else float(p.get("alt"))
        rows.append({
            "idx": i,
            "time_utc": dt_utc,
            "time_local": dt_local,
            "lat": float(p["lat"]),
            "lon": float(p["lon"]),
            "alt_m": alt_m,
            "alt_ft": alt_m * 3.28084 if alt_m is not None else None,
            "seg_km": seg_km,
            "distance_km": cum,
            "speed_kmh": speed,
        })
        prev = p
        prev_dt = dt_utc
    df = pd.DataFrame(rows)
    if not df.empty:
        speed_series = pd.to_numeric(df["speed_kmh"], errors="coerce")
        if speed_series.notna().any():
            df["speed_smooth"] = speed_series.interpolate(limit_direction="both").rolling(5, min_periods=1, center=True).median()
        else:
            df["speed_smooth"] = pd.NA
    return df


def clock_times_from_detection(points: list[dict[str, Any]]) -> tuple[dict[str, str | None], bool, dict[str, int]]:
    prof = profile_from_points(points)
    if prof.empty or prof["time_local"].isna().all():
        return {"off_block": None, "takeoff": None, "landing": None, "on_block": None}, False, {"off_idx": 0, "takeoff_idx": 0, "landing_idx": max(0, len(points)-1), "on_idx": max(0, len(points)-1)}
    speed = pd.to_numeric(prof.get("speed_smooth"), errors="coerce").fillna(0)
    alt = pd.to_numeric(prof.get("alt_m"), errors="coerce")
    use_speed = speed.max() > 35
    airborne = speed > 45 if use_speed else alt > (alt.quantile(0.05) + 45 if alt.notna().any() else 50)
    if not airborne.any():
        take_idx = 0; land_idx = len(prof) - 1
        has = False
    else:
        idxs = prof.index[airborne].tolist()
        take_idx = int(idxs[0]); land_idx = int(idxs[-1]); has = True
    def time_at(idx: int) -> datetime | None:
        t = prof.iloc[max(0, min(idx, len(prof)-1))]["time_local"]
        return t if isinstance(t, datetime) else None
    take = time_at(take_idx)
    land = time_at(land_idx)
    if take is None or land is None:
        return {"off_block": None, "takeoff": None, "landing": None, "on_block": None}, False, {"off_idx": take_idx, "takeoff_idx": take_idx, "landing_idx": land_idx, "on_idx": land_idx}
    off = take - timedelta(minutes=5)
    on = land + timedelta(minutes=5)
    return {"off_block": off.strftime("%H:%M"), "takeoff": take.strftime("%H:%M"), "landing": land.strftime("%H:%M"), "on_block": on.strftime("%H:%M")}, has, {"off_idx": max(0,take_idx-1), "takeoff_idx": take_idx, "landing_idx": land_idx, "on_idx": min(len(points)-1, land_idx+1)}


def render_track_profile(points: list[dict[str, Any]]) -> None:
    prof = profile_from_points(points)
    if prof.empty:
        st.info("Track nemá použitelný profil."); return
    x_col = "time_local" if prof["time_local"].notna().any() else "distance_km"
    fig = go.Figure()
    if prof["alt_ft"].notna().any():
        fig.add_trace(go.Scatter(x=prof[x_col], y=prof["alt_ft"], mode="lines", name="Altitude ft", line=dict(color="#38bdf8", width=2.4)))
    if prof["speed_smooth"].notna().any():
        fig.add_trace(go.Scatter(x=prof[x_col], y=prof["speed_smooth"], mode="lines", name="GPS speed km/h", yaxis="y2", line=dict(color="#f59e0b", width=2.0)))
    fig.update_layout(
        template="plotly_dark", paper_bgcolor="rgba(0,0,0,0)", plot_bgcolor="rgba(0,0,0,0)",
        height=420, margin=dict(l=12,r=12,t=35,b=20),
        xaxis_title="Čas" if x_col == "time_local" else "Vzdálenost km",
        yaxis=dict(title="Altitude ft", gridcolor="rgba(148,163,184,.18)"),
        yaxis2=dict(title="GPS speed km/h", overlaying="y", side="right", gridcolor="rgba(148,163,184,0)"),
        legend=dict(orientation="h", y=1.08),
        font=dict(color="#e5edf7"),
    )
    st.plotly_chart(fig, use_container_width=True)
    if prof["speed_smooth"].isna().all():
        st.caption("GPS speed se nezobrazil, protože track nemá použitelná časová data pro výpočet rychlosti.")


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
# Imports / airport registry
# -----------------------------------------------------------------------------

def import_airports_from_csv_file(path: Path, source: str = "ourairports_csv") -> int:
    if not path.exists():
        return 0
    df = pd.read_csv(path)
    required = {"ident", "name", "latitude_deg", "longitude_deg"}
    if not required.issubset(set(df.columns)):
        return 0
    rows = []
    for _, r in df.iterrows():
        ident = normalize_text(r.get("ident"))
        lat = r.get("latitude_deg"); lon = r.get("longitude_deg")
        if not ident or pd.isna(lat) or pd.isna(lon):
            continue
        airport_type = normalize_text(r.get("type")) or ""
        active = 0 if airport_type == "closed" else 1
        rows.append((
            ident, normalize_text(r.get("gps_code")), normalize_text(r.get("iata_code")), normalize_text(r.get("local_code")), normalize_text(r.get("name")),
            airport_type, float(lat), float(lon), None if pd.isna(r.get("elevation_ft")) else float(r.get("elevation_ft")),
            normalize_text(r.get("continent")), normalize_text(r.get("iso_country")), normalize_text(r.get("iso_region")), normalize_text(r.get("municipality")),
            normalize_text(r.get("scheduled_service")), normalize_text(r.get("gps_code")), normalize_text(r.get("home_link")), normalize_text(r.get("wikipedia_link")),
            normalize_text(r.get("keywords")), source, active, 0, "", now_utc_iso()
        ))
    with connect() as con:
        con.executemany(
            """
            INSERT OR REPLACE INTO airports
            (ident, icao_code, iata_code, local_code, name, type, latitude_deg, longitude_deg, elevation_ft, continent, iso_country, iso_region, municipality, scheduled_service, gps_code, home_link, wikipedia_link, keywords, source, active, priority, note, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            rows,
        )
        con.commit()
    return len(rows)


def import_airport_overrides(path: Path = BASE_DIR / "data" / "airport_overrides.csv") -> int:
    if not path.exists():
        return 0
    df = pd.read_csv(path)
    count = 0
    with connect() as con:
        for _, r in df.iterrows():
            ident = normalize_text(r.get("ident"))
            if not ident or pd.isna(r.get("latitude_deg")) or pd.isna(r.get("longitude_deg")):
                continue
            con.execute(
                """
                INSERT OR REPLACE INTO airports
                (ident, icao_code, local_code, name, type, latitude_deg, longitude_deg, elevation_ft, iso_country, municipality, source, active, priority, note, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (ident, normalize_text(r.get("icao_code")), normalize_text(r.get("local_code")) or ident, normalize_text(r.get("name")), normalize_text(r.get("type")) or "small_airport", float(r.get("latitude_deg")), float(r.get("longitude_deg")), None if pd.isna(r.get("elevation_ft")) else float(r.get("elevation_ft")), normalize_text(r.get("iso_country")), normalize_text(r.get("municipality")), "manual_override", 1, 100, normalize_text(r.get("note")), now_utc_iso()),
            )
            count += 1
        con.commit()
    return count

# -----------------------------------------------------------------------------
# Display helpers
# -----------------------------------------------------------------------------

def flight_display_df(df: pd.DataFrame) -> pd.DataFrame:
    cols = ["id","date","evidence","registration","aircraft_type","aircraft_class","departure","arrival","off_block","takeoff","landing","on_block","block_time","air_time","starts","commander","instructor","role","task","price_per_hour","cost_label","track_count","gps_km"]
    keep = [c for c in cols if c in df.columns]
    out = df[keep].copy()
    out = out.rename(columns={
        "id":"ID","date":"Datum","evidence":"Evidence","registration":"Imatrikulace","aircraft_type":"Typ","aircraft_class":"Třída","departure":"Odlet","arrival":"Přílet","off_block":"Off Block","takeoff":"Takeoff","landing":"Landing","on_block":"On Block","block_time":"Block","air_time":"Air","starts":"Starty","commander":"Velitel","instructor":"Instruktor","role":"Funkce","task":"Úloha","price_per_hour":"Kč/h","cost_label":"Cena","track_count":"GPS tracky","gps_km":"GPS km"
    })
    return out


def flight_label(row: pd.Series | dict[str, Any]) -> str:
    g = row.get
    return f"ID {g('id')} • {g('date')} • {g('registration')} • {g('departure')}–{g('arrival')} • {g('off_block')}–{g('on_block')} • {g('role')}"


def open_flight_dialog(flight_id: int) -> None:
    st.session_state["open_flight_dialog_id"] = int(flight_id)
    st.session_state["selected_flight_id"] = int(flight_id)


def clear_open_flight_dialog() -> None:
    st.session_state.pop("open_flight_dialog_id", None)

# -----------------------------------------------------------------------------
# Pages
# -----------------------------------------------------------------------------

def page_dashboard(df: pd.DataFrame):
    st.markdown("## Souhrn")
    s = build_summary(df)
    c1, c2, c3, c4 = st.columns(4)
    with c1: metric_card("Celkový nálet", fmt_minutes(s["total"]), f"{s['flights']} letů")
    with c2: metric_card("PIC", fmt_minutes(s["pic"]), f"ULL {fmt_minutes(s['pic_ull'])} • EASA {fmt_minutes(s['pic_easa'])}")
    with c3: metric_card("DUAL / Safety", f"{fmt_minutes(s['dual'])} / {fmt_minutes(s['safety'])}", f"Starty {s['starts']}")
    with c4: metric_card("Náklady", fmt_money(s["cost"]), f"GPS {s['tracks']} tracků • {s['gps_km']:.0f} km")
    if df.empty:
        return
    yearly = df.groupby(["year","role"], as_index=False)["block_hours"].sum()
    fig = px.bar(yearly, x="year", y="block_hours", color="role", title="Nálet podle roku a funkce", labels={"block_hours":"hodiny"})
    st.plotly_chart(plotly_layout(fig), use_container_width=True)
    c1, c2 = st.columns(2)
    with c1:
        by_reg = df.groupby("registration", as_index=False)["block_hours"].sum().sort_values("block_hours", ascending=False).head(10)
        st.plotly_chart(plotly_layout(px.bar(by_reg, x="registration", y="block_hours", title="TOP letadla podle block time")), use_container_width=True)
    with c2:
        ev = df.groupby("evidence", as_index=False)["block_hours"].sum()
        st.plotly_chart(plotly_layout(px.pie(ev, names="evidence", values="block_hours", title="ULL / EASA", hole=.45)), use_container_width=True)


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
    for _, ap in airports.iterrows():
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
    if reg:
        reg_for_rate = reg
    else:
        reg_for_rate = ""
    evidence = "ULL"
    rate = apply_rate_for_registration(reg_for_rate, local_date, rates) if reg_for_rate else None
    if rate and str(rate.get("aircraft_class") or "").upper() != "ULL":
        evidence = str(rate.get("evidence") or "EASA")
    note = ""
    if not has_clock:
        note = "KML nemá použitelné časové značky; časy doplnit ručně."
    return {
        "date": local_date,
        "evidence": evidence,
        "registration": reg,
        "aircraft_type": normalize_text(rate.get("aircraft_type")) if rate else "",
        "aircraft_class": default_class_for(evidence),
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
        "note": note,
        "stats": stats,
        "detect_idx": idx,
        "has_clock": has_clock,
    }


def save_track(flight_id: int, file_name: str, points: list[dict[str, Any]], replace_existing: bool = False) -> None:
    points = normalize_track_points(points)
    stats = track_stats(points)
    with connect() as con:
        if replace_existing:
            con.execute("DELETE FROM flight_tracks WHERE flight_id = ?", (flight_id,))
        cur = con.execute(
            """
            INSERT INTO flight_tracks (flight_id, file_name, imported_at, point_count, distance_km, start_utc, end_utc, min_alt_m, max_alt_m, coordinates_json)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (flight_id, file_name, now_utc_iso(), stats["point_count"], stats["distance_km"], stats["start_utc"], stats["end_utc"], stats["min_alt_m"], stats["max_alt_m"], json.dumps(points, ensure_ascii=False)),
        )
        track_id = int(cur.lastrowid)
        prof = profile_from_points(points)
        for _, p in prof.iterrows():
            con.execute(
                "INSERT OR IGNORE INTO track_points (track_id, seq, timestamp_utc, latitude, longitude, altitude_m, speed_kmh) VALUES (?, ?, ?, ?, ?, ?, ?)",
                (track_id, int(p["idx"]), p["time_utc"].isoformat() if pd.notna(p["time_utc"]) else None, float(p["lat"]), float(p["lon"]), None if pd.isna(p["alt_m"]) else float(p["alt_m"]), None if pd.isna(p["speed_kmh"]) else float(p["speed_kmh"])),
            )
        con.commit()
    after_write("save_track", "flight_tracks", flight_id, file_name)


def create_flight(data: dict[str, Any], backup: bool = True) -> int:
    fields = ["date","evidence","registration","aircraft_type","aircraft_class","departure","arrival","off_block","takeoff","landing","on_block","starts","commander","instructor","role","task","price_per_hour","note"]
    vals = [data.get(f) for f in fields]
    with connect() as con:
        cur = con.execute(f"INSERT INTO flights ({','.join(fields)}) VALUES ({','.join(['?']*len(fields))})", vals)
        fid = int(cur.lastrowid)
        con.commit()
    after_write("create", "flights", fid, data.get("registration", ""), backup=backup)
    return fid


def update_flight(flight_id: int, data: dict[str, Any]) -> None:
    fields = ["date","evidence","registration","aircraft_type","aircraft_class","departure","arrival","off_block","takeoff","landing","on_block","starts","commander","instructor","role","task","price_per_hour","note"]
    with connect() as con:
        con.execute(
            "UPDATE flights SET " + ",".join([f"{f}=?" for f in fields]) + " WHERE id=?",
            [data.get(f) for f in fields] + [flight_id],
        )
        con.commit()
    after_write("update", "flights", flight_id, data.get("registration", ""))


def delete_track(track_id: int) -> None:
    with connect() as con:
        con.execute("DELETE FROM flight_tracks WHERE id = ?", (track_id,))
        con.commit()
    after_write("delete", "flight_tracks", track_id)


def delete_flight(flight_id: int) -> None:
    """Delete one flight and all related KML/GPS data from the SQLite database.

    The flight_tracks table has ON DELETE CASCADE from flights and track_points
    has ON DELETE CASCADE from flight_tracks, so removing the flight removes the
    connected tracks and all stored GPS points as one database operation.
    """
    with connect() as con:
        row = con.execute("SELECT * FROM flights WHERE id = ?", (flight_id,)).fetchone()
        if row is None:
            return
        track_count = con.execute("SELECT COUNT(*) AS n FROM flight_tracks WHERE flight_id = ?", (flight_id,)).fetchone()["n"]
        audit_detail = {
            "date": row["date"],
            "registration": row["registration"],
            "route": f"{row['departure'] or ''}-{row['arrival'] or ''}",
            "tracks_deleted": int(track_count or 0),
        }
        con.execute("DELETE FROM flights WHERE id = ?", (flight_id,))
        record_audit(con, "delete_flight", "flights", flight_id, audit_detail)
        con.commit()
    auto_backup_after_change("delete_flight")


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
    for _, ap in airports.iterrows():
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
            (flight_id, file_name, now_utc_iso(), stats["point_count"], stats["distance_km"], stats["start_utc"], stats["end_utc"], stats["min_alt_m"], stats["max_alt_m"], json.dumps(points, ensure_ascii=False)),
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
    """Delete one flight and all related KML/GPS data from the SQLite database.

    The flight_tracks table has ON DELETE CASCADE from flights and track_points
    has ON DELETE CASCADE from flight_tracks, so removing the flight removes the
    connected tracks and all stored GPS points as one database operation.
    """
    with connect() as con:
        row = con.execute("SELECT * FROM flights WHERE id = ?", (flight_id,)).fetchone()
        if row is None:
            return
        track_count = con.execute("SELECT COUNT(*) AS n FROM flight_tracks WHERE flight_id = ?", (flight_id,)).fetchone()["n"]
        audit_detail = {
            "date": row["date"],
            "registration": row["registration"],
            "route": f"{row['departure'] or ''}-{row['arrival'] or ''}",
            "tracks_deleted": int(track_count or 0),
        }
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

def page_dashboard(df: pd.DataFrame):
    st.markdown("## Souhrn")
    s = build_summary(df)
    c1, c2, c3, c4 = st.columns(4)
    with c1: metric_card("Celkový nálet", fmt_minutes(s["total"]), f"{s['flights']} letů")
    with c2: metric_card("PIC", fmt_minutes(s["pic"]), f"ULL {fmt_minutes(s['pic_ull'])} • EASA {fmt_minutes(s['pic_easa'])}")
    with c3: metric_card("DUAL / Safety", f"{fmt_minutes(s['dual'])} / {fmt_minutes(s['safety'])}", f"Starty {s['starts']}")
    with c4: metric_card("Náklady", fmt_money(s["cost"]), f"GPS {s['tracks']} tracků • {s['gps_km']:.0f} km")
    if df.empty:
        return
    yearly = df.groupby(["year","role"], as_index=False)["block_hours"].sum()
    fig = px.bar(yearly, x="year", y="block_hours", color="role", title="Nálet podle roku a funkce", labels={"block_hours":"hodiny"})
    st.plotly_chart(plotly_layout(fig), use_container_width=True)
    c1, c2 = st.columns(2)
    with c1:
        by_reg = df.groupby("registration", as_index=False)["block_hours"].sum().sort_values("block_hours", ascending=False).head(10)
        st.plotly_chart(plotly_layout(px.bar(by_reg, x="registration", y="block_hours", title="TOP letadla podle block time")), use_container_width=True)
    with c2:
        ev = df.groupby("evidence", as_index=False)["block_hours"].sum()
        st.plotly_chart(plotly_layout(px.pie(ev, names="evidence", values="block_hours", title="ULL / EASA", hole=.45)), use_container_width=True)


def page_new_flight(rates: pd.DataFrame):
    st.markdown("## Přidat let")
    mode = st.radio("Způsob zadání", ["Ručně", "Z KML tracku"], horizontal=True)
    if mode == "Ručně":
        if not is_admin(): st.info("Pro ukládání se přihlas jako admin.")
        data = flight_form("new_manual", {}, rates)
        if data is not None:
            if require_admin():
                fid = create_flight(data)
                st.success(f"Let uložen jako ID {fid}.")
    else:
        up = st.file_uploader("Nahraj KML", type=["kml"], key="new_kml_upload")
        if up is not None:
            points = parse_kml_bytes(up.read())
            if len(points) < 2:
                st.error("KML neobsahuje použitelný track."); return
            suggestion = suggest_flight_from_kml(up.name, points, rates)
            if not suggestion.get("has_clock"):
                st.warning("Track nemá dostatek časových/rychlostních dat. Časy doplň ručně.")
            st_folium(make_map(pd.DataFrame([{"coordinates_json": json.dumps(points), "date": suggestion.get("date"), "registration": suggestion.get("registration"), "departure": suggestion.get("departure"), "arrival": suggestion.get("arrival"), "role": suggestion.get("role"), "evidence": suggestion.get("evidence")}]), True, show_endpoints=True), height=390, use_container_width=True, key=f"new_kml_map_{up.name}_{len(points)}")
            render_track_profile(points)
            data = flight_form("new_from_kml", suggestion, rates, "Uložit let a připojit track")
            if data is not None:
                if require_admin():
                    fid = create_flight(data, auto_backup=False)
                    save_track(fid, up.name, points, replace_existing=True)
                    st.success(f"Let a track uloženy jako ID {fid}.")


def page_map(dark_mode: bool):
    st.markdown("## Mapa")
    tracks = read_tracks_joined()
    if tracks.empty:
        st.info("Zatím nejsou uloženy žádné GPS tracky."); return
    st_folium(make_map(tracks, dark_mode, line_weight=1.55, line_opacity=.42, show_endpoints=False), height=650, use_container_width=True, key="all_tracks_map")


def page_rates(rates: pd.DataFrame):
    st.markdown("## Ceník")
    st.dataframe(rates, hide_index=True, use_container_width=True)


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
                        con.execute("""
                        INSERT OR REPLACE INTO airports (ident, name, type, latitude_deg, longitude_deg, source, active, priority, note, updated_at)
                        VALUES (?, ?, ?, ?, ?, 'manual', 1, 200, ?, ?)
                        """, (ident, name, typ, lat, lon, note, now_utc_iso()))
                        con.commit()
                    after_write("upsert", "airports", ident)
                    st.success("Letiště uloženo.")
    with tabs[1]:
        aircraft = read_table("aircraft")
        st.dataframe(aircraft, hide_index=True, use_container_width=True)
        if is_admin():
            with st.expander("Ručně přidat / opravit letadlo"):
                c1,c2,c3,c4 = st.columns(4)
                reg = c1.text_input("Registrace")
                typ = c2.text_input("Typ")
                cls = c3.selectbox("Třída", CLASS_OPTIONS)
                ev = c4.selectbox("Evidence", EVIDENCE_OPTIONS)
                price = st.number_input("Výchozí Kč/h", min_value=0.0, step=10.0)
                note = st.text_area("Poznámka")
                if st.form_submit_button("Uložit letadlo"):
                    with connect() as con:
                        con.execute("""
                        INSERT OR REPLACE INTO aircraft
                        (registration, aircraft_type, aircraft_class, evidence, default_price_per_hour, active, note, updated_at)
                        VALUES (?, ?, ?, ?, ?, 1, ?, ?)
                        """, (reg.upper(), typ, cls, ev, price, note, now_utc_iso()))
                        con.commit()
                    after_write("upsert", "aircraft", reg)
                    st.success("Letadlo uloženo."); st.rerun()
    with tabs[2]:
        dirty = get_meta("dirty", "0") == "1"
        last = get_meta("last_github_backup", "")
        st.write(f"Stav databáze: {'čeká na zálohu' if dirty else 'zálohováno / čisté'}")
        st.write(f"Poslední GitHub záloha: {last or '—'}")
        if DB_PATH.exists():
            st.download_button("Stáhnout SQLite databázi", data=DB_PATH.read_bytes(), file_name="logbook.sqlite", mime="application/octet-stream")
        uploaded_db = st.file_uploader("Obnovit databázi ze souboru SQLite", type=["sqlite", "db"], disabled=not is_admin())
        if uploaded_db is not None and is_admin():
            if st.button("Obnovit databázi", type="primary"):
                backup = DB_PATH.with_suffix(".sqlite.before_restore")
                if DB_PATH.exists():
                    shutil.copy2(DB_PATH, backup)
                DB_PATH.write_bytes(uploaded_db.read())
                clear_data_cache()
                after_write("restore", "database", None, uploaded_db.name, backup=True)
                st.success("Databáze obnovena."); st.rerun()
        if st.button("Uložit aktuální databázi na GitHub", disabled=not is_admin(), use_container_width=True):
            if require_admin():
                ok, msg = github_backup_database(auto=False)
                (st.success if ok else st.error)(msg)
    with tabs[3]:
        st.dataframe(read_table("app_meta"), hide_index=True, use_container_width=True)
        st.dataframe(read_table("audit_log").tail(100), hide_index=True, use_container_width=True)


def page_export(df: pd.DataFrame):
    st.markdown("## Export")
    csv = df.to_csv(index=False).encode("utf-8-sig")
    st.download_button("Stáhnout CSV", data=csv, file_name="logbook_export.csv", mime="text/csv")
    output = BytesIO()
    wb = Workbook()
    ws = wb.active; ws.title = "Lety"
    cols = ["date","evidence","registration","aircraft_type","aircraft_class","departure","arrival","off_block","takeoff","landing","on_block","block_time","air_time","starts","commander","instructor","role","task","price_per_hour","cost","track_count","gps_km","note"]
    ws.append(cols)
    for _, r in df[cols].iterrows():
        ws.append(r.tolist())
    wb.save(output)
    st.download_button("Stáhnout Excel", data=output.getvalue(), file_name="logbook_export.xlsx", mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")


def sidebar(page: str):
    st.sidebar.markdown("## Letový zápisník")
    st.sidebar.markdown(f'<div class="sidebar-version">{APP_VERSION}</div>', unsafe_allow_html=True)
    st.sidebar.markdown("### Navigace")
    for label, target in [("Souhrn", "Souhrn"), ("Lety", "Lety"), ("Přidat let", "Přidat let"), ("Mapa", "Mapa"), ("Ceník", "Ceník"), ("Databáze", "Databáze"), ("Export", "Export")]:
        nav_button(label, target, page)
    st.sidebar.markdown("---")
    with st.sidebar.expander("Správa aplikace", expanded=False):
        if is_admin():
            st.caption("Přihlášeno jako správce.")
            if st.button("Odhlásit", use_container_width=True):
                st.session_state["is_admin"] = False
                st.rerun()
        else:
            pw = st.text_input("Admin heslo", type="password")
            if st.button("Přihlásit", use_container_width=True):
                expected = configured_admin_password()
                if expected and pw == expected:
                    st.session_state["is_admin"] = True
                    st.success("Přihlášeno.")
                    st.rerun()
                else:
                    st.error("Nesprávné heslo nebo heslo není nastavené.")
        cfg = github_config()
        st.caption(f"Auto GitHub backup: {'zapnuto' if cfg['auto_backup'] else 'vypnuto'}")
        status = st.session_state.get("last_backup_status")
        if status:
            ok, msg = status
            (st.success if ok else st.warning)(msg)


def main():
    st.set_page_config(page_title="Letový zápisník", page_icon="✈️", layout="wide", initial_sidebar_state="expanded")
    apply_ui_theme(True)
    if "page" not in st.session_state:
        st.session_state["page"] = "Souhrn"
    if st.session_state["page"] == "Kontrola":
        st.session_state["page"] = "Souhrn"
    page = st.session_state["page"]
    sidebar(page)
    app_header()
    df = read_flights()
    rates = read_table("rates")
    if page == "Souhrn":
        page_dashboard(df)
    elif page == "Lety":
        page_logbook(df, rates, True)
    elif page == "Přidat let":
        page_new_flight(rates)
    elif page == "Mapa":
        page_map(True)
    elif page == "Ceník":
        page_rates(rates)
    elif page == "Databáze":
        page_database()
    elif page == "Export":
        page_export(df)


if __name__ == "__main__":
    main()
