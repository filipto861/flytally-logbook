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
APP_VERSION = "v0.20"
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

def get_secret(path: list[str], default: Any = None) -> Any:
    cur: Any = st.secrets
    try:
        for p in path:
            cur = cur[p]
        return cur
    except Exception:
        return default


def is_admin() -> bool:
    return bool(st.session_state.get("is_admin", False))


def require_admin() -> bool:
    if not is_admin():
        st.warning("Tato akce je dostupná pouze po přihlášení jako admin.")
        return False
    return True


def github_configured() -> bool:
    return bool(get_secret(["github", "token"]) and get_secret(["github", "repo"]))


def github_backup_database(auto: bool = False) -> tuple[bool, str]:
    if not github_configured():
        return False, "GitHub záloha není nastavena v Secrets."
    if requests is None:
        return False, "Balíček requests není dostupný."
    token = get_secret(["github", "token"])
    repo = get_secret(["github", "repo"], "filipto861/Logbook")
    db_path = get_secret(["github", "db_path"], "data/logbook.sqlite")
    branch = get_secret(["github", "branch"], "main")
    if auto and not bool(get_secret(["github", "auto_backup"], True)):
        return False, "Automatická záloha je vypnutá."
    if not DB_PATH.exists():
        return False, "Databázový soubor neexistuje."
    headers = {"Authorization": f"Bearer {token}", "Accept": "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28"}
    api = f"https://api.github.com/repos/{repo}/contents/{db_path}"
    try:
        r = requests.get(api, headers=headers, params={"ref": branch}, timeout=20)
        sha = r.json().get("sha") if r.status_code == 200 else None
        content = base64.b64encode(DB_PATH.read_bytes()).decode("ascii")
        message = f"Backup logbook database {datetime.now(LOCAL_TZ).strftime('%Y-%m-%d %H:%M:%S')}"
        payload = {"message": message, "content": content, "branch": branch}
        if sha:
            payload["sha"] = sha
        put = requests.put(api, headers=headers, json=payload, timeout=60)
        if put.status_code not in (200, 201):
            return False, f"GitHub backup selhal: HTTP {put.status_code} {put.text[:250]}"
        mark_clean()
        with connect() as con:
            con.execute("INSERT OR REPLACE INTO app_meta (key, value, updated_at) VALUES (?, ?, ?)", ("last_github_backup", now_utc_iso(), now_utc_iso()))
            con.commit()
        return True, "Databáze byla zazálohována na GitHub."
    except Exception as exc:
        return False, f"GitHub backup selhal: {exc}"

# -----------------------------------------------------------------------------
# UI theme
# -----------------------------------------------------------------------------

