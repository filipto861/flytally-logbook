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
APP_VERSION = "v0.32"
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
    tmp_path = DB_PATH.with_suffix(".sqlite.upload")
    tmp_path.write_bytes(raw)
    try:
        with sqlite3.connect(tmp_path) as con:
            con.execute("PRAGMA integrity_check")
    except Exception as exc:
        tmp_path.unlink(missing_ok=True)
        raise RuntimeError(f"Kontrola databáze selhala: {exc}") from exc
    tmp_path.replace(DB_PATH)
    invalidate_cached_data()


def get_backup_state() -> dict[str, str | None]:
    if not DB_PATH.exists():
        return {"dirty": None, "last_github_backup_at": None, "last_github_backup_error": "Databáze neexistuje"}
    try:
        with connect() as con:
            rows = con.execute("SELECT key, value FROM app_meta WHERE key IN ('dirty','last_github_backup_at','last_github_backup_error','last_change_at')").fetchall()
        meta = {r[0]: r[1] for r in rows}
        return {
            "dirty": meta.get("dirty"),
            "last_github_backup_at": meta.get("last_github_backup_at"),
            "last_github_backup_error": meta.get("last_github_backup_error"),
            "last_change_at": meta.get("last_change_at"),
        }
    except Exception as exc:
        return {"dirty": None, "last_github_backup_at": None, "last_github_backup_error": str(exc)}


def connect() -> sqlite3.Connection:
    DATA_DIR.mkdir(exist_ok=True)
    con = sqlite3.connect(DB_PATH)
    con.row_factory = sqlite3.Row
    con.execute("PRAGMA foreign_keys = ON")
    con.execute("PRAGMA busy_timeout = 5000")
    return con


def ensure_schema_compatibility(con: sqlite3.Connection) -> None:
    def columns(table: str) -> set[str]:
        try:
            return {r[1] for r in con.execute(f"PRAGMA table_info({table})").fetchall()}
        except sqlite3.OperationalError:
            return set()
    audit_cols = columns("audit_log")
    if audit_cols:
        for col, ddl in {
            "actor": "actor TEXT",
            "object_type": "object_type TEXT",
            "object_id": "object_id TEXT",
            "detail_json": "detail_json TEXT",
        }.items():
            if col not in audit_cols:
                try:
                    con.execute(f"ALTER TABLE audit_log ADD COLUMN {ddl}")
                except sqlite3.OperationalError:
                    pass
        con.execute("CREATE INDEX IF NOT EXISTS idx_audit_created_at ON audit_log(created_at)")
    airports_cols = columns("airports")
    if airports_cols:
        airport_ddl = {
            "name": "name TEXT",
            "airport_type": "airport_type TEXT",
            "iso_country": "iso_country TEXT",
            "iso_region": "iso_region TEXT",
            "municipality": "municipality TEXT",
            "latitude_deg": "latitude_deg REAL",
            "longitude_deg": "longitude_deg REAL",
            "elevation_ft": "elevation_ft REAL",
            "gps_code": "gps_code TEXT",
            "iata_code": "iata_code TEXT",
            "local_code": "local_code TEXT",
            "source": "source TEXT",
            "active": "active INTEGER DEFAULT 1",
            "closed": "closed INTEGER DEFAULT 0",
            "data_quality": "data_quality TEXT",
            "imported_at": "imported_at TEXT",
            "updated_at": "updated_at TEXT",
            "raw_json": "raw_json TEXT",
        }
        for col, ddl in airport_ddl.items():
            if col not in airports_cols:
                try:
                    con.execute(f"ALTER TABLE airports ADD COLUMN {ddl}")
                except sqlite3.OperationalError:
                    pass
        con.execute("CREATE INDEX IF NOT EXISTS idx_airports_ident ON airports(ident)")
        con.execute("CREATE INDEX IF NOT EXISTS idx_airports_country ON airports(iso_country)")
        con.execute("CREATE INDEX IF NOT EXISTS idx_airports_active ON airports(active, closed)")


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


def _seed_aircraft_from_existing_data(con: sqlite3.Connection) -> None:
    rows = con.execute("""
        SELECT registration, aircraft_type, aircraft_class, evidence, MAX(price_per_hour) AS price
        FROM flights
        WHERE COALESCE(registration,'') <> ''
        GROUP BY registration
    """).fetchall()
    for r in rows:
        if not r["registration"]:
            continue
        con.execute("""
            INSERT OR IGNORE INTO aircraft
            (registration, aircraft_type, aircraft_class, evidence, default_price_per_hour, active, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, 1, ?, ?)
        """, (r["registration"], r["aircraft_type"], r["aircraft_class"], r["evidence"], r["price"], _now_iso(), _now_iso()))


def _seed_airports_from_overrides(con: sqlite3.Connection) -> None:
    con.execute("""
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
    """)
    if not AIRPORT_OVERRIDES_PATH.exists():
        return
    try:
        import csv
        with AIRPORT_OVERRIDES_PATH.open("r", encoding="utf-8-sig", newline="") as fh:
            reader = csv.DictReader(fh)
            for row in reader:
                ident = (row.get("ident") or "").strip().upper()
                if not ident:
                    continue
                try:
                    lat = float(str(row.get("latitude_deg") or "").replace(",", "."))
                    lon = float(str(row.get("longitude_deg") or "").replace(",", "."))
                except ValueError:
                    continue
                ts = _now_iso()
                con.execute("""
                    INSERT OR REPLACE INTO airports
                    (ident, name, airport_type, iso_country, iso_region, municipality, latitude_deg, longitude_deg, elevation_ft,
                     gps_code, iata_code, local_code, source, active, closed, data_quality, imported_at, updated_at, raw_json)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0, ?, ?, ?, ?)
                """, (
                    ident, row.get("name"), row.get("airport_type") or "manual", row.get("iso_country") or "CZ", row.get("iso_region"),
                    row.get("municipality"), lat, lon, _float_or_none(row.get("elevation_ft")), row.get("gps_code"), row.get("iata_code"),
                    row.get("local_code") or ident, "manual_seed", "manual_override", ts, ts, json.dumps(row, ensure_ascii=False),
                ))
    except Exception:
        return


