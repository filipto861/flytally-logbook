from __future__ import annotations

import json
import math
import re
import sqlite3
import xml.etree.ElementTree as ET
from datetime import date, datetime, time, timezone
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

BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / "data" / "logbook.sqlite"
APP_VERSION = "v0.4"
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
"""

# Minimal letiště database pro automatický návrh z GPS tracku. Dá se kdykoliv rozšířit.
AIRPORTS = [
    ("LKSZ", "Sazená", 50.3247, 14.2589),
    ("LKLT", "Praha Letňany", 50.1314, 14.5256),
    ("LKVO", "Vodochody", 50.2166, 14.3958),
    ("LKPR", "Praha Ruzyně", 50.1008, 14.2632),
    ("LKPS", "Plasy", 49.9208, 13.3769),
    ("LKLN", "Plzeň Líně", 49.6752, 13.2746),
    ("LKKM", "Kroměříž", 49.2856, 17.4158),
    ("LKKU", "Kunovice", 49.0294, 17.4397),
    ("LKJC", "Jičín", 50.4291, 15.3332),
    ("LKMH", "Mnichovo Hradiště", 50.5402, 15.0066),
    ("LKKMB", "Mladá Boleslav", 50.3989, 14.8983),
    ("EDNY", "Friedrichshafen", 47.6713, 9.5115),
    ("LOWZ", "Zell am See", 47.2922, 12.7875),
    ("LOWL", "Linz", 48.2332, 14.1875),
    ("EDAZ", "Schönhagen", 52.2036, 13.1564),
    ("LIPB", "Bolzano", 46.4602, 11.3264),
    ("LIPV", "Venezia Lido", 45.4283, 12.3881),
    ("LDPM", "Medulin", 44.8197, 13.9361),
    ("LDSB", "Brač", 43.2857, 16.6797),
    ("LJMB", "Maribor", 46.4799, 15.6861),
    ("LJBO", "Bovec", 46.3311, 13.5522),
    ("LOGM", "Mariazell", 47.7886, 15.3019),
    ("LOGK", "Kapfenberg", 47.4583, 15.3292),
    ("LOLO", "Linz-Ost", 48.3000, 14.3330),
]
AIRPORT_DF = pd.DataFrame(AIRPORTS, columns=["code", "name", "lat", "lon"])

# -----------------------------------------------------------------------------
# Database
# -----------------------------------------------------------------------------

def connect() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    con = sqlite3.connect(DB_PATH)
    con.row_factory = sqlite3.Row
    con.executescript(SCHEMA)
    return con


def read_table(table: str) -> pd.DataFrame:
    with connect() as con:
        return pd.read_sql_query(f"SELECT * FROM {table}", con)


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
    /* Hide Streamlit chrome / reserved header spacing as much as Streamlit Cloud allows. */
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
    .app-title-main {{font-size:1.55rem;font-weight:850;color:var(--text);line-height:1.1;}}
    .app-title-sub {{font-size:.86rem;color:var(--muted);margin-top:.18rem;}}
    .app-badge {{font-size:.78rem;font-weight:800;color:#031421;background:linear-gradient(135deg,var(--accent),#a7f3d0);border-radius:999px;padding:.38rem .72rem;white-space:nowrap;}}
    .metric-card {{border:1px solid var(--border);border-radius:18px;padding:1rem 1.05rem;background:linear-gradient(180deg,rgba(255,255,255,.04),transparent),var(--panel);box-shadow:0 12px 30px var(--shadow);min-height:108px;}}
    .metric-label {{color:var(--muted);font-size:.75rem;text-transform:uppercase;letter-spacing:.08em;font-weight:800;}}
    .metric-value {{color:var(--text);font-size:1.72rem;line-height:1.25;font-weight:850;margin-top:.25rem;}}
    .metric-sub {{color:var(--muted);font-size:.82rem;margin-top:.28rem;}}
    .section-card {{border:1px solid var(--border);border-radius:18px;padding:1rem;background:var(--panel);box-shadow:0 10px 28px var(--shadow);}}
    .pill {{display:inline-block;border:1px solid var(--border);border-radius:999px;background:var(--panel2);padding:.25rem .62rem;margin:.1rem .18rem;font-size:.82rem;color:var(--text);}}
    div[data-testid="stDataFrame"], div[data-testid="stDataEditor"] {{border-radius:16px;overflow:hidden;}}
    .stTabs [data-baseweb="tab-list"] {{gap:.45rem;}}
    .stTabs [data-baseweb="tab"] {{border-radius:999px;padding:.45rem .9rem;background:var(--panel2);}}
    button[kind="primary"] {{border-radius:12px;}}
    @media (max-width: 760px) {{.block-container {{padding-left:.75rem;padding-right:.75rem;}} .app-title {{padding:.85rem;border-radius:15px;}} .app-title-main {{font-size:1.2rem;}} .metric-value {{font-size:1.35rem;}}}}
    </style>
    """, unsafe_allow_html=True)


