from __future__ import annotations

import base64
import json
import math
import re
import sqlite3
import xml.etree.ElementTree as ET
from datetime import date, datetime, time, timezone, timedelta
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
import streamlit.components.v1 as components
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
AIRPORTS_CSV_PATH = DATA_DIR / "airports.csv"
AIRPORTS_DB_PATH = DATA_DIR / "airports_full.sqlite"
OURAIRPORTS_AIRPORTS_URL = "https://davidmegginson.github.io/ourairports-data/airports.csv"
APP_VERSION = "v0.31.2"
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


def invalidate_cached_data() -> None:
    """Clear cached database reads after any write operation."""
    try:
        st.cache_data.clear()
    except Exception:
        pass


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
    payload = json.dumps(detail, ensure_ascii=False, default=str) if detail is not None else None
    params = (_now_iso(), actor_name(), action, object_type, str(object_id) if object_id is not None else None, payload)
    try:
        con.execute(
            "INSERT INTO audit_log (created_at, actor, action, object_type, object_id, detail_json) VALUES (?, ?, ?, ?, ?, ?)",
            params,
        )
    except sqlite3.OperationalError:
        try:
            ensure_schema_compatibility(con)
            con.execute(
                "INSERT INTO audit_log (created_at, actor, action, object_type, object_id, detail_json) VALUES (?, ?, ?, ?, ?, ?)",
                params,
            )
        except Exception:
            # Audit logging must never block the real database action.
            pass
    except Exception:
        pass
    try:
        _set_meta(con, "last_change_at", _now_iso())
        _set_meta(con, "dirty", "1")
        invalidate_cached_data()
    except Exception:
        pass


def github_backup_configured() -> bool:
    return bool(_get_secret("github", "token", "") or _get_secret("github_sync", "token", ""))


def github_backup_config() -> dict[str, str]:
    token = _get_secret("github", "token", "") or _get_secret("github_sync", "token", "")
    repo = _get_secret("github", "repo", "") or _get_secret("github_sync", "repo", "filipto861/Logbook")
    db_path = _get_secret("github", "db_path", "") or _get_secret("github_sync", "db_path", "data/logbook.sqlite")
    branch = _get_secret("github", "branch", "") or _get_secret("github_sync", "branch", "main")
    auto_backup = _get_secret("github", "auto_backup", "") or _get_secret("github_sync", "auto_backup", "true")
    return {"token": token, "repo": repo, "db_path": db_path, "branch": branch, "auto_backup": str(auto_backup)}


def github_auto_backup_enabled() -> bool:
    cfg = github_backup_config()
    return github_backup_configured() and str(cfg.get("auto_backup", "true")).strip().lower() not in {"0", "false", "no", "off"}


def _record_audit_clean(con: sqlite3.Connection, action: str, object_type: str | None = None, object_id: Any = None, detail: Any = None) -> None:
    """Audit entry that does not mark the database dirty. Used by backup itself."""
    payload = json.dumps(detail, ensure_ascii=False, default=str) if detail is not None else None
    params = (_now_iso(), actor_name(), action, object_type, str(object_id) if object_id is not None else None, payload)
    try:
        con.execute(
            "INSERT INTO audit_log (created_at, actor, action, object_type, object_id, detail_json) VALUES (?, ?, ?, ?, ?, ?)",
            params,
        )
    except sqlite3.OperationalError:
        try:
            ensure_schema_compatibility(con)
            con.execute(
                "INSERT INTO audit_log (created_at, actor, action, object_type, object_id, detail_json) VALUES (?, ?, ?, ?, ?, ?)",
                params,
            )
        except Exception:
            pass


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
    if not DB_PATH.exists():
        raise RuntimeError("Databázový soubor neexistuje.")

    api_url = f"https://api.github.com/repos/{cfg['repo']}/contents/{cfg['db_path']}"
    headers = {"Authorization": f"Bearer {cfg['token']}", "Accept": "application/vnd.github+json"}
    branch = cfg.get("branch") or "main"
    backup_at = _now_iso()

    # Make the database file itself contain the fact that it is backed up. If the
    # remote upload fails, the dirty flag is restored below.
    with connect() as con:
        _set_meta(con, "last_github_backup_at", backup_at)
        _set_meta(con, "last_github_backup_error", "")
        _set_meta(con, "dirty", "0")
        _record_audit_clean(con, "github_backup", "database", cfg["db_path"], {"repo": cfg["repo"], "branch": branch})
        con.commit()

    try:
        checkpoint_database()
        sha = None
        get_resp = requests.get(api_url, headers=headers, params={"ref": branch}, timeout=30)
        if get_resp.status_code == 200:
            sha = get_resp.json().get("sha")
        elif get_resp.status_code not in (404,):
            raise RuntimeError(f"GitHub GET selhal: {get_resp.status_code} {get_resp.text[:300]}")
        content_b64 = base64.b64encode(DB_PATH.read_bytes()).decode("ascii")
        payload = {
            "message": commit_message or f"Backup logbook database {datetime.now(LOCAL_TZ).strftime('%Y-%m-%d %H:%M')}",
            "content": content_b64,
            "branch": branch,
        }
        if sha:
            payload["sha"] = sha
        put_resp = requests.put(api_url, headers=headers, json=payload, timeout=90)
        if put_resp.status_code not in (200, 201):
            raise RuntimeError(f"GitHub PUT selhal: {put_resp.status_code} {put_resp.text[:500]}")
        return put_resp.json().get("commit", {}).get("html_url", "")
    except Exception as exc:
        with connect() as con:
            _set_meta(con, "dirty", "1")
            _set_meta(con, "last_github_backup_error", str(exc)[:500])
            con.commit()
        raise


def auto_backup_after_change(reason: str) -> None:
    """Automatically persist the current SQLite database to GitHub after a confirmed write.

    Streamlit Community Cloud does not preserve local SQLite changes across every
    restart/redeploy. This makes GitHub the versioned persistent backup for the
    single-user online deployment.
    """
    if not github_auto_backup_enabled():
        st.session_state["last_auto_backup_status"] = "not_configured"
        return
    try:
        with st.spinner("Ukládám databázi na GitHub…"):
            url = backup_database_to_github(
                f"Auto backup after {reason} {datetime.now(LOCAL_TZ).strftime('%Y-%m-%d %H:%M')}"
            )
        st.session_state["last_auto_backup_status"] = "ok"
        st.session_state["last_auto_backup_url"] = url
        st.session_state.pop("last_auto_backup_error", None)
    except Exception as exc:
        st.session_state["last_auto_backup_status"] = "error"
        st.session_state["last_auto_backup_error"] = str(exc)



def restore_database_from_upload(uploaded_file) -> None:
    raw = uploaded_file.read()
    if not raw.startswith(b"SQLite format 3"):
        raise RuntimeError("Nahraný soubor nevypadá jako SQLite databáze.")
    backup_path = DB_PATH.with_suffix(".sqlite.before_restore")
    if DB_PATH.exists():
        checkpoint_database()
        backup_path.write_bytes(DB_PATH.read_bytes())
    DB_PATH.write_bytes(raw)
    with connect() as con:
        initialize_database(con)
        record_audit(con, "restore_database", "database", uploaded_file.name, {"backup_created": str(backup_path)})
        con.commit()
    invalidate_cached_data()
    auto_backup_after_change("database restore")


def show_backup_status() -> None:
    status = st.session_state.get("last_auto_backup_status")
    if status == "ok":
        st.success("Databáze byla automaticky uložena na GitHub.")
    elif status == "not_configured":
        st.info("Změna je uložena v běžící aplikaci. Pro trvalé uložení po restartu nastav GitHub token v secrets nebo stáhni zálohu databáze.")
    elif status == "error":
        st.warning(f"Změna je uložená lokálně, ale automatická GitHub záloha selhala: {st.session_state.get('last_auto_backup_error')}")


def ensure_schema_compatibility(con: sqlite3.Connection) -> None:
    def cols(table: str) -> set[str]:
        return {row[1] for row in con.execute(f"PRAGMA table_info({table})").fetchall()}
    fcols = cols("flights")
    for name, ddl in [("price_per_hour", "price_per_hour REAL"), ("note", "note TEXT"), ("takeoff", "takeoff TEXT"), ("landing", "landing TEXT")]:
        if name not in fcols:
            con.execute(f"ALTER TABLE flights ADD COLUMN {ddl}")
    acols = cols("aircraft")
    for name, ddl in [("icao_type", "icao_type TEXT"), ("created_at", "created_at TEXT"), ("updated_at", "updated_at TEXT")]:
        if name not in acols:
            con.execute(f"ALTER TABLE aircraft ADD COLUMN {ddl}")
    track_cols = cols("flight_tracks")
    for name, ddl in [("start_utc", "start_utc TEXT"), ("end_utc", "end_utc TEXT"), ("min_alt_m", "min_alt_m REAL"), ("max_alt_m", "max_alt_m REAL")]:
        if name not in track_cols:
            con.execute(f"ALTER TABLE flight_tracks ADD COLUMN {ddl}")
    point_cols = cols("track_points")
    for name, ddl in [("time_utc", "time_utc TEXT"), ("altitude_m", "altitude_m REAL"), ("segment_km", "segment_km REAL"), ("distance_km", "distance_km REAL"), ("speed_kmh", "speed_kmh REAL"), ("speed_kt", "speed_kt REAL"), ("source", "source TEXT")]:
        if name not in point_cols:
            con.execute(f"ALTER TABLE track_points ADD COLUMN {ddl}")
    audit_cols = cols("audit_log")
    for name, ddl in [("actor", "actor TEXT"), ("action", "action TEXT"), ("object_type", "object_type TEXT"), ("object_id", "object_id TEXT"), ("detail_json", "detail_json TEXT")]:
        if name not in audit_cols:
            con.execute(f"ALTER TABLE audit_log ADD COLUMN {ddl}")


def connect() -> sqlite3.Connection:
    DATA_DIR.mkdir(exist_ok=True)
    con = sqlite3.connect(DB_PATH)
    con.row_factory = sqlite3.Row
    con.execute("PRAGMA foreign_keys = ON")
    con.execute("PRAGMA busy_timeout = 5000")
    return con


def initialize_database(con: sqlite3.Connection) -> None:
    global _DB_READY
    if _DB_READY:
        return
    con.execute("PRAGMA foreign_keys = ON")
    con.execute("PRAGMA busy_timeout = 5000")
    try:
        con.execute("PRAGMA journal_mode = WAL")
    except sqlite3.DatabaseError:
        pass
    con.executescript(SCHEMA)
    ensure_schema_compatibility(con)
    _set_meta(con, "schema_version", DB_SCHEMA_VERSION)
    _seed_airports_from_overrides(con)
    _seed_aircraft_from_existing_data(con)
    _backfill_track_points(con)
    con.commit()
    _DB_READY = True


# -----------------------------------------------------------------------------
# Helpers
# -----------------------------------------------------------------------------

def normalize_text(value: Any) -> str:
    return "" if value is None else str(value).strip()