def import_airports_from_csv(con: sqlite3.Connection, uploaded_file) -> dict[str, Any]:
    import csv
    raw = uploaded_file.read()
    text = raw.decode("utf-8-sig")
    reader = csv.DictReader(text.splitlines())
    required = {"ident", "name", "latitude_deg", "longitude_deg"}
    if not required.issubset(set(reader.fieldnames or [])):
        raise ValueError("CSV musí obsahovat minimálně sloupce ident, name, latitude_deg, longitude_deg.")
    inserted = 0
    skipped = 0
    ts = _now_iso()
    for row in reader:
        ident = (row.get("ident") or "").strip().upper()
        if not ident:
            skipped += 1
            continue
        lat = _float_or_none(row.get("latitude_deg"))
        lon = _float_or_none(row.get("longitude_deg"))
        if lat is None or lon is None:
            skipped += 1
            continue
        raw_json = json.dumps(row, ensure_ascii=False)
        con.execute("""
            INSERT OR REPLACE INTO airports
            (ident, name, airport_type, iso_country, iso_region, municipality, latitude_deg, longitude_deg, elevation_ft,
             gps_code, iata_code, local_code, source, active, closed, data_quality, imported_at, updated_at, raw_json)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            ident,
            row.get("name"),
            row.get("type") or row.get("airport_type"),
            row.get("iso_country"),
            row.get("iso_region"),
            row.get("municipality"),
            lat,
            lon,
            _float_or_none(row.get("elevation_ft")),
            row.get("gps_code"),
            row.get("iata_code"),
            row.get("local_code"),
            "csv_import",
            0 if (row.get("type") == "closed") else 1,
            1 if (row.get("type") == "closed") else 0,
            "imported",
            ts,
            ts,
            raw_json,
        ))
        inserted += 1
    record_audit(con, "import_airports_csv", "airports", None, {"inserted": inserted, "skipped": skipped, "filename": getattr(uploaded_file, "name", None)})
    return {"inserted": inserted, "skipped": skipped}


def _float_or_none(v: Any) -> float | None:
    if v is None or v == "":
        return None
    try:
        return float(str(v).strip().replace(",", "."))
    except Exception:
        return None


# -----------------------------------------------------------------------------
# Formatting and calculations
# -----------------------------------------------------------------------------

def parse_time(value: Any) -> time | None:
    if value is None or value == "":
        return None
    if isinstance(value, time):
        return value
    if isinstance(value, datetime):
        return value.time().replace(second=0, microsecond=0)
    text = str(value).strip()
    if not text or text.lower() == "nan":
        return None
    for fmt in ("%H:%M", "%H:%M:%S"):
        try:
            return datetime.strptime(text, fmt).time()
        except ValueError:
            pass
    return None


def time_to_minutes(t: time | None) -> int | None:
    if not t:
        return None
    return t.hour * 60 + t.minute


def minutes_to_hhmm(minutes: int | float | None) -> str:
    if minutes is None:
        return "0:00"
    minutes = int(round(minutes))
    h, m = divmod(minutes, 60)
    return f"{h}:{m:02d}"


def format_decimal_hours(minutes: int | float | None) -> float:
    return round((minutes or 0) / 60, 2)


def calc_duration_minutes(start: time | None, end: time | None) -> int:
    sm = time_to_minutes(start)
    em = time_to_minutes(end)
    if sm is None or em is None:
        return 0
    if em < sm:
        em += 24 * 60
    return max(0, em - sm)


def block_minutes(row: sqlite3.Row | dict[str, Any]) -> int:
    return calc_duration_minutes(parse_time(row["off_block"]), parse_time(row["on_block"]))


def air_minutes(row: sqlite3.Row | dict[str, Any]) -> int:
    return calc_duration_minutes(parse_time(row["takeoff"]), parse_time(row["landing"]))


def cost_for_row(row: sqlite3.Row | dict[str, Any]) -> float:
    mins = block_minutes(row)
    pph = row["price_per_hour"] or 0
    return round((mins / 60) * pph, 2)


def fmt_money(v: float | int | None) -> str:
    return f"{float(v or 0):,.0f} Kč".replace(",", " ")


def safe_text(v: Any, fallback: str = "") -> str:
    if v is None:
        return fallback
    if isinstance(v, float) and math.isnan(v):
        return fallback
    text = str(v)
    if text.lower() in {"nan", "none", "nat"}:
        return fallback
    return text


def short_cell(v: Any, fallback: str = "—", max_len: int = 16) -> str:
    text = safe_text(v, fallback).strip()
    if not text:
        return fallback
    return text if len(text) <= max_len else text[: max_len - 1] + "…"


def query_params() -> dict[str, str]:
    try:
        qp = dict(st.query_params)
        return {k: v[0] if isinstance(v, list) else v for k, v in qp.items()}
    except Exception:
        return {}


def set_flight_detail_query(flight_id: int) -> None:
    try:
        st.query_params["flight_id"] = str(flight_id)
    except Exception:
        pass


def clear_flight_detail_query() -> None:
    try:
        st.query_params.pop("flight_id", None)
    except Exception:
        pass


def summarize(df: pd.DataFrame) -> dict[str, Any]:
    if df.empty:
        return {"block": 0, "air": 0, "pic": 0, "dual": 0, "safety": 0, "starts": 0, "cost": 0, "count": 0}
    block = int(df["block_min"].sum())
    air = int(df["air_min"].sum())
    role = df["role"].fillna("").str.upper()
    pic = int(df.loc[role.eq("PIC"), "block_min"].sum())
    dual = int(df.loc[role.eq("DUAL"), "block_min"].sum())
    safety = int(df.loc[role.eq("SAFETY PILOT"), "block_min"].sum())
    return {
        "block": block,
        "air": air,
        "pic": pic,
        "dual": dual,
        "safety": safety,
        "starts": int(df["starts"].fillna(0).sum()),
        "cost": float(df["cost"].sum()),
        "count": int(len(df)),
    }


# -----------------------------------------------------------------------------
# Data loading
# -----------------------------------------------------------------------------

@st.cache_data(ttl=120, show_spinner=False)
def load_flights() -> pd.DataFrame:
    with connect() as con:
        initialize_database(con)
        df = pd.read_sql_query("SELECT * FROM flights ORDER BY date, COALESCE(off_block, takeoff, '00:00'), id", con)
    if df.empty:
        return df
    df["date"] = pd.to_datetime(df["date"], errors="coerce")
    for col in ["off_block", "takeoff", "landing", "on_block"]:
        df[col] = df[col].fillna("").astype(str)
    df["block_min"] = df.apply(lambda r: calc_duration_minutes(parse_time(r["off_block"]), parse_time(r["on_block"])), axis=1)
    df["air_min"] = df.apply(lambda r: calc_duration_minutes(parse_time(r["takeoff"]), parse_time(r["landing"])), axis=1)
    df["price_per_hour"] = pd.to_numeric(df["price_per_hour"], errors="coerce").fillna(0)
    df["cost"] = df["block_min"] / 60 * df["price_per_hour"]
    df["year"] = df["date"].dt.year
    return df

@st.cache_data(ttl=120, show_spinner=False)
def load_tracks_summary() -> pd.DataFrame:
    with connect() as con:
        initialize_database(con)
        return pd.read_sql_query(
            """
            SELECT t.*, f.date, f.registration, f.departure, f.arrival, f.role, f.evidence
            FROM flight_tracks t JOIN flights f ON f.id = t.flight_id
            ORDER BY f.date, t.id
            """,
            con,
        )


def get_flight(flight_id: int) -> sqlite3.Row | None:
    with connect() as con:
        initialize_database(con)
        return con.execute("SELECT * FROM flights WHERE id = ?", (flight_id,)).fetchone()


def get_track(track_id: int) -> sqlite3.Row | None:
    with connect() as con:
        initialize_database(con)
        return con.execute("SELECT * FROM flight_tracks WHERE id = ?", (track_id,)).fetchone()


def get_track_points(track_id: int) -> pd.DataFrame:
    with connect() as con:
        initialize_database(con)
        return pd.read_sql_query("SELECT * FROM track_points WHERE track_id = ? ORDER BY seq", con, params=(track_id,))


def get_flight_tracks(flight_id: int) -> pd.DataFrame:
    with connect() as con:
        initialize_database(con)
        return pd.read_sql_query("SELECT * FROM flight_tracks WHERE flight_id = ? ORDER BY id", con, params=(flight_id,))


def load_aircraft() -> pd.DataFrame:
    with connect() as con:
        initialize_database(con)
        return pd.read_sql_query("SELECT * FROM aircraft ORDER BY registration", con)


def get_rate_for_registration(con: sqlite3.Connection, registration: str, flight_date: str | date | None) -> float | None:
    if not registration:
        return None
    d = str(flight_date)[:10] if flight_date else "9999-12-31"
    row = con.execute("""
        SELECT price_per_hour FROM rates
        WHERE registration = ? AND (valid_from IS NULL OR valid_from <= ?)
        ORDER BY valid_from DESC LIMIT 1
    """, (registration, d)).fetchone()
    if row and row[0] is not None:
        return float(row[0])
    row = con.execute("SELECT default_price_per_hour FROM aircraft WHERE registration = ?", (registration,)).fetchone()
    if row and row[0] is not None:
        return float(row[0])
    return None


# -----------------------------------------------------------------------------
# Airports
# -----------------------------------------------------------------------------

def normalize_ident(value: Any) -> str:
    return (str(value or "").strip().upper())


def _airport_row_from_conn(con: sqlite3.Connection, ident: str) -> dict[str, Any] | None:
    ident = normalize_ident(ident)
    if not ident:
        return None
    row = con.execute("SELECT * FROM airports WHERE UPPER(ident)=? OR UPPER(gps_code)=? OR UPPER(iata_code)=? OR UPPER(local_code)=? LIMIT 1", (ident, ident, ident, ident)).fetchone()
    return dict(row) if row else None


def get_airport(ident: str) -> dict[str, Any] | None:
    ident = normalize_ident(ident)
    if not ident:
        return None
    # Manual/user airports in the live logbook database take precedence.
    try:
        with connect() as con:
            initialize_database(con)
            row = _airport_row_from_conn(con, ident)
            if row:
                return row
    except Exception:
        pass
    # Large fixed world airport database is separate from the live logbook DB.
    try:
        if AIRPORTS_DB_PATH.exists():
            with sqlite3.connect(AIRPORTS_DB_PATH) as con:
                con.row_factory = sqlite3.Row
                row = _airport_row_from_conn(con, ident)
                if row:
                    return row
    except Exception:
        pass
    return None


def find_nearest_airport(lat: float, lon: float, max_km: float = 8.0) -> tuple[dict[str, Any] | None, float | None]:
    candidates: list[dict[str, Any]] = []
    try:
        with connect() as con:
            initialize_database(con)
            rows = con.execute("SELECT * FROM airports WHERE latitude_deg IS NOT NULL AND longitude_deg IS NOT NULL AND active = 1 AND closed = 0").fetchall()
            candidates.extend(dict(r) for r in rows)
    except Exception:
        pass
    try:
        if AIRPORTS_DB_PATH.exists():
            with sqlite3.connect(AIRPORTS_DB_PATH) as con:
                con.row_factory = sqlite3.Row
                rows = con.execute("SELECT * FROM airports WHERE latitude_deg IS NOT NULL AND longitude_deg IS NOT NULL AND active = 1 AND closed = 0").fetchall()
                candidates.extend(dict(r) for r in rows)
    except Exception:
        pass
    best = None
    best_d = None
    seen: set[str] = set()
    for r in candidates:
        ident = normalize_ident(r.get("ident"))
        if ident in seen:
            continue
        seen.add(ident)
        d = haversine_km(lat, lon, float(r["latitude_deg"]), float(r["longitude_deg"]))
        if best_d is None or d < best_d:
            best, best_d = r, d
    if best_d is not None and best_d <= max_km:
        return best, best_d
    return None, best_d


def airport_label(ident: str) -> str:
    ap = get_airport(ident)
    if not ap:
        return ident or "—"
    name = ap.get("name") or ident
    return f"{ident} · {name}"


def load_airports_df(limit: int | None = None, search: str = "") -> pd.DataFrame:
    """Load merged manual + fixed airports. Manual entries override fixed rows."""
    search_norm = (search or "").strip().upper()
    rows: list[dict[str, Any]] = []
    def add_rows_from_query(con: sqlite3.Connection, fixed: bool) -> None:
        if search_norm:
            like = f"%{search_norm}%"
            q = """
                SELECT * FROM airports
                WHERE UPPER(COALESCE(ident,'')) LIKE ? OR UPPER(COALESCE(name,'')) LIKE ? OR UPPER(COALESCE(municipality,'')) LIKE ? OR UPPER(COALESCE(gps_code,'')) LIKE ? OR UPPER(COALESCE(iata_code,'')) LIKE ? OR UPPER(COALESCE(local_code,'')) LIKE ?
                ORDER BY ident
            """
            params = (like, like, like, like, like, like)
        else:
            q = "SELECT * FROM airports ORDER BY ident"
            params = ()
        if limit:
            q += f" LIMIT {int(limit)}"
        for r in con.execute(q, params).fetchall():
            d = dict(r)
            d["fixed_database"] = fixed
            rows.append(d)
    try:
        if AIRPORTS_DB_PATH.exists():
            with sqlite3.connect(AIRPORTS_DB_PATH) as con:
                con.row_factory = sqlite3.Row
                add_rows_from_query(con, True)
    except Exception:
        pass
    try:
        with connect() as con:
            initialize_database(con)
            add_rows_from_query(con, False)
    except Exception:
        pass
    merged: dict[str, dict[str, Any]] = {}
    for r in rows:
        ident = normalize_ident(r.get("ident"))
        if not ident:
            continue
        if ident not in merged or not r.get("fixed_database"):
            merged[ident] = r
    df = pd.DataFrame(list(merged.values()))
    if not df.empty:
        df = df.sort_values("ident")
    return df


def airports_count() -> int:
    try:
        return len(load_airports_df())
    except Exception:
        return 0


# -----------------------------------------------------------------------------
# KML/GPS parsing
# -----------------------------------------------------------------------------

def parse_iso_datetime(text: str | None) -> datetime | None:
    if not text:
        return None
    s = text.strip()
    try:
        if s.endswith("Z"):
            s = s[:-1] + "+00:00"
        dt = datetime.fromisoformat(s)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc)
    except Exception:
        return None


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 6371.0088
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlambda / 2) ** 2
    return 2 * r * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def parse_coord_text(text: str) -> list[tuple[float, float, float | None]]:
    points = []
    if not text:
        return points
    for token in re.split(r"\s+", text.strip()):
        if not token or "," not in token:
            continue
        parts = token.split(",")
        if len(parts) < 2:
            continue
        try:
            lon = float(parts[0])
            lat = float(parts[1])
            alt = float(parts[2]) if len(parts) > 2 and parts[2] != "" else None
            points.append((lat, lon, alt))
        except ValueError:
            continue
    return points


def _point_signature(p: dict[str, Any]) -> tuple:
    t = p.get("time")
    return (
        round(float(p.get("lat") or 0), 7),
        round(float(p.get("lon") or 0), 7),
        round(float(p.get("alt_m") or 0), 1) if p.get("alt_m") is not None else None,
        t.isoformat() if isinstance(t, datetime) else None,
    )


def parse_kml_points(file_bytes: bytes) -> list[dict[str, Any]]:
    """Parse ADSBExchange and Flightradar24 KML exports.

    ADSBExchange often exports a single LineString with coordinates.
    Flightradar24 mobile/web KML may contain each real GPS position as a timed
    Point and additionally visual route segments named P-1, P-2, ... . Mixing
    both creates a false line from the last point back to the first segment. For
    FR24 we therefore prefer timed Point placemarks and ignore visual segments.
    """
    root = ET.fromstring(file_bytes)
    ns = {"kml": "http://www.opengis.net/kml/2.2", "gx": "http://www.google.com/kml/ext/2.2"}
    points: list[dict[str, Any]] = []

    # 1) Timed Point placemarks. This is the cleanest source for FR24 exports.
    timed_points: list[dict[str, Any]] = []
    for pm in root.findall(".//kml:Placemark", ns):
        name = (pm.findtext("kml:name", default="", namespaces=ns) or "").strip()
        # FR24 visual segments are usually named P-1, P-2... and are LineStrings.
        if re.fullmatch(r"P-?\d+", name or "", flags=re.IGNORECASE):
            continue
        coord_el = pm.find(".//kml:Point/kml:coordinates", ns)
        if coord_el is None or not (coord_el.text or "").strip():
            continue
        coord_points = parse_coord_text(coord_el.text or "")
        if not coord_points:
            continue
        time_text = pm.findtext(".//kml:TimeStamp/kml:when", default=None, namespaces=ns) or pm.findtext(".//kml:TimeSpan/kml:begin", default=None, namespaces=ns)
        when = parse_iso_datetime(time_text)
        desc = " ".join((pm.findtext("kml:description", default="", namespaces=ns) or "").split())
        ext = {d.findtext("kml:name", default="", namespaces=ns): d.findtext("kml:value", default="", namespaces=ns) for d in pm.findall(".//kml:Data", ns)}
        lat, lon, alt = coord_points[0]
        speed_kmh = _float_or_none(ext.get("speed_kmh") or ext.get("Speed") or ext.get("speed"))
        # Some FR24 descriptions contain speed/altitude labels; keep this as a soft fallback.
        if speed_kmh is None:
            m = re.search(r"(\d+(?:\.\d+)?)\s*(?:km/h|kph)", desc, flags=re.I)
            if m:
                speed_kmh = float(m.group(1))
        timed_points.append({"lat": lat, "lon": lon, "alt_m": alt, "time": when, "speed_kmh": speed_kmh, "source": "point"})
    if timed_points:
        # Prefer chronological order when possible. If no timestamps are present,
        # the KML document order is usually already correct.
        if any(p.get("time") for p in timed_points):
            timed_points.sort(key=lambda p: p.get("time") or datetime.min.replace(tzinfo=timezone.utc))
        deduped: list[dict[str, Any]] = []
        seen: set[tuple] = set()
        for p in timed_points:
            sig = _point_signature(p)
            if sig in seen:
                continue
            seen.add(sig)
            deduped.append(p)
        return deduped

    # 2) gx:Track, when/coord pairs.
    for trk in root.findall(".//gx:Track", ns):
        whens = [parse_iso_datetime(e.text) for e in trk.findall("gx:when", ns)]
        coords = []
        for e in trk.findall("gx:coord", ns):
            parts = (e.text or "").strip().split()
            if len(parts) >= 2:
                try:
                    lon, lat = float(parts[0]), float(parts[1])
                    alt = float(parts[2]) if len(parts) >= 3 else None
                    coords.append((lat, lon, alt))
                except ValueError:
                    pass
        for i, c in enumerate(coords):
            points.append({"lat": c[0], "lon": c[1], "alt_m": c[2], "time": whens[i] if i < len(whens) else None, "speed_kmh": None, "source": "gx_track"})
    if points:
        return points

    # 3) Plain LineString coordinates. For FR24, skip P-* visual segment names.
    line_points: list[dict[str, Any]] = []
    for pm in root.findall(".//kml:Placemark", ns):
        name = (pm.findtext("kml:name", default="", namespaces=ns) or "").strip()
        if re.fullmatch(r"P-?\d+", name or "", flags=re.IGNORECASE):
            continue
        for coord_el in pm.findall(".//kml:LineString/kml:coordinates", ns):
            for lat, lon, alt in parse_coord_text(coord_el.text or ""):
                line_points.append({"lat": lat, "lon": lon, "alt_m": alt, "time": None, "speed_kmh": None, "source": "line"})
    if line_points:
        return line_points

    # 4) Last resort: all coordinate blocks, but still avoid exact duplicates.
    for coord_el in root.findall(".//kml:coordinates", ns):
        for lat, lon, alt in parse_coord_text(coord_el.text or ""):
            points.append({"lat": lat, "lon": lon, "alt_m": alt, "time": None, "speed_kmh": None, "source": "coord"})
    deduped = []
    seen = set()
    for p in points:
        sig = _point_signature(p)
        if sig not in seen:
            seen.add(sig)
            deduped.append(p)
    return deduped


def compute_track_metrics(points: list[dict[str, Any]]) -> dict[str, Any]:
    if len(points) < 2:
        return {"distance_km": 0, "min_alt_m": None, "max_alt_m": None, "start_utc": None, "end_utc": None, "points": points}
    total = 0.0
    last_time = None
    for i, p in enumerate(points):
        if i == 0:
            p["segment_km"] = 0.0
            p["distance_km"] = 0.0
            p["speed_kmh_calc"] = p.get("speed_kmh")
        else:
            prev = points[i - 1]
            seg = haversine_km(prev["lat"], prev["lon"], p["lat"], p["lon"])
            total += seg
            p["segment_km"] = seg
            p["distance_km"] = total
            speed = p.get("speed_kmh")
            if speed is None and isinstance(prev.get("time"), datetime) and isinstance(p.get("time"), datetime):
                dt_h = (p["time"] - prev["time"]).total_seconds() / 3600
                if dt_h > 0:
                    speed = seg / dt_h
            p["speed_kmh_calc"] = speed
        if isinstance(p.get("time"), datetime):
            last_time = p["time"]
    alts = [p["alt_m"] for p in points if p.get("alt_m") is not None]
    times = [p["time"] for p in points if isinstance(p.get("time"), datetime)]
    return {
        "distance_km": total,
        "min_alt_m": min(alts) if alts else None,
        "max_alt_m": max(alts) if alts else None,
        "start_utc": min(times).isoformat() if times else None,
        "end_utc": max(times).isoformat() if times else None,
        "points": points,
    }


def detect_takeoff_landing(points: list[dict[str, Any]]) -> dict[str, Any]:
    if not points:
        return {}
    speeds = [p.get("speed_kmh_calc") or p.get("speed_kmh") for p in points]
    has_speed = any(v is not None for v in speeds)
    takeoff_idx = None
    landing_idx = None
    reason = ""
    if has_speed:
        airborne = [(v or 0) >= 55 for v in speeds]
        for i in range(len(airborne)):
            if airborne[i] and any(airborne[i : min(i + 4, len(airborne))]):
                takeoff_idx = i
                break
        for i in range(len(airborne) - 1, -1, -1):
            if airborne[i] and any(airborne[max(0, i - 3) : i + 1]):
                landing_idx = i
                break
        reason = "speed >= 55 km/h"
    else:
        alts = [p.get("alt_m") for p in points if p.get("alt_m") is not None]
        if alts:
            base = min(alts)
            high = [(p.get("alt_m") or base) - base >= 35 for p in points]
            for i, v in enumerate(high):
                if v:
                    takeoff_idx = i
                    break
            for i in range(len(high) - 1, -1, -1):
                if high[i]:
                    landing_idx = i
                    break
            reason = "altitude above start/min + 35 m"
    if takeoff_idx is None:
        takeoff_idx = 0
    if landing_idx is None:
        landing_idx = len(points) - 1
    return {
        "takeoff_point": points[takeoff_idx],
        "landing_point": points[landing_idx],
        "takeoff_idx": takeoff_idx,
        "landing_idx": landing_idx,
        "reason": reason or "fallback first/last point",
    }


def upload_track_for_flight(con: sqlite3.Connection, flight_id: int, file_name: str, file_bytes: bytes) -> int:
    points = parse_kml_points(file_bytes)
    if len(points) < 2:
        raise ValueError("Soubor neobsahuje dostatek GPS bodů.")
    metrics = compute_track_metrics(points)
    coords_json = json.dumps([[p["lat"], p["lon"], p.get("alt_m"), p.get("time").isoformat() if isinstance(p.get("time"), datetime) else None] for p in metrics["points"]])
    cur = con.execute("""
        INSERT INTO flight_tracks
        (flight_id, file_name, imported_at, point_count, distance_km, start_utc, end_utc, min_alt_m, max_alt_m, coordinates_json)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (flight_id, file_name, _now_iso(), len(points), metrics["distance_km"], metrics["start_utc"], metrics["end_utc"], metrics["min_alt_m"], metrics["max_alt_m"], coords_json))
    track_id = int(cur.lastrowid)
    for seq, p in enumerate(metrics["points"]):
        speed_kmh = p.get("speed_kmh_calc")
        speed_kt = speed_kmh / 1.852 if speed_kmh is not None else None
        con.execute("""
            INSERT INTO track_points
            (track_id, seq, time_utc, latitude_deg, longitude_deg, altitude_m, segment_km, distance_km, speed_kmh, speed_kt, source)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (track_id, seq, p.get("time").isoformat() if isinstance(p.get("time"), datetime) else None, p["lat"], p["lon"], p.get("alt_m"), p.get("segment_km"), p.get("distance_km"), speed_kmh, speed_kt, p.get("source")))
    record_audit(con, "upload_track", "flight", flight_id, {"track_id": track_id, "file_name": file_name, "points": len(points), "distance_km": metrics["distance_km"]})
    return track_id


# -----------------------------------------------------------------------------
# Map helpers
# -----------------------------------------------------------------------------

def build_folium_map(points_df: pd.DataFrame | None = None, airports: list[str] | None = None, height: int = 520, extra_lines: list[dict[str, Any]] | None = None, draw_track: bool = True) -> folium.Map:
    coords = []
    if points_df is not None and not points_df.empty:
        coords = [(float(r.latitude_deg), float(r.longitude_deg)) for r in points_df.itertuples()]
    airport_coords = []
    for ident in airports or []:
        ap = get_airport(ident)
        if ap and ap.get("latitude_deg") is not None and ap.get("longitude_deg") is not None:
            airport_coords.append((float(ap["latitude_deg"]), float(ap["longitude_deg"]), ident, ap))
    all_coords = coords + [(a[0], a[1]) for a in airport_coords]
    center = all_coords[0] if all_coords else (49.8, 15.5)
    m = folium.Map(location=center, zoom_start=7, tiles="CartoDB dark_matter", control_scale=True)
    if draw_track and coords:
        folium.PolyLine(coords, color="#38bdf8", weight=3, opacity=0.82, tooltip="GPS track").add_to(m)
        folium.CircleMarker(coords[0], radius=5, color="#22c55e", fill=True, fill_opacity=1, tooltip="Start GPS").add_to(m)
        folium.CircleMarker(coords[-1], radius=5, color="#ef4444", fill=True, fill_opacity=1, tooltip="Konec GPS").add_to(m)
    # Visual extrapolation from declared airports to first/last real GPS point.
    if coords and airport_coords:
        dep = airport_coords[0] if len(airport_coords) >= 1 else None
        arr = airport_coords[1] if len(airport_coords) >= 2 else None
        if dep:
            d0 = haversine_km(dep[0], dep[1], coords[0][0], coords[0][1])
            if d0 > 0.25:
                folium.PolyLine([(dep[0], dep[1]), coords[0]], color="#94a3b8", weight=2, opacity=0.68, dash_array="7,7", tooltip=f"Dopočtená spojka {dep[2]} → první GPS bod ({d0:.1f} km)").add_to(m)
        if arr:
            d1 = haversine_km(coords[-1][0], coords[-1][1], arr[0], arr[1])
            if d1 > 0.25:
                folium.PolyLine([coords[-1], (arr[0], arr[1])], color="#94a3b8", weight=2, opacity=0.68, dash_array="7,7", tooltip=f"Dopočtená spojka poslední GPS bod → {arr[2]} ({d1:.1f} km)").add_to(m)
    for line in extra_lines or []:
        folium.PolyLine(line.get("coords", []), color=line.get("color", "#f59e0b"), weight=line.get("weight", 2), opacity=line.get("opacity", 0.8), dash_array=line.get("dash_array"), tooltip=line.get("tooltip")).add_to(m)
    for lat, lon, ident, ap in airport_coords:
        popup = folium.Popup(f"<b>{ident}</b><br>{ap.get('name','')}", max_width=260)
        folium.Marker((lat, lon), popup=popup, tooltip=ident, icon=folium.Icon(color="blue", icon="plane", prefix="fa")).add_to(m)
    if all_coords:
        m.fit_bounds(all_coords, padding=(30, 30))
    return m


def folium_static_fast(m: folium.Map, height: int = 560) -> None:
    html = m.get_root().render()
    components.html(html, height=height, scrolling=False)


def route_overview_map(df: pd.DataFrame, height: int = 620) -> folium.Map:
    m = folium.Map(location=(49.8, 15.5), zoom_start=6, tiles="CartoDB dark_matter", control_scale=True)
    airport_visits: dict[str, dict[str, Any]] = {}
    route_counts: dict[tuple[str, str], int] = {}
    bounds: list[tuple[float, float]] = []

    for r in df.sort_values("date").itertuples():
        dep = normalize_ident(getattr(r, "departure", ""))
        arr = normalize_ident(getattr(r, "arrival", ""))
        dep_ap = get_airport(dep)
        arr_ap = get_airport(arr)
        if not dep_ap or not arr_ap:
            continue
        if dep_ap.get("latitude_deg") is None or arr_ap.get("latitude_deg") is None:
            continue
        dep_coord = (float(dep_ap["latitude_deg"]), float(dep_ap["longitude_deg"]))
        arr_coord = (float(arr_ap["latitude_deg"]), float(arr_ap["longitude_deg"]))
        if dep == arr:
            continue
        route_counts[(dep, arr)] = route_counts.get((dep, arr), 0) + 1
        date_text = getattr(r, "date").strftime("%Y-%m-%d") if hasattr(getattr(r, "date"), "strftime") else safe_text(getattr(r, "date", ""))
        html = f"""
        <div style='font-family:Inter,Segoe UI,sans-serif;min-width:210px'>
          <b>{dep} → {arr}</b><br>
          {date_text} · {safe_text(getattr(r, 'registration', ''))}<br>
          {safe_text(getattr(r, 'role', ''))} · {minutes_to_hhmm(int(getattr(r, 'block_min', 0) or 0))}<br>
          <a href='?flight_id={int(getattr(r, 'id'))}' target='_top' rel='noopener'>Otevřít detail letu</a>
        </div>
        """
        color = "#38bdf8" if safe_text(getattr(r, "evidence", "")).upper() == "ULL" else "#f59e0b"
        folium.PolyLine([dep_coord, arr_coord], color=color, weight=2, opacity=0.42, tooltip=f"{dep} → {arr}", popup=folium.Popup(html, max_width=280)).add_to(m)
        bounds.extend([dep_coord, arr_coord])
        for ident, ap, coord in [(dep, dep_ap, dep_coord), (arr, arr_ap, arr_coord)]:
            if ident not in airport_visits:
                airport_visits[ident] = {"airport": ap, "coord": coord, "count": 0}
            airport_visits[ident]["count"] += 1

    for ident, info in airport_visits.items():
        ap = info["airport"]
        count = info["count"]
        popup = folium.Popup(f"<b>{ident}</b><br>{ap.get('name','')}<br>Návštěvy: {count}", max_width=260)
        folium.CircleMarker(info["coord"], radius=min(4 + count * 0.45, 12), color="#22c55e", fill=True, fill_opacity=0.72, popup=popup, tooltip=f"{ident} · {count}×").add_to(m)
    if bounds:
        m.fit_bounds(bounds, padding=(35, 35))
    return m


def track_profile_chart(points: pd.DataFrame) -> go.Figure | None:
    if points.empty:
        return None
    df = points.copy()
    if "distance_km" not in df or df["distance_km"].isna().all():
        return None
    fig = go.Figure()
    if "altitude_m" in df and not df["altitude_m"].isna().all():
        fig.add_trace(go.Scatter(x=df["distance_km"], y=df["altitude_m"], name="Výška MSL", mode="lines", line=dict(width=3), yaxis="y1"))
    if "speed_kt" in df and not df["speed_kt"].isna().all():
        fig.add_trace(go.Scatter(x=df["distance_km"], y=df["speed_kt"], name="GPS rychlost", mode="lines", line=dict(width=2, dash="dot"), yaxis="y2"))
    if not fig.data:
        return None
    fig.update_layout(
        height=340,
        margin=dict(l=10, r=10, t=28, b=10),
        template="plotly_dark",
        xaxis_title="km",
        yaxis=dict(title="m", side="left"),
        yaxis2=dict(title="kt", overlaying="y", side="right", showgrid=False),
        legend=dict(orientation="h", yanchor="bottom", y=1.02, xanchor="right", x=1),
    )
    return fig


# -----------------------------------------------------------------------------
# UI helpers
# -----------------------------------------------------------------------------

def metric_card(label: str, value: str, sub: str = "") -> None:
    st.markdown(f"""
    <div class="metric-card">
      <div class="metric-label">{label}</div>
      <div class="metric-value">{value}</div>
      <div class="metric-sub">{sub}</div>
    </div>
    """, unsafe_allow_html=True)


def app_header(title: str = "Letový zápisník", subtitle: str = "Lokální pilotní evidence • ULL / EASA • náklady • GPS tracky") -> None:
    st.markdown(f"""
    <div class="app-title">
      <div><div class="app-title-main">{title}</div><div class="app-title-sub">{subtitle}</div></div>
      <div class="app-badge">{APP_VERSION}</div>
    </div>
    """, unsafe_allow_html=True)


def install_sidebar_toggle() -> None:
    components.html(
        """
        <button id="lb-sidebar-toggle" title="Skrýt/zobrazit menu">‹</button>
        <script>
        const doc = window.parent.document;
        const btn = doc.getElementById('lb-sidebar-toggle') || document.getElementById('lb-sidebar-toggle');
        function syncIcon(){ const hidden = doc.body.classList.contains('lb-sidebar-hidden'); btn.textContent = hidden ? '›' : '‹'; }
        if (btn && !btn.dataset.bound) {
          btn.dataset.bound = '1';
          btn.addEventListener('click', () => { doc.body.classList.toggle('lb-sidebar-hidden'); syncIcon(); });
          syncIcon();
        }
        </script>
        """,
        height=0,
        width=0,
    )


def apply_ui_theme(dark_mode: bool) -> None:
    if dark_mode:
        bg = "#06101d"; panel = "#0b182a"; panel2 = "#10233a"; text = "#e6f0fb"; muted = "#92a8c0"; border = "rgba(125,211,252,.18)"; accent = "#38bdf8"; good = "#22c55e"; warn = "#f59e0b"; shadow = "rgba(0,0,0,.40)"
    else:
        bg = "#f5f8fc"; panel = "#ffffff"; panel2 = "#eaf3ff"; text = "#0f172a"; muted = "#475569"; border = "rgba(15,23,42,.12)"; accent = "#0284c7"; good = "#16a34a"; warn = "#d97706"; shadow = "rgba(15,23,42,.10)"
    sidebar_css = """
    :root {--lb-sidebar-width:16.4rem;}
    section[data-testid="stSidebar"], [data-testid="stSidebar"] {
        display:block !important; visibility:visible !important; opacity:1 !important;
        width:var(--lb-sidebar-width) !important; min-width:var(--lb-sidebar-width) !important; max-width:var(--lb-sidebar-width) !important;
        transform:translateX(0) !important; margin-left:0 !important;
        transition:margin-left 320ms cubic-bezier(.22,.61,.36,1), opacity 220ms ease !important;
        will-change:margin-left; z-index:1000 !important;
    }
    [data-testid="stSidebarContent"] {display:block !important; visibility:visible !important; opacity:1 !important;}
    body.lb-sidebar-hidden section[data-testid="stSidebar"],
    body.lb-sidebar-hidden [data-testid="stSidebar"] {
        margin-left:calc(-1 * var(--lb-sidebar-width)) !important;
    }
    [data-testid="stAppViewContainer"] > .main {transition:margin-left 320ms cubic-bezier(.22,.61,.36,1) !important;}
    [data-testid="stAppViewContainer"] .main .block-container {max-width:1500px !important;}
    #lb-sidebar-toggle {
        position:fixed; top:5.35rem; left:calc(var(--lb-sidebar-width) - 2.55rem);
        z-index:2147483647; width:1.72rem; height:1.72rem; border-radius:.52rem;
        border:1px solid rgba(148,163,184,.35); background:rgba(15,31,52,.96); color:#dbeafe;
        font-weight:900; font-size:1.05rem; line-height:1; cursor:pointer;
        display:flex; align-items:center; justify-content:center;
        box-shadow:0 8px 22px rgba(0,0,0,.28);
        transition:left 320ms cubic-bezier(.22,.61,.36,1), background 140ms ease, border-color 140ms ease;
    }
    #lb-sidebar-toggle:hover {background:rgba(20,43,72,.99); border-color:rgba(56,189,248,.55);}
    body.lb-sidebar-hidden #lb-sidebar-toggle {left:.32rem;}
    @media (max-width: 760px) {
        #lb-sidebar-toggle {top:4.35rem; left:calc(var(--lb-sidebar-width) - 2.45rem);}
        body.lb-sidebar-hidden #lb-sidebar-toggle {left:.25rem;}
    }
    """
    st.markdown(f"""
    <style>
    :root {{--bg:{bg};--panel:{panel};--panel2:{panel2};--text:{text};--muted:{muted};--border:{border};--accent:{accent};--good:{good};--warn:{warn};--shadow:{shadow};}}
    /* Streamlit chrome: hide the top header completely. Do NOT rely on the
       native collapsed sidebar button; on Streamlit Cloud it is not rendered
       consistently when the header is hidden. Instead we force the sidebar to
       stay visible and accessible. */
    header[data-testid="stHeader"] {{display:block !important; visibility:visible !important; height:0 !important; min-height:0 !important; background:transparent !important; pointer-events:none !important; z-index:999998 !important; overflow:visible !important;}}
    header[data-testid="stHeader"] * {{pointer-events:none !important;}}
    div[data-testid="stToolbar"], div[data-testid="stDecoration"], div[data-testid="stStatusWidget"], #MainMenu, footer {{display:none !important; visibility:hidden !important; height:0 !important;}}
    .stDeployButton {{display:none !important;}}
    [data-testid="stSidebarHeader"], [data-testid="stSidebarCollapseButton"], [data-testid="collapsedControl"], [data-testid="stSidebarCollapsedControl"],
    section[data-testid="stSidebar"] [data-testid="stSidebarHeader"],
    section[data-testid="stSidebar"] [data-testid="stSidebarHeader"] button,
    section[data-testid="stSidebar"] button[kind="headerNoPadding"],
    section[data-testid="stSidebar"] button[data-testid="baseButton-headerNoPadding"],
    button[title*="sidebar" i], button[aria-label*="sidebar" i],
    button[title*="Collapse" i], button[aria-label*="Collapse" i],
    button[title*="Close" i], button[aria-label*="Close" i] {{display:none !important; visibility:hidden !important; pointer-events:none !important; width:0 !important; height:0 !important; padding:0 !important; margin:0 !important;}}
    {sidebar_css}
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

    .performance-note {{border:1px solid rgba(34,197,94,.28);background:linear-gradient(135deg,rgba(34,197,94,.08),rgba(56,189,248,.04));border-radius:16px;padding:.75rem .9rem;color:var(--muted);font-size:.86rem;margin:.35rem 0 .85rem 0;}}
    .flight-detail-hero {{border:1px solid var(--border);border-radius:18px;background:linear-gradient(135deg,rgba(56,189,248,.12),rgba(15,23,42,.02)),var(--panel);padding:1rem 1.1rem;margin:.15rem 0 1rem 0;box-shadow:0 12px 28px var(--shadow);}}
    .flight-detail-route {{font-size:1.35rem;font-weight:900;color:var(--text);line-height:1.15;letter-spacing:-.025em;}}
    .flight-detail-meta {{color:var(--muted);font-size:.86rem;margin-top:.35rem;display:flex;gap:.55rem;flex-wrap:wrap;}}
    .flight-detail-meta span {{border:1px solid var(--border);border-radius:999px;background:rgba(255,255,255,.035);padding:.18rem .50rem;}}
    .map-perf-toolbar {{display:flex;justify-content:space-between;align-items:center;gap:.75rem;border:1px solid var(--border);background:rgba(255,255,255,.025);border-radius:16px;padding:.65rem .80rem;margin:.35rem 0 .75rem 0;color:var(--muted);font-size:.85rem;}}
    .map-perf-toolbar strong {{color:var(--text);}}
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


