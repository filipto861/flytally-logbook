from __future__ import annotations

import base64
import csv
import hashlib
import io
import json
import math
import os
import re
import shutil
import sqlite3
import subprocess
import tempfile
import urllib.parse
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from io import BytesIO
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo

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
APP_VERSION = "v0.29"
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


def _github_token() -> str | None:
    try:
        token = st.secrets.get("github", {}).get("token")
    except Exception:
        token = None
    if not token:
        token = os.environ.get("LOGBOOK_GITHUB_TOKEN") or os.environ.get("GITHUB_TOKEN")
    token = str(token or "").strip()
    return token or None


def _github_repo() -> str:
    try:
        repo = st.secrets.get("github", {}).get("repo")
    except Exception:
        repo = None
    return str(repo or os.environ.get("LOGBOOK_GITHUB_REPO") or "filipto861/Logbook").strip()


def _github_branch() -> str:
    try:
        branch = st.secrets.get("github", {}).get("branch")
    except Exception:
        branch = None
    return str(branch or os.environ.get("LOGBOOK_GITHUB_BRANCH") or "main").strip()


def _git_run(args: list[str], cwd: Path) -> tuple[bool, str]:
    try:
        proc = subprocess.run(args, cwd=cwd, text=True, capture_output=True, timeout=45)
        out = (proc.stdout or "") + (proc.stderr or "")
        return proc.returncode == 0, out[-1200:]
    except Exception as exc:
        return False, str(exc)


def record_audit(con: sqlite3.Connection, action: str, entity: str | None = None, entity_id: Any | None = None, detail: dict | None = None) -> None:
    try:
        con.execute(
            "INSERT INTO audit_log (created_at, actor, action, object_type, object_id, detail_json) VALUES (?, ?, ?, ?, ?, ?)",
            (_now_iso(), "admin" if is_admin() else "viewer", action, entity, str(entity_id) if entity_id is not None else None, json.dumps(detail or {}, ensure_ascii=False)),
        )
    except sqlite3.OperationalError:
        # Compatibility with older DB that had a previous audit schema.
        try:
            con.execute(
                "INSERT INTO audit_log (created_at, user, action, entity, entity_id, detail) VALUES (?, ?, ?, ?, ?, ?)",
                (_now_iso(), "admin" if is_admin() else "viewer", action, entity, str(entity_id) if entity_id is not None else None, json.dumps(detail or {}, ensure_ascii=False)),
            )
        except Exception:
            pass
    except Exception:
        pass


def auto_backup_after_change(reason: str) -> bool:
    token = _github_token()
    if not token:
        try:
            with connect() as con:
                _set_meta(con, "last_backup_status", "disabled_no_token")
                _set_meta(con, "dirty", "1")
                con.commit()
        except Exception:
            pass
        return False
    try:
        backup_database_to_github(reason=reason)
        return True
    except Exception as exc:
        try:
            with connect() as con:
                _set_meta(con, "last_backup_status", f"error: {exc}")
                _set_meta(con, "dirty", "1")
                con.commit()
        except Exception:
            pass
        return False


def backup_database_to_github(reason: str = "manual") -> bool:
    token = _github_token()
    if not token:
        raise RuntimeError("GitHub token není nastavený.")
    repo = _github_repo()
    branch = _github_branch()
    if "/" not in repo:
        raise RuntimeError("GitHub repo musí být ve formátu owner/repository.")

    owner, name = repo.split("/", 1)
    db_bytes = DB_PATH.read_bytes()
    content_b64 = base64.b64encode(db_bytes).decode("ascii")
    api = f"https://api.github.com/repos/{owner}/{name}/contents/data/logbook.sqlite"
    headers = {
        "Accept": "application/vnd.github+json",
        "Authorization": f"Bearer {token}",
        "X-GitHub-Api-Version": "2022-11-28",
    }
    import requests
    get_resp = requests.get(api, headers=headers, params={"ref": branch}, timeout=25)
    sha = None
    if get_resp.status_code == 200:
        sha = get_resp.json().get("sha")
    elif get_resp.status_code != 404:
        raise RuntimeError(f"GitHub read failed: {get_resp.status_code} {get_resp.text[:300]}")
    payload = {
        "message": f"Backup SQLite database ({reason})",
        "content": content_b64,
        "branch": branch,
    }
    if sha:
        payload["sha"] = sha
    put_resp = requests.put(api, headers=headers, json=payload, timeout=60)
    if put_resp.status_code not in {200, 201}:
        raise RuntimeError(f"GitHub backup failed: {put_resp.status_code} {put_resp.text[:500]}")
    with connect() as con:
        _set_meta(con, "last_backup_at", _now_iso())
        _set_meta(con, "last_backup_reason", reason)
        _set_meta(con, "last_backup_status", "ok")
        _set_meta(con, "dirty", "0")
        con.commit()
    return True


def _set_meta(con: sqlite3.Connection, key: str, value: Any) -> None:
    con.execute("INSERT OR REPLACE INTO app_meta (key, value, updated_at) VALUES (?, ?, ?)", (key, str(value), _now_iso()))


def get_meta() -> dict[str, str]:
    try:
        with connect() as con:
            rows = con.execute("SELECT key, value FROM app_meta").fetchall()
        return {r["key"]: r["value"] for r in rows}
    except Exception:
        return {}


def is_admin() -> bool:
    return bool(st.session_state.get("is_admin", False))


def require_admin() -> bool:
    if is_admin():
        return True
    st.info("Ruční editace je dostupná jen po přihlášení jako správce.")
    return False


def login(password: str) -> bool:
    expected = None
    try:
        expected = st.secrets.get("admin_password")
    except Exception:
        expected = None
    expected = expected or os.environ.get("LOGBOOK_ADMIN_PASSWORD") or "admin"
    ok = hashlib.sha256((password or "").encode()).hexdigest() == hashlib.sha256(str(expected).encode()).hexdigest()
    st.session_state["is_admin"] = ok
    return ok


def logout() -> None:
    st.session_state["is_admin"] = False


def render_auth_sidebar() -> None:
    st.markdown("---")
    with st.expander("Správa aplikace", expanded=False):
        if is_admin():
            st.caption("Přihlášeno jako správce.")
            if st.button("Odhlásit", use_container_width=True):
                logout(); st.rerun()
            token_status = "zapnuto" if _github_token() else "vypnuto"
            st.caption(f"Auto GitHub backup: {token_status}")
        else:
            pwd = st.text_input("Admin heslo", type="password", key="admin_pwd")
            if st.button("Přihlásit", use_container_width=True):
                if login(pwd):
                    st.success("Přihlášeno."); st.rerun()
                else:
                    st.error("Nesprávné heslo.")


def backup_restore_panel() -> None:
    st.markdown("### Záloha databáze")
    meta = get_meta()
    c1, c2 = st.columns(2)
    with c1:
        st.download_button("Stáhnout aktuální SQLite databázi", data=DB_PATH.read_bytes(), file_name="logbook.sqlite", use_container_width=True)
    with c2:
        if st.button("Zálohovat databázi na GitHub", use_container_width=True, disabled=not is_admin()):
            if require_admin():
                try:
                    backup_database_to_github("manual")
                    st.success("Databáze byla uložena na GitHub.")
                except Exception as exc:
                    st.error(f"Záloha selhala: {exc}")
    st.caption(f"Poslední backup: {meta.get('last_backup_at', '—')} • stav: {meta.get('last_backup_status', '—')}")
    st.caption("Automatická záloha se spouští po uložení letu, úpravě, smazání letu, změně ceníku, importu letišť a práci s KML tracky.")
    if is_admin():
        uploaded = st.file_uploader("Obnovit SQLite databázi ze souboru", type=["sqlite", "db"], key="restore_db")
        confirm = st.text_input("Pro obnovení napiš OBNOVIT", key="restore_confirm")
        if uploaded and st.button("Obnovit databázi", type="secondary", use_container_width=True):
            if confirm.strip().upper() != "OBNOVIT":
                st.error("Obnovení není potvrzené.")
            else:
                tmp = DB_PATH.with_suffix(".sqlite.upload")
                tmp.write_bytes(uploaded.getvalue())
                # Minimal sanity check
                try:
                    with sqlite3.connect(tmp) as test_con:
                        test_con.execute("SELECT COUNT(*) FROM flights").fetchone()
                    backup = DB_PATH.with_suffix(f".backup-{datetime.now().strftime('%Y%m%d-%H%M%S')}.sqlite")
                    shutil.copy2(DB_PATH, backup)
                    shutil.move(tmp, DB_PATH)
                    st.cache_data.clear()
                    with connect() as con:
                        record_audit(con, "restore_database", "database", None, {"file": uploaded.name})
                        con.commit()
                    st.success("Databáze obnovena. Aplikace se znovu načte.")
                    st.rerun()
                except Exception as exc:
                    try: tmp.unlink(missing_ok=True)
                    except Exception: pass
                    st.error(f"Obnova selhala: {exc}")


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
    ensure_schema_compatibility(con)
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


@st.cache_data(show_spinner=False, ttl=30)
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
        closed = 1 if str(airport_type or "").lower() in {"closed", "closed_airport"} else int(_to_float(val(row, "closed", default=0)) or 0)
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


def _airport_query(active_only: bool) -> str:
    query = "SELECT * FROM airports"
    if active_only:
        query += " WHERE active = 1 AND closed = 0 AND latitude_deg IS NOT NULL AND longitude_deg IS NOT NULL"
    query += " ORDER BY ident"
    return query