def parse_hhmm(value: Any) -> time | None:
    text = normalize_text(value)
    if not text or text.lower() == "nan":
        return None
    if isinstance(value, time):
        return value
    text = text.replace(".", ":")
    for fmt in ("%H:%M:%S", "%H:%M"):
        try:
            return datetime.strptime(text, fmt).time()
        except ValueError:
            pass
    return None


def time_to_minutes(value: Any) -> int | None:
    t = parse_hhmm(value)
    if not t:
        return None
    return t.hour * 60 + t.minute


def minutes_between(start: Any, end: Any) -> int:
    s = time_to_minutes(start)
    e = time_to_minutes(end)
    if s is None or e is None:
        return 0
    diff = e - s
    if diff < 0:
        diff += 24 * 60
    return max(0, diff)


def minutes_to_hhmm(minutes: int | float | None) -> str:
    if minutes is None or pd.isna(minutes):
        minutes = 0
    minutes = int(round(float(minutes)))
    return f"{minutes // 60}:{minutes % 60:02d}"


def parse_duration_to_minutes(value: Any) -> int:
    if value is None or pd.isna(value):
        return 0
    if isinstance(value, (int, float)):
        return int(round(float(value) * 60)) if 0 < float(value) < 24 else int(round(float(value)))
    text = str(value).strip()
    if not text:
        return 0
    if ":" in text:
        parts = text.split(":")
        try:
            return int(parts[0]) * 60 + int(parts[1])
        except Exception:
            return 0
    try:
        val = float(text.replace(",", "."))
        return int(round(val * 60)) if 0 < val < 24 else int(round(val))
    except Exception:
        return 0


def combine_local_datetime(d: date | str | None, t: time | None) -> datetime | None:
    if not d or not t:
        return None
    if isinstance(d, str):
        try:
            d = datetime.strptime(d[:10], "%Y-%m-%d").date()
        except Exception:
            return None
    return datetime.combine(d, t, tzinfo=LOCAL_TZ)