def apply_ui_theme(dark_mode: bool = True) -> None:
    bg = "#06101d"; panel = "#0b182a"; panel2 = "#10233a"; text = "#e6f0fb"; muted = "#92a8c0"; border = "rgba(125,211,252,.18)"; accent = "#38bdf8"; good = "#22c55e"; warn = "#f59e0b"; shadow = "rgba(0,0,0,.40)"
    st.markdown(f"""
    <style>
    :root {{--bg:{bg};--panel:{panel};--panel2:{panel2};--text:{text};--muted:{muted};--border:{border};--accent:{accent};--good:{good};--warn:{warn};--shadow:{shadow};}}
    header[data-testid="stHeader"] {{display:none !important; height:0 !important; min-height:0 !important; visibility:hidden !important;}}
    div[data-testid="stToolbar"], div[data-testid="stDecoration"], div[data-testid="stStatusWidget"], #MainMenu, footer {{display:none !important; visibility:hidden !important; height:0 !important;}}
    .stDeployButton {{display:none !important;}}
    [data-testid="stAppViewContainer"] > .main {{padding-top:0 !important;}}
    [data-testid="stAppViewContainer"] .main .block-container {{padding-top:0 !important; margin-top:0 !important;}}
    .stApp {{background: radial-gradient(circle at 16% 10%, rgba(56,189,248,.16), transparent 24%), radial-gradient(circle at 88% 3%, rgba(34,197,94,.08), transparent 26%), var(--bg); color:var(--text);}}
    [data-testid="stSidebar"] {{background: linear-gradient(180deg, rgba(11,24,42,.98), rgba(6,16,29,.98)); border-right:1px solid var(--border);}}
    [data-testid="stSidebar"] * {{color:#e6f0fb;}}
    .block-container {{padding-top:0 !important; padding-bottom:3rem; max-width:1500px;}}
    h1,h2,h3 {{letter-spacing:-.025em;}}
    .app-title {{display:flex;align-items:center;justify-content:space-between;gap:1rem;padding:1.05rem 1.25rem;border:1px solid var(--border);background:linear-gradient(135deg,rgba(56,189,248,.14),rgba(15,23,42,.04)),var(--panel);border-radius:20px;box-shadow:0 16px 38px var(--shadow);margin-bottom:1rem;}}
    .app-title-main {{font-size:1.35rem;font-weight:850;color:var(--text);line-height:1.1;}}
    .app-title-sub {{font-size:.84rem;color:var(--muted);margin-top:.18rem;}}
    .app-badge {{font-size:.72rem;font-weight:800;color:#031421;background:linear-gradient(135deg,var(--accent),#a7f3d0);border-radius:999px;padding:.34rem .62rem;white-space:nowrap;}}
    .metric-card {{border:1px solid var(--border);border-radius:18px;padding:1rem 1.05rem;background:linear-gradient(180deg,rgba(255,255,255,.04),transparent),var(--panel);box-shadow:0 12px 30px var(--shadow);min-height:108px;}}
    .metric-label {{color:var(--muted);font-size:.75rem;text-transform:uppercase;letter-spacing:.08em;font-weight:800;}}
    .metric-value {{color:var(--text);font-size:1.72rem;line-height:1.25;font-weight:850;margin-top:.25rem;}}
    .metric-sub {{color:var(--muted);font-size:.82rem;margin-top:.28rem;}}
    .section-card {{border:1px solid var(--border);border-radius:18px;padding:1rem;background:var(--panel);box-shadow:0 10px 28px var(--shadow);}}
    .nav-button div[data-testid="stButton"] > button, [data-testid="stSidebar"] div[data-testid="stButton"] > button {{border-radius:13px;border:1px solid rgba(125,211,252,.22);background:#10233a;color:#e6f0fb;font-weight:700;}}
    [data-testid="stSidebar"] div[data-testid="stButton"] > button:hover {{border-color:#38bdf8;background:#12304d;}}
    .pill {{display:inline-block;border:1px solid var(--border);border-radius:999px;background:var(--panel2);padding:.25rem .62rem;margin:.1rem .18rem;font-size:.82rem;color:var(--text);}}
    div[data-testid="stDataFrame"], div[data-testid="stDataEditor"] {{border-radius:16px;overflow:hidden;}}
    .stTabs [data-baseweb="tab-list"] {{gap:.45rem;}}
    .stTabs [data-baseweb="tab"] {{border-radius:999px;padding:.45rem .9rem;background:var(--panel2);}}
    button[kind="primary"] {{border-radius:12px;}}
    .flight-list-head {{font-size:.72rem;letter-spacing:.08em;text-transform:uppercase;color:#93b8d9;font-weight:900;border-bottom:1px solid rgba(125,211,252,.22);padding:.20rem .15rem .45rem .15rem;}}
    .flight-cell {{font-size:.84rem;line-height:1.18;padding:.24rem .1rem;}}
    .flight-cell-main {{font-weight:800;color:#f8fbff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}}
    .flight-cell-sub {{font-size:.72rem;color:#8fb3d1;margin-top:.08rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}}
    .flight-row-sep {{height:1px;background:rgba(125,211,252,.10);margin:.10rem 0 .24rem 0;}}
    .flight-list-note {{color:#8fb3d1;font-size:.82rem;margin:.4rem 0 .65rem 0;}}
    .flight-page-info {{color:#cfe7ff;font-weight:800;padding-top:1.9rem;}}
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


def plotly_layout(fig, dark_mode: bool = True):
    fig.update_layout(template="plotly_dark", paper_bgcolor="rgba(0,0,0,0)", plot_bgcolor="rgba(0,0,0,0)", font=dict(color="#e5edf7"), margin=dict(l=10, r=10, t=45, b=10), legend=dict(orientation="h", yanchor="bottom", y=1.02, xanchor="right", x=1))
    fig.update_xaxes(gridcolor="rgba(148,163,184,.18)")
    fig.update_yaxes(gridcolor="rgba(148,163,184,.18)")
    return fig

# -----------------------------------------------------------------------------
# Airports database import / detection
# -----------------------------------------------------------------------------

def upsert_airport(con: sqlite3.Connection, row: dict[str, Any]) -> None:
    con.execute(
        """
        INSERT INTO airports (ident, icao_code, iata_code, local_code, name, type, latitude_deg, longitude_deg,
            elevation_ft, continent, iso_country, iso_region, municipality, scheduled_service, gps_code, home_link,
            wikipedia_link, keywords, source, active, priority, note, updated_at)
        VALUES (:ident, :icao_code, :iata_code, :local_code, :name, :type, :latitude_deg, :longitude_deg,
            :elevation_ft, :continent, :iso_country, :iso_region, :municipality, :scheduled_service, :gps_code,
            :home_link, :wikipedia_link, :keywords, :source, :active, :priority, :note, :updated_at)
        ON CONFLICT(ident) DO UPDATE SET
            icao_code=excluded.icao_code,
            iata_code=excluded.iata_code,
            local_code=excluded.local_code,
            name=excluded.name,
            type=excluded.type,
            latitude_deg=excluded.latitude_deg,
            longitude_deg=excluded.longitude_deg,
            elevation_ft=excluded.elevation_ft,
            continent=excluded.continent,
            iso_country=excluded.iso_country,
            iso_region=excluded.iso_region,
            municipality=excluded.municipality,
            scheduled_service=excluded.scheduled_service,
            gps_code=excluded.gps_code,
            home_link=excluded.home_link,
            wikipedia_link=excluded.wikipedia_link,
            keywords=excluded.keywords,
            source=excluded.source,
            active=excluded.active,
            priority=excluded.priority,
            note=excluded.note,
            updated_at=excluded.updated_at
        """,
        row,
    )


def import_airports_from_csv(csv_bytes: bytes, source: str = "ourairports", overwrite: bool = True) -> int:
    df = pd.read_csv(BytesIO(csv_bytes))
    required = {"ident", "type", "name", "latitude_deg", "longitude_deg"}
    missing = required - set(df.columns)
    if missing:
        raise ValueError(f"CSV neobsahuje povinné sloupce: {', '.join(sorted(missing))}")
    imported = 0
    with connect() as con:
        for _, r in df.iterrows():
            if pd.isna(r.get("ident")) or pd.isna(r.get("latitude_deg")) or pd.isna(r.get("longitude_deg")):
                continue
            apt_type = str(r.get("type") or "").strip()
            ident = str(r.get("ident") or "").strip().upper()
            row = {
                "ident": ident,
                "icao_code": normalize_text(r.get("gps_code")) or (ident if re.match(r"^[A-Z]{4}$", ident) else None),
                "iata_code": normalize_text(r.get("iata_code")),
                "local_code": normalize_text(r.get("local_code")),
                "name": normalize_text(r.get("name")),
                "type": apt_type,
                "latitude_deg": float(r.get("latitude_deg")),
                "longitude_deg": float(r.get("longitude_deg")),
                "elevation_ft": float(r.get("elevation_ft")) if pd.notna(r.get("elevation_ft")) else None,
                "continent": normalize_text(r.get("continent")),
                "iso_country": normalize_text(r.get("iso_country")),
                "iso_region": normalize_text(r.get("iso_region")),
                "municipality": normalize_text(r.get("municipality")),
                "scheduled_service": normalize_text(r.get("scheduled_service")),
                "gps_code": normalize_text(r.get("gps_code")),
                "home_link": normalize_text(r.get("home_link")),
                "wikipedia_link": normalize_text(r.get("wikipedia_link")),
                "keywords": normalize_text(r.get("keywords")),
                "source": source,
                "active": 0 if apt_type == "closed" else 1,
                "priority": 0,
                "note": None,
                "updated_at": now_utc_iso(),
            }
            upsert_airport(con, row)
            imported += 1
        con.commit()
    after_write("import", "airports", detail=f"{imported} záznamů", backup=True)
    return imported


def import_local_airports_if_available() -> int:
    csv_path = BASE_DIR / "data" / "airports.csv"
    if not csv_path.exists():
        return 0
    return import_airports_from_csv(csv_path.read_bytes(), source="ourairports-local")


def airport_db_has_data() -> bool:
    try:
        with connect() as con:
            row = con.execute("SELECT COUNT(*) AS c FROM airports").fetchone()
            return int(row["c"] or 0) > 0
    except Exception:
        return False


def find_nearest_airport(lat: float, lon: float, max_km: float = 8.0) -> dict[str, Any] | None:
    with connect() as con:
        rows = con.execute(
            """
            SELECT ident, name, type, latitude_deg, longitude_deg, iso_country, priority
            FROM airports
            WHERE active = 1
              AND latitude_deg BETWEEN ? AND ?
              AND longitude_deg BETWEEN ? AND ?
            """,
            (lat - 0.25, lat + 0.25, lon - 0.35, lon + 0.35),
        ).fetchall()
    best = None
    best_dist = 999999.0
    for r in rows:
        d = haversine_km(lat, lon, float(r["latitude_deg"]), float(r["longitude_deg"]))
        if d < best_dist:
            best_dist = d
            best = dict(r)
    if best and best_dist <= max_km:
        best["distance_km"] = best_dist
        return best
    return None

# -----------------------------------------------------------------------------
# Filters and summaries
# -----------------------------------------------------------------------------

def apply_filters(df: pd.DataFrame, key_prefix: str = "") -> pd.DataFrame:
    if df.empty:
        return df
    work = df.copy()
    years = sorted(int(y) for y in work["year"].dropna().unique())
    registrations = sorted(r for r in work["registration"].dropna().unique() if r)
    roles = sorted(r for r in work["role"].dropna().unique() if r)
    with st.expander("Filtry", expanded=False):
        c1, c2, c3, c4 = st.columns(4)
        with c1:
            selected_years = st.multiselect("Rok", years, default=years, key=f"{key_prefix}_years")
        with c2:
            selected_evidence = st.multiselect("Evidence", EVIDENCE_OPTIONS, default=EVIDENCE_OPTIONS, key=f"{key_prefix}_ev")
        with c3:
            selected_roles = st.multiselect("Funkce", roles, default=roles, key=f"{key_prefix}_roles")
        with c4:
            selected_regs = st.multiselect("Imatrikulace", registrations, default=[], key=f"{key_prefix}_regs")
    if selected_years:
        work = work[work["year"].isin(selected_years)]
    if selected_evidence:
        work = work[work["evidence"].isin(selected_evidence)]
    if selected_roles:
        work = work[work["role"].isin(selected_roles)]
    if selected_regs:
        work = work[work["registration"].isin(selected_regs)]
    return work


def total_minutes(df: pd.DataFrame, mask=None, col: str = "block_minutes") -> int:
    if df.empty:
        return 0
    series = df[col]
    if mask is not None:
        series = series[mask]
    return int(series.fillna(0).sum())


def summary_numbers(df: pd.DataFrame) -> dict[str, Any]:
    return {
        "flights": len(df),
        "starts": int(df["starts"].sum()) if not df.empty else 0,
        "block": fmt_minutes(total_minutes(df)),
        "air": fmt_minutes(total_minutes(df, col="air_minutes")),
        "pic": fmt_minutes(total_minutes(df, df["role"].eq("PIC"))),
        "dual": fmt_minutes(total_minutes(df, df["role"].eq("DUAL"))),
        "safety": fmt_minutes(total_minutes(df, df["role"].eq("SAFETY PILOT"))),
        "pic_ull": fmt_minutes(total_minutes(df, df["role"].eq("PIC") & df["evidence"].eq("ULL"))),
        "pic_easa": fmt_minutes(total_minutes(df, df["role"].eq("PIC") & df["evidence"].eq("EASA"))),
        "cost": fmt_money(df["cost"].sum() if not df.empty else 0),
        "gps_tracks": int(df["track_count"].sum()) if "track_count" in df else 0,
        "gps_km": float(df["gps_km"].sum()) if "gps_km" in df else 0.0,
    }

# -----------------------------------------------------------------------------
# KML parsing / GPS logic
# -----------------------------------------------------------------------------

def haversine_km(lat1, lon1, lat2, lon2):
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(dphi/2)**2 + math.cos(p1)*math.cos(p2)*math.sin(dl/2)**2
    return 2*r*math.atan2(math.sqrt(a), math.sqrt(1-a))


def parse_time_any(text: str | None) -> datetime | None:
    if not text:
        return None
    try:
        return datetime.fromisoformat(text.replace("Z", "+00:00"))
    except Exception:
        return None


def parse_kml_bytes(data: bytes) -> list[dict[str, Any]]:
    root = ET.fromstring(data)
    ns = {"kml": "http://www.opengis.net/kml/2.2", "gx": "http://www.google.com/kml/ext/2.2"}
    points: list[dict[str, Any]] = []
    # gx:Track
    for trk in root.findall(".//gx:Track", ns):
        whens = [e.text for e in trk.findall("gx:when", ns)]
        coords = [e.text for e in trk.findall("gx:coord", ns)]
        for i, coord in enumerate(coords):
            parts = coord.split()
            if len(parts) >= 2:
                lon = float(parts[0]); lat = float(parts[1]); alt = float(parts[2]) if len(parts) > 2 else None
                points.append({"time": whens[i] if i < len(whens) else None, "lat": lat, "lon": lon, "alt": alt})
    # LineString coordinates fallback
    if not points:
        for elem in root.findall(".//kml:LineString/kml:coordinates", ns) + root.findall(".//coordinates"):
            if elem.text:
                for raw in elem.text.split():
                    parts = raw.split(",")
                    if len(parts) >= 2:
                        lon = float(parts[0]); lat = float(parts[1]); alt = float(parts[2]) if len(parts) > 2 and parts[2] else None
                        points.append({"time": None, "lat": lat, "lon": lon, "alt": alt})
    # Point placemarks with TimeStamp fallback
    if not points:
        for placemark in root.findall(".//kml:Placemark", ns) + root.findall(".//Placemark"):
            coord_elem = placemark.find(".//kml:Point/kml:coordinates", ns) or placemark.find(".//Point/coordinates")
            when_elem = placemark.find(".//kml:TimeStamp/kml:when", ns) or placemark.find(".//TimeStamp/when")
            if coord_elem is not None and coord_elem.text:
                parts = coord_elem.text.strip().split(",")
                if len(parts) >= 2:
                    points.append({"time": when_elem.text if when_elem is not None else None, "lat": float(parts[1]), "lon": float(parts[0]), "alt": float(parts[2]) if len(parts) > 2 and parts[2] else None})
    return enrich_speeds(points)


def enrich_speeds(points: list[dict[str, Any]]) -> list[dict[str, Any]]:
    prev = None
    for p in points:
        p["speed_kmh"] = None
        t = parse_time_any(p.get("time"))
        p["dt"] = t
        if prev and t and prev.get("dt"):
            seconds = (t - prev["dt"]).total_seconds()
            if seconds > 0:
                dist = haversine_km(prev["lat"], prev["lon"], p["lat"], p["lon"])
                p["speed_kmh"] = dist / seconds * 3600
        prev = p
    for p in points:
        p.pop("dt", None)
    return points


def track_stats(points: list[dict[str, Any]]) -> dict[str, Any]:
    dist = 0.0
    prev = None
    alts = []
    times = []
    speeds = []
    for p in points:
        if prev:
            dist += haversine_km(prev["lat"], prev["lon"], p["lat"], p["lon"])
        prev = p
        if p.get("alt") is not None:
            alts.append(float(p["alt"]))
        if p.get("time"):
            times.append(p.get("time"))
        if p.get("speed_kmh") is not None:
            speeds.append(float(p["speed_kmh"]))
    return {
        "point_count": len(points),
        "distance_km": dist,
        "start_utc": times[0] if times else None,
        "end_utc": times[-1] if times else None,
        "min_alt_m": min(alts) if alts else None,
        "max_alt_m": max(alts) if alts else None,
        "max_speed_kmh": max(speeds) if speeds else None,
    }


def detect_takeoff_landing(points: list[dict[str, Any]]) -> dict[str, Any]:
    if not points:
        return {}
    times = [parse_time_any(p.get("time")) for p in points]
    has_time = any(t is not None for t in times)
    if not has_time:
        return {"warning": "Track neobsahuje časové značky. Časy je nutné doplnit ručně."}

    speeds = [p.get("speed_kmh") for p in points]
    usable_speeds = [s for s in speeds if s is not None and not pd.isna(s)]
    take_idx = None
    land_idx = None
    if len(usable_speeds) >= 5:
        threshold = 45.0
        # first sustained movement above threshold
        for i in range(len(points)):
            window = [points[j].get("speed_kmh") for j in range(i, min(i+4, len(points)))]
            if len(window) >= 3 and sum((s or 0) >= threshold for s in window) >= 3:
                take_idx = i
                break
        for i in range(len(points)-1, -1, -1):
            window = [points[j].get("speed_kmh") for j in range(max(0, i-3), i+1)]
            if len(window) >= 3 and sum((s or 0) >= threshold for s in window) >= 3:
                land_idx = i
                break
    if take_idx is None or land_idx is None:
        alts = [p.get("alt") for p in points]
        numeric_alts = [float(a) for a in alts if a is not None]
        if numeric_alts:
            base = min(numeric_alts)
            threshold_alt = base + 80
            for i, a in enumerate(alts):
                if a is not None and float(a) >= threshold_alt:
                    take_idx = max(0, i-2)
                    break
            for i in range(len(alts)-1, -1, -1):
                a = alts[i]
                if a is not None and float(a) >= threshold_alt:
                    land_idx = min(len(alts)-1, i+2)
                    break
    if take_idx is None:
        take_idx = 0
    if land_idx is None:
        land_idx = len(points) - 1
    take_dt = parse_time_any(points[take_idx].get("time"))
    land_dt = parse_time_any(points[land_idx].get("time"))
    if not take_dt or not land_dt:
        return {"warning": "Track neobsahuje dostatek časových dat. Časy je nutné doplnit ručně."}
    off_dt = take_dt - timedelta(minutes=5)
    on_dt = land_dt + timedelta(minutes=5)
    return {
        "takeoff": take_dt.astimezone(LOCAL_TZ).strftime("%H:%M"),
        "landing": land_dt.astimezone(LOCAL_TZ).strftime("%H:%M"),
        "off_block": off_dt.astimezone(LOCAL_TZ).strftime("%H:%M"),
        "on_block": on_dt.astimezone(LOCAL_TZ).strftime("%H:%M"),
        "takeoff_dt": take_dt,
        "landing_dt": land_dt,
    }


def suggest_flight_from_track(points: list[dict[str, Any]], filename: str = "") -> dict[str, Any]:
    stats = track_stats(points)
    first, last = points[0], points[-1]
    dep = find_nearest_airport(first["lat"], first["lon"])
    arr = find_nearest_airport(last["lat"], last["lon"])
    detected = detect_takeoff_landing(points)
    start_dt = parse_time_any(stats.get("start_utc"))
    flight_date = start_dt.astimezone(LOCAL_TZ).date().isoformat() if start_dt else date.today().isoformat()
    reg = None
    m = re.search(r"OK[-_ ]?[A-Z0-9]{3,5}|[A-Z]{3}\d{2}", filename.upper())
    if m:
        reg = m.group(0).replace("_", "-").replace(" ", "-")
        if not reg.startswith("OK-") and re.match(r"^[A-Z]{3}\d{2}$", reg):
            reg = "OK-" + reg
    return {
        "date": flight_date,
        "registration": reg,
        "departure": dep["ident"] if dep else "",
        "arrival": arr["ident"] if arr else "",
        "off_block": detected.get("off_block"),
        "takeoff": detected.get("takeoff"),
        "landing": detected.get("landing"),
        "on_block": detected.get("on_block"),
        "stats": stats,
        "warning": detected.get("warning"),
    }


def save_track(flight_id: int, file_name: str, points: list[dict[str, Any]], replace_existing: bool = True) -> int:
    stats = track_stats(points)
    with connect() as con:
        if replace_existing:
            con.execute("DELETE FROM flight_tracks WHERE flight_id = ?", (flight_id,))
        cur = con.execute(
            """
            INSERT INTO flight_tracks (flight_id, file_name, imported_at, point_count, distance_km, start_utc, end_utc, min_alt_m, max_alt_m, coordinates_json)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (flight_id, file_name, now_utc_iso(), stats["point_count"], stats["distance_km"], stats["start_utc"], stats["end_utc"], stats["min_alt_m"], stats["max_alt_m"], json.dumps(points)),
        )
        track_id = int(cur.lastrowid)
        for i, p in enumerate(points):
            con.execute(
                "INSERT INTO track_points (track_id, seq, timestamp_utc, latitude, longitude, altitude_m, speed_kmh) VALUES (?, ?, ?, ?, ?, ?, ?)",
                (track_id, i, p.get("time"), p.get("lat"), p.get("lon"), p.get("alt"), p.get("speed_kmh")),
            )
        con.commit()
    after_write("save", "track", track_id, f"flight_id={flight_id}; file={file_name}", backup=True)
    return track_id