@st.cache_data(show_spinner=False, ttl=300)
def read_airports(active_only: bool = True) -> pd.DataFrame:
    """Return airport registry from the fixed world DB plus local overrides.

    data/airports_full.sqlite is the stable world airport database. The main
    logbook.sqlite keeps only manual overrides/additions, so flights and KML
    tracks are not overwritten when the airport registry is refreshed. When the
    same ident exists in both databases, the local logbook row wins.
    """
    frames: list[pd.DataFrame] = []
    query = _airport_query(active_only)

    if AIRPORTS_DB_PATH.exists():
        try:
            with sqlite3.connect(AIRPORTS_DB_PATH) as airport_con:
                frames.append(pd.read_sql_query(query, airport_con))
        except Exception:
            pass

    try:
        with connect() as con:
            frames.append(pd.read_sql_query(query, con))
    except Exception:
        pass

    if not frames:
        return pd.DataFrame()
    out = pd.concat(frames, ignore_index=True, sort=False)
    if "ident" in out.columns:
        out["ident"] = out["ident"].fillna("").astype(str).str.upper().str.strip()
        out = out[out["ident"] != ""]
        out = out.drop_duplicates(subset=["ident"], keep="last")
        out = out.sort_values("ident")
    return out.reset_index(drop=True)


def import_ourairports_to_database() -> int:
    """Import world airport database into SQLite.

    Prefer bundled data/airports.csv when present. If it is not present,
    fall back to the public OurAirports CSV URL. The application never
    keeps the world airport list hard-coded in Python.
    """
    if AIRPORTS_CSV_PATH.exists():
        df = pd.read_csv(AIRPORTS_CSV_PATH)
        source_label = "OurAirports bundled CSV"
        source_ref = str(AIRPORTS_CSV_PATH.name)
    else:
        df = pd.read_csv(OURAIRPORTS_AIRPORTS_URL)
        source_label = "OurAirports URL"
        source_ref = OURAIRPORTS_AIRPORTS_URL
    with connect() as con:
        count = import_airports_dataframe(con, df, default_source=source_label, replace_existing=True)
        _seed_airports_from_overrides(con)
        _set_meta(con, "ourairports_source", source_ref)
        _set_meta(con, "ourairports_rows", count)
        _set_meta(con, "ourairports_imported_at", _now_iso())
        record_audit(con, "import_ourairports", "airports", None, {"rows": count, "source": source_ref})
        con.commit()
    auto_backup_after_change("import_ourairports")
    return count


def import_airport_csv_upload(uploaded_file) -> int:
    df = pd.read_csv(uploaded_file)
    with connect() as con:
        count = import_airports_dataframe(con, df, default_source="user_csv", replace_existing=True)
        record_audit(con, "import_airport_csv", "airports", None, {"rows": count, "file": getattr(uploaded_file, "name", None)})
        con.commit()
    auto_backup_after_change("import_airport_csv")
    return count


def upsert_rate(data: dict[str, Any]) -> None:
    with connect() as con:
        con.execute(
            """
            INSERT INTO rates (registration, aircraft_type, valid_from, price_per_hour, dry_price_per_hour, source)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(registration, valid_from) DO UPDATE SET
                aircraft_type=excluded.aircraft_type,
                price_per_hour=excluded.price_per_hour,
                dry_price_per_hour=excluded.dry_price_per_hour,
                source=excluded.source
            """,
            (data["registration"].upper(), data.get("aircraft_type"), data.get("valid_from"), data.get("price_per_hour"), data.get("dry_price_per_hour"), "admin"),
        )
        record_audit(con, "upsert_rate", "rates", data.get("registration"), data)
        con.commit()
    st.cache_data.clear()
    auto_backup_after_change("upsert_rate")


def upsert_aircraft(data: dict[str, Any]) -> None:
    with connect() as con:
        now = _now_iso()
        con.execute(
            """
            INSERT INTO aircraft (registration, aircraft_type, icao_type, aircraft_class, evidence, default_price_per_hour, active, note, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(registration) DO UPDATE SET
                aircraft_type=excluded.aircraft_type,
                icao_type=excluded.icao_type,
                aircraft_class=excluded.aircraft_class,
                evidence=excluded.evidence,
                default_price_per_hour=excluded.default_price_per_hour,
                active=excluded.active,
                note=excluded.note,
                updated_at=excluded.updated_at
            """,
            (data["registration"].upper(), data.get("aircraft_type"), data.get("icao_type"), data.get("aircraft_class"), data.get("evidence"), data.get("default_price_per_hour"), int(data.get("active", 1)), data.get("note"), now, now),
        )
        record_audit(con, "upsert_aircraft", "aircraft", data.get("registration"), data)
        con.commit()
    st.cache_data.clear()
    auto_backup_after_change("upsert_aircraft")


def delete_rate(rate_id: int) -> None:
    with connect() as con:
        con.execute("DELETE FROM rates WHERE id = ?", (rate_id,))
        record_audit(con, "delete_rate", "rates", rate_id, None)
        con.commit()
    st.cache_data.clear()
    auto_backup_after_change("delete_rate")


def delete_aircraft(aircraft_id: int) -> None:
    with connect() as con:
        con.execute("DELETE FROM aircraft WHERE id = ?", (aircraft_id,))
        record_audit(con, "delete_aircraft", "aircraft", aircraft_id, None)
        con.commit()
    st.cache_data.clear()
    auto_backup_after_change("delete_aircraft")


def parse_time(value: Any) -> str | None:
    if value is None or pd.isna(value):
        return None
    if isinstance(value, datetime):
        return value.strftime("%H:%M")
    s = str(value).strip()
    if not s or s.lower() in {"nan", "none", "nat"}:
        return None
    s = s.replace(".", ":")
    m = re.match(r"^(\d{1,2}):(\d{2})", s)
    if m:
        h = int(m.group(1)); mi = int(m.group(2))
        if 0 <= h <= 23 and 0 <= mi <= 59:
            return f"{h:02d}:{mi:02d}"
    m = re.match(r"^(\d{3,4})$", s)
    if m:
        raw = m.group(1).zfill(4); h = int(raw[:2]); mi = int(raw[2:])
        if 0 <= h <= 23 and 0 <= mi <= 59:
            return f"{h:02d}:{mi:02d}"
    return None


def minutes_diff(start: Any, end: Any) -> int | None:
    a = parse_time(start); b = parse_time(end)
    if not a or not b:
        return None
    ah, am = map(int, a.split(":")); bh, bm = map(int, b.split(":"))
    start_m = ah * 60 + am; end_m = bh * 60 + bm
    if end_m < start_m:
        end_m += 24 * 60
    return end_m - start_m


def minutes_to_time_str(minutes: int | float | None) -> str | None:
    if minutes is None or pd.isna(minutes):
        return None
    m = int(round(minutes)) % (24 * 60)
    return f"{m // 60:02d}:{m % 60:02d}"


def time_add_minutes(t: str | None, delta: int) -> str | None:
    if not t:
        return None
    h, m = map(int, t.split(":"))
    return minutes_to_time_str(h * 60 + m + delta)


def normalize_text(value: Any) -> str | None:
    if value is None or pd.isna(value):
        return None
    s = str(value).strip()
    return s if s else None


def calc_price_for_flight(registration: str | None, date: str | None, rates: pd.DataFrame) -> float | None:
    if rates.empty or not registration:
        return None
    work = rates[rates["registration"].fillna("").str.upper().eq(str(registration).upper())].copy()
    if work.empty:
        return None
    work["valid_dt"] = pd.to_datetime(work["valid_from"], errors="coerce")
    d = pd.to_datetime(date, errors="coerce")
    if pd.notna(d):
        prior = work[work["valid_dt"].isna() | (work["valid_dt"] <= d)].sort_values("valid_dt")
        if not prior.empty:
            return float(prior.iloc[-1]["price_per_hour"])
    return float(work.iloc[-1]["price_per_hour"])


def normalize_registration(value: Any) -> str | None:
    s = normalize_text(value)
    if not s: return None
    s = s.upper().replace(" ", "")
    if s.startswith("OK-"):
        return s
    if re.match(r"^[A-Z]{3}\d{2}$", s):
        return "OK-" + s
    if re.match(r"^[A-Z]{3}$", s):
        return "OK-" + s
    return s


def guess_registration_from_filename(name: str | None) -> str | None:
    if not name: return None
    n = name.upper()
    # OK-CUG23 / OK_CUG23 / CUG23 forms
    m = re.search(r"OK[-_ ]?([A-Z]{3}\d{2}|[A-Z]{3})", n)
    if m: return "OK-" + m.group(1)
    m = re.search(r"\b([A-Z]{3}\d{2})\b", n)
    if m: return "OK-" + m.group(1)
    return None


def fill_aircraft_defaults(registration: str | None, rates: pd.DataFrame) -> dict[str, Any]:
    reg = normalize_registration(registration)
    out = {"registration": reg, "aircraft_type": None, "aircraft_class": None, "evidence": None, "price_per_hour": None}
    if not reg:
        return out
    try:
        aircraft = read_table("aircraft")
        if not aircraft.empty:
            row = aircraft[aircraft["registration"].fillna("").str.upper().eq(reg.upper())]
            if not row.empty:
                r = row.iloc[0]
                out.update({"aircraft_type": r.get("aircraft_type") or r.get("icao_type"), "aircraft_class": r.get("aircraft_class"), "evidence": r.get("evidence"), "price_per_hour": r.get("default_price_per_hour")})
    except Exception:
        pass
    if rates is not None and not rates.empty:
        rr = rates[rates["registration"].fillna("").str.upper().eq(reg.upper())]
        if not rr.empty:
            r = rr.iloc[-1]
            out["aircraft_type"] = out["aircraft_type"] or r.get("aircraft_type")
            out["price_per_hour"] = out["price_per_hour"] or r.get("price_per_hour")
    if not out["evidence"]:
        # ULL Kralupy registrations usually use five chars after OK-
        suffix = reg.replace("OK-", "")
        out["evidence"] = "ULL" if re.match(r"^[A-Z]{3}\d{2}$", suffix) else "EASA"
    if not out["aircraft_class"]:
        out["aircraft_class"] = "ULL" if out["evidence"] == "ULL" else "SEP"
    return out

# -----------------------------------------------------------------------------
# KML/GPS parsing
# -----------------------------------------------------------------------------

