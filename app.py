from __future__ import annotations

import base64
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

import requests

import folium
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
import streamlit as st
try:
    from st_aggrid import AgGrid, DataReturnMode, GridOptionsBuilder, GridUpdateMode
    HAS_AGGRID = True
except Exception:
    AgGrid = None
    DataReturnMode = None
    GridOptionsBuilder = None
    GridUpdateMode = None
    HAS_AGGRID = False
from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter
from streamlit_folium import st_folium

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
DB_PATH = DATA_DIR / "logbook.sqlite"
AIRPORT_OVERRIDES_PATH = DATA_DIR / "airport_overrides.csv"
OURAIRPORTS_AIRPORTS_URL = "https://davidmegginson.github.io/ourairports-data/airports.csv"
APP_VERSION = "v0.11"
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
    ("Kontrola", "Kontrola"),
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
    time_utc TEXT,
    latitude_deg REAL NOT NULL,
    longitude_deg REAL NOT NULL,
    altitude_m REAL,
    segment_km REAL,
    distance_km REAL,
    speed_kmh REAL,
    speed_kt REAL,
    source TEXT,
    FOREIGN KEY(track_id) REFERENCES flight_tracks(id) ON DELETE CASCADE,
    UNIQUE(track_id, seq)
);
CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at TEXT NOT NULL,
    actor TEXT,
    action TEXT NOT NULL,
    object_type TEXT,
    object_id TEXT,
    detail_json TEXT
);
CREATE INDEX IF NOT EXISTS idx_flights_date ON flights(date);
CREATE INDEX IF NOT EXISTS idx_flights_registration ON flights(registration);
CREATE INDEX IF NOT EXISTS idx_flights_evidence_role ON flights(evidence, role);
CREATE INDEX IF NOT EXISTS idx_tracks_flight_id ON flight_tracks(flight_id);
CREATE INDEX IF NOT EXISTS idx_track_points_track_seq ON track_points(track_id, seq);
CREATE INDEX IF NOT EXISTS idx_airports_ident ON airports(ident);
CREATE INDEX IF NOT EXISTS idx_airports_country ON airports(iso_country);
CREATE INDEX IF NOT EXISTS idx_airports_active ON airports(active, closed);
CREATE INDEX IF NOT EXISTS idx_audit_created_at ON audit_log(created_at);
"""

# -----------------------------------------------------------------------------
# Database
# -----------------------------------------------------------------------------
# -----------------------------------------------------------------------------

def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _set_meta(con: sqlite3.Connection, key: str, value: Any) -> None:
    con.execute(
        "INSERT OR REPLACE INTO app_meta (key, value, updated_at) VALUES (?, ?, ?)",
        (key, str(value), _now_iso()),
    )


def _get_secret(section: str, key: str, default: Any = None) -> Any:
    try:
        sec = st.secrets.get(section, {})
        if hasattr(sec, "get"):
            return sec.get(key, default)
    except Exception:
        pass
    return default


def auth_configured() -> bool:
    return bool(_get_secret("auth", "admin_password", ""))


def is_admin() -> bool:
    return st.session_state.get("auth_role") == "admin"


def actor_name() -> str:
    return "admin" if is_admin() else "viewer"


def render_auth_sidebar() -> None:
    admin_password = _get_secret("auth", "admin_password", "")
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


def require_admin() -> bool:
    if is_admin():
        return True
    st.warning("Tato akce je dostupná jen po přihlášení jako admin.")
    return False


def record_audit(con: sqlite3.Connection, action: str, object_type: str | None = None, object_id: Any = None, detail: Any = None) -> None:
    try:
        con.execute(
            "INSERT INTO audit_log (created_at, actor, action, object_type, object_id, detail_json) VALUES (?, ?, ?, ?, ?, ?)",
            (_now_iso(), actor_name(), action, object_type, str(object_id) if object_id is not None else None, json.dumps(detail, ensure_ascii=False, default=str) if detail is not None else None),
        )
        _set_meta(con, "last_change_at", _now_iso())
        _set_meta(con, "dirty", "1")
    except Exception:
        pass


def github_backup_configured() -> bool:
    return bool(_get_secret("github", "token", "") or _get_secret("github_sync", "token", ""))


def github_backup_config() -> dict[str, str]:
    token = _get_secret("github", "token", "") or _get_secret("github_sync", "token", "")
    repo = _get_secret("github", "repo", "") or _get_secret("github_sync", "repo", "filipto861/Logbook")
    db_path = _get_secret("github", "db_path", "") or _get_secret("github_sync", "db_path", "data/logbook.sqlite")
    return {"token": token, "repo": repo, "db_path": db_path}


def checkpoint_database() -> None:
    with sqlite3.connect(DB_PATH) as con:
        try:
            con.execute("PRAGMA wal_checkpoint(FULL)")
        except sqlite3.DatabaseError:
            pass


def backup_database_to_github(commit_message: str | None = None) -> str:
    cfg = github_backup_config()
    if not cfg["token"]:
        raise RuntimeError("Chybí GitHub token ve Streamlit secrets.")
    checkpoint_database()
    if not DB_PATH.exists():
        raise RuntimeError("Databázový soubor neexistuje.")
    api_url = f"https://api.github.com/repos/{cfg['repo']}/contents/{cfg['db_path']}"
    headers = {"Authorization": f"Bearer {cfg['token']}", "Accept": "application/vnd.github+json"}
    sha = None
    get_resp = requests.get(api_url, headers=headers, timeout=30)
    if get_resp.status_code == 200:
        sha = get_resp.json().get("sha")
    elif get_resp.status_code not in (404,):
        raise RuntimeError(f"GitHub GET selhal: {get_resp.status_code} {get_resp.text[:300]}")
    content_b64 = base64.b64encode(DB_PATH.read_bytes()).decode("ascii")
    payload = {
        "message": commit_message or f"Backup logbook database {datetime.now(LOCAL_TZ).strftime('%Y-%m-%d %H:%M')}",
        "content": content_b64,
    }
    if sha:
        payload["sha"] = sha
    put_resp = requests.put(api_url, headers=headers, json=payload, timeout=60)
    if put_resp.status_code not in (200, 201):
        raise RuntimeError(f"GitHub PUT selhal: {put_resp.status_code} {put_resp.text[:500]}")
    with connect() as con:
        _set_meta(con, "last_github_backup_at", _now_iso())
        _set_meta(con, "dirty", "0")
        record_audit(con, "github_backup", "database", cfg["db_path"], {"repo": cfg["repo"]})
        con.commit()
    return put_resp.json().get("commit", {}).get("html_url", "")


def restore_database_from_upload(uploaded_file) -> None:
    raw = uploaded_file.read()
    if not raw.startswith(b"SQLite format 3"):
        raise RuntimeError("Nahraný soubor nevypadá jako SQLite databáze.")
    backup_path = DB_PATH.with_suffix(".sqlite.before_restore")
    if DB_PATH.exists():
        checkpoint_database()
        backup_path.write_bytes(DB_PATH.read_bytes())
    DB_PATH.write_bytes(raw)
    global _DB_READY
    _DB_READY = False
    with connect() as con:
        record_audit(con, "restore_database", "database", None, {"file": uploaded_file.name})
        con.commit()


def initialize_database(con: sqlite3.Connection) -> None:
    """Idempotent DB bootstrap/migration.

    The application schema lives in SQLite, not in Excel. Existing v0.4 databases are
    upgraded in place: flights/rates/tracks stay untouched, while airport/aircraft
    registries and normalized track_points are added.
    """
    con.execute("PRAGMA foreign_keys = ON")
    con.execute("PRAGMA busy_timeout = 5000")
    try:
        con.execute("PRAGMA journal_mode = WAL")
    except sqlite3.DatabaseError:
        pass
    con.executescript(SCHEMA)
    _set_meta(con, "schema_version", DB_SCHEMA_VERSION)
    _seed_airports_from_overrides(con)
    _seed_aircraft_from_existing_data(con)
    _backfill_track_points(con)
    con.commit()


def connect() -> sqlite3.Connection:
    global _DB_READY
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    con = sqlite3.connect(DB_PATH)
    con.row_factory = sqlite3.Row
    if not _DB_READY:
        initialize_database(con)
        _DB_READY = True
    else:
        con.execute("PRAGMA foreign_keys = ON")
        con.execute("PRAGMA busy_timeout = 5000")
    return con


def _seed_airports_from_overrides(con: sqlite3.Connection) -> None:
    if not AIRPORT_OVERRIDES_PATH.exists():
        return
    try:
        df = pd.read_csv(AIRPORT_OVERRIDES_PATH)
    except Exception:
        return
    if df.empty:
        return
    import_airports_dataframe(con, df, default_source="manual_override", replace_existing=True)


def _seed_aircraft_from_existing_data(con: sqlite3.Connection) -> None:
    rows = con.execute(
        """
        SELECT registration,
               MAX(aircraft_type) AS aircraft_type,
               MAX(aircraft_class) AS aircraft_class,
               MAX(evidence) AS evidence,
               MAX(price_per_hour) AS price_per_hour
        FROM flights
        WHERE registration IS NOT NULL AND TRIM(registration) <> ''
        GROUP BY registration
        """
    ).fetchall()
    now = _now_iso()
    for row in rows:
        con.execute(
            """
            INSERT INTO aircraft (registration, aircraft_type, icao_type, aircraft_class, evidence, default_price_per_hour, active, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)
            ON CONFLICT(registration) DO UPDATE SET
                aircraft_type=COALESCE(excluded.aircraft_type, aircraft.aircraft_type),
                icao_type=COALESCE(excluded.icao_type, aircraft.icao_type),
                aircraft_class=COALESCE(excluded.aircraft_class, aircraft.aircraft_class),
                evidence=COALESCE(excluded.evidence, aircraft.evidence),
                default_price_per_hour=COALESCE(excluded.default_price_per_hour, aircraft.default_price_per_hour),
                updated_at=excluded.updated_at
            """,
            (
                (row["registration"] or "").upper(),
                row["aircraft_type"],
                row["aircraft_type"],
                row["aircraft_class"],
                row["evidence"],
                row["price_per_hour"],
                now,
                now,
            ),
        )


def _backfill_track_points(con: sqlite3.Connection) -> None:
    existing = con.execute("SELECT COUNT(*) FROM track_points").fetchone()[0]
    tracks = con.execute("SELECT id, coordinates_json FROM flight_tracks").fetchall()
    if existing > 0 or not tracks:
        return
    for tr in tracks:
        try:
            points = json.loads(tr["coordinates_json"] or "[]")
        except Exception:
            points = []
        insert_track_points(con, int(tr["id"]), points)


def read_table(table: str) -> pd.DataFrame:
    with connect() as con:
        return pd.read_sql_query(f"SELECT * FROM {table}", con)



def _clean_ident(value: Any) -> str:
    text = normalize_text(value)
    return (text or "").upper()


def _to_float(value: Any) -> float | None:
    if value is None or pd.isna(value):
        return None
    try:
        text = str(value).strip().replace(",", ".")
        return float(text) if text else None
    except ValueError:
        return None


def import_airports_dataframe(
    con: sqlite3.Connection,
    df: pd.DataFrame,
    default_source: str,
    replace_existing: bool = True,
) -> int:
    """Import airport-like rows into the airports registry.

    Supported input columns include both OurAirports names and our local override
    names: ident/name/type/airport_type/latitude_deg/lat/longitude_deg/lon.
    """
    if df.empty:
        return 0
    normalized_cols = {str(c).strip().lower(): c for c in df.columns}

    def val(row, *names, default=None):
        for name in names:
            col = normalized_cols.get(name.lower())
            if col is not None:
                return row.get(col)
        return default

    now = _now_iso()
    count = 0
    for _, row in df.iterrows():
        ident = _clean_ident(val(row, "ident", "code", "local_code", "gps_code"))
        name = normalize_text(val(row, "name", "airport_name"))
        lat = _to_float(val(row, "latitude_deg", "lat", "latitude"))
        lon = _to_float(val(row, "longitude_deg", "lon", "longitude"))
        if not ident or lat is None or lon is None:
            continue
        airport_type = normalize_text(val(row, "airport_type", "type", default="small_airport"))
        closed = 1 if str(airport_type or "").lower() == "closed_airport" else int(_to_float(val(row, "closed", default=0)) or 0)
        active = 0 if closed else int(_to_float(val(row, "active", default=1)) or 1)
        source = normalize_text(val(row, "source")) or default_source
        raw = {str(k): (None if pd.isna(v) else v) for k, v in row.to_dict().items()}
        params = (
            ident,
            name,
            airport_type,
            normalize_text(val(row, "iso_country")),
            normalize_text(val(row, "iso_region")),
            normalize_text(val(row, "municipality")),
            lat,
            lon,
            _to_float(val(row, "elevation_ft")),
            normalize_text(val(row, "gps_code")),
            normalize_text(val(row, "iata_code")),
            normalize_text(val(row, "local_code")) or ident,
            source,
            active,
            closed,
            normalize_text(val(row, "data_quality")) or "imported",
            now,
            now,
            json.dumps(raw, ensure_ascii=False),
        )
        if replace_existing:
            con.execute(
                """
                INSERT INTO airports (ident, name, airport_type, iso_country, iso_region, municipality,
                    latitude_deg, longitude_deg, elevation_ft, gps_code, iata_code, local_code,
                    source, active, closed, data_quality, imported_at, updated_at, raw_json)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(ident) DO UPDATE SET
                    name=excluded.name,
                    airport_type=excluded.airport_type,
                    iso_country=excluded.iso_country,
                    iso_region=excluded.iso_region,
                    municipality=excluded.municipality,
                    latitude_deg=excluded.latitude_deg,
                    longitude_deg=excluded.longitude_deg,
                    elevation_ft=excluded.elevation_ft,
                    gps_code=excluded.gps_code,
                    iata_code=excluded.iata_code,
                    local_code=excluded.local_code,
                    source=excluded.source,
                    active=excluded.active,
                    closed=excluded.closed,
                    data_quality=excluded.data_quality,
                    updated_at=excluded.updated_at,
                    raw_json=excluded.raw_json
                """,
                params,
            )
        else:
            con.execute(
                """
                INSERT OR IGNORE INTO airports (ident, name, airport_type, iso_country, iso_region, municipality,
                    latitude_deg, longitude_deg, elevation_ft, gps_code, iata_code, local_code,
                    source, active, closed, data_quality, imported_at, updated_at, raw_json)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                params,
            )
        count += 1
    _set_meta(con, f"airport_import_{default_source}", f"{count} rows")
    return count