def delete_track(track_id: int) -> None:
    with connect() as con:
        con.execute("DELETE FROM flight_tracks WHERE id = ?", (track_id,))
        con.commit()
    after_write("delete", "track", track_id, backup=True)

# -----------------------------------------------------------------------------
# Maps / profiles
# -----------------------------------------------------------------------------

def make_map(tracks: pd.DataFrame, dark_mode: bool = True) -> folium.Map:
    fmap = folium.Map(location=[50.1, 14.4], zoom_start=7, tiles="CartoDB dark_matter" if dark_mode else "OpenStreetMap")
    bounds = []
    for _, row in tracks.iterrows():
        pts = json.loads(row["coordinates_json"])
        coords = [(p["lat"], p["lon"]) for p in pts if p.get("lat") is not None and p.get("lon") is not None]
        if not coords:
            continue
        popup = f"{row.get('date','')} {row.get('registration','')} {row.get('departure','')}–{row.get('arrival','')}"
        folium.PolyLine(coords, weight=1.6, opacity=0.55, popup=popup).add_to(fmap)
        bounds.extend(coords)
    if bounds:
        fmap.fit_bounds(bounds)
    return fmap


def render_track_profile(points: list[dict[str, Any]]) -> None:
    rows = []
    for i, p in enumerate(points):
        t = parse_time_any(p.get("time"))
        rows.append({
            "index": i,
            "time": t.astimezone(LOCAL_TZ) if t else i,
            "Altitude ft": (p.get("alt") or 0) * 3.28084 if p.get("alt") is not None else None,
            "GPS speed km/h": p.get("speed_kmh"),
        })
    df = pd.DataFrame(rows)
    if df.empty:
        return
    fig = go.Figure()
    fig.add_trace(go.Scatter(x=df["time"], y=df["Altitude ft"], name="Altitude ft", mode="lines", line=dict(color="#38bdf8", width=2)))
    fig.add_trace(go.Scatter(x=df["time"], y=df["GPS speed km/h"], name="GPS speed km/h", mode="lines", yaxis="y2", line=dict(color="#f59e0b", width=2)))
    fig.update_layout(
        title="Profil letu",
        xaxis=dict(title="Čas"),
        yaxis=dict(title="Altitude ft"),
        yaxis2=dict(title="GPS speed km/h", overlaying="y", side="right"),
        legend=dict(orientation="h", y=1.08, x=0.5, xanchor="center"),
        template="plotly_dark",
        paper_bgcolor="rgba(0,0,0,0)",
        plot_bgcolor="rgba(0,0,0,0)",
        margin=dict(l=20, r=20, t=55, b=20),
    )
    st.plotly_chart(fig, use_container_width=True)