def haversine_km(lat1, lon1, lat2, lon2) -> float:
    r = 6371.0088
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(dphi/2)**2 + math.cos(phi1)*math.cos(phi2)*math.sin(dl/2)**2
    return 2 * r * math.asin(min(1, math.sqrt(a)))


def parse_kml(kml_bytes: bytes) -> dict[str, Any]:
    text = kml_bytes.decode("utf-8", errors="ignore")
    root = ET.fromstring(text)
    ns = {"kml": "http://www.opengis.net/kml/2.2", "gx": "http://www.google.com/kml/ext/2.2"}
    points: list[dict[str, Any]] = []

    # gx:Track with times
    for track in root.findall(".//gx:Track", ns):
        times = [el.text for el in track.findall("gx:when", ns)] or [el.text for el in track.findall("kml:when", ns)]
        coords = [el.text for el in track.findall("gx:coord", ns)]
        for i, c in enumerate(coords):
            parts = (c or "").split()
            if len(parts) >= 2:
                lon = float(parts[0]); lat = float(parts[1]); alt = float(parts[2]) if len(parts) >= 3 else None
                points.append({"lat": lat, "lon": lon, "alt_m": alt, "time": times[i] if i < len(times) else None})

    # Plain LineString coordinates
    for coord_el in root.findall(".//kml:LineString/kml:coordinates", ns):
        textc = coord_el.text or ""
        for token in textc.split():
            parts = token.split(",")
            if len(parts) >= 2:
                lon = float(parts[0]); lat = float(parts[1]); alt = float(parts[2]) if len(parts) >= 3 and parts[2] else None
                points.append({"lat": lat, "lon": lon, "alt_m": alt, "time": None})

    # ADS-B Exchange often stores timestamped points in ExtendedData JSON-ish text not needed if gx exists
    points = [p for p in points if -90 <= p["lat"] <= 90 and -180 <= p["lon"] <= 180]
    # Remove consecutive duplicates
    clean = []
    last = None
    for p in points:
        key = (round(p["lat"], 7), round(p["lon"], 7), p.get("time"))
        if key != last:
            clean.append(p); last = key
    points = clean

    distance = 0.0
    prev = None
    speeds = []
    cumulative = 0.0
    for idx, p in enumerate(points):
        seg = 0.0
        if prev:
            seg = haversine_km(prev["lat"], prev["lon"], p["lat"], p["lon"])
            distance += seg
        cumulative += seg
        p["segment_km"] = seg
        p["distance_km"] = cumulative
        p["seq"] = idx
        p["speed_kmh"] = None
        p["speed_kt"] = None
        # Compute GPS speed when timestamps are available. Filter only absurd jumps.
        if prev and prev.get("time") and p.get("time"):
            try:
                t0 = pd.to_datetime(prev["time"], utc=True)
                t1 = pd.to_datetime(p["time"], utc=True)
                dt_s = (t1 - t0).total_seconds()
                if dt_s > 0:
                    sp = seg / (dt_s / 3600.0)
                    if 0 <= sp <= 650:
                        p["speed_kmh"] = sp
                        p["speed_kt"] = sp / 1.852
                        speeds.append(sp)
            except Exception:
                pass
        prev = p
    start_time = next((p.get("time") for p in points if p.get("time")), None)
    end_time = next((p.get("time") for p in reversed(points) if p.get("time")), None)
    alts = [p["alt_m"] for p in points if p.get("alt_m") is not None]
    return {"points": points, "distance_km": distance, "start_utc": start_time, "end_utc": end_time, "min_alt_m": min(alts) if alts else None, "max_alt_m": max(alts) if alts else None, "max_speed_kmh": max(speeds) if speeds else None}


def utc_to_local_time_str(value: str | None) -> str | None:
    if not value: return None
    try:
        dt = pd.to_datetime(value, utc=True).to_pydatetime().astimezone(LOCAL_TZ)
        return dt.strftime("%H:%M")
    except Exception:
        return None


def utc_to_local_date_str(value: str | None) -> str | None:
    if not value: return None
    try:
        dt = pd.to_datetime(value, utc=True).to_pydatetime().astimezone(LOCAL_TZ)
        return dt.strftime("%Y-%m-%d")
    except Exception:
        return None


def detect_airborne_window(points: list[dict[str, Any]]) -> tuple[str | None, str | None]:
    """Detect takeoff/landing from GPS points.

    Prefer GPS speed when timestamps are available. Fallback to altitude delta. The
    result is intentionally conservative: user should still review before saving.
    """
    if not points:
        return None, None
    speeds = []
    for p in points:
        sp = p.get("speed_kmh")
        try:
            speeds.append(float(sp) if sp is not None else None)
        except Exception:
            speeds.append(None)
    alts = []
    for p in points:
        try: alts.append(float(p.get("alt_m")) if p.get("alt_m") is not None else None)
        except Exception: alts.append(None)
    valid_alts = [a for a in alts if a is not None]
    ground_alt = min(valid_alts[:30] or valid_alts or [0])

    airborne = []
    for i, p in enumerate(points):
        sp_ok = speeds[i] is not None and speeds[i] >= 55
        alt_ok = alts[i] is not None and alts[i] >= ground_alt + 45
        airborne.append(bool(sp_ok or alt_ok))
    if not any(airborne):
        return None, None
    first = next(i for i, x in enumerate(airborne) if x)
    last = len(airborne) - 1 - next(i for i, x in enumerate(reversed(airborne)) if x)
    return utc_to_local_time_str(points[first].get("time")), utc_to_local_time_str(points[last].get("time"))


def suggest_from_kml(file_name: str, kml_bytes: bytes, rates: pd.DataFrame) -> tuple[dict[str, Any], dict[str, Any]]:
    parsed = parse_kml(kml_bytes)
    reg = guess_registration_from_filename(file_name)
    defaults = fill_aircraft_defaults(reg, rates)
    takeoff, landing = detect_airborne_window(parsed["points"])
    if not takeoff or not landing:
        takeoff = utc_to_local_time_str(parsed["start_utc"])
        landing = utc_to_local_time_str(parsed["end_utc"])
    off_block = time_add_minutes(takeoff, -5) if takeoff else None
    on_block = time_add_minutes(landing, 5) if landing else None
    dep = arr = None
    if parsed["points"]:
        dep = nearest_airport(parsed["points"][0]["lat"], parsed["points"][0]["lon"])
        arr = nearest_airport(parsed["points"][-1]["lat"], parsed["points"][-1]["lon"])
    suggested = {
        "date": utc_to_local_date_str(parsed["start_utc"]) or datetime.now().strftime("%Y-%m-%d"),
        "evidence": defaults.get("evidence") or "ULL",
        "registration": defaults.get("registration"),
        "aircraft_type": defaults.get("aircraft_type"),
        "aircraft_class": defaults.get("aircraft_class"),
        "departure": dep,
        "arrival": arr,
        "off_block": off_block,
        "takeoff": takeoff,
        "landing": landing,
        "on_block": on_block,
        "starts": 1,
        "commander": "Točík Filip",
        "instructor": None,
        "role": "PIC",
        "task": "VFR",
        "price_per_hour": defaults.get("price_per_hour"),
        "note": f"Import z KML: {file_name}",
    }
    return suggested, parsed

# -----------------------------------------------------------------------------
# Reads/writes
# -----------------------------------------------------------------------------

@st.cache_data(show_spinner=False, ttl=30)
def read_flights() -> pd.DataFrame:
    with connect() as con:
        flights = pd.read_sql_query("SELECT * FROM flights ORDER BY date, off_block, id", con)
        tracks = pd.read_sql_query(
            """
            SELECT flight_id, COUNT(*) AS gps_tracks, COALESCE(SUM(distance_km),0) AS gps_km
            FROM flight_tracks GROUP BY flight_id
            """,
            con,
        )
    if tracks.empty:
        flights["gps_tracks"] = 0; flights["gps_km"] = 0.0
    else:
        flights = flights.merge(tracks, left_on="id", right_on="flight_id", how="left")
        flights["gps_tracks"] = flights["gps_tracks"].fillna(0).astype(int)
        flights["gps_km"] = flights["gps_km"].fillna(0.0)
    return flights


def normalize_flight_payload(data: dict[str, Any]) -> dict[str, Any]:
    payload = dict(data)
    payload["registration"] = normalize_registration(payload.get("registration"))
    for key in ["off_block","takeoff","landing","on_block"]:
        payload[key] = parse_time(payload.get(key))
    payload["evidence"] = normalize_text(payload.get("evidence"))
    payload["aircraft_class"] = normalize_text(payload.get("aircraft_class"))
    payload["role"] = normalize_text(payload.get("role"))
    payload["starts"] = int(payload.get("starts") or 1)
    if payload.get("instructor") and payload.get("role") not in {"INSTRUKTOR", "SAFETY PILOT"}:
        payload["role"] = "DUAL"
    return payload


def validate_flight(data: dict[str, Any]) -> list[str]:
    errors=[]
    if not data.get("date"): errors.append("Chybí datum.")
    if not data.get("registration"): errors.append("Chybí imatrikulace.")
    if not data.get("departure") or not data.get("arrival"): errors.append("Chybí odlet nebo přílet.")
    if minutes_diff(data.get("off_block"), data.get("on_block")) is None: errors.append("Neplatný block time.")
    air = minutes_diff(data.get("takeoff"), data.get("landing"))
    block = minutes_diff(data.get("off_block"), data.get("on_block"))
    if air is not None and block is not None and air > block:
        errors.append("Air time je delší než block time.")
    return errors