def read_airports(active_only: bool = True) -> pd.DataFrame:
    query = "SELECT * FROM airports"
    if active_only:
        query += " WHERE active = 1 AND closed = 0 AND latitude_deg IS NOT NULL AND longitude_deg IS NOT NULL"
    query += " ORDER BY ident"
    with connect() as con:
        return pd.read_sql_query(query, con)


def import_ourairports_to_database() -> int:
    df = pd.read_csv(OURAIRPORTS_AIRPORTS_URL)
    with connect() as con:
        count = import_airports_dataframe(con, df, default_source="OurAirports", replace_existing=True)
        _seed_airports_from_overrides(con)
        _set_meta(con, "ourairports_url", OURAIRPORTS_AIRPORTS_URL)
        con.commit()
        return count


def import_airport_csv_upload(uploaded_file) -> int:
    df = pd.read_csv(uploaded_file)
    with connect() as con:
        count = import_airports_dataframe(con, df, default_source="user_csv", replace_existing=True)
        con.commit()
        return count


def insert_track_points(con: sqlite3.Connection, track_id: int, points: list[dict[str, Any]]) -> None:
    if not points:
        return
    profile = profile_from_points(points)
    if profile.empty:
        return
    rows = []
    for _, p in profile.iterrows():
        speed_kmh = None if pd.isna(p.get("speed_kmh")) else float(p.get("speed_kmh"))
        rows.append((
            track_id,
            int(p["idx"]),
            p["time_utc"].isoformat() if pd.notna(p.get("time_utc")) else None,
            float(p["lat"]),
            float(p["lon"]),
            None if pd.isna(p.get("alt_m")) else float(p.get("alt_m")),
            float(p.get("seg_km") or 0),
            float(p.get("distance_km") or 0),
            speed_kmh,
            speed_kmh * 0.539957 if speed_kmh is not None else None,
            "kml",
        ))
    con.executemany(
        """
        INSERT OR REPLACE INTO track_points
        (track_id, seq, time_utc, latitude_deg, longitude_deg, altitude_m,
         segment_km, distance_km, speed_kmh, speed_kt, source)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        rows,
    )

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
    .selected-flight-box {{border:1px solid var(--border); border-radius:14px; padding:.65rem .85rem; background:rgba(56,189,248,.07); margin:.5rem 0 .75rem 0;}}
    .selected-flight-title {{font-weight:850;color:var(--text);}}
    .selected-flight-sub {{font-size:.82rem;color:var(--muted);margin-top:.1rem;}}
    .stTabs [data-baseweb="tab-list"] {{gap:.45rem;}}
    .stTabs [data-baseweb="tab"] {{border-radius:999px;padding:.45rem .9rem;background:var(--panel2);}}
    div.stButton > button {{border-radius:14px !important; font-weight:800 !important; border:1px solid var(--border) !important; min-height:2.65rem;}}
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
    st.markdown("### Navigace")
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


def _query_param_value(name: str) -> str | None:
    try:
        value = st.query_params.get(name)
        if isinstance(value, list):
            return value[0] if value else None
        return value
    except Exception:
        return None


def detail_link(flight_id: int) -> str:
    try:
        current_url = str(getattr(st.context, "url", "") or "")
        if current_url.startswith(("http://", "https://")):
            base = current_url.split("?")[0].split("#")[0]
            return f"{base}?flight_id={int(flight_id)}"
    except Exception:
        pass
    return f"?flight_id={int(flight_id)}"


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

    with st.expander("Filtry", expanded=False):
        st.caption("Výchozí stav zobrazuje všechny lety. Filtry rozbal jen při hledání konkrétního období, letadla nebo funkce.")
        f1, f2, f3, f4 = st.columns(4)
        with f1:
            selected_years = st.multiselect("Rok", years, default=years, key=f"{key_prefix}_years")
        with f2:
            selected_evidence = st.multiselect("Evidence", EVIDENCE_OPTIONS, default=EVIDENCE_OPTIONS, key=f"{key_prefix}_ev")
        with f3:
            selected_roles = st.multiselect("Funkce", roles, default=roles, key=f"{key_prefix}_roles")
        with f4:
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
    airports = read_airports(active_only=True)
    if airports.empty:
        return ""
    p_lat = float(point["lat"])
    p_lon = float(point["lon"])
    lat = pd.to_numeric(airports["latitude_deg"], errors="coerce")
    lon = pd.to_numeric(airports["longitude_deg"], errors="coerce")
    valid = lat.notna() & lon.notna()
    if not valid.any():
        return ""
    work = airports.loc[valid].copy()
    lat = lat.loc[valid]
    lon = lon.loc[valid]
    # Vectorized haversine. Fast enough for full OurAirports database.
    r = 6371.0088
    lat1 = math.radians(p_lat)
    lat2 = lat.apply(math.radians)
    dlat = lat2 - lat1
    dlon = (lon - p_lon).apply(math.radians)
    h = (dlat / 2).apply(math.sin).pow(2) + math.cos(lat1) * lat2.apply(math.cos) * (dlon / 2).apply(math.sin).pow(2)
    dist = 2 * r * h.apply(lambda x: math.asin(math.sqrt(min(max(float(x), 0.0), 1.0))))
    best_pos = int(dist.idxmin())
    best_dist = float(dist.loc[best_pos])
    if best_dist <= max_km:
        return str(work.loc[best_pos, "ident"]).upper()
    return ""


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
        cur = con.execute(
            """
            INSERT INTO flight_tracks (flight_id, file_name, imported_at, point_count, distance_km, start_utc, end_utc, min_alt_m, max_alt_m, coordinates_json)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (flight_id, file_name, _now_iso(), stats["point_count"], stats["distance_km"], stats["start_utc"], stats["end_utc"], stats["min_alt_m"], stats["max_alt_m"], json.dumps(points, ensure_ascii=False)),
        )
        track_id = int(cur.lastrowid)
        insert_track_points(con, track_id, points)
        record_audit(con, "save_track", "flight_tracks", track_id, {"flight_id": flight_id, "file_name": file_name, "replace_existing": replace_existing})
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
        flight_id = int(cur.lastrowid)
        record_audit(con, "create_flight", "flights", flight_id, data)
        con.commit()
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