# -----------------------------------------------------------------------------
# Dashboard / pages
# -----------------------------------------------------------------------------

def dashboard(filtered: pd.DataFrame, all_flights: pd.DataFrame) -> None:
    st.header("Souhrn")
    s = summary_numbers(filtered)
    cols = st.columns(4)
    with cols[0]: metric_card("Celkový nálet", s["block"], f"{s['flights']} letů")
    with cols[1]: metric_card("PIC", s["pic"], f"ULL {s['pic_ull']} · EASA {s['pic_easa']}")
    with cols[2]: metric_card("Dual / Safety", f"{s['dual']} / {s['safety']}", f"Starty {s['starts']}")
    with cols[3]: metric_card("Náklady", s["cost"], f"GPS {s['gps_tracks']} tracků · {s['gps_km']:.0f} km")

    if not filtered.empty:
        by_year = filtered.groupby(["year", "role"], dropna=False)["block_hours"].sum().reset_index()
        fig = px.bar(by_year, x="year", y="block_hours", color="role", title="Nálet podle roku a funkce", labels={"block_hours":"hodiny"})
        st.plotly_chart(plotly_layout(fig), use_container_width=True)
        c1, c2 = st.columns(2)
        with c1:
            top = filtered.groupby("registration")["block_hours"].sum().sort_values(ascending=False).head(12).reset_index()
            fig2 = px.bar(top, x="registration", y="block_hours", title="Top letadla podle block time", labels={"block_hours":"hodiny"})
            st.plotly_chart(plotly_layout(fig2), use_container_width=True)
        with c2:
            ev = filtered.groupby("evidence")["block_hours"].sum().reset_index()
            fig3 = px.pie(ev, names="evidence", values="block_hours", hole=.55, title="ULL / EASA")
            st.plotly_chart(plotly_layout(fig3), use_container_width=True)


def flight_display_df(df: pd.DataFrame) -> pd.DataFrame:
    cols = ["id","date","evidence","registration","aircraft_type","aircraft_class","departure","arrival","off_block","takeoff","landing","on_block","block_time","air_time","starts","commander","instructor","role","task","price_per_hour","cost_label","track_count","gps_km","note"]
    out = df[[c for c in cols if c in df.columns]].copy()
    rename = {"id":"ID","date":"Datum","evidence":"Evidence","registration":"Imatrikulace","aircraft_type":"Typ","aircraft_class":"Třída","departure":"Odlet","arrival":"Přílet","off_block":"Off Block","takeoff":"Takeoff","landing":"Landing","on_block":"On Block","block_time":"Block","air_time":"Air","starts":"Starty","commander":"Velitel","instructor":"Instruktor","role":"Funkce","task":"Úloha","price_per_hour":"Kč/h","cost_label":"Cena","track_count":"GPS","gps_km":"GPS km","note":"Poznámka"}
    return out.rename(columns=rename)


def get_aircraft_defaults(registration: str) -> dict[str, Any]:
    if not registration:
        return {}
    with connect() as con:
        row = con.execute("SELECT * FROM aircraft WHERE registration = ?", (registration.upper().strip(),)).fetchone()
        if row:
            return dict(row)
    return {}


def get_rate_for(registration: str, flight_date: str) -> dict[str, Any]:
    if not registration:
        return {}
    with connect() as con:
        row = con.execute(
            """
            SELECT * FROM rates WHERE registration = ? AND (valid_from IS NULL OR valid_from <= ?)
            ORDER BY valid_from DESC LIMIT 1
            """,
            (registration.upper().replace("OK-", ""), flight_date),
        ).fetchone()
        if not row:
            row = con.execute(
                """
                SELECT * FROM rates WHERE ('OK-' || registration) = ? AND (valid_from IS NULL OR valid_from <= ?)
                ORDER BY valid_from DESC LIMIT 1
                """,
                (registration.upper(), flight_date),
            ).fetchone()
        return dict(row) if row else {}