def save_flight(data: dict[str, Any], flight_id: int | None = None) -> int:
    payload = normalize_flight_payload(data)
    errs = validate_flight(payload)
    if errs:
        raise ValueError(" ".join(errs))
    cols = ["date","evidence","registration","aircraft_type","aircraft_class","departure","arrival","off_block","takeoff","landing","on_block","starts","commander","instructor","role","task","price_per_hour","note"]
    with connect() as con:
        if flight_id:
            set_clause = ", ".join([f"{c}=?" for c in cols])
            con.execute(f"UPDATE flights SET {set_clause} WHERE id=?", [payload.get(c) for c in cols] + [flight_id])
            record_audit(con, "update_flight", "flights", flight_id, payload)
            out_id = flight_id
        else:
            q = ",".join(["?"]*len(cols))
            cur = con.execute(f"INSERT INTO flights ({','.join(cols)}) VALUES ({q})", [payload.get(c) for c in cols])
            out_id = int(cur.lastrowid)
            record_audit(con, "create_flight", "flights", out_id, payload)
        con.commit()
    st.cache_data.clear()
    auto_backup_after_change("save_flight")
    return out_id


def read_tracks_for_flight(flight_id: int) -> pd.DataFrame:
    with connect() as con:
        return pd.read_sql_query("SELECT * FROM flight_tracks WHERE flight_id = ? ORDER BY id", con, params=(flight_id,))


def read_track_points(track_id: int) -> pd.DataFrame:
    with connect() as con:
        try:
            return pd.read_sql_query("SELECT * FROM track_points WHERE track_id = ? ORDER BY seq", con, params=(track_id,))
        except Exception:
            return pd.DataFrame()


def read_all_track_points() -> pd.DataFrame:
    with connect() as con:
        try:
            return pd.read_sql_query(
                """
                SELECT p.*, t.flight_id, t.file_name, f.date, f.registration, f.role, f.departure, f.arrival
                FROM track_points p
                JOIN flight_tracks t ON t.id = p.track_id
                LEFT JOIN flights f ON f.id = t.flight_id
                ORDER BY p.track_id, p.seq
                """,
                con,
            )
        except Exception:
            return pd.DataFrame()


def insert_track_points(con: sqlite3.Connection, track_id: int, points: list[dict[str, Any]]) -> None:
    for seq, p in enumerate(points):
        con.execute(
            """
            INSERT OR REPLACE INTO track_points (track_id, seq, time_utc, latitude_deg, longitude_deg, altitude_m, segment_km, distance_km, speed_kmh, speed_kt, source)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (track_id, seq, p.get("time"), p.get("lat"), p.get("lon"), p.get("alt_m"), p.get("segment_km"), p.get("distance_km"), p.get("speed_kmh"), p.get("speed_kt"), "kml"),
        )

# -----------------------------------------------------------------------------
# Views/helpers
# -----------------------------------------------------------------------------

def fmt_minutes(minutes: float | int | None) -> str:
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
    .stTabs [data-baseweb="tab"] {{border:1px solid var(--border);border-radius:999px;padding:.45rem .8rem;background:rgba(148,163,184,.06);}}
    .stButton button {{border-radius:14px;border:1px solid var(--border);font-weight:750;}}
    .stDownloadButton button {{border-radius:14px;border:1px solid var(--border);font-weight:750;}}
    input, textarea, select {{border-radius:12px !important;}}
    .small-muted {{color:var(--muted);font-size:.82rem;}}
    </style>
    """, unsafe_allow_html=True)


def app_header():
    st.markdown(f"""
    <div class="app-title">
      <div><div class="app-title-main">Letový zápisník</div><div class="app-title-sub">Lokální pilotní evidence • ULL / EASA • náklady • GPS tracky</div></div>
      <div class="app-badge">{APP_VERSION}</div>
    </div>
    """, unsafe_allow_html=True)


def metric_card(label: str, value: str, sub: str = ""):
    st.markdown(f'<div class="metric-card"><div class="metric-label">{label}</div><div class="metric-value">{value}</div><div class="metric-sub">{sub}</div></div>', unsafe_allow_html=True)


def render_sidebar_nav():
    st.markdown("### Navigace")
    current = st.session_state.get("page", "Dashboard")
    for page, label in NAV_ITEMS:
        if st.button(label, key=f"nav_{page}", type="primary" if current == page else "secondary", use_container_width=True):
            st.session_state["page"] = page
            st.rerun()


def filters(df: pd.DataFrame) -> pd.DataFrame:
    with st.expander("Filtry", expanded=False):
        c1,c2,c3,c4 = st.columns(4)
        years = sorted([int(x) for x in pd.to_datetime(df["date"], errors="coerce").dt.year.dropna().unique()]) if not df.empty else []
        with c1: sel_years = st.multiselect("Rok", years, default=years)
        evs = sorted(df["evidence"].dropna().unique()) if not df.empty else []
        with c2: sel_evs = st.multiselect("Evidence", evs, default=evs)
        roles = sorted(df["role"].dropna().unique()) if not df.empty else []
        with c3: sel_roles = st.multiselect("Funkce", roles, default=roles)
        regs = sorted(df["registration"].dropna().unique()) if not df.empty else []
        with c4: sel_regs = st.multiselect("Imatrikulace", regs)
    out = df.copy()
    if sel_years:
        out = out[pd.to_datetime(out["date"], errors="coerce").dt.year.isin(sel_years)]
    if sel_evs: out = out[out["evidence"].isin(sel_evs)]
    if sel_roles: out = out[out["role"].isin(sel_roles)]
    if sel_regs: out = out[out["registration"].isin(sel_regs)]
    return out


def summary_metrics(df: pd.DataFrame) -> dict[str, Any]:
    m = compute_metrics(df)
    if m.empty:
        return {"total":0,"pic":0,"pic_ull":0,"pic_easa":0,"dual":0,"safety":0,"starts":0,"cost":0,"tracks":0,"gps_km":0}
    pic = m[m["role"].eq("PIC")]
    return {
        "total": int(m["block_minutes"].fillna(0).sum()),
        "pic": int(pic["block_minutes"].fillna(0).sum()),
        "pic_ull": int(pic[pic["evidence"].eq("ULL")]["block_minutes"].fillna(0).sum()),
        "pic_easa": int(pic[pic["evidence"].eq("EASA")]["block_minutes"].fillna(0).sum()),
        "dual": int(m[m["role"].eq("DUAL")]["block_minutes"].fillna(0).sum()),
        "safety": int(m[m["role"].eq("SAFETY PILOT")]["block_minutes"].fillna(0).sum()),
        "starts": int(m["starts"].sum()),
        "cost": float(m["cost"].sum()),
        "tracks": int(m["gps_tracks"].fillna(0).sum()) if "gps_tracks" in m else 0,
        "gps_km": float(m["gps_km"].fillna(0).sum()) if "gps_km" in m else 0,
    }


def page_dashboard(flights: pd.DataFrame):
    st.markdown("## Dashboard")
    f = filters(compute_metrics(flights))
    sm = summary_metrics(f)
    c1,c2,c3,c4 = st.columns(4)
    with c1: metric_card("Celkový nálet", fmt_minutes(sm["total"]), f"{len(f)} letů")
    with c2: metric_card("PIC", fmt_minutes(sm["pic"]), f"ULL {fmt_minutes(sm['pic_ull'])} • EASA {fmt_minutes(sm['pic_easa'])}")
    with c3: metric_card("Dual / Safety", f"{fmt_minutes(sm['dual'])} / {fmt_minutes(sm['safety'])}", f"Starty {sm['starts']}")
    with c4: metric_card("Náklady", fmt_money(sm["cost"]), f"GPS {sm['tracks']} tracků • {sm['gps_km']:.0f} km")
    if f.empty:
        st.info("Žádné lety pro zvolené filtry."); return
    yearly = f.groupby(["year","role"], as_index=False)["block_hours"].sum()
    fig = px.bar(yearly, x="year", y="block_hours", color="role", barmode="stack", title="Nálet podle roku a funkce", labels={"block_hours":"hodiny"})
    fig.update_layout(template="plotly_dark", paper_bgcolor="rgba(0,0,0,0)", plot_bgcolor="rgba(0,0,0,0)")
    st.plotly_chart(fig, use_container_width=True)
    c1,c2 = st.columns(2)
    with c1:
        top = f.groupby("registration", as_index=False)["block_hours"].sum().sort_values("block_hours", ascending=False).head(10)
        fig2 = px.bar(top, x="registration", y="block_hours", title="TOP letadla podle block time")
        fig2.update_layout(template="plotly_dark", paper_bgcolor="rgba(0,0,0,0)", plot_bgcolor="rgba(0,0,0,0)")
        st.plotly_chart(fig2, use_container_width=True)
    with c2:
        ev = f.groupby("evidence", as_index=False)["block_hours"].sum()
        fig3 = px.pie(ev, names="evidence", values="block_hours", hole=.48, title="ULL / EASA")
        fig3.update_layout(template="plotly_dark", paper_bgcolor="rgba(0,0,0,0)")
        st.plotly_chart(fig3, use_container_width=True)


def flight_detail_label(row: pd.Series) -> str:
    return f"ID {row['id']} • {row['date']} • {row.get('registration','')} • {row.get('departure','')}–{row.get('arrival','')} • {row.get('off_block','')}–{row.get('on_block','')} • {row.get('role','')}"


def render_flight_card(row: pd.Series, rates: pd.DataFrame, dark_mode: bool):
    title = flight_detail_label(row)
    with st.container(border=True):
        c1,c2,c3,c4 = st.columns([2.1,1.5,1.4,1.1])
        with c1:
            st.markdown(f"**{row['date']} • {row.get('registration','')}**")
            st.caption(f"{row.get('aircraft_type','')} • {row.get('evidence','')} • {row.get('aircraft_class','')}")
        with c2:
            st.markdown(f"**{row.get('departure','')} → {row.get('arrival','')}**")
            st.caption(f"{row.get('off_block','')}–{row.get('on_block','')} / Air {row.get('takeoff','')}–{row.get('landing','')}")
        with c3:
            st.markdown(f"**{row.get('role','')}**")
            st.caption(f"Block {row.get('block_time','')} • Starty {row.get('starts','')}")
        with c4:
            st.markdown(f"**{row.get('cost_label','')}**")
            st.caption(f"GPS {int(row.get('gps_tracks') or 0)} • {float(row.get('gps_km') or 0):.0f} km")
            if st.button("Detail", key=f"detail_card_{row['id']}", use_container_width=True):
                st.session_state["selected_flight_id"] = int(row["id"])
                st.rerun()