def nav_button(key: str, label: str) -> None:
    active = st.session_state.get("page", "Dashboard") == key
    if st.sidebar.button(label, key=f"nav_{key}", use_container_width=True, type="primary" if active else "secondary"):
        st.session_state["page"] = key
        st.rerun()


def render_sidebar_nav() -> None:
    st.sidebar.markdown("### Navigace")
    for key, label in NAV_ITEMS:
        nav_button(key, label)


# -----------------------------------------------------------------------------
# Pages
# -----------------------------------------------------------------------------

def apply_filters(df: pd.DataFrame) -> pd.DataFrame:
    with st.expander("Filtry", expanded=False):
        col1, col2, col3, col4 = st.columns(4)
        years = sorted([int(y) for y in df["year"].dropna().unique()]) if not df.empty else []
        with col1:
            selected_years = st.multiselect("Rok", years, default=[])
        with col2:
            regs = sorted(df["registration"].dropna().unique().tolist()) if not df.empty else []
            selected_regs = st.multiselect("Letadlo", regs, default=[])
        with col3:
            selected_evidence = st.multiselect("Evidence", EVIDENCE_OPTIONS, default=[])
        with col4:
            selected_role = st.multiselect("Funkce", ROLE_OPTIONS, default=[])
    out = df.copy()
    if selected_years:
        out = out[out["year"].isin(selected_years)]
    if selected_regs:
        out = out[out["registration"].isin(selected_regs)]
    if selected_evidence:
        out = out[out["evidence"].isin(selected_evidence)]
    if selected_role:
        out = out[out["role"].isin(selected_role)]
    return out