def iso_to_local_time(iso_value: str | None) -> str:
    if not iso_value:
        return ""
    try:
        dt = datetime.fromisoformat(str(iso_value).replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(LOCAL_TZ).strftime("%H:%M")
    except Exception:
        return ""


def float_or_none(value: Any) -> float | None:
    try:
        if value is None:
            return None
        if isinstance(value, str) and not value.strip():
            return None
        return float(value)
    except Exception:
        return None


def haversine_km(a: dict[str, Any], b: dict[str, Any]) -> float:
    lat1 = math.radians(float(a["lat"])); lon1 = math.radians(float(a["lon"]))
    lat2 = math.radians(float(b["lat"])); lon2 = math.radians(float(b["lon"]))
    dlat = lat2 - lat1; dlon = lon2 - lon1
    h = math.sin(dlat/2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon/2)**2
    return 6371.0 * 2 * math.atan2(math.sqrt(h), math.sqrt(1-h))


def compute_track_metrics(points: list[dict[str, Any]]) -> dict[str, Any]:
    if len(points) < 2:
        return {"distance_km": 0.0, "start_utc": None, "end_utc": None, "min_alt_m": None, "max_alt_m": None}
    dist = 0.0
    for i in range(1, len(points)):
        dist += haversine_km(points[i-1], points[i])
    times = [p.get("time_utc") for p in points if p.get("time_utc")]
    alts = [float(p["alt_m"]) for p in points if p.get("alt_m") is not None]
    return {
        "distance_km": dist,
        "start_utc": min(times) if times else None,
        "end_utc": max(times) if times else None,
        "min_alt_m": min(alts) if alts else None,
        "max_alt_m": max(alts) if alts else None,
    }


def enrich_points(points: list[dict[str, Any]], source: str = "kml") -> list[dict[str, Any]]:
    if not points:
        return []
    def parse_dt(v):
        if not v:
            return None
        try:
            dt = datetime.fromisoformat(str(v).replace("Z", "+00:00"))
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            return dt.astimezone(timezone.utc)
        except Exception:
            return None
    indexed = list(enumerate(points))
    indexed.sort(key=lambda pair: (parse_dt(pair[1].get("time_utc")) or datetime.min.replace(tzinfo=timezone.utc), pair[0])) if any(p.get("time_utc") for p in points) else indexed
    enriched = []
    total = 0.0
    prev = None
    for _, p in indexed:
        q = dict(p)
        q.setdefault("source", source)
        if prev is None:
            q["segment_km"] = 0.0
            q["distance_km"] = 0.0
            q["speed_kmh"] = q.get("speed_kmh")
            q["speed_kt"] = q.get("speed_kt")
        else:
            seg = haversine_km(prev, q)
            total += seg
            q["segment_km"] = seg
            q["distance_km"] = total
            if q.get("speed_kmh") is None:
                t1 = parse_dt(prev.get("time_utc")); t2 = parse_dt(q.get("time_utc"))
                if t1 and t2:
                    hours = (t2 - t1).total_seconds() / 3600
                    if hours > 0:
                        q["speed_kmh"] = seg / hours
                        q["speed_kt"] = q["speed_kmh"] / 1.852
        enriched.append(q)
        prev = q
    return enriched


def downsample_points(points: list[dict[str, Any]], max_points: int = 650) -> list[dict[str, Any]]:
    if len(points) <= max_points:
        return points
    step = max(1, math.ceil(len(points) / max_points))
    sampled = points[::step]
    if sampled[-1] != points[-1]:
        sampled.append(points[-1])
    return sampled


def profile_from_points(points: list[dict[str, Any]]) -> pd.DataFrame:
    rows = []
    for p in points:
        rows.append({
            "time_utc": p.get("time_utc"),
            "distance_km": p.get("distance_km"),
            "alt_m": p.get("alt_m"),
            "speed_kmh": p.get("speed_kmh"),
            "speed_kt": p.get("speed_kt"),
        })
    df = pd.DataFrame(rows)
    if df.empty:
        return df
    if "time_utc" in df:
        df["time_local"] = pd.to_datetime(df["time_utc"], errors="coerce", utc=True).dt.tz_convert(str(LOCAL_TZ))
    return df


def parse_kml_points(raw: bytes) -> tuple[list[dict[str, Any]], str]:
    """Parse KML exports from ADSBExchange and Flightradar24.

    FR24 KML often contains both the real time-stamped Point placemarks and a set
    of visual LineString segments named P-1, P-2...  Mixing those together creates
    a false line from the end of the flight back to the first visual segment.  If
    time-stamped points exist, they are the source of truth and LineStrings are
    deliberately ignored.
    """
    root = ET.fromstring(raw)
    ns = {"kml": "http://www.opengis.net/kml/2.2", "gx": "http://www.google.com/kml/ext/2.2"}

    def text_of(elem, path: str) -> str | None:
        child = elem.find(path, ns)
        if child is not None and child.text:
            return child.text.strip()
        return None

    def parse_coord_text(coord_text: str | None) -> list[tuple[float, float, float | None]]:
        coords: list[tuple[float, float, float | None]] = []
        if not coord_text:
            return coords
        for chunk in coord_text.replace("\n", " ").split():
            parts = chunk.split(",")
            if len(parts) >= 2:
                try:
                    lon = float(parts[0])
                    lat = float(parts[1])
                    alt = float(parts[2]) if len(parts) >= 3 and parts[2] not in ("", None) else None
                    coords.append((lat, lon, alt))
                except Exception:
                    continue
        return coords

    def parse_speed_from_description(text: str | None) -> tuple[float | None, float | None]:
        if not text:
            return None, None
        clean = re.sub(r"<[^>]+>", " ", text)
        m = re.search(r"(?:speed|gs|groundspeed)\s*[:=]?\s*([0-9]+(?:\.[0-9]+)?)\s*(kt|kts|knots|km/h|kph)", clean, flags=re.I)
        if not m:
            return None, None
        val = float(m.group(1))
        unit = m.group(2).lower()
        if unit in {"kt", "kts", "knots"}:
            return val * 1.852, val
        return val, val / 1.852

    timed_points: list[dict[str, Any]] = []
    untimed_points: list[dict[str, Any]] = []
    linestring_points: list[dict[str, Any]] = []

    for pm in root.findall(".//kml:Placemark", ns):
        name = text_of(pm, "kml:name") or ""
        description = text_of(pm, "kml:description")
        when = text_of(pm, "kml:TimeStamp/kml:when") or text_of(pm, "kml:TimeSpan/kml:begin")
        speed_kmh, speed_kt = parse_speed_from_description(description)

        point_coords = parse_coord_text(text_of(pm, "kml:Point/kml:coordinates"))
        for lat, lon, alt in point_coords:
            point = {"lat": lat, "lon": lon, "alt_m": alt, "time_utc": when, "speed_kmh": speed_kmh, "speed_kt": speed_kt, "source": "kml_point"}
            if when:
                timed_points.append(point)
            else:
                untimed_points.append(point)

        # FR24 visual segments are commonly named P-1, P-2... and must not be
        # merged with real point placemarks when time-stamped points are present.
        is_fr24_visual_segment = bool(re.fullmatch(r"P-?\d+", name.strip(), flags=re.I))
        for coord_node in pm.findall(".//kml:LineString/kml:coordinates", ns):
            for lat, lon, alt in parse_coord_text(coord_node.text):
                linestring_points.append({
                    "lat": lat,
                    "lon": lon,
                    "alt_m": alt,
                    "time_utc": None,
                    "speed_kmh": None,
                    "speed_kt": None,
                    "source": "fr24_segment" if is_fr24_visual_segment else "kml_linestring",
                })

    # gx:Track files usually contain paired when/coord arrays.
    gx_points: list[dict[str, Any]] = []
    for trk in root.findall(".//gx:Track", ns):
        whens = [w.text.strip() for w in trk.findall("kml:when", ns) if w.text]
        coords = []
        for c in trk.findall("gx:coord", ns):
            if c.text:
                parts = c.text.split()
                if len(parts) >= 2:
                    try:
                        lon = float(parts[0]); lat = float(parts[1]); alt = float(parts[2]) if len(parts) >= 3 else None
                        coords.append((lat, lon, alt))
                    except Exception:
                        pass
        for i, (lat, lon, alt) in enumerate(coords):
            gx_points.append({"lat": lat, "lon": lon, "alt_m": alt, "time_utc": whens[i] if i < len(whens) else None, "speed_kmh": None, "speed_kt": None, "source": "gx_track"})

    if gx_points:
        source = "gx_track"
        return enrich_points(gx_points, source), source
    if timed_points:
        source = "fr24_points" if any(p.get("source") == "fr24_segment" for p in linestring_points) else "kml_points"
        return enrich_points(timed_points, source), source
    if linestring_points:
        return enrich_points(linestring_points, "kml_linestring"), "kml_linestring"
    if untimed_points:
        return enrich_points(untimed_points, "kml_points"), "kml_points"
    return [], "unknown"


# -----------------------------------------------------------------------------
# Data seeding
# -----------------------------------------------------------------------------

AIRPORT_OVERRIDES_CSV = """ident,name,airport_type,iso_country,municipality,latitude_deg,longitude_deg,elevation_ft,gps_code,local_code,source,active,closed,data_quality
LKSZ,Sazená,small_airport,CZ,Sazená,50.324699,14.258900,761,LKSZ,LKSZ,manual,1,0,verified
LKLT,Letňany,small_airport,CZ,Praha,50.131401,14.525600,912,LKLT,LKLT,manual,1,0,verified
LKPR,Václav Havel Airport Prague,large_airport,CZ,Praha,50.100800,14.260000,1247,LKPR,LKPR,manual,1,0,verified
LKVO,Vodochody,medium_airport,CZ,Vodochody,50.216599,14.395800,919,LKVO,LKVO,manual,1,0,verified
LKRO,Roudnice,small_airport,CZ,Roudnice nad Labem,50.410599,14.226100,725,LKRO,LKRO,manual,1,0,verified
LKBE,Benešov,small_airport,CZ,Benešov,49.740799,14.644700,1322,LKBE,LKBE,manual,1,0,verified
LKMB,Mladá Boleslav,small_airport,CZ,Mladá Boleslav,50.398300,14.898100,760,LKMB,LKMB,manual,1,0,verified
LKHK,Hradec Králové,medium_airport,CZ,Hradec Králové,50.253201,15.845200,791,LKHK,LKHK,manual,1,0,verified
LKKV,Karlovy Vary,medium_airport,CZ,Karlovy Vary,50.202999,12.914700,1989,LKKV,LKKV,manual,1,0,verified
LKTB,Brno Tuřany,medium_airport,CZ,Brno,49.151299,16.694401,778,LKTB,LKTB,manual,1,0,verified
LKMT,Ostrava Mošnov,large_airport,CZ,Ostrava,49.696300,18.111099,844,LKMT,LKMT,manual,1,0,verified
LDPM,Medulin,small_airport,HR,Medulin,44.817299,13.922200,164,LDPM,LDPM,manual,1,0,verified
VFR,VFR / místní let,other,CZ,,49.8,15.5,,VFR,VFR,manual,1,0,virtual
"""


def _seed_airports_from_overrides(con: sqlite3.Connection) -> None:
    import csv
    from io import StringIO
    rows = []
    if AIRPORT_OVERRIDES_PATH.exists():
        content = AIRPORT_OVERRIDES_PATH.read_text(encoding="utf-8")
    else:
        content = AIRPORT_OVERRIDES_CSV
    reader = csv.DictReader(StringIO(content))
    for row in reader:
        rows.append(row)
    now = _now_iso()
    for r in rows:
        con.execute(
            """
            INSERT OR REPLACE INTO airports
            (ident, name, airport_type, iso_country, municipality, latitude_deg, longitude_deg, elevation_ft,
             gps_code, local_code, source, active, closed, data_quality, imported_at, updated_at, raw_json)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE((SELECT imported_at FROM airports WHERE ident=?), ?), ?, ?)
            """,
            (
                r.get("ident"), r.get("name"), r.get("airport_type"), r.get("iso_country"), r.get("municipality"),
                float_or_none(r.get("latitude_deg")), float_or_none(r.get("longitude_deg")), float_or_none(r.get("elevation_ft")),
                r.get("gps_code"), r.get("local_code"), r.get("source"), int(r.get("active") or 1), int(r.get("closed") or 0),
                r.get("data_quality"), r.get("ident"), now, now, json.dumps(r, ensure_ascii=False),
            ),
        )


def _seed_aircraft_from_existing_data(con: sqlite3.Connection) -> None:
    rows = con.execute(
        "SELECT registration, aircraft_type, aircraft_class, evidence, price_per_hour FROM flights WHERE COALESCE(registration,'') <> ''"
    ).fetchall()
    now = _now_iso()
    for r in rows:
        con.execute(
            """
            INSERT OR IGNORE INTO aircraft
            (registration, aircraft_type, aircraft_class, evidence, default_price_per_hour, active, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, 1, ?, ?)
            """,
            (r["registration"], r["aircraft_type"], r["aircraft_class"], r["evidence"], r["price_per_hour"], now, now),
        )


def _backfill_track_points(con: sqlite3.Connection) -> None:
    tracks = con.execute("SELECT id, coordinates_json FROM flight_tracks").fetchall()
    for tr in tracks:
        count = con.execute("SELECT COUNT(*) FROM track_points WHERE track_id=?", (tr["id"],)).fetchone()[0]
        if count:
            continue
        try:
            points = enrich_points(json.loads(tr["coordinates_json"]), "legacy")
            insert_track_points(con, tr["id"], points)
        except Exception:
            pass


# -----------------------------------------------------------------------------
# Read data
# -----------------------------------------------------------------------------

def add_computed_columns(df: pd.DataFrame) -> pd.DataFrame:
    if df.empty:
        return df
    df = df.copy()
    df["block_minutes"] = [minutes_between(a, b) for a, b in zip(df["off_block"], df["on_block"])]
    df["air_minutes"] = [minutes_between(a, b) for a, b in zip(df.get("takeoff", ""), df.get("landing", ""))]
    df["block_time"] = df["block_minutes"].map(minutes_to_hhmm)
    df["air_time"] = df["air_minutes"].map(minutes_to_hhmm)
    df["starts"] = pd.to_numeric(df.get("starts", 1), errors="coerce").fillna(1).astype(int)
    df["price_per_hour"] = pd.to_numeric(df.get("price_per_hour", 0), errors="coerce").fillna(0)
    df["cost"] = df["block_minutes"] / 60 * df["price_per_hour"]
    role = df["role"].fillna("").str.upper()
    df["pic_minutes"] = df["block_minutes"].where(role.eq("PIC"), 0)
    df["dual_minutes"] = df["block_minutes"].where(role.eq("DUAL"), 0)
    df["safety_minutes"] = df["block_minutes"].where(role.eq("SAFETY PILOT"), 0)
    return df


@st.cache_data(show_spinner=False)
def load_flights() -> pd.DataFrame:
    with connect() as con:
        initialize_database(con)
        df = pd.read_sql_query("SELECT * FROM flights ORDER BY date, off_block, id", con)
    return add_computed_columns(df)


@st.cache_data(show_spinner=False)
def load_aircraft() -> pd.DataFrame:
    with connect() as con:
        initialize_database(con)
        return pd.read_sql_query("SELECT * FROM aircraft ORDER BY active DESC, registration", con)


@st.cache_data(show_spinner=False)
def load_rates() -> pd.DataFrame:
    with connect() as con:
        initialize_database(con)
        return pd.read_sql_query("SELECT * FROM rates ORDER BY registration, valid_from", con)


@st.cache_data(show_spinner=False)
def load_airports(limit: int | None = None) -> pd.DataFrame:
    query = "SELECT * FROM airports ORDER BY ident"
    params: tuple[Any, ...] = ()
    if limit:
        query += " LIMIT ?"
        params = (limit,)
    with connect() as con:
        initialize_database(con)
        manual = pd.read_sql_query(query, con, params=params)

    if AIRPORTS_DB_PATH.exists():
        try:
            with sqlite3.connect(AIRPORTS_DB_PATH) as acon:
                acon.row_factory = sqlite3.Row
                full_query = "SELECT * FROM airports ORDER BY ident"
                full_params: tuple[Any, ...] = ()
                if limit:
                    full_query += " LIMIT ?"
                    full_params = (limit,)
                full = pd.read_sql_query(full_query, acon, params=full_params)
            if not manual.empty:
                # Manual rows from logbook.sqlite have priority over fixed world DB.
                full = full[~full["ident"].astype(str).str.upper().isin(manual["ident"].astype(str).str.upper())]
                return pd.concat([manual, full], ignore_index=True).sort_values("ident")
            return full
        except Exception:
            pass
    return manual


@st.cache_data(show_spinner=False)
def airport_coord_lookup() -> dict[str, dict[str, Any]]:
    df = load_airports()
    out: dict[str, dict[str, Any]] = {}
    for _, row in df.iterrows():
        lat = float_or_none(row.get("latitude_deg"))
        lon = float_or_none(row.get("longitude_deg"))
        if lat is None or lon is None:
            continue
        keys = {normalize_text(row.get("ident")), normalize_text(row.get("gps_code")), normalize_text(row.get("iata_code")), normalize_text(row.get("local_code"))}
        for key in keys:
            if key:
                out[key.upper()] = {"lat": lat, "lon": lon, "ident": normalize_text(row.get("ident")), "name": row.get("name")}
    return out


def read_track_points(track_id: int) -> list[dict[str, Any]]:
    with connect() as con:
        initialize_database(con)
        rows = con.execute("SELECT * FROM track_points WHERE track_id=? ORDER BY seq", (track_id,)).fetchall()
    points = []
    for r in rows:
        points.append({
            "lat": r["latitude_deg"],
            "lon": r["longitude_deg"],
            "alt_m": r["altitude_m"],
            "time_utc": r["time_utc"],
            "segment_km": r["segment_km"],
            "distance_km": r["distance_km"],
            "speed_kmh": r["speed_kmh"],
            "speed_kt": r["speed_kt"],
            "source": r["source"],
        })
    return points


@st.cache_data(show_spinner=False)
def read_tracks_joined() -> pd.DataFrame:
    with connect() as con:
        initialize_database(con)
        return pd.read_sql_query(
            """
            SELECT ft.*, f.date, f.registration, f.departure, f.arrival, f.role, f.evidence
            FROM flight_tracks ft
            JOIN flights f ON f.id = ft.flight_id
            ORDER BY f.date, ft.id
            """,
            con,
        )


@st.cache_data(show_spinner=False)
def read_audit_log(limit: int = 200) -> pd.DataFrame:
    with connect() as con:
        initialize_database(con)
        return pd.read_sql_query("SELECT * FROM audit_log ORDER BY id DESC LIMIT ?", con, params=(limit,))


# -----------------------------------------------------------------------------
# Writes
# -----------------------------------------------------------------------------

def insert_track_points(con: sqlite3.Connection, track_id: int, points: list[dict[str, Any]]) -> None:
    con.execute("DELETE FROM track_points WHERE track_id=?", (track_id,))
    for i, p in enumerate(points):
        con.execute(
            """
            INSERT INTO track_points
            (track_id, seq, time_utc, latitude_deg, longitude_deg, altitude_m, segment_km, distance_km, speed_kmh, speed_kt, source)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                track_id, i, p.get("time_utc"), p.get("lat"), p.get("lon"), p.get("alt_m"),
                p.get("segment_km"), p.get("distance_km"), p.get("speed_kmh"), p.get("speed_kt"), p.get("source"),
            ),
        )


def save_track_for_flight(flight_id: int, file_name: str, points: list[dict[str, Any]]) -> int:
    points = enrich_points(points, points[0].get("source", "kml") if points else "kml")
    metrics = compute_track_metrics(points)
    with connect() as con:
        initialize_database(con)
        con.execute(
            """
            INSERT INTO flight_tracks
            (flight_id, file_name, imported_at, point_count, distance_km, start_utc, end_utc, min_alt_m, max_alt_m, coordinates_json)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                flight_id, file_name, _now_iso(), len(points), metrics["distance_km"], metrics["start_utc"], metrics["end_utc"],
                metrics["min_alt_m"], metrics["max_alt_m"], json.dumps(points),
            ),
        )
        track_id = int(con.execute("SELECT last_insert_rowid()").fetchone()[0])
        insert_track_points(con, track_id, points)
        record_audit(con, "add_track", "flight", flight_id, {"file": file_name, "points": len(points), "distance_km": metrics["distance_km"]})
        con.commit()
    invalidate_cached_data()
    auto_backup_after_change("track import")
    return track_id