def flight_form(prefix: str, defaults: dict[str, Any] | None = None, rates: pd.DataFrame | None = None, submit_label: str = "Uložit let") -> dict[str, Any] | None:
    defaults = defaults or {}
    flight_date = st.date_input("Datum", value=pd.to_datetime(defaults.get("date") or date.today()).date(), key=f"{prefix}_date")
    reg_default = defaults.get("registration") or ""
    registration = st.text_input("Imatrikulace", value=reg_default, key=f"{prefix}_reg").upper().strip()
    ac_defaults = get_aircraft_defaults(registration)
    rate = get_rate_for(registration, flight_date.isoformat())
    aircraft_type = st.text_input("Typ", value=defaults.get("aircraft_type") or ac_defaults.get("aircraft_type") or rate.get("aircraft_type") or "", key=f"{prefix}_type")
    c1, c2, c3 = st.columns(3)
    with c1:
        evidence = st.selectbox("Evidence", EVIDENCE_OPTIONS, index=EVIDENCE_OPTIONS.index(defaults.get("evidence")) if defaults.get("evidence") in EVIDENCE_OPTIONS else 0, key=f"{prefix}_evidence")
    with c2:
        aircraft_class = st.selectbox("Třída", CLASS_OPTIONS, index=CLASS_OPTIONS.index(defaults.get("aircraft_class") or ac_defaults.get("aircraft_class")) if (defaults.get("aircraft_class") or ac_defaults.get("aircraft_class")) in CLASS_OPTIONS else 0, key=f"{prefix}_class")
    with c3:
        role = st.selectbox("Funkce", ROLE_OPTIONS, index=ROLE_OPTIONS.index(defaults.get("role")) if defaults.get("role") in ROLE_OPTIONS else 0, key=f"{prefix}_role")
    c4, c5 = st.columns(2)
    with c4:
        departure = st.text_input("Odlet", value=defaults.get("departure") or "", key=f"{prefix}_dep").upper().strip()
        off_block = st.text_input("Off Block", value=defaults.get("off_block") or "", placeholder="HH:MM", key=f"{prefix}_off")
        takeoff = st.text_input("Takeoff", value=defaults.get("takeoff") or "", placeholder="HH:MM", key=f"{prefix}_to")
    with c5:
        arrival = st.text_input("Přílet", value=defaults.get("arrival") or "", key=f"{prefix}_arr").upper().strip()
        on_block = st.text_input("On Block", value=defaults.get("on_block") or "", placeholder="HH:MM", key=f"{prefix}_on")
        landing = st.text_input("Landing", value=defaults.get("landing") or "", placeholder="HH:MM", key=f"{prefix}_ldg")
    c6, c7, c8 = st.columns(3)
    with c6:
        starts = st.number_input("Starty", min_value=0, value=int(defaults.get("starts") or 1), step=1, key=f"{prefix}_starts")
    with c7:
        commander = st.text_input("Velitel", value=defaults.get("commander") or "Točík Filip", key=f"{prefix}_cmd")
    with c8:
        instructor = st.text_input("Instruktor", value="" if defaults.get("instructor") in [None, "None"] else defaults.get("instructor") or "", key=f"{prefix}_instr")
    task = st.text_input("Úloha", value="" if defaults.get("task") in [None, "None"] else defaults.get("task") or "", key=f"{prefix}_task")
    default_price = defaults.get("price_per_hour") or rate.get("price_per_hour") or ac_defaults.get("default_price_per_hour") or 0.0
    price = st.number_input("Cena Kč/h", min_value=0.0, value=float(default_price or 0.0), step=10.0, key=f"{prefix}_price")
    note = st.text_area("Poznámka", value="" if defaults.get("note") in [None, "None"] else defaults.get("note") or "", key=f"{prefix}_note")
    block_min = minutes_diff(off_block, on_block)
    air_min = minutes_diff(takeoff, landing)
    st.caption(f"Block: {fmt_minutes(block_min)} · Air: {fmt_minutes(air_min)} · Náklad: {fmt_money((block_min or 0)/60*price)}")
    if st.button(submit_label, type="primary", use_container_width=True, key=f"{prefix}_submit"):
        errors = []
        if not registration: errors.append("imatrikulace")
        if not departure: errors.append("odlet")
        if not arrival: errors.append("přílet")
        for label, val in {"off block": off_block, "on block": on_block, "takeoff": takeoff, "landing": landing}.items():
            if val and parse_time_to_minutes(val) is None: errors.append(label)
        if errors:
            st.error("Zkontroluj pole: " + ", ".join(errors))
            return None
        return {"date": flight_date.isoformat(), "evidence": evidence, "registration": registration, "aircraft_type": aircraft_type, "aircraft_class": aircraft_class, "departure": departure, "arrival": arrival, "off_block": normalize_time(off_block), "takeoff": normalize_time(takeoff), "landing": normalize_time(landing), "on_block": normalize_time(on_block), "starts": int(starts), "commander": commander, "instructor": instructor, "role": role, "task": task, "price_per_hour": price, "note": note}
    return None


def insert_flight(data: dict[str, Any]) -> int:
    fields = ["date","evidence","registration","aircraft_type","aircraft_class","departure","arrival","off_block","takeoff","landing","on_block","starts","commander","instructor","role","task","price_per_hour","note"]
    with connect() as con:
        cur = con.execute(
            f"INSERT INTO flights ({', '.join(fields)}) VALUES ({', '.join(['?']*len(fields))})",
            tuple(data.get(f) for f in fields),
        )
        flight_id = int(cur.lastrowid)
        con.commit()
    after_write("insert", "flight", flight_id, backup=True)
    return flight_id


def update_flight(flight_id: int, data: dict[str, Any]) -> None:
    fields = ["date","evidence","registration","aircraft_type","aircraft_class","departure","arrival","off_block","takeoff","landing","on_block","starts","commander","instructor","role","task","price_per_hour","note"]
    with connect() as con:
        con.execute(
            f"UPDATE flights SET {', '.join([f + ' = ?' for f in fields])} WHERE id = ?",
            tuple(data.get(f) for f in fields) + (flight_id,),
        )
        con.commit()
    after_write("update", "flight", flight_id, backup=True)


def flight_detail_dialog(selected_id: int, row: dict[str, Any], rates: pd.DataFrame, dark_mode: bool) -> None:
    @st.dialog(f"Detail letu ID {selected_id}", width="large")
    def _dialog():
        _flight_detail_content(selected_id, row, rates, dark_mode)
    _dialog()


def clear_open_flight_dialog() -> None:
    st.session_state.pop("open_flight_dialog_id", None)
    st.session_state.pop("selected_flight_id", None)


def _flight_detail_content(selected_id: int, row: dict[str, Any], rates: pd.DataFrame, dark_mode: bool) -> None:
    detail_section = st.radio("Sekce", ["Přehled", "Editace", "Track"], horizontal=True, label_visibility="collapsed", key=f"detail_tabs_{selected_id}")
    if detail_section == "Přehled":
        c1, c2, c3, c4 = st.columns(4)
        with c1: metric_card("Block", row.get("block_time"), f"Air {row.get('air_time')}")
        with c2: metric_card("Trasa", f"{row.get('departure')}–{row.get('arrival')}", row.get("registration"))
        with c3: metric_card("Funkce", row.get("role"), row.get("evidence"))
        with c4: metric_card("Cena", row.get("cost_label"), f"GPS {int(row.get('track_count') or 0)}")
        st.dataframe(pd.DataFrame([{
            "Datum": row.get("date"), "Evidence": row.get("evidence"), "Imatrikulace": row.get("registration"), "Typ": row.get("aircraft_type"),
            "Třída": row.get("aircraft_class"), "Odlet": row.get("departure"), "Přílet": row.get("arrival"), "Off Block": row.get("off_block"),
            "Takeoff": row.get("takeoff"), "Landing": row.get("landing"), "On Block": row.get("on_block"), "Starty": row.get("starts"),
            "Velitel": row.get("commander"), "Instruktor": row.get("instructor"), "Úloha": row.get("task"), "Kč/h": row.get("price_per_hour"), "Poznámka": row.get("note"),
        }]), hide_index=True, use_container_width=True)
    elif detail_section == "Editace":
        if not is_admin():
            st.info("Editace je dostupná jen po přihlášení jako admin.")
        else:
            saved = flight_form(f"edit_flight_{selected_id}", row, rates, "Uložit změny")
            if saved is not None:
                update_flight(int(selected_id), saved)
                st.success("Změny uloženy.")
                clear_open_flight_dialog()
                st.rerun()
    elif detail_section == "Track":
        flight_tracks = read_tracks_for_flight(int(selected_id))
        if not flight_tracks.empty:
            joined = read_tracks_joined()
            st_folium(make_map(joined[joined["flight_id"].eq(int(selected_id))], dark_mode), height=440, use_container_width=True, key=f"track_map_existing_{selected_id}_{len(flight_tracks)}")
            first_points = json.loads(flight_tracks.iloc[0]["coordinates_json"])
            render_track_profile(first_points)
            show = flight_tracks[["id","file_name","point_count","distance_km","start_utc","end_utc","max_alt_m"]].rename(columns={"id":"Track ID","file_name":"Soubor","point_count":"Body","distance_km":"Km","start_utc":"Start UTC","end_utc":"End UTC","max_alt_m":"Max alt m"})
            st.dataframe(show, hide_index=True, use_container_width=True)
            del_id = st.selectbox("Smazat track", show["Track ID"].tolist(), format_func=lambda x: f"Track ID {x}")
            if st.button("Smazat vybraný track", type="secondary", disabled=not is_admin(), use_container_width=True):
                if require_admin():
                    delete_track(int(del_id)); st.success("Track smazán."); st.rerun()
        else:
            st.info("K letu zatím není připojený track.")
        uploaded = st.file_uploader("Přidat / nahradit KML track", type=["kml"], key=f"attach_track_{selected_id}")
        if uploaded is not None:
            try:
                points = parse_kml_bytes(uploaded.read())
                if len(points) >= 2:
                    preview = pd.DataFrame([{"id": -1,"flight_id": selected_id,"coordinates_json": json.dumps(points),"file_name": uploaded.name,"distance_km": track_stats(points)["distance_km"],"date": row.get("date"),"registration": row.get("registration"),"departure": row.get("departure"),"arrival": row.get("arrival"),"role": row.get("role"),"evidence": row.get("evidence")}])
                    st_folium(make_map(preview, dark_mode), height=360, use_container_width=True, key=f"track_map_preview_{selected_id}_{uploaded.name}_{len(points)}")
                    replace = st.checkbox("Nahradit existující tracky u tohoto letu", value=True, key=f"replace_track_{selected_id}_{uploaded.name}")
                    if st.button("Uložit track k letu", type="primary", disabled=not is_admin(), use_container_width=True):
                        if require_admin():
                            save_track(int(selected_id), uploaded.name, points, replace_existing=replace)
                            st.success("Track uložen."); st.rerun()
                else:
                    st.error("V KML nejsou použitelné body.")
            except Exception as exc:
                st.error(f"KML / náhled se nepodařilo zpracovat: {exc}")
    if st.button("Zavřít detail", use_container_width=True):
        clear_open_flight_dialog()
        st.rerun()