def dashboard(df: pd.DataFrame) -> None:
    app_header()
    st.title("Dashboard")
    fdf = apply_filters(df)
    s = summarize(fdf)
    c1, c2, c3, c4 = st.columns(4)
    with c1: metric_card("Celkový nálet", minutes_to_hhmm(s["block"]), f"{s['count']} letů")
    with c2:
        ull_pic = int(fdf[(fdf["role"].str.upper() == "PIC") & (fdf["evidence"] == "ULL")]["block_min"].sum()) if not fdf.empty else 0
        easa_pic = int(fdf[(fdf["role"].str.upper() == "PIC") & (fdf["evidence"] == "EASA")]["block_min"].sum()) if not fdf.empty else 0
        metric_card("PIC", minutes_to_hhmm(s["pic"]), f"ULL {minutes_to_hhmm(ull_pic)} · EASA {minutes_to_hhmm(easa_pic)}")
    with c3: metric_card("Dual / Safety", f"{minutes_to_hhmm(s['dual'])} / {minutes_to_hhmm(s['safety'])}", f"Starty {s['starts']}")
    with c4:
        tracks = load_tracks_summary()
        gps_km = float(tracks["distance_km"].fillna(0).sum()) if not tracks.empty else 0
        metric_card("Náklady", fmt_money(s["cost"]), f"GPS {len(tracks)} tracků · {gps_km:.0f} km")
    if fdf.empty:
        st.info("Žádná data ve filtru.")
        return
    st.markdown('<div class="performance-note"><b>Tip:</b> grafy dashboardu můžeš vypnout pro rychlejší základní přehled.</div>', unsafe_allow_html=True)
    show_charts = st.toggle("Zobrazit grafy dashboardu", value=True, help="Vypnutí grafů zrychlí stránku při běžném používání.")
    if not show_charts:
        return
    yearly = fdf.groupby(["year", "role"], as_index=False)["block_min"].sum()
    yearly["hours"] = yearly["block_min"] / 60
    fig = px.bar(yearly, x="year", y="hours", color="role", title="Nálet podle roku a funkce")
    fig.update_layout(template="plotly_dark", height=360, margin=dict(l=10, r=10, t=45, b=10))
    st.plotly_chart(fig, use_container_width=True)
    col1, col2 = st.columns(2)
    with col1:
        top = fdf.groupby("registration", as_index=False)["block_min"].sum().sort_values("block_min", ascending=False).head(10)
        top["block_hours"] = top["block_min"] / 60
        fig2 = px.bar(top, x="registration", y="block_hours", title="TOP letadla podle block time")
        fig2.update_layout(template="plotly_dark", height=330, margin=dict(l=10, r=10, t=45, b=10))
        st.plotly_chart(fig2, use_container_width=True)
    with col2:
        ev = fdf.groupby("evidence", as_index=False)["block_min"].sum()
        ev["hours"] = ev["block_min"] / 60
        fig3 = px.pie(ev, names="evidence", values="hours", title="ULL / EASA", hole=.55)
        fig3.update_layout(template="plotly_dark", height=330, margin=dict(l=10, r=10, t=45, b=10))
        st.plotly_chart(fig3, use_container_width=True)