def app_header(subtitle: str = "Lokální pilotní evidence • ULL / EASA • náklady • GPS tracky") -> None:
    st.markdown(f"""
    <div class="app-title">
      <div><div class="app-title-main">✈️ Letový zápisník</div><div class="app-title-sub">{subtitle}</div></div>
      <div class="app-badge">{APP_VERSION}</div>
    </div>
    """, unsafe_allow_html=True)


def metric_card(label: str, value: str, sub: str = "") -> None:
    st.markdown(f"""
    <div class="metric-card"><div class="metric-label">{label}</div><div class="metric-value">{value}</div><div class="metric-sub">{sub}</div></div>
    """, unsafe_allow_html=True)


def plotly_layout(fig):
    fig.update_layout(template="plotly_dark", paper_bgcolor="rgba(0,0,0,0)", plot_bgcolor="rgba(0,0,0,0)", font=dict(color="#e5edf7"), margin=dict(l=10, r=10, t=45, b=10), legend=dict(orientation="h", yanchor="bottom", y=1.02, xanchor="right", x=1))
    fig.update_xaxes(gridcolor="rgba(148,163,184,.18)")
    fig.update_yaxes(gridcolor="rgba(148,163,184,.18)")
    return fig

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
    with st.sidebar:
        st.markdown("### Filtry")
        selected_years = st.multiselect("Rok", years, default=years, key=f"{key_prefix}_years")
        selected_evidence = st.multiselect("Evidence", EVIDENCE_OPTIONS, default=EVIDENCE_OPTIONS, key=f"{key_prefix}_ev")
        selected_roles = st.multiselect("Funkce", roles, default=roles, key=f"{key_prefix}_roles")
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


def totals(df: pd.DataFrame) -> dict[str, Any]:
    if df.empty:
        return {"flights": 0, "starts": 0, "block": "0:00", "air": "0:00", "pic": "0:00", "pic_ull": "0:00", "pic_easa": "0:00", "dual": "0:00", "safety": "0:00", "ull": "0:00", "easa": "0:00", "cost": "0 Kč", "gps_km": 0.0, "tracks": 0}
    pic = df[df["role"] == "PIC"]
    return {
        "flights": len(df),
        "starts": int(df["starts"].sum()),
        "block": fmt_minutes(df["block_minutes"].sum()),
        "air": fmt_minutes(df["air_minutes"].sum()),
        "pic": fmt_minutes(pic["block_minutes"].sum()),
        "pic_ull": fmt_minutes(pic[pic["evidence"] == "ULL"]["block_minutes"].sum()),
        "pic_easa": fmt_minutes(pic[pic["evidence"] == "EASA"]["block_minutes"].sum()),
        "dual": fmt_minutes(df[df["role"] == "DUAL"]["block_minutes"].sum()),
        "safety": fmt_minutes(df[df["role"] == "SAFETY PILOT"]["block_minutes"].sum()),
        "ull": fmt_minutes(df[df["evidence"] == "ULL"]["block_minutes"].sum()),
        "easa": fmt_minutes(df[df["evidence"] == "EASA"]["block_minutes"].sum()),
        "cost": fmt_money(df["cost"].sum()),
        "gps_km": float(df["gps_km"].sum()) if "gps_km" in df.columns else 0.0,
        "tracks": int(df["track_count"].sum()) if "track_count" in df.columns else 0,
    }

# -----------------------------------------------------------------------------
# KML parsing
# -----------------------------------------------------------------------------

def haversine_km(lat1, lon1, lat2, lon2):
    r = 6371.0
    phi1 = math.radians(lat1); phi2 = math.radians(lat2)
    dphi = math.radians(lat2 - lat1); dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi/2)**2 + math.cos(phi1)*math.cos(phi2)*math.sin(dlambda/2)**2
    return 2 * r * math.asin(math.sqrt(a))