def _is_blank(value: Any) -> bool:
    """Return True for None, NaN/NaT/pd.NA and textual empty markers.

    User-added flights may have optional fields blank. The list view must never crash
    on missing aircraft type/class, route, task, price, etc.
    """
    if value is None:
        return True
    try:
        if pd.isna(value):
            return True
    except Exception:
        pass
    text = str(value).strip()
    return text == "" or text.lower() in {"none", "nan", "nat", "<na>"}


def _clean_text(value: Any) -> str:
    return "" if _is_blank(value) else str(value).strip()


def _safe_text(value: Any) -> str:
    text = _clean_text(value)
    return text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def _join_nonblank(values: list[Any] | tuple[Any, ...], sep: str = " • ") -> str:
    return sep.join(_clean_text(v) for v in values if not _is_blank(v))


def _range_text(start: Any, end: Any, sep: str = "–") -> str:
    left = _clean_text(start)
    right = _clean_text(end)
    if left and right:
        return f"{left}{sep}{right}"
    return left or right


def _safe_float(value: Any, default: float = 0.0) -> float:
    if _is_blank(value):
        return default
    try:
        number = float(value)
        if math.isnan(number) or math.isinf(number):
            return default
        return number
    except Exception:
        return default


def _safe_int(value: Any, default: int = 0) -> int:
    try:
        return int(round(_safe_float(value, float(default))))
    except Exception:
        return default


def _price_rate_label(value: Any) -> str:
    if _is_blank(value):
        return ""
    return f"{_safe_float(value):.0f} Kč/h"


def _cell(main: Any, sub: Any = "") -> str:
    main_txt = _safe_text(main)
    sub_txt = _safe_text(sub)
    if sub_txt:
        return f'<div class="flight-cell"><div class="flight-cell-main">{main_txt}</div><div class="flight-cell-sub">{sub_txt}</div></div>'
    return f'<div class="flight-cell"><div class="flight-cell-main">{main_txt}</div></div>'


def render_flight_list(table_df: pd.DataFrame, rates: pd.DataFrame, dark_mode: bool) -> None:
    """Compact paginated flight list with one real Detail button per visible row."""
    if table_df.empty:
        st.info("Filtr nevrátil žádné lety.")
        return

    display_df = flight_display_df(table_df).copy()

    controls = st.columns([1.0, 2.4, 1.0, 1.0])
    with controls[0]:
        page_size_choice = st.selectbox("Řádků", [25, 50, 100, "Vše"], index=0, key="flight_page_size_v14")
    with controls[1]:
        quick_filter = st.text_input("Rychlé hledání", value="", placeholder="registrace, letiště, typ, funkce…", key="flight_table_quick_filter_v14")

    if quick_filter.strip():
        q = quick_filter.strip().lower()
        mask = display_df.astype(str).apply(lambda col: col.str.lower().str.contains(q, na=False)).any(axis=1)
        shown_display = display_df[mask].copy()
        shown_table = table_df.loc[shown_display.index].copy()
    else:
        shown_display = display_df.copy()
        shown_table = table_df.copy()

    shown_display = shown_display.reset_index(drop=True)
    shown_table = shown_table.reset_index(drop=True)

    total_rows = len(shown_table)
    show_all_rows = page_size_choice == "Vše"
    page_size = total_rows if show_all_rows else int(page_size_choice)
    page_size = max(1, page_size)
    page_count = max(1, math.ceil(total_rows / page_size))
    with controls[2]:
        if show_all_rows:
            page = 1
            st.text_input("Stránka", value="Vše", disabled=True, key="flight_page_all_v14")
        else:
            page = st.number_input("Stránka", min_value=1, max_value=page_count, value=min(int(st.session_state.get("flight_page_v14", page_count)), page_count), step=1, key="flight_page_v14")
    with controls[3]:
        st.markdown(f'<div class="flight-page-info">{total_rows} letů • {page_count} stran</div>', unsafe_allow_html=True)

    start = 0 if show_all_rows else (int(page) - 1) * page_size
    end = total_rows if show_all_rows else start + page_size
    page_rows = shown_table.iloc[start:end].copy()

    st.markdown('<div class="flight-list-note">Detail otevřeš přímo tlačítkem u konkrétního letu.</div>', unsafe_allow_html=True)

    widths = [0.72, 0.48, 0.88, 0.62, 1.25, 1.02, 1.05, 0.82, 0.52, 0.92, 1.22, 0.92, 0.78, 0.50]
    headers = ["Detail", "ID", "Datum", "Ev.", "Letadlo", "Trasa", "Časy", "Block", "St.", "Funkce", "Velitel", "Úloha", "Cena", "GPS"]
    hcols = st.columns(widths, gap="small", vertical_alignment="top")
    for col, header in zip(hcols, headers):
        col.markdown(f'<div class="flight-list-head">{header}</div>', unsafe_allow_html=True)

    for _, row in page_rows.iterrows():
        try:
            flight_id = int(row.get("id"))
        except Exception:
            continue
        cols = st.columns(widths, gap="small", vertical_alignment="top")
        with cols[0]:
            if st.button("Detail", key=f"flight_detail_btn_{flight_id}", use_container_width=True):
                st.session_state["open_flight_dialog_id"] = flight_id
                st.session_state["selected_flight_id"] = flight_id
                st.session_state.pop("dismissed_flight_id", None)
        cols[1].markdown(_cell(flight_id), unsafe_allow_html=True)
        cols[2].markdown(_cell(row.get("date")), unsafe_allow_html=True)
        cols[3].markdown(_cell(row.get("evidence")), unsafe_allow_html=True)
        aircraft_sub = _join_nonblank([row.get("aircraft_type"), row.get("aircraft_class")])
        cols[4].markdown(_cell(row.get("registration"), aircraft_sub), unsafe_allow_html=True)
        cols[5].markdown(_cell(_range_text(row.get("departure"), row.get("arrival"))), unsafe_allow_html=True)
        time_main = _range_text(row.get("off_block"), row.get("on_block"))
        air_range = _range_text(row.get("takeoff"), row.get("landing"))
        time_sub = f"Air {air_range}" if air_range else ""
        cols[6].markdown(_cell(time_main, time_sub), unsafe_allow_html=True)
        cols[7].markdown(_cell(row.get("block_time"), f"Air {_clean_text(row.get('air_time'))}" if not _is_blank(row.get("air_time")) else ""), unsafe_allow_html=True)
        cols[8].markdown(_cell(_safe_int(row.get("starts"))), unsafe_allow_html=True)
        cols[9].markdown(_cell(row.get("role")), unsafe_allow_html=True)
        cols[10].markdown(_cell(row.get("commander"), row.get("instructor") if not _is_blank(row.get("instructor")) else ""), unsafe_allow_html=True)
        cols[11].markdown(_cell(row.get("task")), unsafe_allow_html=True)
        cols[12].markdown(_cell(row.get("cost_label"), _price_rate_label(row.get("price_per_hour"))), unsafe_allow_html=True)
        gps_km = _safe_float(row.get("gps_km"))
        cols[13].markdown(_cell(_safe_int(row.get("track_count")), f"{gps_km:.0f} km"), unsafe_allow_html=True)
        st.markdown('<div class="flight-row-sep"></div>', unsafe_allow_html=True)

    open_id = st.session_state.get("open_flight_dialog_id")
    valid_ids = set(table_df["id"].dropna().astype(int).tolist())
    if open_id is not None and int(open_id) in valid_ids:
        dialog_row = table_df[table_df["id"].astype(int).eq(int(open_id))].iloc[0]
        flight_detail_dialog(int(open_id), dialog_row.to_dict(), rates, dark_mode)