def flight_form(default: dict[str, Any] | None = None, flight_id: int | None = None) -> dict[str, Any] | None:
    default = default or {}
    with st.form(f"flight_form_{flight_id or 'new'}"):
        col1, col2, col3, col4 = st.columns(4)
        with col1:
            f_date = st.date_input("Datum", value=pd.to_datetime(default.get("date", date.today())).date() if default.get("date") else date.today())
            evidence = st.selectbox("Evidence", EVIDENCE_OPTIONS, index=EVIDENCE_OPTIONS.index(default.get("evidence")) if default.get("evidence") in EVIDENCE_OPTIONS else 0)
        with col2:
            registration = st.text_input("Imatrikulace", value=default.get("registration", ""))
            aircraft_type = st.text_input("Typ", value=default.get("aircraft_type", ""))
        with col3:
            aircraft_class = st.selectbox("Třída", CLASS_OPTIONS, index=CLASS_OPTIONS.index(default.get("aircraft_class")) if default.get("aircraft_class") in CLASS_OPTIONS else 0)
            role = st.selectbox("Funkce", ROLE_OPTIONS, index=ROLE_OPTIONS.index(default.get("role")) if default.get("role") in ROLE_OPTIONS else 0)
        with col4:
            starts = st.number_input("Starty", min_value=0, max_value=50, value=int(default.get("starts") or 1))
            price_per_hour = st.number_input("Kč / hod", min_value=0.0, value=float(default.get("price_per_hour") or 0), step=100.0)
        col1, col2, col3, col4 = st.columns(4)
        with col1: departure = st.text_input("Odlet", value=default.get("departure", "")).upper()
        with col2: arrival = st.text_input("Přílet", value=default.get("arrival", "")).upper()
        with col3: off_block = st.text_input("Off block", value=default.get("off_block", ""), placeholder="HH:MM")
        with col4: takeoff = st.text_input("Takeoff", value=default.get("takeoff", ""), placeholder="HH:MM")
        col1, col2, col3, col4 = st.columns(4)
        with col1: landing = st.text_input("Landing", value=default.get("landing", ""), placeholder="HH:MM")
        with col2: on_block = st.text_input("On block", value=default.get("on_block", ""), placeholder="HH:MM")
        with col3: commander = st.text_input("Velitel", value=default.get("commander", ""))
        with col4: instructor = st.text_input("Instruktor / SP", value=default.get("instructor", ""))
        task = st.text_input("Úloha", value=default.get("task", ""))
        note = st.text_area("Poznámka", value=default.get("note", ""), height=80)
        submitted = st.form_submit_button("Uložit", type="primary")
    if not submitted:
        return None
    # Validate airports softly
    warnings = []
    for ident, label in [(departure, "odlet"), (arrival, "přílet")]:
        if ident and not get_airport(ident):
            warnings.append(f"Letiště {label} '{ident}' není v databázi. Lze doplnit v Databázi > Letiště.")
    for tval, label in [(off_block,"off block"),(takeoff,"takeoff"),(landing,"landing"),(on_block,"on block")]:
        if tval and parse_time(tval) is None:
            st.error(f"Čas {label} není ve formátu HH:MM.")
            return None
    for w in warnings:
        st.warning(w)
    return {
        "date": f_date.isoformat(), "evidence": evidence, "registration": registration.strip().upper(), "aircraft_type": aircraft_type.strip(),
        "aircraft_class": aircraft_class, "departure": departure.strip().upper(), "arrival": arrival.strip().upper(), "off_block": off_block.strip(),
        "takeoff": takeoff.strip(), "landing": landing.strip(), "on_block": on_block.strip(), "starts": starts, "commander": commander.strip(),
        "instructor": instructor.strip(), "role": role, "task": task.strip(), "price_per_hour": price_per_hour, "note": note.strip()
    }