def delete_track(track_id: int) -> None:
    with connect() as con:
        con.execute("DELETE FROM flight_tracks WHERE id = ?", (track_id,))
        record_audit(con, "delete_track", "flight_tracks", track_id, None)
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



@st.dialog("Detail letu", width="large", dismissible=True, on_dismiss=clear_open_flight_dialog)
def flight_detail_dialog(selected_id: int, row_data: dict[str, Any], rates: pd.DataFrame, dark_mode: bool) -> None:
    row = pd.Series(row_data)
    st.markdown(f"### {flight_label(row_data)}")
    tabs = st.tabs(["Přehled", "Editace", "Track"])
    with tabs[0]:
        c1, c2, c3, c4 = st.columns(4)
        with c1: metric_card("Block", row.get("block_time") or "", f"Air {row.get('air_time') or ''}")
        with c2: metric_card("Trasa", f"{row.get('departure') or ''}–{row.get('arrival') or ''}", row.get("registration") or "")
        with c3: metric_card("Funkce", row.get("role") or "", row.get("evidence") or "")
        with c4: metric_card("Cena", row.get("cost_label") or "", f"GPS {int(row.get('track_count') or 0)}")
        st.write("")
        info = {
            "Datum": row.get("date"),
            "Imatrikulace": row.get("registration"),
            "Typ": row.get("aircraft_type"),
            "Třída": row.get("aircraft_class"),
            "Odlet": row.get("departure"),
            "Přílet": row.get("arrival"),
            "Off Block": row.get("off_block"),
            "Takeoff": row.get("takeoff"),
            "Landing": row.get("landing"),
            "On Block": row.get("on_block"),
            "Velitel": row.get("commander"),
            "Instruktor": row.get("instructor"),
            "Úloha": row.get("task"),
            "Poznámka": row.get("note"),
        }
        st.dataframe(pd.DataFrame([info]).T.rename(columns={0: "Hodnota"}), use_container_width=True, height=455)
    with tabs[1]:
        if not is_admin():
            st.info("Editace je dostupná jen po přihlášení jako admin.")
        else:
            saved = flight_form(f"edit_flight_{selected_id}", row.to_dict(), rates, "Uložit změny")
            if saved is not None:
                update_flight(int(selected_id), saved)
                st.success("Změny uloženy.")
                clear_open_flight_dialog()
                st.rerun()
    with tabs[2]:
        flight_tracks = read_tracks_for_flight(int(selected_id))
        if not flight_tracks.empty:
            joined = read_tracks_joined()
            st_folium(make_map(joined[joined["flight_id"].eq(int(selected_id))], dark_mode), height=440, use_container_width=True)
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
                    st_folium(make_map(preview, dark_mode), height=360, use_container_width=True)
                    replace = st.checkbox("Nahradit existující tracky u tohoto letu", value=True)
                    if st.button("Uložit track k letu", type="primary", disabled=not is_admin(), use_container_width=True):
                        if require_admin():
                            save_track(int(selected_id), uploaded.name, points, replace_existing=replace)
                            st.success("Track uložen."); st.rerun()
                else:
                    st.error("V KML nejsou použitelné body.")
            except Exception as exc:
                st.error(f"KML se nepodařilo načíst: {exc}")
    if st.button("Zavřít detail", use_container_width=True):
        clear_open_flight_dialog()
        st.rerun()