def render_flight_list(table_df: pd.DataFrame, rates: pd.DataFrame, dark_mode: bool):
    if table_df.empty:
        st.info("Žádné lety.")
        return
    if "flight_page" not in st.session_state:
        st.session_state["flight_page"] = 1
    c0,c1,c2,c3 = st.columns([1.2,1.8,3.2,1.2])
    with c0:
        page_size_raw = st.selectbox("Řádků", [25,50,100,200,"Vše"], index=3, key="flight_page_size")
    with c1:
        if page_size_raw != "Vše":
            page_size = int(page_size_raw)
            pages = max(1, math.ceil(len(table_df) / page_size))
            default_page = min(max(int(st.session_state.get("flight_page", pages)), 1), pages)
            page = st.number_input("Stránka", min_value=1, max_value=pages, value=default_page, step=1, key="flight_page_num")
            st.session_state["flight_page"] = int(page)
        else:
            page_size = len(table_df)
            pages = 1
            page = 1
    with c2:
        q = st.text_input("Rychlé hledání", placeholder="registrace, letiště, typ, funkce...", key="flight_search")
    with c3:
        st.markdown(f'<div class="flight-page-info">{len(table_df)} letů</div>', unsafe_allow_html=True)
    show_df = table_df.copy()
    if q:
        ql = q.lower()
        mask = show_df.apply(lambda r: ql in " ".join([str(x) for x in r.values]).lower(), axis=1)
        show_df = show_df[mask]
    if page_size_raw != "Vše":
        pages = max(1, math.ceil(len(show_df) / page_size))
        page = min(int(page), pages)
        start = (page - 1) * page_size
        show_df = show_df.iloc[start:start+page_size]
    else:
        page = 1; pages = 1

    headers = ["", "ID", "Datum", "Ev.", "Letadlo", "Trasa", "Časy", "Block", "St.", "Funkce", "Velitel", "Úloha", "Cena", "GPS"]
    widths = [0.55,0.55,1.10,.72,1.55,1.35,1.45,.90,.55,1.18,1.55,1.08,1.10,.80]
    cols = st.columns(widths)
    for c,h in zip(cols, headers):
        c.markdown(f'<div class="flight-list-head">{h}</div>', unsafe_allow_html=True)
    for _, row in show_df.iterrows():
        cols = st.columns(widths)
        with cols[0]:
            if st.button("Detail", key=f"detail_row_{row['id']}"):
                st.session_state["selected_flight_id"] = int(row["id"])
                st.rerun()
        cols[1].markdown(f'<div class="flight-cell"><div class="flight-cell-main">{row.get("id","")}</div></div>', unsafe_allow_html=True)
        cols[2].markdown(f'<div class="flight-cell"><div class="flight-cell-main">{row.get("date","")}</div></div>', unsafe_allow_html=True)
        cols[3].markdown(f'<div class="flight-cell"><div class="flight-cell-main">{row.get("evidence","")}</div></div>', unsafe_allow_html=True)
        ac = f'{row.get("registration","")}<br><span class="flight-cell-sub">{row.get("aircraft_type","")} • {row.get("aircraft_class","")}</span>'
        cols[4].markdown(f'<div class="flight-cell"><div class="flight-cell-main">{ac}</div></div>', unsafe_allow_html=True)
        cols[5].markdown(f'<div class="flight-cell"><div class="flight-cell-main">{row.get("departure","")}–{row.get("arrival","")}</div></div>', unsafe_allow_html=True)
        times = f'{row.get("off_block","")}–{row.get("on_block","")}<br><span class="flight-cell-sub">Air {row.get("takeoff","")}–{row.get("landing","")}</span>'
        cols[6].markdown(f'<div class="flight-cell"><div class="flight-cell-main">{times}</div></div>', unsafe_allow_html=True)
        cols[7].markdown(f'<div class="flight-cell"><div class="flight-cell-main">{row.get("block_time","")}</div><div class="flight-cell-sub">Air {row.get("air_time","")}</div></div>', unsafe_allow_html=True)
        cols[8].markdown(f'<div class="flight-cell"><div class="flight-cell-main">{int(row.get("starts") or 0)}</div></div>', unsafe_allow_html=True)
        cols[9].markdown(f'<div class="flight-cell"><div class="flight-cell-main">{row.get("role","")}</div></div>', unsafe_allow_html=True)
        instr = row.get("instructor") or ""
        cols[10].markdown(f'<div class="flight-cell"><div class="flight-cell-main">{row.get("commander","")}</div><div class="flight-cell-sub">{instr}</div></div>', unsafe_allow_html=True)
        cols[11].markdown(f'<div class="flight-cell"><div class="flight-cell-main">{row.get("task","") or ""}</div></div>', unsafe_allow_html=True)
        cols[12].markdown(f'<div class="flight-cell"><div class="flight-cell-main">{row.get("cost_label","")}</div><div class="flight-cell-sub">{fmt_money(row.get("price_per_hour"))}/h</div></div>', unsafe_allow_html=True)
        cols[13].markdown(f'<div class="flight-cell"><div class="flight-cell-main">{int(row.get("gps_tracks") or 0)}</div><div class="flight-cell-sub">{float(row.get("gps_km") or 0):.0f} km</div></div>', unsafe_allow_html=True)
        st.markdown('<div class="flight-row-sep"></div>', unsafe_allow_html=True)
    if pages > 1:
        p1,p2,p3 = st.columns([1,2,1])
        with p1:
            if st.button("Předchozí", disabled=page<=1, use_container_width=True):
                st.session_state["flight_page"] = max(1, page-1); st.rerun()
        with p2:
            st.markdown(f"<div class='small-muted' style='text-align:center;padding-top:.55rem'>Stránka {page} / {pages}</div>", unsafe_allow_html=True)
        with p3:
            if st.button("Další", disabled=page>=pages, use_container_width=True):
                st.session_state["flight_page"] = min(pages, page+1); st.rerun()


def flight_dialog(row: pd.Series, rates: pd.DataFrame, dark_mode: bool):
    if not hasattr(st, "dialog"):
        st.warning("Detail letu vyžaduje novější Streamlit. Použij update Streamlit >= 1.37.")
        return

    @st.dialog(f"Let ID {int(row['id'])} • {row['date']} • {row.get('registration','')} • {row.get('departure','')}–{row.get('arrival','')}", width="large")
    def _dialog():
        tabs = st.tabs(["Přehled", "Editace", "Track", "Smazání"])
        with tabs[0]:
            c1,c2,c3,c4 = st.columns(4)
            with c1: metric_card("Block", row.get("block_time") or "", f"Air {row.get('air_time') or ''}")
            with c2: metric_card("Trasa", f"{row.get('departure','')}–{row.get('arrival','')}", row.get("registration", ""))
            with c3: metric_card("Funkce", row.get("role", ""), row.get("evidence", ""))
            with c4: metric_card("Cena", row.get("cost_label", ""), f"GPS {int(row.get('gps_tracks') or 0)}")
            st.dataframe(pd.DataFrame([row]).T.rename(columns={row.name:"Hodnota"}), use_container_width=True, height=520)
        with tabs[1]:
            if require_admin():
                flight_form(rates, existing=row.to_dict(), flight_id=int(row["id"]), form_key=f"edit_{row['id']}")
        with tabs[2]:
            flight_tracks = read_tracks_for_flight(int(row["id"]))
            if not flight_tracks.empty:
                points_df = read_track_points(int(flight_tracks.iloc[0]["id"]))
                joined = read_flights()
                st_folium(make_map(joined[joined["id"].eq(int(row["id"]))], dark_mode), height=380, use_container_width=True, key=f"dlg_map_{row['id']}_{len(flight_tracks)}")
                if not points_df.empty:
                    show_track_profile(points_df)
                st.dataframe(flight_tracks[["id","file_name","point_count","distance_km","start_utc","end_utc","max_alt_m"]].rename(columns={"id":"Track ID","file_name":"Soubor","point_count":"Body","distance_km":"Km","start_utc":"Start UTC","end_utc":"End UTC","max_alt_m":"Max alt m"}), use_container_width=True)
                if require_admin():
                    delete_id = st.selectbox("Smazat track", flight_tracks["id"].tolist(), format_func=lambda x: f"Track ID {x}")
                    if st.button("Smazat vybraný track", type="secondary", use_container_width=True):
                        delete_track(int(delete_id)); st.success("Track smazán."); st.rerun()
            else:
                st.info("Tento let zatím nemá KML/GPS track.")
            if require_admin():
                uploaded = st.file_uploader("Přidat / nahradit KML track", type=["kml"], key=f"kml_existing_{row['id']}")
                replace = st.checkbox("Nahradit existující tracky tohoto letu", value=False, key=f"replace_track_{row['id']}")
                if uploaded and st.button("Uložit KML track", use_container_width=True, key=f"save_track_{row['id']}"):
                    try:
                        parsed = parse_kml(uploaded.getvalue())
                        save_track(int(row["id"]), uploaded.name, parsed, replace_existing=replace)
                        st.success("Track uložen."); st.rerun()
                    except Exception as exc:
                        st.error(f"KML se nepodařilo načíst: {exc}")
        with tabs[3]:
            if require_admin():
                st.warning("Tato akce trvale smaže let včetně všech připojených KML/GPS tracků. Po smazání proběhne automatická záloha databáze na GitHub, pokud je zapnutá.")
                st.markdown(f"**Vybraný let:** ID {int(row['id'])} • {row['date']} • {row.get('registration','')} • {row.get('departure','')}–{row.get('arrival','')}")
                confirm = st.text_input("Pro potvrzení napiš ID letu", key=f"delete_confirm_{row['id']}")
                if st.button("Trvale smazat let", type="primary", use_container_width=True, key=f"delete_flight_{row['id']}"):
                    if confirm.strip() != str(int(row["id"])):
                        st.error("ID nesouhlasí. Let nebyl smazán.")
                    else:
                        delete_flight(int(row["id"]))
                        st.session_state.pop("selected_flight_id", None)
                        st.success("Let byl smazán.")
                        st.rerun()
        if st.button("Zavřít detail", use_container_width=True, key=f"close_dialog_{row['id']}"):
            st.session_state.pop("selected_flight_id", None)
            st.rerun()
    _dialog()