def distance_km(points: list[dict[str, Any]]) -> float:
    total = 0.0
    for a, b in zip(points, points[1:]):
        total += haversine_km(a["lat"], a["lon"], b["lat"], b["lon"])
    return total


def nearest_airport(lat: float, lon: float, max_km: float = 12.0) -> str | None:
    if AIRPORT_DF.empty:
        return None
    best_code = None
    best_dist = float("inf")
    for _, row in AIRPORT_DF.iterrows():
        d = haversine_km(lat, lon, row["lat"], row["lon"])
        if d < best_dist:
            best_dist = d; best_code = row["code"]
    return best_code if best_dist <= max_km else None


def parse_kml(file_bytes: bytes) -> list[dict[str, Any]]:
    root = ET.fromstring(file_bytes)
    ns = {"kml": "http://www.opengis.net/kml/2.2", "gx": "http://www.google.com/kml/ext/2.2"}
    points: list[dict[str, Any]] = []

    # gx:Track má when + coord, ADSBexchange jej často používá.
    for track in root.findall(".//gx:Track", ns):
        whens = [w.text for w in track.findall("kml:when", ns)]
        coords = [c.text for c in track.findall("gx:coord", ns)]
        for i, coord in enumerate(coords):
            if not coord:
                continue
            parts = coord.split()
            if len(parts) < 2:
                continue
            lon = float(parts[0]); lat = float(parts[1]); alt = float(parts[2]) if len(parts) >= 3 else None
            points.append({"lat": lat, "lon": lon, "alt_m": alt, "time_utc": whens[i] if i < len(whens) else None})

    # Fallback pro obyčejné LineString coordinates: lon,lat,alt lon,lat,alt
    if not points:
        for elem in root.findall(".//kml:coordinates", ns):
            if not elem.text:
                continue
            for token in elem.text.split():
                parts = token.split(",")
                if len(parts) < 2:
                    continue
                lon = float(parts[0]); lat = float(parts[1]); alt = float(parts[2]) if len(parts) >= 3 and parts[2] else None
                points.append({"lat": lat, "lon": lon, "alt_m": alt, "time_utc": None})
    return points


def points_to_profile(points: list[dict[str, Any]]) -> pd.DataFrame:
    if not points:
        return pd.DataFrame()
    rows = []
    prev = None
    for idx, p in enumerate(points):
        rows.append({"idx": idx, "time_utc": p.get("time_utc"), "alt_m": p.get("alt_m"), "lat": p["lat"], "lon": p["lon"]})
    df = pd.DataFrame(rows)
    df["time_dt"] = pd.to_datetime(df["time_utc"], errors="coerce", utc=True)
    speeds = [None]
    for a, b in zip(points, points[1:]):
        d = haversine_km(a["lat"], a["lon"], b["lat"], b["lon"])
        ta = pd.to_datetime(a.get("time_utc"), errors="coerce", utc=True)
        tb = pd.to_datetime(b.get("time_utc"), errors="coerce", utc=True)
        if pd.notna(ta) and pd.notna(tb):
            hours = max((tb - ta).total_seconds() / 3600.0, 1e-9)
            speeds.append(d / hours)
        else:
            speeds.append(None)
    df["speed_kmh"] = speeds
    if df["speed_kmh"].notna().any():
        df["speed_kmh_smooth"] = df["speed_kmh"].rolling(5, min_periods=1).median()
    else:
        df["speed_kmh_smooth"] = None
    return df