def render_flight_list(table_df: pd.DataFrame, rates: pd.DataFrame, dark_mode: bool) -> None:
    """Reliable compact flight list based on native Streamlit selection.

    v0.10 AgGrid selection was visually nice but unreliable on Streamlit Cloud.
    v0.11 returns to native st.dataframe selection, preserves the detailed columns,
    and adds a direct ID fallback so opening a flight never depends on a custom grid.
    """
    if table_df.empty:
        st.info("Filtr nevrátil žádné lety.")
        return

    st.markdown(
        '<div class="flight-help">Vyber řádek v tabulce. Potom otevři detail tlačítkem pod tabulkou. Detail se otevře přímo v aplikaci.</div>',
        unsafe_allow_html=True,
    )

    display_df = flight_display_df(table_df).copy()

    controls = st.columns([1.0, 2.4, 1.4])
    with controls[0]:
        table_height = st.selectbox("Velikost tabulky", [420, 520, 620], index=1, format_func=lambda x: {420:"Kompaktní",520:"Střední",620:"Velká"}[x], key="flight_table_height")
    with controls[1]:
        quick_filter = st.text_input("Rychlé hledání", value="", placeholder="registrace, letiště, typ, funkce…", key="flight_table_quick_filter")
    with controls[2]:
        st.write("")
        st.write(f"{len(display_df)} letů")

    if quick_filter.strip():
        q = quick_filter.strip().lower()
        mask = display_df.astype(str).apply(lambda col: col.str.lower().str.contains(q, na=False)).any(axis=1)
        shown_df = display_df[mask].copy()
        shown_table_df = table_df.loc[shown_df.index].copy()
    else:
        shown_df = display_df.copy()
        shown_table_df = table_df.copy()

    # Keep row mapping robust even after quick filtering.
    shown_df = shown_df.reset_index(drop=True)
    shown_table_df = shown_table_df.reset_index(drop=True)

    column_config = {
        "ID": st.column_config.NumberColumn("ID", width="small"),
        "Datum": st.column_config.TextColumn("Datum", width="small"),
        "Evidence": st.column_config.TextColumn("Evidence", width="small"),
        "Imatrikulace": st.column_config.TextColumn("Imatrikulace", width="medium"),
        "Typ": st.column_config.TextColumn("Typ", width="medium"),
        "Třída": st.column_config.TextColumn("Třída", width="small"),
        "Odlet": st.column_config.TextColumn("Odlet", width="small"),
        "Přílet": st.column_config.TextColumn("Přílet", width="small"),
        "Off Block": st.column_config.TextColumn("Off Block", width="small"),
        "Takeoff": st.column_config.TextColumn("Takeoff", width="small"),
        "Landing": st.column_config.TextColumn("Landing", width="small"),
        "On Block": st.column_config.TextColumn("On Block", width="small"),
        "Block": st.column_config.TextColumn("Block", width="small"),
        "Air": st.column_config.TextColumn("Air", width="small"),
        "Starty": st.column_config.NumberColumn("Starty", width="small"),
        "Velitel": st.column_config.TextColumn("Velitel", width="medium"),
        "Instruktor": st.column_config.TextColumn("Instruktor", width="medium"),
        "Funkce": st.column_config.TextColumn("Funkce", width="medium"),
        "Úloha": st.column_config.TextColumn("Úloha", width="small"),
        "Kč/h": st.column_config.NumberColumn("Kč/h", width="small"),
        "Cena": st.column_config.TextColumn("Cena", width="small"),
        "GPS": st.column_config.NumberColumn("GPS", width="small"),
        "GPS km": st.column_config.NumberColumn("GPS km", width="small"),
        "Poznámka": st.column_config.TextColumn("Poznámka", width="large"),
    }

    event = st.dataframe(
        shown_df,
        hide_index=True,
        use_container_width=True,
        height=int(table_height),
        key="flight_table_selection_v11",
        on_select="rerun",
        selection_mode="single-row",
        column_config=column_config,
    )

    selected_id: int | None = None
    selected_rows = get_selected_dataframe_rows(event)
    if selected_rows:
        pos = int(selected_rows[0])
        if 0 <= pos < len(shown_table_df):
            selected_id = int(shown_table_df.iloc[pos]["id"])
            st.session_state["selected_flight_id"] = selected_id

    if selected_id is None:
        remembered = st.session_state.get("selected_flight_id")
        valid_ids = set(shown_table_df["id"].astype(int).tolist())
        if remembered is not None and int(remembered) in valid_ids:
            selected_id = int(remembered)

    # Fallback direct selector: robust even if browser/table selection misbehaves.
    with st.expander("Otevřít let podle ID", expanded=False):
        labels = [flight_label(row) for _, row in shown_table_df.iterrows()]
        ids = shown_table_df["id"].astype(int).tolist()
        if ids:
            current_index = ids.index(selected_id) if selected_id in ids else max(0, len(ids)-1)
            picked = st.selectbox("Let", ids, index=current_index, format_func=lambda x: labels[ids.index(int(x))], key="flight_id_fallback_select")
            if st.button("Otevřít vybraný let", type="primary", use_container_width=True, key="open_fallback_flight"):
                st.session_state["selected_flight_id"] = int(picked)
                st.session_state["open_flight_dialog_id"] = int(picked)
                st.session_state.pop("dismissed_flight_id", None)
                st.rerun()

    if selected_id is not None:
        selected_row = shown_table_df[shown_table_df["id"].astype(int).eq(int(selected_id))].iloc[0]
        st.markdown(
            f"""
            <div class="selected-flight-box">
              <div class="selected-flight-title">Vybraný let: ID {int(selected_id)} • {selected_row.get('date') or ''} • {selected_row.get('registration') or ''}</div>
              <div class="selected-flight-sub">{selected_row.get('departure') or ''}–{selected_row.get('arrival') or ''} • {selected_row.get('off_block') or ''}–{selected_row.get('on_block') or ''} • {selected_row.get('role') or ''}</div>
            </div>
            """,
            unsafe_allow_html=True,
        )
        if st.button("Otevřít detail vybraného letu", type="primary", use_container_width=True, key="open_selected_flight_detail"):
            st.session_state["open_flight_dialog_id"] = int(selected_id)
            st.session_state.pop("dismissed_flight_id", None)
            st.rerun()

    open_id = st.session_state.get("open_flight_dialog_id")
    valid_ids = set(table_df["id"].astype(int).tolist())
    if open_id is not None and int(open_id) in valid_ids:
        dialog_row = table_df[table_df["id"].astype(int).eq(int(open_id))].iloc[0]
        flight_detail_dialog(int(open_id), dialog_row.to_dict(), rates, dark_mode)