def create_flight(payload: dict[str, Any]) -> int:
    with connect() as con:
        initialize_database(con)
        con.execute(
            """
            INSERT INTO flights
            (date, evidence, registration, aircraft_type, aircraft_class, departure, arrival, off_block, takeoff, landing, on_block,
             starts, commander, instructor, role, task, price_per_hour, note)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                payload["date"], payload["evidence"], payload["registration"], payload["aircraft_type"], payload["aircraft_class"],
                payload["departure"], payload["arrival"], payload["off_block"], payload.get("takeoff"), payload.get("landing"), payload["on_block"],
                payload["starts"], payload["commander"], payload.get("instructor"), payload["role"], payload.get("task"),
                payload.get("price_per_hour"), payload.get("note"),
            ),
        )
        fid = int(con.execute("SELECT last_insert_rowid()").fetchone()[0])
        record_audit(con, "create_flight", "flight", fid, payload)
        con.commit()
    invalidate_cached_data()
    if payload.get("track_points"):
        save_track_for_flight(fid, payload.get("track_file_name") or "track.kml", payload["track_points"])
    else:
        auto_backup_after_change("flight create")
    return fid


def update_flight(flight_id: int, payload: dict[str, Any]) -> None:
    with connect() as con:
        initialize_database(con)
        con.execute(
            """
            UPDATE flights SET
                date=?, evidence=?, registration=?, aircraft_type=?, aircraft_class=?, departure=?, arrival=?, off_block=?, takeoff=?, landing=?, on_block=?,
                starts=?, commander=?, instructor=?, role=?, task=?, price_per_hour=?, note=?
            WHERE id=?
            """,
            (
                payload["date"], payload["evidence"], payload["registration"], payload["aircraft_type"], payload["aircraft_class"],
                payload["departure"], payload["arrival"], payload["off_block"], payload.get("takeoff"), payload.get("landing"), payload["on_block"],
                payload["starts"], payload["commander"], payload.get("instructor"), payload["role"], payload.get("task"), payload.get("price_per_hour"), payload.get("note"), flight_id,
            ),
        )
        record_audit(con, "update_flight", "flight", flight_id, payload)
        con.commit()
    invalidate_cached_data()
    auto_backup_after_change("flight update")


def delete_track(track_id: int, flight_id: int | None = None) -> None:
    with connect() as con:
        initialize_database(con)
        con.execute("DELETE FROM flight_tracks WHERE id=?", (track_id,))
        record_audit(con, "delete_track", "track", track_id, {"flight_id": flight_id})
        con.commit()
    invalidate_cached_data()
    auto_backup_after_change("track delete")


def delete_flight(flight_id: int) -> None:
    with connect() as con:
        initialize_database(con)
        row = con.execute("SELECT * FROM flights WHERE id=?", (flight_id,)).fetchone()
        if row is None:
            raise RuntimeError(f"Let ID {flight_id} neexistuje.")
        snapshot = dict(row)
        track_count = con.execute("SELECT COUNT(*) FROM flight_tracks WHERE flight_id=?", (flight_id,)).fetchone()[0]
        con.execute("DELETE FROM flights WHERE id=?", (flight_id,))
        record_audit(con, "delete_flight", "flight", flight_id, {"flight": snapshot, "deleted_tracks": track_count})
        con.commit()
    invalidate_cached_data()
    auto_backup_after_change("flight delete")


# -----------------------------------------------------------------------------
# Filters and metrics
# -----------------------------------------------------------------------------

def apply_filters(df: pd.DataFrame, key_prefix: str = "main") -> pd.DataFrame:
    if df.empty:
        return df
    with st.expander("Filtry", expanded=False):
        years = sorted(df["date"].astype(str).str[:4].dropna().unique().tolist())
        c1, c2, c3, c4 = st.columns(4)
        with c1:
            selected_years = st.multiselect("Rok", years, default=years, key=f"{key_prefix}_years")
        with c2:
            evidence = st.multiselect("Evidence", sorted(df["evidence"].dropna().unique()), default=sorted(df["evidence"].dropna().unique()), key=f"{key_prefix}_evidence")
        with c3:
            roles = st.multiselect("Funkce", sorted(df["role"].dropna().unique()), default=sorted(df["role"].dropna().unique()), key=f"{key_prefix}_roles")
        with c4:
            regs = st.multiselect("Letadlo", sorted(df["registration"].dropna().unique()), default=sorted(df["registration"].dropna().unique()), key=f"{key_prefix}_regs")
        text = st.text_input("Hledat", key=f"{key_prefix}_text")
    out = df.copy()
    if selected_years:
        out = out[out["date"].astype(str).str[:4].isin(selected_years)]
    if evidence:
        out = out[out["evidence"].isin(evidence)]
    if roles:
        out = out[out["role"].isin(roles)]
    if regs:
        out = out[out["registration"].isin(regs)]
    if text:
        t = text.lower()
        searchable = out[["registration", "aircraft_type", "departure", "arrival", "commander", "task", "note"]].fillna("").agg(" ".join, axis=1).str.lower()
        out = out[searchable.str.contains(t, regex=False)]
    return out


def metric_card(title: str, value: str, sub: str = "") -> None:
    st.markdown(
        f"""
        <div class=\"metric-card\">
          <div class=\"metric-title\">{title}</div>
          <div class=\"metric-value\">{value}</div>
          <div class=\"metric-sub\">{sub}</div>
        </div>
        """,
        unsafe_allow_html=True,
    )


def detail_link(flight_id: int) -> str:
    return f"?page=detail&flight_id={int(flight_id)}"


# -----------------------------------------------------------------------------
# Styling
# -----------------------------------------------------------------------------

def apply_ui_theme(dark_mode: bool = True) -> None:
    if not dark_mode:
        return
    st.markdown(
        """
        <style>
        :root {
            --bg: #07111f;
            --panel: #0d1b2e;
            --panel2: #10243d;
            --border: #294967;
            --text: #f8fbff;
            --muted: #8fb3d9;
            --accent: #38bdf8;
            --accent2: #22d3ee;
            --good: #22c55e;
            --warn: #f59e0b;
            --bad: #ef4444;
        }
        .stApp {
            background:
                radial-gradient(circle at top left, rgba(56,189,248,.12), transparent 26rem),
                linear-gradient(115deg, #07111f 0%, #07111f 42%, #08262f 100%);
            color: var(--text);
        }
        header[data-testid="stHeader"] { background: rgba(7,17,31,.0); }
        [data-testid="stSidebar"] { background: linear-gradient(180deg, #0a1930 0%, #07111f 100%); border-right: 1px solid rgba(148,163,184,.18); }
        [data-testid="stSidebar"] * { color: #f8fbff !important; }
        .main .block-container { max-width: 1240px; padding-top: 2rem; padding-bottom: 3rem; }
        .hero {
            padding: 1.5rem 1.75rem;
            border: 1px solid var(--border);
            border-radius: 1rem;
            background: linear-gradient(135deg, rgba(16,36,61,.95), rgba(13,27,46,.72));
            box-shadow: 0 18px 45px rgba(0,0,0,.28);
            margin-bottom: 1.6rem;
        }
        .hero h1 { margin:0; font-size:1.5rem; }
        .hero p { margin:.25rem 0 0 0; color:var(--muted); }
        .version-badge { float:right; padding:.45rem .75rem; background: #67e8f9; color:#06202b !important; border-radius: 999px; font-weight: 800; font-size: .78rem; }
        .sidebar-version { color:#8fb3d9 !important; font-size:.78rem; margin-top:-.8rem; margin-bottom:1.2rem; }
        .metric-card {
            border: 1px solid var(--border);
            background: linear-gradient(180deg, rgba(16,36,61,.92), rgba(13,27,46,.92));
            border-radius: .95rem;
            padding: 1rem 1.1rem;
            min-height: 6.2rem;
            box-shadow: 0 12px 30px rgba(0,0,0,.22);
        }
        .metric-title { color:#93c5fd; font-size:.72rem; text-transform:uppercase; font-weight:800; letter-spacing:.08em; }
        .metric-value { color:#f8fbff; font-size:1.62rem; font-weight:900; margin-top:.35rem; }
        .metric-sub { color:var(--muted); font-size:.82rem; margin-top:.25rem; }
        .stButton > button, .stDownloadButton > button {
            border-radius:.65rem !important; border:1px solid var(--border) !important; background:#10243d !important; color:#f8fbff !important; font-weight:800 !important;
        }
        .stButton > button:hover, .stDownloadButton > button:hover { border-color:var(--accent) !important; color:#e0f7ff !important; }
        div[data-testid="stDataFrame"], div[data-testid="stDataEditor"] { border:1px solid rgba(148,163,184,.18); border-radius:.8rem; overflow:hidden; }
        .flight-row {
            display:grid;
            grid-template-columns: 4.7rem 6rem 4.8rem 6.7rem 5.1rem 5.1rem 3.2rem 6rem 1fr 5.3rem 4.5rem;
            gap:.45rem; align-items:center;
            padding:.7rem .65rem; border-bottom:1px solid rgba(148,163,184,.13);
            font-size:.86rem;
        }
        .flight-row:hover { background:rgba(56,189,248,.055); }
        .flight-head { color:#93c5fd; font-size:.72rem; text-transform:uppercase; font-weight:900; letter-spacing:.05em; }
        .pill { display:inline-block; padding:.16rem .45rem; border-radius:999px; border:1px solid rgba(148,163,184,.24); background:rgba(15,23,42,.5); font-size:.75rem; color:#dbeafe; }
        .small-muted { color:var(--muted); font-size:.76rem; }
        .danger-zone { border:1px solid rgba(239,68,68,.45); border-radius:.9rem; padding:1rem; background:rgba(127,29,29,.18); }
        div[data-testid="stForm"] { border: 1px solid rgba(148,163,184,.16); border-radius: 1rem; padding: 1rem; background: rgba(13,27,46,.45); }
        </style>
        """,
        unsafe_allow_html=True,
    )


def render_hero() -> None:
    st.markdown(
        f"""
        <div class=\"hero\">
          <span class=\"version-badge\">{APP_VERSION}</span>
          <h1>Letový zápisník</h1>
          <p>Lokální pilotní evidence • ULL / EASA • náklady • GPS tracky</p>
        </div>
        """,
        unsafe_allow_html=True,
    )


# -----------------------------------------------------------------------------
# Forms
# -----------------------------------------------------------------------------

def registration_options() -> list[str]:
    aircraft = load_aircraft()
    opts = aircraft[aircraft["active"].fillna(1).astype(int).eq(1)]["registration"].dropna().astype(str).tolist() if not aircraft.empty else []
    return sorted(set(opts))


def airport_options() -> list[str]:
    df = load_airports()
    if df.empty:
        return ["LKSZ", "LKLT", "LKPR", "VFR"]
    return sorted(df["ident"].dropna().astype(str).unique().tolist())


def airport_label_map() -> dict[str, str]:
    df = load_airports()
    labels = {}
    for _, r in df.iterrows():
        ident = normalize_text(r.get("ident"))
        if ident:
            labels[ident] = f"{ident} • {r.get('name') or ''}"
    return labels


def default_aircraft_payload(registration: str) -> dict[str, Any]:
    aircraft = load_aircraft()
    row = aircraft[aircraft["registration"].eq(registration)].head(1)
    if row.empty:
        return {}
    return row.iloc[0].to_dict()


def flight_form(defaults: dict[str, Any] | None = None, key_prefix: str = "flight") -> dict[str, Any] | None:
    defaults = defaults or {}
    regs = registration_options()
    airports = airport_options()
    labels = airport_label_map()
    reg_default = defaults.get("registration") or (regs[0] if regs else "")
    with st.form(f"{key_prefix}_form"):
        c1, c2, c3, c4 = st.columns(4)
        with c1:
            d = st.date_input("Datum", value=pd.to_datetime(defaults.get("date") or date.today()).date(), key=f"{key_prefix}_date")
        with c2:
            evidence = st.selectbox("Evidence", EVIDENCE_OPTIONS, index=EVIDENCE_OPTIONS.index(defaults.get("evidence")) if defaults.get("evidence") in EVIDENCE_OPTIONS else 0, key=f"{key_prefix}_evidence")
        with c3:
            role = st.selectbox("Funkce", ROLE_OPTIONS, index=ROLE_OPTIONS.index(defaults.get("role")) if defaults.get("role") in ROLE_OPTIONS else 0, key=f"{key_prefix}_role")
        with c4:
            starts = st.number_input("Starty", min_value=0, max_value=50, value=int(defaults.get("starts") or 1), step=1, key=f"{key_prefix}_starts")
        c1, c2, c3, c4 = st.columns(4)
        with c1:
            registration = st.selectbox("Imatrikulace", options=regs or [reg_default], index=(regs.index(reg_default) if reg_default in regs else 0), key=f"{key_prefix}_registration")
        ac = default_aircraft_payload(registration)
        with c2:
            aircraft_type = st.text_input("Typ", value=defaults.get("aircraft_type") or ac.get("aircraft_type") or "", key=f"{key_prefix}_type")
        with c3:
            aircraft_class = st.selectbox("Třída", CLASS_OPTIONS, index=CLASS_OPTIONS.index(defaults.get("aircraft_class") or ac.get("aircraft_class")) if (defaults.get("aircraft_class") or ac.get("aircraft_class")) in CLASS_OPTIONS else 0, key=f"{key_prefix}_class")
        with c4:
            price = st.number_input("Cena Kč/h", min_value=0.0, value=float(defaults.get("price_per_hour") or ac.get("default_price_per_hour") or 0), step=50.0, key=f"{key_prefix}_price")
        c1, c2, c3, c4 = st.columns(4)
        dep_default = defaults.get("departure") or "LKSZ"
        arr_default = defaults.get("arrival") or dep_default
        with c1:
            dep = st.selectbox("Odlet", airports or [dep_default], index=(airports.index(dep_default) if dep_default in airports else 0), format_func=lambda x: labels.get(x, x), key=f"{key_prefix}_dep")
        with c2:
            arr = st.selectbox("Přílet", airports or [arr_default], index=(airports.index(arr_default) if arr_default in airports else 0), format_func=lambda x: labels.get(x, x), key=f"{key_prefix}_arr")
        with c3:
            off_block = st.text_input("Off-block", value=defaults.get("off_block") or "", placeholder="HH:MM", key=f"{key_prefix}_off")
        with c4:
            on_block = st.text_input("On-block", value=defaults.get("on_block") or "", placeholder="HH:MM", key=f"{key_prefix}_on")
        c1, c2, c3 = st.columns(3)
        with c1:
            takeoff = st.text_input("Take-off", value=defaults.get("takeoff") or "", placeholder="volitelné", key=f"{key_prefix}_to")
        with c2:
            landing = st.text_input("Landing", value=defaults.get("landing") or "", placeholder="volitelné", key=f"{key_prefix}_ldg")
        with c3:
            commander = st.text_input("Velitel", value=defaults.get("commander") or "Točík Filip", key=f"{key_prefix}_cmd")
        instructor = st.text_input("Instruktor / safety pilot", value=defaults.get("instructor") or "", key=f"{key_prefix}_instr")
        task = st.text_input("Úloha / trať", value=defaults.get("task") or "", key=f"{key_prefix}_task")
        note = st.text_area("Poznámka", value=defaults.get("note") or "", key=f"{key_prefix}_note", height=90)
        submitted = st.form_submit_button("Uložit", type="primary", disabled=not is_admin())
    if submitted:
        if not require_admin():
            return None
        if not parse_hhmm(off_block) or not parse_hhmm(on_block):
            st.error("Off-block a on-block musí být ve formátu HH:MM.")
            return None
        return {
            "date": d.isoformat(), "evidence": evidence, "registration": registration, "aircraft_type": aircraft_type,
            "aircraft_class": aircraft_class, "departure": dep, "arrival": arr, "off_block": off_block, "takeoff": takeoff,
            "landing": landing, "on_block": on_block, "starts": starts, "commander": commander, "instructor": instructor,
            "role": role, "task": task, "price_per_hour": price, "note": note,
        }
    return None


# -----------------------------------------------------------------------------
# Exports
# -----------------------------------------------------------------------------

def build_excel_export(flights: pd.DataFrame) -> bytes:
    wb = Workbook()
    ws = wb.active
    ws.title = "Lety"
    headers = ["Datum", "Evidence", "Imatrikulace", "Typ", "Třída", "Odlet", "Přílet", "Off-block", "Take-off", "Landing", "On-block", "Block", "Air", "Starty", "Velitel", "Instruktor", "Funkce", "Úloha", "Cena Kč/h", "Náklad", "Poznámka"]
    ws.append(headers)
    for _, r in flights.iterrows():
        ws.append([
            r.get("date"), r.get("evidence"), r.get("registration"), r.get("aircraft_type"), r.get("aircraft_class"), r.get("departure"), r.get("arrival"),
            r.get("off_block"), r.get("takeoff"), r.get("landing"), r.get("on_block"), r.get("block_time"), r.get("air_time"), r.get("starts"),
            r.get("commander"), r.get("instructor"), r.get("role"), r.get("task"), r.get("price_per_hour"), r.get("cost"), r.get("note"),
        ])
    fill = PatternFill("solid", fgColor="0F2740")
    font = Font(color="FFFFFF", bold=True)
    side = Side(style="thin", color="B7C9D9")
    for cell in ws[1]:
        cell.fill = fill; cell.font = font; cell.alignment = Alignment(horizontal="center"); cell.border = Border(bottom=side)
    ws.auto_filter.ref = ws.dimensions
    ws.freeze_panes = "A2"
    for col in range(1, ws.max_column + 1):
        letter = get_column_letter(col)
        max_len = max(len(str(ws.cell(row=r, column=col).value or "")) for r in range(1, min(ws.max_row, 1000) + 1))
        ws.column_dimensions[letter].width = min(max(max_len + 2, 10), 26)
    bio = BytesIO(); wb.save(bio); return bio.getvalue()


def build_backup_zip() -> bytes:
    import zipfile
    checkpoint_database()
    bio = BytesIO()
    with zipfile.ZipFile(bio, "w", zipfile.ZIP_DEFLATED) as z:
        if DB_PATH.exists():
            z.write(DB_PATH, "logbook.sqlite")
        if AIRPORTS_DB_PATH.exists():
            z.write(AIRPORTS_DB_PATH, "airports_full.sqlite")
        z.writestr("README.txt", "Záloha letového zápisníku. logbook.sqlite obsahuje živá data letů a tracků.\n")
    return bio.getvalue()


# -----------------------------------------------------------------------------
# Pages
# -----------------------------------------------------------------------------

def page_dashboard(flights: pd.DataFrame):
    st.markdown("## Dashboard")
    filtered = apply_filters(flights, "dash")
    c1, c2, c3, c4 = st.columns(4)
    total_min = int(filtered["block_minutes"].sum()) if not filtered.empty else 0
    pic_min = int(filtered["pic_minutes"].sum()) if not filtered.empty else 0
    dual_min = int(filtered["dual_minutes"].sum()) if not filtered.empty else 0
    safety_min = int(filtered["safety_minutes"].sum()) if not filtered.empty else 0
    total_cost = float(filtered["cost"].sum()) if not filtered.empty else 0
    with c1: metric_card("Celkový nálet", minutes_to_hhmm(total_min), f"{len(filtered)} letů")
    with c2:
        ull_pic = int(filtered.loc[filtered["evidence"].eq("ULL"), "pic_minutes"].sum()) if not filtered.empty else 0
        easa_pic = int(filtered.loc[filtered["evidence"].eq("EASA"), "pic_minutes"].sum()) if not filtered.empty else 0
        metric_card("PIC", minutes_to_hhmm(pic_min), f"ULL {minutes_to_hhmm(ull_pic)} • EASA {minutes_to_hhmm(easa_pic)}")
    with c3: metric_card("Dual / Safety", f"{minutes_to_hhmm(dual_min)} / {minutes_to_hhmm(safety_min)}", f"Starty {int(filtered['starts'].sum()) if not filtered.empty else 0}")
    tracks = read_tracks_joined()
    gps_km = tracks[tracks["flight_id"].isin(filtered["id"].tolist())]["distance_km"].fillna(0).sum() if not tracks.empty and not filtered.empty else 0
    with c4: metric_card("Náklady", f"{total_cost:,.0f} Kč".replace(",", " "), f"GPS {len(tracks)} tracků • {gps_km:.0f} km")
    if filtered.empty:
        st.info("Filtr neobsahuje žádné lety.")
        return
    yearly = filtered.copy()
    yearly["year"] = yearly["date"].astype(str).str[:4]
    yr = yearly.groupby("year", as_index=False)[["pic_minutes", "dual_minutes", "safety_minutes"]].sum()
    yr_long = yr.melt("year", var_name="variable", value_name="minutes")
    yr_long["value"] = yr_long["minutes"] / 60
    yr_long["variable"] = yr_long["variable"].map({"pic_minutes":"PIC", "dual_minutes":"DUAL", "safety_minutes":"SAFETY PILOT"})
    fig = px.bar(yr_long, x="year", y="value", color="variable", title="Nálet podle roku a funkce", barmode="stack")
    fig.update_layout(template="plotly_dark", paper_bgcolor="rgba(0,0,0,0)", plot_bgcolor="rgba(0,0,0,0)", height=390)
    st.plotly_chart(fig, use_container_width=True)
    c1, c2 = st.columns(2)
    with c1:
        top = filtered.groupby("registration", as_index=False)["block_minutes"].sum().sort_values("block_minutes", ascending=False).head(10)
        top["hours"] = top["block_minutes"] / 60
        fig2 = px.bar(top, x="registration", y="hours", title="TOP letadla podle block time")
        fig2.update_layout(template="plotly_dark", paper_bgcolor="rgba(0,0,0,0)", plot_bgcolor="rgba(0,0,0,0)", height=350)
        st.plotly_chart(fig2, use_container_width=True)
    with c2:
        ev = filtered.groupby("evidence", as_index=False)["block_minutes"].sum()
        ev["hours"] = ev["block_minutes"] / 60
        fig3 = px.pie(ev, values="hours", names="evidence", title="ULL / EASA", hole=.45)
        fig3.update_layout(template="plotly_dark", paper_bgcolor="rgba(0,0,0,0)", height=350)
        st.plotly_chart(fig3, use_container_width=True)


def render_flight_list(filtered: pd.DataFrame) -> None:
    if filtered.empty:
        st.info("Žádné lety pro aktuální filtr.")
        return
    per_page_options = [15, 25, 50, 100, "vše"]
    c1, c2 = st.columns([1, 3])
    with c1:
        per_page = st.selectbox("Řádků", per_page_options, index=1, key="flights_per_page")
    rows_per_page = len(filtered) if per_page == "vše" else int(per_page)
    total_pages = max(1, math.ceil(len(filtered) / rows_per_page))
    if "flights_page" not in st.session_state or st.session_state["flights_page"] > total_pages:
        st.session_state["flights_page"] = total_pages
    with c2:
        page = st.number_input("Strana", min_value=1, max_value=total_pages, value=int(st.session_state["flights_page"]), step=1, key="flights_page_input")
        st.session_state["flights_page"] = int(page)
    start = (int(page) - 1) * rows_per_page
    data = filtered.sort_values(["date", "off_block", "id"], ascending=[True, True, True]).iloc[start:start + rows_per_page]
    st.caption(f"Zobrazeno {start + 1}–{min(start + rows_per_page, len(filtered))} z {len(filtered)} letů")
    header = ["Detail", "ID", "Datum", "Evidence", "Letadlo", "Odlet", "Přílet", "Block", "Starty", "Funkce", "Velitel", "Cena", "GPS"]
    st.markdown('<div class="flight-row flight-head">' + ''.join(f'<div>{h}</div>' for h in header[:11]) + '</div>', unsafe_allow_html=True)
    for _, r in data.iterrows():
        c = st.columns([.85, .7, 1.1, .9, 1.3, 1, 1, .8, .7, 1.25, 1.4, 1, .7])
        with c[0]:
            if st.button("Detail", key=f"detail_{int(r['id'])}"):
                st.query_params["page"] = "detail"
                st.query_params["flight_id"] = str(int(r["id"]))
                st.rerun()
        values = [int(r["id"]), r["date"], r["evidence"], r["registration"], r["departure"], r["arrival"], r["block_time"], int(r["starts"]), r["role"], r["commander"], f"{r['cost']:.0f}"]
        for col, val in zip(c[1:12], values):
            with col:
                st.markdown(f"<span class='small-muted'>{val}</span>", unsafe_allow_html=True)
        with c[12]:
            st.markdown("✓" if int(r.get("id")) in set(read_tracks_joined()["flight_id"].tolist()) else "", unsafe_allow_html=True)


def page_flights(flights: pd.DataFrame):
    st.markdown("## Lety")
    filtered = apply_filters(flights, "flights")
    render_flight_list(filtered)


def render_flight_detail(flight_id: int, flights: pd.DataFrame, dark_mode: bool):
    match = flights[flights["id"].eq(flight_id)]
    if match.empty:
        st.error("Let nebyl nalezen.")
        if st.button("Zpět na lety"):
            st.query_params["page"] = "Lety"
            st.rerun()
        return
    r = match.iloc[0]
    st.markdown(f"## Detail letu #{flight_id}")
    if st.button("← Zpět na seznam letů"):
        st.query_params["page"] = "Lety"
        st.query_params.pop("flight_id", None)
        st.rerun()
    c1, c2, c3, c4 = st.columns(4)
    with c1: metric_card("Datum", str(r["date"]), str(r["evidence"]))
    with c2: metric_card("Letadlo", str(r["registration"]), str(r["aircraft_type"]))
    with c3: metric_card("Trať", f"{r['departure']} → {r['arrival']}", f"{r['off_block']}–{r['on_block']}")
    with c4: metric_card("Block / Air", f"{r['block_time']} / {r['air_time']}", f"{r['role']} • starty {r['starts']}")
    tab1, tab2, tab3, tab4 = st.tabs(["Přehled", "Editace", "Track", "Smazání"])
    with tab1:
        st.write({
            "Velitel": r.get("commander"), "Instruktor": r.get("instructor"), "Úloha": r.get("task"),
            "Cena Kč/h": r.get("price_per_hour"), "Náklad": r.get("cost"), "Poznámka": r.get("note"),
        })
    with tab2:
        payload = flight_form(r.to_dict(), key_prefix=f"edit_{flight_id}")
        if payload:
            update_flight(flight_id, payload)
            st.success("Let uložen.")
            st.rerun()
    with tab3:
        flight_tracks = read_tracks_joined()
        flight_tracks = flight_tracks[flight_tracks["flight_id"].eq(flight_id)] if not flight_tracks.empty else pd.DataFrame()
        if not flight_tracks.empty:
            st.subheader("Uložené tracky")
            joined = flight_tracks.copy()
            for _, tr in joined.iterrows():
                cols = st.columns([2, 1, 1, 1])
                cols[0].write(f"{tr['file_name']} • {tr['point_count']} bodů")
                cols[1].write(f"{float(tr['distance_km'] or 0):.1f} km")
                cols[2].write(f"{iso_to_local_time(tr['start_utc'])}–{iso_to_local_time(tr['end_utc'])}")
                with cols[3]:
                    if st.button("Smazat track", key=f"deltrack_{int(tr['id'])}", disabled=not is_admin()):
                        if require_admin():
                            delete_track(int(tr["id"]), flight_id)
                            st.success("Track smazán.")
                            st.rerun()
            render_folium_readonly(make_map(joined[joined["flight_id"].eq(int(selected_id))], dark_mode), height=440, key=f"track_map_existing_{selected_id}_{len(flight_tracks)}")
            first_track_id = int(joined.iloc[0]["id"])
            points = read_track_points(first_track_id)
            render_track_profile(points)
        uploaded = st.file_uploader("Nahrát KML track k tomuto letu", type=["kml"], key=f"track_upload_{flight_id}")
        if uploaded is not None:
            try:
                points, source = parse_kml_points(uploaded.read())
                if len(points) < 2:
                    st.error("KML neobsahuje dostatek bodů.")
                else:
                    preview = pd.DataFrame([{"coordinates_json": json.dumps(points), "flight_id": flight_id, "date": r["date"], "registration": r["registration"], "departure": r["departure"], "arrival": r["arrival"], "role": r["role"], "evidence": r["evidence"], "distance_km": compute_track_metrics(points)["distance_km"], "file_name": uploaded.name}])
                    st.success(f"Detekován zdroj: {source}. Načteno {len(points)} bodů, vzdálenost {compute_track_metrics(points)['distance_km']:.1f} km.")
                    render_folium_readonly(make_map(preview, dark_mode), height=360, key=f"track_map_preview_{selected_id}_{uploaded.name}_{len(points)}")
                    if st.button("Uložit track", type="primary", key=f"save_track_{flight_id}", disabled=not is_admin()):
                        if require_admin():
                            save_track_for_flight(flight_id, uploaded.name, points)
                            st.success("Track uložen.")
                            st.rerun()
            except Exception as exc:
                st.error(f"KML se nepodařilo načíst: {exc}")
    with tab4:
        st.markdown("<div class='danger-zone'>", unsafe_allow_html=True)
        st.subheader("Smazat celý let")
        st.warning("Smazání je trvalé. Odstraní se let i všechny připojené GPS tracky.")
        confirm = st.text_input(f"Pro potvrzení napiš ID letu: {flight_id}", key=f"delete_confirm_{flight_id}")
        if st.button("Trvale smazat let", type="primary", disabled=not is_admin(), key=f"delete_flight_{flight_id}"):
            if require_admin():
                if confirm.strip() == str(flight_id):
                    delete_flight(flight_id)
                    st.success(f"Let #{flight_id} byl smazán.")
                    st.query_params["page"] = "Lety"
                    st.query_params.pop("flight_id", None)
                    st.rerun()
                else:
                    st.error("Potvrzení nesouhlasí s ID letu.")
        st.markdown("</div>", unsafe_allow_html=True)


def page_add_flight(dark_mode: bool):
    st.markdown("## Přidat let")
    method = st.radio("Způsob zadání", ["Ručně", "Z KML"], horizontal=True)
    if method == "Ručně":
        payload = flight_form(key_prefix="new_manual")
        if payload:
            fid = create_flight(payload)
            st.success(f"Let uložen jako ID {fid}.")
            st.rerun()
    else:
        uploaded = st.file_uploader("KML z ADSBExchange / Flightradar24", type=["kml"])
        if uploaded is None:
            st.info("Nahraj KML soubor. Aplikace z něj zkusí odhadnout časy a track.")
            return
        try:
            raw = uploaded.read()
            points, source = parse_kml_points(raw)
        except Exception as exc:
            st.error(f"KML se nepodařilo načíst: {exc}")
            return
        if len(points) < 2:
            st.error("KML neobsahuje dostatek bodů.")
            return
        metrics = compute_track_metrics(points)
        st.success(f"Detekován zdroj: {source}. Načteno {len(points)} bodů, GPS vzdálenost {metrics['distance_km']:.1f} km.")
        start_local = iso_to_local_time(metrics.get("start_utc"))
        end_local = iso_to_local_time(metrics.get("end_utc"))
        defaults = {
            "date": datetime.now(LOCAL_TZ).date().isoformat(), "departure": "LKSZ", "arrival": "LKSZ", "off_block": start_local, "takeoff": start_local,
            "landing": end_local, "on_block": end_local, "registration": registration_options()[0] if registration_options() else "",
            "evidence": "ULL", "role": "PIC", "starts": 1,
        }
        st.caption("Zkontroluj návrh před uložením. Časy z FR24 mohou odpovídat prvnímu a poslednímu dostupnému bodu, ne vždy skutečnému off/on-block.")
        payload = flight_form(defaults, key_prefix="new_kml")
        preview_df = pd.DataFrame([{"coordinates_json": json.dumps(points), "flight_id": 0, "date": defaults["date"], "registration": defaults["registration"], "departure": defaults["departure"], "arrival": defaults["arrival"], "role": defaults["role"], "evidence": defaults["evidence"], "distance_km": metrics["distance_km"], "file_name": uploaded.name}])
        render_folium_readonly(make_map(preview_df, dark_mode), height=420, key=f"new_flight_preview_map_{uploaded.name}_{len(points)}")
        render_track_profile(points)
        if payload:
            payload["track_points"] = points
            payload["track_file_name"] = uploaded.name
            fid = create_flight(payload)
            st.success(f"Let uložen jako ID {fid} včetně tracku.")
            st.rerun()


# -----------------------------------------------------------------------------
# Maps
# -----------------------------------------------------------------------------

def _coord_dict_from_airport(ap: dict[str, Any] | None) -> dict[str, Any] | None:
    if not ap:
        return None
    try:
        return {"lat": float(ap["lat"]), "lon": float(ap["lon"]), "alt_m": None, "time_utc": None, "source": "airport_extension"}
    except Exception:
        return None


def track_latlon_with_airport_extensions(
    row: pd.Series | dict[str, Any],
    points: list[dict[str, Any]],
    min_gap_km: float = 0.65,
) -> tuple[list[tuple[float, float]], list[dict[str, Any]]]:
    """Return visual track coordinates extended by direct airport connectors.

    The returned airport connectors are only for visual map continuity. They are
    not written back into GPS points and they do not affect stored GPS distance.
    """
    if not points:
        return [], []
    lookup = airport_coord_lookup()
    dep = normalize_text(row.get("departure")) if hasattr(row, "get") else ""
    arr = normalize_text(row.get("arrival")) if hasattr(row, "get") else ""
    dep_ap = lookup.get(dep.upper()) if dep else None
    arr_ap = lookup.get(arr.upper()) if arr else None

    visual_points = [dict(p) for p in points]
    extensions: list[dict[str, Any]] = []

    if dep_ap and visual_points:
        dep_pt = _coord_dict_from_airport(dep_ap)
        if dep_pt and haversine_km(dep_pt, visual_points[0]) > min_gap_km:
            visual_points.insert(0, dep_pt)
            extensions.append({"kind": "departure", "airport": dep_ap, "to": points[0]})

    if arr_ap and visual_points:
        arr_pt = _coord_dict_from_airport(arr_ap)
        if arr_pt and haversine_km(visual_points[-1], arr_pt) > min_gap_km:
            visual_points.append(arr_pt)
            extensions.append({"kind": "arrival", "airport": arr_ap, "from": points[-1]})

    latlon = [(float(p["lat"]), float(p["lon"])) for p in visual_points]
    return latlon, extensions


def map_center_from_tracks(tracks: pd.DataFrame) -> tuple[list[float], int]:
    coords: list[tuple[float, float]] = []
    for _, row in tracks.iterrows():
        try:
            points = downsample_points(json.loads(row["coordinates_json"]), max_points=300)
            latlon, _ = track_latlon_with_airport_extensions(row, points)
            stride = max(1, len(latlon) // 50 or 1)
            coords.extend(latlon[::stride])
        except Exception:
            continue
    if not coords:
        return [49.8, 15.5], 7
    min_lat = min(c[0] for c in coords); max_lat = max(c[0] for c in coords); min_lon = min(c[1] for c in coords); max_lon = max(c[1] for c in coords)
    center = [(min_lat + max_lat) / 2, (min_lon + max_lon) / 2]
    spread = max(max_lat - min_lat, max_lon - min_lon)
    zoom = 10 if spread < .25 else 8 if spread < 1 else 7 if spread < 4 else 6 if spread < 10 else 5
    return center, zoom


def make_map(
    tracks: pd.DataFrame,
    dark_mode: bool = True,
    line_weight: float = 4,
    line_opacity: float = 0.78,
    show_endpoints: bool = True,
    extend_to_airports: bool = True,
) -> folium.Map:
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
        gps_latlon = [(float(p["lat"]), float(p["lon"])) for p in points]
        latlon, extensions = track_latlon_with_airport_extensions(row, points) if extend_to_airports else (gps_latlon, [])
        evidence = str(row.get("evidence") or "").upper()
        color = "#38bdf8" if evidence == "ULL" else "#fbbf24"
        ext_note = "<br><span style='color:#94a3b8'>Mapa doplnila přímku k letišti.</span>" if extensions else ""
        popup = folium.Popup(f"""
            <b>{row.get('date') or ''} • {row.get('registration') or ''}</b><br>
            {row.get('departure') or ''}–{row.get('arrival') or ''}<br>
            {row.get('role') or ''} • {row.get('evidence') or ''}<br>
            GPS: {float(row.get('distance_km') or 0):.1f} km<br>
            Track: {row.get('file_name') or ''}{ext_note}
            """, max_width=360)
        folium.PolyLine(latlon, color=color, weight=line_weight, opacity=line_opacity, popup=popup).add_to(m)

        for ext in extensions:
            if ext["kind"] == "departure":
                seg = [(float(ext["airport"]["lat"]), float(ext["airport"]["lon"])), (float(ext["to"]["lat"]), float(ext["to"]["lon"]))]
                tooltip = f"Doplněno od letiště {ext['airport']['ident']} k prvnímu GPS bodu"
            else:
                seg = [(float(ext["from"]["lat"]), float(ext["from"]["lon"])), (float(ext["airport"]["lat"]), float(ext["airport"]["lon"]))]
                tooltip = f"Doplněno od posledního GPS bodu k letišti {ext['airport']['ident']}"
            folium.PolyLine(seg, color="#94a3b8", weight=max(1.2, line_weight - 0.6), opacity=0.72, dash_array="7,7", tooltip=tooltip).add_to(m)

        if show_endpoints:
            start = latlon[0] if latlon else gps_latlon[0]
            end = latlon[-1] if latlon else gps_latlon[-1]
            folium.CircleMarker(start, radius=4, color="#22c55e", fill=True, fill_opacity=.9, tooltip="Start / odlet").add_to(m)
            folium.CircleMarker(end, radius=4, color="#ef4444", fill=True, fill_opacity=.9, tooltip="End / přílet").add_to(m)
    folium.LayerControl().add_to(m)
    return m


def map_center_from_airport_coords(coords: list[tuple[float, float]]) -> tuple[list[float], int]:
    if not coords:
        return [49.8, 15.5], 7
    min_lat = min(c[0] for c in coords); max_lat = max(c[0] for c in coords); min_lon = min(c[1] for c in coords); max_lon = max(c[1] for c in coords)
    center = [(min_lat + max_lat) / 2, (min_lon + max_lon) / 2]
    spread = max(max_lat - min_lat, max_lon - min_lon)
    zoom = 11 if spread < .15 else 9 if spread < .6 else 8 if spread < 1.8 else 7 if spread < 5 else 6 if spread < 10 else 5
    return center, zoom


def make_route_overview_map(flights: pd.DataFrame, dark_mode: bool = True) -> folium.Map:
    lookup = airport_coord_lookup()
    coords: list[tuple[float, float]] = []
    routes: list[dict[str, Any]] = []
    visited: dict[str, dict[str, Any]] = {}

    for _, row in flights.iterrows():
        dep = normalize_text(row.get("departure"))
        arr = normalize_text(row.get("arrival"))
        if not dep or not arr:
            continue
        dep_ap = lookup.get(dep.upper())
        arr_ap = lookup.get(arr.upper())
        if not dep_ap or not arr_ap:
            continue
        dep_ll = (float(dep_ap["lat"]), float(dep_ap["lon"]))
        arr_ll = (float(arr_ap["lat"]), float(arr_ap["lon"]))
        coords.extend([dep_ll, arr_ll])
        visited[dep_ap["ident"]] = dep_ap
        visited[arr_ap["ident"]] = arr_ap
        routes.append({"row": row, "dep": dep_ap, "arr": arr_ap, "dep_ll": dep_ll, "arr_ll": arr_ll})

    center, zoom = map_center_from_airport_coords(coords)
    tiles = "CartoDB dark_matter" if dark_mode else "OpenStreetMap"
    m = folium.Map(location=center, zoom_start=zoom, tiles=tiles, control_scale=True)

    route_counts: dict[tuple[str, str], int] = {}
    for route in routes:
        row = route["row"]
        dep_id = route["dep"]["ident"]
        arr_id = route["arr"]["ident"]
        key = tuple(sorted([dep_id, arr_id]))
        route_counts[key] = route_counts.get(key, 0) + 1
        offset = min(route_counts[key] - 1, 8) * 0.0009
        dep_ll = (route["dep_ll"][0] + offset, route["dep_ll"][1] + offset)
        arr_ll = (route["arr_ll"][0] + offset, route["arr_ll"][1] + offset)
        evidence = str(row.get("evidence") or "").upper()
        color = "#38bdf8" if evidence == "ULL" else "#fbbf24"
        flight_id = int(row.get("id"))
        link = detail_link(flight_id)
        popup = folium.Popup(f"""
            <b>ID {flight_id} • {row.get('date') or ''}</b><br>
            {row.get('registration') or ''}<br>
            {dep_id}–{arr_id}<br>
            {row.get('off_block') or ''}–{row.get('on_block') or ''} • {row.get('role') or ''}<br>
            <a href="{link}" target="_top" rel="noopener">Otevřít detail letu</a>
            """, max_width=320)
        folium.PolyLine([dep_ll, arr_ll], color=color, weight=2.2, opacity=0.56, popup=popup, tooltip=f"ID {flight_id}: {dep_id}–{arr_id}").add_to(m)

    for ident, ap in visited.items():
        tooltip = f"{ident} • {ap.get('name') or ''}"
        popup = folium.Popup(f"<b>{ident}</b><br>{ap.get('name') or ''}", max_width=260)
        folium.CircleMarker((float(ap["lat"]), float(ap["lon"])), radius=5, color="#22c55e", fill=True, fill_opacity=.92, tooltip=tooltip, popup=popup).add_to(m)

    folium.LayerControl().add_to(m)
    return m


def render_folium_readonly(m: folium.Map, *, height: int = 680, key: str | None = None) -> None:
    """Render a Folium map without returning pan/zoom/click state to Streamlit.

    streamlit-folium normally sends viewport changes back to Python. That is useful
    for editable maps, but here the maps are read-only. Returning viewport changes
    causes a full Streamlit rerun while the user drags/zooms the map, which makes
    the page look dark/disabled and feels slow.  returned_objects=[] keeps the map
    fully interactive in the browser but prevents those unnecessary reruns.
    """
    try:
        st_folium(
            m,
            height=height,
            use_container_width=True,
            key=key,
            returned_objects=[],
        )
    except TypeError:
        # Fallback for older streamlit-folium versions. It is still read-only and
        # avoids returning map state to Streamlit.
        components.html(m.get_root().render(), height=height, scrolling=False)

def render_track_profile(points: list[dict[str, Any]]) -> None:
    prof = profile_from_points(points)
    if prof.empty:
        st.info("Track nemá data pro profil.")
        return
    x = prof["time_local"] if prof["time_local"].notna().any() else prof["distance_km"]
    x_title = "Čas" if prof["time_local"].notna().any() else "Vzdálenost km"

    fig = go.Figure()
    fig.add_trace(
        go.Scatter(
            x=x,
            y=prof["alt_m"],
            name="Výška m",
            mode="lines",
            line=dict(width=2),
            yaxis="y1",
        )
    )
    if "speed_kt" in prof and prof["speed_kt"].notna().any():
        fig.add_trace(
            go.Scatter(
                x=x,
                y=prof["speed_kt"],
                name="GS kt",
                mode="lines",
                line=dict(width=2, dash="dot"),
                yaxis="y2",
            )
        )
    fig.update_layout(
        template="plotly_dark",
        paper_bgcolor="rgba(0,0,0,0)",
        plot_bgcolor="rgba(0,0,0,0)",
        height=360,
        xaxis_title=x_title,
        yaxis=dict(title="Výška m", side="left"),
        yaxis2=dict(title="GS kt", overlaying="y", side="right", showgrid=False),
        legend=dict(orientation="h"),
    )
    st.plotly_chart(fig, use_container_width=True)


def page_maps(flights: pd.DataFrame, dark_mode: bool):
    st.markdown("## Mapa letů")
    filtered = apply_filters(flights, "map")
    tracks = read_tracks_joined()
    if not tracks.empty:
        tracks = tracks[tracks["flight_id"].isin(filtered["id"].tolist())].copy()

    known_routes = 0
    lookup = airport_coord_lookup()
    if not filtered.empty:
        for _, row in filtered.iterrows():
            dep = normalize_text(row.get("departure"))
            arr = normalize_text(row.get("arrival"))
            if dep and arr and dep.upper() in lookup and arr.upper() in lookup:
                known_routes += 1

    c1, c2, c3, c4 = st.columns(4)
    with c1: metric_card("Letů ve filtru", str(len(filtered)), "")
    with c2: metric_card("Tracky", str(len(tracks)), "GPS záznamy")
    with c3: metric_card("GPS vzdálenost", f"{tracks['distance_km'].fillna(0).sum():.1f} km" if not tracks.empty else "0.0 km", "")
    with c4: metric_card("Direct trasy", str(known_routes), "podle letišť")

    tab_tracks, tab_overview = st.tabs(["GPS tracky", "Orientační mapa letišť"])
    with tab_tracks:
        if tracks.empty:
            st.info("Pro aktuální filtr není dostupný žádný KML track.")
        else:
            st.caption("GPS mapa zobrazuje skutečné KML tracky. Když track nezačíná/nekončí na zadaném letišti, mapa doplní šedou přerušovanou spojku k letišti pouze vizuálně; uložené GPS body a GPS km zůstávají beze změny.")
            render_folium_readonly(make_map(tracks, dark_mode=dark_mode, line_weight=2, line_opacity=0.46, show_endpoints=False, extend_to_airports=True), height=680, key=f"all_tracks_map_v0312_{len(tracks)}")
            st.dataframe(tracks[["date","registration","departure","arrival","role","evidence","file_name","point_count","distance_km"]].rename(columns={"date":"Datum","registration":"Imatrikulace","departure":"Odlet","arrival":"Přílet","role":"Funkce","evidence":"Evidence","file_name":"Soubor","point_count":"Body","distance_km":"Km"}), hide_index=True, use_container_width=True)
    with tab_overview:
        if filtered.empty or known_routes == 0:
            st.info("Pro aktuální filtr nejsou známé souřadnice odletového i příletového letiště.")
        else:
            visited = set()
            for _, row in filtered.iterrows():
                dep = normalize_text(row.get("departure"))
                arr = normalize_text(row.get("arrival"))
                if dep and dep.upper() in lookup:
                    visited.add(dep.upper())
                if arr and arr.upper() in lookup:
                    visited.add(arr.upper())
            st.caption("Orientační mapa neukazuje přesný GPS track. Zobrazuje navštívená letiště jako body a mezi nimi přímé spojnice jednotlivých letů. Kliknutím na linku v popupu otevřeš detail letu.")
            render_folium_readonly(make_route_overview_map(filtered, dark_mode=dark_mode), height=680, key=f"route_overview_map_v0312_{len(filtered)}_{known_routes}")
            st.dataframe(
                filtered[["id","date","registration","departure","arrival","role","evidence","block_time"]]
                .rename(columns={"id":"ID","date":"Datum","registration":"Imatrikulace","departure":"Odlet","arrival":"Přílet","role":"Funkce","evidence":"Evidence","block_time":"Block"}),
                hide_index=True,
                use_container_width=True,
            )


def page_rates(rates: pd.DataFrame):
    st.markdown("## Ceník")
    if rates.empty:
        rates = pd.DataFrame(columns=["id", "registration", "aircraft_type", "valid_from", "price_per_hour", "dry_price_per_hour", "source"])
    display = rates.rename(columns={"id":"ID","registration":"Imatrikulace","aircraft_type":"Typ","valid_from":"Od data","price_per_hour":"Cena Kč/h","dry_price_per_hour":"Suchá hodina Kč/h","source":"Zdroj"})
    edited = st.data_editor(display, hide_index=True, use_container_width=True, num_rows="dynamic", disabled=["ID"] if is_admin() else display.columns.tolist(), height=640, column_config={"Cena Kč/h": st.column_config.NumberColumn(format="%.0f Kč"), "Suchá hodina Kč/h": st.column_config.NumberColumn(format="%.0f Kč")})
    if st.button("Uložit ceník", type="primary", disabled=not is_admin()):
        if require_admin():
            with connect() as con:
                initialize_database(con)
                con.execute("DELETE FROM rates")
                for _, r in edited.iterrows():
                    if normalize_text(r.get("Imatrikulace")):
                        con.execute("INSERT INTO rates (id, registration, aircraft_type, valid_from, price_per_hour, dry_price_per_hour, source) VALUES (?, ?, ?, ?, ?, ?, ?)", (r.get("ID") if pd.notna(r.get("ID")) else None, r.get("Imatrikulace"), r.get("Typ"), r.get("Od data"), float_or_none(r.get("Cena Kč/h")), float_or_none(r.get("Suchá hodina Kč/h")), r.get("Zdroj")))
                record_audit(con, "save_rates", "rates", None, {"rows": len(edited)})
                con.commit()
            invalidate_cached_data()
            auto_backup_after_change("rates update")
            st.success("Ceník uložen.")
            st.rerun()


def page_database():
    st.markdown("## Databáze")
    tab_aircraft, tab_airports, tab_audit = st.tabs(["Letadla", "Letiště", "Audit"])
    with tab_aircraft:
        aircraft = load_aircraft()
        edited = st.data_editor(aircraft, hide_index=True, use_container_width=True, num_rows="dynamic", disabled=["id"] if is_admin() else aircraft.columns.tolist(), height=560)
        if st.button("Uložit letadla", type="primary", disabled=not is_admin()):
            if require_admin():
                with connect() as con:
                    initialize_database(con)
                    con.execute("DELETE FROM aircraft")
                    for _, r in edited.iterrows():
                        if normalize_text(r.get("registration")):
                            con.execute("""INSERT INTO aircraft (id, registration, aircraft_type, icao_type, aircraft_class, evidence, default_price_per_hour, active, note, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""", (r.get("id") if pd.notna(r.get("id")) else None, r.get("registration"), r.get("aircraft_type"), r.get("icao_type"), r.get("aircraft_class"), r.get("evidence"), float_or_none(r.get("default_price_per_hour")), int(r.get("active") or 0), r.get("note"), r.get("created_at") or _now_iso(), _now_iso()))
                    record_audit(con, "save_aircraft", "aircraft", None, {"rows": len(edited)})
                    con.commit()
                invalidate_cached_data()
                auto_backup_after_change("aircraft update")
                st.success("Letadla uložena.")
                st.rerun()
    with tab_airports:
        airports = load_airports()
        q = st.text_input("Hledat letiště", key="airport_search")
        show = airports
        if q:
            mask = show[["ident", "name", "municipality", "iso_country"]].fillna("").agg(" ".join, axis=1).str.lower().str.contains(q.lower(), regex=False)
            show = show[mask]
        st.caption(f"Zobrazeno {len(show)} / {len(airports)} letišť. Ruční záznamy v logbook.sqlite mají prioritu před pevnou světovou databází airports_full.sqlite.")
        st.dataframe(show.head(2000), hide_index=True, use_container_width=True, height=560)
    with tab_audit:
        st.dataframe(read_audit_log(), hide_index=True, use_container_width=True, height=560)


def page_export(flights: pd.DataFrame):
    st.markdown("## Export a zálohy")
    c1, c2 = st.columns(2)
    with c1:
        st.download_button("Stáhnout Excel", data=build_excel_export(flights), file_name=f"letovy_zapisnik_{date.today().isoformat()}.xlsx", mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", use_container_width=True)
        st.download_button("Stáhnout zálohu SQLite ZIP", data=build_backup_zip(), file_name=f"logbook_backup_{date.today().isoformat()}.zip", mime="application/zip", use_container_width=True)
    with c2:
        st.subheader("GitHub záloha")
        cfg = github_backup_config()
        st.write({"repo": cfg.get("repo"), "db_path": cfg.get("db_path"), "branch": cfg.get("branch"), "configured": github_backup_configured()})
        if st.button("Uložit databázi na GitHub teď", disabled=not is_admin()):
            if require_admin():
                try:
                    url = backup_database_to_github()
                    st.success("Uloženo na GitHub.")
                    if url:
                        st.link_button("Otevřít commit", url)
                except Exception as exc:
                    st.error(str(exc))
        uploaded = st.file_uploader("Obnovit databázi ze SQLite souboru", type=["sqlite", "db"])
        if uploaded and st.button("Obnovit databázi", type="primary", disabled=not is_admin()):
            if require_admin():
                try:
                    restore_database_from_upload(uploaded)
                    st.success("Databáze obnovena.")
                    st.rerun()
                except Exception as exc:
                    st.error(str(exc))
    show_backup_status()


# -----------------------------------------------------------------------------
# Main
# -----------------------------------------------------------------------------

def render_sidebar_nav() -> str:
    page = st.session_state.get("page", "Souhrn")
    for label, target in NAV_ITEMS:
        if st.button(label, key=f"nav_{target}", use_container_width=True, type="primary" if page == target else "secondary"):
            st.session_state["page"] = target
            st.query_params["page"] = target
            st.query_params.pop("flight_id", None)
            st.rerun()
    return page


def main() -> None:
    st.set_page_config(page_title="Letový zápisník", layout="wide", initial_sidebar_state="expanded")
    with connect() as con:
        initialize_database(con)
    params = st.query_params
    page_param = params.get("page", None)
    flight_id_param = params.get("flight_id", None)
    if page_param == "detail" and flight_id_param:
        st.session_state["page"] = "detail"
        st.session_state["flight_id"] = int(flight_id_param)
    elif page_param and page_param in [x[1] for x in NAV_ITEMS]:
        st.session_state["page"] = page_param
    elif "page" not in st.session_state:
        st.session_state["page"] = "Souhrn"

    dark_mode = True
    with st.sidebar:
        st.markdown("## Letový zápisník")
        st.markdown(f"<div class='sidebar-version'>{APP_VERSION}</div>", unsafe_allow_html=True)
        st.markdown("### Navigace")
        render_sidebar_nav()
        render_auth_sidebar()
    apply_ui_theme(dark_mode)
    render_hero()
    flights = load_flights()
    page = st.session_state.get("page", "Souhrn")
    if page == "detail":
        render_flight_detail(int(st.session_state.get("flight_id") or flight_id_param), flights, dark_mode)
    elif page == "Souhrn":
        page_dashboard(flights)
    elif page == "Lety":
        page_flights(flights)
    elif page == "Přidat let":
        page_add_flight(dark_mode)
    elif page == "Mapa":
        page_maps(flights, dark_mode)
    elif page == "Ceník":
        page_rates(load_rates())
    elif page == "Databáze":
        page_database()
    elif page == "Export":
        page_export(flights)


if __name__ == "__main__":
    main()