def kml_suggestion(points: list[dict[str, Any]], filename: str) -> dict[str, Any]:
    prof = points_to_profile(points)
    start_ts = pd.to_datetime(prof["time_dt"].dropna().iloc[0]) if not prof.empty and prof["time_dt"].notna().any() else None
    end_ts = pd.to_datetime(prof["time_dt"].dropna().iloc[-1]) if not prof.empty and prof["time_dt"].notna().any() else None
    start_local = start_ts.tz_convert(LOCAL_TZ) if start_ts is not None else None
    end_local = end_ts.tz_convert(LOCAL_TZ) if end_ts is not None else None
    dep = nearest_airport(points[0]["lat"], points[0]["lon"]) if points else None
    arr = nearest_airport(points[-1]["lat"], points[-1]["lon"]) if points else None
    reg = None
    match = re.search(r"OK[-_ ]?[A-Z0-9]{3,5}", filename.upper())
    if match:
        reg = match.group(0).replace("_", "-").replace(" ", "-")
        if not reg.startswith("OK-"):
            reg = reg.replace("OK", "OK-", 1)
    # Conservative default: ADS-B starts/end = takeoff/landing proposal; block = same proposal.
    return {
        "date": start_local.date() if start_local is not None else date.today(),
        "off_block": start_local.strftime("%H:%M") if start_local is not None else None,
        "takeoff": start_local.strftime("%H:%M") if start_local is not None else None,
        "landing": end_local.strftime("%H:%M") if end_local is not None else None,
        "on_block": end_local.strftime("%H:%M") if end_local is not None else None,
        "departure": dep,
        "arrival": arr,
        "registration": reg,
        "distance_km": distance_km(points),
        "point_count": len(points),
        "start_utc": start_ts.isoformat() if start_ts is not None else None,
        "end_utc": end_ts.isoformat() if end_ts is not None else None,
        "min_alt_m": float(prof["alt_m"].dropna().min()) if not prof.empty and prof["alt_m"].notna().any() else None,
        "max_alt_m": float(prof["alt_m"].dropna().max()) if not prof.empty and prof["alt_m"].notna().any() else None,
    }