def page_logbook(df: pd.DataFrame, rates: pd.DataFrame, dark_mode: bool):
    st.markdown("## Lety")
    filtered = apply_filters(df, "logbook")
    s = build_summary(filtered)
    c1, c2, c3, c4 = st.columns(4)
    with c1: metric_card("Zobrazeno", str(s["flights"]), "letů")
    with c2: metric_card("Celkem", fmt_minutes(s["total"]), "block time")
    with c3: metric_card("PIC", fmt_minutes(s["pic"]), "z filtrovaných letů")
    with c4: metric_card("GPS", str(s["tracks"]), f"{s['gps_km']:.0f} km")

    if filtered.empty:
        st.info("Filtr nevrátil žádné lety.")
        return

    table_df = filtered.sort_values(["date_dt", "off_block", "id"], na_position="last").reset_index(drop=True)
    render_flight_list(table_df, rates, dark_mode)

def page_new_flight(rates: pd.DataFrame, dark_mode: bool):
    st.markdown("## Nový let")
    if not is_admin():
        st.info("Přidání letu je dostupné jen po přihlášení jako admin.")
        return
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
    edited = st.data_editor(display, hide_index=True, use_container_width=True, num_rows="dynamic", disabled=["ID"] if is_admin() else display.columns.tolist(), height=640, column_config={"Cena Kč/h": st.column_config.NumberColumn(format="%.0f Kč"), "Suchá hodina Kč/h": st.column_config.NumberColumn(format="%.0f Kč")})
    if st.button("Uložit ceník", type="primary", disabled=not is_admin()):
        if require_admin():
            save_rates_editor(edited)
            st.success("Ceník uložen."); st.rerun()