def insert_flight(data: dict[str, Any]) -> int:
    with connect() as con:
        initialize_database(con)
        if not data.get("price_per_hour") and data.get("registration"):
            rate = get_rate_for_registration(con, data["registration"], data["date"])
            if rate is not None:
                data["price_per_hour"] = rate
        cur = con.execute("""
            INSERT INTO flights
            (date,evidence,registration,aircraft_type,aircraft_class,departure,arrival,off_block,takeoff,landing,on_block,starts,commander,instructor,role,task,price_per_hour,note)
            VALUES (:date,:evidence,:registration,:aircraft_type,:aircraft_class,:departure,:arrival,:off_block,:takeoff,:landing,:on_block,:starts,:commander,:instructor,:role,:task,:price_per_hour,:note)
        """, data)
        flight_id = int(cur.lastrowid)
        con.execute("""
            INSERT OR IGNORE INTO aircraft
            (registration, aircraft_type, aircraft_class, evidence, default_price_per_hour, active, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, 1, ?, ?)
        """, (data["registration"], data["aircraft_type"], data["aircraft_class"], data["evidence"], data["price_per_hour"], _now_iso(), _now_iso()))
        record_audit(con, "insert_flight", "flight", flight_id, data)
        con.commit()
    invalidate_cached_data()
    auto_backup_after_change("insert flight")
    return flight_id


def update_flight(flight_id: int, data: dict[str, Any]) -> None:
    with connect() as con:
        initialize_database(con)
        data["id"] = flight_id
        con.execute("""
            UPDATE flights SET
            date=:date,evidence=:evidence,registration=:registration,aircraft_type=:aircraft_type,aircraft_class=:aircraft_class,departure=:departure,arrival=:arrival,
            off_block=:off_block,takeoff=:takeoff,landing=:landing,on_block=:on_block,starts=:starts,commander=:commander,instructor=:instructor,role=:role,task=:task,
            price_per_hour=:price_per_hour,note=:note
            WHERE id=:id
        """, data)
        record_audit(con, "update_flight", "flight", flight_id, data)
        con.commit()
    invalidate_cached_data()
    auto_backup_after_change("update flight")


def delete_flight(flight_id: int) -> None:
    with connect() as con:
        initialize_database(con)
        con.execute("DELETE FROM flights WHERE id=?", (flight_id,))
        record_audit(con, "delete_flight", "flight", flight_id, None)
        con.commit()
    invalidate_cached_data()
    auto_backup_after_change("delete flight")


def add_flight_page() -> None:
    app_header()
    st.title("Přidat let")
    mode = st.radio("Způsob zadání", ["Ručně", "Z KML tracku"], horizontal=True)
    defaults: dict[str, Any] = {}
    uploaded = None
    parsed_points = None
    if mode == "Z KML tracku":
        uploaded = st.file_uploader("KML soubor", type=["kml", "xml"])
        if uploaded:
            try:
                parsed_points = parse_kml_points(uploaded.getvalue())
                metrics = compute_track_metrics(parsed_points)
                det = detect_takeoff_landing(metrics["points"])
                take_p = det.get("takeoff_point")
                land_p = det.get("landing_point")
                dep_ap, dep_d = find_nearest_airport(take_p["lat"], take_p["lon"], max_km=12) if take_p else (None, None)
                arr_ap, arr_d = find_nearest_airport(land_p["lat"], land_p["lon"], max_km=12) if land_p else (None, None)
                times = [p["time"] for p in metrics["points"] if isinstance(p.get("time"), datetime)]
                if times:
                    start_local = min(times).astimezone(LOCAL_TZ)
                    end_local = max(times).astimezone(LOCAL_TZ)
                    defaults["date"] = start_local.date().isoformat()
                    defaults["takeoff"] = start_local.strftime("%H:%M")
                    defaults["landing"] = end_local.strftime("%H:%M")
                    defaults["off_block"] = (start_local - timedelta(minutes=5)).strftime("%H:%M")
                    defaults["on_block"] = (end_local + timedelta(minutes=5)).strftime("%H:%M")
                if dep_ap:
                    defaults["departure"] = dep_ap["ident"]
                if arr_ap:
                    defaults["arrival"] = arr_ap["ident"]
                st.success(f"Načteno {len(parsed_points)} bodů, GPS vzdálenost {metrics['distance_km']:.1f} km. Detekce: {det.get('reason')}")
                if dep_ap or arr_ap:
                    st.caption(f"Návrh letišť: {dep_ap['ident'] if dep_ap else '—'} ({dep_d:.1f} km) → {arr_ap['ident'] if arr_ap else '—'} ({arr_d:.1f} km)")
                points_df = pd.DataFrame(metrics["points"])
                if not points_df.empty:
                    points_df = points_df.rename(columns={"lat":"latitude_deg", "lon":"longitude_deg", "alt_m":"altitude_m"})
                    m = build_folium_map(points_df, airports=[defaults.get("departure",""), defaults.get("arrival","")])
                    folium_static_fast(m, height=420)
            except Exception as exc:
                st.error(f"KML nelze načíst: {exc}")
                parsed_points = None
    data = flight_form(defaults)
    if data:
        if require_admin():
            flight_id = insert_flight(data)
            if uploaded and parsed_points:
                with connect() as con:
                    initialize_database(con)
                    upload_track_for_flight(con, flight_id, uploaded.name, uploaded.getvalue())
                    con.commit()
                invalidate_cached_data()
                auto_backup_after_change("upload track")
            st.success(f"Let uložen. ID {flight_id}")
            st.session_state["page"] = "Lety"
            st.rerun()