def page_logbook(flights: pd.DataFrame, rates: pd.DataFrame, dark_mode: bool) -> None:
    st.header("Lety")
    filtered = apply_filters(flights, "logbook")
    s = summary_numbers(filtered)
    cols = st.columns(4)
    with cols[0]: metric_card("Zobrazeno", str(s["flights"]), "letů")
    with cols[1]: metric_card("Celkem", s["block"], "block time")
    with cols[2]: metric_card("PIC", s["pic"], "z filtrovaných letů")
    with cols[3]: metric_card("GPS", str(s["gps_tracks"]), f"{s['gps_km']:.0f} km")
    render_flight_list(filtered.sort_values(["date", "off_block", "id"]), rates, dark_mode)


def page_new_flight(rates: pd.DataFrame, dark_mode: bool) -> None:
    st.header("Přidat let")
    mode = st.radio("Způsob zadání", ["Ručně", "Z KML tracku"], horizontal=True)
    if mode == "Z KML tracku":
        uploaded = st.file_uploader("Nahraj KML", type=["kml"])
        if uploaded:
            try:
                points = parse_kml_bytes(uploaded.read())
                if len(points) < 2:
                    st.error("V KML nejsou použitelné body.")
                    return
                suggestion = suggest_flight_from_track(points, uploaded.name)
                if suggestion.get("warning"):
                    st.warning(suggestion["warning"])
                stats = suggestion["stats"]
                st.success(f"Track načten: {stats['point_count']} bodů · {stats['distance_km']:.1f} km")
                st_folium(make_map(pd.DataFrame([{"coordinates_json": json.dumps(points), "date": suggestion["date"], "registration": suggestion.get("registration"), "departure": suggestion.get("departure"), "arrival": suggestion.get("arrival"), "role": "PIC"}]), dark_mode), height=420, use_container_width=True, key=f"new_track_map_{uploaded.name}_{len(points)}")
                render_track_profile(points)
                defaults = {
                    "date": suggestion["date"], "registration": suggestion.get("registration") or "", "departure": suggestion.get("departure") or "", "arrival": suggestion.get("arrival") or "",
                    "off_block": suggestion.get("off_block") or "", "takeoff": suggestion.get("takeoff") or "", "landing": suggestion.get("landing") or "", "on_block": suggestion.get("on_block") or "",
                    "starts": 1, "role": "PIC", "commander": "Točík Filip",
                }
                saved = flight_form("new_from_kml", defaults, rates, "Uložit let a připojit track")
                if saved is not None:
                    if require_admin():
                        fid = insert_flight(saved)
                        save_track(fid, uploaded.name, points, replace_existing=True)
                        st.success(f"Let ID {fid} uložen včetně tracku.")
                        st.rerun()
            except Exception as exc:
                st.error(f"KML se nepodařilo načíst: {exc}")
    else:
        saved = flight_form("new_manual", {}, rates, "Uložit let")
        if saved is not None:
            if require_admin():
                fid = insert_flight(saved)
                st.success(f"Let ID {fid} uložen.")
                st.rerun()


def page_map(dark_mode: bool) -> None:
    st.header("Mapa")
    tracks = read_tracks_joined()
    if tracks.empty:
        st.info("Zatím nejsou nahrané žádné GPS tracky.")
        return
    st.caption("Mapa zobrazuje všechny uložené tracky. Čáry jsou schválně tenké a plné, aby mapa zůstala přehledná i při větším počtu letů.")
    st_folium(make_map(tracks, dark_mode), height=650, use_container_width=True, key=f"all_tracks_map_{len(tracks)}")
    st.dataframe(tracks[["date","registration","departure","arrival","distance_km","point_count","role"]], hide_index=True, use_container_width=True)


def page_rates() -> None:
    st.header("Ceník")
    rates = read_table("rates")
    if rates.empty:
        rates = pd.DataFrame(columns=["id", "registration", "aircraft_type", "valid_from", "price_per_hour", "dry_price_per_hour", "source"])
    display = rates.rename(columns={"id":"ID","registration":"Imatrikulace","aircraft_type":"Typ","valid_from":"Od data","price_per_hour":"Cena Kč/h","dry_price_per_hour":"Suchá hodina Kč/h","source":"Zdroj"})
    st.dataframe(display, hide_index=True, use_container_width=True)
    if is_admin():
        with st.expander("Přidat sazbu"):
            reg = st.text_input("Imatrikulace", key="rate_reg").upper().strip()
            typ = st.text_input("Typ", key="rate_type")
            valid = st.date_input("Platí od", key="rate_valid")
            price = st.number_input("Cena Kč/h", min_value=0.0, step=10.0, key="rate_price")
            dry = st.number_input("Suchá hodina Kč/h", min_value=0.0, step=10.0, key="rate_dry")
            if st.button("Uložit sazbu", type="primary") and reg:
                with connect() as con:
                    con.execute("INSERT OR REPLACE INTO rates (registration, aircraft_type, valid_from, price_per_hour, dry_price_per_hour, source) VALUES (?, ?, ?, ?, ?, ?)", (reg, typ, valid.isoformat(), price, dry, "manual"))
                    con.commit()
                after_write("upsert", "rate", reg, backup=True); st.rerun()