def page_logbook(flights: pd.DataFrame, rates: pd.DataFrame, dark_mode: bool):
    st.markdown("## Lety")
    f = filters(compute_metrics(flights))
    sm = summary_metrics(f)
    c1,c2,c3,c4 = st.columns(4)
    with c1: metric_card("Zobrazeno", str(len(f)), "letů")
    with c2: metric_card("Celkem", fmt_minutes(sm["total"]), "block time")
    with c3: metric_card("PIC", fmt_minutes(sm["pic"]), "z filtrovaných letů")
    with c4: metric_card("GPS", str(sm["tracks"]), f"{sm['gps_km']:.0f} km")
    st.markdown('<div class="flight-list-note">Klikni na tlačítko Detail u konkrétního letu. Detail se otevře přímo v aplikaci, ne v novém okně.</div>', unsafe_allow_html=True)
    table_df = f.sort_values(["date","off_block","id"], ascending=[True, True, True]).copy()
    # On first load, start on the last page.
    if "flight_page_initialized" not in st.session_state:
        st.session_state["flight_page_initialized"] = True
        st.session_state["flight_page"] = max(1, math.ceil(len(table_df)/200)) if len(table_df) else 1
    render_flight_list(table_df, rates, dark_mode)
    sid = st.session_state.get("selected_flight_id")
    if sid:
        row_df = compute_metrics(flights)
        row_df = row_df[row_df["id"].eq(int(sid))]
        if not row_df.empty:
            flight_dialog(row_df.iloc[0], rates, dark_mode)
        else:
            st.session_state.pop("selected_flight_id", None)


def input_value(existing: dict | None, key: str, default: Any = None):
    if existing is None:
        return default
    value = existing.get(key)
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return default
    return value


def flight_form(rates: pd.DataFrame, existing: dict | None = None, flight_id: int | None = None, form_key: str = "new"):
    with st.form(f"flight_form_{form_key}"):
        c1,c2,c3,c4 = st.columns(4)
        with c1:
            date_val = pd.to_datetime(input_value(existing,"date", datetime.now().strftime("%Y-%m-%d"))).date()
            date = st.date_input("Datum", value=date_val, key=f"date_{form_key}")
            evidence = st.selectbox("Evidence", EVIDENCE_OPTIONS, index=EVIDENCE_OPTIONS.index(input_value(existing,"evidence","ULL")) if input_value(existing,"evidence","ULL") in EVIDENCE_OPTIONS else 0, key=f"evidence_{form_key}")
        with c2:
            registration = st.text_input("Imatrikulace", value=input_value(existing,"registration","") or "", key=f"reg_{form_key}")
            aircraft_type = st.text_input("Typ", value=input_value(existing,"aircraft_type","") or "", key=f"type_{form_key}")
        with c3:
            aircraft_class = st.selectbox("Třída", CLASS_OPTIONS, index=CLASS_OPTIONS.index(input_value(existing,"aircraft_class","ULL")) if input_value(existing,"aircraft_class","ULL") in CLASS_OPTIONS else 0, key=f"class_{form_key}")
            starts = st.number_input("Starty", min_value=1, max_value=99, value=int(input_value(existing,"starts",1) or 1), step=1, key=f"starts_{form_key}")
        with c4:
            role = st.selectbox("Funkce", ROLE_OPTIONS, index=ROLE_OPTIONS.index(input_value(existing,"role","PIC")) if input_value(existing,"role","PIC") in ROLE_OPTIONS else 0, key=f"role_{form_key}")
            price = st.number_input("Kč/h", min_value=0.0, value=float(input_value(existing,"price_per_hour",0) or 0), step=10.0, key=f"price_{form_key}")
        c5,c6,c7,c8 = st.columns(4)
        with c5: departure = st.text_input("Odlet", value=input_value(existing,"departure","LKSZ") or "", key=f"dep_{form_key}")
        with c6: arrival = st.text_input("Přílet", value=input_value(existing,"arrival","LKSZ") or "", key=f"arr_{form_key}")
        with c7: off_block = st.text_input("Off Block", value=input_value(existing,"off_block","") or "", placeholder="HH:MM", key=f"off_{form_key}")
        with c8: takeoff = st.text_input("Takeoff", value=input_value(existing,"takeoff","") or "", placeholder="HH:MM", key=f"to_{form_key}")
        c9,c10,c11,c12 = st.columns(4)
        with c9: landing = st.text_input("Landing", value=input_value(existing,"landing","") or "", placeholder="HH:MM", key=f"ldg_{form_key}")
        with c10: on_block = st.text_input("On Block", value=input_value(existing,"on_block","") or "", placeholder="HH:MM", key=f"on_{form_key}")
        with c11: commander = st.text_input("Velitel", value=input_value(existing,"commander","Točík Filip") or "", key=f"cmd_{form_key}")
        with c12: instructor = st.text_input("Instruktor", value=input_value(existing,"instructor","") or "", key=f"ins_{form_key}")
        task = st.text_input("Úloha", value=input_value(existing,"task","VFR") or "", key=f"task_{form_key}")
        note = st.text_area("Poznámka", value=input_value(existing,"note","") or "", key=f"note_{form_key}")
        submitted = st.form_submit_button("Uložit let", type="primary", use_container_width=True)
    if submitted:
        data = {"date": date.strftime("%Y-%m-%d"), "evidence": evidence, "registration": registration, "aircraft_type": aircraft_type, "aircraft_class": aircraft_class, "departure": departure.upper(), "arrival": arrival.upper(), "off_block": off_block, "takeoff": takeoff, "landing": landing, "on_block": on_block, "starts": starts, "commander": commander, "instructor": instructor, "role": role, "task": task, "price_per_hour": price, "note": note}
        try:
            fid = save_flight(data, flight_id)
            st.success(f"Let uložený. ID {fid}")
            st.cache_data.clear()
        except Exception as exc:
            st.error(str(exc))


def page_new_flight(rates: pd.DataFrame, dark_mode: bool):
    st.markdown("## Přidat let")
    if not require_admin():
        return
    mode = st.radio("Způsob zadání", ["Ručně", "Z KML tracku"], horizontal=True)
    if mode == "Ručně":
        flight_form(rates, form_key="new_manual")
    else:
        uploaded = st.file_uploader("Nahraj KML track", type=["kml"], key="new_kml")
        if uploaded:
            try:
                raw = uploaded.getvalue()
                suggested, parsed = suggest_from_kml(uploaded.name, raw, rates)
                st.success(f"KML načteno: {len(parsed['points'])} bodů • {parsed['distance_km']:.1f} km • {utc_to_local_time_str(parsed['start_utc']) or '—'}–{utc_to_local_time_str(parsed['end_utc']) or '—'} LT")
                if parsed["points"]:
                    preview = pd.DataFrame(parsed["points"])
                    st_folium(make_points_map(parsed["points"], dark_mode), height=360, use_container_width=True, key="new_kml_preview")
                    show_track_profile(preview)
                flight_form(rates, existing=suggested, form_key="new_kml_form")
                if st.button("Uložit KML k posledně uloženému / vybranému letu se stejným datem a registrací", use_container_width=True):
                    st.info("Nejdřív ulož let formulářem. Potom otevři detail letu a připoj track v záložce Track.")
            except Exception as exc:
                st.error(f"KML se nepodařilo načíst: {exc}")


def nearest_airport(lat: float, lon: float, max_km: float = 8.0) -> str | None:
    airports = read_airports(active_only=True)
    if airports.empty:
        return None
    lat = pd.to_numeric(airports["latitude_deg"], errors="coerce")
    lon = pd.to_numeric(airports["longitude_deg"], errors="coerce")
    valid = lat.notna() & lon.notna()
    if not valid.any(): return None
    work = airports.loc[valid].copy()
    work["dist"] = [haversine_km(float(a), float(b), lat, lon) for a,b in zip(work["latitude_deg"], work["longitude_deg"])]
    best = work.sort_values("dist").iloc[0]
    return str(best["ident"]) if float(best["dist"]) <= max_km else None


def make_points_map(points: list[dict[str,Any]], dark_mode: bool) -> folium.Map:
    if not points:
        return folium.Map(location=[49.7, 15.3], zoom_start=7, tiles="CartoDB dark_matter" if dark_mode else "OpenStreetMap")
    center = [sum(p["lat"] for p in points)/len(points), sum(p["lon"] for p in points)/len(points)]
    m = folium.Map(location=center, zoom_start=9, tiles="CartoDB dark_matter" if dark_mode else "OpenStreetMap")
    coords = [(p["lat"], p["lon"]) for p in points]
    folium.PolyLine(coords, weight=2.4, opacity=.82).add_to(m)
    folium.Marker(coords[0], tooltip="Start", icon=folium.Icon(color="green")).add_to(m)
    folium.Marker(coords[-1], tooltip="End", icon=folium.Icon(color="red")).add_to(m)
    return m