def save_track(flight_id: int, file_name: str, points: list[dict[str, Any]], suggestion: dict[str, Any]) -> None:
    with connect() as con:
        con.execute(
            """
            INSERT INTO flight_tracks
            (flight_id, file_name, imported_at, point_count, distance_km, start_utc, end_utc, min_alt_m, max_alt_m, coordinates_json)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                flight_id,
                file_name,
                datetime.now(LOCAL_TZ).isoformat(timespec="seconds"),
                suggestion.get("point_count"),
                suggestion.get("distance_km"),
                suggestion.get("start_utc"),
                suggestion.get("end_utc"),
                suggestion.get("min_alt_m"),
                suggestion.get("max_alt_m"),
                json.dumps(points),
            ),
        )
        con.commit()

# -----------------------------------------------------------------------------
# Maps and charts
# -----------------------------------------------------------------------------

def create_map_for_points(points: list[dict[str, Any]], zoom: int = 8) -> folium.Map:
    if points:
        center = [sum(p["lat"] for p in points) / len(points), sum(p["lon"] for p in points) / len(points)]
    else:
        center = [50.1, 14.3]
    fmap = folium.Map(location=center, zoom_start=zoom, tiles="CartoDB dark_matter")
    if points:
        coords = [(p["lat"], p["lon"]) for p in points]
        folium.PolyLine(coords, weight=4, color="#38bdf8", opacity=0.9).add_to(fmap)
        folium.Marker(coords[0], tooltip="Start", icon=folium.Icon(color="green", icon="play")).add_to(fmap)
        folium.Marker(coords[-1], tooltip="End", icon=folium.Icon(color="red", icon="stop")).add_to(fmap)
        fmap.fit_bounds(coords)
    return fmap


def create_all_tracks_map(tracks: pd.DataFrame) -> folium.Map:
    fmap = folium.Map(location=[50.1, 14.3], zoom_start=6, tiles="CartoDB dark_matter")
    all_coords = []
    colors = {"ULL": "#38bdf8", "EASA": "#f97316"}
    for _, row in tracks.iterrows():
        try:
            pts = json.loads(row["coordinates_json"])
        except Exception:
            continue
        if not pts:
            continue
        coords = [(p["lat"], p["lon"]) for p in pts]
        all_coords.extend(coords)
        popup = f"{row.get('date','')} | {row.get('registration','')} | {row.get('departure','')}–{row.get('arrival','')} | {row.get('role','')} | {row.get('distance_km',0):.1f} km"
        folium.PolyLine(coords, weight=4 if row.get("role") == "PIC" else 2, color=colors.get(row.get("evidence"), "#a78bfa"), opacity=0.78, popup=popup).add_to(fmap)
    if all_coords:
        fmap.fit_bounds(all_coords)
    return fmap


def profile_charts(points: list[dict[str, Any]]) -> None:
    prof = points_to_profile(points)
    if prof.empty:
        return
    if prof["alt_m"].notna().any():
        fig = px.line(prof, x="time_dt" if prof["time_dt"].notna().any() else "idx", y="alt_m", title="Výškový profil")
        st.plotly_chart(plotly_layout(fig), use_container_width=True)
    if prof["speed_kmh_smooth"].notna().any():
        fig = px.line(prof, x="time_dt" if prof["time_dt"].notna().any() else "idx", y="speed_kmh_smooth", title="Rychlostní profil")
        st.plotly_chart(plotly_layout(fig), use_container_width=True)

# -----------------------------------------------------------------------------
# CRUD
# -----------------------------------------------------------------------------

def upsert_flight(payload: dict[str, Any], flight_id: int | None = None) -> int:
    fields = ["date", "evidence", "registration", "aircraft_type", "aircraft_class", "departure", "arrival", "off_block", "takeoff", "landing", "on_block", "starts", "commander", "instructor", "role", "task", "price_per_hour", "note"]
    values = [payload.get(f) for f in fields]
    with connect() as con:
        if flight_id:
            set_clause = ", ".join([f"{f}=?" for f in fields])
            con.execute(f"UPDATE flights SET {set_clause} WHERE id=?", values + [flight_id])
            con.commit()
            return flight_id
        cur = con.execute(f"INSERT INTO flights ({', '.join(fields)}) VALUES ({', '.join(['?']*len(fields))})", values)
        con.commit()
        return int(cur.lastrowid)


def delete_flight(flight_id: int) -> None:
    with connect() as con:
        con.execute("DELETE FROM flights WHERE id=?", (flight_id,))
        con.commit()


def delete_track(track_id: int) -> None:
    with connect() as con:
        con.execute("DELETE FROM flight_tracks WHERE id=?", (track_id,))
        con.commit()


def rate_for_registration(reg: str) -> tuple[str | None, float | None]:
    if not reg:
        return None, None
    rates = read_table("rates")
    match = rates[rates["registration"].str.upper() == reg.upper()]
    if match.empty:
        return None, None
    row = match.sort_values("valid_from").iloc[-1]
    return row.get("aircraft_type"), float(row.get("price_per_hour") or 0)

# -----------------------------------------------------------------------------
# Views
# -----------------------------------------------------------------------------

def sidebar_nav() -> tuple[str, bool]:
    with st.sidebar:
        st.markdown("## ✈️ Logbook")
        dark_mode = st.toggle("Dark mode", value=True)
        st.markdown("### Sekce")
        page = st.radio("", ["Dashboard", "Lety", "Nový let", "Mapa", "Ceník", "Kontrola", "Export"], label_visibility="collapsed")
    return page, dark_mode


def view_dashboard(df: pd.DataFrame) -> None:
    app_header()
    st.title("Dashboard")
    t = totals(df)
    c1, c2, c3, c4 = st.columns(4)
    with c1: metric_card("Celkový nálet", t["block"], f"{t['flights']} letů")
    with c2: metric_card("PIC", t["pic"], f"ULL {t['pic_ull']} · EASA {t['pic_easa']}")
    with c3: metric_card("DUAL / Safety", f"{t['dual']} / {t['safety']}", f"Starty {t['starts']}")
    with c4: metric_card("Náklady", t["cost"], f"GPS {t['tracks']} tracků · {t['gps_km']:.0f} km")

    if df.empty:
        st.info("Žádná data ve filtru.")
        return
    st.subheader("Nálet podle roku a funkce")
    pivot = df.groupby(["year", "role"], as_index=False)["block_hours"].sum()
    fig = px.bar(pivot, x="year", y="block_hours", color="role", barmode="stack", labels={"block_hours": "hodiny"})
    st.plotly_chart(plotly_layout(fig), use_container_width=True)

    col1, col2 = st.columns(2)
    with col1:
        st.subheader("TOP letadla podle block time")
        top = df.groupby("registration", as_index=False)["block_hours"].sum().sort_values("block_hours", ascending=False).head(10)
        fig = px.bar(top, x="registration", y="block_hours", labels={"block_hours": "hodiny"})
        st.plotly_chart(plotly_layout(fig), use_container_width=True)
    with col2:
        st.subheader("ULL / EASA")
        ev = df.groupby("evidence", as_index=False)["block_hours"].sum()
        fig = px.pie(ev, names="evidence", values="block_hours", hole=.55)
        st.plotly_chart(plotly_layout(fig), use_container_width=True)


def view_flights(df: pd.DataFrame) -> None:
    app_header()
    st.title("Lety")
    if df.empty:
        st.info("Žádné lety ve filtru.")
        return
    display_cols = ["id", "date", "evidence", "registration", "aircraft_type", "aircraft_class", "departure", "arrival", "off_block", "takeoff", "landing", "on_block", "block_time", "air_time", "starts", "commander", "instructor", "role", "task", "price_per_hour", "cost_label", "track_count"]
    st.dataframe(df[display_cols].sort_values(["date", "off_block"], ascending=[False, False]), use_container_width=True, height=520)

    st.subheader("Detail letu")
    options = df.sort_values(["date", "off_block"], ascending=[False, False])
    labels = [f"#{int(r.id)} | {r.date} | {r.registration} | {r.departure}-{r.arrival} | {r.role} | {r.block_time}" for r in options.itertuples()]
    selected = st.selectbox("Vyber let", labels)
    flight_id = int(selected.split("|")[0].replace("#", "").strip())
    flight = df[df["id"] == flight_id].iloc[0]
    tracks = read_tracks_for_flight(flight_id)

    c1, c2, c3, c4 = st.columns(4)
    with c1: metric_card("Let", f"{flight['registration']}", f"{flight['date']} · {flight['departure']}–{flight['arrival']}")
    with c2: metric_card("Čas", flight["block_time"], f"Air {flight['air_time']}")
    with c3: metric_card("Funkce", flight["role"], f"{flight['evidence']} · {flight['aircraft_class']}")
    with c4: metric_card("Náklady", flight["cost_label"], f"Tracky {len(tracks)}")

    tab1, tab2, tab3 = st.tabs(["Detail", "Editace", "Track"])
    with tab1:
        if tracks.empty:
            st.info("K letu zatím není uložený GPS track.")
        else:
            track = tracks.iloc[-1]
            points = json.loads(track["coordinates_json"])
            st_folium(create_map_for_points(points), use_container_width=True, height=520)
            profile_charts(points)
    with tab2:
        flight_form(flight.to_dict(), flight_id=flight_id)
    with tab3:
        uploaded = st.file_uploader("Přidat / nahradit KML track", type=["kml"], key=f"track_{flight_id}")
        if uploaded:
            pts = parse_kml(uploaded.getvalue())
            sugg = kml_suggestion(pts, uploaded.name)
            st.write(f"Body: {len(pts)} · Vzdálenost: {sugg['distance_km']:.1f} km · Max výška: {fmt_minutes(0) if sugg.get('max_alt_m') is None else f'{sugg.get('max_alt_m'):.0f} m'}")
            st_folium(create_map_for_points(pts), use_container_width=True, height=420)
            if st.button("Uložit track k letu", type="primary"):
                save_track(flight_id, uploaded.name, pts, sugg)
                st.success("Track uložen.")
                st.rerun()
        if not tracks.empty:
            st.dataframe(tracks[["id", "file_name", "imported_at", "point_count", "distance_km", "start_utc", "end_utc"]], use_container_width=True)
            tid = st.number_input("ID tracku ke smazání", min_value=0, step=1)
            if st.button("Smazat track") and tid:
                delete_track(int(tid)); st.success("Track smazán."); st.rerun()


def flight_form(defaults: dict[str, Any] | None = None, flight_id: int | None = None, track_points: list[dict[str, Any]] | None = None, track_suggestion: dict[str, Any] | None = None, track_file_name: str | None = None) -> None:
    defaults = defaults or {}
    with st.form(f"flight_form_{flight_id or 'new'}"):
        c1, c2, c3 = st.columns(3)
        with c1:
            dval = defaults.get("date") or (track_suggestion or {}).get("date") or date.today()
            if isinstance(dval, str):
                dval = datetime.strptime(dval[:10], "%Y-%m-%d").date()
            f_date = st.date_input("Datum", value=dval)
            registration = st.text_input("Imatrikulace", value=defaults.get("registration") or (track_suggestion or {}).get("registration") or "").upper()
            aircraft_type_guess, price_guess = rate_for_registration(registration)
            aircraft_type = st.text_input("Typ", value=defaults.get("aircraft_type") or aircraft_type_guess or "")
            evidence = st.selectbox("Evidence", EVIDENCE_OPTIONS, index=EVIDENCE_OPTIONS.index(defaults.get("evidence")) if defaults.get("evidence") in EVIDENCE_OPTIONS else 0)
            aircraft_class = st.selectbox("Třída", CLASS_OPTIONS, index=CLASS_OPTIONS.index(defaults.get("aircraft_class")) if defaults.get("aircraft_class") in CLASS_OPTIONS else 0)
        with c2:
            departure = st.text_input("Odlet", value=defaults.get("departure") or (track_suggestion or {}).get("departure") or "").upper()
            arrival = st.text_input("Přílet", value=defaults.get("arrival") or (track_suggestion or {}).get("arrival") or "").upper()
            off_block = st.text_input("Off block", value=defaults.get("off_block") or (track_suggestion or {}).get("off_block") or "")
            takeoff = st.text_input("Takeoff", value=defaults.get("takeoff") or (track_suggestion or {}).get("takeoff") or "")
            landing = st.text_input("Landing", value=defaults.get("landing") or (track_suggestion or {}).get("landing") or "")
            on_block = st.text_input("On block", value=defaults.get("on_block") or (track_suggestion or {}).get("on_block") or "")
        with c3:
            starts = st.number_input("Starty", min_value=0, step=1, value=int(defaults.get("starts") or 1))
            commander = st.text_input("Velitel", value=defaults.get("commander") or "Točík Filip")
            instructor = st.text_input("Instruktor", value=defaults.get("instructor") or "")
            role = st.selectbox("Funkce", ROLE_OPTIONS, index=ROLE_OPTIONS.index(defaults.get("role")) if defaults.get("role") in ROLE_OPTIONS else 0)
            task = st.text_input("Úloha", value=defaults.get("task") or "")
            price_per_hour = st.number_input("Cena Kč/h", min_value=0.0, step=50.0, value=float(defaults.get("price_per_hour") or price_guess or 0))
        note = st.text_area("Poznámka", value=defaults.get("note") or "", height=70)
        submit = st.form_submit_button("Uložit", type="primary")
    if submit:
        payload = {
            "date": f_date.isoformat(), "evidence": evidence, "registration": registration, "aircraft_type": aircraft_type, "aircraft_class": aircraft_class,
            "departure": departure, "arrival": arrival, "off_block": normalize_time(off_block), "takeoff": normalize_time(takeoff), "landing": normalize_time(landing), "on_block": normalize_time(on_block),
            "starts": int(starts), "commander": commander, "instructor": instructor, "role": role, "task": task, "price_per_hour": float(price_per_hour), "note": note,
        }
        new_id = upsert_flight(payload, flight_id)
        if track_points and track_suggestion and track_file_name:
            save_track(new_id, track_file_name, track_points, track_suggestion)
        st.success("Uloženo.")
        st.rerun()


def view_new_flight() -> None:
    app_header()
    st.title("Nový let")
    mode = st.radio("Způsob zadání", ["Ručně", "Z tracku"], horizontal=True)
    if mode == "Ručně":
        flight_form()
    else:
        uploaded = st.file_uploader("Nahraj KML track", type=["kml"])
        if not uploaded:
            st.info("Nahraj KML. Aplikace předvyplní let a ty ho jen potvrdíš.")
            return
        pts = parse_kml(uploaded.getvalue())
        if not pts:
            st.error("Nepodařilo se načíst body z KML.")
            return
        sugg = kml_suggestion(pts, uploaded.name)
        c1, c2, c3 = st.columns(3)
        with c1: metric_card("GPS body", str(sugg["point_count"]), f"{sugg['distance_km']:.1f} km")
        with c2: metric_card("UTC", sugg.get("start_utc", "")[:16], sugg.get("end_utc", "")[:16])
        with c3: metric_card("Max výška", f"{sugg.get('max_alt_m'):.0f} m" if sugg.get("max_alt_m") is not None else "", f"{sugg.get('departure') or '?'}–{sugg.get('arrival') or '?'}")
        st_folium(create_map_for_points(pts), use_container_width=True, height=430)
        profile_charts(pts)
        flight_form(track_points=pts, track_suggestion=sugg, track_file_name=uploaded.name)


def view_map(df: pd.DataFrame) -> None:
    app_header()
    st.title("Mapa letů")
    tracks = read_tracks_joined()
    if tracks.empty:
        st.info("Zatím nejsou uložené žádné GPS tracky.")
        return
    if not df.empty:
        tracks = tracks[tracks["flight_id"].isin(df["id"].tolist())]
    t1, t2, t3 = st.columns(3)
    with t1: metric_card("Tracky", str(len(tracks)), "z aktuálního filtru")
    with t2: metric_card("GPS vzdálenost", f"{tracks['distance_km'].fillna(0).sum():.1f} km")
    with t3: metric_card("Letů ve filtru", str(len(df)))
    st_folium(create_all_tracks_map(tracks), use_container_width=True, height=620)


def view_rates() -> None:
    app_header()
    st.title("Ceník")
    rates = read_table("rates")
    edited = st.data_editor(rates, use_container_width=True, num_rows="dynamic")
    if st.button("Uložit ceník", type="primary"):
        with connect() as con:
            con.execute("DELETE FROM rates")
            cols = ["registration", "aircraft_type", "valid_from", "price_per_hour", "dry_price_per_hour", "source"]
            for _, row in edited.iterrows():
                if normalize_text(row.get("registration")):
                    con.execute(f"INSERT OR IGNORE INTO rates ({', '.join(cols)}) VALUES ({', '.join(['?']*len(cols))})", [row.get(c) for c in cols])
            con.commit()
        st.success("Ceník uložen.")
        st.rerun()


def view_check(df: pd.DataFrame) -> None:
    app_header()
    st.title("Kontrola")
    problems = []
    for _, r in df.iterrows():
        if not r.get("date") or pd.isna(r.get("date_dt")): problems.append((r["id"], r.get("date"), r.get("registration"), "Neplatné datum"))
        if not r.get("evidence"): problems.append((r["id"], r.get("date"), r.get("registration"), "Chybí evidence"))
        if not r.get("registration"): problems.append((r["id"], r.get("date"), r.get("registration"), "Chybí imatrikulace"))
        if not r.get("departure") or not r.get("arrival"): problems.append((r["id"], r.get("date"), r.get("registration"), "Chybí letiště"))
        if pd.isna(r.get("block_minutes")): problems.append((r["id"], r.get("date"), r.get("registration"), "Chybí block time"))
        if pd.notna(r.get("block_minutes")) and pd.notna(r.get("air_minutes")) and r.get("air_minutes") > r.get("block_minutes"):
            problems.append((r["id"], r.get("date"), r.get("registration"), "Air time > Block time"))
        if not r.get("price_per_hour") or r.get("price_per_hour") <= 0: problems.append((r["id"], r.get("date"), r.get("registration"), "Chybí sazba"))
    if not problems:
        st.success("Bez nalezených problémů.")
    else:
        st.dataframe(pd.DataFrame(problems, columns=["ID", "Datum", "Imatrikulace", "Problém"]), use_container_width=True)


def export_excel_bytes() -> bytes:
    df = read_flights()
    out = df[["date", "evidence", "registration", "aircraft_type", "aircraft_class", "departure", "arrival", "off_block", "takeoff", "landing", "on_block", "block_time", "air_time", "starts", "commander", "instructor", "role", "task", "price_per_hour", "cost_label", "track_count", "gps_km"]].copy()
    wb = Workbook()
    ws = wb.active; ws.title = "Zápisník letů"
    ws.append(list(out.columns))
    for row in out.itertuples(index=False): ws.append(list(row))
    header_fill = PatternFill("solid", fgColor="0F172A"); header_font = Font(color="FFFFFF", bold=True)
    thin = Side(style="thin", color="CBD5E1")
    for cell in ws[1]: cell.fill = header_fill; cell.font = header_font; cell.alignment = Alignment(horizontal="center")
    for row in ws.iter_rows():
        for cell in row: cell.border = Border(top=thin, bottom=thin, left=thin, right=thin)
    for col_idx, col in enumerate(out.columns, start=1): ws.column_dimensions[get_column_letter(col_idx)].width = min(max(len(col)+2, 12), 24)
    bio = BytesIO(); wb.save(bio); bio.seek(0); return bio.getvalue()


def view_export() -> None:
    app_header()
    st.title("Export")
    st.download_button("Stáhnout Excel", data=export_excel_bytes(), file_name="letovy_zapisnik_export.xlsx", mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")


def main() -> None:
    st.set_page_config(page_title="Letový zápisník", page_icon="✈️", layout="wide", initial_sidebar_state="expanded")
    page, dark_mode = sidebar_nav()
    apply_ui_theme(dark_mode)
    all_flights = read_flights()
    filtered = apply_filters(all_flights, key_prefix=page)
    if page == "Dashboard": view_dashboard(filtered)
    elif page == "Lety": view_flights(filtered)
    elif page == "Nový let": view_new_flight()
    elif page == "Mapa": view_map(filtered)
    elif page == "Ceník": view_rates()
    elif page == "Kontrola": view_check(all_flights)
    elif page == "Export": view_export()

if __name__ == "__main__":
    main()
