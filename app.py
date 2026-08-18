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
    .stApp {{background: radial-gradient(circle at 16% 10%, rgba(56,189,248,.16), transparent 24%), radial-gradient(circle at 88% 3%, rgba(34,197,94,.08), transparent 26%), var(--bg); color:var(--text);}}
    [data-testid="stSidebar"] {{background: linear-gradient(180deg, rgba(11,24,42,.98), rgba(6,16,29,.98)); border-right:1px solid var(--border);}}
    [data-testid="stSidebar"] * {{color:#e6f0fb;}}
    .block-container {{padding-top:1.2rem; padding-bottom:3rem; max-width:1500px;}}
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


def parse_kml_bytes(data: bytes) -> list[dict[str, Any]]:
    root = ET.fromstring(data)
    points: list[dict[str, Any]] = []
    for track in root.iter():
        if local_name(track.tag) != "Track":
            continue
        whens: list[str | None] = []
        coords: list[str] = []
        for child in list(track):
            lname = local_name(child.tag)
            if lname == "when":
                whens.append((child.text or "").strip() or None)
            elif lname == "coord":
                coords.append((child.text or "").strip())
        for idx, coord in enumerate(coords):
            parts = coord.replace(",", " ").split()
            if len(parts) < 2:
                continue
            try:
                lon = float(parts[0]); lat = float(parts[1]); alt = float(parts[2]) if len(parts) >= 3 else None
            except ValueError:
                continue
            if -90 <= lat <= 90 and -180 <= lon <= 180:
                points.append({"lat": lat, "lon": lon, "alt": alt, "time": whens[idx] if idx < len(whens) else None})
    if points:
        return points
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
    return points


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
    rows = []
    cum = 0.0
    prev = None
    for i, p in enumerate(points):
        dt_utc = parse_iso(p.get("time"))
        dt_local = dt_utc.astimezone(tz) if dt_utc else None
        seg_km = haversine_km(prev, p) if prev is not None else 0.0
        cum += seg_km
        speed = None
        if prev is not None and dt_utc and parse_iso(prev.get("time")):
            prev_dt = parse_iso(prev.get("time"))
            seconds = max((dt_utc - prev_dt).total_seconds(), 0)
            if seconds > 0:
                speed = seg_km / (seconds / 3600)
                if speed > 750:
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
    df = pd.DataFrame(rows)
    if not df.empty:
        df["speed_smooth"] = df["speed_kmh"].rolling(5, min_periods=1, center=True).median()
    return df


def detect_takeoff_landing(points: list[dict[str, Any]]) -> dict[str, Any]:
    prof = profile_from_points(points)
    n = len(prof)
    if n == 0:
        return {}
    speed = prof["speed_smooth"].fillna(0)
    moving = speed.gt(12)
    airborne = speed.gt(55)
    if not airborne.any():
        airborne = moving
    first_move = int(moving.idxmax()) if moving.any() else 0
    last_move = int(moving[moving].index[-1]) if moving.any() else n - 1
    takeoff = int(airborne.idxmax()) if airborne.any() else 0
    landing = int(airborne[airborne].index[-1]) if airborne.any() else n - 1
    if landing < takeoff:
        takeoff, landing = 0, n - 1
    return {"off_idx": first_move, "takeoff_idx": takeoff, "landing_idx": landing, "on_idx": last_move}


def point_local_hhmm(points: list[dict[str, Any]], idx: int) -> str | None:
    if not points:
        return None
    idx = max(0, min(idx, len(points) - 1))
    dt = parse_iso(points[idx].get("time"))
    return dt.astimezone(LOCAL_TZ).strftime("%H:%M") if dt else None


def point_local_date(points: list[dict[str, Any]]) -> date:
    for p in points:
        dt = parse_iso(p.get("time"))
        if dt:
            return dt.astimezone(LOCAL_TZ).date()
    return date.today()


def nearest_airport(point: dict[str, Any] | None, max_km: float = 18.0) -> str:
    if not point:
        return ""
    best_code = ""; best_dist = 10**9
    p = {"lat": float(point["lat"]), "lon": float(point["lon"])}
    for _, a in AIRPORT_DF.iterrows():
        d = haversine_km(p, {"lat": a["lat"], "lon": a["lon"]})
        if d < best_dist:
            best_dist = d; best_code = str(a["code"])
    return best_code if best_dist <= max_km else ""


def extract_registration_from_filename(name: str) -> str:
    text = name.upper().replace("_", "-").replace(" ", "-")
    m = re.search(r"OK-?[A-Z]{3}\d{2}", text)
    if m:
        val = m.group(0).replace("OK", "OK-").replace("OK--", "OK-")
        return val if val.startswith("OK-") else "OK-" + val[2:]
    m = re.search(r"OK-?[A-Z]{3}(?!\d)", text)
    if m:
        val = m.group(0).replace("OK", "OK-").replace("OK--", "OK-")
        return val if val.startswith("OK-") else "OK-" + val[2:]
    return ""


def evidence_from_registration(reg: str) -> str:
    return "ULL" if re.fullmatch(r"OK-[A-Z]{3}\d{2}", (reg or "").upper()) else "EASA"


def default_class_for(evidence: str) -> str:
    return "ULL" if evidence == "ULL" else "SEP"


def lookup_latest_rate(rates: pd.DataFrame, registration: str) -> dict[str, Any]:
    if rates.empty or not registration:
        return {}
    reg = registration.strip().upper()
    sub = rates[rates["registration"].fillna("").str.upper().eq(reg)].copy()
    if sub.empty:
        return {}
    sub["valid_from_dt"] = pd.to_datetime(sub["valid_from"], errors="coerce")
    row = sub.sort_values("valid_from_dt").iloc[-1]
    return {"aircraft_type": row.get("aircraft_type"), "price_per_hour": row.get("price_per_hour")}


def infer_from_track(points: list[dict[str, Any]], file_name: str, rates: pd.DataFrame) -> dict[str, Any]:
    idx = detect_takeoff_landing(points)
    stats = track_stats(points)
    reg = extract_registration_from_filename(file_name)
    evidence = evidence_from_registration(reg) if reg else "ULL"
    rate = lookup_latest_rate(rates, reg)
    return {
        "date": point_local_date(points),
        "registration": reg,
        "evidence": evidence,
        "aircraft_type": normalize_text(rate.get("aircraft_type")) or "",
        "aircraft_class": default_class_for(evidence),
        "departure": nearest_airport(points[idx.get("off_idx", 0)] if points else None),
        "arrival": nearest_airport(points[idx.get("on_idx", len(points)-1)] if points else None),
        "off_block": point_local_hhmm(points, idx.get("off_idx", 0)),
        "takeoff": point_local_hhmm(points, idx.get("takeoff_idx", 0)),
        "landing": point_local_hhmm(points, idx.get("landing_idx", len(points)-1)),
        "on_block": point_local_hhmm(points, idx.get("on_idx", len(points)-1)),
        "starts": 1,
        "commander": "Točík Filip",
        "instructor": "",
        "role": "PIC",
        "task": "",
        "price_per_hour": float(rate.get("price_per_hour")) if rate and pd.notna(rate.get("price_per_hour")) else 0.0,
        "note": "",
        "stats": stats,
    }


def save_track(flight_id: int, file_name: str, points: list[dict[str, Any]], replace_existing: bool = False) -> None:
    stats = track_stats(points)
    with connect() as con:
        if replace_existing:
            con.execute("DELETE FROM flight_tracks WHERE flight_id = ?", (flight_id,))
        con.execute(
            """
            INSERT INTO flight_tracks (flight_id, file_name, imported_at, point_count, distance_km, start_utc, end_utc, min_alt_m, max_alt_m, coordinates_json)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (flight_id, file_name, datetime.now().isoformat(timespec="seconds"), stats["point_count"], stats["distance_km"], stats["start_utc"], stats["end_utc"], stats["min_alt_m"], stats["max_alt_m"], json.dumps(points, ensure_ascii=False)),
        )
        con.commit()


def create_flight(data: dict[str, Any]) -> int:
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
        cur = con.execute(
            """
            INSERT INTO flights (date, evidence, registration, aircraft_type, aircraft_class, departure, arrival, off_block, takeoff, landing, on_block, starts, commander, instructor, role, task, price_per_hour, note)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            values,
        )
        con.commit()
        return int(cur.lastrowid)


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
        con.commit()


def delete_track(track_id: int) -> None:
    with connect() as con:
        con.execute("DELETE FROM flight_tracks WHERE id = ?", (track_id,))
        con.commit()


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
    center = [(min_lat + max_lat) / 2, (min_lon + max_lon) / 2]
    spread = max(max_lat - min_lat, max_lon - min_lon)
    zoom = 10 if spread < .25 else 8 if spread < 1 else 7 if spread < 4 else 6 if spread < 10 else 5
    return center, zoom


def make_map(tracks: pd.DataFrame, dark_mode: bool = True) -> folium.Map:
    center, zoom = map_center_from_tracks(tracks)
    tiles = "CartoDB dark_matter" if dark_mode else "OpenStreetMap"
    m = folium.Map(location=center, zoom_start=zoom, tiles=tiles, control_scale=True)
    if tracks.empty:
        return m
    for _, row in tracks.iterrows():
        try:
            points = downsample_points(json.loads(row["coordinates_json"]))
        except Exception:
            continue
        if len(points) < 2:
            continue
        latlon = [(float(p["lat"]), float(p["lon"])) for p in points]
        evidence = str(row.get("evidence") or "").upper(); role = str(row.get("role") or "").upper()
        color = "#38bdf8" if evidence == "ULL" else "#fbbf24"
        weight = 5 if role == "PIC" else 3
        dash = "8, 7" if role == "SAFETY PILOT" else None
        popup = folium.Popup(f"""
            <b>{row.get('date') or ''} • {row.get('registration') or ''}</b><br>
            {row.get('departure') or ''}–{row.get('arrival') or ''}<br>
            {row.get('role') or ''} • {row.get('evidence') or ''}<br>
            GPS: {float(row.get('distance_km') or 0):.1f} km<br>
            Track: {row.get('file_name') or ''}
            """, max_width=330)
        folium.PolyLine(latlon, color=color, weight=weight, opacity=.84, popup=popup, dash_array=dash).add_to(m)
        folium.CircleMarker(latlon[0], radius=4, color="#22c55e", fill=True, fill_opacity=.9, tooltip="Start").add_to(m)
        folium.CircleMarker(latlon[-1], radius=4, color="#ef4444", fill=True, fill_opacity=.9, tooltip="End").add_to(m)
    folium.LayerControl().add_to(m)
    return m


def render_track_profile(points: list[dict[str, Any]]) -> None:
    prof = profile_from_points(points)
    if prof.empty:
        st.info("Track nemá data pro profil.")
        return
    x = prof["time_local"] if prof["time_local"].notna().any() else prof["distance_km"]
    x_title = "Čas" if prof["time_local"].notna().any() else "Vzdálenost km"
    fig_alt = go.Figure()
    fig_alt.add_trace(go.Scatter(x=x, y=prof["alt_ft"], mode="lines", name="Altitude ft"))
    fig_alt.update_layout(title="Vertikální profil", xaxis_title=x_title, yaxis_title="Altitude ft")
    st.plotly_chart(plotly_layout(fig_alt), use_container_width=True)
    fig_spd = go.Figure()
    fig_spd.add_trace(go.Scatter(x=x, y=prof["speed_smooth"], mode="lines", name="GPS speed km/h"))
    fig_spd.update_layout(title="Rychlostní profil", xaxis_title=x_title, yaxis_title="GPS speed km/h")
    st.plotly_chart(plotly_layout(fig_spd), use_container_width=True)

# -----------------------------------------------------------------------------
# Pages
# -----------------------------------------------------------------------------

def page_dashboard(df: pd.DataFrame):
    st.markdown("## Dashboard")
    filtered = apply_filters(df, "dash")
    s = build_summary(filtered)
    c1, c2, c3, c4 = st.columns(4)
    with c1: metric_card("Celkový nálet", fmt_minutes(s["total"]), f"{s['flights']} letů")
    with c2: metric_card("PIC", fmt_minutes(s["pic"]), f"ULL {fmt_minutes(s['pic_ull'])} • EASA {fmt_minutes(s['pic_easa'])}")
    with c3: metric_card("DUAL / Safety", f"{fmt_minutes(s['dual'])} / {fmt_minutes(s['safety'])}", f"Starty {s['starts']}")
    with c4: metric_card("Náklady", fmt_money(s["cost"]), f"GPS {s['tracks']} tracků • {s['gps_km']:.0f} km")
    st.write("")
    chart_df = filtered.dropna(subset=["year"]).copy()
    if chart_df.empty:
        st.info("Žádná data pro grafy.")
        return
    yearly = chart_df.groupby("year", as_index=False).agg(Celkem=("block_hours", "sum"), Starty=("starts", "sum"), Naklady=("cost", "sum"))
    role_year = chart_df.pivot_table(index="year", columns="role", values="block_hours", aggfunc="sum", fill_value=0).reset_index()
    fig = px.bar(role_year, x="year", y=[c for c in ["PIC", "DUAL", "SAFETY PILOT", "INSTRUKTOR"] if c in role_year.columns], barmode="stack", title="Nálet podle roku a funkce")
    st.plotly_chart(plotly_layout(fig), use_container_width=True)
    left, right = st.columns(2)
    with left:
        by_aircraft = filtered.groupby("registration", as_index=False)["block_hours"].sum().sort_values("block_hours", ascending=False).head(12)
        fig2 = px.bar(by_aircraft, x="registration", y="block_hours", title="TOP letadla podle block time")
        st.plotly_chart(plotly_layout(fig2), use_container_width=True)
    with right:
        by_ev = filtered.groupby("evidence", as_index=False)["block_hours"].sum().sort_values("block_hours", ascending=False)
        fig3 = px.pie(by_ev, names="evidence", values="block_hours", title="ULL / EASA", hole=.45)
        st.plotly_chart(plotly_layout(fig3), use_container_width=True)


def flight_label(row: pd.Series | dict[str, Any]) -> str:
    return f"ID {int(row['id'])} • {row.get('date') or ''} • {row.get('registration') or ''} • {row.get('departure') or ''}-{row.get('arrival') or ''} • {row.get('off_block') or ''}-{row.get('on_block') or ''} • {row.get('role') or ''}"


def flight_display_df(df: pd.DataFrame) -> pd.DataFrame:
    cols = ["id","date","evidence","registration","aircraft_type","aircraft_class","departure","arrival","off_block","takeoff","landing","on_block","block_time","air_time","starts","commander","instructor","role","task","price_per_hour","cost_label","track_count","gps_km","note"]
    rename = {"id":"ID","date":"Datum","evidence":"Evidence","registration":"Imatrikulace","aircraft_type":"Typ","aircraft_class":"Třída","departure":"Odlet","arrival":"Přílet","off_block":"Off Block","takeoff":"Takeoff","landing":"Landing","on_block":"On Block","block_time":"Block","air_time":"Air","starts":"Starty","commander":"Velitel","instructor":"Instruktor","role":"Funkce","task":"Úloha","price_per_hour":"Kč/h","cost_label":"Cena","track_count":"GPS","gps_km":"GPS km","note":"Poznámka"}
    use = [c for c in cols if c in df.columns]
    return df[use].rename(columns=rename)


def flight_form(prefix: str, defaults: dict[str, Any], rates: pd.DataFrame, submit_label: str) -> dict[str, Any] | None:
    reg = str(defaults.get("registration") or "").upper()
    rate = lookup_latest_rate(rates, reg)
    default_price = defaults.get("price_per_hour") or rate.get("price_per_hour") or 0.0
    default_type = defaults.get("aircraft_type") or rate.get("aircraft_type") or ""
    with st.form(prefix):
        col1, col2, col3 = st.columns(3)
        with col1:
            flight_date = st.date_input("Datum", value=defaults.get("date") if isinstance(defaults.get("date"), date) else pd.to_datetime(defaults.get("date") or date.today()).date(), key=f"{prefix}_date")
            registration = st.text_input("Imatrikulace", value=reg, key=f"{prefix}_reg").upper()
            ev_def = defaults.get("evidence") or evidence_from_registration(reg)
            evidence = st.selectbox("Evidence", EVIDENCE_OPTIONS, index=EVIDENCE_OPTIONS.index(ev_def) if ev_def in EVIDENCE_OPTIONS else 0, key=f"{prefix}_ev")
            aircraft_type = st.text_input("Typ", value=str(default_type or ""), key=f"{prefix}_type")
            cls_def = defaults.get("aircraft_class") or default_class_for(evidence)
            aircraft_class = st.selectbox("Třída", CLASS_OPTIONS, index=CLASS_OPTIONS.index(cls_def) if cls_def in CLASS_OPTIONS else 0, key=f"{prefix}_class")
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
            task = st.text_input("Úloha", value=str(defaults.get("task") or ""), key=f"{prefix}_task")
            note = st.text_input("Poznámka", value=str(defaults.get("note") or ""), key=f"{prefix}_note")
        block = minutes_diff(off_block, on_block); air = minutes_diff(takeoff, landing)
        c1, c2, c3 = st.columns(3)
        with c1: metric_card("Block Time", fmt_minutes(block), "")
        with c2: metric_card("Air Time", fmt_minutes(air), "")
        with c3: metric_card("Cena letu", fmt_money((block or 0)/60*price), "")
        submitted = st.form_submit_button(submit_label, type="primary", use_container_width=True)
    if submitted:
        return {"date": flight_date, "evidence": evidence, "registration": registration, "aircraft_type": aircraft_type, "aircraft_class": aircraft_class, "departure": departure, "arrival": arrival, "off_block": off_block, "takeoff": takeoff, "landing": landing, "on_block": on_block, "starts": int(starts), "commander": commander, "instructor": instructor, "role": role, "task": task, "price_per_hour": price, "note": note}
    return None


def page_logbook(df: pd.DataFrame, rates: pd.DataFrame, dark_mode: bool):
    st.markdown("## Lety")
    filtered = apply_filters(df, "logbook")
    s = build_summary(filtered)
    c1, c2, c3, c4 = st.columns(4)
    with c1: metric_card("Zobrazeno", str(s["flights"]), "letů")
    with c2: metric_card("Celkem", fmt_minutes(s["total"]), "block time")
    with c3: metric_card("PIC", fmt_minutes(s["pic"]), "z filtrovaných letů")
    with c4: metric_card("GPS", str(s["tracks"]), f"{s['gps_km']:.0f} km")
    st.dataframe(flight_display_df(filtered.sort_values(["date_dt","off_block","id"], na_position="last")), hide_index=True, use_container_width=True, height=420)

    if filtered.empty:
        return
    st.markdown("### Detail letu")
    option_rows = {int(row["id"]): row for _, row in filtered.sort_values(["date_dt", "off_block", "id"], ascending=False).iterrows()}
    option_ids = list(option_rows.keys())
    selected_id = st.selectbox("Otevřít let", option_ids, format_func=lambda x: flight_label(option_rows[x]), key="selected_flight_detail")
    row = option_rows[selected_id]
    tabs = st.tabs(["Přehled", "Editace", "Track"])
    with tabs[0]:
        c1, c2, c3, c4 = st.columns(4)
        with c1: metric_card("Block", row.get("block_time") or "", f"Air {row.get('air_time') or ''}")
        with c2: metric_card("Trasa", f"{row.get('departure') or ''}–{row.get('arrival') or ''}", row.get("registration") or "")
        with c3: metric_card("Funkce", row.get("role") or "", row.get("evidence") or "")
        with c4: metric_card("Cena", row.get("cost_label") or "", f"GPS {int(row.get('track_count') or 0)}")
    with tabs[1]:
        saved = flight_form(f"edit_flight_{selected_id}", row.to_dict(), rates, "Uložit změny")
        if saved is not None:
            update_flight(int(selected_id), saved)
            st.success("Změny uloženy.")
            st.rerun()
    with tabs[2]:
        flight_tracks = read_tracks_for_flight(int(selected_id))
        if not flight_tracks.empty:
            st_folium(make_map(read_tracks_joined()[read_tracks_joined()["flight_id"].eq(int(selected_id))], dark_mode), height=440, use_container_width=True)
            first_points = json.loads(flight_tracks.iloc[0]["coordinates_json"])
            render_track_profile(first_points)
            show = flight_tracks[["id","file_name","point_count","distance_km","start_utc","end_utc","max_alt_m"]].rename(columns={"id":"Track ID","file_name":"Soubor","point_count":"Body","distance_km":"Km","start_utc":"Start UTC","end_utc":"End UTC","max_alt_m":"Max alt m"})
            st.dataframe(show, hide_index=True, use_container_width=True)
            del_id = st.selectbox("Smazat track", show["Track ID"].tolist(), format_func=lambda x: f"Track ID {x}")
            if st.button("Smazat vybraný track", type="secondary"):
                delete_track(int(del_id)); st.success("Track smazán."); st.rerun()
        else:
            st.info("K letu zatím není připojený track.")
        uploaded = st.file_uploader("Přidat / nahradit KML track", type=["kml"], key=f"attach_track_{selected_id}")
        if uploaded is not None:
            try:
                points = parse_kml_bytes(uploaded.read())
                if len(points) >= 2:
                    preview = pd.DataFrame([{"id": -1,"flight_id": selected_id,"coordinates_json": json.dumps(points),"file_name": uploaded.name,"distance_km": track_stats(points)["distance_km"],"date": row.get("date"),"registration": row.get("registration"),"departure": row.get("departure"),"arrival": row.get("arrival"),"role": row.get("role"),"evidence": row.get("evidence")}])
                    st_folium(make_map(preview, dark_mode), height=360, use_container_width=True)
                    replace = st.checkbox("Nahradit existující tracky u tohoto letu", value=True)
                    if st.button("Uložit track k letu", type="primary"):
                        save_track(int(selected_id), uploaded.name, points, replace_existing=replace)
                        st.success("Track uložen."); st.rerun()
                else:
                    st.error("V KML nejsou použitelné body.")
            except Exception as exc:
                st.error(f"KML se nepodařilo načíst: {exc}")


def page_new_flight(rates: pd.DataFrame, dark_mode: bool):
    st.markdown("## Nový let")
    tab_track, tab_manual = st.tabs(["Z tracku", "Ručně"])
    with tab_track:
        uploaded = st.file_uploader("KML track", type=["kml"], key="new_track_kml")
        if uploaded is None:
            st.info("Nahraj KML a aplikace z něj navrhne nový záznam letu.")
        else:
            raw = uploaded.read()
            try:
                points = parse_kml_bytes(raw)
            except Exception as exc:
                st.error(f"KML se nepodařilo načíst: {exc}")
                points = []
            if len(points) >= 2:
                defaults = infer_from_track(points, uploaded.name, rates)
                stats = defaults.pop("stats")
                c1, c2, c3, c4 = st.columns(4)
                with c1: metric_card("Body", str(stats["point_count"]), uploaded.name)
                with c2: metric_card("GPS délka", f"{stats['distance_km']:.1f} km", "")
                with c3: metric_card("Start UTC", (stats["start_utc"] or "—")[:16], "")
                with c4: metric_card("Max alt", f"{(stats['max_alt_m'] or 0)*3.28084:.0f} ft" if stats.get("max_alt_m") else "—", "")
                preview_df = pd.DataFrame([{"id": -1,"flight_id": -1,"coordinates_json": json.dumps(points),"file_name": uploaded.name,"distance_km": stats["distance_km"],"date": defaults.get("date"),"registration": defaults.get("registration"),"departure": defaults.get("departure"),"arrival": defaults.get("arrival"),"role": defaults.get("role"),"evidence": defaults.get("evidence")}])
                st_folium(make_map(preview_df, dark_mode), height=420, use_container_width=True)
                with st.expander("Profil tracku", expanded=True):
                    render_track_profile(points)
                saved = flight_form("new_from_track", defaults, rates, "Uložit nový let včetně tracku")
                if saved is not None:
                    flight_id = create_flight(saved)
                    save_track(flight_id, uploaded.name, points, replace_existing=True)
                    st.success(f"Let uložen jako ID {flight_id}.")
                    st.rerun()
            elif uploaded is not None:
                st.error("V KML nejsou použitelné body trasy.")
    with tab_manual:
        defaults = {"date": date.today(), "evidence": "ULL", "aircraft_class": "ULL", "starts": 1, "commander": "Točík Filip", "role": "PIC"}
        saved = flight_form("new_manual", defaults, rates, "Přidat let")
        if saved is not None:
            flight_id = create_flight(saved)
            st.success(f"Let uložen jako ID {flight_id}.")
            st.rerun()


def page_maps(flights: pd.DataFrame, dark_mode: bool):
    st.markdown("## Mapa letů")
    filtered = apply_filters(flights, "map")
    tracks = read_tracks_joined()
    if tracks.empty:
        st.info("Zatím není nahraný žádný KML track.")
        return
    tracks = tracks[tracks["flight_id"].isin(filtered["id"].tolist())].copy()
    if tracks.empty:
        st.info("Pro aktuální filtr není dostupný žádný track.")
        return
    c1, c2, c3 = st.columns(3)
    with c1: metric_card("Tracky", str(len(tracks)), "z aktuálního filtru")
    with c2: metric_card("GPS vzdálenost", f"{tracks['distance_km'].fillna(0).sum():.1f} km", "")
    with c3: metric_card("Letů ve filtru", str(len(filtered)), "")
    st_folium(make_map(tracks, dark_mode=dark_mode), height=680, use_container_width=True)
    st.dataframe(tracks[["date","registration","departure","arrival","role","evidence","file_name","point_count","distance_km"]].rename(columns={"date":"Datum","registration":"Imatrikulace","departure":"Odlet","arrival":"Přílet","role":"Funkce","evidence":"Evidence","file_name":"Soubor","point_count":"Body","distance_km":"Km"}), hide_index=True, use_container_width=True)


def page_rates(rates: pd.DataFrame):
    st.markdown("## Ceník")
    if rates.empty:
        rates = pd.DataFrame(columns=["id", "registration", "aircraft_type", "valid_from", "price_per_hour", "dry_price_per_hour", "source"])
    display = rates.rename(columns={"id":"ID","registration":"Imatrikulace","aircraft_type":"Typ","valid_from":"Od data","price_per_hour":"Cena Kč/h","dry_price_per_hour":"Suchá hodina Kč/h","source":"Zdroj"})
    edited = st.data_editor(display, hide_index=True, use_container_width=True, num_rows="dynamic", disabled=["ID"], height=640, column_config={"Cena Kč/h": st.column_config.NumberColumn(format="%.0f Kč"), "Suchá hodina Kč/h": st.column_config.NumberColumn(format="%.0f Kč")})
    if st.button("Uložit ceník", type="primary"):
        with connect() as con:
            con.execute("DELETE FROM rates")
            for _, row in edited.iterrows():
                reg = normalize_text(row.get("Imatrikulace"))
                if not reg: continue
                con.execute("INSERT INTO rates (registration, aircraft_type, valid_from, price_per_hour, dry_price_per_hour, source) VALUES (?, ?, ?, ?, ?, ?)", (reg.upper(), normalize_text(row.get("Typ")), normalize_text(row.get("Od data")), float(row.get("Cena Kč/h") or 0), float(row.get("Suchá hodina Kč/h") or 0), normalize_text(row.get("Zdroj"))))
            con.commit()
        st.success("Ceník uložen."); st.rerun()


def make_control_df(df: pd.DataFrame) -> pd.DataFrame:
    rows = []
    for _, r in df.iterrows():
        issues = []
        if pd.isna(r.get("date_dt")): issues.append("datum")
        else:
            y = int(r["date_dt"].year)
            if y < 2000 or y > 2035: issues.append("rok")
        for col, label in [("evidence","evidence"),("registration","imatrikulace"),("role","funkce")]:
            if not str(r.get(col) or "").strip(): issues.append(label)
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

def main():
    st.set_page_config(page_title="Letový zápisník", page_icon="✈️", layout="wide", initial_sidebar_state="expanded")
    with connect(): pass
    with st.sidebar:
        st.markdown("## ✈️ Logbook")
        dark_mode = st.toggle("Dark mode", value=True)
        page = st.radio("Sekce", ["Dashboard", "Lety", "Nový let", "Mapa", "Ceník", "Kontrola", "Export"], index=0)
    apply_ui_theme(dark_mode)
    app_header()
    flights = read_flights()
    rates = read_table("rates")
    if not rates.empty:
        rates["registration"] = rates["registration"].fillna("").str.upper()
    if page == "Dashboard": page_dashboard(flights)
    elif page == "Lety": page_logbook(flights, rates, dark_mode)
    elif page == "Nový let": page_new_flight(rates, dark_mode)
    elif page == "Mapa": page_maps(flights, dark_mode)
    elif page == "Ceník": page_rates(rates)
    elif page == "Kontrola": page_control(flights)
    elif page == "Export": page_export(flights)

if __name__ == "__main__":
    main()