def make_map(df: pd.DataFrame, dark_mode: bool) -> folium.Map:
    pts = read_all_track_points()
    if pts.empty:
        return folium.Map(location=[49.7, 15.3], zoom_start=7, tiles="CartoDB dark_matter" if dark_mode else "OpenStreetMap")
    if df is not None and not df.empty:
        ids = set(pd.to_numeric(df["id"], errors="coerce").dropna().astype(int).tolist())
        pts = pts[pts["flight_id"].isin(ids)]
    if pts.empty:
        return folium.Map(location=[49.7, 15.3], zoom_start=7, tiles="CartoDB dark_matter" if dark_mode else "OpenStreetMap")
    center = [pts["latitude_deg"].mean(), pts["longitude_deg"].mean()]
    m = folium.Map(location=center, zoom_start=7, tiles="CartoDB dark_matter" if dark_mode else "OpenStreetMap")
    for tid, group in pts.groupby("track_id"):
        group = group.sort_values("seq")
        coords = list(zip(group["latitude_deg"], group["longitude_deg"]))
        if len(coords) >= 2:
            label = f"{group.iloc[0].get('date','')} {group.iloc[0].get('registration','')} {group.iloc[0].get('departure','')}–{group.iloc[0].get('arrival','')}"
            folium.PolyLine(coords, weight=1.5, opacity=.45, tooltip=label).add_to(m)
    return m


def show_track_profile(points_df: pd.DataFrame):
    if points_df.empty:
        return
    p = points_df.copy()
    if "time_utc" in p.columns:
        p["time"] = pd.to_datetime(p["time_utc"], errors="coerce", utc=True).dt.tz_convert(LOCAL_TZ)
    elif "time" in p.columns:
        p["time"] = pd.to_datetime(p["time"], errors="coerce", utc=True).dt.tz_convert(LOCAL_TZ)
    else:
        p["time"] = range(len(p))
    if "altitude_m" not in p.columns and "alt_m" in p.columns:
        p["altitude_m"] = p["alt_m"]
    if "speed_kmh" not in p.columns:
        p["speed_kmh"] = None
    p["altitude_ft"] = pd.to_numeric(p.get("altitude_m"), errors="coerce") * 3.28084
    p["speed_kmh"] = pd.to_numeric(p.get("speed_kmh"), errors="coerce")
    fig = go.Figure()
    if p["altitude_ft"].notna().any():
        fig.add_trace(go.Scatter(x=p["time"], y=p["altitude_ft"], mode="lines", name="Altitude ft", yaxis="y"))
    if p["speed_kmh"].notna().any():
        fig.add_trace(go.Scatter(x=p["time"], y=p["speed_kmh"], mode="lines", name="GPS speed km/h", yaxis="y2"))
    fig.update_layout(
        title="Profil letu",
        template="plotly_dark",
        paper_bgcolor="rgba(0,0,0,0)",
        plot_bgcolor="rgba(0,0,0,0)",
        yaxis=dict(title="Altitude ft"),
        yaxis2=dict(title="GPS speed km/h", overlaying="y", side="right"),
        legend=dict(orientation="h"),
        height=420,
    )
    st.plotly_chart(fig, use_container_width=True)


def page_map(flights: pd.DataFrame, dark_mode: bool):
    st.markdown("## Mapa")
    f = filters(compute_metrics(flights))
    st_folium(make_map(f, dark_mode), height=620, use_container_width=True, key="all_map")


def save_track(flight_id: int, file_name: str, parsed: dict[str,Any], replace_existing: bool = False) -> int:
    points = parsed.get("points") or []
    if not points:
        raise ValueError("Track neobsahuje použitelné body.")
    with connect() as con:
        if replace_existing:
            con.execute("DELETE FROM flight_tracks WHERE flight_id = ?", (flight_id,))
        cur = con.execute(
            """
            INSERT INTO flight_tracks (flight_id, file_name, imported_at, point_count, distance_km, start_utc, end_utc, min_alt_m, max_alt_m, coordinates_json)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (flight_id, file_name, _now_iso(), len(points), parsed.get("distance_km"), parsed.get("start_utc"), parsed.get("end_utc"), parsed.get("min_alt_m"), parsed.get("max_alt_m"), json.dumps(points, ensure_ascii=False)),
        )
        track_id = int(cur.lastrowid)
        insert_track_points(con, track_id, points)
        record_audit(con, "save_track", "flight_tracks", track_id, {"flight_id": flight_id, "file_name": file_name, "replace_existing": replace_existing})
        con.commit()
    st.cache_data.clear()
    auto_backup_after_change("save_track")
    return track_id


def delete_track(track_id: int) -> None:
    with connect() as con:
        con.execute("DELETE FROM flight_tracks WHERE id = ?", (track_id,))
        record_audit(con, "delete_track", "flight_tracks", track_id, None)
        con.commit()
    st.cache_data.clear()
    auto_backup_after_change("delete_track")


def delete_flight(flight_id: int) -> None:
    with connect() as con:
        try:
            con.execute("PRAGMA foreign_keys = ON")
            ensure_schema_compatibility(con)
        except Exception:
            pass
        try:
            track_rows = con.execute("SELECT id FROM flight_tracks WHERE flight_id = ?", (flight_id,)).fetchall()
            track_ids = [int(r["id"] if isinstance(r, sqlite3.Row) else r[0]) for r in track_rows]
            for tid in track_ids:
                try:
                    con.execute("DELETE FROM track_points WHERE track_id = ?", (tid,))
                except Exception:
                    pass
        except Exception:
            track_ids = []
        try:
            con.execute("DELETE FROM flight_tracks WHERE flight_id = ?", (flight_id,))
        except Exception:
            pass
        con.execute("DELETE FROM flights WHERE id = ?", (flight_id,))
        record_audit(con, "delete_flight", "flights", flight_id, {"deleted_track_ids": track_ids})
        con.commit()
    st.cache_data.clear()
    auto_backup_after_change("delete_flight")


def ensure_schema_compatibility(con: sqlite3.Connection) -> None:
    """Small forward-compatible migrations for deployed SQLite files."""
    def cols(table: str) -> set[str]:
        try:
            return {r[1] for r in con.execute(f"PRAGMA table_info({table})").fetchall()}
        except Exception:
            return set()
    audit_cols = cols("audit_log")
    for name, ddl in [
        ("actor", "actor TEXT"),
        ("object_type", "object_type TEXT"),
        ("object_id", "object_id TEXT"),
        ("detail_json", "detail_json TEXT"),
    ]:
        if name not in audit_cols:
            try: con.execute(f"ALTER TABLE audit_log ADD COLUMN {ddl}")
            except Exception: pass
    track_cols = cols("flight_tracks")
    for name, ddl in [("min_alt_m","min_alt_m REAL"),("max_alt_m","max_alt_m REAL")]:
        if name not in track_cols:
            try: con.execute(f"ALTER TABLE flight_tracks ADD COLUMN {ddl}")
            except Exception: pass


def upsert_flight_from_legacy_row(con: sqlite3.Connection, row: pd.Series):
    con.execute(
        """
        INSERT INTO flights (date, evidence, registration, aircraft_type, aircraft_class, departure, arrival, off_block, takeoff, landing, on_block, starts, commander, instructor, role, task, price_per_hour, note)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        [row.get(c) for c in ["date","evidence","registration","aircraft_type","aircraft_class","departure","arrival","off_block","takeoff","landing","on_block","starts","commander","instructor","role","task","price_per_hour","note"]]
    )

# -----------------------------------------------------------------------------
# Styling and forms
# -----------------------------------------------------------------------------

# -----------------------------------------------------------------------------
# Pages
# -----------------------------------------------------------------------------

def page_rates(rates: pd.DataFrame):
    st.markdown("## Ceník")
    st.dataframe(rates, use_container_width=True, height=420)
    if require_admin():
        st.markdown("### Přidat / upravit cenu")
        with st.form("rate_form"):
            c1,c2,c3,c4 = st.columns(4)
            with c1: reg = st.text_input("Imatrikulace")
            with c2: typ = st.text_input("Typ")
            with c3: valid = st.date_input("Platí od")
            with c4: price = st.number_input("Kč/h", min_value=0.0, step=10.0)
            dry = st.number_input("Suchá hodina", min_value=0.0, step=10.0)
            if st.form_submit_button("Uložit cenu", type="primary", use_container_width=True):
                upsert_rate({"registration": reg, "aircraft_type": typ, "valid_from": valid.strftime("%Y-%m-%d"), "price_per_hour": price, "dry_price_per_hour": dry})
                st.success("Cena uložena.")
        ids = rates["id"].tolist() if not rates.empty else []
        if ids:
            rid = st.selectbox("Smazat záznam ceníku", ids)
            if st.button("Smazat cenu", type="secondary"):
                delete_rate(int(rid)); st.success("Cena smazána."); st.rerun()


def upsert_airport(data: dict[str, Any]) -> None:
    with connect() as con:
        now = _now_iso()
        ident = (data.get("ident") or "").upper().strip()
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
                data.get("name"),
                data.get("airport_type") or "small_airport",
                data.get("iso_country"),
                data.get("iso_region"),
                data.get("municipality"),
                data.get("latitude_deg"),
                data.get("longitude_deg"),
                data.get("elevation_ft"),
                data.get("gps_code") or ident,
                data.get("iata_code"),
                data.get("local_code") or ident,
                "manual_override",
                int(data.get("active", 1)),
                int(data.get("closed", 0)),
                "manual_verified",
                now,
                now,
                json.dumps(data, ensure_ascii=False),
            ),
        )
        record_audit(con, "upsert_airport", "airports", ident, data)
        con.commit()
    st.cache_data.clear()
    auto_backup_after_change("upsert_airport")