def save_rates_editor(edited: pd.DataFrame) -> None:
    with connect() as con:
        con.execute("DELETE FROM rates")
        for _, row in edited.iterrows():
            reg = normalize_text(row.get("Imatrikulace"))
            if not reg:
                continue
            con.execute(
                "INSERT INTO rates (registration, aircraft_type, valid_from, price_per_hour, dry_price_per_hour, source) VALUES (?, ?, ?, ?, ?, ?)",
                (reg.upper(), normalize_text(row.get("Typ")), normalize_text(row.get("Od data")), float(row.get("Cena Kč/h") or 0), float(row.get("Suchá hodina Kč/h") or 0), normalize_text(row.get("Zdroj"))),
            )
        record_audit(con, "save_rates", "rates", None, {"rows": len(edited)})
        con.commit()


def save_aircraft_editor(edited: pd.DataFrame) -> None:
    with connect() as con:
        con.execute("DELETE FROM aircraft")
        now = _now_iso()
        for _, row in edited.iterrows():
            reg = normalize_text(row.get("Imatrikulace"))
            if not reg:
                continue
            con.execute(
                """
                INSERT INTO aircraft (registration, aircraft_type, icao_type, aircraft_class, evidence, default_price_per_hour, active, note, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (reg.upper(), normalize_text(row.get("Typ")), normalize_text(row.get("ICAO typ")), normalize_text(row.get("Třída")), normalize_text(row.get("Evidence")), float(row.get("Výchozí Kč/h") or 0), int(row.get("Aktivní") or 0), normalize_text(row.get("Poznámka")), now, now),
            )
        record_audit(con, "save_aircraft", "aircraft", None, {"rows": len(edited)})
        con.commit()


def upsert_airport_form(data: dict[str, Any]) -> None:
    ident = _clean_ident(data.get("ident"))
    if not ident:
        raise ValueError("Ident letiště je povinný.")
    lat = _to_float(data.get("latitude_deg"))
    lon = _to_float(data.get("longitude_deg"))
    if lat is None or lon is None:
        raise ValueError("Latitude a longitude jsou povinné.")
    now = _now_iso()
    with connect() as con:
        con.execute(
            """
            INSERT INTO airports (ident, name, airport_type, iso_country, iso_region, municipality, latitude_deg, longitude_deg, elevation_ft, gps_code, iata_code, local_code, source, active, closed, data_quality, imported_at, updated_at, raw_json)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(ident) DO UPDATE SET
                name=excluded.name,
                airport_type=excluded.airport_type,
                iso_country=excluded.iso_country,
                iso_region=excluded.iso_region,
                municipality=excluded.municipality,
                latitude_deg=excluded.latitude_deg,
                longitude_deg=excluded.longitude_deg,
                elevation_ft=excluded.elevation_ft,
                gps_code=excluded.gps_code,
                iata_code=excluded.iata_code,
                local_code=excluded.local_code,
                source=excluded.source,
                active=excluded.active,
                closed=excluded.closed,
                data_quality=excluded.data_quality,
                updated_at=excluded.updated_at,
                raw_json=excluded.raw_json
            """,
            (
                ident,
                normalize_text(data.get("name")),
                normalize_text(data.get("airport_type")) or "manual_field",
                normalize_text(data.get("iso_country")) or "CZ",
                normalize_text(data.get("iso_region")),
                normalize_text(data.get("municipality")),
                lat,
                lon,
                _to_float(data.get("elevation_ft")),
                normalize_text(data.get("gps_code")),
                normalize_text(data.get("iata_code")),
                normalize_text(data.get("local_code")),
                normalize_text(data.get("source")) or "manual",
                int(bool(data.get("active", True))),
                int(bool(data.get("closed", False))),
                normalize_text(data.get("data_quality")) or "manual",
                now,
                now,
                json.dumps(data, ensure_ascii=False, default=str),
            ),
        )
        record_audit(con, "upsert_airport", "airports", ident, data)
        con.commit()


def page_database():
    st.markdown("## Databáze")
    airports = read_airports(active_only=False)
    aircraft = read_table("aircraft")
    tracks = read_table("flight_tracks")
    points = read_table("track_points")
    metas = read_table("app_meta")
    audits = read_table("audit_log") if "audit_log" else pd.DataFrame()

    c1, c2, c3, c4 = st.columns(4)
    with c1: metric_card("Letiště / plochy", str(len(airports)), "databázová tabulka")
    with c2: metric_card("Letadla", str(len(aircraft)), "registrace")
    with c3: metric_card("Tracky", str(len(tracks)), "KML soubory")
    with c4: metric_card("GPS body", f"{len(points):,}".replace(",", " "), "normalizováno")

    tab_airports, tab_aircraft, tab_import, tab_backup, tab_meta = st.tabs(["Letiště", "Letadla", "Import", "Záloha", "Meta"])
    with tab_airports:
        col1, col2, col3 = st.columns([1,1,2])
        with col1:
            country = st.selectbox("Země", ["Vše"] + sorted([x for x in airports.get("iso_country", pd.Series(dtype=str)).dropna().unique() if x]), index=0)
        with col2:
            source = st.selectbox("Zdroj", ["Vše"] + sorted([x for x in airports.get("source", pd.Series(dtype=str)).dropna().unique() if x]), index=0)
        with col3:
            q = st.text_input("Hledat", value="")
        view = airports.copy()
        if country != "Vše":
            view = view[view["iso_country"].eq(country)]
        if source != "Vše":
            view = view[view["source"].eq(source)]
        if q.strip():
            ql = q.strip().lower()
            mask = (
                view["ident"].fillna("").str.lower().str.contains(ql)
                | view["name"].fillna("").str.lower().str.contains(ql)
                | view["municipality"].fillna("").str.lower().str.contains(ql)
            )
            view = view[mask]
        cols = ["ident","name","airport_type","iso_country","municipality","latitude_deg","longitude_deg","source","data_quality","active","closed"]
        st.dataframe(view[[c for c in cols if c in view.columns]].head(1000), hide_index=True, use_container_width=True, height=430)
        st.download_button("Export letišť CSV", data=airports.to_csv(index=False).encode("utf-8"), file_name="airports_export.csv", mime="text/csv", use_container_width=True)
        st.markdown("### Přidat / upravit letiště")
        if not is_admin():
            st.info("Ruční editace letišť je dostupná jen pro admina.")
        else:
            with st.form("airport_upsert_form"):
                a1, a2, a3 = st.columns(3)
                with a1:
                    ident = st.text_input("Ident", value="").upper()
                    name = st.text_input("Název", value="")
                    airport_type = st.selectbox("Typ", ["ultralight_field", "small_airport", "medium_airport", "large_airport", "heliport", "closed", "manual_field"], index=0)
                with a2:
                    iso_country = st.text_input("Země", value="CZ").upper()
                    iso_region = st.text_input("Region", value="")
                    municipality = st.text_input("Obec", value="")
                with a3:
                    latitude_deg = st.number_input("Latitude", value=50.0, format="%.6f")
                    longitude_deg = st.number_input("Longitude", value=14.0, format="%.6f")
                    elevation_ft = st.number_input("Elevation ft", value=0.0, format="%.0f")
                active = st.checkbox("Aktivní", value=True)
                closed = st.checkbox("Uzavřené", value=False)
                submitted = st.form_submit_button("Uložit letiště / plochu", type="primary")
            if submitted:
                try:
                    upsert_airport_form({"ident": ident, "name": name, "airport_type": airport_type, "iso_country": iso_country, "iso_region": iso_region, "municipality": municipality, "latitude_deg": latitude_deg, "longitude_deg": longitude_deg, "elevation_ft": elevation_ft, "source": "manual", "active": active, "closed": closed, "data_quality": "manual"})
                    st.success("Letiště uloženo."); st.rerun()
                except Exception as exc:
                    st.error(str(exc))

    with tab_aircraft:
        if aircraft.empty:
            aircraft = pd.DataFrame(columns=["id","registration","aircraft_type","icao_type","aircraft_class","evidence","default_price_per_hour","active","note"])
        display = aircraft.rename(columns={"id":"ID","registration":"Imatrikulace","aircraft_type":"Typ","icao_type":"ICAO typ","aircraft_class":"Třída","evidence":"Evidence","default_price_per_hour":"Výchozí Kč/h","active":"Aktivní","note":"Poznámka"})
        cols = ["ID","Imatrikulace","Typ","ICAO typ","Třída","Evidence","Výchozí Kč/h","Aktivní","Poznámka"]
        display = display[[c for c in cols if c in display.columns]]
        edited = st.data_editor(display.sort_values("Imatrikulace") if not display.empty else display, hide_index=True, use_container_width=True, num_rows="dynamic", disabled=["ID"] if is_admin() else display.columns.tolist(), height=560, column_config={"Výchozí Kč/h": st.column_config.NumberColumn(format="%.0f Kč"), "Aktivní": st.column_config.CheckboxColumn()})
        if st.button("Uložit letadla", type="primary", disabled=not is_admin()):
            if require_admin():
                save_aircraft_editor(edited)
                st.success("Letadla uložena."); st.rerun()

    with tab_import:
        st.markdown("### Aktualizace letišť")
        c1, c2 = st.columns(2)
        with c1:
            if st.button("Stáhnout / aktualizovat OurAirports", type="primary", use_container_width=True, disabled=not is_admin()):
                if require_admin():
                    with st.spinner("Stahuji a importuji OurAirports…"):
                        try:
                            count = import_ourairports_to_database()
                            st.success(f"Import hotový: {count:,} řádků.".replace(",", " "))
                            st.rerun()
                        except Exception as exc:
                            st.error(f"Import se nepodařil: {exc}")
        with c2:
            custom = st.file_uploader("Import vlastní CSV letišť / UL ploch", type=["csv"], key="airport_csv_upload")
            if custom is not None and st.button("Nahrát CSV do databáze", use_container_width=True, disabled=not is_admin()):
                if require_admin():
                    try:
                        count = import_airport_csv_upload(custom)
                        st.success(f"Importováno: {count:,} řádků.".replace(",", " "))
                        st.rerun()
                    except Exception as exc:
                        st.error(f"Import CSV se nepodařil: {exc}")
        sample = pd.DataFrame([
            {"ident":"ULXXXX","name":"Název plochy","airport_type":"ultralight_field","iso_country":"CZ","municipality":"Obec","latitude_deg":50.0,"longitude_deg":14.0,"source":"manual_ul","active":1,"closed":0}
        ])
        st.dataframe(sample, hide_index=True, use_container_width=True)

    with tab_backup:
        st.markdown("### SQLite + GitHub backup")
        dirty = ""
        last_change = ""
        last_backup = ""
        if not metas.empty:
            md = dict(zip(metas["key"], metas["value"]))
            dirty = md.get("dirty", "")
            last_change = md.get("last_change_at", "")
            last_backup = md.get("last_github_backup_at", "")
        b1, b2, b3 = st.columns(3)
        with b1: metric_card("Stav", "Nezálohováno" if dirty == "1" else "OK", "dirty flag")
        with b2: metric_card("Poslední změna", last_change[:19] if last_change else "—", "UTC")
        with b3: metric_card("GitHub backup", last_backup[:19] if last_backup else "—", "UTC")
        with open(DB_PATH, "rb") as f:
            st.download_button("Stáhnout SQLite databázi", f.read(), file_name="logbook.sqlite", use_container_width=True)
        if github_backup_configured():
            if st.button("Uložit aktuální databázi na GitHub", type="primary", disabled=not is_admin(), use_container_width=True):
                if require_admin():
                    try:
                        url = backup_database_to_github()
                        st.success("Databáze zazálohována na GitHub." + (f" Commit: {url}" if url else ""))
                    except Exception as exc:
                        st.error(f"Backup selhal: {exc}")
        else:
            st.info("GitHub backup není nakonfigurovaný ve Streamlit Secrets. Stále můžeš ručně stahovat SQLite soubor.")
        restore = st.file_uploader("Obnovit SQLite databázi ze souboru", type=["sqlite", "db"], key="restore_db_upload")
        confirm = st.text_input("Pro obnovení napiš OBNOVIT", value="")
        if restore is not None and st.button("Obnovit databázi", disabled=not is_admin() or confirm != "OBNOVIT", use_container_width=True):
            if require_admin():
                try:
                    restore_database_from_upload(restore)
                    st.success("Databáze obnovena."); st.rerun()
                except Exception as exc:
                    st.error(f"Obnova selhala: {exc}")

    with tab_meta:
        st.markdown("### Metadata")
        if metas.empty:
            st.info("Žádná metadata.")
        else:
            st.dataframe(metas.sort_values("key"), hide_index=True, use_container_width=True)
        st.markdown("### Audit log")
        if audits.empty:
            st.info("Žádný audit log.")
        else:
            st.dataframe(audits.sort_values("id", ascending=False).head(500), hide_index=True, use_container_width=True, height=360)


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
    st.set_page_config(page_title="Letový zápisník", layout="wide", initial_sidebar_state="expanded")
    with connect(): pass
    if "page" not in st.session_state:
        st.session_state["page"] = "Dashboard"
    with st.sidebar:
        st.markdown("## Letový zápisník")
        st.markdown(f'<div class="sidebar-version">{APP_VERSION}</div>', unsafe_allow_html=True)
        dark_mode = st.toggle("Tmavý režim", value=True)
        render_sidebar_nav()
        render_auth_sidebar()
    apply_ui_theme(dark_mode)
    app_header()
    page = st.session_state.get("page", "Dashboard")
    flights = read_flights()
    rates = read_table("rates")
    if not rates.empty:
        rates["registration"] = rates["registration"].fillna("").str.upper()
    if page == "Dashboard": page_dashboard(flights)
    elif page == "Lety": page_logbook(flights, rates, dark_mode)
    elif page == "Nový let": page_new_flight(rates, dark_mode)
    elif page == "Mapa": page_maps(flights, dark_mode)
    elif page == "Ceník": page_rates(rates)
    elif page == "Databáze": page_database()
    elif page == "Kontrola": page_control(flights)
    elif page == "Export": page_export(flights)

if __name__ == "__main__":
    main()