def flights_page(df: pd.DataFrame) -> None:
    app_header()
    st.title("Lety")
    fdf = apply_filters(df)
    if fdf.empty:
        st.info("Žádné lety.")
        return
    st.markdown('<div class="flight-list-note">Seznam je optimalizovaný pro rychlé procházení. Detail otevře plnou kartu letu.</div>', unsafe_allow_html=True)
    page_size_options = [15, 25, 50, 100, "vše"]
    page_size = st.selectbox("Řádků na stránku", page_size_options, index=1, key="flight_page_size")
    total = len(fdf)
    if page_size == "vše":
        page_count = 1
        page = 1
        view = fdf.sort_values(["date", "off_block", "id"], ascending=[False, False, False]).copy()
    else:
        page_size_int = int(page_size)
        page_count = max(1, math.ceil(total / page_size_int))
        if "flight_page" not in st.session_state or st.session_state["flight_page"] > page_count:
            st.session_state["flight_page"] = page_count
        cprev, cpage, cnext = st.columns([1, 2, 1])
        with cprev:
            if st.button("‹ Novější", disabled=st.session_state["flight_page"] <= 1):
                st.session_state["flight_page"] -= 1
                st.rerun()
        with cpage:
            st.markdown(f'<div class="flight-page-info">Strana {st.session_state["flight_page"]} / {page_count} · {total} letů</div>', unsafe_allow_html=True)
        with cnext:
            if st.button("Starší ›", disabled=st.session_state["flight_page"] >= page_count):
                st.session_state["flight_page"] += 1
                st.rerun()
        page = st.session_state["flight_page"]
        view = fdf.sort_values(["date", "off_block", "id"], ascending=[False, False, False]).iloc[(page - 1) * page_size_int : page * page_size_int].copy()
    cols = st.columns([.75, .72, 1.05, .95, .95, .85, .70, .80, 1.00, .85, 1.05, .72, .72])
    headers = ["Detail", "ID", "Datum", "Ev.", "Letadlo", "Odlet", "Přílet", "Časy", "Block", "Starty", "Funkce", "Cena", "GPS"]
    for c, h in zip(cols, headers):
        c.markdown(f'<div class="flight-list-head">{h}</div>', unsafe_allow_html=True)
    for _, r in view.iterrows():
        cols = st.columns([.75, .72, 1.05, .95, .95, .85, .70, .80, 1.00, .85, 1.05, .72, .72])
        fid = int(r["id"])
        if cols[0].button("Detail", key=f"detail_btn_{fid}"):
            set_flight_detail_query(fid)
            st.session_state["selected_flight_id"] = fid
            st.rerun()
        date_txt = r["date"].strftime("%Y-%m-%d") if pd.notna(r["date"]) else "—"
        cells = [
            fid, date_txt, safe_text(r.get("evidence")), safe_text(r.get("registration")), safe_text(r.get("departure")), safe_text(r.get("arrival")),
            f"{safe_text(r.get('off_block'))}–{safe_text(r.get('on_block'))}", minutes_to_hhmm(r.get("block_min")), int(r.get("starts") or 0), safe_text(r.get("role")), fmt_money(r.get("cost")), "—",
        ]
        sub = ["", "", safe_text(r.get("aircraft_type"), ""), "", "", "", f"Air {safe_text(r.get('takeoff'))}–{safe_text(r.get('landing'))}", f"Air {minutes_to_hhmm(r.get('air_min'))}", "", safe_text(r.get("commander"), ""), f"{float(r.get('price_per_hour') or 0):.0f} Kč/h", ""]
        for c, main, subtxt in zip(cols[1:], cells, sub):
            c.markdown(f'<div class="flight-cell"><div class="flight-cell-main">{short_cell(main, max_len=14)}</div><div class="flight-cell-sub">{short_cell(subtxt, fallback="", max_len=16)}</div></div>', unsafe_allow_html=True)
        st.markdown('<div class="flight-row-sep"></div>', unsafe_allow_html=True)


def render_flight_detail_modal(flight_id: int) -> None:
    flight = get_flight(flight_id)
    if not flight:
        clear_flight_detail_query()
        st.session_state.pop("selected_flight_id", None)
        return
    try:
        dialog = st.dialog(f"Detail letu #{flight_id}", width="large")
    except TypeError:
        dialog = st.dialog(f"Detail letu #{flight_id}")
    @dialog
    def _detail() -> None:
        dep = safe_text(flight["departure"], "—")
        arr = safe_text(flight["arrival"], "—")
        meta = [
            f"ID {flight_id}", safe_text(flight["date"]), safe_text(flight["registration"]), safe_text(flight["aircraft_type"]), safe_text(flight["role"]), safe_text(flight["evidence"]),
        ]
        st.markdown(f"""
        <div class="flight-detail-hero">
            <div class="flight-detail-route">{dep} → {arr}</div>
            <div class="flight-detail-meta">{''.join(f'<span>{m}</span>' for m in meta if m and m != '—')}</div>
        </div>
        """, unsafe_allow_html=True)
        if st.button("Zavřít detail", key=f"close_detail_{flight_id}"):
            clear_flight_detail_query()
            st.session_state.pop("selected_flight_id", None)
            st.rerun()
        tabs = st.tabs(["Přehled", "Editace", "Track", "Smazání"])
        with tabs[0]:
            c1, c2, c3, c4 = st.columns(4)
            with c1: metric_card("Block", minutes_to_hhmm(block_minutes(flight)), f"Air {minutes_to_hhmm(air_minutes(flight))}")
            with c2: metric_card("Časy", f"{safe_text(flight['off_block'])}–{safe_text(flight['on_block'])}", f"Air {safe_text(flight['takeoff'])}–{safe_text(flight['landing'])}")
            with c3: metric_card("Cena", fmt_money(cost_for_row(flight)), f"{float(flight['price_per_hour'] or 0):.0f} Kč/h")
            with c4: metric_card("Starty", str(flight["starts"] or 0), safe_text(flight["task"]))
            st.markdown("### Poznámka")
            st.write(safe_text(flight["note"], "—"))
        with tabs[1]:
            data = flight_form(dict(flight), flight_id=flight_id)
            if data and require_admin():
                update_flight(flight_id, data)
                st.success("Let upraven.")
                st.rerun()
        with tabs[2]:
            tracks = get_flight_tracks(flight_id)
            uploaded = st.file_uploader("Přidat / nahrát KML track", type=["kml", "xml"], key=f"track_upload_{flight_id}")
            if uploaded and st.button("Uložit track", key=f"save_track_{flight_id}"):
                if require_admin():
                    with connect() as con:
                        initialize_database(con)
                        upload_track_for_flight(con, flight_id, uploaded.name, uploaded.getvalue())
                        con.commit()
                    invalidate_cached_data()
                    auto_backup_after_change("upload track")
                    st.success("Track uložen.")
                    st.rerun()
            if tracks.empty:
                st.info("K letu není uložen track.")
            else:
                for tr in tracks.itertuples():
                    st.markdown(f"**Track #{tr.id}** · {tr.file_name} · {tr.point_count} bodů · {tr.distance_km:.1f} km")
                    pts = get_track_points(int(tr.id))
                    m = build_folium_map(pts, airports=[flight["departure"], flight["arrival"]])
                    folium_static_fast(m, height=430)
                    fig = track_profile_chart(pts)
                    if fig:
                        st.plotly_chart(fig, use_container_width=True)
                    if is_admin():
                        if st.button("Smazat tento track", key=f"delete_track_{tr.id}"):
                            with connect() as con:
                                initialize_database(con)
                                con.execute("DELETE FROM flight_tracks WHERE id=?", (int(tr.id),))
                                record_audit(con, "delete_track", "track", int(tr.id), {"flight_id": flight_id})
                                con.commit()
                            invalidate_cached_data()
                            auto_backup_after_change("delete track")
                            st.rerun()
        with tabs[3]:
            st.warning("Smazání letu odstraní i všechny jeho tracky.")
            confirm = st.text_input("Pro smazání napiš ID letu", key=f"delete_confirm_{flight_id}")
            if st.button("Smazat let", type="primary", key=f"delete_flight_{flight_id}"):
                if require_admin() and confirm.strip() == str(flight_id):
                    delete_flight(flight_id)
                    clear_flight_detail_query()
                    st.session_state.pop("selected_flight_id", None)
                    st.success("Let smazán.")
                    st.rerun()
                else:
                    st.error("ID nesouhlasí nebo nejsi přihlášen jako admin.")
    _detail()


def map_page(df: pd.DataFrame) -> None:
    app_header()
    st.title("Mapa letů")
    fdf = apply_filters(df)
    tracks = load_tracks_summary()
    if not fdf.empty:
        fids = set(fdf["id"].astype(int).tolist())
        tracks = tracks[tracks["flight_id"].isin(fids)] if not tracks.empty else tracks
    c1, c2, c3, c4 = st.columns(4)
    with c1: metric_card("Letů ve filtru", str(len(fdf)), "")
    with c2: metric_card("Tracky", str(len(tracks)), "GPS záznamy")
    with c3: metric_card("GPS vzdálenost", f"{float(tracks['distance_km'].fillna(0).sum()) if not tracks.empty else 0:.1f} km", "")
    with c4:
        direct_count = int(((fdf["departure"].fillna("") != "") & (fdf["arrival"].fillna("") != "")).sum()) if not fdf.empty else 0
        metric_card("Direct trasy", str(direct_count), "podle letišť")
    tab_tracks, tab_routes = st.tabs(["GPS tracky", "Orientační mapa letišť"])
    with tab_tracks:
        st.markdown('<div class="map-perf-toolbar"><span><strong>GPS mapa</strong> · přesné tracky ze záznamů</span><span>Tabulka je níže schovaná kvůli rychlosti</span></div>', unsafe_allow_html=True)
        if tracks.empty:
            st.info("Ve filtru nejsou žádné GPS tracky.")
        else:
            m = folium.Map(location=(49.8, 15.5), zoom_start=6, tiles="CartoDB dark_matter", control_scale=True)
            bounds = []
            for tr in tracks.itertuples():
                pts = get_track_points(int(tr.id))
                if pts.empty:
                    continue
                coords = [(float(r.latitude_deg), float(r.longitude_deg)) for r in pts.itertuples()]
                if len(coords) < 2:
                    continue
                folium.PolyLine(coords, color="#38bdf8", weight=2, opacity=0.55, tooltip=f"#{tr.flight_id} {tr.registration} {tr.departure}→{tr.arrival}").add_to(m)
                bounds.extend(coords)
            if bounds:
                m.fit_bounds(bounds, padding=(30, 30))
            folium_static_fast(m, height=640)
            with st.expander("Tabulka GPS tracků", expanded=False):
                st.dataframe(tracks, use_container_width=True, hide_index=True)
    with tab_routes:
        st.caption("Orientační mapa neukazuje přesný GPS track. Zobrazuje navštívená letiště jako body a mezi nimi přímé spojnice jednotlivých letů. Kliknutím na linku v popupu otevřeš detail letu.")
        if fdf.empty:
            st.info("Ve filtru nejsou žádné lety.")
        else:
            m = route_overview_map(fdf)
            folium_static_fast(m, height=640)
            with st.expander("Tabulka direct tras", expanded=False):
                route_rows = fdf[["id", "date", "evidence", "registration", "departure", "arrival", "role", "block_min", "cost"]].copy()
                route_rows["block"] = route_rows["block_min"].apply(minutes_to_hhmm)
                st.dataframe(route_rows.drop(columns=["block_min"]), use_container_width=True, hide_index=True)