def page_database():
    st.markdown("## Databáze")
    airports = read_airports(active_only=False)
    aircraft = read_table("aircraft")
    tracks = read_table("flight_tracks")
    points = read_table("track_points")
    c1,c2,c3,c4 = st.columns(4)
    with c1: metric_card("Letiště / plochy", str(len(airports)), "světová DB + ruční lokální změny")
    with c2: metric_card("Letadla", str(len(aircraft)), "registrace")
    with c3: metric_card("Tracky", str(len(tracks)), "KML soubory")
    with c4: metric_card("GPS body", str(len(points)), "normalizováno")
    tab_airports, tab_aircraft, tab_backup, tab_meta = st.tabs(["Letiště", "Letadla", "Záloha", "Meta"])
    with tab_airports:
        c1,c2,c3 = st.columns([1,1,2])
        with c1:
            country = st.selectbox("Země", ["Vše"] + sorted([x for x in airports.get("iso_country", pd.Series(dtype=str)).dropna().unique() if x]), index=0)
        with c2:
            source = st.selectbox("Zdroj", ["Vše"] + sorted([x for x in airports.get("source", pd.Series(dtype=str)).dropna().unique() if x]), index=0)
        with c3:
            q = st.text_input("Hledat", key="airport_search")
        view = airports.copy()
        if country != "Vše": view = view[view["iso_country"].eq(country)]
        if source != "Vše": view = view[view["source"].eq(source)]
        if q:
            ql=q.lower(); view = view[view.apply(lambda r: ql in " ".join([str(x) for x in r.values]).lower(), axis=1)]
        st.dataframe(view.head(2000), use_container_width=True, height=420)
        if len(view) > 2000:
            st.caption(f"Zobrazeno prvních 2000 z {len(view)} záznamů. Použij hledání nebo filtr země.")
        st.download_button("Export letišť CSV", data=airports.to_csv(index=False).encode("utf-8"), file_name="airports_export.csv", mime="text/csv", use_container_width=True)
        st.caption("Světová letištní databáze je uložená v samostatném souboru data/airports_full.sqlite. Ruční úpravy a UL plochy se ukládají do hlavní logbook.sqlite a mají přednost.")
        st.markdown("### Přidat / upravit letiště")
        if require_admin():
            with st.form("airport_form"):
                c1,c2,c3,c4 = st.columns(4)
                with c1: ident = st.text_input("Ident", placeholder="LKKA")
                with c2: name = st.text_input("Název")
                with c3: country_f = st.text_input("Země", value="CZ")
                with c4: municipality = st.text_input("Město / obec")
                c5,c6,c7,c8 = st.columns(4)
                with c5: lat = st.number_input("Latitude", format="%.6f")
                with c6: lon = st.number_input("Longitude", format="%.6f")
                with c7: typ = st.selectbox("Typ", ["small_airport","medium_airport","large_airport","heliport","closed","ul_field","private_strip"])
                with c8: active = st.checkbox("Aktivní", value=True)
                if st.form_submit_button("Uložit letiště", type="primary", use_container_width=True):
                    if not ident or not name or not lat or not lon:
                        st.error("Vyplň ident, název, latitude a longitude.")
                    else:
                        upsert_airport({"ident": ident, "name": name, "airport_type": typ, "iso_country": country_f, "municipality": municipality, "latitude_deg": lat, "longitude_deg": lon, "active": 1 if active else 0, "closed": 0 if active else 1})
                        st.success("Letiště uloženo.")
    with tab_aircraft:
        st.dataframe(aircraft, use_container_width=True, height=420)
        if require_admin():
            st.markdown("### Přidat / upravit letadlo")
            with st.form("aircraft_form"):
                c1,c2,c3,c4 = st.columns(4)
                with c1: reg = st.text_input("Registrace")
                with c2: typ = st.text_input("Typ")
                with c3: cls = st.selectbox("Třída", CLASS_OPTIONS)
                with c4: ev = st.selectbox("Evidence", EVIDENCE_OPTIONS)
                c5,c6 = st.columns(2)
                with c5: default_price = st.number_input("Výchozí Kč/h", min_value=0.0, step=10.0)
                with c6: active = st.checkbox("Aktivní", value=True, key="aircraft_active")
                note = st.text_input("Poznámka")
                if st.form_submit_button("Uložit letadlo", type="primary", use_container_width=True):
                    upsert_aircraft({"registration": normalize_registration(reg), "aircraft_type": typ, "icao_type": typ, "aircraft_class": cls, "evidence": ev, "default_price_per_hour": default_price, "active": 1 if active else 0, "note": note})
                    st.success("Letadlo uloženo.")
    with tab_backup:
        backup_restore_panel()
    with tab_meta:
        meta = get_meta()
        st.dataframe(pd.DataFrame([{"key":k,"value":v} for k,v in meta.items()]), use_container_width=True)


def page_check(flights: pd.DataFrame):
    st.markdown("## Kontrola")
    m = compute_metrics(flights)
    issues=[]
    for _,r in m.iterrows():
        if r.get("air_minutes") and r.get("block_minutes") and r["air_minutes"] > r["block_minutes"]:
            issues.append({"id":r["id"],"problém":"Air time > block time"})
        if not r.get("departure") or not r.get("arrival"):
            issues.append({"id":r["id"],"problém":"Chybí letiště"})
        if not r.get("price_per_hour"):
            issues.append({"id":r["id"],"problém":"Chybí cena"})
    if issues:
        st.dataframe(pd.DataFrame(issues), use_container_width=True)
    else:
        st.success("Bez nalezených problémů.")


def export_excel(df: pd.DataFrame) -> bytes:
    m = compute_metrics(df)
    wb = Workbook(); ws = wb.active; ws.title="Lety"
    cols = ["date","evidence","registration","aircraft_type","aircraft_class","departure","arrival","off_block","takeoff","landing","on_block","block_time","air_time","starts","commander","instructor","role","task","price_per_hour","cost_label","gps_tracks","gps_km","note"]
    ws.append(cols)
    for _,r in m.iterrows():
        ws.append([r.get(c) for c in cols])
    style_worksheet(ws)
    ws2=wb.create_sheet("Souhrn"); sm=summary_metrics(m); ws2.append(["Položka","Hodnota"]); [ws2.append([k,v]) for k,v in sm.items()]
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

def render_sidebar_toggle() -> None:
    """One smooth sidebar toggle controlled in the browser, without Streamlit rerun."""
    components.html(
        """
        <script>
        (function() {
          const doc = window.parent.document;
          const btnId = 'lb-sidebar-toggle';
          const storageKey = 'lb_sidebar_hidden_v3';

          function hideNativeButtons() {
            const selectors = [
              '[data-testid="stSidebarHeader"]',
              '[data-testid="stSidebarCollapseButton"]',
              '[data-testid="stSidebarCollapsedControl"]',
              '[data-testid="collapsedControl"]',
              'section[data-testid="stSidebar"] button[kind="headerNoPadding"]',
              'section[data-testid="stSidebar"] button[data-testid="baseButton-headerNoPadding"]',
              'button[title*="sidebar" i]',
              'button[aria-label*="sidebar" i]',
              'button[title*="Collapse" i]',
              'button[aria-label*="Collapse" i]',
              'button[title*="Close" i]',
              'button[aria-label*="Close" i]'
            ];
            selectors.forEach(sel => {
              try {
                doc.querySelectorAll(sel).forEach(el => {
                  if (el.id !== btnId) {
                    el.style.setProperty('display', 'none', 'important');
                    el.style.setProperty('visibility', 'hidden', 'important');
                    el.style.setProperty('pointer-events', 'none', 'important');
                  }
                });
              } catch(e) {}
            });
          }

          function ensureButton() {
            let btn = doc.getElementById(btnId);
            if (!btn) {
              btn = doc.createElement('button');
              btn.id = btnId;
              btn.type = 'button';
              btn.setAttribute('aria-label', 'Skrýt nebo zobrazit menu');
              btn.title = 'Skrýt / zobrazit menu';
              doc.body.appendChild(btn);
              btn.addEventListener('click', function(ev) {
                ev.preventDefault();
                setHidden(!doc.body.classList.contains('lb-sidebar-hidden'));
              });
            }
            return btn;
          }

          function setHidden(hidden) {
            doc.body.classList.toggle('lb-sidebar-hidden', hidden);
            try { window.parent.localStorage.setItem(storageKey, hidden ? '1' : '0'); } catch(e) {}
            const btn = ensureButton();
            btn.textContent = hidden ? '›' : '‹';
          }

          hideNativeButtons();
          const saved = (function() {
            try { return window.parent.localStorage.getItem(storageKey) === '1'; }
            catch(e) { return false; }
          })();
          setHidden(saved);
          if (!window.parent.__lbSidebarObserver) {
            window.parent.__lbSidebarObserver = new MutationObserver(hideNativeButtons);
            window.parent.__lbSidebarObserver.observe(doc.body, {childList: true, subtree: true});
          }
          setTimeout(hideNativeButtons, 250);
          setTimeout(hideNativeButtons, 1000);
        })();
        </script>
        """,
        height=0,
        width=0,
    )


# -----------------------------------------------------------------------------
# Main
# -----------------------------------------------------------------------------

def main():
    st.set_page_config(page_title="Letový zápisník", layout="wide", initial_sidebar_state="expanded")
    with connect(): pass
    if "page" not in st.session_state:
        st.session_state["page"] = "Dashboard"
    with st.sidebar:
        # Aplikace běží trvale v tmavém režimu; přepínač je z finálního UI odstraněn.
        dark_mode = True
        st.markdown("## Letový zápisník")
        st.markdown(f'<div class="sidebar-version">{APP_VERSION}</div>', unsafe_allow_html=True)
        render_sidebar_nav()
        render_auth_sidebar()
    apply_ui_theme(dark_mode)
    render_sidebar_toggle()
    app_header()
    page = st.session_state.get("page", "Dashboard")
    flights = read_flights()
    rates = read_table("rates")
    if not rates.empty:
        rates["registration"] = rates["registration"].fillna("").str.upper()
    if page == "Dashboard": page_dashboard(flights)
    elif page == "Lety": page_logbook(flights, rates, dark_mode)
    elif page == "Nový let": page_new_flight(rates, dark_mode)
    elif page == "Mapa": page_map(flights, dark_mode)
    elif page == "Ceník": page_rates(rates)
    elif page == "Databáze": page_database()
    elif page == "Kontrola": page_check(flights)
    elif page == "Export": page_export(flights)


if __name__ == "__main__":
    main()