def page_database() -> None:
    st.header("Databáze")
    tabs = st.tabs(["Letiště", "Letadla", "Záloha", "Meta"])
    with tabs[0]:
        airports = read_airports(False)
        st.caption(f"Letiště v databázi: {len(airports):,}".replace(",", " "))
        q = st.text_input("Hledat letiště", placeholder="LKSZ, Sazená, LKPR…")
        view = airports
        if q:
            ql = q.lower()
            view = airports[airports.astype(str).apply(lambda col: col.str.lower().str.contains(ql, na=False)).any(axis=1)]
        st.dataframe(view[["ident","name","type","iso_country","municipality","latitude_deg","longitude_deg","active","source","priority"]].head(1000), hide_index=True, use_container_width=True)
        st.download_button("Export letišť CSV", data=airports.to_csv(index=False).encode("utf-8"), file_name="airports_export.csv")
        if is_admin():
            with st.expander("Ručně přidat / opravit letiště"):
                ident = st.text_input("Ident", key="apt_ident").upper().strip()
                name = st.text_input("Název", key="apt_name")
                typ = st.text_input("Typ", value="small_airport", key="apt_type")
                lat = st.number_input("Latitude", value=50.0, format="%.6f", key="apt_lat")
                lon = st.number_input("Longitude", value=14.0, format="%.6f", key="apt_lon")
                country = st.text_input("ISO country", value="CZ", key="apt_country")
                active = st.checkbox("Aktivní", value=True, key="apt_active")
                if st.button("Uložit letiště", type="primary") and ident:
                    with connect() as con:
                        upsert_airport(con, {"ident": ident, "icao_code": ident if len(ident)==4 else None, "iata_code": None, "local_code": ident, "name": name, "type": typ, "latitude_deg": lat, "longitude_deg": lon, "elevation_ft": None, "continent": "EU", "iso_country": country, "iso_region": None, "municipality": None, "scheduled_service": None, "gps_code": ident if len(ident)==4 else None, "home_link": None, "wikipedia_link": None, "keywords": None, "source": "manual", "active": 1 if active else 0, "priority": 100, "note": "manual override", "updated_at": now_utc_iso()})
                        con.commit()
                    after_write("upsert", "airport", ident, backup=True); st.rerun()
    with tabs[1]:
        aircraft = read_table("aircraft")
        if aircraft.empty:
            aircraft = pd.DataFrame(columns=["id","registration","aircraft_type","icao_type","aircraft_class","evidence","default_price_per_hour","active","note"])
        display = aircraft.rename(columns={"id":"ID","registration":"Imatrikulace","aircraft_type":"Typ","icao_type":"ICAO typ","aircraft_class":"Třída","evidence":"Evidence","default_price_per_hour":"Výchozí Kč/h","active":"Aktivní","note":"Poznámka"})
        st.dataframe(display, hide_index=True, use_container_width=True)
        if is_admin():
            with st.expander("Přidat / opravit letadlo"):
                reg = st.text_input("Imatrikulace", key="ac_reg").upper().strip()
                typ = st.text_input("Typ", key="ac_type")
                icao = st.text_input("ICAO typ", key="ac_icao")
                klass = st.selectbox("Třída", CLASS_OPTIONS, key="ac_class")
                ev = st.selectbox("Evidence", EVIDENCE_OPTIONS, key="ac_ev")
                price = st.number_input("Výchozí Kč/h", min_value=0.0, step=10.0, key="ac_price")
                note = st.text_input("Poznámka", key="ac_note")
                if st.button("Uložit letadlo", type="primary") and reg:
                    with connect() as con:
                        con.execute("""
                            INSERT INTO aircraft (registration, aircraft_type, icao_type, aircraft_class, evidence, default_price_per_hour, active, note, created_at, updated_at)
                            VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?)
                            ON CONFLICT(registration) DO UPDATE SET aircraft_type=excluded.aircraft_type, icao_type=excluded.icao_type, aircraft_class=excluded.aircraft_class, evidence=excluded.evidence, default_price_per_hour=excluded.default_price_per_hour, active=1, note=excluded.note, updated_at=excluded.updated_at
                        """, (reg, typ, icao, klass, ev, price, note, now_utc_iso(), now_utc_iso()))
                        con.commit()
                    after_write("upsert", "aircraft", reg, backup=True); st.rerun()
    with tabs[2]:
        dirty = get_meta("dirty", "0") == "1"
        last = get_meta("last_github_backup", "")
        st.write("Stav změn:", "čeká na zálohu" if dirty else "zálohováno / bez změn")
        st.write("Poslední GitHub záloha:", last or "zatím není")
        if st.session_state.get("last_backup_status"):
            ok, msg = st.session_state["last_backup_status"]
            (st.success if ok else st.warning)(msg)
        st.download_button("Stáhnout SQLite databázi", data=DB_PATH.read_bytes() if DB_PATH.exists() else b"", file_name="logbook.sqlite")
        restore = st.file_uploader("Obnovit databázi ze zálohy SQLite", type=["sqlite", "db"])
        if restore and st.button("Obnovit databázi", type="secondary", disabled=not is_admin()):
            if require_admin():
                backup_name = BASE_DIR / "data" / f"logbook_before_restore_{datetime.now().strftime('%Y%m%d_%H%M%S')}.sqlite"
                if DB_PATH.exists(): shutil.copy2(DB_PATH, backup_name)
                DB_PATH.write_bytes(restore.read())
                after_write("restore", "database", backup=True)
                st.success("Databáze obnovena."); st.rerun()
        if st.button("Uložit aktuální databázi na GitHub", type="primary", disabled=not is_admin()):
            if require_admin():
                ok, msg = github_backup_database(auto=False)
                if ok: st.success(msg)
                else: st.error(msg)
    with tabs[3]:
        st.dataframe(read_table("app_meta"), hide_index=True, use_container_width=True)
        st.dataframe(read_table("audit_log").tail(200), hide_index=True, use_container_width=True)


def page_export(flights: pd.DataFrame) -> None:
    st.header("Export")
    output = BytesIO()
    wb = Workbook()
    ws = wb.active
    ws.title = "Logbook"
    headers = ["Datum","Evidence","Imatrikulace","Typ","Třída","Odlet","Přílet","Off Block","Takeoff","Landing","On Block","Block","Air","Starty","Velitel","Instruktor","Funkce","Úloha","Kč/h","Cena","GPS tracky","GPS km","Poznámka"]
    ws.append(headers)
    for _, r in flights.iterrows():
        ws.append([r.get("date"), r.get("evidence"), r.get("registration"), r.get("aircraft_type"), r.get("aircraft_class"), r.get("departure"), r.get("arrival"), r.get("off_block"), r.get("takeoff"), r.get("landing"), r.get("on_block"), fmt_minutes(r.get("block_minutes")), fmt_minutes(r.get("air_minutes")), int(r.get("starts") or 0), r.get("commander"), r.get("instructor"), r.get("role"), r.get("task"), float(r.get("price_per_hour") or 0), float(r.get("cost") or 0), int(r.get("track_count") or 0), float(r.get("gps_km") or 0), r.get("note")])
    for col in range(1, len(headers)+1):
        ws.cell(1, col).font = Font(bold=True)
        ws.column_dimensions[get_column_letter(col)].width = 15
    wb.save(output)
    st.download_button("Stáhnout Excel", output.getvalue(), "letovy_zapisnik_export.xlsx")
    st.download_button("Stáhnout CSV", flights.to_csv(index=False).encode("utf-8"), "letovy_zapisnik_export.csv")

# -----------------------------------------------------------------------------
# Sidebar / main
# -----------------------------------------------------------------------------

def sidebar_nav() -> str:
    with st.sidebar:
        st.markdown("## Letový zápisník")
        st.caption(APP_VERSION)
        st.markdown("### Navigace")
        pages = ["Souhrn", "Lety", "Přidat let", "Mapa", "Ceník", "Databáze", "Export"]
        current = st.session_state.get("page", "Souhrn")
        if current not in pages:
            current = "Souhrn"
        for p in pages:
            if st.button(p, key=f"nav_{p}", use_container_width=True, type="primary" if p == current else "secondary"):
                st.session_state["page"] = p
                st.rerun()
        st.markdown("---")
        with st.expander("Správa aplikace", expanded=False):
            if is_admin():
                st.success("Přihlášeno jako správce.")
                if st.button("Odhlásit", use_container_width=True):
                    st.session_state["is_admin"] = False
                    st.rerun()
            else:
                pwd = st.text_input("Admin heslo", type="password")
                if st.button("Přihlásit", use_container_width=True):
                    expected = get_secret(["auth", "admin_password"], "")
                    if expected and pwd == expected:
                        st.session_state["is_admin"] = True
                        st.rerun()
                    else:
                        st.error("Nesprávné heslo nebo není nastavené Secrets.")
            dirty = get_meta("dirty", "0") == "1"
            st.caption("DB: čeká na zálohu" if dirty else "DB: OK")
    return st.session_state.get("page", "Souhrn")


def main() -> None:
    st.set_page_config(page_title="Letový zápisník", page_icon="✈️", layout="wide", initial_sidebar_state="expanded", menu_items={})
    dark_mode = True
    apply_ui_theme(dark_mode)
    page = sidebar_nav()
    app_header()
    flights = read_flights()
    rates = read_table("rates")
    if page == "Souhrn": dashboard(flights, flights)
    elif page == "Lety": page_logbook(flights, rates, dark_mode)
    elif page == "Přidat let": page_new_flight(rates, dark_mode)
    elif page == "Mapa": page_map(dark_mode)
    elif page == "Ceník": page_rates()
    elif page == "Databáze": page_database()
    elif page == "Export": page_export(flights)

if __name__ == "__main__":
    main()