def aircraft_rates_page() -> None:
    app_header()
    st.title("Ceník a letadla")
    if not is_admin():
        st.info("Úpravy ceníku jsou dostupné po přihlášení jako admin. Přehled je pouze pro čtení.")
    ac = load_aircraft()
    st.subheader("Letadla")
    st.dataframe(ac, use_container_width=True, hide_index=True)
    with st.expander("Přidat / upravit letadlo"):
        with st.form("aircraft_form"):
            c1, c2, c3, c4 = st.columns(4)
            reg = c1.text_input("Imatrikulace").upper()
            typ = c2.text_input("Typ")
            cls = c3.selectbox("Třída", CLASS_OPTIONS)
            ev = c4.selectbox("Evidence", EVIDENCE_OPTIONS)
            price = st.number_input("Výchozí Kč/h", min_value=0.0, step=100.0)
            note = st.text_area("Poznámka")
            ok = st.form_submit_button("Uložit letadlo")
        if ok and require_admin():
            with connect() as con:
                initialize_database(con)
                con.execute("""
                    INSERT OR REPLACE INTO aircraft
                    (registration, aircraft_type, aircraft_class, evidence, default_price_per_hour, active, note, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, 1, ?, COALESCE((SELECT created_at FROM aircraft WHERE registration=?), ?), ?)
                """, (reg, typ, cls, ev, price, note, reg, _now_iso(), _now_iso()))
                record_audit(con, "upsert_aircraft", "aircraft", reg, {"type": typ, "price": price})
                con.commit()
            invalidate_cached_data()
            auto_backup_after_change("upsert aircraft")
            st.rerun()
    st.subheader("Ceníkové sazby")
    with connect() as con:
        initialize_database(con)
        rates = pd.read_sql_query("SELECT * FROM rates ORDER BY registration, valid_from DESC", con)
    st.dataframe(rates, use_container_width=True, hide_index=True)
    with st.expander("Přidat sazbu"):
        with st.form("rate_form"):
            c1, c2, c3 = st.columns(3)
            reg = c1.text_input("Imatrikulace", key="rate_reg").upper()
            valid = c2.date_input("Platí od", value=date.today())
            price = c3.number_input("Kč/h", min_value=0.0, step=100.0, key="rate_price")
            source = st.text_input("Zdroj / poznámka")
            ok = st.form_submit_button("Uložit sazbu")
        if ok and require_admin():
            with connect() as con:
                initialize_database(con)
                con.execute("INSERT OR REPLACE INTO rates (registration, valid_from, price_per_hour, source) VALUES (?, ?, ?, ?)", (reg, valid.isoformat(), price, source))
                record_audit(con, "upsert_rate", "rate", reg, {"valid_from": valid.isoformat(), "price": price})
                con.commit()
            invalidate_cached_data()
            auto_backup_after_change("upsert rate")
            st.rerun()


def database_page() -> None:
    app_header()
    st.title("Databáze")
    tab_backup, tab_airports, tab_audit = st.tabs(["Záloha", "Letiště", "Audit"])
    with tab_backup:
        state = get_backup_state()
        c1, c2, c3 = st.columns(3)
        c1.metric("GitHub záloha", "nastavena" if github_backup_configured() else "není nastavena")
        c2.metric("Dirty", state.get("dirty") or "—")
        c3.metric("Poslední záloha", state.get("last_github_backup_at") or "—")
        if state.get("last_github_backup_error"):
            st.error(state.get("last_github_backup_error"))
        if st.button("Zálohovat databázi na GitHub", disabled=not github_backup_configured()):
            if require_admin():
                try:
                    url = backup_database_to_github()
                    st.success("Záloha hotová.")
                    if url:
                        st.write(url)
                except Exception as exc:
                    st.error(str(exc))
        uploaded = st.file_uploader("Obnovit SQLite databázi", type=["sqlite", "db"])
        if uploaded and st.button("Obnovit z uploadu"):
            if require_admin():
                try:
                    restore_database_from_upload(uploaded)
                    auto_backup_after_change("restore database")
                    st.success("Databáze obnovena.")
                    st.rerun()
                except Exception as exc:
                    st.error(str(exc))
    with tab_airports:
        st.subheader("Letiště")
        st.caption(f"Celkem záznamů v databázi letišť: {airports_count():,}".replace(",", " "))
        q = st.text_input("Hledat letiště", placeholder="LKLT, Sazená, Praha...")
        limit = st.selectbox("Limit zobrazení", [100, 500, 2000, None], format_func=lambda x: "vše" if x is None else str(x))
        st.dataframe(load_airports_df(limit=limit, search=q), use_container_width=True, hide_index=True)
        st.download_button("Export letišť CSV", load_airports_df(search=q).to_csv(index=False).encode("utf-8-sig"), "airports_export.csv", "text/csv")
        with st.expander("Ručně doplnit letiště / plochu"):
            with st.form("manual_airport"):
                c1, c2, c3 = st.columns(3)
                ident = c1.text_input("Ident").upper()
                name = c2.text_input("Název")
                municipality = c3.text_input("Město")
                c1, c2, c3 = st.columns(3)
                lat = c1.number_input("Latitude", value=0.0, format="%.7f")
                lon = c2.number_input("Longitude", value=0.0, format="%.7f")
                elev = c3.number_input("Elev ft", value=0.0)
                ok = st.form_submit_button("Uložit letiště")
            if ok and require_admin():
                with connect() as con:
                    initialize_database(con)
                    con.execute("""
                        INSERT OR REPLACE INTO airports
                        (ident,name,airport_type,iso_country,municipality,latitude_deg,longitude_deg,elevation_ft,source,active,closed,data_quality,imported_at,updated_at)
                        VALUES (?, ?, 'manual', 'CZ', ?, ?, ?, ?, 'manual', 1, 0, 'manual', ?, ?)
                    """, (ident, name, municipality, lat, lon, elev, _now_iso(), _now_iso()))
                    record_audit(con, "upsert_airport", "airport", ident, {"name": name})
                    con.commit()
                invalidate_cached_data()
                auto_backup_after_change("upsert airport")
                st.rerun()
    with tab_audit:
        with connect() as con:
            initialize_database(con)
            audit = pd.read_sql_query("SELECT * FROM audit_log ORDER BY created_at DESC LIMIT 500", con)
        st.dataframe(audit, use_container_width=True, hide_index=True)


def export_page(df: pd.DataFrame) -> None:
    app_header()
    st.title("Export")
    fdf = apply_filters(df)
    st.download_button("Stáhnout CSV letů", fdf.to_csv(index=False).encode("utf-8-sig"), "lety_export.csv", "text/csv")
    output = BytesIO()
    wb = Workbook()
    ws = wb.active
    ws.title = "Lety"
    export_cols = ["date", "evidence", "registration", "aircraft_type", "aircraft_class", "departure", "arrival", "off_block", "takeoff", "landing", "on_block", "starts", "commander", "instructor", "role", "task", "block_min", "air_min", "price_per_hour", "cost", "note"]
    ws.append(export_cols)
    for _, row in fdf.iterrows():
        ws.append([row.get(c) for c in export_cols])
    header_fill = PatternFill("solid", fgColor="D9EAF7")
    for cell in ws[1]:
        cell.font = Font(bold=True)
        cell.fill = header_fill
        cell.alignment = Alignment(horizontal="center")
    for col in range(1, len(export_cols) + 1):
        ws.column_dimensions[get_column_letter(col)].width = 16
    wb.save(output)
    st.download_button("Stáhnout Excel", output.getvalue(), "letovy_zapisnik_export.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
    if DB_PATH.exists():
        st.download_button("Stáhnout SQLite databázi", DB_PATH.read_bytes(), "logbook.sqlite", "application/octet-stream")


def build_detail_from_query() -> None:
    qp = query_params()
    fid = qp.get("flight_id") or st.session_state.get("selected_flight_id")
    if fid:
        try:
            render_flight_detail_modal(int(fid))
        except Exception as exc:
            st.error(f"Detail letu nelze otevřít: {exc}")


def main() -> None:
    st.set_page_config(page_title="Letový zápisník", page_icon="✈️", layout="wide", initial_sidebar_state="expanded")
    with connect() as con:
        initialize_database(con)
    if "page" not in st.session_state:
        st.session_state["page"] = "Dashboard"
    install_sidebar_toggle()
    dark_mode = True
    with st.sidebar:
        st.markdown("## Letový zápisník")
        st.markdown(f'<div class="sidebar-version">{APP_VERSION}</div>', unsafe_allow_html=True)
        render_sidebar_nav()
        render_auth_sidebar()
    apply_ui_theme(dark_mode)
    df = load_flights()
    build_detail_from_query()
    page = st.session_state.get("page", "Dashboard")
    if page == "Dashboard":
        dashboard(df)
    elif page == "Lety":
        flights_page(df)
    elif page == "Nový let":
        add_flight_page()
    elif page == "Mapa":
        map_page(df)
    elif page == "Ceník":
        aircraft_rates_page()
    elif page == "Databáze":
        database_page()
    elif page == "Export":
        export_page(df)
    else:
        dashboard(df)


if __name__ == "__main__":
    main()
