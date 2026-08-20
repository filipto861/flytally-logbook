from __future__ import annotations

import base64
import html
import hashlib
import hmac
import json
import math
import re
import sqlite3
import xml.etree.ElementTree as ET
from datetime import date, datetime, time, timezone, timedelta
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
from io import BytesIO
from typing import Any
from urllib.parse import urlencode


import numpy as np
import pandas as pd
import streamlit as st
import streamlit.components.v1 as components

from logbook_core.config import (
    AIRPORT_OVERRIDES_PATH, AIRPORTS_CSV_PATH, AIRPORTS_DB_PATH, APP_VERSION,
    BILLING_BASIS_OPTIONS, CLASS_OPTIONS, DATA_DIR, DB_PATH, DB_SCHEMA_VERSION,
    EVIDENCE_OPTIONS, LOCAL_TZ, NAV_ITEMS, OURAIRPORTS_AIRPORTS_URL, ROLE_OPTIONS,
)
from logbook_core.schema import SCHEMA
from logbook_core.auth import (
    PASSWORD_MIN_LENGTH, activate_legacy_profile, authenticate_user, change_email, change_password,
    ensure_auth_schema, legacy_profile_needs_activation, register_user, verify_password,
    admin_set_user_password, set_user_active, set_user_role,
)
from logbook_core.tenancy import DEFAULT_USER_ID, USER_SCOPED_TABLES, ensure_tenancy_schema, normalize_user_id
from logbook_core.permissions import AccessDenied, require_owned_record, strict_user_id
from logbook_core.metrics import (
    build_summary, compute_metrics, fmt_minutes, fmt_money, minutes_diff,
    normalize_date, normalize_registration, normalize_text, normalize_time, parse_time_to_minutes, stat_minutes,
)
from logbook_core.pricing import lookup_latest_rate
from logbook_core.tracks import (
    detect_kml_source, detect_takeoff_landing, dt_hhmm, extract_registration_from_filename,
    haversine_km, inferred_clock_times, normalize_track_points, parse_iso, parse_kml_bytes, point_local_date,
    point_local_dt, point_local_hhmm, profile_from_points, track_distance_km, track_stats,
)
from logbook_core.smart_import import analyze_track, split_track_points
from logbook_core.exports import (
    _export_date_bounds, _export_prefix, build_print_html, export_excel, make_airport_summary,
    make_group_summary, make_logbook_export_df, make_route_summary, make_summary_table,
)
from logbook_core.map_engine import (
    build_gps_render_plan, encode_compact_track_points, simplify_track_points,
    viewport_from_coords,
)
from logbook_ui.filters import apply_filters
from logbook_ui.theme import apply_ui_theme, app_header, metric_card, plotly_layout
try:
    from logbook_core.performance import (
        apply_sqlite_pragmas,
        compact_records_json,
        downsample_track_points,
        optimize_sqlite,
    )
except ModuleNotFoundError:
    # Fallback for deployments where only app.py was uploaded.
    def apply_sqlite_pragmas(con: sqlite3.Connection, *, initial: bool = False) -> None:
        read_pragmas = (
            "PRAGMA foreign_keys = ON",
            "PRAGMA busy_timeout = 5000",
            "PRAGMA temp_store = MEMORY",
            "PRAGMA cache_size = -32768",
        )
        init_pragmas = read_pragmas + (
            "PRAGMA journal_mode = WAL",
            "PRAGMA synchronous = NORMAL",
        )
        for pragma in init_pragmas if initial else read_pragmas:
            try:
                con.execute(pragma)
            except sqlite3.DatabaseError:
                pass

    def optimize_sqlite(con: sqlite3.Connection) -> None:
        try:
            con.execute("PRAGMA optimize")
        except sqlite3.DatabaseError:
            pass

    def compact_records_json(df: pd.DataFrame, columns: list[str]) -> str:
        if df.empty:
            return "[]"
        use_cols = [c for c in columns if c in df.columns]
        if not use_cols:
            return "[]"
        records = df[use_cols].fillna("").to_dict(orient="records")
        return json.dumps(records, ensure_ascii=False, separators=(",", ":"), default=str)

    def downsample_track_points(points: list[dict[str, Any]], max_points: int = 900) -> list[dict[str, Any]]:
        if len(points) <= max_points:
            return points
        step = max(1, math.ceil(len(points) / max_points))
        sampled = points[::step]
        if sampled and sampled[-1] != points[-1]:
            sampled.append(points[-1])
        return sampled

_DB_READY = False


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


def _meta_value(con: sqlite3.Connection, key: str, default: str = "") -> str:
    try:
        row = con.execute("SELECT value FROM app_meta WHERE key = ?", (key,)).fetchone()
        return str(row[0]) if row and row[0] is not None else default
    except sqlite3.DatabaseError:
        return default


def _get_secret(section: str, key: str, default: Any = None) -> Any:
    try:
        sec = st.secrets.get(section, {})
        if hasattr(sec, "get"):
            return sec.get(key, default)
    except Exception:
        pass
    return default


def is_admin() -> bool:
    """Return True when the authenticated profile has the persistent admin role."""
    if not is_user_authenticated():
        return False
    try:
        return str(read_user_profile(current_user_id()).get("role") or "user").lower() == "admin"
    except Exception:
        return False


def is_user_authenticated() -> bool:
    return bool(st.session_state.get("user_authenticated")) and int(st.session_state.get("current_user_id", 0) or 0) > 0


def _set_authenticated_user(user_id: int) -> None:
    uid = strict_user_id(user_id)
    st.session_state["user_authenticated"] = True
    st.session_state["current_user_id"] = uid
    st.session_state["page"] = "Dashboard"


def logout_user() -> None:
    for key in ("user_authenticated", "current_user_id", "page", "selected_flight_id", "open_flight_dialog_id"):
        st.session_state.pop(key, None)


def actor_name() -> str:
    if is_user_authenticated():
        name = current_user_display_name()
        return f"{name} (admin)" if is_admin() else name
    return "anonymous"


def current_user_id() -> int:
    """Return the authenticated data owner. No authentication means no user data."""
    if not is_user_authenticated():
        return 0
    return normalize_user_id(st.session_state.get("current_user_id"), DEFAULT_USER_ID)


@st.cache_data(show_spinner=False, ttl=300)
def read_user_profile(user_id: int) -> dict[str, Any]:
    uid = strict_user_id(user_id)
    try:
        with connect() as con:
            row = con.execute(
                """
                SELECT u.id, u.email, u.display_name, u.slug, u.role, u.active, u.created_at, u.updated_at,
                       s.timezone, s.currency, s.home_airport, s.default_role, s.preferences_json,
                       c.last_login_at
                FROM users u
                LEFT JOIN user_settings s ON s.user_id = u.id
                LEFT JOIN user_credentials c ON c.user_id = u.id
                WHERE u.id = ?
                """,
                (uid,),
            ).fetchone()
            return dict(row) if row else {"id": uid, "display_name": "Local pilot"}
    except sqlite3.DatabaseError:
        return {"id": uid, "display_name": "Local pilot"}


def current_user_display_name() -> str:
    profile = read_user_profile(current_user_id())
    return normalize_text(profile.get("display_name")) or "Local pilot"


def _profile_preferences(profile: dict[str, Any] | None = None) -> dict[str, Any]:
    profile = profile or read_user_profile(current_user_id())
    raw = profile.get("preferences_json")
    if isinstance(raw, dict):
        return dict(raw)
    try:
        parsed = json.loads(str(raw or "{}"))
        return parsed if isinstance(parsed, dict) else {}
    except Exception:
        return {}


def current_user_currency() -> str:
    profile = read_user_profile(current_user_id())
    currency = str(profile.get("currency") or "CZK").strip().upper()
    return currency if currency in {"CZK", "EUR", "USD", "GBP"} else "CZK"


def currency_symbol(currency: str | None = None) -> str:
    code = str(currency or current_user_currency()).upper()
    return {"CZK": "Kč", "EUR": "€", "USD": "$", "GBP": "£"}.get(code, code)


def current_user_timezone() -> ZoneInfo:
    profile = read_user_profile(current_user_id())
    name = str(profile.get("timezone") or "Europe/Prague").strip()
    try:
        return ZoneInfo(name)
    except (ZoneInfoNotFoundError, ValueError):
        return LOCAL_TZ


def current_user_default_evidence() -> str:
    profile = read_user_profile(current_user_id())
    value = str(_profile_preferences(profile).get("default_evidence") or "ULL").upper().strip()
    return value if value in EVIDENCE_OPTIONS else "ULL"


def current_user_default_role() -> str:
    profile = read_user_profile(current_user_id())
    value = str(profile.get("default_role") or "PIC").upper().strip()
    return value if value in ROLE_OPTIONS else "PIC"


def current_user_home_airport() -> str:
    profile = read_user_profile(current_user_id())
    return str(profile.get("home_airport") or "").upper().strip()


def _auth_state() -> tuple[bool, dict[str, Any]]:
    """Return whether the legacy owner still needs activation and its profile."""
    with connect() as con:
        needs_activation = legacy_profile_needs_activation(con)
    return needs_activation, read_user_profile(DEFAULT_USER_ID)


def render_auth_gate() -> bool:
    """Render login/registration and stop all user-data UI until authenticated."""
    if is_user_authenticated():
        try:
            profile = read_user_profile(current_user_id())
            if int(profile.get("active", 1) or 0) == 1:
                return True
        except Exception:
            pass
        logout_user()

    apply_ui_theme(True)
    st.markdown(f"### Letový zápisník · {APP_VERSION}")
    st.title("Přihlášení")
    st.caption("Každý profil má vlastní lety, letadla, GPS tracky, ceník a vlastní letiště.")

    needs_activation, legacy_profile = _auth_state()
    if needs_activation:
        st.info("Nejdříve aktivujte svůj stávající profil. Všechny dosavadní lety zůstanou přiřazené tomuto účtu.")
        admin_password = str(_get_secret("auth", "admin_password", "") or "")
        if not admin_password:
            st.error("Pro bezpečnou aktivaci stávajícího profilu musí být ve Streamlit Secrets nastaveno [auth].admin_password. Bez něj by si veřejně dostupný profil mohl převzít někdo cizí.")
            st.code('[auth]\nadmin_password = "VAŠE_SOUČASNÉ_ADMIN_HESLO"', language="toml")
            return False
        with st.form("activate_legacy_profile_form"):
            display_name = st.text_input("Jméno", value=str(legacy_profile.get("display_name") or ""))
            email = st.text_input("E-mail")
            password = st.text_input(f"Nové heslo (min. {PASSWORD_MIN_LENGTH} znaků)", type="password")
            password2 = st.text_input("Potvrzení nového hesla", type="password")
            admin_pwd = st.text_input("Současné heslo správce aplikace", type="password")
            submitted = st.form_submit_button("Aktivovat můj stávající profil", use_container_width=True)
        if submitted:
            if not hmac.compare_digest(admin_pwd, admin_password):
                st.error("Heslo správce není správné.")
                return False
            if password != password2:
                st.error("Nová hesla se neshodují.")
                return False
            with connect() as con:
                result = activate_legacy_profile(
                    con, email=email, display_name=display_name, password=password
                )
                if result.ok:
                    con.execute(
                        "INSERT INTO audit_log (user_id, created_at, actor, action, object_type, object_id, detail_json) VALUES (?, ?, ?, ?, ?, ?, ?)",
                        (DEFAULT_USER_ID, _now_iso(), str(display_name).strip(), "activate_profile", "user", str(DEFAULT_USER_ID), json.dumps({"email": str(email).strip().lower()}, ensure_ascii=False)),
                    )
                    con.commit()
            if result.ok and result.user_id:
                read_user_profile.clear()
                _set_authenticated_user(result.user_id)
                auto_backup_after_change("activate_profile")
                st.rerun()
            st.error(result.error or "Profil se nepodařilo aktivovat.")
        return False

    allow_registration = str(_get_secret("auth", "allow_registration", "false") or "false").strip().lower() in {"1", "true", "yes", "on"}
    auth_tabs = st.tabs(["Přihlásit se"] + (["Vytvořit účet"] if allow_registration else []))
    with auth_tabs[0]:
        with st.form("user_login_form"):
            email = st.text_input("E-mail", key="login_email")
            password = st.text_input("Heslo", type="password", key="login_password")
            submitted = st.form_submit_button("Přihlásit se", use_container_width=True)
        if submitted:
            with connect() as con:
                result = authenticate_user(con, email, password)
                if result.ok:
                    con.commit()
            if result.ok and result.user_id:
                _set_authenticated_user(result.user_id)
                st.rerun()
            st.error(result.error or "Přihlášení se nepodařilo.")

    if allow_registration:
        with auth_tabs[1]:
            st.caption("Nový účet začne s prázdným letovým zápisníkem. E-mail zatím není ověřován.")
            with st.form("user_register_form"):
                display_name = st.text_input("Jméno", key="register_name")
                email = st.text_input("E-mail", key="register_email")
                password = st.text_input(f"Heslo (min. {PASSWORD_MIN_LENGTH} znaků)", type="password", key="register_password")
                password2 = st.text_input("Potvrzení hesla", type="password", key="register_password2")
                submitted = st.form_submit_button("Vytvořit účet", use_container_width=True)
            if submitted:
                if password != password2:
                    st.error("Hesla se neshodují.")
                    return False
                with connect() as con:
                    result = register_user(con, email=email, display_name=display_name, password=password)
                    if result.ok:
                        con.commit()
                if result.ok and result.user_id:
                    read_user_profile.clear()
                    _set_authenticated_user(result.user_id)
                    auto_backup_after_change("register_user")
                    st.rerun()
                st.error(result.error or "Účet se nepodařilo vytvořit.")
    else:
        st.caption("Registrace nových uživatelů je zatím vypnutá. Lze ji později povolit v Streamlit Secrets.")
    return False


def render_user_sidebar() -> None:
    profile = read_user_profile(current_user_id())
    st.divider()
    st.markdown(f"**👤 {html.escape(str(profile.get('display_name') or 'Pilot'))}**")
    if profile.get("email"):
        st.caption(str(profile.get("email")))
    if str(profile.get("role") or "user").lower() == "admin":
        st.caption("Správce aplikace")
    if st.button("Odhlásit se", use_container_width=True, key="user_logout"):
        logout_user()
        st.rerun()


def _clear_cached_function(name: str) -> None:
    """Clear one Streamlit cached function if it is already defined."""
    try:
        fn = globals().get(name)
        clear = getattr(fn, "clear", None)
        if callable(clear):
            clear()
    except Exception:
        pass


def invalidate_cached_data(scope: str = "all") -> None:
    """Invalidate only caches affected by a committed database write.

    Older versions called ``st.cache_data.clear()`` after every edit.  That also
    discarded expensive, unrelated caches such as the world-airport catalogue and
    map preparation.  Scoped invalidation keeps the UI warm while still making
    writes visible immediately.
    """
    scope = str(scope or "all").lower()
    if scope in {"all", "database", "restore"}:
        try:
            st.cache_data.clear()
        except Exception:
            pass
        _clear_cached_function("airport_search_index")
        return

    names: set[str] = {"read_table", "read_audit_log", "read_logbook_counts"}  # audit/meta are updated by every write
    if scope in {"flights", "flight"}:
        names.update({
            "read_flights", "read_aircraft_usage_summary", "read_tracks_joined", "read_tracks_joined_for_flights",
            "read_track_metadata_for_flights", "read_track_map_records_for_flights",
            "cached_route_overview_map_html", "cached_track_map_html",
            "build_database_health_report",
        })
    elif scope in {"flight_tracks", "track_points", "tracks", "track"}:
        names.update({
            "read_track_counts", "read_flights", "read_tracks_joined",
            "read_tracks_joined_for_flights", "read_track_metadata_for_flights",
            "read_sampled_track_points", "read_track_map_records_for_flights",
            "read_tracks_for_flight", "cached_track_map_html",
            "build_database_health_report",
        })
    elif scope in {"rates", "rate"}:
        names.update({"read_rates"})
    elif scope in {"aircraft"}:
        names.update({"read_aircraft_catalog"})
    elif scope in {"airports", "airport"}:
        names.update({
            "read_airports", "airport_coords_for_idents", "airport_coord_lookup",
            "cached_route_overview_map_html", "build_database_health_report",
            "read_airport_registry_count",
        })
    else:
        # Unknown small table: clear generic table reads, not the entire app cache.
        names.update({"build_database_health_report"})

    for name in names:
        _clear_cached_function(name)
    if scope in {"airports", "airport"}:
        _clear_cached_function("airport_search_index")


def require_admin() -> bool:
    if is_admin():
        return True
    st.warning("Tato akce je dostupná jen po přihlášení jako admin.")
    return False


def record_audit(con: sqlite3.Connection, action: str, object_type: str | None = None, object_id: Any = None, detail: Any = None) -> None:
    payload = json.dumps(detail, ensure_ascii=False, default=str) if detail is not None else None
    params = (current_user_id(), _now_iso(), actor_name(), action, object_type, str(object_id) if object_id is not None else None, payload)
    try:
        con.execute(
            "INSERT INTO audit_log (user_id, created_at, actor, action, object_type, object_id, detail_json) VALUES (?, ?, ?, ?, ?, ?, ?)",
            params,
        )
    except sqlite3.OperationalError:
        try:
            ensure_schema_compatibility(con)
            con.execute(
                "INSERT INTO audit_log (user_id, created_at, actor, action, object_type, object_id, detail_json) VALUES (?, ?, ?, ?, ?, ?, ?)",
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
    params = (current_user_id(), _now_iso(), actor_name(), action, object_type, str(object_id) if object_id is not None else None, payload)
    try:
        con.execute(
            "INSERT INTO audit_log (user_id, created_at, actor, action, object_type, object_id, detail_json) VALUES (?, ?, ?, ?, ?, ?, ?)",
            params,
        )
    except sqlite3.OperationalError:
        try:
            ensure_schema_compatibility(con)
            con.execute(
                "INSERT INTO audit_log (user_id, created_at, actor, action, object_type, object_id, detail_json) VALUES (?, ?, ?, ?, ?, ?, ?)",
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
    # requests is only needed when a backup is actually executed. Keeping it out
    # of the normal import path trims cold-start work for everyday navigation.
    import requests

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
    invalidate_cached_data("app_meta")

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
        invalidate_cached_data("app_meta")
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
    global _DB_READY
    _DB_READY = False
    with connect() as con:
        record_audit(con, "restore_database", "database", None, {"file": uploaded_file.name})
        con.commit()
    invalidate_cached_data("restore")


def initialize_database(con: sqlite3.Connection) -> None:
    """Fast, idempotent database bootstrap.

    Schema creation stays defensive, but expensive data migrations are guarded by
    persistent markers so they run once per database instead of on every cold
    Streamlit process start.
    """
    apply_sqlite_pragmas(con, initial=True)
    con.executescript(SCHEMA)
    # v0.55 introduces ownership columns while keeping the current single-user UX.
    # Both helpers are idempotent and safely upgrade the existing SQLite file.
    ensure_schema_compatibility(con)
    ensure_tenancy_schema(con)
    ensure_auth_schema(con)
    # Re-run idempotent schema DDL because the tenancy migration may rebuild
    # tables with old global UNIQUE constraints; this restores standard indexes.
    con.executescript(SCHEMA)

    schema_version = _meta_value(con, "schema_version", "0")
    if schema_version != str(DB_SCHEMA_VERSION):
        _set_meta(con, "schema_version", DB_SCHEMA_VERSION)

    # These helpers contain their own migration/hash markers. On a warm/current
    # database they reduce to a tiny metadata lookup instead of scanning tables.
    _seed_airports_from_overrides(con)
    _seed_aircraft_from_existing_data(con)
    _backfill_track_points(con)
    optimize_sqlite(con)
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
        apply_sqlite_pragmas(con, initial=False)
    return con


def _seed_airports_from_overrides(con: sqlite3.Connection) -> None:
    if not AIRPORT_OVERRIDES_PATH.exists():
        return
    try:
        raw = AIRPORT_OVERRIDES_PATH.read_bytes()
        digest = hashlib.sha1(raw).hexdigest()
    except Exception:
        return
    if _meta_value(con, "airport_overrides_sha1") == digest:
        return
    try:
        df = pd.read_csv(BytesIO(raw))
    except Exception:
        return
    if not df.empty:
        import_airports_dataframe(con, df, default_source="manual_override", replace_existing=True, user_id=DEFAULT_USER_ID)
    _set_meta(con, "airport_overrides_sha1", digest)


def _seed_aircraft_from_existing_data(con: sqlite3.Connection) -> None:
    if _meta_value(con, "aircraft_seed_v1") == "1":
        return
    rows = con.execute(
        """
        SELECT registration,
               MAX(aircraft_type) AS aircraft_type,
               MAX(aircraft_class) AS aircraft_class,
               MAX(evidence) AS evidence,
               MAX(price_per_hour) AS price_per_hour
        FROM flights
        WHERE user_id = ? AND registration IS NOT NULL AND TRIM(registration) <> ''
        GROUP BY registration
        """,
        (DEFAULT_USER_ID,),
    ).fetchall()
    now = _now_iso()
    for row in rows:
        # Seed only missing profiles. User-maintained aircraft settings must never
        # be rewritten just because a Streamlit process restarted.
        con.execute(
            """
            INSERT OR IGNORE INTO aircraft
            (user_id, registration, aircraft_type, icao_type, aircraft_class, evidence,
             default_price_per_hour, default_role, billing_basis, active, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'PIC', 'BLOCK', 1, ?, ?)
            """,
            (
                DEFAULT_USER_ID,
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
    _set_meta(con, "aircraft_seed_v1", "1")


def _backfill_track_points(con: sqlite3.Connection) -> None:
    """One-time normalization of legacy tracks without track_points rows."""
    if _meta_value(con, "track_points_backfill_v1") == "1":
        return
    try:
        tracks = con.execute(
            """
            SELECT t.id, t.coordinates_json
            FROM flight_tracks t
            WHERE t.user_id = ? AND NOT EXISTS (
                SELECT 1 FROM track_points p WHERE p.track_id = t.id AND p.user_id = t.user_id
            )
            """
            , (DEFAULT_USER_ID,)
        ).fetchall()
    except sqlite3.DatabaseError:
        return
    for tr in tracks:
        try:
            points = json.loads(tr["coordinates_json"] or "[]")
        except Exception:
            points = []
        insert_track_points(con, int(tr["id"]), points, user_id=DEFAULT_USER_ID)
    _set_meta(con, "track_points_backfill_v1", "1")


@st.cache_data(show_spinner=False, ttl=300)
def read_table(table: str, user_id: int | None = None) -> pd.DataFrame:
    with connect() as con:
        if table in USER_SCOPED_TABLES:
            return pd.read_sql_query(f"SELECT * FROM {table} WHERE user_id = ?", con, params=(strict_user_id(user_id),))
        return pd.read_sql_query(f"SELECT * FROM {table}", con)


@st.cache_data(show_spinner=False, ttl=300)
def read_rates(user_id: int) -> pd.DataFrame:
    rates = read_table("rates", user_id)
    if not rates.empty and "registration" in rates.columns:
        rates = rates.copy()
        rates["registration"] = rates["registration"].fillna("").astype(str).str.upper()
    return rates

@st.cache_data(show_spinner=False, ttl=300)
def read_table_count(table: str, user_id: int | None = None) -> int:
    try:
        with connect() as con:
            if table in USER_SCOPED_TABLES:
                row = con.execute(f"SELECT COUNT(*) FROM {table} WHERE user_id = ?", (strict_user_id(user_id),)).fetchone()
            else:
                row = con.execute(f"SELECT COUNT(*) FROM {table}").fetchone()
            return int(row[0]) if row else 0
    except sqlite3.DatabaseError:
        return 0


@st.cache_data(show_spinner=False, ttl=300)
def read_logbook_counts(user_id: int) -> dict[str, int]:
    """Small database header counters in one connection instead of three."""
    try:
        with connect() as con:
            uid = strict_user_id(user_id)
            return {
                "aircraft": int(con.execute("SELECT COUNT(*) FROM aircraft WHERE user_id = ?", (uid,)).fetchone()[0]),
                "tracks": int(con.execute("SELECT COUNT(*) FROM flight_tracks WHERE user_id = ?", (uid,)).fetchone()[0]),
                "points": int(con.execute("SELECT COUNT(*) FROM track_points WHERE user_id = ?", (uid,)).fetchone()[0]),
            }
    except sqlite3.DatabaseError:
        return {"aircraft": 0, "tracks": 0, "points": 0}


@st.cache_data(show_spinner=False, ttl=300)
def read_audit_log(limit: int, user_id: int) -> pd.DataFrame:
    """Read only the newest audit rows; the full audit table can grow indefinitely."""
    limit = max(1, min(int(limit or 500), 5000))
    try:
        with connect() as con:
            return pd.read_sql_query(
                "SELECT * FROM audit_log WHERE user_id = ? ORDER BY id DESC LIMIT ?",
                con,
                params=(strict_user_id(user_id), limit),
            )
    except sqlite3.DatabaseError:
        return pd.DataFrame()


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
    user_id: int = DEFAULT_USER_ID,
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
            strict_user_id(user_id),
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
                INSERT INTO airports (user_id, ident, name, airport_type, iso_country, iso_region, municipality,
                    latitude_deg, longitude_deg, elevation_ft, gps_code, iata_code, local_code,
                    source, active, closed, data_quality, imported_at, updated_at, raw_json)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(user_id, ident) DO UPDATE SET
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
                INSERT OR IGNORE INTO airports (user_id, ident, name, airport_type, iso_country, iso_region, municipality,
                    latitude_deg, longitude_deg, elevation_ft, gps_code, iata_code, local_code,
                    source, active, closed, data_quality, imported_at, updated_at, raw_json)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                params,
            )
        count += 1
    _set_meta(con, f"airport_import_{default_source}", f"{count} rows")
    return count


def connect_airports_ro() -> sqlite3.Connection:
    """Open the fixed world-airport catalogue read-only to avoid locks/writes."""
    uri = f"file:{AIRPORTS_DB_PATH.resolve().as_posix()}?mode=ro"
    return sqlite3.connect(uri, uri=True)


def _airport_query(active_only: bool) -> str:
    # Keep the heavy raw_json payload out of normal UI reads.  It is retained in
    # SQLite for traceability but the airport editor never displays it.
    query = """
        SELECT ident, name, airport_type, iso_country, iso_region, municipality,
               latitude_deg, longitude_deg, elevation_ft, gps_code, iata_code,
               local_code, source, active, closed, data_quality, imported_at, updated_at
        FROM airports
    """
    if active_only:
        query += " WHERE active = 1 AND closed = 0 AND latitude_deg IS NOT NULL AND longitude_deg IS NOT NULL"
    query += " ORDER BY ident"
    return query


def _local_airport_query(active_only: bool) -> str:
    query = """
        SELECT ident, name, airport_type, iso_country, iso_region, municipality,
               latitude_deg, longitude_deg, elevation_ft, gps_code, iata_code,
               local_code, source, active, closed, data_quality, imported_at, updated_at
        FROM airports
        WHERE user_id = ?
    """
    if active_only:
        query += " AND active = 1 AND closed = 0 AND latitude_deg IS NOT NULL AND longitude_deg IS NOT NULL"
    query += " ORDER BY ident"
    return query


@st.cache_data(show_spinner=False, ttl=1800)
def read_airports(active_only: bool, user_id: int) -> pd.DataFrame:
    """Return airport registry from the fixed world DB plus local overrides.

    data/airports_full.sqlite is the stable world airport database. The main
    logbook.sqlite keeps only manual overrides/additions, so flights and KML
    tracks are not overwritten when the airport registry is refreshed. When the
    same ident exists in both databases, the local logbook row wins.
    """
    frames: list[pd.DataFrame] = []
    query = _airport_query(active_only)
    local_query = _local_airport_query(active_only)

    if AIRPORTS_DB_PATH.exists():
        try:
            with connect_airports_ro() as airport_con:
                frames.append(pd.read_sql_query(query, airport_con))
        except Exception:
            pass

    try:
        with connect() as con:
            frames.append(pd.read_sql_query(local_query, con, params=(strict_user_id(user_id),)))
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


@st.cache_data(show_spinner=False, ttl=1800)
def read_airport_registry_count(user_id: int) -> int:
    """Count unique airport idents without materializing the 85k-row catalogue."""
    local_idents: list[str] = []
    try:
        with connect() as con:
            local_idents = [
                str(r[0]).upper().strip()
                for r in con.execute("SELECT ident FROM airports WHERE user_id = ? AND ident IS NOT NULL AND TRIM(ident) <> ''", (strict_user_id(user_id),)).fetchall()
            ]
    except Exception:
        local_idents = []

    if not AIRPORTS_DB_PATH.exists():
        return len(set(local_idents))
    try:
        with connect_airports_ro() as airport_con:
            full_count = int(airport_con.execute("SELECT COUNT(*) FROM airports WHERE ident IS NOT NULL AND TRIM(ident) <> ''").fetchone()[0])
            unique_local = sorted(set(local_idents))
            if not unique_local:
                return full_count
            placeholders = ",".join("?" for _ in unique_local)
            overlap = int(airport_con.execute(
                f"SELECT COUNT(*) FROM airports WHERE UPPER(TRIM(ident)) IN ({placeholders})",
                unique_local,
            ).fetchone()[0])
            return full_count + len(unique_local) - overlap
    except Exception:
        return len(set(local_idents))


@st.cache_data(show_spinner=False, ttl=3600)
def airport_coords_for_idents(idents: tuple[str, ...], user_id: int) -> dict[str, dict[str, Any]]:
    """Load coordinates only for airport idents actually needed by the current view."""
    clean = tuple(sorted({str(x).upper().strip() for x in idents if str(x or '').strip()}))
    if not clean:
        return {}
    placeholders = ",".join("?" for _ in clean)
    query = f"""
        SELECT ident, name, latitude_deg, longitude_deg, source
        FROM airports
        WHERE UPPER(TRIM(ident)) IN ({placeholders})
          AND latitude_deg IS NOT NULL AND longitude_deg IS NOT NULL
    """
    frames: list[pd.DataFrame] = []
    if AIRPORTS_DB_PATH.exists():
        try:
            with connect_airports_ro() as airport_con:
                frames.append(pd.read_sql_query(query, airport_con, params=clean))
        except Exception:
            pass
    try:
        with connect() as con:
            local_query = query.replace("FROM airports", "FROM airports").replace("WHERE UPPER(TRIM(ident))", "WHERE user_id = ? AND UPPER(TRIM(ident))")
            frames.append(pd.read_sql_query(local_query, con, params=(strict_user_id(user_id), *clean)))
    except Exception:
        pass
    if not frames:
        return {}
    df = pd.concat(frames, ignore_index=True, sort=False)
    if df.empty:
        return {}
    df["ident"] = df["ident"].fillna("").astype(str).str.upper().str.strip()
    df["latitude_deg"] = pd.to_numeric(df["latitude_deg"], errors="coerce")
    df["longitude_deg"] = pd.to_numeric(df["longitude_deg"], errors="coerce")
    df = df.dropna(subset=["latitude_deg", "longitude_deg"])
    df = df[df["ident"].ne("")].drop_duplicates(subset=["ident"], keep="last")
    out: dict[str, dict[str, Any]] = {}
    for row in df.itertuples(index=False):
        ident = str(getattr(row, "ident", "") or "").upper()
        if not ident:
            continue
        out[ident] = {
            "ident": ident,
            "name": normalize_text(getattr(row, "name", "")) or ident,
            "lat": float(getattr(row, "latitude_deg")),
            "lon": float(getattr(row, "longitude_deg")),
            "source": normalize_text(getattr(row, "source", "")) or "",
        }
    return out


@st.cache_resource(show_spinner=False)
def airport_search_index(user_id: int) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """In-memory minimal airport index for fast KML endpoint matching.

    Only ident/lat/lon are retained.  The index is built once per server process
    and reused across imports; airport edits explicitly clear this resource.
    """
    query = """
        SELECT ident, latitude_deg, longitude_deg
        FROM airports
        WHERE active = 1 AND closed = 0
          AND latitude_deg IS NOT NULL AND longitude_deg IS NOT NULL
    """
    frames: list[pd.DataFrame] = []
    if AIRPORTS_DB_PATH.exists():
        try:
            with connect_airports_ro() as airport_con:
                frames.append(pd.read_sql_query(query, airport_con))
        except Exception:
            pass
    try:
        with connect() as con:
            local_query = query.replace("WHERE active = 1", "WHERE user_id = ? AND active = 1")
            frames.append(pd.read_sql_query(local_query, con, params=(strict_user_id(user_id),)))
    except Exception:
        pass
    if not frames:
        return np.array([], dtype=object), np.array([], dtype=float), np.array([], dtype=float)
    df = pd.concat(frames, ignore_index=True, sort=False)
    df["ident"] = df["ident"].fillna("").astype(str).str.upper().str.strip()
    df["latitude_deg"] = pd.to_numeric(df["latitude_deg"], errors="coerce")
    df["longitude_deg"] = pd.to_numeric(df["longitude_deg"], errors="coerce")
    df = df.dropna(subset=["latitude_deg", "longitude_deg"])
    df = df[df["ident"].ne("")]
    df = df[
        df["latitude_deg"].between(-90, 90)
        & df["longitude_deg"].between(-180, 180)
    ].drop_duplicates(subset=["ident"], keep="last")
    return (
        df["ident"].to_numpy(dtype=object, copy=True),
        df["latitude_deg"].to_numpy(dtype=float, copy=True),
        df["longitude_deg"].to_numpy(dtype=float, copy=True),
    )


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
    invalidate_cached_data("airports")
    auto_backup_after_change("import_ourairports")
    return count


def import_airport_csv_upload(uploaded_file) -> int:
    df = pd.read_csv(uploaded_file)
    with connect() as con:
        count = import_airports_dataframe(con, df, default_source="user_csv", replace_existing=True, user_id=current_user_id())
        record_audit(con, "import_airport_csv", "airports", None, {"rows": count, "file": getattr(uploaded_file, "name", None)})
        con.commit()
    invalidate_cached_data("airports")
    auto_backup_after_change("import_airport_csv")
    return count


def insert_track_points(con: sqlite3.Connection, track_id: int, points: list[dict[str, Any]], user_id: int) -> None:
    if not points:
        return
    profile = profile_from_points(points)
    if profile.empty:
        return
    rows = []
    for _, p in profile.iterrows():
        speed_kmh = None if pd.isna(p.get("speed_kmh")) else float(p.get("speed_kmh"))
        rows.append((
            strict_user_id(user_id),
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
        (user_id, track_id, seq, time_utc, latitude_deg, longitude_deg, altitude_m,
         segment_km, distance_km, speed_kmh, speed_kt, source)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        rows,
    )

@st.cache_data(show_spinner=False, ttl=300)
def read_track_counts(user_id: int) -> pd.DataFrame:
    with connect() as con:
        return pd.read_sql_query(
            """
            SELECT flight_id, COUNT(*) AS track_count, COALESCE(SUM(distance_km), 0) AS gps_km
            FROM flight_tracks WHERE user_id = ? GROUP BY flight_id
            """,
            con, params=(strict_user_id(user_id),),
        )


@st.cache_data(show_spinner=False, ttl=300)
def read_flights(user_id: int) -> pd.DataFrame:
    """Read flight rows and GPS aggregates in one SQLite round-trip."""
    with connect() as con:
        flights = pd.read_sql_query(
            """
            SELECT f.*,
                   COALESCE(t.track_count, 0) AS track_count,
                   COALESCE(t.gps_km, 0.0) AS gps_km
            FROM flights f
            LEFT JOIN (
                SELECT flight_id, COUNT(*) AS track_count, COALESCE(SUM(distance_km), 0.0) AS gps_km
                FROM flight_tracks
                WHERE user_id = ?
                GROUP BY flight_id
            ) t ON t.flight_id = f.id
            WHERE f.user_id = ?
            """,
            con,
            params=(strict_user_id(user_id), strict_user_id(user_id)),
        )
    flights = compute_metrics(flights, str(read_user_profile(strict_user_id(user_id)).get("currency") or "CZK"))
    if not flights.empty:
        flights["track_count"] = pd.to_numeric(flights["track_count"], errors="coerce").fillna(0).astype(int)
        flights["gps_km"] = pd.to_numeric(flights["gps_km"], errors="coerce").fillna(0.0)
    return flights


@st.cache_data(show_spinner=False, ttl=300)
def read_tracks_joined(user_id: int) -> pd.DataFrame:
    with connect() as con:
        return pd.read_sql_query(
            """
            SELECT t.*, f.date, f.evidence, f.registration, f.aircraft_type, f.aircraft_class,
                   f.departure, f.arrival, f.off_block, f.takeoff, f.landing, f.on_block,
                   f.role, f.starts, f.task, f.commander
            FROM flight_tracks t
            JOIN flights f ON f.id = t.flight_id AND f.user_id = t.user_id
            WHERE t.user_id = ?
            ORDER BY f.date, f.off_block, t.id
            """,
            con,
            params=(strict_user_id(user_id),),
        )


@st.cache_data(show_spinner=False, ttl=300)
def read_tracks_joined_for_flights(flight_ids: tuple[int, ...], user_id: int) -> pd.DataFrame:
    """Return only tracks needed by the active map filter.

    The older GPS map path loaded every stored KML track including full
    coordinates_json and then filtered in pandas. With longer history this is one
    of the most expensive operations in the app. This query keeps the heavy JSON
    payload limited to the flights that are actually visible in the current map
    filter.
    """
    ids = tuple(sorted({int(x) for x in flight_ids if x is not None}))
    if not ids:
        return pd.DataFrame()
    placeholders = ",".join("?" for _ in ids)
    query = f"""
        SELECT t.*, f.date, f.evidence, f.registration, f.aircraft_type, f.aircraft_class,
               f.departure, f.arrival, f.off_block, f.takeoff, f.landing, f.on_block,
               f.role, f.starts, f.task, f.commander
        FROM flight_tracks t
        JOIN flights f ON f.id = t.flight_id AND f.user_id = t.user_id
        WHERE t.user_id = ? AND t.flight_id IN ({placeholders})
        ORDER BY f.date, f.off_block, t.id
    """
    with connect() as con:
        return pd.read_sql_query(query, con, params=(strict_user_id(user_id), *ids))


@st.cache_data(show_spinner=False, ttl=300)
def read_track_metadata_for_flights(flight_ids: tuple[int, ...], user_id: int) -> pd.DataFrame:
    """Return GPS track metadata without the heavy coordinates_json payload."""
    ids = tuple(sorted({int(x) for x in flight_ids if x is not None}))
    if not ids:
        return pd.DataFrame()
    placeholders = ",".join("?" for _ in ids)
    query = f"""
        SELECT t.id, t.flight_id, t.file_name, t.imported_at, t.point_count, t.distance_km,
               t.start_utc, t.end_utc, t.min_alt_m, t.max_alt_m,
               f.date, f.evidence, f.registration, f.aircraft_type, f.aircraft_class,
               f.departure, f.arrival, f.off_block, f.takeoff, f.landing, f.on_block,
               f.role, f.starts, f.task, f.commander
        FROM flight_tracks t
        JOIN flights f ON f.id = t.flight_id AND f.user_id = t.user_id
        WHERE t.user_id = ? AND t.flight_id IN ({placeholders})
        ORDER BY f.date DESC, f.off_block DESC, t.id DESC
    """
    with connect() as con:
        return pd.read_sql_query(query, con, params=(strict_user_id(user_id), *ids))


def _track_ids_for_map(metadata: pd.DataFrame, mode: str) -> tuple[int, ...]:
    if metadata.empty or "id" not in metadata.columns:
        return ()
    work = metadata.copy()
    sort_cols = [c for c in ["date", "off_block", "id"] if c in work.columns]
    if sort_cols:
        work = work.sort_values(sort_cols, ascending=[False] * len(sort_cols), na_position="last")
    plan = build_gps_render_plan(mode, len(work))
    if plan.max_tracks is not None:
        work = work.head(plan.max_tracks)
    return tuple(int(x) for x in pd.to_numeric(work["id"], errors="coerce").dropna().astype(int).tolist())


@st.cache_data(show_spinner=False, ttl=300)
def read_sampled_track_points(track_ids: tuple[int, ...], max_points: int, user_id: int) -> pd.DataFrame:
    """Read only a sampled subset of normalized GPS points for map rendering.

    This avoids loading and decoding the full coordinates_json for every visible
    track. Stored data remains unchanged; only the browser map receives the
    reduced point set.
    """
    ids = tuple(sorted({int(x) for x in track_ids if x is not None}))
    if not ids:
        return pd.DataFrame(columns=["track_id", "seq", "lat", "lon", "alt", "time"])
    max_points = max(2, int(max_points or 120))
    placeholders = ",".join("?" for _ in ids)
    query = f"""
        WITH ranked AS (
            SELECT
                track_id,
                seq,
                latitude_deg AS lat,
                longitude_deg AS lon,
                altitude_m AS alt,
                time_utc AS time,
                ROW_NUMBER() OVER (PARTITION BY track_id ORDER BY seq) AS rn,
                COUNT(*) OVER (PARTITION BY track_id) AS n
            FROM track_points
            WHERE user_id = ? AND track_id IN ({placeholders})
        )
        SELECT track_id, seq, lat, lon, alt, time
        FROM ranked
        WHERE rn = 1
           OR rn = n
           OR ((rn - 1) % MAX(1, CAST((n + ? - 1) / ? AS INTEGER)) = 0)
        ORDER BY track_id, seq
    """
    with connect() as con:
        return pd.read_sql_query(query, con, params=(strict_user_id(user_id), *ids, max_points, max_points))


def _points_dataframe_to_json(points: pd.DataFrame, *, max_points: int) -> dict[int, str]:
    """Convert SQL candidate points into geometry-preserving browser payloads."""
    if points.empty:
        return {}
    out: dict[int, str] = {}
    for track_id, group in points.groupby("track_id", sort=False):
        items: list[dict[str, Any]] = []
        for row in group.itertuples(index=False):
            try:
                lat = float(row.lat)
                lon = float(row.lon)
            except Exception:
                continue
            item: dict[str, Any] = {"lat": lat, "lon": lon}
            alt = getattr(row, "alt", None)
            if alt is not None and not pd.isna(alt):
                try:
                    item["alt"] = float(alt)
                except Exception:
                    pass
            time_value = getattr(row, "time", None)
            if time_value is not None and not pd.isna(time_value) and str(time_value).strip():
                item["time"] = str(time_value)
            items.append(item)
        if len(items) >= 2:
            out[int(track_id)] = encode_compact_track_points(items, max_points=max_points)
    return out


@st.cache_data(show_spinner=False, ttl=300)
def read_track_map_records_for_flights(flight_ids: tuple[int, ...], mode: str, user_id: int) -> pd.DataFrame:
    """Return lightweight track records ready for the GPS overview map."""
    metadata = read_track_metadata_for_flights(flight_ids, user_id)
    if metadata.empty:
        return metadata
    track_ids = _track_ids_for_map(metadata, mode)
    if not track_ids:
        return metadata.iloc[0:0].copy()
    plan = build_gps_render_plan(mode, len(metadata))
    selected = metadata[metadata["id"].astype(int).isin(track_ids)].copy()
    sort_cols = [c for c in ["date", "off_block", "id"] if c in selected.columns]
    if sort_cols:
        selected = selected.sort_values(sort_cols, ascending=[False] * len(sort_cols), na_position="last")
    points = read_sampled_track_points(track_ids, plan.candidate_points_per_track, user_id)
    coord_map = _points_dataframe_to_json(points, max_points=plan.points_per_track)

    missing = [tid for tid in track_ids if tid not in coord_map]
    if missing:
        # Fallback for older or partially migrated databases. This path only reads
        # full JSON for the few tracks that do not have normalized points yet.
        placeholders = ",".join("?" for _ in missing)
        try:
            with connect() as con:
                rows = con.execute(
                    f"SELECT id, coordinates_json FROM flight_tracks WHERE user_id = ? AND id IN ({placeholders})",
                    (strict_user_id(user_id), *missing),
                ).fetchall()
            for row in rows:
                coord_map[int(row["id"])] = _decode_points_for_map(row["coordinates_json"], max_points=plan.points_per_track)
        except Exception:
            pass

    selected["coordinates_json"] = selected["id"].astype(int).map(coord_map).fillna("[]")
    selected = selected[selected["coordinates_json"].astype(str).str.len() > 2]
    return selected.reset_index(drop=True)


@st.cache_data(show_spinner=False, ttl=300)
def read_tracks_for_flight(flight_id: int, user_id: int) -> pd.DataFrame:
    with connect() as con:
        return pd.read_sql_query("SELECT * FROM flight_tracks WHERE user_id = ? AND flight_id = ? ORDER BY id", con, params=(strict_user_id(user_id), flight_id))


def _columns_for_table(con: sqlite3.Connection, table: str) -> set[str]:
    try:
        return {row[1] for row in con.execute(f"PRAGMA table_info({table})").fetchall()}
    except sqlite3.DatabaseError:
        return set()


def _add_column_if_missing(con: sqlite3.Connection, table: str, column: str, ddl: str) -> None:
    if column not in _columns_for_table(con, table):
        con.execute(f"ALTER TABLE {table} ADD COLUMN {ddl}")


def ensure_schema_compatibility(con: sqlite3.Connection) -> None:
    """Upgrade older SQLite files without losing data.

    CREATE TABLE IF NOT EXISTS does not add new columns to an already existing
    table. Some earlier online databases had an older audit_log shape
    (user/entity/detail). Deleting a flight must not fail just because the audit
    table is old, so we add all columns used by the current application.
    """
    try:
        _add_column_if_missing(con, "audit_log", "actor", "actor TEXT")
        _add_column_if_missing(con, "audit_log", "object_type", "object_type TEXT")
        _add_column_if_missing(con, "audit_log", "object_id", "object_id TEXT")
        _add_column_if_missing(con, "audit_log", "detail_json", "detail_json TEXT")
        _add_column_if_missing(con, "audit_log", "user", "user TEXT")
        _add_column_if_missing(con, "audit_log", "entity", "entity TEXT")
        _add_column_if_missing(con, "audit_log", "entity_id", "entity_id TEXT")
        _add_column_if_missing(con, "audit_log", "detail", "detail TEXT")
    except sqlite3.DatabaseError:
        pass
    try:
        _add_column_if_missing(con, "flight_tracks", "min_alt_m", "min_alt_m REAL")
        _add_column_if_missing(con, "flight_tracks", "max_alt_m", "max_alt_m REAL")
        _add_column_if_missing(con, "flights", "note", "note TEXT")
        _add_column_if_missing(con, "flights", "billing_basis", "billing_basis TEXT DEFAULT 'BLOCK'")
        _add_column_if_missing(con, "aircraft", "default_role", "default_role TEXT DEFAULT 'PIC'")
        _add_column_if_missing(con, "aircraft", "billing_basis", "billing_basis TEXT DEFAULT 'BLOCK'")
    except sqlite3.DatabaseError:
        pass



# -----------------------------------------------------------------------------
# UI
# -----------------------------------------------------------------------------



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
    if is_admin():
        render_nav_button("Admin", "Admin", "side_nav_Admin")


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


def base_app_url() -> str:
    try:
        current_url = str(getattr(st.context, "url", "") or "")
        if current_url.startswith(("http://", "https://")):
            return current_url.split("?")[0].split("#")[0]
    except Exception:
        pass
    return ""


def app_link(**params: Any) -> str:
    clean = {str(k): str(v) for k, v in params.items() if v is not None and str(v) != ""}
    qs = urlencode(clean)
    base = base_app_url()
    if base:
        return f"{base}?{qs}" if qs else base
    return f"?{qs}" if qs else "?"


def detail_link(flight_id: int) -> str:
    return app_link(flight_id=int(flight_id))


def airport_link(ident: str) -> str:
    return app_link(map_airport=str(ident).upper())


def route_link(dep: str, arr: str) -> str:
    return app_link(map_route=f"{str(dep).upper()}__{str(arr).upper()}")



# -----------------------------------------------------------------------------
# Filters and summaries
# -----------------------------------------------------------------------------


# -----------------------------------------------------------------------------
# KML/GPS
# -----------------------------------------------------------------------------


def nearest_airport(point: dict[str, Any] | None, max_km: float = 18.0) -> str:
    """Return the nearest known airport using the cached minimal spatial index."""
    if not point:
        return ""
    try:
        p_lat = float(point["lat"])
        p_lon = float(point["lon"])
    except Exception:
        return ""
    idents, lats, lons = airport_search_index(current_user_id())
    if lats.size == 0:
        return ""

    # Cheap geographic bounding box first.  For a typical 18 km lookup this
    # reduces the expensive trig calculation from ~86k airports to a handful.
    lat_delta = max(float(max_km), 0.1) / 110.574
    cos_lat = max(abs(math.cos(math.radians(p_lat))), 0.08)
    lon_delta = max(float(max_km), 0.1) / (111.320 * cos_lat)
    lon_diff = np.abs(((lons - p_lon + 180.0) % 360.0) - 180.0)
    mask = (np.abs(lats - p_lat) <= lat_delta * 1.15) & (lon_diff <= lon_delta * 1.15)
    candidate_idx = np.flatnonzero(mask)
    if candidate_idx.size == 0:
        return ""

    cand_lats = lats[candidate_idx]
    cand_lons = lons[candidate_idx]
    lat1 = math.radians(p_lat)
    lat2 = np.radians(cand_lats)
    dlat = lat2 - lat1
    dlon = np.radians(((cand_lons - p_lon + 180.0) % 360.0) - 180.0)
    h = np.sin(dlat / 2.0) ** 2 + math.cos(lat1) * np.cos(lat2) * np.sin(dlon / 2.0) ** 2
    dist = 2.0 * 6371.0088 * np.arcsin(np.sqrt(np.clip(h, 0.0, 1.0)))
    pos = int(np.argmin(dist))
    if float(dist[pos]) <= float(max_km):
        return str(idents[candidate_idx[pos]]).upper()
    return ""



def _local_time_label(iso_text: Any) -> str:
    dt = parse_iso(str(iso_text)) if iso_text else None
    if not dt:
        return "—"
    return dt.astimezone(current_user_timezone()).strftime("%H:%M")


def _kml_range_label(stats: dict[str, Any]) -> str:
    start = _local_time_label(stats.get("start_utc"))
    end = _local_time_label(stats.get("end_utc"))
    if start == "—" and end == "—":
        return "—"
    return f"{start}–{end}"


def _kml_quality(defaults: dict[str, Any], stats: dict[str, Any], has_clock: bool) -> str:
    score = 0
    if int(stats.get("point_count") or 0) >= 2:
        score += 1
    if has_clock:
        score += 1
    if normalize_text(defaults.get("departure")) and normalize_text(defaults.get("arrival")):
        score += 1
    if score >= 3:
        return "Vysoká"
    if score == 2:
        return "Střední"
    return "Nízká"


def render_kml_import_header(raw: bytes, file_name: str, defaults: dict[str, Any], stats: dict[str, Any], has_clock: bool) -> None:
    source = detect_kml_source(raw, file_name)
    route = f"{normalize_text(defaults.get('departure')) or '—'} → {normalize_text(defaults.get('arrival')) or '—'}"
    c1, c2, c3, c4, c5 = st.columns(5)
    with c1:
        metric_card("Zdroj", source, "")
    with c2:
        metric_card("Body", str(int(stats.get("point_count") or 0)), "")
    with c3:
        metric_card("GPS", f"{float(stats.get('distance_km') or 0):.1f} km", "")
    with c4:
        air_range = f"{defaults.get('takeoff') or '—'}–{defaults.get('landing') or '—'}"
        metric_card("Air", air_range, "")
    with c5:
        block_range = f"{defaults.get('off_block') or '—'}–{defaults.get('on_block') or '—'}"
        metric_card("Block", block_range, "")
    st.markdown(
        f"""
        <div class="flight-detail-hero compact-import-hero">
            <div class="flight-detail-route">{_safe_text(route)}</div>
            <div class="flight-detail-meta">
                <span>{_safe_text(file_name)}</span>
                <span>{_safe_text(str(defaults.get('date') or '—'))}</span>
                <span>{_safe_text(str(defaults.get('registration') or '—'))}</span>
            </div>
        </div>
        """,
        unsafe_allow_html=True,
    )


def evidence_from_registration(reg: str) -> str:
    return "ULL" if re.fullmatch(r"OK-[A-Z]{3}\d{2}", (reg or "").upper()) else "EASA"


def default_class_for(evidence: str) -> str:
    return "ULL" if evidence == "ULL" else "SEP"


def infer_from_track(
    points: list[dict[str, Any]],
    file_name: str,
    rates: pd.DataFrame,
    *,
    smart_analysis: dict[str, Any] | None = None,
) -> dict[str, Any]:
    idx = detect_takeoff_landing(points)
    stats = track_stats(points)
    reg = extract_registration_from_filename(file_name)
    tz = current_user_timezone()
    evidence = evidence_from_registration(reg) if reg else current_user_default_evidence()
    flight_date = point_local_date(points, tz)
    rate = lookup_latest_rate(rates, reg, flight_date)
    clock = inferred_clock_times(points, idx, block_padding_minutes=5, tz=tz)
    has_clock = any(p.get("time") for p in points)
    note = "" if has_clock else "KML neobsahovalo časové značky, časy je nutné doplnit ručně."
    return {
        "date": flight_date,
        "registration": reg,
        "evidence": evidence,
        "aircraft_type": normalize_text(rate.get("aircraft_type")) or "",
        "aircraft_class": default_class_for(evidence),
        "departure": nearest_airport(points[idx.get("takeoff_idx", idx.get("off_idx", 0))] if points else None),
        "arrival": nearest_airport(points[idx.get("landing_idx", idx.get("on_idx", len(points)-1))] if points else None),
        "off_block": clock.get("off_block"),
        "takeoff": clock.get("takeoff"),
        "landing": clock.get("landing"),
        "on_block": clock.get("on_block"),
        "starts": max(1, int((smart_analysis or {}).get("landing_count") or 1)),
        "commander": current_user_display_name(),
        "instructor": "",
        "role": current_user_default_role(),
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
    uid = strict_user_id(current_user_id())
    with connect() as con:
        require_owned_record(con, "flights", flight_id, uid)
        if replace_existing:
            con.execute("DELETE FROM flight_tracks WHERE flight_id = ? AND user_id = ?", (flight_id, uid))
        cur = con.execute(
            """
            INSERT INTO flight_tracks (user_id, flight_id, file_name, imported_at, point_count, distance_km, start_utc, end_utc, min_alt_m, max_alt_m, coordinates_json)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (uid, flight_id, file_name, _now_iso(), stats["point_count"], stats["distance_km"], stats["start_utc"], stats["end_utc"], stats["min_alt_m"], stats["max_alt_m"], json.dumps(points, ensure_ascii=False)),
        )
        track_id = int(cur.lastrowid)
        insert_track_points(con, track_id, points, user_id=uid)
        record_audit(con, "save_track", "flight_tracks", track_id, {"flight_id": flight_id, "file_name": file_name, "replace_existing": replace_existing})
        con.commit()
    invalidate_cached_data("tracks")
    auto_backup_after_change("save_track")


def create_flight(data: dict[str, Any], auto_backup: bool = True) -> int:
    fields = ["date","evidence","registration","aircraft_type","aircraft_class","departure","arrival","off_block","takeoff","landing","on_block","starts","commander","instructor","role","task","price_per_hour","billing_basis","note"]
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
        elif f in {"evidence", "registration", "aircraft_class", "departure", "arrival", "role", "billing_basis"}:
            v = normalize_text(v)
            v = v.upper() if v else None
        else:
            v = normalize_text(v)
        values.append(v)
    uid = strict_user_id(current_user_id())
    with connect() as con:
        cur = con.execute(
            """
            INSERT INTO flights (user_id, date, evidence, registration, aircraft_type, aircraft_class, departure, arrival, off_block, takeoff, landing, on_block, starts, commander, instructor, role, task, price_per_hour, billing_basis, note)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            [uid, *values],
        )
        flight_id = int(cur.lastrowid)
        record_audit(con, "create_flight", "flights", flight_id, data)
        con.commit()
    invalidate_cached_data("flights")
    if auto_backup:
        auto_backup_after_change("create_flight")
    return flight_id


def update_flight(flight_id: int, data: dict[str, Any]) -> None:
    fields = ["date","evidence","registration","aircraft_type","aircraft_class","departure","arrival","off_block","takeoff","landing","on_block","starts","commander","instructor","role","task","price_per_hour","billing_basis","note"]
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
        elif f in {"evidence", "registration", "aircraft_class", "departure", "arrival", "role", "billing_basis"}:
            v = normalize_text(v)
            v = v.upper() if v else None
        else:
            v = normalize_text(v)
        values.append(v)
    uid = strict_user_id(current_user_id())
    with connect() as con:
        require_owned_record(con, "flights", flight_id, uid)
        con.execute("UPDATE flights SET " + ", ".join(f"{f}=?" for f in fields) + " WHERE id=? AND user_id=?", [*values, flight_id, uid])
        record_audit(con, "update_flight", "flights", flight_id, data)
        con.commit()
    invalidate_cached_data("flights")
    auto_backup_after_change("update_flight")


def delete_track(track_id: int) -> None:
    uid = strict_user_id(current_user_id())
    with connect() as con:
        require_owned_record(con, "flight_tracks", track_id, uid)
        con.execute("DELETE FROM flight_tracks WHERE id = ? AND user_id = ?", (track_id, uid))
        record_audit(con, "delete_track", "flight_tracks", track_id, None)
        con.commit()
    invalidate_cached_data("tracks")
    auto_backup_after_change("delete_track")


def delete_flight(flight_id: int) -> None:
    """Delete one flight and all related KML/GPS data from SQLite."""
    uid = strict_user_id(current_user_id())
    with connect() as con:
        ensure_schema_compatibility(con)
        require_owned_record(con, "flights", flight_id, uid)
        row = con.execute("SELECT * FROM flights WHERE id = ? AND user_id = ?", (flight_id, uid)).fetchone()
        if row is None:
            return
        track_rows = con.execute("SELECT id FROM flight_tracks WHERE flight_id = ? AND user_id = ?", (flight_id, uid)).fetchall()
        track_ids = [int(r["id"]) for r in track_rows]
        audit_detail = {
            "date": row["date"],
            "registration": row["registration"],
            "route": f"{row['departure'] or ''}-{row['arrival'] or ''}",
            "tracks_deleted": len(track_ids),
        }
        for track_id in track_ids:
            con.execute("DELETE FROM track_points WHERE track_id = ? AND user_id = ?", (track_id, uid))
        con.execute("DELETE FROM flight_tracks WHERE flight_id = ? AND user_id = ?", (flight_id, uid))
        con.execute("DELETE FROM flights WHERE id = ? AND user_id = ?", (flight_id, uid))
        record_audit(con, "delete_flight", "flights", flight_id, audit_detail)
        con.commit()
    invalidate_cached_data("flights")
    invalidate_cached_data("tracks")
    auto_backup_after_change("delete_flight")


def downsample_points(points: list[dict[str, Any]], max_points: int = 900) -> list[dict[str, Any]]:
    return downsample_track_points(points, max_points=max_points)


@st.cache_data(show_spinner=False, ttl=600)
def airport_coord_lookup(user_id: int) -> dict[str, dict[str, Any]]:
    """Fast airport coordinate lookup used by maps and track extensions.

    This intentionally reads only the five columns needed for drawing maps. The
    full airport registry has tens of thousands of rows and many columns; loading
    it here would make every first map render noticeably slower.
    """
    query = """
        SELECT ident, name, latitude_deg, longitude_deg, source
        FROM airports
        WHERE latitude_deg IS NOT NULL AND longitude_deg IS NOT NULL
    """
    frames: list[pd.DataFrame] = []
    if AIRPORTS_DB_PATH.exists():
        try:
            with connect_airports_ro() as airport_con:
                frames.append(pd.read_sql_query(query, airport_con))
        except Exception:
            pass
    try:
        with connect() as con:
            local_query = query.replace("WHERE latitude_deg IS NOT NULL", "WHERE user_id = ? AND latitude_deg IS NOT NULL")
            frames.append(pd.read_sql_query(local_query, con, params=(strict_user_id(user_id),)))
    except Exception:
        pass
    if not frames:
        return {}
    airports = pd.concat(frames, ignore_index=True, sort=False)
    if airports.empty or "ident" not in airports.columns:
        return {}
    airports["ident"] = airports["ident"].fillna("").astype(str).str.upper().str.strip()
    airports = airports[airports["ident"] != ""]
    airports["latitude_deg"] = pd.to_numeric(airports["latitude_deg"], errors="coerce")
    airports["longitude_deg"] = pd.to_numeric(airports["longitude_deg"], errors="coerce")
    airports = airports.dropna(subset=["latitude_deg", "longitude_deg"])
    airports = airports[
        airports["latitude_deg"].between(-90, 90)
        & airports["longitude_deg"].between(-180, 180)
    ]
    airports = airports.drop_duplicates(subset=["ident"], keep="last")
    lookup: dict[str, dict[str, Any]] = {}
    for row in airports.itertuples(index=False):
        ident = str(getattr(row, "ident", "") or "").upper()
        if not ident:
            continue
        lookup[ident] = {
            "ident": ident,
            "name": normalize_text(getattr(row, "name", "")) or ident,
            "lat": float(getattr(row, "latitude_deg")),
            "lon": float(getattr(row, "longitude_deg")),
            "source": normalize_text(getattr(row, "source", "")) or "",
        }
    return lookup


def airport_coord(ident: Any) -> dict[str, Any] | None:
    text = normalize_text(ident)
    if not text:
        return None
    ident_up = text.upper()
    return airport_coords_for_idents((ident_up,), current_user_id()).get(ident_up)


def _coord_dict_from_airport(ap: dict[str, Any] | None) -> dict[str, Any] | None:
    if not ap:
        return None
    return {"lat": float(ap["lat"]), "lon": float(ap["lon"]), "alt": None, "time": None}


def track_latlon_with_airport_extensions(
    row: pd.Series | dict[str, Any],
    points: list[dict[str, Any]],
    min_gap_km: float = 0.35,
    airport_lookup: dict[str, dict[str, Any]] | None = None,
) -> tuple[list[tuple[float, float]], list[dict[str, Any]]]:
    """Return a visual route extended to manually/automatically selected airports.

    KML from phones/trackers sometimes starts after departure or ends before
    arrival. We do not alter the stored GPS points or calculated GPS distance;
    only the map display gets a direct connector from/to known airports.
    """
    if not points:
        return [], []

    visual_points = [dict(p) for p in points]
    extensions: list[dict[str, Any]] = []

    dep_ident = normalize_text(row.get("departure") if hasattr(row, "get") else None)
    arr_ident = normalize_text(row.get("arrival") if hasattr(row, "get") else None)
    if airport_lookup is None:
        dep_ap = airport_coord(dep_ident)
        arr_ap = airport_coord(arr_ident)
    else:
        dep_ap = airport_lookup.get(dep_ident.upper()) if dep_ident else None
        arr_ap = airport_lookup.get(arr_ident.upper()) if arr_ident else None

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


def map_center_from_tracks(
    tracks: pd.DataFrame,
    airport_lookup: dict[str, dict[str, Any]] | None = None,
) -> tuple[list[float], int]:
    coords: list[tuple[float, float]] = []
    for _, row in tracks.iterrows():
        try:
            points = simplify_track_points(json.loads(row["coordinates_json"]), max_points=180)
            latlon, _ = track_latlon_with_airport_extensions(row, points, airport_lookup=airport_lookup)
            coords.extend(latlon)
        except Exception:
            continue
    viewport = viewport_from_coords(coords, profile="track")
    return [viewport.center[0], viewport.center[1]], viewport.zoom


def make_map(
    tracks: pd.DataFrame,
    dark_mode: bool = True,
    line_weight: float = 4,
    line_opacity: float = 0.78,
    show_endpoints: bool = True,
    extend_to_airports: bool = True,
) -> folium.Map:
    import folium

    airport_lookup: dict[str, dict[str, Any]] = {}
    if extend_to_airports and not tracks.empty:
        needed: set[str] = set()
        for col in ("departure", "arrival"):
            if col in tracks.columns:
                values = tracks[col].fillna("").astype(str).str.upper().str.strip()
                needed.update(values[values.ne("")].tolist())
        airport_lookup = airport_coords_for_idents(tuple(sorted(needed)), current_user_id())
    center, zoom = map_center_from_tracks(tracks, airport_lookup=airport_lookup)
    tiles = "CartoDB dark_matter" if dark_mode else "OpenStreetMap"
    m = folium.Map(location=center, zoom_start=zoom, tiles=tiles, control_scale=True, prefer_canvas=True)
    if tracks.empty:
        return m
    for _, row in tracks.iterrows():
        try:
            points = simplify_track_points(json.loads(row["coordinates_json"]), max_points=220)
        except Exception:
            continue
        if len(points) < 2:
            continue
        gps_latlon = [(float(p["lat"]), float(p["lon"])) for p in points]
        latlon, extensions = track_latlon_with_airport_extensions(row, points, airport_lookup=airport_lookup) if extend_to_airports else (gps_latlon, [])
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
    viewport = viewport_from_coords(coords, profile="airport")
    return [viewport.center[0], viewport.center[1]], viewport.zoom


def make_route_overview_map(flights: pd.DataFrame, dark_mode: bool = True) -> folium.Map:
    import folium

    needed: set[str] = set()
    if not flights.empty:
        for col in ("departure", "arrival"):
            if col in flights.columns:
                needed.update(
                    flights[col].fillna("").astype(str).str.upper().str.strip().loc[lambda x: x.ne("")].tolist()
                )
    lookup = airport_coords_for_idents(tuple(sorted(needed)), current_user_id())
    coords: list[tuple[float, float]] = []
    visited: dict[str, dict[str, Any]] = {}
    route_groups: dict[tuple[str, str], dict[str, Any]] = {}

    for _, row in flights.iterrows():
        dep = normalize_text(row.get("departure"))
        arr = normalize_text(row.get("arrival"))
        if not dep or not arr:
            continue
        dep_ap = lookup.get(dep.upper())
        arr_ap = lookup.get(arr.upper())
        if not dep_ap or not arr_ap:
            continue

        dep_id = dep_ap["ident"]
        arr_id = arr_ap["ident"]
        dep_ll = (float(dep_ap["lat"]), float(dep_ap["lon"]))
        arr_ll = (float(arr_ap["lat"]), float(arr_ap["lon"]))
        coords.extend([dep_ll, arr_ll])

        for ap, kind in ((dep_ap, "dep"), (arr_ap, "arr")):
            ident = ap["ident"]
            if ident not in visited:
                visited[ident] = {**ap, "visits": 0, "departures": 0, "arrivals": 0, "first_date": "", "last_date": ""}
            visited[ident]["visits"] += 1
            if kind == "dep":
                visited[ident]["departures"] += 1
            else:
                visited[ident]["arrivals"] += 1
            date_txt = str(row.get("date") or "")
            if date_txt:
                if not visited[ident]["first_date"] or date_txt < visited[ident]["first_date"]:
                    visited[ident]["first_date"] = date_txt
                if not visited[ident]["last_date"] or date_txt > visited[ident]["last_date"]:
                    visited[ident]["last_date"] = date_txt

        key = tuple(sorted([dep_id, arr_id]))
        group = route_groups.setdefault(
            key,
            {
                "dep": lookup[key[0]],
                "arr": lookup[key[1]],
                "count": 0,
                "ull": 0,
                "easa": 0,
                "first_date": "",
                "last_date": "",
                "sample_registration": "",
            },
        )
        group["count"] += 1
        evidence = str(row.get("evidence") or "").upper()
        if evidence == "ULL":
            group["ull"] += 1
        elif evidence == "EASA":
            group["easa"] += 1
        if not group["sample_registration"]:
            group["sample_registration"] = str(row.get("registration") or "")
        date_txt = str(row.get("date") or "")
        if date_txt:
            if not group["first_date"] or date_txt < group["first_date"]:
                group["first_date"] = date_txt
            if not group["last_date"] or date_txt > group["last_date"]:
                group["last_date"] = date_txt

    center, zoom = map_center_from_airport_coords(coords)
    tiles = "CartoDB dark_matter" if dark_mode else "OpenStreetMap"
    m = folium.Map(location=center, zoom_start=zoom, tiles=tiles, control_scale=True, prefer_canvas=True)

    for (dep_id, arr_id), group in sorted(route_groups.items(), key=lambda item: (-int(item[1]["count"]), item[0])):
        dep_ap = group["dep"]
        arr_ap = group["arr"]
        dep_ll = (float(dep_ap["lat"]), float(dep_ap["lon"]))
        arr_ll = (float(arr_ap["lat"]), float(arr_ap["lon"]))
        count = int(group.get("count") or 0)
        ull = int(group.get("ull") or 0)
        easa = int(group.get("easa") or 0)
        if ull and easa:
            color = "#a78bfa"
        elif ull:
            color = "#38bdf8"
        else:
            color = "#fbbf24"
        weight = min(6.5, 2.6 + math.sqrt(max(1, count)) * 0.55)
        opacity = 0.54 if count <= 1 else 0.72
        popup = folium.Popup(f"""
            <b>{dep_id}–{arr_id}</b><br>
            Letů: {count}<br>
            ULL: {ull} • EASA: {easa}<br>
            První: {group.get('first_date') or '—'} • Poslední: {group.get('last_date') or '—'}
            """, max_width=300)
        tooltip = f"{dep_id}–{arr_id} • {count}"
        folium.PolyLine([dep_ll, arr_ll], color=color, weight=weight, opacity=opacity, popup=popup, tooltip=tooltip).add_to(m)

    for ident, ap in visited.items():
        visits = int(ap.get("visits") or 0)
        radius = min(11, 4.5 + visits ** 0.5)
        tooltip = f"{ident} • {ap.get('name') or ''}"
        popup = folium.Popup(f"""
            <b>{ident}</b><br>
            {ap.get('name') or ''}<br>
            Návštěvy: {visits}<br>
            Odlety: {int(ap.get('departures') or 0)} • Přílety: {int(ap.get('arrivals') or 0)}<br>
            První: {ap.get('first_date') or '—'} • Poslední: {ap.get('last_date') or '—'}
            """, max_width=300)
        folium.CircleMarker((float(ap["lat"]), float(ap["lon"])), radius=radius, color="#22c55e", fill=True, fill_opacity=.92, tooltip=tooltip, popup=popup).add_to(m)

    folium.LayerControl().add_to(m)
    return m

def render_folium_readonly(m: folium.Map, *, height: int = 680, key: str | None = None) -> None:
    from streamlit_folium import st_folium
    try:
        html = m.get_root().render()
        components.html(html, height=height, scrolling=False)
    except Exception:
        try:
            st_folium(m, height=height, use_container_width=True, key=key, returned_objects=[])
        except TypeError:
            st_folium(m, height=height, use_container_width=True, key=key)


def render_folium_navigable(m: folium.Map, *, height: int = 680, key: str | None = None) -> Any:
    from streamlit_folium import st_folium
    try:
        return st_folium(
            m,
            height=height,
            use_container_width=True,
            key=key,
            returned_objects=["last_object_clicked", "last_object_clicked_tooltip", "last_object_clicked_popup"],
        )
    except TypeError:
        return st_folium(m, height=height, use_container_width=True, key=key)


def _stringify_map_event(value: Any) -> str:
    try:
        return json.dumps(value, ensure_ascii=False, default=str)
    except Exception:
        return str(value or "")


def handle_route_map_interaction(value: Any) -> None:
    text = _stringify_map_event(value)
    if not text:
        return

    route_match = re.search(r"([A-Z0-9]{3,5})\s*[–-]\s*([A-Z0-9]{3,5})", text)
    airport_match = re.search(r"\b([A-Z]{2}[A-Z0-9]{2,3}|[A-Z0-9]{3,5})\s*•", text)

    if route_match:
        dep = route_match.group(1).upper().strip()
        arr = route_match.group(2).upper().strip()
        if dep and arr and dep != arr:
            route = f"{dep}__{arr}"
            action = f"route:{route}"
            if st.session_state.get("_last_map_action") == action:
                return
            st.session_state["_last_map_action"] = action
            st.session_state["map_route"] = route
            st.session_state.pop("map_airport", None)
            st.rerun()

    if airport_match:
        ident = airport_match.group(1).upper().strip()
        if ident:
            action = f"airport:{ident}"
            if st.session_state.get("_last_map_action") == action:
                return
            st.session_state["_last_map_action"] = action
            st.session_state["map_airport"] = ident
            st.session_state.pop("map_route", None)
            st.rerun()


def _decode_points_for_map(value: Any, max_points: int = 160) -> str:
    """Return a geometry-preserving compact JSON representation for a map."""
    try:
        points = json.loads(value or "[]")
    except Exception:
        points = []
    if not isinstance(points, list):
        points = []
    return encode_compact_track_points(points, max_points=max(2, int(max_points)))


def prepare_tracks_for_map(tracks: pd.DataFrame, *, mode: str = "Rychlá", max_fast_tracks: int = 60) -> pd.DataFrame:
    """Compatibility wrapper for already-loaded track data using Map Engine 2.0."""
    if tracks.empty:
        return tracks.copy()
    work = tracks.copy()
    if "date" in work.columns:
        work = work.sort_values(["date", "id"], ascending=[False, False], na_position="last")
    plan = build_gps_render_plan(mode, len(work))
    if plan.max_tracks is not None:
        work = work.head(min(int(plan.max_tracks), int(max_fast_tracks or plan.max_tracks)))
    if "coordinates_json" in work.columns:
        work["coordinates_json"] = work["coordinates_json"].apply(
            lambda x: _decode_points_for_map(x, max_points=plan.points_per_track)
        )
    return work


def _df_to_records_json(df: pd.DataFrame, columns: list[str]) -> str:
    """Stable compact JSON for cached map rendering."""
    return compact_records_json(df, columns)


def _flight_id_tuple(df: pd.DataFrame) -> tuple[int, ...]:
    if df.empty or "id" not in df.columns:
        return ()
    values = pd.to_numeric(df["id"], errors="coerce").dropna().astype(int).tolist()
    return tuple(sorted(set(values)))


@st.cache_data(show_spinner=False, ttl=300)
def cached_track_map_html(records_json: str, dark_mode: bool) -> str:
    df = pd.read_json(BytesIO(records_json.encode("utf-8")), orient="records") if records_json and records_json != "[]" else pd.DataFrame()
    if df.empty:
        return ""
    m = make_map(df, dark_mode=dark_mode, line_weight=2, line_opacity=0.46, show_endpoints=False, extend_to_airports=True)
    return m.get_root().render()


@st.cache_data(show_spinner=False, ttl=300)
def cached_route_overview_map_html(records_json: str, dark_mode: bool) -> str:
    df = pd.read_json(BytesIO(records_json.encode("utf-8")), orient="records") if records_json and records_json != "[]" else pd.DataFrame()
    if df.empty:
        return ""
    m = make_route_overview_map(df, dark_mode=dark_mode)
    return m.get_root().render()


def render_map_html(html: str, *, height: int = 680) -> None:
    if not html:
        st.info("Mapa nemá data k zobrazení.")
        return
    components.html(html, height=height, scrolling=False)


def render_lazy_table(title: str, data: pd.DataFrame, *, height: int = 360, expanded: bool = False) -> None:
    """Keep heavy tables out of the main render path unless the user needs them."""
    with st.expander(title, expanded=expanded):
        if data.empty:
            st.info("Tabulka je prázdná.")
        else:
            st.dataframe(data, hide_index=True, use_container_width=True, height=height)


def render_track_profile(points: list[dict[str, Any]], selected_idx: int | None = None) -> None:
    import plotly.graph_objects as go

    prof = profile_from_points(points, current_user_timezone())
    if prof.empty:
        st.info("Track nemá data pro profil.")
        return
    x = prof["time_local"] if prof["time_local"].notna().any() else prof["distance_km"]
    x_title = "Čas" if prof["time_local"].notna().any() else "Vzdálenost km"

    fig = go.Figure()
    fig.add_trace(
        go.Scatter(
            x=x,
            y=prof["alt_ft"],
            mode="lines",
            name="Altitude ft",
            line=dict(color="#38bdf8", width=2.4),
            hovertemplate="%{x}<br>Altitude: %{y:.0f} ft<extra></extra>",
        )
    )
    speed_values = pd.to_numeric(prof.get("speed_smooth"), errors="coerce") if "speed_smooth" in prof else pd.Series(dtype=float)
    has_speed = speed_values.notna().any()
    if has_speed:
        fig.add_trace(
            go.Scatter(
                x=x,
                y=speed_values,
                mode="lines",
                name="GPS speed km/h",
                yaxis="y2",
                line=dict(color="#f59e0b", width=2.2),
                hovertemplate="%{x}<br>Speed: %{y:.0f} km/h<extra></extra>",
            )
        )

    if selected_idx is not None and len(prof) > 0:
        idx = max(0, min(int(selected_idx), len(prof) - 1))
        sx = x.iloc[idx] if hasattr(x, "iloc") else x[idx]
        alt_y = prof["alt_ft"].iloc[idx]
        fig.add_trace(
            go.Scatter(
                x=[sx],
                y=[alt_y],
                mode="markers",
                name="Pozice",
                marker=dict(size=12, color="#22c55e", line=dict(color="#e5edf7", width=1)),
                hovertemplate="Pozice<br>%{x}<br>Altitude: %{y:.0f} ft<extra></extra>",
            )
        )
        if has_speed:
            spd_y = speed_values.iloc[idx] if idx < len(speed_values) else None
            if pd.notna(spd_y):
                fig.add_trace(
                    go.Scatter(
                        x=[sx],
                        y=[spd_y],
                        mode="markers",
                        name="Rychlost v pozici",
                        yaxis="y2",
                        marker=dict(size=10, color="#f59e0b", line=dict(color="#e5edf7", width=1)),
                        hovertemplate="Pozice<br>%{x}<br>Speed: %{y:.0f} km/h<extra></extra>",
                    )
                )
        try:
            fig.add_vline(x=sx, line_width=1.4, line_dash="dot", line_color="#e5edf7", opacity=0.68)
        except Exception:
            pass

    fig.update_layout(
        title="Profil letu",
        xaxis_title=x_title,
        yaxis=dict(title="Altitude ft", rangemode="tozero"),
        yaxis2=dict(title="GPS speed km/h", overlaying="y", side="right", rangemode="tozero"),
        legend=dict(orientation="h", yanchor="bottom", y=1.02, xanchor="right", x=1),
    )
    st.plotly_chart(plotly_layout(fig), use_container_width=True)


def _track_playback_default_idx(points: list[dict[str, Any]]) -> int:
    try:
        detected = detect_takeoff_landing(points)
        idx = int(detected.get("takeoff_idx", 0) or 0)
        return max(0, min(idx, max(0, len(points) - 1)))
    except Exception:
        return 0


def _format_track_point_value(value: Any, suffix: str = "") -> str:
    try:
        if value is None or pd.isna(value):
            return "—"
        return f"{float(value):.0f}{suffix}"
    except Exception:
        return "—"


def make_track_playback_map(points: list[dict[str, Any]], selected_idx: int, dark_mode: bool = True) -> folium.Map:
    import folium

    points = normalize_track_points(points)
    if not points:
        return folium.Map(location=[49.8, 15.5], zoom_start=7, tiles="CartoDB dark_matter" if dark_mode else "OpenStreetMap", control_scale=True)

    selected_idx = max(0, min(int(selected_idx), len(points) - 1))
    line_points = simplify_track_points(points, max_points=850)
    progress_points = simplify_track_points(points[: selected_idx + 1], max_points=450) if selected_idx >= 1 else points[:1]

    coords = [(float(p["lat"]), float(p["lon"])) for p in line_points if p.get("lat") is not None and p.get("lon") is not None]
    progress_coords = [(float(p["lat"]), float(p["lon"])) for p in progress_points if p.get("lat") is not None and p.get("lon") is not None]
    selected = points[selected_idx]
    selected_ll = (float(selected["lat"]), float(selected["lon"]))

    viewport = viewport_from_coords(coords or [selected_ll], profile="playback", default_center=selected_ll, default_zoom=10)
    center = [viewport.center[0], viewport.center[1]]
    zoom = viewport.zoom

    tiles = "CartoDB dark_matter" if dark_mode else "OpenStreetMap"
    m = folium.Map(location=center, zoom_start=zoom, tiles=tiles, control_scale=True, prefer_canvas=True)
    if coords and len(coords) >= 2:
        folium.PolyLine(coords, color="#64748b", weight=3, opacity=0.55, tooltip="Celý GPS track").add_to(m)
    if progress_coords and len(progress_coords) >= 2:
        folium.PolyLine(progress_coords, color="#38bdf8", weight=4, opacity=0.95, tooltip="Proletěná část").add_to(m)
    if coords:
        folium.CircleMarker(coords[0], radius=4, color="#22c55e", fill=True, fill_opacity=.95, tooltip="Start tracku").add_to(m)
        folium.CircleMarker(coords[-1], radius=4, color="#ef4444", fill=True, fill_opacity=.95, tooltip="Konec tracku").add_to(m)

    dt = parse_iso(selected.get("time"))
    time_txt = dt.astimezone(current_user_timezone()).strftime("%H:%M:%S") if dt else "—"
    alt_txt = _format_track_point_value((float(selected.get("alt")) * 3.28084 if selected.get("alt") is not None else None), " ft")
    popup = folium.Popup(f"<b>Pozice tracku</b><br>Čas: {time_txt}<br>Alt: {alt_txt}<br>Bod: {selected_idx + 1}/{len(points)}", max_width=260)
    folium.Marker(
        selected_ll,
        tooltip="Aktuální pozice",
        popup=popup,
        icon=folium.DivIcon(
            html='<div style="font-size:28px;line-height:28px;color:#38bdf8;text-shadow:0 0 8px #000;transform:translate(-12px,-12px);">✈</div>'
        ),
    ).add_to(m)
    try:
        if coords:
            m.fit_bounds([[min(c[0] for c in coords), min(c[1] for c in coords)], [max(c[0] for c in coords), max(c[1] for c in coords)]], padding=(22, 22))
    except Exception:
        pass
    return m



def _track_bearing_deg(a: dict[str, Any], b: dict[str, Any]) -> float:
    try:
        lat1 = math.radians(float(a["lat"]))
        lat2 = math.radians(float(b["lat"]))
        dlon = math.radians(float(b["lon"]) - float(a["lon"]))
        y = math.sin(dlon) * math.cos(lat2)
        x = math.cos(lat1) * math.sin(lat2) - math.sin(lat1) * math.cos(lat2) * math.cos(dlon)
        deg = (math.degrees(math.atan2(y, x)) + 360.0) % 360.0
        if not math.isfinite(deg):
            return 0.0
        return deg
    except Exception:
        return 0.0


def _track_bearing_at(points: list[dict[str, Any]], idx: int) -> float:
    if not points:
        return 0.0
    idx = max(0, min(int(idx), len(points) - 1))
    current = points[idx]
    for j in range(idx + 1, len(points)):
        try:
            if haversine_km(current, points[j]) > 0.015:
                return _track_bearing_deg(current, points[j])
        except Exception:
            pass
    for j in range(idx - 1, -1, -1):
        try:
            if haversine_km(points[j], current) > 0.015:
                return _track_bearing_deg(points[j], current)
        except Exception:
            pass
    return 0.0


def _json_safe_float(value: Any, digits: int | None = None) -> float | None:
    try:
        if value is None or pd.isna(value):
            return None
        f = float(value)
        if not math.isfinite(f):
            return None
        return round(f, digits) if digits is not None else f
    except Exception:
        return None


def _prepare_track_player_points(points: list[dict[str, Any]], max_points: int = 3200) -> tuple[list[dict[str, Any]], int, int]:
    source_points = normalize_track_points(points)
    original_count = len(source_points)
    if original_count > max_points:
        playback_points = downsample_points(source_points, max_points=max_points)
    else:
        playback_points = source_points

    prof = profile_from_points(playback_points, current_user_timezone())
    if prof.empty:
        return [], 0, original_count

    data: list[dict[str, Any]] = []
    for i, row in prof.iterrows():
        dt = row.get("time_local")
        time_txt = dt.strftime("%H:%M:%S") if pd.notna(dt) and hasattr(dt, "strftime") else "—"
        data.append({
            "lat": _json_safe_float(row.get("lat"), 7),
            "lon": _json_safe_float(row.get("lon"), 7),
            "alt_ft": _json_safe_float(row.get("alt_ft"), 0),
            "speed_kmh": _json_safe_float(row.get("speed_smooth"), 0),
            "distance_km": _json_safe_float(row.get("distance_km"), 2),
            "time": time_txt,
            "bearing": round(_track_bearing_at(playback_points, int(i)), 1),
        })
    data = [d for d in data if d.get("lat") is not None and d.get("lon") is not None]
    default_idx = _track_playback_default_idx(playback_points) if playback_points else 0
    default_idx = max(0, min(default_idx, max(0, len(data) - 1)))
    return data, default_idx, original_count


def _track_player_html(points_data: list[dict[str, Any]], default_idx: int, dark_mode: bool, original_count: int) -> str:
    points_json = json.dumps(points_data, ensure_ascii=False, separators=(",", ":"))
    tile_url = "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" if dark_mode else "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
    tile_attrib = "&copy; OpenStreetMap &copy; CARTO" if dark_mode else "&copy; OpenStreetMap contributors"
    replacements = {
        "__DATA__": html.escape(points_json, quote=False),
        "__DEFAULT__": str(int(default_idx)),
        "__ORIGINAL_COUNT__": str(int(original_count)),
        "__TILE_URL__": json.dumps(tile_url),
        "__TILE_ATTRIB__": json.dumps(tile_attrib),
        "__BG__": "#07111f" if dark_mode else "#ffffff",
        "__PANEL_BG__": "rgba(7,17,31,.92)" if dark_mode else "rgba(255,255,255,.95)",
        "__FG__": "#e5edf7" if dark_mode else "#0f172a",
        "__MUTED__": "#8aa4bd" if dark_mode else "#475569",
        "__BORDER__": "rgba(56,189,248,.24)" if dark_mode else "rgba(14,165,233,.24)",
    }
    template = """
<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>
  html, body { margin:0; padding:0; background:__BG__; color:__FG__; font-family: Inter, Segoe UI, Arial, sans-serif; }
  .track-player { border:1px solid __BORDER__; border-radius:16px; overflow:hidden; background:__PANEL_BG__; box-shadow: 0 18px 44px rgba(0,0,0,.22); }
  #map { height:360px; width:100%; background:#0b1220; }
  .hud { display:grid; grid-template-columns: repeat(4, minmax(0,1fr)); gap:10px; padding:12px 14px 6px 14px; }
  .metric { border:1px solid __BORDER__; border-radius:13px; padding:10px 12px; background:rgba(15,23,42,.42); min-width:0; }
  .label { color:__MUTED__; font-size:11px; letter-spacing:.08em; text-transform:uppercase; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .value { color:__FG__; font-size:21px; font-weight:760; margin-top:4px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .chart-wrap { padding:8px 14px 0 14px; }
  #profile { width:100%; height:190px; display:block; border:1px solid __BORDER__; border-radius:14px; background:rgba(2,8,23,.44); }
  .controls { display:grid; grid-template-columns: 54px 1fr 54px 78px; gap:10px; align-items:center; padding:12px 14px 14px 14px; }
  .btn { height:40px; border:1px solid rgba(56,189,248,.36); border-radius:12px; background:#0ea5e9; color:white; font-weight:800; cursor:pointer; }
  .btn.secondary { background:rgba(15,23,42,.62); color:__FG__; }
  #idx { width:100%; accent-color:#38bdf8; cursor:pointer; }
  .counter { color:__MUTED__; font-size:12px; text-align:right; white-space:nowrap; }
  .source-note { color:__MUTED__; font-size:11px; padding:0 14px 12px 14px; }
  .plane-wrap { width:34px; height:34px; margin-left:0; margin-top:0; display:flex; align-items:center; justify-content:center; filter: drop-shadow(0 0 7px rgba(0,0,0,.85)); }
  .plane-svg { width:30px; height:30px; transform-origin:50% 50%; }
  .leaflet-control-attribution { font-size:10px; background:rgba(0,0,0,.36) !important; color:#b8c7d8 !important; }
  .leaflet-control-attribution a { color:#7dd3fc !important; }
  @media (max-width: 760px) {
    .hud { grid-template-columns: repeat(2, minmax(0,1fr)); }
    .controls { grid-template-columns: 48px 1fr 48px; }
    .counter { display:none; }
  }
</style>
</head>
<body>
<div class="track-player">
  <div id="map"></div>
  <div class="hud">
    <div class="metric"><div class="label">Čas</div><div class="value" id="v-time">—</div></div>
    <div class="metric"><div class="label">Altitude</div><div class="value" id="v-alt">—</div></div>
    <div class="metric"><div class="label">GPS speed</div><div class="value" id="v-speed">—</div></div>
    <div class="metric"><div class="label">Vzdálenost</div><div class="value" id="v-dist">—</div></div>
  </div>
  <div class="chart-wrap">
    <svg id="profile" viewBox="0 0 1000 220" preserveAspectRatio="none">
      <line x1="52" y1="178" x2="970" y2="178" stroke="rgba(148,163,184,.24)" stroke-width="1" />
      <line x1="52" y1="42" x2="52" y2="178" stroke="rgba(148,163,184,.24)" stroke-width="1" />
      <g id="grid"></g>
      <polyline id="alt-line" fill="none" stroke="#38bdf8" stroke-width="3" stroke-linejoin="round" stroke-linecap="round" />
      <polyline id="speed-line" fill="none" stroke="#f59e0b" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" opacity=".94" />
      <line id="cursor" x1="52" y1="30" x2="52" y2="187" stroke="#e5edf7" stroke-width="1.4" stroke-dasharray="5 5" opacity=".78" />
      <circle id="alt-dot" r="6" fill="#22c55e" stroke="#e5edf7" stroke-width="1.4" />
      <circle id="speed-dot" r="5" fill="#f59e0b" stroke="#e5edf7" stroke-width="1.2" />
      <text x="56" y="27" fill="#38bdf8" font-size="13" font-weight="700">Altitude ft</text>
      <text x="880" y="27" fill="#f59e0b" font-size="13" font-weight="700">Speed km/h</text>
    </svg>
  </div>
  <div class="controls">
    <button class="btn" id="play">▶</button>
    <input id="idx" type="range" min="0" max="0" value="0" step="1" />
    <button class="btn secondary" id="reset">↺</button>
    <div class="counter" id="counter">—</div>
  </div>
  <div class="source-note" id="source-note"></div>
</div>
<script id="track-data" type="application/json">__DATA__</script>
<script>
(function() {
  const points = JSON.parse(document.getElementById('track-data').textContent || '[]');
  const defaultIdx = Math.max(0, Math.min(__DEFAULT__, points.length - 1));
  const originalCount = __ORIGINAL_COUNT__;
  const tileUrl = __TILE_URL__;
  const tileAttrib = __TILE_ATTRIB__;
  const slider = document.getElementById('idx');
  const playBtn = document.getElementById('play');
  const resetBtn = document.getElementById('reset');
  let timer = null;

  if (!points.length) {
    document.getElementById('map').innerHTML = '<div style="padding:20px;color:__MUTED__;">Track nemá data pro přehrávání.</div>';
    return;
  }

  const route = points.map(p => [p.lat, p.lon]);
  const map = L.map('map', { preferCanvas:true, zoomControl:true, attributionControl:true });
  L.tileLayer(tileUrl, { maxZoom: 18, attribution: tileAttrib }).addTo(map);
  const whole = L.polyline(route, { color:'#64748b', weight:3, opacity:.55 }).addTo(map);
  const progress = L.polyline(route.slice(0, defaultIdx + 1), { color:'#38bdf8', weight:4, opacity:.96 }).addTo(map);
  if (route.length > 1) { map.fitBounds(whole.getBounds(), { padding:[18,18] }); } else { map.setView(route[0], 11); }

  function planeHtml(bearing) {
    const rot = Number.isFinite(Number(bearing)) ? Number(bearing) : 0;
    return `<div class="plane-wrap"><svg class="plane-svg" style="transform:rotate(${rot}deg)" viewBox="0 0 64 64" aria-hidden="true"><path d="M32 3 C35 3 37 6 37 10 L37 26 L59 40 L59 47 L37 40 L37 53 L46 59 L46 63 L32 58 L18 63 L18 59 L27 53 L27 40 L5 47 L5 40 L27 26 L27 10 C27 6 29 3 32 3 Z" fill="#38bdf8" stroke="#e5edf7" stroke-width="2" /></svg></div>`;
  }
  const planeIcon = (bearing) => L.divIcon({ className:'', html:planeHtml(bearing), iconSize:[34,34], iconAnchor:[17,17] });
  const plane = L.marker(route[defaultIdx], { icon: planeIcon(points[defaultIdx].bearing), zIndexOffset:1000 }).addTo(map);

  function fmt(v, suffix, decimals=0) {
    if (v === null || v === undefined || Number.isNaN(Number(v))) return '—';
    return `${Number(v).toFixed(decimals)}${suffix || ''}`;
  }

  const altLine = document.getElementById('alt-line');
  const speedLine = document.getElementById('speed-line');
  const cursor = document.getElementById('cursor');
  const altDot = document.getElementById('alt-dot');
  const speedDot = document.getElementById('speed-dot');
  const grid = document.getElementById('grid');
  const L0 = 52, R0 = 970, T0 = 42, B0 = 178;
  const altVals = points.map(p => Number(p.alt_ft)).filter(Number.isFinite);
  const spdVals = points.map(p => Number(p.speed_kmh)).filter(Number.isFinite);
  const altMax = Math.max(500, ...(altVals.length ? altVals : [0]));
  const spdMax = Math.max(80, ...(spdVals.length ? spdVals : [0]));
  function x(i) { return L0 + (R0 - L0) * (points.length <= 1 ? 0 : i / (points.length - 1)); }
  function yAlt(v) { const n = Number.isFinite(Number(v)) ? Number(v) : 0; return B0 - (B0 - T0) * Math.max(0, Math.min(1, n / altMax)); }
  function ySpd(v) { const n = Number.isFinite(Number(v)) ? Number(v) : 0; return B0 - (B0 - T0) * Math.max(0, Math.min(1, n / spdMax)); }
  function poly(vals, yfn) { return vals.map((v,i) => `${x(i).toFixed(1)},${yfn(v).toFixed(1)}`).join(' '); }
  grid.innerHTML = '';
  for (let g=1; g<=3; g++) {
    const y = T0 + (B0-T0)*g/4;
    const line = document.createElementNS('http://www.w3.org/2000/svg','line');
    line.setAttribute('x1', L0); line.setAttribute('x2', R0); line.setAttribute('y1', y); line.setAttribute('y2', y);
    line.setAttribute('stroke', 'rgba(148,163,184,.16)'); line.setAttribute('stroke-width', '1');
    grid.appendChild(line);
  }
  altLine.setAttribute('points', poly(points.map(p => p.alt_ft), yAlt));
  speedLine.setAttribute('points', poly(points.map(p => p.speed_kmh), ySpd));

  function update(idx) {
    idx = Math.max(0, Math.min(points.length - 1, Number(idx) || 0));
    const p = points[idx];
    slider.value = String(idx);
    plane.setLatLng([p.lat, p.lon]);
    plane.setIcon(planeIcon(p.bearing));
    progress.setLatLngs(route.slice(0, idx + 1));
    document.getElementById('v-time').textContent = p.time || '—';
    document.getElementById('v-alt').textContent = fmt(p.alt_ft, ' ft', 0);
    document.getElementById('v-speed').textContent = fmt(p.speed_kmh, ' km/h', 0);
    document.getElementById('v-dist').textContent = fmt(p.distance_km, ' km', 1);
    document.getElementById('counter').textContent = `${idx + 1} / ${points.length}`;
    const cx = x(idx);
    cursor.setAttribute('x1', cx); cursor.setAttribute('x2', cx);
    altDot.setAttribute('cx', cx); altDot.setAttribute('cy', yAlt(p.alt_ft));
    speedDot.setAttribute('cx', cx); speedDot.setAttribute('cy', ySpd(p.speed_kmh));
  }

  function stop() {
    if (timer) { clearInterval(timer); timer = null; }
    playBtn.textContent = '▶';
  }
  function play() {
    if (timer) { stop(); return; }
    playBtn.textContent = 'Ⅱ';
    timer = setInterval(() => {
      let i = Number(slider.value) || 0;
      if (i >= points.length - 1) { stop(); return; }
      update(i + 1);
    }, 95);
  }
  slider.max = String(points.length - 1);
  slider.value = String(defaultIdx);
  slider.addEventListener('input', e => update(e.target.value));
  slider.addEventListener('pointerdown', stop);
  playBtn.addEventListener('click', play);
  resetBtn.addEventListener('click', () => { stop(); update(defaultIdx); });
  document.getElementById('source-note').textContent = originalCount > points.length ? `Přehrávač používá ${points.length} zjednodušených bodů z původních ${originalCount}. Plný KML zůstává uložený.` : `${points.length} bodů v přehrávači.`;
  setTimeout(() => map.invalidateSize(), 120);
  update(defaultIdx);
})();
</script>
</body>
</html>
"""
    for key, value in replacements.items():
        template = template.replace(key, value)
    return template


def render_track_playback(points: list[dict[str, Any]], flight_id: int, dark_mode: bool) -> None:
    points = normalize_track_points(points)
    if len(points) < 2:
        st.info("Track nemá dostatek bodů pro přehrávání.")
        return

    player_points, default_idx, original_count = _prepare_track_player_points(points)
    if len(player_points) < 2:
        st.info("Track nemá dostatek bodů pro přehrávání.")
        return

    html_doc = _track_player_html(player_points, default_idx, dark_mode, original_count)
    components.html(html_doc, height=710, scrolling=False)



# -----------------------------------------------------------------------------
# Pages
# -----------------------------------------------------------------------------

def page_dashboard(df: pd.DataFrame):
    st.markdown("## Dashboard")
    filtered = apply_filters(df, "dash")
    s = build_summary(filtered)

    current_year = datetime.now(LOCAL_TZ).year
    this_year = filtered[filtered.get("year", pd.Series(dtype=float)).eq(current_year)].copy() if not filtered.empty else pd.DataFrame()
    sy = build_summary(this_year)

    last_flight = filtered.sort_values(["date_dt", "off_block", "id"], ascending=[False, False, False], na_position="last").head(1) if not filtered.empty else pd.DataFrame()
    last_text = "—"
    last_sub = ""
    days_since = None
    if not last_flight.empty:
        lr = last_flight.iloc[0]
        last_text = f"{lr.get('date') or '—'}"
        last_sub = f"{lr.get('registration') or ''} • {lr.get('departure') or ''}-{lr.get('arrival') or ''}"
        if pd.notna(lr.get("date_dt")):
            days_since = (datetime.now(LOCAL_TZ).date() - lr.get("date_dt").date()).days

    unique_aircraft = int(filtered.get("registration", pd.Series(dtype=str)).replace("", pd.NA).dropna().nunique()) if not filtered.empty else 0
    c1, c2, c3, c4 = st.columns(4)
    with c1:
        metric_card("Celkový nálet", fmt_minutes(s["total"]), f"{s['flights']} letů • {s['starts']} startů")
    with c2:
        metric_card(f"Rok {current_year}", fmt_minutes(sy["total"]), f"{sy['flights']} letů • {fmt_money(sy['cost'])}")
    with c3:
        metric_card("Poslední let", last_text, last_sub if days_since is None else f"{last_sub} • před {days_since} dny")
    with c4:
        metric_card("Letadla / GPS", f"{unique_aircraft} / {s['tracks']}", f"{s['gps_km']:.0f} km GPS")

    quick = st.columns(4)
    with quick[0]:
        metric_card("PIC", fmt_minutes(s["pic"]), f"ULL {fmt_minutes(s['pic_ull'])} • EASA {fmt_minutes(s['pic_easa'])}")
    with quick[1]:
        metric_card("Air Time", fmt_minutes(s["air"]), f"Block {fmt_minutes(s['total'])}")
    with quick[2]:
        metric_card("DUAL / Safety", f"{fmt_minutes(s['dual'])} / {fmt_minutes(s['safety'])}", "")
    with quick[3]:
        metric_card("Náklady", fmt_money(s["cost"], current_user_currency()), f"Průměr {fmt_money((s['cost'] / max(s['flights'], 1)) if s['flights'] else 0, current_user_currency())} / let")

    if filtered.empty:
        st.info("Žádná data.")
        return

    # Streamlit renders all st.tabs eagerly.  Dashboard 2.0 used to build every
    # hidden Plotly chart/table on each rerun.  A horizontal section switch keeps
    # the same UX but executes only the section the user is actually viewing.
    section = st.radio(
        "Dashboard sekce",
        ["Přehled", "Letadla", "Letiště a trasy", "Náklady", "Poslední lety"],
        horizontal=True,
        label_visibility="collapsed",
        key="dashboard_section_v052",
    )

    if section == "Přehled":
        chart_df = filtered.dropna(subset=["year"]).copy()
        show_charts = st.toggle("Grafy", value=st.session_state.get("show_dashboard_charts", True), key="show_dashboard_charts")
        if show_charts and not chart_df.empty:
            import plotly.express as px
            monthly = chart_df.copy()
            monthly["month"] = monthly["date_dt"].dt.to_period("M").astype(str)
            month_summary = monthly.groupby("month", as_index=False).agg(
                Hodiny=("block_hours", "sum"),
                Lety=("id", "count"),
                Náklady=("cost", "sum"),
            ).tail(24)
            fig_month = px.bar(month_summary, x="month", y="Hodiny", title="Nálet po měsících")
            st.plotly_chart(plotly_layout(fig_month), use_container_width=True)

            role_year = chart_df.pivot_table(index="year", columns="role", values="block_hours", aggfunc="sum", fill_value=0).reset_index()
            role_cols = [c for c in ["PIC", "DUAL", "SAFETY PILOT", "INSTRUKTOR"] if c in role_year.columns]
            if role_cols:
                fig_role = px.bar(role_year, x="year", y=role_cols, barmode="stack", title="Nálet podle roku a funkce")
                st.plotly_chart(plotly_layout(fig_role), use_container_width=True)
        else:
            summary_rows = pd.DataFrame([
                {"Metrika": "Lety", "Hodnota": s["flights"]},
                {"Metrika": "Starty", "Hodnota": s["starts"]},
                {"Metrika": "Block", "Hodnota": fmt_minutes(s["total"])},
                {"Metrika": "Air", "Hodnota": fmt_minutes(s["air"])},
                {"Metrika": "PIC", "Hodnota": fmt_minutes(s["pic"])},
                {"Metrika": "Náklady", "Hodnota": fmt_money(s["cost"], current_user_currency())},
                {"Metrika": "GPS", "Hodnota": f"{s['tracks']} tracků / {s['gps_km']:.0f} km"},
            ])
            st.dataframe(summary_rows, hide_index=True, use_container_width=True, height=280)

    elif section == "Letadla":
        by_aircraft = (
            filtered.assign(registration=filtered.get("registration", pd.Series(dtype=str)).replace("", pd.NA))
            .dropna(subset=["registration"])
            .groupby("registration", as_index=False)
            .agg(
                Lety=("id", "count"),
                Block_h=("block_hours", "sum"),
                Air_h=("air_hours", "sum"),
                Starty=("starts", "sum"),
                Náklady=("cost", "sum"),
                GPS_km=("gps_km", "sum"),
            )
            .sort_values("Block_h", ascending=False)
        )
        if by_aircraft.empty:
            st.info("Žádná letadla.")
        else:
            import plotly.express as px
            fig_aircraft = px.bar(by_aircraft.head(12), x="registration", y="Block_h", title="TOP letadla podle block time")
            st.plotly_chart(plotly_layout(fig_aircraft), use_container_width=True)
            table = by_aircraft.copy()
            table["Block"] = table["Block_h"].mul(60).apply(fmt_minutes)
            table["Air"] = table["Air_h"].mul(60).apply(fmt_minutes)
            table["Náklady"] = table["Náklady"].apply(lambda v: fmt_money(v, current_user_currency()))
            table["GPS km"] = table["GPS_km"].round(0).astype(int)
            st.dataframe(table[["registration", "Lety", "Block", "Air", "Starty", "Náklady", "GPS km"]].rename(columns={"registration":"Imatrikulace"}), hide_index=True, use_container_width=True, height=380)

    elif section == "Letiště a trasy":
        import plotly.express as px
        dep = filtered.get("departure", pd.Series(dtype=str)).fillna("").astype(str).str.upper().str.strip()
        arr = filtered.get("arrival", pd.Series(dtype=str)).fillna("").astype(str).str.upper().str.strip()
        airport_visits = pd.concat([dep[dep.ne("")], arr[arr.ne("")]], ignore_index=True).value_counts().reset_index()
        airport_visits.columns = ["Letiště", "Návštěvy"]
        routes = filtered.copy()
        routes["Trasa"] = dep + "-" + arr
        routes = routes[(dep.ne("")) & (arr.ne(""))]
        route_summary = routes.groupby("Trasa", as_index=False).agg(
            Lety=("id", "count"),
            Block_h=("block_hours", "sum"),
            GPS_km=("gps_km", "sum"),
        ).sort_values(["Lety", "Block_h"], ascending=[False, False])
        left, right = st.columns(2)
        with left:
            if not airport_visits.empty:
                fig_airports = px.bar(airport_visits.head(15), x="Letiště", y="Návštěvy", title="Nejčastější letiště")
                st.plotly_chart(plotly_layout(fig_airports), use_container_width=True)
                st.dataframe(airport_visits.head(30), hide_index=True, use_container_width=True, height=360)
            else:
                st.info("Žádná letiště.")
        with right:
            if not route_summary.empty:
                fig_routes = px.bar(route_summary.head(15), x="Trasa", y="Lety", title="Nejčastější trasy")
                st.plotly_chart(plotly_layout(fig_routes), use_container_width=True)
                table = route_summary.copy()
                table["Block"] = table["Block_h"].mul(60).apply(fmt_minutes)
                table["GPS km"] = table["GPS_km"].round(0).astype(int)
                st.dataframe(table[["Trasa", "Lety", "Block", "GPS km"]].head(30), hide_index=True, use_container_width=True, height=360)
            else:
                st.info("Žádné trasy.")

    elif section == "Náklady":
        import plotly.express as px
        cost_df = filtered[pd.to_numeric(filtered.get("cost", pd.Series(dtype=float)), errors="coerce").fillna(0).gt(0)].copy()
        if cost_df.empty:
            st.info("Žádná nákladová data.")
        else:
            by_cost_aircraft = cost_df.groupby("registration", as_index=False).agg(Náklady=("cost", "sum"), Hodiny=("block_hours", "sum"), Lety=("id", "count")).sort_values("Náklady", ascending=False)
            by_cost_aircraft["Cena/h"] = (by_cost_aircraft["Náklady"] / by_cost_aircraft["Hodiny"].replace(0, pd.NA)).fillna(0)
            fig_cost = px.bar(by_cost_aircraft.head(12), x="registration", y="Náklady", title="Náklady podle letadla")
            st.plotly_chart(plotly_layout(fig_cost), use_container_width=True)
            table = by_cost_aircraft.copy()
            table["Náklady"] = table["Náklady"].apply(lambda v: fmt_money(v, current_user_currency()))
            table["Hodiny"] = table["Hodiny"].mul(60).apply(fmt_minutes)
            table["Cena/h"] = table["Cena/h"].apply(lambda v: fmt_money(v, current_user_currency()) + "/h")
            st.dataframe(table.rename(columns={"registration":"Imatrikulace"}), hide_index=True, use_container_width=True, height=360)

    elif section == "Poslední lety":
        recent = filtered.sort_values(["date_dt", "off_block", "id"], ascending=[False, False, False], na_position="last").head(20).copy()
        if recent.empty:
            st.info("Žádné lety.")
        else:
            recent_table = recent[["date", "registration", "departure", "arrival", "off_block", "on_block", "block_time", "role", "cost_label", "track_count"]].rename(columns={"date":"Datum","registration":"Imatrikulace","departure":"Odlet","arrival":"Přílet","off_block":"Off","on_block":"On","block_time":"Block","role":"Role","cost_label":"Cena","track_count":"GPS"})
            st.dataframe(recent_table, hide_index=True, use_container_width=True, height=520)


def flight_label(row: pd.Series | dict[str, Any]) -> str:
    return f"ID {int(row['id'])} • {row.get('date') or ''} • {row.get('registration') or ''} • {row.get('departure') or ''}-{row.get('arrival') or ''} • {row.get('off_block') or ''}-{row.get('on_block') or ''} • {row.get('role') or ''}"


def flight_display_df(df: pd.DataFrame) -> pd.DataFrame:
    cols = ["id","date","evidence","registration","aircraft_type","aircraft_class","departure","arrival","off_block","takeoff","landing","on_block","block_time","air_time","starts","commander","instructor","role","task","price_per_hour","cost_label","track_count","gps_km","note"]
    rename = {"id":"ID","date":"Datum","evidence":"Evidence","registration":"Imatrikulace","aircraft_type":"Typ","aircraft_class":"Třída","departure":"Odlet","arrival":"Přílet","off_block":"Off Block","takeoff":"Takeoff","landing":"Landing","on_block":"On Block","block_time":"Block","air_time":"Air","starts":"Starty","commander":"Velitel","instructor":"Instruktor","role":"Funkce","task":"Úloha","price_per_hour":"Cena/h","cost_label":"Cena","track_count":"GPS","gps_km":"GPS km","note":"Poznámka"}
    use = [c for c in cols if c in df.columns]
    return df[use].rename(columns=rename)



def add_minutes_to_time(value: Any, minutes: int | float) -> str:
    base = parse_time_to_minutes(value)
    if base is None:
        return ""
    total = (base + int(round(float(minutes or 0)))) % (24 * 60)
    return f"{total // 60:02d}:{total % 60:02d}"


FORM_KEY_MAP = {
    "date": "date",
    "evidence": "ev",
    "registration": "reg",
    "aircraft_type": "type",
    "aircraft_class": "class",
    "departure": "dep",
    "arrival": "arr",
    "off_block": "off",
    "takeoff": "to",
    "landing": "ldg",
    "on_block": "on",
    "starts": "starts",
    "commander": "cmd",
    "instructor": "instr",
    "role": "role",
    "task": "task",
    "price_per_hour": "price",
    "note": "note",
}


def _state_key(prefix: str, field: str) -> str:
    return f"{prefix}_{FORM_KEY_MAP[field]}"


def _clean_form_value(field: str, value: Any) -> Any:
    if value is None or (not isinstance(value, (date, datetime, time)) and pd.isna(value)):
        return ""
    if field == "date":
        try:
            return pd.to_datetime(value).date()
        except Exception:
            return date.today()
    if field in {"off_block", "takeoff", "landing", "on_block"}:
        return normalize_time(value) or ""
    if field in {"registration", "departure", "arrival", "evidence", "aircraft_class", "role"}:
        return str(value or "").upper().strip()
    if field == "starts":
        try:
            return int(value or 0)
        except Exception:
            return 1
    if field == "price_per_hour":
        try:
            return float(value or 0)
        except Exception:
            return 0.0
    return str(value or "").strip()


def set_form_values(prefix: str, values: dict[str, Any], *, include_times: bool = True, include_date: bool = False) -> None:
    for field, key_suffix in FORM_KEY_MAP.items():
        if field not in values:
            continue
        if field == "date" and not include_date:
            continue
        if field in {"off_block", "takeoff", "landing", "on_block"} and not include_times:
            continue
        st.session_state[f"{prefix}_{key_suffix}"] = _clean_form_value(field, values.get(field))


def recent_flights_for_templates(limit: int = 25) -> pd.DataFrame:
    try:
        flights = read_table("flights", current_user_id())
    except Exception:
        return pd.DataFrame()
    if flights.empty:
        return flights
    work = flights.copy()
    work["date_dt"] = pd.to_datetime(work.get("date"), errors="coerce")
    if "id" not in work.columns:
        return work.tail(limit)
    return work.sort_values(["date_dt", "off_block", "id"], ascending=[False, False, False], na_position="last").head(limit)


def recent_routes_for_picker(limit: int = 18) -> list[tuple[str, str]]:
    try:
        flights = read_table("flights", current_user_id())
    except Exception:
        return []
    if flights.empty or "departure" not in flights.columns or "arrival" not in flights.columns:
        return []
    work = flights.copy()
    work["departure"] = work["departure"].fillna("").astype(str).str.upper().str.strip()
    work["arrival"] = work["arrival"].fillna("").astype(str).str.upper().str.strip()
    work = work[work["departure"].ne("") & work["arrival"].ne("")]
    if work.empty:
        return []
    counts = work.groupby(["departure", "arrival"], as_index=False).size().sort_values("size", ascending=False)
    out: list[tuple[str, str]] = []
    for _, row in counts.head(limit).iterrows():
        dep = str(row.get("departure") or "")
        arr = str(row.get("arrival") or "")
        count = int(row.get("size") or 0)
        out.append((f"{dep}__{arr}", f"{dep}–{arr} ({count})"))
    return out


def _template_label(row: pd.Series | dict[str, Any]) -> str:
    r = row if isinstance(row, dict) else row.to_dict()
    return f"ID {int(r.get('id') or 0)} • {r.get('date') or ''} • {r.get('registration') or ''} • {r.get('departure') or ''}–{r.get('arrival') or ''} • {r.get('role') or ''}"


def render_quick_flight_tools(prefix: str, defaults: dict[str, Any], rates: pd.DataFrame) -> None:
    """Compact optional helpers for manual entry.

    v0.40.1 removes the previous recent-flight templates because they made the
    add-flight page visually heavy. The helpers stay tucked away and only fill
    route/times when explicitly used.
    """
    routes = recent_routes_for_picker()

    with st.expander("Rychlé doplnění", expanded=False):
        if routes:
            route_values = [""] + [r[0] for r in routes]
            route_labels = {r[0]: r[1] for r in routes}
            picked_route = st.selectbox(
                "Trasa z historie",
                route_values,
                format_func=lambda v: "—" if not v else route_labels.get(v, v.replace("__", "–")),
                key=f"{prefix}_route_pick_v0401",
            )
            r1, r2 = st.columns(2)
            if picked_route:
                dep, arr = str(picked_route).split("__", 1)
                if r1.button("Použít trasu", key=f"{prefix}_apply_route_v0401", use_container_width=True):
                    st.session_state[f"{prefix}_dep"] = dep
                    st.session_state[f"{prefix}_arr"] = arr
                if r2.button("Otočit trasu", key=f"{prefix}_reverse_route_v0401", use_container_width=True):
                    st.session_state[f"{prefix}_dep"] = arr
                    st.session_state[f"{prefix}_arr"] = dep

        t1, t2, t3, t4 = st.columns([1, 1, 1, .85])
        quick_takeoff_default = st.session_state.get(f"{prefix}_to", defaults.get("takeoff") or "")
        quick_air_default = minutes_diff(defaults.get("takeoff"), defaults.get("landing")) or 30
        with t1:
            q_takeoff = st.text_input("Vzlet", value=str(quick_takeoff_default or ""), key=f"{prefix}_quick_takeoff_v0401")
        with t2:
            q_air = st.number_input("Air min", min_value=0, max_value=1440, step=5, value=int(quick_air_default), key=f"{prefix}_quick_air_v0401")
        with t3:
            q_pad = st.number_input("Rezerva min", min_value=0, max_value=60, step=1, value=5, key=f"{prefix}_quick_pad_v0401")
        with t4:
            st.write("")
            if st.button("Doplnit časy", key=f"{prefix}_apply_times_v0401", use_container_width=True):
                takeoff = normalize_time(q_takeoff) or ""
                if takeoff:
                    st.session_state[f"{prefix}_to"] = takeoff
                    st.session_state[f"{prefix}_ldg"] = add_minutes_to_time(takeoff, int(q_air))
                    st.session_state[f"{prefix}_off"] = add_minutes_to_time(takeoff, -int(q_pad))
                    st.session_state[f"{prefix}_on"] = add_minutes_to_time(takeoff, int(q_air) + int(q_pad))

def _as_positive_float(value: Any) -> float | None:
    try:
        if value is None or pd.isna(value):
            return None
        value = float(value)
        return value if value > 0 else None
    except Exception:
        return None


def _normalize_billing_basis(value: Any) -> str:
    text = str(value or "BLOCK").upper().strip()
    return "AIR" if text == "AIR" else "BLOCK"


def _billing_basis_label(value: Any) -> str:
    return "Air Time" if _normalize_billing_basis(value) == "AIR" else "Block Time"


@st.cache_data(show_spinner=False, ttl=300)
def read_aircraft_catalog(active_only: bool, user_id: int) -> pd.DataFrame:
    try:
        aircraft = read_table("aircraft", user_id)
    except Exception:
        return pd.DataFrame()
    if aircraft.empty:
        return aircraft
    aircraft = aircraft.copy()
    aircraft["registration"] = aircraft["registration"].fillna("").astype(str).str.upper().str.strip()
    aircraft = aircraft[aircraft["registration"].ne("")]
    if "default_role" not in aircraft.columns:
        aircraft["default_role"] = "PIC"
    if "billing_basis" not in aircraft.columns:
        aircraft["billing_basis"] = "BLOCK"
    aircraft["default_role"] = aircraft["default_role"].fillna("PIC").astype(str).str.upper().str.strip()
    aircraft["billing_basis"] = aircraft["billing_basis"].fillna("BLOCK").astype(str).str.upper().str.strip()
    if active_only and "active" in aircraft.columns:
        aircraft = aircraft[pd.to_numeric(aircraft["active"], errors="coerce").fillna(1).astype(int).eq(1)]
    return aircraft.sort_values("registration")


def _aircraft_price(row: dict[str, Any], rates: pd.DataFrame, reg: str) -> float:
    # v0.58: dated rates are the source of truth; the aircraft field is only a
    # compatibility/current-price cache for legacy installations.
    rate = lookup_latest_rate(rates, reg, date.today())
    if rate and pd.notna(rate.get("price_per_hour")):
        try:
            return max(0.0, float(rate.get("price_per_hour") or 0))
        except Exception:
            pass
    price = _as_positive_float(row.get("default_price_per_hour"))
    return float(price or 0.0)


def _aircraft_type(row: dict[str, Any], rates: pd.DataFrame, reg: str) -> str:
    rate = lookup_latest_rate(rates, reg)
    return normalize_text(row.get("aircraft_type")) or normalize_text(rate.get("aircraft_type")) or ""


def _aircraft_label(reg: str, aircraft_by_reg: dict[str, dict[str, Any]], rates: pd.DataFrame) -> str:
    if not reg:
        return "Ručně"
    row = aircraft_by_reg.get(reg, {})
    parts = [reg]
    typ = _aircraft_type(row, rates, reg)
    if typ:
        parts.append(typ)
    price = _aircraft_price(row, rates, reg)
    if price > 0:
        parts.append(f"{price:.0f} {currency_symbol()}/h")
    basis = _normalize_billing_basis(row.get("billing_basis"))
    parts.append("AIR" if basis == "AIR" else "BLOCK")
    return " • ".join(parts)


def _apply_aircraft_to_form(prefix: str, reg: str, row: dict[str, Any], rates: pd.DataFrame) -> None:
    reg = str(reg or "").upper().strip()
    if not reg:
        return
    evidence = normalize_text(row.get("evidence")) or evidence_from_registration(reg)
    aircraft_class = normalize_text(row.get("aircraft_class")) or default_class_for(evidence)
    aircraft_type = _aircraft_type(row, rates, reg)
    price = _aircraft_price(row, rates, reg)
    default_role = normalize_text(row.get("default_role")) or "PIC"
    billing_basis = _normalize_billing_basis(row.get("billing_basis"))

    st.session_state[f"{prefix}_reg"] = reg
    st.session_state[f"{prefix}_type"] = aircraft_type
    st.session_state[f"{prefix}_ev"] = evidence if evidence in EVIDENCE_OPTIONS else evidence_from_registration(reg)
    st.session_state[f"{prefix}_class"] = aircraft_class if aircraft_class in CLASS_OPTIONS else default_class_for(st.session_state[f"{prefix}_ev"])
    st.session_state[f"{prefix}_price"] = price
    if default_role in ROLE_OPTIONS:
        st.session_state[f"{prefix}_role"] = default_role
    st.session_state[f"{prefix}_billing_basis"] = billing_basis


def render_aircraft_picker(prefix: str, defaults: dict[str, Any], rates: pd.DataFrame) -> None:
    aircraft = read_aircraft_catalog(active_only=True, user_id=current_user_id())
    if aircraft.empty:
        return
    aircraft_by_reg = {str(row.get("registration") or "").upper(): dict(row) for _, row in aircraft.iterrows()}
    regs = [r for r in aircraft_by_reg if r]
    if not regs:
        return
    options = [""] + regs
    inferred_reg = str(st.session_state.get(f"{prefix}_reg", defaults.get("registration") or "")).upper().strip()
    default_index = options.index(inferred_reg) if inferred_reg in options else 0
    pick_key = f"{prefix}_aircraft_pick"

    def on_change() -> None:
        selected = st.session_state.get(pick_key, "")
        if selected:
            _apply_aircraft_to_form(prefix, selected, aircraft_by_reg.get(selected, {}), rates)

    st.selectbox(
        "Letadlo",
        options,
        index=default_index,
        key=pick_key,
        format_func=lambda value: _aircraft_label(str(value), aircraft_by_reg, rates),
        on_change=on_change,
    )

    if inferred_reg in aircraft_by_reg and f"{prefix}_reg" not in st.session_state:
        _apply_aircraft_to_form(prefix, inferred_reg, aircraft_by_reg.get(inferred_reg, {}), rates)


def _nonempty_text(value: Any) -> str:
    if value is None:
        return ""
    try:
        if pd.isna(value):
            return ""
    except Exception:
        pass
    text = str(value).strip()
    return "" if text.lower() in {"nan", "none", "nat", "<na>"} else text


def validate_flight_data(data: dict[str, Any]) -> tuple[list[str], list[str]]:
    """Validate core logbook logic before create/update.

    Errors block saving. Warnings are shown to the user but the record can still
    be saved, because older real logbook entries may be intentionally incomplete.
    """
    errors: list[str] = []
    warnings: list[str] = []

    date_value = normalize_date(data.get("date"))
    registration = _nonempty_text(data.get("registration")).upper()
    departure = _nonempty_text(data.get("departure")).upper()
    arrival = _nonempty_text(data.get("arrival")).upper()
    evidence = _nonempty_text(data.get("evidence")).upper()
    role = _nonempty_text(data.get("role")).upper()
    aircraft_class = _nonempty_text(data.get("aircraft_class")).upper()
    billing_basis = _normalize_billing_basis(data.get("billing_basis"))

    if not date_value:
        errors.append("chybí datum")
    if not registration:
        errors.append("chybí imatrikulace")
    if evidence and evidence not in EVIDENCE_OPTIONS:
        errors.append("neplatná evidence")
    if role and role not in ROLE_OPTIONS:
        errors.append("neplatná funkce")
    if aircraft_class and aircraft_class not in CLASS_OPTIONS:
        warnings.append("neznámá třída letadla")
    if not departure:
        warnings.append("chybí odlet")
    if not arrival:
        warnings.append("chybí přílet")
    time_fields = {
        "Off Block": data.get("off_block"),
        "Takeoff": data.get("takeoff"),
        "Landing": data.get("landing"),
        "On Block": data.get("on_block"),
    }
    parsed_times: dict[str, int | None] = {}
    for label, value in time_fields.items():
        text = _nonempty_text(value)
        parsed = parse_time_to_minutes(value)
        parsed_times[label] = parsed
        if text and parsed is None:
            errors.append(f"neplatný čas {label}")

    off_block = data.get("off_block")
    takeoff = data.get("takeoff")
    landing = data.get("landing")
    on_block = data.get("on_block")
    block = minutes_diff(off_block, on_block)
    air = minutes_diff(takeoff, landing)

    if _nonempty_text(off_block) and not _nonempty_text(on_block):
        warnings.append("chybí On Block")
    if _nonempty_text(on_block) and not _nonempty_text(off_block):
        warnings.append("chybí Off Block")
    if _nonempty_text(takeoff) and not _nonempty_text(landing):
        warnings.append("chybí Landing")
    if _nonempty_text(landing) and not _nonempty_text(takeoff):
        warnings.append("chybí Takeoff")

    if block is not None:
        if block <= 0:
            warnings.append("Block Time je nulový")
        elif block > 12 * 60:
            warnings.append("Block Time je neobvykle dlouhý")
    if air is not None:
        if air <= 0:
            warnings.append("Air Time je nulový")
        elif air > 12 * 60:
            warnings.append("Air Time je neobvykle dlouhý")

    if block is not None and air is not None:
        if air > block + 1:
            errors.append("Air Time je delší než Block Time")
        elif block - air > 60:
            warnings.append("pojíždění / rozdíl Block-Air je větší než 60 min")

    if all(parsed_times.get(k) is not None for k in ("Off Block", "Takeoff", "Landing", "On Block")):
        taxi_out = minutes_diff(off_block, takeoff)
        airborne = minutes_diff(takeoff, landing)
        taxi_in = minutes_diff(landing, on_block)
        block_full = minutes_diff(off_block, on_block)
        if None not in (taxi_out, airborne, taxi_in, block_full):
            if taxi_out is not None and block_full is not None and taxi_out > block_full:
                errors.append("Takeoff není uvnitř Block Time")
            if taxi_in is not None and block_full is not None and taxi_in > block_full:
                errors.append("Landing není uvnitř Block Time")
            total_seq = int(taxi_out or 0) + int(airborne or 0) + int(taxi_in or 0)
            if block_full is not None and abs(total_seq - int(block_full)) > 1:
                errors.append("časy nejsou v logickém pořadí")

    try:
        starts = int(data.get("starts") or 0)
        if starts < 0:
            errors.append("počet startů nesmí být záporný")
        elif starts == 0:
            warnings.append("počet startů je 0")
    except Exception:
        errors.append("neplatný počet startů")

    try:
        price = float(data.get("price_per_hour") or 0)
        if price < 0:
            errors.append("cena nesmí být záporná")
        elif price == 0:
            warnings.append(f"cena letu je 0 {currency_symbol()}/h")
    except Exception:
        errors.append("neplatná cena")

    if billing_basis == "AIR" and air is None:
        warnings.append("účtování podle Air Time bez Air Time")
    if billing_basis == "BLOCK" and block is None:
        warnings.append("účtování podle Block Time bez Block Time")
    if role == "SAFETY PILOT":
        warnings.append("Safety pilot se nezapočítává do PIC")

    # Remove duplicates while preserving order.
    errors = list(dict.fromkeys(errors))
    warnings = [w for w in dict.fromkeys(warnings) if w not in errors]
    return errors, warnings


def render_flight_validation(data: dict[str, Any], *, compact: bool = False) -> tuple[list[str], list[str]]:
    errors, warnings = validate_flight_data(data)
    if errors:
        st.error("Kontrola: " + " • ".join(errors[:6]))
    elif warnings and not compact:
        st.warning("Kontrola: " + " • ".join(warnings[:6]))
    elif not compact:
        st.success("Kontrola: OK")
    return errors, warnings


def _inline_aircraft_state_keys(prefix: str) -> tuple[str, str, str]:
    token = hashlib.sha1(str(prefix).encode("utf-8")).hexdigest()[:12]
    return (
        f"inline_aircraft_pending_{token}",
        f"inline_aircraft_resolution_{token}",
        f"inline_aircraft_bypass_{token}",
    )


def _aircraft_profile_exists(registration: str) -> bool:
    reg = normalize_registration(registration)
    if not reg:
        return False
    catalog = read_aircraft_catalog(active_only=False, user_id=current_user_id())
    if catalog.empty or "registration" not in catalog.columns:
        return False
    regs = catalog["registration"].fillna("").astype(str).str.upper().str.strip()
    return bool(regs.eq(reg).any())


def _inline_aircraft_prefill(prefix: str, defaults: dict[str, Any]) -> dict[str, Any]:
    """Build aircraft-profile defaults without mutating the in-progress flight."""
    reg = normalize_registration(st.session_state.get(f"{prefix}_reg", defaults.get("registration")))
    flight_date = st.session_state.get(f"{prefix}_date", defaults.get("date") or date.today())
    try:
        effective = pd.to_datetime(flight_date).date()
    except Exception:
        effective = date.today()
    evidence = normalize_text(st.session_state.get(f"{prefix}_ev", defaults.get("evidence"))) or evidence_from_registration(reg)
    if evidence not in EVIDENCE_OPTIONS:
        evidence = evidence_from_registration(reg)
    aircraft_class = normalize_text(st.session_state.get(f"{prefix}_class", defaults.get("aircraft_class"))) or default_class_for(evidence)
    if aircraft_class not in CLASS_OPTIONS:
        aircraft_class = default_class_for(evidence)
    role = normalize_text(st.session_state.get(f"{prefix}_role", defaults.get("role"))) or current_user_default_role()
    if role not in ROLE_OPTIONS:
        role = "PIC"
    billing_basis = _normalize_billing_basis(st.session_state.get(f"{prefix}_billing_basis", defaults.get("billing_basis") or "BLOCK"))
    try:
        price = float(st.session_state.get(f"{prefix}_price", defaults.get("price_per_hour") or 0) or 0)
    except Exception:
        price = 0.0
    return {
        "registration": reg,
        "aircraft_type": normalize_text(st.session_state.get(f"{prefix}_type", defaults.get("aircraft_type"))),
        "icao_type": normalize_text(st.session_state.get(f"{prefix}_type", defaults.get("aircraft_type"))),
        "evidence": evidence,
        "aircraft_class": aircraft_class,
        "default_role": role,
        "billing_basis": billing_basis,
        "price_per_hour": price,
        "valid_from": effective,
    }


@st.dialog("Vytvořit profil letadla", width="large", dismissible=False)
def inline_aircraft_create_dialog(prefix: str) -> None:
    pending_key, resolution_key, bypass_key = _inline_aircraft_state_keys(prefix)
    payload = st.session_state.get(pending_key)
    if not isinstance(payload, dict):
        st.info("Rozpracovaný profil letadla už není k dispozici.")
        if st.button("Zavřít", use_container_width=True, key=f"inline_aircraft_close_{prefix}"):
            st.rerun()
        return

    profile = dict(payload.get("profile") or {})
    form_data = dict(payload.get("form_data") or {})
    mode = normalize_text(payload.get("mode")) or "preflight"
    reg = normalize_registration(profile.get("registration") or form_data.get("registration"))
    if not reg:
        st.error("Chybí imatrikulace letadla.")
        if st.button("Zpět", use_container_width=True, key=f"inline_aircraft_missing_reg_{prefix}"):
            st.session_state.pop(pending_key, None)
            st.rerun()
        return

    st.markdown(f"### {reg}")
    st.caption("Toto letadlo zatím nemá vlastní profil. Můžete ho vytvořit přímo tady a potom pokračovat v rozpracovaném letu.")
    st.info("KML, mapa, detekované časy i ostatní údaje rozpracovaného letu zůstanou zachované.")

    token = hashlib.sha1(str(prefix).encode("utf-8")).hexdigest()[:10]
    with st.form(f"inline_aircraft_profile_form_{token}"):
        st.markdown("#### Základní údaje")
        c1, c2, c3 = st.columns(3)
        with c1:
            st.text_input("Imatrikulace", value=reg, disabled=True)
            typ = st.text_input("Typ", value=normalize_text(profile.get("aircraft_type")), placeholder="Bristell B23")
        with c2:
            icao_type = st.text_input("ICAO typ", value=normalize_text(profile.get("icao_type") or profile.get("aircraft_type")), placeholder="BR23")
            evidence_default = normalize_text(profile.get("evidence")) or evidence_from_registration(reg)
            evidence = st.selectbox(
                "Evidence",
                EVIDENCE_OPTIONS,
                index=EVIDENCE_OPTIONS.index(evidence_default) if evidence_default in EVIDENCE_OPTIONS else 0,
            )
        with c3:
            class_default = normalize_text(profile.get("aircraft_class")) or default_class_for(evidence_default)
            aircraft_class = st.selectbox(
                "Třída",
                CLASS_OPTIONS,
                index=CLASS_OPTIONS.index(class_default) if class_default in CLASS_OPTIONS else 0,
            )
            role_default = normalize_text(profile.get("default_role")) or current_user_default_role()
            default_role = st.selectbox(
                "Výchozí role",
                ROLE_OPTIONS,
                index=ROLE_OPTIONS.index(role_default) if role_default in ROLE_OPTIONS else 0,
            )

        st.markdown("#### Provoz a cena")
        p1, p2, p3 = st.columns(3)
        with p1:
            initial_price = st.number_input(
                f"Cena za hodinu ({currency_symbol()})",
                min_value=0.0,
                step=50.0,
                value=float(profile.get("price_per_hour") or 0),
                format="%.0f",
            )
        with p2:
            valid_from = profile.get("valid_from")
            if not isinstance(valid_from, date):
                try:
                    valid_from = pd.to_datetime(valid_from or date.today()).date()
                except Exception:
                    valid_from = date.today()
            price_valid_from = st.date_input("Cena platí od", value=valid_from)
        with p3:
            basis_default = _normalize_billing_basis(profile.get("billing_basis") or "BLOCK")
            billing_basis = st.selectbox(
                "Účtovat podle",
                BILLING_BASIS_OPTIONS,
                index=BILLING_BASIS_OPTIONS.index(basis_default) if basis_default in BILLING_BASIS_OPTIONS else 0,
                format_func=_billing_basis_label,
            )
        note = st.text_area("Poznámka k letadlu", value="", height=70)
        active = st.checkbox("Aktivní letadlo", value=True)
        st.caption("První cena se uloží s datem účinnosti. Pozdější změny ceny se budou vést v historii profilu letadla.")
        create_profile = st.form_submit_button("Vytvořit profil a pokračovat", type="primary", use_container_width=True)

    if create_profile:
        try:
            upsert_aircraft_profile({
                "registration": reg,
                "aircraft_type": typ,
                "icao_type": icao_type.strip() or typ,
                "aircraft_class": aircraft_class,
                "evidence": evidence,
                "default_price_per_hour": initial_price,
                "default_role": default_role,
                "billing_basis": billing_basis,
                "active": active,
                "note": note,
                "rate_price": initial_price if initial_price > 0 else None,
                "rate_valid_from": price_valid_from,
            })
            # Keep the in-progress flight, but synchronize fields that are owned by
            # the newly created aircraft profile.
            st.session_state[f"{prefix}_reg"] = reg
            st.session_state[f"{prefix}_type"] = typ
            st.session_state[f"{prefix}_ev"] = evidence
            st.session_state[f"{prefix}_class"] = aircraft_class
            st.session_state[f"{prefix}_price"] = float(initial_price or 0)
            st.session_state[f"{prefix}_billing_basis"] = billing_basis

            if mode == "postsubmit":
                form_data.update({
                    "registration": reg,
                    "aircraft_type": typ,
                    "evidence": evidence,
                    "aircraft_class": aircraft_class,
                    "price_per_hour": float(initial_price or 0),
                    "billing_basis": billing_basis,
                })
                if not normalize_text(form_data.get("role")):
                    form_data["role"] = default_role
                payload["form_data"] = form_data
                st.session_state[pending_key] = payload
                st.session_state[resolution_key] = "created"
            else:
                st.session_state.pop(pending_key, None)
                st.session_state.pop(resolution_key, None)
            st.session_state.pop(bypass_key, None)
            st.rerun()
        except Exception as exc:
            st.error(str(exc))

    c1, c2 = st.columns(2)
    with c1:
        if st.button("Pokračovat bez profilu", use_container_width=True, key=f"inline_aircraft_skip_{token}"):
            if mode == "postsubmit":
                st.session_state[resolution_key] = "skip"
            else:
                st.session_state[bypass_key] = reg
                st.session_state.pop(pending_key, None)
            st.rerun()
    with c2:
        if st.button("Vrátit se k formuláři", use_container_width=True, key=f"inline_aircraft_back_{token}"):
            st.session_state[bypass_key] = reg
            st.session_state.pop(pending_key, None)
            st.session_state.pop(resolution_key, None)
            st.rerun()


def _prompt_inline_aircraft_profile(prefix: str, defaults: dict[str, Any], *, form_data: dict[str, Any] | None = None) -> None:
    pending_key, resolution_key, _bypass_key = _inline_aircraft_state_keys(prefix)
    st.session_state[pending_key] = {
        "mode": "postsubmit" if form_data is not None else "preflight",
        "profile": _inline_aircraft_prefill(prefix, form_data or defaults),
        "form_data": dict(form_data or {}),
    }
    st.session_state.pop(resolution_key, None)
    inline_aircraft_create_dialog(prefix)


def flight_form(prefix: str, defaults: dict[str, Any], rates: pd.DataFrame, submit_label: str, *, quick_tools: bool = True, prompt_missing_aircraft: bool = True) -> dict[str, Any] | None:
    pending_key, resolution_key, bypass_key = _inline_aircraft_state_keys(prefix)
    pending_payload = st.session_state.get(pending_key)
    resolution = normalize_text(st.session_state.get(resolution_key))
    if prompt_missing_aircraft and isinstance(pending_payload, dict) and resolution in {"created", "skip"}:
        saved = dict(pending_payload.get("form_data") or {})
        st.session_state.pop(pending_key, None)
        st.session_state.pop(resolution_key, None)
        if saved:
            return saved
    if prompt_missing_aircraft and isinstance(pending_payload, dict) and not resolution:
        inline_aircraft_create_dialog(prefix)
        return None

    # KML imports already know the registration before the form is shown. Offer
    # aircraft creation immediately instead of waiting until the user presses Save.
    inferred_reg = normalize_registration(st.session_state.get(f"{prefix}_reg", defaults.get("registration")))
    bypass_reg = normalize_registration(st.session_state.get(bypass_key))
    if (
        prompt_missing_aircraft
        and inferred_reg
        and inferred_reg != bypass_reg
        and not _aircraft_profile_exists(inferred_reg)
        and normalize_text(defaults.get("registration"))
    ):
        _prompt_inline_aircraft_profile(prefix, defaults)
        return None

    if quick_tools:
        render_quick_flight_tools(prefix, defaults, rates)
    render_aircraft_picker(prefix, defaults, rates)
    reg = str(st.session_state.get(f"{prefix}_reg", defaults.get("registration") or "")).upper()
    default_rate_date = defaults.get("date") or date.today()
    rate = lookup_latest_rate(rates, reg, default_rate_date)
    default_price = st.session_state.get(f"{prefix}_price", defaults.get("price_per_hour") or rate.get("price_per_hour") or 0.0)
    default_type = st.session_state.get(f"{prefix}_type", defaults.get("aircraft_type") or rate.get("aircraft_type") or "")
    default_billing_basis = _normalize_billing_basis(st.session_state.get(f"{prefix}_billing_basis", defaults.get("billing_basis") or "BLOCK"))
    with st.form(prefix):
        col1, col2, col3 = st.columns(3)
        with col1:
            flight_date = st.date_input("Datum", value=defaults.get("date") if isinstance(defaults.get("date"), date) else pd.to_datetime(defaults.get("date") or date.today()).date(), key=f"{prefix}_date")
            registration = st.text_input("Imatrikulace", value=reg, key=f"{prefix}_reg").upper()
            ev_def = st.session_state.get(f"{prefix}_ev", defaults.get("evidence") or evidence_from_registration(reg))
            evidence = st.selectbox("Evidence", EVIDENCE_OPTIONS, index=EVIDENCE_OPTIONS.index(ev_def) if ev_def in EVIDENCE_OPTIONS else 0, key=f"{prefix}_ev")
            aircraft_type = st.text_input("Typ", value=str(default_type or ""), key=f"{prefix}_type")
            cls_def = st.session_state.get(f"{prefix}_class", defaults.get("aircraft_class") or default_class_for(evidence))
            aircraft_class = st.selectbox("Třída", CLASS_OPTIONS, index=CLASS_OPTIONS.index(cls_def) if cls_def in CLASS_OPTIONS else 0, key=f"{prefix}_class")
        with col2:
            departure = st.text_input("Odlet", value=str(defaults.get("departure") or ""), key=f"{prefix}_dep").upper()
            arrival = st.text_input("Přílet", value=str(defaults.get("arrival") or ""), key=f"{prefix}_arr").upper()
            off_block = st.text_input("Off Block", value=str(defaults.get("off_block") or ""), key=f"{prefix}_off")
            takeoff = st.text_input("Takeoff", value=str(defaults.get("takeoff") or ""), key=f"{prefix}_to")
            landing = st.text_input("Landing", value=str(defaults.get("landing") or ""), key=f"{prefix}_ldg")
            on_block = st.text_input("On Block", value=str(defaults.get("on_block") or ""), key=f"{prefix}_on")
        with col3:
            starts = st.number_input("Starty / přistání", min_value=0, step=1, value=int(defaults.get("starts") or 1), key=f"{prefix}_starts")
            commander = st.text_input("Velitel", value=str(defaults.get("commander") or current_user_display_name()), key=f"{prefix}_cmd")
            instructor = st.text_input("Instruktor", value=str(defaults.get("instructor") or ""), key=f"{prefix}_instr")
            role_def = defaults.get("role") or "PIC"
            role = st.selectbox("Funkce", ROLE_OPTIONS, index=ROLE_OPTIONS.index(role_def) if role_def in ROLE_OPTIONS else 0, key=f"{prefix}_role")
            price = st.number_input(f"Cena {currency_symbol()}/h", min_value=0.0, step=50.0, value=float(default_price or 0), key=f"{prefix}_price")
            billing_basis = st.selectbox(
                "Účtovat podle",
                BILLING_BASIS_OPTIONS,
                index=BILLING_BASIS_OPTIONS.index(default_billing_basis) if default_billing_basis in BILLING_BASIS_OPTIONS else 0,
                key=f"{prefix}_billing_basis",
                format_func=_billing_basis_label,
            )
            task = st.text_input("Úloha", value=str(defaults.get("task") or ""), key=f"{prefix}_task")
            note = st.text_input("Poznámka", value=str(defaults.get("note") or ""), key=f"{prefix}_note")
        form_data = {"date": flight_date, "evidence": evidence, "registration": registration, "aircraft_type": aircraft_type, "aircraft_class": aircraft_class, "departure": departure, "arrival": arrival, "off_block": off_block, "takeoff": takeoff, "landing": landing, "on_block": on_block, "starts": int(starts), "commander": commander, "instructor": instructor, "role": role, "task": task, "price_per_hour": price, "billing_basis": billing_basis, "note": note}
        block = minutes_diff(off_block, on_block); air = minutes_diff(takeoff, landing)
        c1, c2, c3 = st.columns(3)
        with c1: metric_card("Block Time", fmt_minutes(block), "")
        with c2: metric_card("Air Time", fmt_minutes(air), "")
        bill_minutes = air if billing_basis == "AIR" else block
        with c3: metric_card("Cena letu", fmt_money((bill_minutes or 0)/60*price, current_user_currency()), _billing_basis_label(billing_basis))
        preview_errors, preview_warnings = validate_flight_data(form_data)
        if preview_errors:
            st.error("Kontrola: " + " • ".join(preview_errors[:5]))
        elif preview_warnings:
            st.warning("Kontrola: " + " • ".join(preview_warnings[:5]))
        submitted = st.form_submit_button(submit_label, type="primary", use_container_width=True)
    if submitted:
        errors, _warnings = validate_flight_data(form_data)
        if errors:
            return None
        if prompt_missing_aircraft:
            submitted_reg = normalize_registration(form_data.get("registration"))
            bypass_reg = normalize_registration(st.session_state.get(bypass_key))
            if submitted_reg and submitted_reg != bypass_reg and not _aircraft_profile_exists(submitted_reg):
                _prompt_inline_aircraft_profile(prefix, defaults, form_data=form_data)
                return None
        return form_data
    return None



def _track_time_proposal(points: list[dict[str, Any]], padding_minutes: int = 5) -> dict[str, Any]:
    """Create a conservative takeoff/landing proposal from one GPS track.

    The detector never writes to the flight automatically. It only prepares values
    that the user can explicitly copy into the edit form.
    """
    normalized = normalize_track_points(points)
    if len(normalized) < 2:
        return {}
    idx = detect_takeoff_landing(normalized)
    if not idx:
        return {}
    times = inferred_clock_times(normalized, idx, block_padding_minutes=padding_minutes, tz=current_user_timezone())
    if not times.get("takeoff") or not times.get("landing"):
        return {}
    air_minutes = minutes_diff(times.get("takeoff"), times.get("landing"))
    block_minutes = minutes_diff(times.get("off_block"), times.get("on_block"))
    return {
        **times,
        "air_minutes": air_minutes,
        "block_minutes": block_minutes,
        "takeoff_idx": int(idx.get("takeoff_idx", 0)),
        "landing_idx": int(idx.get("landing_idx", len(normalized) - 1)),
    }


def _set_edit_times_from_gps(flight_id: int, proposal: dict[str, Any], *, air_only: bool = False) -> None:
    prefix = f"edit_flight_{int(flight_id)}"
    if not proposal:
        return
    if not air_only:
        if proposal.get("off_block"):
            st.session_state[f"{prefix}_off"] = proposal["off_block"]
        if proposal.get("on_block"):
            st.session_state[f"{prefix}_on"] = proposal["on_block"]
    if proposal.get("takeoff"):
        st.session_state[f"{prefix}_to"] = proposal["takeoff"]
    if proposal.get("landing"):
        st.session_state[f"{prefix}_ldg"] = proposal["landing"]


def _gps_proposal_from_tracks(tracks: pd.DataFrame) -> tuple[dict[str, Any], list[dict[str, Any]], dict[str, Any]]:
    if tracks.empty:
        return {}, [], {}
    try:
        work = tracks.sort_values("id", ascending=False) if "id" in tracks.columns else tracks
        track_row = work.iloc[0].to_dict()
        points = json.loads(track_row.get("coordinates_json") or "[]")
        points = normalize_track_points(points)
        return _track_time_proposal(points), points, track_row
    except Exception:
        return {}, [], {}


def _render_gps_time_proposal(proposal: dict[str, Any], *, compact: bool = False) -> None:
    if not proposal:
        return
    cols = st.columns(4)
    with cols[0]:
        metric_card("GPS Takeoff", str(proposal.get("takeoff") or "—"), "")
    with cols[1]:
        metric_card("GPS Landing", str(proposal.get("landing") or "—"), "")
    with cols[2]:
        metric_card("Air", fmt_minutes(proposal.get("air_minutes")), "GPS návrh")
    with cols[3]:
        metric_card("Block", fmt_minutes(proposal.get("block_minutes")), "+5 min na obou stranách")
    if not compact:
        st.caption("GPS časy jsou pouze návrh. Do záznamu se zapíšou až po potvrzení a uložení editace.")


@st.dialog("Detail letu", width="large", dismissible=True, on_dismiss=clear_open_flight_dialog)
def flight_detail_dialog(selected_id: int, row_data: dict[str, Any], rates: pd.DataFrame, dark_mode: bool) -> None:
    row = pd.Series(row_data)
    route_text = f"{_safe_text(row_data.get('departure')) or '—'} → {_safe_text(row_data.get('arrival')) or '—'}"
    st.markdown(
        f"""
        <div class="flight-detail-hero">
            <div class="flight-detail-route">{route_text}</div>
            <div class="flight-detail-meta">
                <span>ID {int(selected_id)}</span>
                <span>{_safe_text(row_data.get('date')) or 'bez data'}</span>
                <span>{_safe_text(row_data.get('registration')) or 'bez imatrikulace'}</span>
                <span>{_safe_text(row_data.get('role')) or 'bez funkce'}</span>
                <span>{_safe_text(row_data.get('evidence')) or 'bez evidence'}</span>
            </div>
        </div>
        """,
        unsafe_allow_html=True,
    )
    pending_section_key = f"_detail_pending_section_{selected_id}"
    pending_section = st.session_state.pop(pending_section_key, None)
    if pending_section:
        st.session_state[f"detail_section_{selected_id}"] = pending_section
    flash_key = f"_detail_flash_{selected_id}"
    flash_message = st.session_state.pop(flash_key, None)
    if flash_message:
        st.success(str(flash_message))

    detail_section = st.radio(
        "Sekce detailu",
        ["Přehled", "Editace", "Track", "Smazání"],
        horizontal=True,
        key=f"detail_section_{selected_id}",
        label_visibility="collapsed",
    )
    if detail_section == "Přehled":
        block_text = _safe_text(row.get("block_time")) or "—"
        air_text = _safe_text(row.get("air_time")) or "—"
        price_text = _safe_text(row.get("cost_label")) or "—"
        gps_count = int(_safe_float(row.get("track_count"), 0))
        gps_km = _safe_float(row.get("gps_km"), 0)
        st.markdown(
            f"""
            <div class="detail-grid">
              <div class="detail-card">
                <div class="detail-card-label">Čas letu</div>
                <div class="detail-card-value">{block_text}</div>
                <div class="detail-card-sub">Air {air_text}</div>
              </div>
              <div class="detail-card">
                <div class="detail-card-label">Letadlo</div>
                <div class="detail-card-value">{_safe_text(row.get('registration')) or '—'}</div>
                <div class="detail-card-sub">{_safe_text(row.get('aircraft_type')) or '—'} · {_safe_text(row.get('aircraft_class')) or '—'}</div>
              </div>
              <div class="detail-card">
                <div class="detail-card-label">Cena</div>
                <div class="detail-card-value">{price_text}</div>
                <div class="detail-card-sub">{_safe_text(row.get('price_per_hour')) or '—'} {currency_symbol()}/h</div>
              </div>
              <div class="detail-card">
                <div class="detail-card-label">GPS</div>
                <div class="detail-card-value">{gps_count}</div>
                <div class="detail-card-sub">{gps_km:.1f} km</div>
              </div>
            </div>
            <div class="detail-split">
              <div class="detail-kv">
                <div class="detail-kv-title">Let</div>
                <div class="detail-kv-row"><span>Datum</span><span>{_safe_text(row.get('date')) or '—'}</span></div>
                <div class="detail-kv-row"><span>Trasa</span><span>{_safe_text(row.get('departure')) or '—'} → {_safe_text(row.get('arrival')) or '—'}</span></div>
                <div class="detail-kv-row"><span>Evidence</span><span>{_safe_text(row.get('evidence')) or '—'}</span></div>
                <div class="detail-kv-row"><span>Funkce</span><span>{_safe_text(row.get('role')) or '—'}</span></div>
                <div class="detail-kv-row"><span>Starty / přistání</span><span>{_safe_text(row.get('starts')) or '—'}</span></div>
              </div>
              <div class="detail-kv">
                <div class="detail-kv-title">Časy a posádka</div>
                <div class="detail-kv-row"><span>Block</span><span>{_safe_text(row.get('off_block')) or '—'} – {_safe_text(row.get('on_block')) or '—'}</span></div>
                <div class="detail-kv-row"><span>Air</span><span>{_safe_text(row.get('takeoff')) or '—'} – {_safe_text(row.get('landing')) or '—'}</span></div>
                <div class="detail-kv-row"><span>Velitel</span><span>{_safe_text(row.get('commander')) or '—'}</span></div>
                <div class="detail-kv-row"><span>Instruktor</span><span>{_safe_text(row.get('instructor')) or '—'}</span></div>
                <div class="detail-kv-row"><span>Úloha</span><span>{_safe_text(row.get('task')) or '—'}</span></div>
              </div>
            </div>
            """,
            unsafe_allow_html=True,
        )
        note_text = _safe_text(row.get("note"))
        if note_text:
            st.markdown(f'<div class="detail-kv"><div class="detail-kv-title">Poznámka</div>{note_text}</div>', unsafe_allow_html=True)
        detail_errors, detail_warnings = validate_flight_data(row_data)
        if detail_errors:
            st.error("Kontrola letu: " + " • ".join(detail_errors[:5]))
        elif detail_warnings:
            st.warning("Kontrola letu: " + " • ".join(detail_warnings[:5]))
    elif detail_section == "Editace":
        edit_tracks = read_tracks_for_flight(int(selected_id), current_user_id())
        gps_proposal, _gps_points, _gps_track_row = _gps_proposal_from_tracks(edit_tracks)
        if gps_proposal:
            with st.expander("GPS návrh časů", expanded=False):
                _render_gps_time_proposal(gps_proposal, compact=True)
                g1, g2 = st.columns(2)
                with g1:
                    if st.button("Použít GPS Block + Air", key=f"edit_apply_gps_all_{selected_id}", use_container_width=True):
                        _set_edit_times_from_gps(int(selected_id), gps_proposal, air_only=False)
                        st.toast("GPS časy byly vloženy do editace.")
                with g2:
                    if st.button("Použít jen Takeoff + Landing", key=f"edit_apply_gps_air_{selected_id}", use_container_width=True):
                        _set_edit_times_from_gps(int(selected_id), gps_proposal, air_only=True)
                        st.toast("GPS Air časy byly vloženy do editace.")
        saved = flight_form(f"edit_flight_{selected_id}", row.to_dict(), rates, "Uložit změny", quick_tools=False, prompt_missing_aircraft=False)
        if saved is not None:
            update_flight(int(selected_id), saved)
            st.session_state[f"_detail_pending_section_{selected_id}"] = "Přehled"
            st.session_state[f"_detail_flash_{selected_id}"] = "Změny uloženy."
            st.rerun()
    elif detail_section == "Track":
        flight_tracks = read_tracks_for_flight(int(selected_id), current_user_id())
        gps_proposal, first_points, selected_track_row = _gps_proposal_from_tracks(flight_tracks)
        if not flight_tracks.empty and first_points:
            render_track_playback(first_points, int(selected_id), dark_mode)
            if gps_proposal:
                _render_gps_time_proposal(gps_proposal, compact=True)
                if st.button("Použít GPS časy v editaci", key=f"track_to_edit_gps_{selected_id}", type="secondary", use_container_width=True):
                    _set_edit_times_from_gps(int(selected_id), gps_proposal, air_only=False)
                    st.session_state[f"_detail_pending_section_{selected_id}"] = "Editace"
                    st.session_state[f"_detail_flash_{selected_id}"] = "GPS návrh byl vložen do editace. Zkontroluj časy a ulož změny."
                    st.rerun()

            show = flight_tracks[["id","file_name","point_count","distance_km","start_utc","end_utc","max_alt_m"]].rename(columns={"id":"Track ID","file_name":"Soubor","point_count":"Body","distance_km":"Km","start_utc":"Start UTC","end_utc":"End UTC","max_alt_m":"Max alt m"})
            with st.expander("GPS soubory", expanded=False):
                st.dataframe(show, hide_index=True, use_container_width=True)
                del_id = st.selectbox("Track", show["Track ID"].tolist(), format_func=lambda x: f"Track ID {x}", key=f"delete_track_select_{selected_id}")
                confirm_track_delete = st.checkbox("Potvrzuji smazání vybraného tracku", value=False, key=f"confirm_track_delete_{selected_id}")
                if st.button("Smazat vybraný track", type="secondary", disabled=not confirm_track_delete, use_container_width=True, key=f"delete_track_btn_{selected_id}"):
                    delete_track(int(del_id))
                    st.session_state[f"_detail_flash_{selected_id}"] = "Track smazán."
                    st.rerun()
        else:
            st.info("K letu zatím není připojený track.")

        uploaded = st.file_uploader("Přidat / nahradit KML track", type=["kml"], key=f"attach_track_{selected_id}")
        if uploaded is not None:
            try:
                points = parse_kml_bytes(uploaded.read())
                if len(points) >= 2:
                    stats = track_stats(points)
                    smart_attach = analyze_track(points, current_user_timezone())
                    if int(smart_attach.get("flight_count") or 1) > 1:
                        st.warning(
                            f"Smart KML v tomto souboru vidí {int(smart_attach.get('flight_count') or 1)} možné lety. "
                            "Při připojení k existujícímu letu se track uloží jako jeden celek; pro rozdělení použij Nový let → KML import."
                        )
                    if int(smart_attach.get("touch_and_go_count") or 0):
                        st.info(f"Detekováno touch-and-go: {int(smart_attach.get('touch_and_go_count') or 0)}.")
                    point_count = len(points)
                    distance_km = _safe_float(stats.get("distance_km"), 0)
                    start_utc = _safe_text(points[0].get("time")) or "—"
                    end_utc = _safe_text(points[-1].get("time")) or "—"
                    st.caption(f"{uploaded.name} · {point_count} bodů · {distance_km:.1f} km · {start_utc} – {end_utc}")
                    replace = st.checkbox("Nahradit existující tracky u tohoto letu", value=True, key=f"replace_track_{selected_id}_{uploaded.name}")
                    if st.button("Uložit track k letu", type="primary", use_container_width=True):
                        save_track(int(selected_id), uploaded.name, points, replace_existing=replace)
                        st.session_state[f"_detail_flash_{selected_id}"] = "Track uložen."
                        st.rerun()
                else:
                    st.error("V KML nejsou použitelné body.")
            except Exception as exc:
                st.error(f"KML se nepodařilo zpracovat: {exc}")
    elif detail_section == "Smazání":
        st.markdown(
            f"""
            <div class="danger-box">
                <div class="danger-title">Trvalé smazání letu</div>
                <div class="danger-text">Tato akce smaže let ID {selected_id} ze zápisníku, včetně všech připojených KML tracků a GPS bodů. Po uložení se změna automaticky zazálohuje na GitHub, pokud je záloha zapnutá.</div>
            </div>
            """,
            unsafe_allow_html=True,
        )
        confirm = st.text_input(
            f"Pro potvrzení napiš ID letu: {selected_id}",
            value="",
            key=f"delete_flight_confirm_{selected_id}",
        )
        c_del, c_cancel = st.columns([1, 1])
        with c_del:
            if st.button("Trvale smazat let", type="primary", use_container_width=True, key=f"delete_flight_btn_{selected_id}"):
                if confirm.strip() == str(selected_id):
                    delete_flight(int(selected_id))
                    st.success(f"Let ID {selected_id} byl smazán.")
                    clear_open_flight_dialog()
                    st.rerun()
                else:
                    st.error("Potvrzení nesouhlasí. Napiš přesné ID letu.")
        with c_cancel:
            if st.button("Nemazat", use_container_width=True, key=f"delete_flight_cancel_{selected_id}"):
                clear_open_flight_dialog()
                st.rerun()
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
    return f"{_safe_float(value):.0f} {currency_symbol()}/h"


def _cell(main: Any, sub: Any = "") -> str:
    main_txt = _safe_text(main)
    sub_txt = _safe_text(sub)
    if sub_txt:
        return f'<div class="flight-cell"><div class="flight-cell-main">{main_txt}</div><div class="flight-cell-sub">{sub_txt}</div></div>'
    return f'<div class="flight-cell"><div class="flight-cell-main">{main_txt}</div></div>'


def _flight_validation_status(row: pd.Series | dict[str, Any]) -> tuple[str, str, str]:
    data = row.to_dict() if isinstance(row, pd.Series) else dict(row)
    errors, warnings = validate_flight_data(data)
    if errors:
        return "Chyba", "flight-status-error", "; ".join(errors[:3])
    if warnings:
        return "Pozor", "flight-status-warn", "; ".join(warnings[:3])
    return "OK", "flight-status-ok", ""


def _status_badge(label: Any, css_class: str = "") -> str:
    label_txt = _safe_text(label)
    class_txt = _safe_text(css_class or "flight-status-ok")
    return f'<div class="flight-cell"><span class="flight-status {class_txt}">{label_txt}</span></div>'


def annotate_flight_overview(df: pd.DataFrame) -> pd.DataFrame:
    """Add lightweight list/search/status columns for the flight overview."""
    if df.empty:
        return df.copy()
    work = df.copy()
    dep = work.get("departure", pd.Series(index=work.index, dtype=str)).fillna("").astype(str).str.upper().str.strip()
    arr = work.get("arrival", pd.Series(index=work.index, dtype=str)).fillna("").astype(str).str.upper().str.strip()
    work["route_key"] = dep + "__" + arr
    work.loc[dep.eq("") | arr.eq(""), "route_key"] = ""
    work["route_label"] = dep + "-" + arr
    work.loc[dep.eq("") | arr.eq(""), "route_label"] = ""
    work["airport_search"] = (dep + " " + arr).str.strip()
    work["has_gps"] = pd.to_numeric(work.get("track_count", 0), errors="coerce").fillna(0).astype(int).gt(0)

    # Flight validation remains available in add/edit and database checks.
    # The main list stays clean and does not compute/show status for every row.
    return work


def apply_logbook_filters_v2(df: pd.DataFrame) -> pd.DataFrame:
    """Focused filters for everyday logbook work."""
    if df.empty:
        return df.copy()
    work = annotate_flight_overview(df)

    years = sorted(int(y) for y in work["year"].dropna().unique()) if "year" in work else []
    registrations = sorted(r for r in work["registration"].dropna().astype(str).unique() if r)
    roles = sorted(r for r in work["role"].dropna().astype(str).unique() if r)
    classes = sorted(r for r in work["aircraft_class"].dropna().astype(str).unique() if r)
    dep = work.get("departure", pd.Series(dtype=str)).fillna("").astype(str).str.upper().str.strip()
    arr = work.get("arrival", pd.Series(dtype=str)).fillna("").astype(str).str.upper().str.strip()
    airports = sorted(set(dep[dep.ne("")].tolist()) | set(arr[arr.ne("")].tolist()))
    routes = sorted(r for r in work.get("route_label", pd.Series(dtype=str)).dropna().astype(str).unique() if r)

    with st.expander("Filtry a řazení", expanded=False):
        r1 = st.columns([1.05, 1.05, 1.25, 1.25])
        with r1[0]:
            selected_years = st.multiselect("Rok", years, default=years, key="logbook_v2_years")
        with r1[1]:
            selected_evidence = st.multiselect("Evidence", EVIDENCE_OPTIONS, default=EVIDENCE_OPTIONS, key="logbook_v2_evidence")
        with r1[2]:
            selected_regs = st.multiselect("Imatrikulace", registrations, default=[], key="logbook_v2_regs")
        with r1[3]:
            selected_airports = st.multiselect("Letiště", airports, default=[], key="logbook_v2_airports")

        r2 = st.columns([1.15, 1.15, 1.0, 1.3])
        with r2[0]:
            selected_roles = st.multiselect("Funkce", roles, default=roles, key="logbook_v2_roles")
        with r2[1]:
            selected_classes = st.multiselect("Třída", classes, default=[], key="logbook_v2_classes")
        with r2[2]:
            gps_filter = st.selectbox("GPS", ["Vše", "Pouze s GPS", "Pouze bez GPS"], key="logbook_v2_gps")
        with r2[3]:
            sort_mode = st.selectbox(
                "Řazení",
                ["Nejnovější", "Nejstarší", "ID sestupně", "Block nejdelší", "Náklady nejvyšší"],
                key="logbook_v2_sort",
            )

        route_search = st.multiselect("Trasa", routes, default=[], key="logbook_v2_routes")

    if selected_years:
        work = work[work["year"].isin(selected_years)]
    if selected_evidence:
        work = work[work["evidence"].isin(selected_evidence)]
    if selected_regs:
        work = work[work["registration"].isin(selected_regs)]
    if selected_airports:
        selected_set = set(selected_airports)
        work = work[work.get("departure", "").isin(selected_set) | work.get("arrival", "").isin(selected_set)]
    if selected_roles:
        work = work[work["role"].isin(selected_roles)]
    if selected_classes:
        work = work[work["aircraft_class"].isin(selected_classes)]
    if route_search:
        work = work[work["route_label"].isin(route_search)]
    if gps_filter == "Pouze s GPS":
        work = work[work["has_gps"]]
    elif gps_filter == "Pouze bez GPS":
        work = work[~work["has_gps"]]
    if sort_mode == "Nejstarší":
        work = work.sort_values(["date_dt", "off_block", "id"], ascending=[True, True, True], na_position="last")
    elif sort_mode == "ID sestupně":
        work = work.sort_values(["id"], ascending=[False], na_position="last")
    elif sort_mode == "Block nejdelší":
        work = work.sort_values(["block_minutes", "date_dt", "id"], ascending=[False, False, False], na_position="last")
    elif sort_mode == "Náklady nejvyšší":
        work = work.sort_values(["cost", "date_dt", "id"], ascending=[False, False, False], na_position="last")
    else:
        work = work.sort_values(["date_dt", "off_block", "id"], ascending=[False, False, False], na_position="last")

    if not work.empty:
        gps_count = int(work["has_gps"].sum())
        st.markdown(
            f'<div class="flight-filter-meta"><span>{len(work)} letů</span><span>{gps_count} GPS</span></div>',
            unsafe_allow_html=True,
        )
    return work.reset_index(drop=True)


def render_flight_list(table_df: pd.DataFrame, dark_mode: bool, rates: pd.DataFrame | None = None) -> None:
    """Compact paginated flight list with one real Detail button per visible row.

    This avoids unreliable table selection and avoids opening browser links. Only the
    visible page gets buttons, so it stays responsive on Streamlit Cloud.
    """
    if table_df.empty:
        st.info("Filtr nevrátil žádné lety.")
        return

    controls = st.columns([1.0, 2.4, 1.0, 1.0])
    with controls[0]:
        page_size_choice = st.selectbox("Řádků", [25, 50, 100, "Vše"], index=0, key="flight_page_size_v14")
    with controls[1]:
        quick_filter = st.text_input("Rychlé hledání", value="", placeholder="registrace, letiště, typ, funkce…", key="flight_table_quick_filter_v14")

    if quick_filter.strip():
        q = quick_filter.strip().lower()
        search_cols = [
            c for c in [
                "date", "evidence", "registration", "aircraft_type", "aircraft_class",
                "departure", "arrival", "role", "commander", "instructor", "task", "note"
            ] if c in table_df.columns
        ]
        if search_cols:
            search_frame = table_df[search_cols].fillna("").astype(str)
            search_blob = search_frame.agg(" ".join, axis=1).str.lower()
            shown_table = table_df.loc[search_blob.str.contains(q, regex=False, na=False)].copy()
        else:
            shown_table = table_df.iloc[0:0].copy()
    else:
        shown_table = table_df.copy()

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
            page = st.number_input("Stránka", min_value=1, max_value=page_count, value=min(max(1, int(st.session_state.get("flight_page_v14", 1))), page_count), step=1, key="flight_page_v14")
    with controls[3]:
        st.markdown(f'<div class="flight-page-info">{total_rows} letů • {page_count} stran</div>', unsafe_allow_html=True)

    start = 0 if show_all_rows else (int(page) - 1) * page_size
    end = total_rows if show_all_rows else start + page_size
    page_rows = shown_table.iloc[start:end].copy()

    widths = [0.78, 0.70, 0.64, 0.84, 0.46, 1.16, 1.02, 1.04, 0.70, 0.42, 0.84, 1.04, 0.70, 0.72, 0.48]
    headers = ["Detail", "Edit", "GPS", "Datum", "Ev.", "Letadlo", "Trasa", "Časy", "Block", "St.", "Funkce", "Velitel", "Úloha", "Cena", "GPS"]
    hcols = st.columns(widths, gap="small", vertical_alignment="top")
    for col, header in zip(hcols, headers):
        col.markdown(f'<div class="flight-list-head">{header}</div>', unsafe_allow_html=True)
    st.markdown('<div class="flight-list-first-gap"></div>', unsafe_allow_html=True)

    for _, row in page_rows.iterrows():
        flight_id = int(row.get("id"))
        cols = st.columns(widths, gap="small", vertical_alignment="top")
        with cols[0]:
            if st.button("Detail", key=f"flight_detail_btn_{flight_id}", use_container_width=True):
                st.session_state[f"detail_section_{flight_id}"] = "Přehled"
                st.session_state["open_flight_dialog_id"] = flight_id
                st.session_state["selected_flight_id"] = flight_id
                st.session_state.pop("dismissed_flight_id", None)
                st.rerun()
        with cols[1]:
            if st.button("Edit", key=f"flight_edit_btn_{flight_id}", use_container_width=True):
                st.session_state[f"detail_section_{flight_id}"] = "Editace"
                st.session_state["open_flight_dialog_id"] = flight_id
                st.session_state["selected_flight_id"] = flight_id
                st.session_state.pop("dismissed_flight_id", None)
                st.rerun()
        with cols[2]:
            track_count = _safe_int(row.get("track_count"))
            if st.button("GPS", key=f"flight_track_btn_{flight_id}", disabled=track_count <= 0, use_container_width=True):
                st.session_state[f"detail_section_{flight_id}"] = "Track"
                st.session_state["open_flight_dialog_id"] = flight_id
                st.session_state["selected_flight_id"] = flight_id
                st.session_state.pop("dismissed_flight_id", None)
                st.rerun()
        cols[3].markdown(_cell(row.get("date")), unsafe_allow_html=True)
        cols[4].markdown(_cell(row.get("evidence")), unsafe_allow_html=True)
        aircraft_sub = _join_nonblank([row.get("aircraft_type"), row.get("aircraft_class")])
        cols[5].markdown(_cell(row.get("registration"), aircraft_sub), unsafe_allow_html=True)
        cols[6].markdown(_cell(_range_text(row.get("departure"), row.get("arrival"))), unsafe_allow_html=True)
        time_main = _range_text(row.get("off_block"), row.get("on_block"))
        air_range = _range_text(row.get("takeoff"), row.get("landing"))
        time_sub = f"Air {air_range}" if air_range else ""
        cols[7].markdown(_cell(time_main, time_sub), unsafe_allow_html=True)
        cols[8].markdown(_cell(row.get("block_time"), f"Air {row.get('air_time') or ''}"), unsafe_allow_html=True)
        cols[9].markdown(_cell(_safe_int(row.get("starts"))), unsafe_allow_html=True)
        cols[10].markdown(_cell(row.get("role")), unsafe_allow_html=True)
        cols[11].markdown(_cell(row.get("commander"), row.get("instructor") if not _is_blank(row.get("instructor")) else ""), unsafe_allow_html=True)
        cols[12].markdown(_cell(row.get("task")), unsafe_allow_html=True)
        cols[13].markdown(_cell(row.get("cost_label"), _price_rate_label(row.get("price_per_hour"))), unsafe_allow_html=True)
        gps_km = _safe_float(row.get("gps_km"))
        cols[14].markdown(_cell(_safe_int(row.get("track_count")), f"{gps_km:.0f} km"), unsafe_allow_html=True)
        st.markdown('<div class="flight-row-sep"></div>', unsafe_allow_html=True)

    open_id = st.session_state.get("open_flight_dialog_id")
    valid_ids = set(table_df["id"].astype(int).tolist())
    if open_id is not None and int(open_id) in valid_ids:
        dialog_row = table_df[table_df["id"].astype(int).eq(int(open_id))].iloc[0]
        dialog_rates = rates if rates is not None else read_rates(current_user_id())
        flight_detail_dialog(int(open_id), dialog_row.to_dict(), dialog_rates, dark_mode)


def page_logbook(df: pd.DataFrame, dark_mode: bool):
    st.markdown("## Lety")
    notice = st.session_state.pop("_post_import_notice", None)
    if notice:
        st.success(str(notice))
    filtered = apply_logbook_filters_v2(df)
    s = build_summary(filtered)
    c1, c2, c3, c4 = st.columns(4)
    with c1: metric_card("Zobrazeno", str(s["flights"]), "letů")
    with c2: metric_card("Celkem", fmt_minutes(s["total"]), "block time")
    with c3: metric_card("PIC", fmt_minutes(s["pic"]), "z filtrovaných letů")
    with c4: metric_card("GPS", str(s["tracks"]), f"{s['gps_km']:.0f} km")

    if filtered.empty:
        st.info("Filtr nevrátil žádné lety.")
        return

    render_flight_list(filtered.reset_index(drop=True), dark_mode)


def _smart_import_signature(raw: bytes, file_name: str) -> str:
    digest = hashlib.sha1(raw).hexdigest()[:12]
    safe = re.sub(r"[^a-zA-Z0-9]+", "_", str(file_name or "track"))[:30]
    return f"{safe}_{digest}"


def _smart_event_local_time(points: list[dict[str, Any]], idx: int) -> str:
    if not points:
        return "—"
    idx = max(0, min(int(idx), len(points) - 1))
    dt = parse_iso(points[idx].get("time"))
    if not dt:
        return f"bod {idx + 1}"
    return dt.astimezone(current_user_timezone()).strftime("%H:%M:%S")


def _smart_part_filename(file_name: str, part_no: int, total: int) -> str:
    text = str(file_name or "track.kml")
    if text.lower().endswith(".kml"):
        return f"{text[:-4]}__part{part_no}-of-{total}.kml"
    return f"{text}__part{part_no}-of-{total}.kml"


def make_smart_split_preview_map(parts: list[list[dict[str, Any]]], dark_mode: bool = True) -> folium.Map:
    import folium

    all_coords: list[tuple[float, float]] = []
    clean_parts: list[list[dict[str, Any]]] = []
    for part in parts:
        simplified = simplify_track_points(normalize_track_points(part), max_points=360)
        coords = [(float(p["lat"]), float(p["lon"])) for p in simplified if p.get("lat") is not None and p.get("lon") is not None]
        if len(coords) >= 2:
            all_coords.extend(coords)
            clean_parts.append(simplified)
    viewport = viewport_from_coords(all_coords, profile="track") if all_coords else viewport_from_coords([], profile="track")
    tiles = "CartoDB dark_matter" if dark_mode else "OpenStreetMap"
    m = folium.Map(location=[viewport.center[0], viewport.center[1]], zoom_start=viewport.zoom, tiles=tiles, control_scale=True, prefer_canvas=True)
    colors = ["#38bdf8", "#f59e0b", "#a78bfa", "#22c55e", "#f43f5e"]
    for i, simplified in enumerate(clean_parts):
        coords = [(float(p["lat"]), float(p["lon"])) for p in simplified]
        color = colors[i % len(colors)]
        folium.PolyLine(coords, color=color, weight=4, opacity=.9, tooltip=f"Navržený let {i + 1}").add_to(m)
        folium.CircleMarker(coords[0], radius=4, color=color, fill=True, fill_opacity=.95, tooltip=f"Let {i + 1} – začátek").add_to(m)
        folium.CircleMarker(coords[-1], radius=4, color=color, fill=True, fill_opacity=.95, tooltip=f"Let {i + 1} – konec").add_to(m)
    return m


def render_smart_kml_analysis(
    analysis: dict[str, Any],
    points: list[dict[str, Any]],
    *,
    signature: str,
    dark_mode: bool,
) -> tuple[str, list[int]]:
    """Render Smart KML findings and return chosen mode + split indices.

    mode is either ``single`` or ``split``.  The user always has the final word;
    automatic detection is only a proposal.
    """
    split_candidates = list(analysis.get("split_candidates") or [])
    touch_count = int(analysis.get("touch_and_go_count") or 0)
    landing_count = int(analysis.get("landing_count") or 1)
    anomalies = list(analysis.get("anomalies") or [])
    locked_key = f"smart_import_locked_splits_{signature}"
    progress_key = f"smart_import_progress_{signature}"
    locked = st.session_state.get(locked_key)
    progress = int(st.session_state.get(progress_key, 0) or 0)

    c1, c2, c3 = st.columns(3)
    with c1:
        metric_card("Smart KML", f"{int(analysis.get('flight_count') or 1)}", "navržených letů")
    with c2:
        metric_card("Touch-and-go", str(touch_count), "detekováno")
    with c3:
        metric_card("Přistání / starty", str(landing_count), "automatický návrh")

    if touch_count:
        st.success(
            f"Detekováno {touch_count} pravděpodobných touch-and-go. "
            f"Počet startů/přistání bude předvyplněn na {landing_count}. Hodnotu můžeš ve formuláři kdykoliv změnit."
        )
        with st.expander("Detaily touch-and-go", expanded=False):
            for n, event in enumerate(analysis.get("touch_and_go_events") or [], start=1):
                when = _smart_event_local_time(points, int(event.get("index") or 0))
                st.markdown(f"**{n}. {when}** · {event.get('label') or 'Touch-and-go'}")
                if event.get("detail"):
                    st.caption(str(event.get("detail")))

    if anomalies:
        with st.expander(f"Kontrola kvality tracku · {len(anomalies)} upozornění", expanded=False):
            for event in anomalies[:12]:
                when = _smart_event_local_time(points, int(event.get("index") or 0))
                st.warning(f"{event.get('label') or 'Upozornění'} · {when} · {event.get('detail') or ''}")
            if len(anomalies) > 12:
                st.caption(f"Dalších {len(anomalies) - 12} upozornění není zobrazeno.")

    if not split_candidates:
        # Even when automatic detection is conservative, the pilot must always have
        # a manual escape hatch. This is especially useful for ADS-B coverage gaps
        # where the source does not contain ground points.
        st.markdown("#### Možnosti importu")
        if progress > 0 or (isinstance(locked, list) and locked):
            mode_label = "Rozdělit ručně"
            st.info("Rozdělený import už probíhá. Dokonči zbývající část; bod řezu je uzamčený.")
        else:
            mode_label = st.radio(
                "Jak chceš track importovat?",
                ["Nahrát jako jeden let", "Rozdělit ručně"],
                horizontal=True,
                key=f"smart_import_manual_mode_{signature}",
            )
        if mode_label == "Nahrát jako jeden let":
            return "single", []

        default_idx = max(1, min(len(points) - 2, len(points) // 2))
        time_gaps = [
            event for event in anomalies
            if str(event.get("kind") or "") == "time_gap" and event.get("duration_seconds") is not None
        ]
        if time_gaps:
            largest_gap = max(time_gaps, key=lambda event: float(event.get("duration_seconds") or 0))
            default_idx = max(1, min(len(points) - 2, int(largest_gap.get("index") or 1) - 1))
            st.info(
                "Automatická detekce nenašla dostatečně jisté rozdělení. "
                "Posuvník je proto přednastaven u největší časové mezery v tracku."
            )
        else:
            st.info("Automatická detekce nenašla rozdělení. Bod řezu můžeš zvolit ručně.")

        if isinstance(locked, list) and locked:
            chosen = int(locked[0])
            when = _smart_event_local_time(points, chosen)
            st.caption(f"Uzamčený čas rozdělení: **{when}**")
        else:
            chosen = st.slider(
                "Ruční bod rozdělení",
                min_value=1,
                max_value=max(1, len(points) - 2),
                value=default_idx,
                step=1,
                key=f"smart_manual_split_slider_{signature}",
            )
            when = _smart_event_local_time(points, int(chosen))
            st.caption(f"Zvolený čas rozdělení: **{when}**")
        parts = split_track_points(points, [int(chosen)])
        if len(parts) >= 2:
            render_folium_readonly(
                make_smart_split_preview_map(parts, dark_mode),
                height=390,
                key=f"smart_manual_split_map_{signature}_{chosen}",
            )
        return "split", [int(chosen)]

    proposed_count = len(split_candidates) + 1
    st.warning(
        f"Track pravděpodobně obsahuje **{proposed_count} samostatné lety**. "
        "Detekce je pouze návrh – pokud je chybná, můžeš track bez omezení uložit jako jeden let."
    )
    adjusted: list[int] = []
    if progress > 0 or (isinstance(locked, list) and locked):
        mode_label = "Rozdělit podle návrhu"
        st.info("Rozdělený import už probíhá. Dokonči zbývající části; původní track tím zůstane konzistentní.")
    else:
        mode_label = st.radio(
            "Jak chceš track importovat?",
            ["Rozdělit podle návrhu", "Nahrát jako jeden let"],
            horizontal=True,
            key=f"smart_import_mode_{signature}",
        )
    if mode_label == "Nahrát jako jeden let":
        return "single", []
    if isinstance(locked, list) and locked:
        adjusted = [int(x) for x in locked]
        st.info("Body rozdělení jsou po uložení prvního dílu uzamčené, aby oba záznamy používaly stejný track.")
    else:
        st.caption("Bod rozdělení můžeš před uložením ručně posunout. Čas vedle posuvníku ukazuje aktuální zvolenou pozici.")
        for i, event in enumerate(split_candidates, start=1):
            proposed = max(1, min(len(points) - 2, int(event.get("index") or 1)))
            chosen = st.slider(
                f"Rozdělení {i}",
                min_value=1,
                max_value=max(1, len(points) - 2),
                value=proposed,
                step=1,
                key=f"smart_split_slider_{signature}_{i}",
            )
            adjusted.append(int(chosen))
            when = _smart_event_local_time(points, int(chosen))
            confidence = str(event.get("confidence") or "medium")
            duration = event.get("duration_seconds")
            duration_text = f" · mezera {float(duration):.0f} s" if duration is not None else ""
            st.caption(f"Navržený čas: **{when}** · jistota {confidence}{duration_text} · {event.get('detail') or ''}")

    adjusted = sorted({max(1, min(len(points) - 2, int(x))) for x in adjusted})
    parts = split_track_points(points, adjusted)
    if len(parts) >= 2:
        render_folium_readonly(
            make_smart_split_preview_map(parts, dark_mode),
            height=390,
            key=f"smart_split_map_{signature}_{'_'.join(str(x) for x in adjusted)}_{progress}",
        )
        summary_cols = st.columns(min(4, len(parts)))
        for i, part in enumerate(parts[:4]):
            part_stats = track_stats(part)
            part_analysis = analyze_track(part, current_user_timezone())
            part_idx = detect_takeoff_landing(part)
            part_times = inferred_clock_times(part, part_idx, block_padding_minutes=5, tz=current_user_timezone())
            with summary_cols[i]:
                metric_card(
                    f"Let {i + 1}",
                    f"{part_times.get('takeoff') or '—'}–{part_times.get('landing') or '—'}",
                    f"{float(part_stats.get('distance_km') or 0):.1f} km · přistání {int(part_analysis.get('landing_count') or 1)}",
                )
    return "split", adjusted


def _clear_smart_import_progress(signature: str) -> None:
    for key in (
        f"smart_import_progress_{signature}",
        f"smart_import_created_{signature}",
        f"smart_import_locked_splits_{signature}",
    ):
        st.session_state.pop(key, None)


def render_split_kml_import_wizard(
    *,
    raw: bytes,
    file_name: str,
    points: list[dict[str, Any]],
    split_indices: list[int],
    rates: pd.DataFrame,
    dark_mode: bool,
    signature: str,
) -> None:
    """Sequentially review and save every proposed flight segment."""
    progress_key = f"smart_import_progress_{signature}"
    created_key = f"smart_import_created_{signature}"
    locked_key = f"smart_import_locked_splits_{signature}"
    locked = st.session_state.get(locked_key)
    effective_splits = [int(x) for x in locked] if isinstance(locked, list) and locked else [int(x) for x in split_indices]
    parts = split_track_points(points, effective_splits)
    if len(parts) < 2:
        st.error("Track se podle zvolených bodů nepodařilo rozdělit na použitelné části.")
        return

    progress = max(0, min(int(st.session_state.get(progress_key, 0) or 0), len(parts) - 1))
    created_ids = list(st.session_state.get(created_key) or [])
    current = parts[progress]
    current_analysis = analyze_track(current, current_user_timezone())
    current_name = _smart_part_filename(file_name, progress + 1, len(parts))
    defaults = infer_from_track(current, current_name, rates, smart_analysis=current_analysis)
    stats = defaults.pop("stats")
    defaults.pop("detect_idx", None)
    has_clock = defaults.pop("has_clock", False)

    st.markdown(f"### Rozdělený import · let {progress + 1} z {len(parts)}")
    if created_ids:
        st.caption("Již uložené lety: " + ", ".join(f"ID {x}" for x in created_ids))
    render_kml_import_header(raw, current_name, defaults, stats, has_clock)

    preview_df = pd.DataFrame([{
        "id": -(progress + 1),
        "flight_id": -(progress + 1),
        "coordinates_json": json.dumps(current),
        "file_name": current_name,
        "distance_km": stats["distance_km"],
        "date": defaults.get("date"),
        "registration": defaults.get("registration"),
        "departure": defaults.get("departure"),
        "arrival": defaults.get("arrival"),
        "role": defaults.get("role"),
        "evidence": defaults.get("evidence"),
    }])
    render_folium_readonly(
        make_map(preview_df, dark_mode),
        height=360,
        key=f"split_part_preview_{signature}_{progress}_{len(current)}",
    )
    if int(current_analysis.get("touch_and_go_count") or 0):
        st.info(
            f"V tomto dílu Smart KML detekoval {int(current_analysis.get('touch_and_go_count') or 0)} touch-and-go; "
            f"počet startů/přistání je předvyplněn na {int(current_analysis.get('landing_count') or 1)}."
        )

    saved = flight_form(
        f"new_split_{signature}_{progress}",
        defaults,
        rates,
        "Uložit a pokračovat" if progress + 1 < len(parts) else "Uložit poslední let",
    )
    if saved is None:
        return

    if not locked:
        st.session_state[locked_key] = [int(x) for x in effective_splits]
    flight_id = create_flight(saved, auto_backup=False)
    save_track(flight_id, current_name, current, replace_existing=True)
    created_ids.append(int(flight_id))
    st.session_state[created_key] = created_ids

    if progress + 1 < len(parts):
        st.session_state[progress_key] = progress + 1
        st.rerun()

    _clear_smart_import_progress(signature)
    st.session_state["page"] = "Lety"
    st.session_state["open_flight_dialog_id"] = int(created_ids[-1])
    st.session_state["selected_flight_id"] = int(created_ids[-1])
    st.session_state.pop("dismissed_flight_id", None)
    st.session_state["_post_import_notice"] = f"Smart KML uložil {len(created_ids)} samostatné lety: " + ", ".join(f"ID {x}" for x in created_ids)
    st.rerun()


def page_new_flight(rates: pd.DataFrame, dark_mode: bool):
    st.markdown("## Nový let")

    mode = st.radio(
        "Způsob přidání",
        ["KML import", "Ručně"],
        horizontal=True,
        label_visibility="collapsed",
        key="new_flight_mode_v040",
    )

    if mode == "KML import":
        uploaded = st.file_uploader("KML track", type=["kml"], key="new_track_kml_v060")
        if uploaded is None:
            return

        raw = uploaded.getvalue()
        signature = _smart_import_signature(raw, uploaded.name)
        try:
            points = parse_kml_bytes(raw)
        except Exception as exc:
            st.error(f"KML se nepodařilo zpracovat: {exc}")
            points = []

        if len(points) < 2:
            st.error("V KML nejsou použitelné body trasy.")
            return

        smart = analyze_track(points, current_user_timezone())
        mode_choice, split_indices = render_smart_kml_analysis(
            smart,
            points,
            signature=signature,
            dark_mode=dark_mode,
        )

        if mode_choice == "split" and split_indices:
            render_split_kml_import_wizard(
                raw=raw,
                file_name=uploaded.name,
                points=points,
                split_indices=split_indices,
                rates=rates,
                dark_mode=dark_mode,
                signature=signature,
            )
            return

        # Explicit fallback chosen by the user, or no split was detected.  Keep the
        # original KML intact and import it as one flight.
        _clear_smart_import_progress(signature)
        defaults = infer_from_track(points, uploaded.name, rates, smart_analysis=smart)
        stats = defaults.pop("stats")
        defaults.pop("detect_idx", None)
        has_clock = defaults.pop("has_clock", False)

        render_kml_import_header(raw, uploaded.name, defaults, stats, has_clock)

        preview_df = pd.DataFrame([{
            "id": -1,
            "flight_id": -1,
            "coordinates_json": json.dumps(points),
            "file_name": uploaded.name,
            "distance_km": stats["distance_km"],
            "date": defaults.get("date"),
            "registration": defaults.get("registration"),
            "departure": defaults.get("departure"),
            "arrival": defaults.get("arrival"),
            "role": defaults.get("role"),
            "evidence": defaults.get("evidence"),
        }])
        render_folium_readonly(
            make_map(preview_df, dark_mode),
            height=420,
            key=f"new_flight_preview_map_v060_{signature}_{len(points)}_{int(stats.get('distance_km') or 0)}",
        )

        if not has_clock:
            st.warning("Doplň časy ručně.")

        if int(smart.get("flight_count") or 1) > 1:
            st.info("Zvolil jsi nahrání bez rozdělení. Celý původní KML track bude uložen k jednomu záznamu beze změny.")

        show_profile = st.toggle("Profil tracku", value=False, key=f"show_import_profile_v060_{signature}_{len(points)}")
        if show_profile:
            render_track_profile(points)

        saved = flight_form("new_from_track_v060", defaults, rates, "Uložit let")
        if saved is not None:
            flight_id = create_flight(saved, auto_backup=False)
            save_track(flight_id, uploaded.name, points, replace_existing=True)
            st.session_state["page"] = "Lety"
            st.session_state["open_flight_dialog_id"] = flight_id
            st.session_state["selected_flight_id"] = flight_id
            st.session_state.pop("dismissed_flight_id", None)
            st.session_state["_post_import_notice"] = f"KML uložen jako jeden let ID {flight_id}."
            st.rerun()
    else:
        default_evidence = current_user_default_evidence()
        defaults = {
            "date": date.today(),
            "evidence": default_evidence,
            "aircraft_class": default_class_for(default_evidence),
            "departure": current_user_home_airport(),
            "starts": 1,
            "commander": current_user_display_name(),
            "role": current_user_default_role(),
        }
        saved = flight_form("new_manual_v040", defaults, rates, "Přidat let")
        if saved is not None:
            flight_id = create_flight(saved)
            st.session_state["page"] = "Lety"
            st.session_state["open_flight_dialog_id"] = flight_id
            st.session_state["selected_flight_id"] = flight_id
            st.session_state.pop("dismissed_flight_id", None)
            st.success(f"Uloženo ID {flight_id}.")
            st.rerun()


def map_navigation_options(df: pd.DataFrame) -> tuple[list[str], list[tuple[str, str]], int]:
    needed: set[str] = set()
    if not df.empty:
        for col in ("departure", "arrival"):
            if col in df.columns:
                values = df[col].fillna("").astype(str).str.upper().str.strip()
                needed.update(values[values.ne("")].tolist())
    lookup = airport_coords_for_idents(tuple(sorted(needed)), current_user_id())
    airports: set[str] = set()
    routes: dict[tuple[str, str], int] = {}
    known_routes = 0
    if df.empty:
        return [], [], 0
    for _, row in df.iterrows():
        dep = normalize_text(row.get("departure"))
        arr = normalize_text(row.get("arrival"))
        if not dep or not arr:
            continue
        dep = dep.upper()
        arr = arr.upper()
        if dep not in lookup or arr not in lookup:
            continue
        known_routes += 1
        airports.add(dep)
        airports.add(arr)
        key = tuple(sorted([dep, arr]))
        routes[key] = routes.get(key, 0) + 1
    airport_options = sorted(airports)
    route_options = []
    for (dep, arr), count in sorted(routes.items(), key=lambda item: (-item[1], item[0])):
        value = f"{dep}__{arr}"
        label = f"{dep}–{arr} ({count})"
        route_options.append((value, label))
    return airport_options, route_options, known_routes


def render_map_navigation_controls(filtered: pd.DataFrame) -> None:
    airports, routes, _ = map_navigation_options(filtered)
    current_airport = normalize_text(st.session_state.get("map_airport"))
    current_route = normalize_text(st.session_state.get("map_route"))
    if current_airport and current_airport not in airports:
        airports = [current_airport] + airports
    route_values_existing = [value for value, _ in routes]
    if current_route and current_route not in route_values_existing:
        routes = [(current_route, current_route.replace("__", "–"))] + routes
    if not airports and not routes:
        return
    c1, c2 = st.columns(2)
    airport_values = [""] + airports
    route_values = [""] + [value for value, _ in routes]
    route_labels = {value: label for value, label in routes}
    airport_index = airport_values.index(current_airport) if current_airport in airport_values else 0
    route_index = route_values.index(current_route) if current_route in route_values else 0
    with c1:
        airport_choice = st.selectbox("Letiště", airport_values, index=airport_index, key="map_airport_picker_v039", format_func=lambda v: v or "—")
    with c2:
        route_choice = st.selectbox("Trasa", route_values, index=route_index, key="map_route_picker_v039", format_func=lambda v: route_labels.get(v, "—"))
    if airport_choice and airport_choice != current_airport:
        st.session_state["map_airport"] = airport_choice
        st.session_state.pop("map_route", None)
        st.rerun()
    elif route_choice and route_choice != current_route:
        st.session_state["map_route"] = route_choice
        st.session_state.pop("map_airport", None)
        st.rerun()

def _airport_selection(df: pd.DataFrame, ident: str) -> pd.DataFrame:
    if df.empty or not ident:
        return pd.DataFrame()
    ident = str(ident).upper().strip()
    dep = df.get("departure", pd.Series(dtype=str)).fillna("").astype(str).str.upper()
    arr = df.get("arrival", pd.Series(dtype=str)).fillna("").astype(str).str.upper()
    return df[dep.eq(ident) | arr.eq(ident)].copy()


def _parse_route_selection(value: str | None) -> tuple[str, str] | None:
    if not value or "__" not in str(value):
        return None
    dep, arr = str(value).upper().split("__", 1)
    dep = dep.strip()
    arr = arr.strip()
    if not dep or not arr:
        return None
    return dep, arr


def _route_selection(df: pd.DataFrame, dep: str, arr: str) -> pd.DataFrame:
    if df.empty:
        return pd.DataFrame()
    dep = dep.upper().strip()
    arr = arr.upper().strip()
    d = df.get("departure", pd.Series(dtype=str)).fillna("").astype(str).str.upper()
    a = df.get("arrival", pd.Series(dtype=str)).fillna("").astype(str).str.upper()
    return df[(d.eq(dep) & a.eq(arr)) | (d.eq(arr) & a.eq(dep))].copy()


def _clear_map_selection() -> None:
    st.session_state.pop("map_airport", None)
    st.session_state.pop("map_route", None)
    st.session_state.pop("_last_map_action", None)
    try:
        for key in ("map_airport", "map_route"):
            if key in st.query_params:
                del st.query_params[key]
    except Exception:
        pass


def render_map_selection_panel(selection_df: pd.DataFrame, title: str, rates: pd.DataFrame, dark_mode: bool) -> None:
    if selection_df.empty:
        st.markdown(f'<div class="map-selection-panel"><div class="map-selection-title">{title}</div></div>', unsafe_allow_html=True)
        return
    work = selection_df.sort_values(["date_dt", "off_block", "id"], ascending=[False, False, False], na_position="last").reset_index(drop=True)
    total_minutes = int(work.get("block_minutes", pd.Series(dtype=float)).fillna(0).sum()) if "block_minutes" in work else 0
    tracks = int(work.get("track_count", pd.Series(dtype=float)).fillna(0).sum()) if "track_count" in work else 0
    gps = float(work.get("gps_km", pd.Series(dtype=float)).fillna(0).sum()) if "gps_km" in work else 0.0
    st.markdown(
        f"""<div class="map-selection-panel">
            <div class="map-selection-title">{title}</div>
            <div class="map-selection-meta">
                <span>{len(work)} letů</span><span>{fmt_minutes(total_minutes)}</span><span>{tracks} tracků</span><span>{gps:.0f} km GPS</span>
            </div>
        </div>""",
        unsafe_allow_html=True,
    )
    top = st.columns([.62,.58,.55,.86,1.1,1.05,.86,.72,.75], gap="small")
    headers = ["Detail", "Track", "ID", "Datum", "Letadlo", "Trasa", "Časy", "Block", "Role"]
    for c, h in zip(top, headers):
        c.markdown(f'<div class="map-mini-head">{h}</div>', unsafe_allow_html=True)
    limit = min(24, len(work))
    for _, row in work.head(limit).iterrows():
        flight_id = int(row.get("id"))
        cols = st.columns([.62,.58,.55,.86,1.1,1.05,.86,.72,.75], gap="small", vertical_alignment="top")
        with cols[0]:
            if st.button("Detail", key=f"map_selection_detail_{flight_id}", use_container_width=True):
                st.session_state[f"detail_section_{flight_id}"] = "Přehled"
                st.session_state["open_flight_dialog_id"] = flight_id
                st.session_state["selected_flight_id"] = flight_id
                st.session_state.pop("dismissed_flight_id", None)
                st.rerun()
        with cols[1]:
            track_count = int(_safe_float(row.get("track_count"), 0))
            if st.button("Track", key=f"map_selection_track_{flight_id}", disabled=track_count <= 0, use_container_width=True):
                st.session_state[f"detail_section_{flight_id}"] = "Track"
                st.session_state["open_flight_dialog_id"] = flight_id
                st.session_state["selected_flight_id"] = flight_id
                st.session_state.pop("dismissed_flight_id", None)
                st.rerun()
        cols[2].markdown(f'<div class="map-mini-cell">{flight_id}</div>', unsafe_allow_html=True)
        cols[3].markdown(f'<div class="map-mini-cell">{_safe_text(row.get("date"))}</div>', unsafe_allow_html=True)
        cols[4].markdown(f'<div class="map-mini-cell">{_safe_text(row.get("registration"))}<div class="map-mini-sub">{_safe_text(row.get("aircraft_type"))}</div></div>', unsafe_allow_html=True)
        cols[5].markdown(f'<div class="map-mini-cell">{_range_text(row.get("departure"), row.get("arrival"))}<div class="map-mini-sub">{_safe_text(row.get("evidence"))}</div></div>', unsafe_allow_html=True)
        cols[6].markdown(f'<div class="map-mini-cell">{_range_text(row.get("off_block"), row.get("on_block"))}</div>', unsafe_allow_html=True)
        cols[7].markdown(f'<div class="map-mini-cell">{_safe_text(row.get("block_time"))}</div>', unsafe_allow_html=True)
        cols[8].markdown(f'<div class="map-mini-cell">{_safe_text(row.get("role"))}</div>', unsafe_allow_html=True)
    if len(work) > limit:
        render_lazy_table(
            "Všechny vybrané lety",
            work[["id","date","registration","departure","arrival","role","evidence","block_time","track_count","gps_km"]]
            .rename(columns={"id":"ID","date":"Datum","registration":"Imatrikulace","departure":"Odlet","arrival":"Přílet","role":"Funkce","evidence":"Evidence","block_time":"Block","track_count":"Tracky","gps_km":"GPS km"}),
            height=360,
        )
    open_id = st.session_state.get("open_flight_dialog_id")
    if open_id is not None and int(open_id) in set(work["id"].astype(int).tolist()):
        dialog_row = work[work["id"].astype(int).eq(int(open_id))].iloc[0]
        flight_detail_dialog(int(open_id), dialog_row.to_dict(), rates, dark_mode)


def render_map_selection(filtered: pd.DataFrame, rates: pd.DataFrame, dark_mode: bool) -> None:
    airport = normalize_text(st.session_state.get("map_airport"))
    route = _parse_route_selection(st.session_state.get("map_route"))
    if not airport and not route:
        return
    if airport:
        ident = airport.upper()
        selected = _airport_selection(filtered, ident)
        render_map_selection_panel(selected, f"Letiště {ident}", rates, dark_mode)
    elif route:
        dep, arr = route
        selected = _route_selection(filtered, dep, arr)
        render_map_selection_panel(selected, f"Trasa {dep}–{arr}", rates, dark_mode)

def page_maps(flights: pd.DataFrame, dark_mode: bool):
    st.markdown("## Mapa letů")
    filtered = apply_filters(flights, "map")
    st.markdown('<div class="map-mode-row">', unsafe_allow_html=True)
    map_mode = st.radio(
        "Typ mapy",
        ["Orientační mapa letišť", "GPS tracky"],
        horizontal=True,
        label_visibility="collapsed",
        key="map_mode_v039",
    )
    st.markdown('</div>', unsafe_allow_html=True)

    base_track_count = int(filtered.get("track_count", pd.Series(dtype=float)).fillna(0).sum()) if not filtered.empty else 0
    base_gps_km = float(filtered.get("gps_km", pd.Series(dtype=float)).fillna(0).sum()) if not filtered.empty else 0.0
    known_routes: int | None = None
    if map_mode == "Orientační mapa letišť":
        _, _, known_routes = map_navigation_options(filtered)
        render_map_navigation_controls(filtered)
        if st.session_state.get("map_airport") or st.session_state.get("map_route"):
            _, clear_col = st.columns([1, .16])
            with clear_col:
                if st.button("Zrušit", key="map_selection_clear", use_container_width=True):
                    _clear_map_selection()
                    st.rerun()

    c1, c2, c3, c4 = st.columns(4)
    with c1: metric_card("Letů ve filtru", str(len(filtered)), "")
    with c2: metric_card("Tracky", str(base_track_count), "")
    with c3: metric_card("GPS vzdálenost", f"{base_gps_km:.1f} km", "")
    with c4: metric_card("Direct trasy", str(known_routes) if known_routes is not None else "—", "")

    if map_mode == "GPS tracky":
        flight_ids = _flight_id_tuple(filtered)
        tracks_meta = read_track_metadata_for_flights(flight_ids, current_user_id())
        if tracks_meta.empty:
            st.info("Pro aktuální filtr není dostupný žádný KML track.")
        else:
            col_mode, col_count = st.columns([1, 2])
            with col_mode:
                gps_map_mode = st.selectbox(
                    "Rozsah mapy",
                    ["Rychlá", "Střední", "Vše"],
                    index=0,
                    key="gps_track_map_scope_v046",
                )
            tracks_for_map = read_track_map_records_for_flights(flight_ids, gps_map_mode, current_user_id())
            with col_count:
                metric_card("Vykresleno", f"{len(tracks_for_map)} / {len(tracks_meta)}", "GPS tracků")
            records_json = _df_to_records_json(
                tracks_for_map,
                ["flight_id", "id", "date", "registration", "departure", "arrival", "role", "evidence", "file_name", "point_count", "distance_km", "coordinates_json"],
            )
            render_map_html(cached_track_map_html(records_json, bool(dark_mode)), height=680)
            render_lazy_table(
                "Tabulka GPS tracků",
                tracks_meta[["date","registration","departure","arrival","role","evidence","file_name","point_count","distance_km"]].rename(columns={"date":"Datum","registration":"Imatrikulace","departure":"Odlet","arrival":"Přílet","role":"Funkce","evidence":"Evidence","file_name":"Soubor","point_count":"Body","distance_km":"Km"}),
                height=320,
            )
    else:
        if filtered.empty or not known_routes:
            st.info("Pro aktuální filtr nejsou známé souřadnice odletového i příletového letiště.")
        else:
            # The orientation map remains interactive, but rates are loaded only
            # after a route/airport selection actually needs the detail panel.
            map_event = render_folium_navigable(make_route_overview_map(filtered, bool(dark_mode)), height=680, key="route_overview_nav_map_v044")
            handle_route_map_interaction(map_event)
            if st.session_state.get("map_airport") or st.session_state.get("map_route"):
                render_map_selection(filtered, read_rates(current_user_id()), dark_mode)


def _bool_to_int(value: Any, default: int = 1) -> int:
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return default
    if isinstance(value, str):
        text = value.strip().lower()
        if text in {"1", "true", "ano", "yes", "aktivní", "active"}:
            return 1
        if text in {"0", "false", "ne", "no", "neaktivní", "inactive"}:
            return 0
    return 1 if bool(value) else 0


def _clean_role(value: Any) -> str:
    text = normalize_text(value) or "PIC"
    text = text.upper()
    return text if text in ROLE_OPTIONS else "PIC"


@st.cache_data(show_spinner=False, ttl=300)
def read_aircraft_usage_summary(user_id: int) -> pd.DataFrame:
    uid = strict_user_id(user_id)
    try:
        with connect() as con:
            return pd.read_sql_query(
                """
                SELECT UPPER(TRIM(registration)) AS registration,
                       COUNT(*) AS flight_count,
                       MAX(date) AS last_flight,
                       COALESCE(SUM(starts), 0) AS starts
                FROM flights
                WHERE user_id = ? AND registration IS NOT NULL AND TRIM(registration) <> ''
                GROUP BY UPPER(TRIM(registration))
                """,
                con,
                params=(uid,),
            )
    except sqlite3.DatabaseError:
        return pd.DataFrame(columns=["registration", "flight_count", "last_flight", "starts"])


def _aircraft_rates_for_registration(rates: pd.DataFrame, registration: str) -> pd.DataFrame:
    if rates.empty or not registration:
        return pd.DataFrame(columns=list(rates.columns) if not rates.empty else ["id", "registration", "aircraft_type", "valid_from", "price_per_hour", "source"])
    reg = str(registration or "").strip().upper()
    sub = rates[rates["registration"].fillna("").astype(str).str.upper().str.strip().eq(reg)].copy()
    if sub.empty:
        return sub
    sub["valid_from_dt"] = pd.to_datetime(sub.get("valid_from"), errors="coerce")
    sort_cols = ["valid_from_dt"] + (["id"] if "id" in sub.columns else [])
    return sub.sort_values(sort_cols, na_position="first")


def _aircraft_rate_history_display(rates: pd.DataFrame, registration: str) -> pd.DataFrame:
    sub = _aircraft_rates_for_registration(rates, registration)
    if sub.empty:
        return pd.DataFrame(columns=["Platí od", "Platí do", "Cena / h", "Zdroj"])
    rows: list[dict[str, Any]] = []
    dated = sub[sub["valid_from_dt"].notna()].copy().sort_values("valid_from_dt")
    today = date.today()
    for i, (_, row) in enumerate(dated.iterrows()):
        start = row["valid_from_dt"].date()
        end = None
        if i + 1 < len(dated):
            end = (dated.iloc[i + 1]["valid_from_dt"] - pd.Timedelta(days=1)).date()
        end_label = end.strftime("%d.%m.%Y") if end else ("plánováno" if start > today else "současnost")
        rows.append({
            "Platí od": start.strftime("%d.%m.%Y"),
            "Platí do": end_label,
            "Cena / h": float(row.get("price_per_hour") or 0),
            "Zdroj": {"aircraft_profile": "Profil letadla", "aircraft_history": "Historie", "aircraft_default": "Původní profil"}.get(normalize_text(row.get("source")), normalize_text(row.get("source")) or "—"),
        })
    undated = sub[sub["valid_from_dt"].isna()]
    for _, row in undated.iterrows():
        rows.insert(0, {
            "Platí od": "legacy",
            "Platí do": "—",
            "Cena / h": float(row.get("price_per_hour") or 0),
            "Zdroj": {"aircraft_profile": "Profil letadla", "aircraft_history": "Historie", "aircraft_default": "Původní profil"}.get(normalize_text(row.get("source")), normalize_text(row.get("source")) or "—"),
        })
    return pd.DataFrame(rows)


def _refresh_aircraft_current_price_in_connection(con: sqlite3.Connection, user_id: int, registration: str) -> None:
    row = con.execute(
        """
        SELECT price_per_hour
        FROM rates
        WHERE user_id = ? AND UPPER(TRIM(registration)) = ?
          AND valid_from IS NOT NULL AND TRIM(valid_from) <> ''
          AND date(valid_from) <= date('now')
        ORDER BY date(valid_from) DESC, id DESC
        LIMIT 1
        """,
        (strict_user_id(user_id), str(registration or "").strip().upper()),
    ).fetchone()
    if row is not None:
        con.execute(
            "UPDATE aircraft SET default_price_per_hour = ?, updated_at = ? WHERE user_id = ? AND UPPER(TRIM(registration)) = ?",
            (float(row[0] or 0), _now_iso(), strict_user_id(user_id), str(registration or "").strip().upper()),
        )


def _upsert_aircraft_rate_in_connection(
    con: sqlite3.Connection,
    *,
    user_id: int,
    registration: str,
    aircraft_type: str,
    valid_from: Any,
    price_per_hour: float,
    source: str = "aircraft_profile",
) -> None:
    uid = strict_user_id(user_id)
    reg = str(registration or "").strip().upper()
    if not reg:
        raise ValueError("Imatrikulace je povinná.")
    try:
        effective = pd.Timestamp(valid_from).date().isoformat()
    except Exception as exc:
        raise ValueError("Datum platnosti ceny není platné.") from exc
    price = float(price_per_hour or 0)
    if price < 0:
        raise ValueError("Cena nemůže být záporná.")
    con.execute(
        """
        INSERT INTO rates (user_id, registration, aircraft_type, valid_from, price_per_hour, dry_price_per_hour, source)
        VALUES (?, ?, ?, ?, ?, 0, ?)
        ON CONFLICT(user_id, registration, valid_from) DO UPDATE SET
            aircraft_type = excluded.aircraft_type,
            price_per_hour = excluded.price_per_hour,
            source = excluded.source
        """,
        (uid, reg, normalize_text(aircraft_type), effective, price, source),
    )
    _refresh_aircraft_current_price_in_connection(con, uid, reg)


def save_aircraft_rate(registration: str, aircraft_type: str, valid_from: Any, price_per_hour: float, *, source: str = "aircraft_profile") -> None:
    uid = current_user_id()
    reg = str(registration or "").strip().upper()
    with connect() as con:
        _upsert_aircraft_rate_in_connection(
            con,
            user_id=uid,
            registration=reg,
            aircraft_type=aircraft_type,
            valid_from=valid_from,
            price_per_hour=price_per_hour,
            source=source,
        )
        record_audit(con, "save_aircraft_rate", "rates", reg, {"valid_from": str(valid_from), "price_per_hour": float(price_per_hour or 0)})
        con.commit()
    invalidate_cached_data("rates")
    invalidate_cached_data("aircraft")
    auto_backup_after_change("save_aircraft_rate")


def upsert_aircraft_profile(data: dict[str, Any]) -> None:
    reg = normalize_text(data.get("registration"))
    if not reg:
        raise ValueError("Imatrikulace je povinná.")
    reg = reg.upper()
    now = _now_iso()
    uid = current_user_id()
    cached_price = float(data.get("default_price_per_hour") or 0)
    with connect() as con:
        con.execute(
            """
            INSERT INTO aircraft (user_id, registration, aircraft_type, icao_type, aircraft_class, evidence, default_price_per_hour, default_role, billing_basis, active, note, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(user_id, registration) DO UPDATE SET
                aircraft_type=excluded.aircraft_type,
                icao_type=excluded.icao_type,
                aircraft_class=excluded.aircraft_class,
                evidence=excluded.evidence,
                default_price_per_hour=excluded.default_price_per_hour,
                default_role=excluded.default_role,
                billing_basis=excluded.billing_basis,
                active=excluded.active,
                note=excluded.note,
                updated_at=excluded.updated_at
            """,
            (
                uid, reg, normalize_text(data.get("aircraft_type")), normalize_text(data.get("icao_type")),
                normalize_text(data.get("aircraft_class")), normalize_text(data.get("evidence")), cached_price,
                _clean_role(data.get("default_role")), _normalize_billing_basis(data.get("billing_basis")),
                _bool_to_int(data.get("active"), 1), normalize_text(data.get("note")), now, now,
            ),
        )
        if data.get("rate_price") is not None:
            _upsert_aircraft_rate_in_connection(
                con, user_id=uid, registration=reg, aircraft_type=normalize_text(data.get("aircraft_type")),
                valid_from=data.get("rate_valid_from") or date.today(), price_per_hour=float(data.get("rate_price") or 0),
                source="aircraft_profile",
            )
        record_audit(con, "upsert_aircraft", "aircraft", reg, {k: v for k, v in data.items() if k != "rate_price"})
        con.commit()
    invalidate_cached_data("aircraft")
    if data.get("rate_price") is not None:
        invalidate_cached_data("rates")
    auto_backup_after_change("upsert_aircraft")

def upsert_airport_form(data: dict[str, Any]) -> None:
    ident = _clean_ident(data.get("ident"))
    if not ident:
        raise ValueError("Ident letiště je povinný.")
    lat = _to_float(data.get("latitude_deg"))
    lon = _to_float(data.get("longitude_deg"))
    if lat is None or lon is None:
        raise ValueError("Latitude a longitude jsou povinné.")
    now = _now_iso()
    uid = current_user_id()
    with connect() as con:
        con.execute(
            """
            INSERT INTO airports (user_id, ident, name, airport_type, iso_country, iso_region, municipality, latitude_deg, longitude_deg, elevation_ft, gps_code, iata_code, local_code, source, active, closed, data_quality, imported_at, updated_at, raw_json)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(user_id, ident) DO UPDATE SET
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
                uid,
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
    invalidate_cached_data("airports")
    auto_backup_after_change("upsert_airport")


def page_database():
    st.markdown("## Databáze")

    # Header metrics intentionally use COUNT queries.  Older versions loaded the
    # entire 85k-row airport catalogue, aircraft table, metadata and audit log
    # before the user had even chosen a database section.
    airport_count_total = read_airport_registry_count(current_user_id())
    counts = read_logbook_counts(current_user_id())
    aircraft_count_total = counts["aircraft"]
    track_count_total = counts["tracks"]
    point_count_total = counts["points"]

    c1, c2, c3, c4 = st.columns(4)
    with c1: metric_card("Letiště / plochy", str(airport_count_total), "databázová tabulka")
    with c2: metric_card("Letadla", str(aircraft_count_total), "registrace")
    with c3: metric_card("Tracky", str(track_count_total), "KML soubory")
    with c4: metric_card("GPS body", f"{point_count_total:,}".replace(",", " "), "normalizováno")

    section = st.radio(
        "Databáze sekce",
        ["Letadla", "Letiště"],
        horizontal=True,
        label_visibility="collapsed",
        key="database_section_v058",
    )

    if section == "Letiště":
        airports = read_airports(active_only=False, user_id=current_user_id())
        col1, col2, col3 = st.columns([1, 1, 2])
        with col1:
            country = st.selectbox("Země", ["Vše"] + sorted([x for x in airports.get("iso_country", pd.Series(dtype=str)).dropna().unique() if x]), index=0)
        with col2:
            source = st.selectbox("Zdroj", ["Vše"] + sorted([x for x in airports.get("source", pd.Series(dtype=str)).dropna().unique() if x]), index=0)
        with col3:
            q = st.text_input("Hledat", value="")
        view = airports
        if country != "Vše":
            view = view[view["iso_country"].eq(country)]
        if source != "Vše":
            view = view[view["source"].eq(source)]
        if q.strip():
            ql = q.strip().lower()
            mask = (
                view["ident"].fillna("").str.lower().str.contains(ql, regex=False)
                | view["name"].fillna("").str.lower().str.contains(ql, regex=False)
                | view["municipality"].fillna("").str.lower().str.contains(ql, regex=False)
            )
            view = view[mask]
        cols = ["ident", "name", "airport_type", "iso_country", "municipality", "latitude_deg", "longitude_deg", "source", "data_quality", "active", "closed"]
        st.dataframe(view[[c for c in cols if c in view.columns]].head(1000), hide_index=True, use_container_width=True, height=430)

        prepare_airport_export = st.button("Připravit export letišť CSV", key="prepare_airport_csv_v052", use_container_width=True)
        if prepare_airport_export or st.session_state.get("airport_csv_ready_v052"):
            st.session_state["airport_csv_ready_v052"] = True
            st.download_button(
                "Stáhnout letiště CSV",
                data=airports.to_csv(index=False).encode("utf-8"),
                file_name="airports_export.csv",
                mime="text/csv",
                use_container_width=True,
            )

        st.markdown("### Přidat / upravit letiště")
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
                st.success("Letiště uloženo.")
                st.rerun()
            except Exception as exc:
                st.error(str(exc))
    elif section == "Letadla":
        uid = current_user_id()
        aircraft = read_table("aircraft", uid)
        rates = read_rates(uid)
        usage = read_aircraft_usage_summary(uid)
        if aircraft.empty:
            aircraft = pd.DataFrame(columns=["id", "registration", "aircraft_type", "icao_type", "aircraft_class", "evidence", "default_price_per_hour", "default_role", "billing_basis", "active", "note"])
        aircraft_view = aircraft.copy()
        for col, default in [("default_role", "PIC"), ("billing_basis", "BLOCK"), ("active", 1)]:
            if col not in aircraft_view.columns:
                aircraft_view[col] = default
        aircraft_view["registration"] = aircraft_view.get("registration", pd.Series(dtype=str)).fillna("").astype(str).str.upper().str.strip()
        aircraft_view["active"] = pd.to_numeric(aircraft_view.get("active", 1), errors="coerce").fillna(1).astype(int)

        usage_map: dict[str, dict[str, Any]] = {}
        if not usage.empty:
            for _, urow in usage.iterrows():
                usage_map[str(urow.get("registration") or "").upper()] = urow.to_dict()

        active_count = int(aircraft_view["active"].eq(1).sum()) if not aircraft_view.empty else 0
        inactive_count = int(aircraft_view["active"].eq(0).sum()) if not aircraft_view.empty else 0
        priced_count = 0
        current_prices: list[float] = []
        for _, arow in aircraft_view.iterrows():
            reg0 = str(arow.get("registration") or "").upper()
            price0 = _aircraft_price(arow.to_dict(), rates, reg0)
            if price0 > 0:
                priced_count += 1
                current_prices.append(price0)

        st.markdown("### Moje letadla")
        st.caption("Profil letadla je jediné místo pro jeho údaje, výchozí nastavení a cenovou historii.")
        m1, m2, m3, m4 = st.columns(4)
        with m1: metric_card("Aktivní", str(active_count), "letadla")
        with m2: metric_card("Archiv", str(inactive_count), "neaktivní")
        with m3: metric_card("S cenou", str(priced_count), "aktuální sazba")
        with m4: metric_card(f"Průměr {currency_symbol()}/h", f"{sum(current_prices) / len(current_prices):.0f}" if current_prices else "—", "aktuální ceny")

        selected_reg = str(st.session_state.get("aircraft_profile_selected_v058") or "").upper().strip()
        new_mode = bool(st.session_state.get("aircraft_profile_new_v058", False))

        if new_mode:
            top_left, top_right = st.columns([4, 1])
            with top_left:
                st.markdown("### Přidat letadlo")
                st.caption("Základní údaje a první cenu uložíme společně do profilu letadla.")
            with top_right:
                if st.button("← Zpět", use_container_width=True, key="aircraft_new_back_v058"):
                    st.session_state["aircraft_profile_new_v058"] = False
                    st.rerun()

            with st.container(border=True):
                with st.form("aircraft_new_profile_form_v058"):
                    st.markdown("#### Základní údaje")
                    c1, c2, c3 = st.columns(3)
                    with c1:
                        reg = st.text_input("Imatrikulace", value="", placeholder="OK-DAS").upper().strip()
                        typ = st.text_input("Typ", value="", placeholder="Bristell B23")
                    with c2:
                        icao_type = st.text_input("ICAO typ", value="", placeholder="BR23")
                        evidence = st.selectbox("Evidence", EVIDENCE_OPTIONS, index=0)
                    with c3:
                        aircraft_class = st.selectbox("Třída", CLASS_OPTIONS, index=CLASS_OPTIONS.index("ULL") if "ULL" in CLASS_OPTIONS else 0)
                        default_role = st.selectbox("Výchozí role", ROLE_OPTIONS, index=0)

                    st.markdown("#### Provoz a cena")
                    p1, p2, p3 = st.columns(3)
                    with p1:
                        initial_price = st.number_input(f"Cena za hodinu ({currency_symbol()})", min_value=0.0, step=50.0, value=0.0, format="%.0f")
                    with p2:
                        price_valid_from = st.date_input("Cena platí od", value=date.today())
                    with p3:
                        billing_basis = st.selectbox("Účtovat podle", BILLING_BASIS_OPTIONS, index=0, format_func=_billing_basis_label)
                    note = st.text_area("Poznámka", value="", height=80)
                    active = st.checkbox("Aktivní letadlo", value=True)
                    st.caption("Cena se ukládá jako historický záznam s datem účinnosti. Další změny ceny nikdy nepřepisují starší období.")
                    submitted_aircraft = st.form_submit_button("Přidat letadlo", type="primary", use_container_width=True)
                if submitted_aircraft:
                    try:
                        if not reg:
                            raise ValueError("Imatrikulace je povinná.")
                        if not icao_type.strip():
                            icao_type = typ
                        upsert_aircraft_profile({
                            "registration": reg,
                            "aircraft_type": typ,
                            "icao_type": icao_type,
                            "aircraft_class": aircraft_class,
                            "evidence": evidence,
                            "default_price_per_hour": initial_price,
                            "default_role": default_role,
                            "billing_basis": billing_basis,
                            "active": active,
                            "note": note,
                            "rate_price": initial_price if initial_price > 0 else None,
                            "rate_valid_from": price_valid_from,
                        })
                        st.session_state["aircraft_profile_new_v058"] = False
                        st.session_state["aircraft_profile_selected_v058"] = reg
                        st.success("Letadlo bylo přidáno.")
                        st.rerun()
                    except Exception as exc:
                        st.error(str(exc))

        elif selected_reg:
            selected_rows = aircraft_view[aircraft_view["registration"].eq(selected_reg)]
            if selected_rows.empty:
                st.session_state.pop("aircraft_profile_selected_v058", None)
                st.rerun()
            picked_row = selected_rows.iloc[0].to_dict()
            current_rate = lookup_latest_rate(rates, selected_reg, date.today())
            current_price = _aircraft_price(picked_row, rates, selected_reg)
            usage_row = usage_map.get(selected_reg, {})
            flight_count = int(usage_row.get("flight_count") or 0)
            last_flight = normalize_text(usage_row.get("last_flight")) or "—"
            active_now = bool(_bool_to_int(picked_row.get("active"), 1))

            h1, h2 = st.columns([5, 1])
            with h1:
                st.markdown(f"### {selected_reg} · {normalize_text(picked_row.get('aircraft_type')) or 'Bez typu'}")
                st.caption("Aktivní profil" if active_now else "Neaktivní / archivovaný profil")
            with h2:
                if st.button("← Letadla", use_container_width=True, key=f"aircraft_back_{selected_reg}"):
                    st.session_state.pop("aircraft_profile_selected_v058", None)
                    st.rerun()

            q1, q2, q3, q4 = st.columns(4)
            with q1: metric_card("Aktuální cena", f"{current_price:.0f} {currency_symbol()}/h" if current_price > 0 else "—", f"od {current_rate.get('valid_from') or 'legacy'}")
            with q2: metric_card("Účtování", _billing_basis_label(picked_row.get("billing_basis")), "výchozí")
            with q3: metric_card("Třída", normalize_text(picked_row.get("aircraft_class")) or "—", normalize_text(picked_row.get("evidence")) or "evidence")
            with q4: metric_card("Lety", str(flight_count), f"poslední {last_flight}")

            tab_profile, tab_price = st.tabs(["Profil letadla", "Cena a historie"])
            with tab_profile:
                with st.container(border=True):
                    st.markdown("#### Údaje letadla")
                    with st.form(f"aircraft_profile_edit_v058_{selected_reg}"):
                        c1, c2, c3 = st.columns(3)
                        with c1:
                            st.text_input("Imatrikulace", value=selected_reg, disabled=True)
                            typ = st.text_input("Typ", value=str(picked_row.get("aircraft_type") or ""))
                            icao_type = st.text_input("ICAO typ", value=str(picked_row.get("icao_type") or picked_row.get("aircraft_type") or ""))
                        with c2:
                            ev_def = normalize_text(picked_row.get("evidence")) or evidence_from_registration(selected_reg)
                            evidence = st.selectbox("Evidence", EVIDENCE_OPTIONS, index=EVIDENCE_OPTIONS.index(ev_def) if ev_def in EVIDENCE_OPTIONS else 0)
                            class_def = normalize_text(picked_row.get("aircraft_class")) or default_class_for(evidence)
                            aircraft_class = st.selectbox("Třída", CLASS_OPTIONS, index=CLASS_OPTIONS.index(class_def) if class_def in CLASS_OPTIONS else 0)
                            role_def = _clean_role(picked_row.get("default_role"))
                            default_role = st.selectbox("Výchozí role", ROLE_OPTIONS, index=ROLE_OPTIONS.index(role_def) if role_def in ROLE_OPTIONS else 0)
                        with c3:
                            basis_def = _normalize_billing_basis(picked_row.get("billing_basis"))
                            billing_basis = st.selectbox("Účtovat podle", BILLING_BASIS_OPTIONS, index=BILLING_BASIS_OPTIONS.index(basis_def) if basis_def in BILLING_BASIS_OPTIONS else 0, format_func=_billing_basis_label)
                            active = st.checkbox("Aktivní", value=active_now)
                        note = st.text_area("Poznámka", value=str(picked_row.get("note") or ""), height=90)
                        save_profile = st.form_submit_button("Uložit profil letadla", type="primary", use_container_width=True)
                    if save_profile:
                        try:
                            upsert_aircraft_profile({
                                "registration": selected_reg,
                                "aircraft_type": typ,
                                "icao_type": icao_type,
                                "aircraft_class": aircraft_class,
                                "evidence": evidence,
                                "default_price_per_hour": current_price,
                                "default_role": default_role,
                                "billing_basis": billing_basis,
                                "active": active,
                                "note": note,
                            })
                            st.success("Profil letadla uložen.")
                            st.rerun()
                        except Exception as exc:
                            st.error(str(exc))

            with tab_price:
                with st.container(border=True):
                    st.markdown("#### Změnit cenu")
                    st.caption("Nová sazba se uloží od zvoleného data. Starší lety a starší cenová období se nepřepisují.")
                    with st.form(f"aircraft_rate_change_v058_{selected_reg}"):
                        p1, p2 = st.columns(2)
                        with p1:
                            new_price = st.number_input("Cena za hodinu", min_value=0.0, step=50.0, value=float(current_price or 0), format="%.0f", key=f"aircraft_rate_price_{selected_reg}")
                        with p2:
                            effective_from = st.date_input("Platí od", value=date.today(), key=f"aircraft_rate_date_{selected_reg}")
                        st.caption("Po uložení se vytvoří nový bod v cenové historii. Pokud stejné datum už existuje, upraví se jen tento záznam.")
                        save_rate = st.form_submit_button("Uložit změnu ceny", type="primary", use_container_width=True)
                    if save_rate:
                        try:
                            save_aircraft_rate(selected_reg, normalize_text(picked_row.get("aircraft_type")), effective_from, new_price)
                            st.success(f"Cena {new_price:.0f} {currency_symbol()}/h je uložená od {effective_from.strftime('%d.%m.%Y')}.")
                            st.rerun()
                        except Exception as exc:
                            st.error(str(exc))

                with st.expander("Historie cen", expanded=False):
                    history = _aircraft_rate_history_display(rates, selected_reg)
                    if history.empty:
                        st.info("Pro toto letadlo zatím není uložená cenová historie. Aktuální hodnota může pocházet ze staršího profilu letadla.")
                    else:
                        st.dataframe(
                            history,
                            hide_index=True,
                            use_container_width=True,
                            column_config={"Cena / h": st.column_config.NumberColumn(format=f"%.0f {currency_symbol()}")},
                        )
                    st.markdown("##### Doplnit nebo opravit historickou cenu")
                    st.caption("Tady můžete například nastavit sazbu od 1. 1. konkrétního roku. Stejné datum se při uložení pouze aktualizuje.")
                    with st.form(f"aircraft_rate_history_edit_v058_{selected_reg}"):
                        h1c, h2c = st.columns(2)
                        with h1c:
                            historical_date = st.date_input("Platnost od", value=date(date.today().year, 1, 1), key=f"aircraft_hist_date_{selected_reg}")
                        with h2c:
                            historical_price = st.number_input(f"Cena {currency_symbol()}/h", min_value=0.0, step=50.0, value=float(current_price or 0), format="%.0f", key=f"aircraft_hist_price_{selected_reg}")
                        save_history = st.form_submit_button("Uložit historickou sazbu", use_container_width=True)
                    if save_history:
                        try:
                            save_aircraft_rate(selected_reg, normalize_text(picked_row.get("aircraft_type")), historical_date, historical_price, source="aircraft_history")
                            st.success("Historická sazba byla uložena.")
                            st.rerun()
                        except Exception as exc:
                            st.error(str(exc))

        else:
            toolbar_left, toolbar_mid, toolbar_right = st.columns([3, 1.3, 1.2])
            with toolbar_left:
                q_aircraft = st.text_input("Hledat letadlo", value="", placeholder="Imatrikulace, typ nebo poznámka", key="aircraft_search_v058")
            with toolbar_mid:
                show_inactive = st.checkbox("Zobrazit archiv", value=False, key="aircraft_show_inactive_v058")
            with toolbar_right:
                st.write("")
                if st.button("＋ Přidat letadlo", type="primary", use_container_width=True, key="aircraft_add_v058"):
                    st.session_state["aircraft_profile_new_v058"] = True
                    st.session_state.pop("aircraft_profile_selected_v058", None)
                    st.rerun()

            table_aircraft = aircraft_view.copy()
            if not show_inactive and not table_aircraft.empty:
                table_aircraft = table_aircraft[table_aircraft["active"].eq(1)]
            if q_aircraft.strip() and not table_aircraft.empty:
                ql = q_aircraft.strip().lower()
                type_series = table_aircraft["aircraft_type"] if "aircraft_type" in table_aircraft.columns else pd.Series(index=table_aircraft.index, dtype=str)
                note_series = table_aircraft["note"] if "note" in table_aircraft.columns else pd.Series(index=table_aircraft.index, dtype=str)
                table_aircraft = table_aircraft[
                    table_aircraft["registration"].fillna("").str.lower().str.contains(ql, regex=False)
                    | type_series.fillna("").astype(str).str.lower().str.contains(ql, regex=False)
                    | note_series.fillna("").astype(str).str.lower().str.contains(ql, regex=False)
                ]

            if table_aircraft.empty:
                st.info("Žádné letadlo neodpovídá filtru. Přidejte první letadlo nebo zobrazte archiv.")
            else:
                rows = list(table_aircraft.sort_values(["active", "registration"], ascending=[False, True]).iterrows())
                for pos in range(0, len(rows), 2):
                    card_cols = st.columns(2)
                    for offset, (_, arow) in enumerate(rows[pos:pos + 2]):
                        reg0 = str(arow.get("registration") or "").upper()
                        typ0 = normalize_text(arow.get("aircraft_type")) or "Typ neuveden"
                        price0 = _aircraft_price(arow.to_dict(), rates, reg0)
                        usage0 = usage_map.get(reg0, {})
                        count0 = int(usage0.get("flight_count") or 0)
                        last0 = normalize_text(usage0.get("last_flight")) or "—"
                        active0 = bool(_bool_to_int(arow.get("active"), 1))
                        key_hash = hashlib.sha1(reg0.encode("utf-8")).hexdigest()[:10]
                        with card_cols[offset]:
                            with st.container(border=True):
                                left, right = st.columns([3, 1])
                                with left:
                                    st.markdown(f"#### {reg0}")
                                    st.caption(typ0)
                                with right:
                                    st.caption("Aktivní" if active0 else "Archiv")
                                d1, d2 = st.columns(2)
                                with d1:
                                    st.markdown(f"**{price0:.0f} {currency_symbol()}/h**" if price0 > 0 else "**Cena —**")
                                    st.caption(_billing_basis_label(arow.get("billing_basis")))
                                with d2:
                                    st.markdown(f"**{count0} letů**")
                                    st.caption(f"Poslední: {last0}")
                                meta = " • ".join([x for x in [normalize_text(arow.get("evidence")), normalize_text(arow.get("aircraft_class")), normalize_text(arow.get("default_role"))] if x])
                                if meta:
                                    st.caption(meta)
                                if st.button("Otevřít profil", use_container_width=True, key=f"aircraft_open_{key_hash}"):
                                    st.session_state["aircraft_profile_selected_v058"] = reg0
                                    st.rerun()

    elif section == "Kontrola":
        render_database_control_panel()

    elif section == "Záloha":
        metas = read_table("app_meta")
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
        if github_auto_backup_enabled():
            st.success("Automatická GitHub záloha je zapnutá. Po každé potvrzené změně se databáze uloží do repozitáře.")
        elif github_backup_configured():
            st.warning("GitHub token je nastavený, ale automatická záloha je vypnutá. Zapni github.auto_backup = true v Secrets.")
        else:
            st.warning("Automatická GitHub záloha není nastavená. Změny ve Streamlit Cloud mohou po restartu zmizet.")
        if st.session_state.get("last_auto_backup_status") == "error":
            st.error(f"Poslední automatická záloha selhala: {st.session_state.get('last_auto_backup_error')}")
        if is_admin():
            with open(DB_PATH, "rb") as f:
                st.download_button("Stáhnout SQLite databázi", f.read(), file_name="logbook.sqlite", use_container_width=True)
        else:
            st.caption("Úplná SQLite databáze je dostupná pouze správci aplikace.")
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
                    st.success("Databáze obnovena.")
                    st.rerun()
                except Exception as exc:
                    st.error(f"Obnova selhala: {exc}")

    elif section == "Meta":
        metas = read_table("app_meta")
        audits = read_audit_log(500, current_user_id())
        st.markdown("### Metadata")
        if metas.empty:
            st.info("Žádná metadata.")
        else:
            st.dataframe(metas.sort_values("key"), hide_index=True, use_container_width=True)
        st.markdown("### Audit log")
        if audits.empty:
            st.info("Žádný audit log.")
        else:
            st.dataframe(audits, hide_index=True, use_container_width=True, height=360)


# -----------------------------------------------------------------------------
# Stability / database control tools
# -----------------------------------------------------------------------------

def _safe_count_query(con: sqlite3.Connection, table: str) -> int:
    try:
        row = con.execute(f"SELECT COUNT(*) AS n FROM {table}").fetchone()
        return int(row["n"] if isinstance(row, sqlite3.Row) else row[0]) if row else 0
    except sqlite3.DatabaseError:
        return 0


def _safe_df_query(con: sqlite3.Connection, query: str, params: tuple[Any, ...] = ()) -> pd.DataFrame:
    try:
        return pd.read_sql_query(query, con, params=params)
    except Exception:
        return pd.DataFrame()


def _attach_world_airports(con: sqlite3.Connection) -> bool:
    if not AIRPORTS_DB_PATH.exists():
        return False
    try:
        existing = [str(row[1]) for row in con.execute("PRAGMA database_list").fetchall()]
        if "world_airports" not in existing:
            con.execute("ATTACH DATABASE ? AS world_airports", (str(AIRPORTS_DB_PATH),))
        return True
    except sqlite3.DatabaseError:
        return False


def _health_table_preview(df: pd.DataFrame, limit: int = 200) -> pd.DataFrame:
    if df is None or df.empty:
        return pd.DataFrame()
    return df.head(limit).copy()


@st.cache_data(show_spinner=False, ttl=120)
def build_database_health_report() -> dict[str, Any]:
    """Run a non-destructive database health check.

    The check is intentionally explicit and conservative. It reports suspicious
    data but does not change anything. Repair actions are handled separately and
    require admin confirmation.
    """
    report: dict[str, Any] = {
        "generated_at": datetime.now(LOCAL_TZ).strftime("%Y-%m-%d %H:%M:%S"),
        "counts": {},
        "checks": {},
        "tables": {},
        "issue_count": 0,
    }
    with connect() as con:
        tables = ["flights", "aircraft", "rates", "flight_tracks", "track_points", "airports", "audit_log", "app_meta"]
        report["counts"] = {table: _safe_count_query(con, table) for table in tables}
        try:
            row = con.execute("PRAGMA integrity_check").fetchone()
            report["checks"]["integrity_check"] = str(row[0] if row else "unknown")
        except sqlite3.DatabaseError as exc:
            report["checks"]["integrity_check"] = f"error: {exc}"
        try:
            fk_rows = con.execute("PRAGMA foreign_key_check").fetchall()
            if fk_rows:
                report["tables"]["foreign_key_check"] = pd.DataFrame([dict(r) for r in fk_rows])
            report["checks"]["foreign_key_check"] = "OK" if not fk_rows else f"{len(fk_rows)} problémů"
        except sqlite3.DatabaseError as exc:
            report["checks"]["foreign_key_check"] = f"error: {exc}"

        duplicate_flights = _safe_df_query(con, """
            SELECT date, UPPER(TRIM(COALESCE(registration,''))) AS registration,
                   UPPER(TRIM(COALESCE(departure,''))) AS departure,
                   UPPER(TRIM(COALESCE(arrival,''))) AS arrival,
                   COALESCE(takeoff,'') AS takeoff, COALESCE(landing,'') AS landing,
                   COUNT(*) AS pocet, GROUP_CONCAT(id) AS ids
            FROM flights
            GROUP BY date, UPPER(TRIM(COALESCE(registration,''))), UPPER(TRIM(COALESCE(departure,''))),
                     UPPER(TRIM(COALESCE(arrival,''))), COALESCE(takeoff,''), COALESCE(landing,'')
            HAVING COUNT(*) > 1
            ORDER BY date DESC
            LIMIT 200
        """)
        if not duplicate_flights.empty:
            report["tables"]["duplicate_flights"] = duplicate_flights

        missing_core = _safe_df_query(con, """
            SELECT id, date, registration, aircraft_type, aircraft_class, evidence,
                   departure, arrival, off_block, takeoff, landing, on_block, role, starts, price_per_hour
            FROM flights
            WHERE TRIM(COALESCE(date,'')) = ''
               OR TRIM(COALESCE(registration,'')) = ''
               OR TRIM(COALESCE(evidence,'')) = ''
               OR TRIM(COALESCE(role,'')) = ''
               OR TRIM(COALESCE(departure,'')) = ''
               OR TRIM(COALESCE(arrival,'')) = ''
               OR starts IS NULL OR starts <= 0
            ORDER BY date DESC, id DESC
            LIMIT 250
        """)
        if not missing_core.empty:
            report["tables"]["missing_core"] = missing_core

        missing_price = _safe_df_query(con, """
            SELECT id, date, registration, aircraft_type, departure, arrival, role, price_per_hour
            FROM flights
            WHERE price_per_hour IS NULL OR price_per_hour <= 0
            ORDER BY date DESC, id DESC
            LIMIT 250
        """)
        if not missing_price.empty:
            report["tables"]["missing_price"] = missing_price

        missing_aircraft = _safe_df_query(con, """
            SELECT DISTINCT UPPER(TRIM(f.registration)) AS registration, COUNT(*) AS flights
            FROM flights f
            LEFT JOIN aircraft a ON UPPER(TRIM(a.registration)) = UPPER(TRIM(f.registration))
            WHERE TRIM(COALESCE(f.registration,'')) <> '' AND a.id IS NULL
            GROUP BY UPPER(TRIM(f.registration))
            ORDER BY flights DESC, registration
            LIMIT 250
        """)
        if not missing_aircraft.empty:
            report["tables"]["missing_aircraft"] = missing_aircraft

        world_ok = _attach_world_airports(con)
        if world_ok:
            unknown_airports_query = """
                WITH used AS (
                    SELECT id AS flight_id, 'Odlet' AS field, UPPER(TRIM(departure)) AS ident FROM flights WHERE TRIM(COALESCE(departure,'')) <> ''
                    UNION ALL
                    SELECT id AS flight_id, 'Přílet' AS field, UPPER(TRIM(arrival)) AS ident FROM flights WHERE TRIM(COALESCE(arrival,'')) <> ''
                )
                SELECT u.field, u.ident, COUNT(*) AS flights, GROUP_CONCAT(u.flight_id) AS flight_ids
                FROM used u
                LEFT JOIN airports a ON UPPER(TRIM(a.ident)) = u.ident
                LEFT JOIN world_airports.airports wa ON UPPER(TRIM(wa.ident)) = u.ident
                WHERE a.id IS NULL AND wa.id IS NULL
                GROUP BY u.field, u.ident
                ORDER BY flights DESC, u.ident
                LIMIT 250
            """
        else:
            unknown_airports_query = """
                WITH used AS (
                    SELECT id AS flight_id, 'Odlet' AS field, UPPER(TRIM(departure)) AS ident FROM flights WHERE TRIM(COALESCE(departure,'')) <> ''
                    UNION ALL
                    SELECT id AS flight_id, 'Přílet' AS field, UPPER(TRIM(arrival)) AS ident FROM flights WHERE TRIM(COALESCE(arrival,'')) <> ''
                )
                SELECT u.field, u.ident, COUNT(*) AS flights, GROUP_CONCAT(u.flight_id) AS flight_ids
                FROM used u
                LEFT JOIN airports a ON UPPER(TRIM(a.ident)) = u.ident
                WHERE a.id IS NULL
                GROUP BY u.field, u.ident
                ORDER BY flights DESC, u.ident
                LIMIT 250
            """
        unknown_airports = _safe_df_query(con, unknown_airports_query)
        if not unknown_airports.empty:
            report["tables"]["unknown_airports"] = unknown_airports

        orphan_tracks = _safe_df_query(con, """
            SELECT t.id AS track_id, t.flight_id, t.file_name, t.imported_at, t.point_count, t.distance_km
            FROM flight_tracks t
            LEFT JOIN flights f ON f.id = t.flight_id
            WHERE f.id IS NULL
            ORDER BY t.id DESC
            LIMIT 250
        """)
        if not orphan_tracks.empty:
            report["tables"]["orphan_tracks"] = orphan_tracks

        tracks_without_points = _safe_df_query(con, """
            SELECT t.id AS track_id, t.flight_id, f.date, f.registration, t.file_name, t.point_count, t.distance_km
            FROM flight_tracks t
            LEFT JOIN flights f ON f.id = t.flight_id
            LEFT JOIN track_points p ON p.track_id = t.id
            GROUP BY t.id
            HAVING COUNT(p.id) = 0
            ORDER BY t.id DESC
            LIMIT 250
        """)
        if not tracks_without_points.empty:
            report["tables"]["tracks_without_points"] = tracks_without_points

        track_point_mismatch = _safe_df_query(con, """
            SELECT t.id AS track_id, t.flight_id, f.date, f.registration, t.file_name,
                   COALESCE(t.point_count, 0) AS stored_points, COUNT(p.id) AS normalized_points
            FROM flight_tracks t
            LEFT JOIN flights f ON f.id = t.flight_id
            LEFT JOIN track_points p ON p.track_id = t.id
            GROUP BY t.id
            HAVING normalized_points > 0 AND stored_points > 0 AND ABS(stored_points - normalized_points) > 5
            ORDER BY ABS(stored_points - normalized_points) DESC
            LIMIT 250
        """)
        if not track_point_mismatch.empty:
            report["tables"]["track_point_mismatch"] = track_point_mismatch

        invalid_points = _safe_df_query(con, """
            SELECT track_id, COUNT(*) AS bad_points
            FROM track_points
            WHERE latitude_deg < -90 OR latitude_deg > 90 OR longitude_deg < -180 OR longitude_deg > 180
            GROUP BY track_id
            ORDER BY bad_points DESC
            LIMIT 250
        """)
        if not invalid_points.empty:
            report["tables"]["invalid_points"] = invalid_points

        orphan_points = _safe_df_query(con, """
            SELECT p.track_id, COUNT(*) AS points
            FROM track_points p
            LEFT JOIN flight_tracks t ON t.id = p.track_id
            WHERE t.id IS NULL
            GROUP BY p.track_id
            ORDER BY points DESC
            LIMIT 250
        """)
        if not orphan_points.empty:
            report["tables"]["orphan_points"] = orphan_points

        # Decode only track headers/JSON validity here; keep this diagnostic bounded.
        invalid_json_rows: list[dict[str, Any]] = []
        try:
            rows = con.execute("SELECT id, flight_id, file_name, coordinates_json FROM flight_tracks ORDER BY id DESC").fetchall()
            for row in rows:
                try:
                    points = json.loads(row["coordinates_json"] or "[]")
                    if not isinstance(points, list) or len(points) < 2:
                        invalid_json_rows.append({"track_id": row["id"], "flight_id": row["flight_id"], "file_name": row["file_name"], "problem": "málo bodů / špatná struktura"})
                except Exception as exc:
                    invalid_json_rows.append({"track_id": row["id"], "flight_id": row["flight_id"], "file_name": row["file_name"], "problem": str(exc)[:120]})
                if len(invalid_json_rows) >= 250:
                    break
        except sqlite3.DatabaseError:
            pass
        if invalid_json_rows:
            report["tables"]["invalid_track_json"] = pd.DataFrame(invalid_json_rows)

    # Time anomalies are easier and safer to evaluate with the existing Python duration logic.
    flights = read_flights(current_user_id())
    time_rows: list[dict[str, Any]] = []
    if not flights.empty:
        for _, r in flights.iterrows():
            block = r.get("block_minutes")
            air = r.get("air_minutes")
            problems: list[str] = []
            if block is None or pd.isna(block):
                problems.append("chybí block")
            elif float(block) <= 0:
                problems.append("block <= 0")
            elif float(block) > 720:
                problems.append("block > 12 h")
            if air is None or pd.isna(air):
                problems.append("chybí air")
            elif float(air) <= 0:
                problems.append("air <= 0")
            elif float(air) > 720:
                problems.append("air > 12 h")
            if pd.notna(block) and pd.notna(air) and float(air) > float(block):
                problems.append("air > block")
            if problems:
                time_rows.append({
                    "ID": r.get("id"),
                    "Datum": r.get("date"),
                    "Imatrikulace": r.get("registration"),
                    "Trasa": f"{r.get('departure') or ''}–{r.get('arrival') or ''}",
                    "Block": fmt_minutes(block),
                    "Air": fmt_minutes(air),
                    "Problém": ", ".join(problems),
                })
    if time_rows:
        report["tables"]["time_anomalies"] = pd.DataFrame(time_rows).head(250)

    issue_count = 0
    for key, value in report.get("tables", {}).items():
        if isinstance(value, pd.DataFrame):
            issue_count += len(value)
    if str(report.get("checks", {}).get("integrity_check", "")).upper() != "OK":
        issue_count += 1
    if str(report.get("checks", {}).get("foreign_key_check", "")).upper() != "OK":
        issue_count += 1
    report["issue_count"] = issue_count
    return report


def _render_issue_table(title: str, df: pd.DataFrame, empty_text: str = "OK") -> None:
    with st.expander(f"{title} ({0 if df is None or df.empty else len(df)})", expanded=False):
        if df is None or df.empty:
            st.success(empty_text)
        else:
            st.dataframe(_health_table_preview(df), hide_index=True, use_container_width=True, height=260)


def run_safe_database_service() -> dict[str, Any]:
    """Apply non-destructive repairs and normalization."""
    result: dict[str, Any] = {"changed": 0, "actions": []}
    with connect() as con:
        before = con.total_changes
        def step(label: str, sql: str, params: tuple[Any, ...] = ()) -> None:
            prev = con.total_changes
            con.execute(sql, params)
            changed = con.total_changes - prev
            result["actions"].append({"Akce": label, "Změny": int(changed)})

        step("Normalizace imatrikulací v letech", """
            UPDATE flights SET registration = UPPER(TRIM(registration))
            WHERE registration IS NOT NULL AND registration <> UPPER(TRIM(registration))
        """)
        step("Normalizace letišť v letech", """
            UPDATE flights SET departure = UPPER(TRIM(departure)), arrival = UPPER(TRIM(arrival))
            WHERE (departure IS NOT NULL AND departure <> UPPER(TRIM(departure)))
               OR (arrival IS NOT NULL AND arrival <> UPPER(TRIM(arrival)))
        """)
        step("Normalizace evidence/třídy/role", """
            UPDATE flights SET
                evidence = UPPER(TRIM(evidence)),
                aircraft_class = UPPER(TRIM(aircraft_class)),
                role = UPPER(TRIM(role))
            WHERE (evidence IS NOT NULL AND evidence <> UPPER(TRIM(evidence)))
               OR (aircraft_class IS NOT NULL AND aircraft_class <> UPPER(TRIM(aircraft_class)))
               OR (role IS NOT NULL AND role <> UPPER(TRIM(role)))
        """)
        step("Doplnění startů", "UPDATE flights SET starts = 1 WHERE starts IS NULL OR starts <= 0")
        step("Doplnění účtování", """
            UPDATE flights SET billing_basis = 'BLOCK'
            WHERE UPPER(TRIM(COALESCE(billing_basis,''))) NOT IN ('BLOCK','AIR')
        """)
        step("Normalizace imatrikulací v letadlech", """
            UPDATE aircraft SET registration = UPPER(TRIM(registration))
            WHERE registration IS NOT NULL AND registration <> UPPER(TRIM(registration))
        """)
        step("Normalizace imatrikulací v ceníku", """
            UPDATE rates SET registration = UPPER(TRIM(registration))
            WHERE registration IS NOT NULL AND registration <> UPPER(TRIM(registration))
        """)
        step("Odstranění osiřelých GPS bodů", """
            DELETE FROM track_points
            WHERE track_id NOT IN (SELECT id FROM flight_tracks)
        """)
        prev = con.total_changes
        _seed_aircraft_from_existing_data(con)
        result["actions"].append({"Akce": "Doplnění letadel z existujících letů", "Změny": int(con.total_changes - prev)})
        prev = con.total_changes
        _backfill_track_points(con)
        result["actions"].append({"Akce": "Doplnění normalizovaných GPS bodů", "Změny": int(con.total_changes - prev)})
        step("Doplnění point_count z track_points", """
            UPDATE flight_tracks
            SET point_count = COALESCE((SELECT COUNT(*) FROM track_points p WHERE p.track_id = flight_tracks.id), point_count)
            WHERE EXISTS (SELECT 1 FROM track_points p WHERE p.track_id = flight_tracks.id)
        """)
        try:
            optimize_sqlite(con)
        except Exception:
            pass
        result["changed"] = int(con.total_changes - before)
        record_audit(con, "safe_database_service", "database", None, result)
        con.commit()
    build_database_health_report.clear()
    invalidate_cached_data("database")
    auto_backup_after_change("safe_database_service")
    return result


def run_sqlite_service() -> dict[str, Any]:
    result = {"Akce": [], "Stav": "OK"}
    with connect() as con:
        try:
            con.execute("PRAGMA optimize")
            result["Akce"].append("PRAGMA optimize")
        except sqlite3.DatabaseError as exc:
            result["Akce"].append(f"PRAGMA optimize selhalo: {exc}")
        try:
            con.execute("PRAGMA wal_checkpoint(TRUNCATE)")
            result["Akce"].append("WAL checkpoint")
        except sqlite3.DatabaseError as exc:
            result["Akce"].append(f"WAL checkpoint selhal: {exc}")
        record_audit(con, "sqlite_service", "database", None, result)
        con.commit()
    invalidate_cached_data("database")
    return result


def render_database_control_panel() -> None:
    st.markdown("### Kontrola a servis")
    c1, c2, c3 = st.columns(3)
    with c1:
        if st.button("Spustit kontrolu", type="primary", use_container_width=True, key="run_db_health_v047"):
            with st.spinner("Kontroluji databázi…"):
                st.session_state["db_health_report_v047"] = build_database_health_report()
    with c2:
        if st.button("Bezpečný servis", use_container_width=True, disabled=not is_admin(), key="run_safe_service_v047"):
            if require_admin():
                with st.spinner("Provádím bezpečný servis…"):
                    try:
                        st.session_state["safe_service_result_v047"] = run_safe_database_service()
                        st.session_state["db_health_report_v047"] = build_database_health_report()
                        st.success("Bezpečný servis dokončen.")
                    except Exception as exc:
                        st.error(f"Servis selhal: {exc}")
    with c3:
        if st.button("SQLite optimize", use_container_width=True, disabled=not is_admin(), key="run_sqlite_service_v047"):
            if require_admin():
                try:
                    st.session_state["sqlite_service_result_v047"] = run_sqlite_service()
                    st.success("SQLite optimalizace dokončena.")
                except Exception as exc:
                    st.error(f"SQLite optimalizace selhala: {exc}")

    if not is_admin():
        st.caption("Servisní opravy jsou dostupné jen po přihlášení jako admin.")

    result = st.session_state.get("safe_service_result_v047")
    if result:
        with st.expander("Poslední bezpečný servis", expanded=False):
            st.metric("Změny", int(result.get("changed", 0)))
            actions = pd.DataFrame(result.get("actions", []))
            if not actions.empty:
                st.dataframe(actions, hide_index=True, use_container_width=True)

    sqlite_result = st.session_state.get("sqlite_service_result_v047")
    if sqlite_result:
        with st.expander("Poslední SQLite optimize", expanded=False):
            st.write(" • ".join(sqlite_result.get("Akce", [])))

    report = st.session_state.get("db_health_report_v047")
    if not report:
        st.info("Kontrola se spouští ručně, aby stránka Databáze zbytečně nezpomalovala.")
        return

    counts = report.get("counts", {})
    checks = report.get("checks", {})
    issue_count = int(report.get("issue_count", 0) or 0)
    m1, m2, m3, m4 = st.columns(4)
    with m1: metric_card("Stav", "OK" if issue_count == 0 else str(issue_count), "nálezy")
    with m2: metric_card("Lety", str(counts.get("flights", 0)), "záznamy")
    with m3: metric_card("Tracky", str(counts.get("flight_tracks", 0)), "KML")
    with m4: metric_card("GPS body", f"{int(counts.get('track_points', 0)):,}".replace(",", " "), "normalizace")
    st.caption(f"Kontrola: {report.get('generated_at', '')}")

    if str(checks.get("integrity_check", "")).upper() == "OK" and str(checks.get("foreign_key_check", "")).upper() == "OK":
        st.success("SQLite integrita a foreign key check: OK")
    else:
        st.error(f"SQLite kontrola: integrity={checks.get('integrity_check')} • foreign_keys={checks.get('foreign_key_check')}")

    tables = report.get("tables", {})
    _render_issue_table("Foreign key check", tables.get("foreign_key_check", pd.DataFrame()))
    _render_issue_table("Podezřelé duplicity letů", tables.get("duplicate_flights", pd.DataFrame()))
    _render_issue_table("Chybějící základní údaje", tables.get("missing_core", pd.DataFrame()))
    _render_issue_table("Časové anomálie", tables.get("time_anomalies", pd.DataFrame()))
    _render_issue_table("Lety bez sazby", tables.get("missing_price", pd.DataFrame()))
    _render_issue_table("Registrace bez profilu letadla", tables.get("missing_aircraft", pd.DataFrame()))
    _render_issue_table("Neznámá letiště / plochy", tables.get("unknown_airports", pd.DataFrame()))
    _render_issue_table("Tracky bez GPS bodů", tables.get("tracks_without_points", pd.DataFrame()))
    _render_issue_table("Nesoulad point_count / track_points", tables.get("track_point_mismatch", pd.DataFrame()))
    _render_issue_table("Neplatné GPS body", tables.get("invalid_points", pd.DataFrame()))
    _render_issue_table("Osiřelé tracky", tables.get("orphan_tracks", pd.DataFrame()))
    _render_issue_table("Osiřelé GPS body", tables.get("orphan_points", pd.DataFrame()))
    _render_issue_table("Neplatný JSON tracku", tables.get("invalid_track_json", pd.DataFrame()))

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



def render_export_filters(df: pd.DataFrame) -> pd.DataFrame:
    if df.empty:
        return df
    work = df.copy()
    min_date, max_date = _export_date_bounds(work)
    with st.expander("Filtry exportu", expanded=True):
        c1, c2, c3, c4 = st.columns(4)
        with c1:
            start_date = st.date_input("Od", value=min_date, min_value=min_date, max_value=max_date, key="export_start_date")
        with c2:
            end_date = st.date_input("Do", value=max_date, min_value=min_date, max_value=max_date, key="export_end_date")
        with c3:
            evidence_values = sorted([x for x in work["evidence"].dropna().unique() if x])
            selected_evidence = st.multiselect("Evidence", evidence_values, default=evidence_values, key="export_evidence")
        with c4:
            role_values = sorted([x for x in work["role"].dropna().unique() if x])
            selected_roles = st.multiselect("Funkce", role_values, default=role_values, key="export_roles")

        c5, c6, c7 = st.columns(3)
        with c5:
            reg_values = sorted([x for x in work["registration"].dropna().unique() if x])
            selected_regs = st.multiselect("Imatrikulace", reg_values, default=[], key="export_regs")
        with c6:
            class_values = sorted([x for x in work["aircraft_class"].dropna().unique() if x])
            selected_classes = st.multiselect("Třída", class_values, default=[], key="export_classes")
        with c7:
            include_tracks_only = st.checkbox("Pouze lety s GPS trackem", value=False, key="export_tracks_only")

    start_ts = pd.Timestamp(start_date)
    end_ts = pd.Timestamp(end_date) + pd.Timedelta(days=1) - pd.Timedelta(seconds=1)
    work = work[pd.to_datetime(work["date_dt"], errors="coerce").between(start_ts, end_ts, inclusive="both")]
    if selected_evidence:
        work = work[work["evidence"].isin(selected_evidence)]
    if selected_roles:
        work = work[work["role"].isin(selected_roles)]
    if selected_regs:
        work = work[work["registration"].isin(selected_regs)]
    if selected_classes:
        work = work[work["aircraft_class"].isin(selected_classes)]
    if include_tracks_only and "track_count" in work.columns:
        work = work[work["track_count"].fillna(0).astype(int).gt(0)]
    return work


def render_export_summary(filtered: pd.DataFrame) -> None:
    s = build_summary(filtered)
    cols = st.columns(6)
    values = [
        ("Lety", s["flights"]),
        ("Starty", s["starts"]),
        ("Block", fmt_minutes(s["total"])),
        ("Air", fmt_minutes(s["air"])),
        ("PIC", fmt_minutes(s["pic"])),
        ("Náklady", fmt_money(float(s["cost"]), current_user_currency())),
    ]
    for col, (label, value) in zip(cols, values):
        with col:
            st.metric(label, value)


def page_export(df: pd.DataFrame):
    st.markdown("## Export")
    if df.empty:
        st.info("Zatím nejsou uložené žádné lety.")
        if is_admin():
            with open(DB_PATH, "rb") as f:
                st.download_button("Stáhnout SQLite databázi", f.read(), file_name="logbook.sqlite", use_container_width=True)
        return

    filtered = render_export_filters(df)
    render_export_summary(filtered)

    section = st.radio(
        "Export sekce",
        ["Soubory", "Tisk", "Náhled dat"],
        horizontal=True,
        label_visibility="collapsed",
        key="export_section_v052",
    )
    prefix = _export_prefix(filtered, "letovy_zapisnik")
    export_signature = _flight_id_tuple(filtered)
    if st.session_state.get("export_signature_v044") != export_signature:
        st.session_state["export_signature_v044"] = export_signature
        st.session_state.pop("export_files_ready_v044", None)
        st.session_state.pop("export_print_ready_v044", None)

    if section == "Soubory":
        st.markdown("### Soubory")
        cprep, cdb = st.columns([1, 1])
        with cprep:
            prepare_files = st.button("Připravit exportní soubory", type="primary", use_container_width=True, key="export_prepare_files_v044")
        with cdb:
            if is_admin():
                with open(DB_PATH, "rb") as f:
                    st.download_button("SQLite databáze", f.read(), file_name="logbook.sqlite", use_container_width=True)
            else:
                st.caption("Úplná SQLite databáze je dostupná pouze správci aplikace.")

        if prepare_files or st.session_state.get("export_files_ready_v044"):
            st.session_state["export_files_ready_v044"] = True
            detail = make_logbook_export_df(filtered, current_user_currency())
            xlsx = export_excel(filtered, current_user_currency())
            csv = detail.to_csv(index=False).encode("utf-8-sig")
            html_doc = build_print_html(filtered, currency=current_user_currency())
            c1, c2, c3 = st.columns(3)
            with c1:
                st.download_button(
                    "Excel logbook",
                    data=xlsx,
                    file_name=f"{prefix}.xlsx",
                    mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    type="primary",
                    use_container_width=True,
                )
            with c2:
                st.download_button("CSV", data=csv, file_name=f"{prefix}.csv", mime="text/csv", use_container_width=True)
            with c3:
                st.download_button("Tisk HTML", data=html_doc.encode("utf-8"), file_name=f"{prefix}_tisk.html", mime="text/html", use_container_width=True)
        else:
            st.caption("Excel/CSV/HTML se připraví až po stisku tlačítka.")

        st.markdown("### Obsah Excelu")
        st.dataframe(
            pd.DataFrame([
                {"List": "Zápisník", "Obsah": "Filtrované lety ve stylu pilotního zápisníku"},
                {"List": "Souhrn", "Obsah": "Celkový nálet, PIC, DUAL, Safety, ULL/EASA, GPS a náklady"},
                {"List": "Letadla", "Obsah": "Součty podle imatrikulace, typu a evidence"},
                {"List": "Funkce", "Obsah": "Součty podle funkce v letu"},
                {"List": "Trasy", "Obsah": "Nejčastější direct trasy"},
                {"List": "Letiště", "Obsah": "Odlety, přílety a návštěvy letišť"},
            ]),
            hide_index=True,
            use_container_width=True,
        )

    elif section == "Tisk":
        st.markdown("### Tiskový přehled")
        if st.button("Vygenerovat tiskový náhled", use_container_width=True, key="export_print_preview_v044") or st.session_state.get("export_print_ready_v044"):
            st.session_state["export_print_ready_v044"] = True
            components.html(build_print_html(filtered, currency=current_user_currency()), height=620, scrolling=True)
        else:
            st.caption("Tiskový náhled se vygeneruje až na vyžádání.")

    elif section == "Náhled dat":
        detail = make_logbook_export_df(filtered, current_user_currency())
        c1, c2 = st.columns(2)
        with c1:
            st.markdown("### Lety")
            st.dataframe(detail.head(300), hide_index=True, use_container_width=True, height=420)
        with c2:
            st.markdown("### Souhrn")
            st.dataframe(make_summary_table(filtered, current_user_currency()), hide_index=True, use_container_width=True, height=420)
        st.markdown("### Letadla")
        st.dataframe(make_group_summary(filtered, ["registration", "aircraft_type", "evidence"], current_user_currency()), hide_index=True, use_container_width=True)




def read_admin_user_overview() -> pd.DataFrame:
    """Small global overview used only by the persistent admin console."""
    with connect() as con:
        return pd.read_sql_query(
            """
            SELECT
                u.id,
                u.display_name,
                u.email,
                COALESCE(u.role, 'user') AS role,
                u.active,
                u.created_at,
                c.last_login_at,
                s.home_airport,
                s.currency,
                s.timezone,
                s.default_role,
                (SELECT COUNT(*) FROM flights f WHERE f.user_id = u.id) AS flights,
                (SELECT COUNT(*) FROM aircraft a WHERE a.user_id = u.id) AS aircraft,
                (SELECT COUNT(*) FROM airports ap WHERE ap.user_id = u.id) AS custom_airports,
                (SELECT COUNT(*) FROM flight_tracks t WHERE t.user_id = u.id) AS tracks,
                (SELECT COUNT(*) FROM track_points p WHERE p.user_id = u.id) AS gps_points
            FROM users u
            LEFT JOIN user_credentials c ON c.user_id = u.id
            LEFT JOIN user_settings s ON s.user_id = u.id
            ORDER BY u.id
            """,
            con,
        )


def _admin_global_counts() -> dict[str, int]:
    with connect() as con:
        def count(table: str) -> int:
            try:
                return int(con.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0])
            except sqlite3.DatabaseError:
                return 0
        return {
            "users": count("users"),
            "flights": count("flights"),
            "tracks": count("flight_tracks"),
            "points": count("track_points"),
        }


@st.cache_data(show_spinner=False, ttl=120)
def read_permission_health() -> dict[str, Any]:
    """Global tenant-integrity checks. This is rendered only in the admin console."""
    issues: list[dict[str, Any]] = []
    with connect() as con:
        for table in sorted(USER_SCOPED_TABLES):
            try:
                missing_owner = int(con.execute(
                    f"SELECT COUNT(*) FROM {table} WHERE user_id IS NULL OR user_id <= 0"
                ).fetchone()[0])
                unknown_owner = int(con.execute(
                    f"SELECT COUNT(*) FROM {table} t LEFT JOIN users u ON u.id = t.user_id WHERE u.id IS NULL"
                ).fetchone()[0])
            except sqlite3.DatabaseError:
                continue
            if missing_owner:
                issues.append({"Kontrola": table, "Problém": "chybí user_id", "Počet": missing_owner})
            if unknown_owner:
                issues.append({"Kontrola": table, "Problém": "neexistující vlastník", "Počet": unknown_owner})

        cross_tracks = int(con.execute(
            """
            SELECT COUNT(*)
            FROM flight_tracks t
            JOIN flights f ON f.id = t.flight_id
            WHERE t.user_id <> f.user_id
            """
        ).fetchone()[0])
        if cross_tracks:
            issues.append({"Kontrola": "flight_tracks", "Problém": "track patří jinému uživateli než let", "Počet": cross_tracks})

        cross_points = int(con.execute(
            """
            SELECT COUNT(*)
            FROM track_points p
            JOIN flight_tracks t ON t.id = p.track_id
            WHERE p.user_id <> t.user_id
            """
        ).fetchone()[0])
        if cross_points:
            issues.append({"Kontrola": "track_points", "Problém": "GPS bod patří jinému uživateli než track", "Počet": cross_points})

        invalid_roles = int(con.execute(
            "SELECT COUNT(*) FROM users WHERE role NOT IN ('admin','user') OR role IS NULL"
        ).fetchone()[0])
        if invalid_roles:
            issues.append({"Kontrola": "users", "Problém": "neplatná role", "Počet": invalid_roles})

        owner_admin = int(con.execute(
            "SELECT COUNT(*) FROM users WHERE id = ? AND role = 'admin' AND active = 1",
            (DEFAULT_USER_ID,),
        ).fetchone()[0])
        if owner_admin != 1:
            issues.append({"Kontrola": "users", "Problém": "hlavní profil #1 není aktivní admin", "Počet": 1})

        active_users = int(con.execute("SELECT COUNT(*) FROM users WHERE active = 1").fetchone()[0])
        admins = int(con.execute("SELECT COUNT(*) FROM users WHERE active = 1 AND role = 'admin'").fetchone()[0])
    return {
        "ok": len(issues) == 0,
        "issues": pd.DataFrame(issues),
        "active_users": active_users,
        "admins": admins,
        "scoped_tables": len(USER_SCOPED_TABLES),
    }


def page_admin() -> None:
    if not require_admin():
        return

    st.markdown("## Admin")
    st.caption("Správa celé aplikace. Běžní uživatelé tuto stránku nevidí.")
    section = st.radio(
        "Admin sekce",
        ["Přehled", "Uživatelé", "Bezpečnost", "Záloha", "Servis", "Meta"],
        horizontal=True,
        label_visibility="collapsed",
        key="admin_section_v057",
    )

    if section == "Přehled":
        users = read_admin_user_overview()
        counts = _admin_global_counts()
        active_users = int(pd.to_numeric(users.get("active", pd.Series(dtype=int)), errors="coerce").fillna(0).eq(1).sum()) if not users.empty else 0
        admins = int(users.get("role", pd.Series(dtype=str)).fillna("user").astype(str).str.lower().eq("admin").sum()) if not users.empty else 0
        c1, c2, c3, c4 = st.columns(4)
        with c1: metric_card("Uživatelé", str(counts["users"]), f"{active_users} aktivních")
        with c2: metric_card("Lety", str(counts["flights"]), "všechny profily")
        with c3: metric_card("GPS tracky", str(counts["tracks"]), f"{counts['points']:,} bodů".replace(",", " "))
        with c4: metric_card("Správci", str(admins), f"schema {DB_SCHEMA_VERSION}")
        db_size = DB_PATH.stat().st_size if DB_PATH.exists() else 0
        st.caption(f"Aplikace {APP_VERSION} · databáze {db_size / (1024 * 1024):.1f} MB · SQLite schema {DB_SCHEMA_VERSION}")
        if not users.empty:
            show = users.rename(columns={
                "id":"ID", "display_name":"Jméno", "email":"E-mail", "role":"Role", "active":"Aktivní",
                "created_at":"Vytvořen", "last_login_at":"Poslední přihlášení", "flights":"Lety",
                "aircraft":"Letadla", "custom_airports":"Vlastní letiště", "tracks":"Tracky", "gps_points":"GPS body",
                "home_airport":"Domovské letiště", "currency":"Měna", "timezone":"Časové pásmo", "default_role":"Výchozí funkce",
            })
            st.dataframe(show, hide_index=True, use_container_width=True, height=420)

    elif section == "Uživatelé":
        st.markdown("### Vytvořit nový profil")
        st.caption("Tímto lze vytvořit testovací běžný účet i když je veřejná registrace vypnutá.")
        with st.form("admin_create_user_v057"):
            c1, c2 = st.columns(2)
            with c1:
                display_name = st.text_input("Jméno")
                email = st.text_input("E-mail")
            with c2:
                password = st.text_input(f"Dočasné heslo (min. {PASSWORD_MIN_LENGTH} znaků)", type="password")
                role_label = st.selectbox("Role", ["Uživatel", "Správce"], index=0)
            create_submitted = st.form_submit_button("Vytvořit profil", type="primary", use_container_width=True)
        if create_submitted:
            role = "admin" if role_label == "Správce" else "user"
            with connect() as con:
                result = register_user(con, email=email, display_name=display_name, password=password, role=role)
                if result.ok:
                    record_audit(con, "admin_create_user", "user", result.user_id, {"email": str(email).strip().lower(), "role": role})
                    con.commit()
            if result.ok:
                read_user_profile.clear()
                auto_backup_after_change("admin_create_user")
                st.success(f"Profil vytvořen. User ID {result.user_id}.")
                st.rerun()
            else:
                st.error(result.error or "Profil se nepodařilo vytvořit.")

        users = read_admin_user_overview()
        st.markdown("### Správa profilů")
        if users.empty:
            st.info("Nejsou žádní uživatelé.")
            return
        option_ids = users["id"].astype(int).tolist()
        def user_label(uid: int) -> str:
            row = users[users["id"].eq(uid)].iloc[0]
            role_text = "admin" if str(row.get("role") or "user").lower() == "admin" else "user"
            active_text = "aktivní" if int(row.get("active") or 0) == 1 else "deaktivovaný"
            return f"#{uid} · {row.get('display_name') or '—'} · {row.get('email') or '—'} · {role_text} · {active_text}"
        selected_uid = int(st.selectbox("Profil", option_ids, format_func=user_label, key="admin_user_pick_v057"))
        selected = users[users["id"].eq(selected_uid)].iloc[0]
        c1, c2, c3, c4 = st.columns(4)
        with c1: metric_card("Lety", str(int(selected.get("flights") or 0)), "")
        with c2: metric_card("Letadla", str(int(selected.get("aircraft") or 0)), "")
        with c3: metric_card("Vlastní letiště", str(int(selected.get("custom_airports") or 0)), "")
        with c4: metric_card("Tracky", str(int(selected.get("tracks") or 0)), "")
        st.caption(
            f"Poslední přihlášení: {selected.get('last_login_at') or '—'} · "
            f"Domovské letiště: {selected.get('home_airport') or '—'} · "
            f"Měna: {selected.get('currency') or 'CZK'} · "
            f"Timezone: {selected.get('timezone') or 'Europe/Prague'}"
        )

        with st.form("admin_user_state_v057"):
            role_value = "Správce" if str(selected.get("role") or "user").lower() == "admin" else "Uživatel"
            role_new = st.selectbox("Role profilu", ["Uživatel", "Správce"], index=1 if role_value == "Správce" else 0)
            active_new = st.checkbox("Aktivní účet", value=bool(int(selected.get("active") or 0)))
            save_user_state = st.form_submit_button("Uložit oprávnění", use_container_width=True)
        if save_user_state:
            if selected_uid == current_user_id() and (not active_new or role_new != "Správce"):
                st.error("Nemůžeš si během aktuální relace odebrat vlastní administrátorský přístup nebo deaktivovat účet.")
            else:
                with connect() as con:
                    role_result = set_user_role(con, user_id=selected_uid, role="admin" if role_new == "Správce" else "user")
                    active_result = set_user_active(con, user_id=selected_uid, active=active_new)
                    if role_result.ok and active_result.ok:
                        record_audit(con, "admin_update_user", "user", selected_uid, {"role": role_new, "active": active_new})
                        con.commit()
                if role_result.ok and active_result.ok:
                    read_user_profile.clear()
                    auto_backup_after_change("admin_update_user")
                    st.success("Oprávnění uživatele byla uložena.")
                    st.rerun()
                else:
                    st.error(role_result.error or active_result.error or "Změna se nepodařila.")

        st.markdown("#### Nastavit nové heslo")
        with st.form("admin_reset_user_password_v057"):
            new_password = st.text_input(f"Nové heslo pro #{selected_uid}", type="password")
            reset_password = st.form_submit_button("Nastavit nové heslo", use_container_width=True)
        if reset_password:
            with connect() as con:
                result = admin_set_user_password(con, user_id=selected_uid, new_password=new_password)
                if result.ok:
                    record_audit(con, "admin_reset_password", "user", selected_uid)
                    con.commit()
            if result.ok:
                auto_backup_after_change("admin_reset_password")
                st.success("Nové heslo bylo nastaveno.")
            else:
                st.error(result.error or "Heslo se nepodařilo změnit.")

    elif section == "Bezpečnost":
        st.markdown("### Izolace uživatelských dat")
        st.caption("Kontrola vazeb user_id napříč všemi uživatelskými tabulkami. Žádný běžný uživatel tuto část nevidí.")
        health = read_permission_health()
        c1, c2, c3, c4 = st.columns(4)
        with c1: metric_card("Stav", "OK" if health.get("ok") else "Pozor", "tenant isolation")
        with c2: metric_card("Aktivní účty", str(health.get("active_users", 0)), "")
        with c3: metric_card("Správci", str(health.get("admins", 0)), "")
        with c4: metric_card("Scoped tabulky", str(health.get("scoped_tables", 0)), "user_id")
        issues = health.get("issues")
        if isinstance(issues, pd.DataFrame) and not issues.empty:
            st.error("Byly nalezeny problémy v oddělení uživatelských dat.")
            st.dataframe(issues, hide_index=True, use_container_width=True)
        else:
            st.success("Všechny uživatelské tabulky mají platného vlastníka a vazby track → let → uživatel jsou konzistentní.")
        st.markdown("#### Bezpečnostní model")
        st.write("• Běžný uživatel čte a mění pouze řádky se svým `user_id`.")
        st.write("• ID bez platného přihlášeného uživatele se už nesmí tiše převést na původní profil #1.")
        st.write("• Admin nástroje jsou oddělené od běžných uživatelských operací.")
        st.write("• Úplná SQLite databáze a globální audit jsou dostupné pouze administrátorovi.")
        if st.button("Spustit kontrolu znovu", use_container_width=True, key="admin_permission_recheck_v059"):
            read_permission_health.clear()
            st.rerun()

    elif section == "Záloha":
        metas = read_table("app_meta")
        st.markdown("### SQLite + GitHub backup")
        dirty = last_change = last_backup = ""
        if not metas.empty:
            md = dict(zip(metas["key"], metas["value"]))
            dirty = md.get("dirty", "")
            last_change = md.get("last_change_at", "")
            last_backup = md.get("last_github_backup_at", "")
        b1, b2, b3 = st.columns(3)
        with b1: metric_card("Stav", "Nezálohováno" if dirty == "1" else "OK", "dirty flag")
        with b2: metric_card("Poslední změna", last_change[:19] if last_change else "—", "UTC")
        with b3: metric_card("GitHub backup", last_backup[:19] if last_backup else "—", "UTC")
        if github_auto_backup_enabled():
            st.success("Automatická GitHub záloha je zapnutá.")
        elif github_backup_configured():
            st.warning("GitHub token je nastavený, ale automatická záloha je vypnutá.")
        else:
            st.warning("GitHub backup není nakonfigurovaný.")
        if DB_PATH.exists():
            with open(DB_PATH, "rb") as f:
                st.download_button("Stáhnout celou SQLite databázi", f.read(), file_name="logbook.sqlite", use_container_width=True)
        if github_backup_configured():
            if st.button("Uložit aktuální databázi na GitHub", type="primary", use_container_width=True, key="admin_backup_now_v057"):
                try:
                    url = backup_database_to_github()
                    st.success("Databáze zazálohována na GitHub." + (f" Commit: {url}" if url else ""))
                except Exception as exc:
                    st.error(f"Backup selhal: {exc}")
        st.markdown("#### Obnova celé databáze")
        restore = st.file_uploader("SQLite databáze", type=["sqlite", "db"], key="admin_restore_db_v057")
        confirm = st.text_input("Pro obnovení napiš OBNOVIT", value="", key="admin_restore_confirm_v057")
        if restore is not None and st.button("Obnovit databázi", disabled=confirm != "OBNOVIT", use_container_width=True, key="admin_restore_btn_v057"):
            try:
                restore_database_from_upload(restore)
                st.success("Databáze obnovena.")
                st.rerun()
            except Exception as exc:
                st.error(f"Obnova selhala: {exc}")

    elif section == "Servis":
        render_database_control_panel()

    elif section == "Meta":
        st.markdown("### Metadata aplikace")
        metas = read_table("app_meta")
        if metas.empty:
            st.info("Žádná metadata.")
        else:
            st.dataframe(metas.sort_values("key"), hide_index=True, use_container_width=True)
        st.markdown("### Poslední auditní události napříč profily")
        with connect() as con:
            audits = pd.read_sql_query("SELECT * FROM audit_log ORDER BY id DESC LIMIT 500", con)
        if audits.empty:
            st.info("Žádný audit log.")
        else:
            st.dataframe(audits, hide_index=True, use_container_width=True, height=420)

def page_profile() -> None:
    uid = strict_user_id(current_user_id())
    profile = read_user_profile(uid)
    prefs = _profile_preferences(profile)
    flights_count = read_table_count("flights", uid)
    counts = read_logbook_counts(uid)

    st.markdown("## Profil a nastavení")
    st.caption("Všechna nastavení patří pouze tomuto účtu. Ostatní uživatelé mají vlastní profil i vlastní data.")

    p1, p2, p3, p4 = st.columns(4)
    with p1: metric_card("Profil", f"#{uid}", "Správce" if is_admin() else "Uživatel")
    with p2: metric_card("Lety", str(flights_count), "vlastní záznamy")
    with p3: metric_card("Letadla", str(counts.get("aircraft", 0)), "vlastní profily")
    with p4: metric_card("GPS", str(counts.get("tracks", 0)), "vlastní tracky")

    tabs = st.tabs(["Profil", "Výchozí hodnoty", "Zabezpečení"])

    with tabs[0]:
        st.markdown("### Osobní profil")
        st.caption("Jméno se používá například jako výchozí velitel nového letu.")
        with st.form("profile_identity_form_v059"):
            display_name = st.text_input("Jméno", value=str(profile.get("display_name") or ""))
            st.text_input("E-mail účtu", value=str(profile.get("email") or ""), disabled=True)
            submitted = st.form_submit_button("Uložit profil", type="primary", use_container_width=True)
        if submitted:
            clean_name = str(display_name or "").strip()
            if not clean_name:
                st.error("Jméno profilu nesmí být prázdné.")
            else:
                with connect() as con:
                    con.execute(
                        "UPDATE users SET display_name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                        (clean_name, uid),
                    )
                    record_audit(con, "update_profile", "user", uid, {"display_name": clean_name})
                    con.commit()
                read_user_profile.clear()
                auto_backup_after_change("update_profile")
                st.success("Profil byl uložen.")
                st.rerun()

        st.markdown("### Účet")
        c1, c2 = st.columns(2)
        with c1:
            st.write(f"**User ID:** {uid}")
            st.write(f"**Role:** {'Správce' if is_admin() else 'Uživatel'}")
        with c2:
            st.write(f"**Vytvořen:** {profile.get('created_at') or '—'}")
            st.write(f"**Domovské letiště:** {profile.get('home_airport') or '—'}")
        if uid == DEFAULT_USER_ID:
            st.info("Toto je původní administrátorský profil. Všechny lety existující před zavedením účtů zůstávají přiřazené právě tomuto profilu.")

    with tabs[1]:
        st.markdown("### Výchozí hodnoty nového letu")
        st.caption("Tyto hodnoty pouze předvyplní formulář. U každého letu je můžeš změnit.")
        timezone_options = [
            "Europe/Prague", "Europe/London", "Europe/Berlin", "Europe/Paris",
            "Europe/Vienna", "Europe/Warsaw", "Europe/Bratislava", "Europe/Budapest",
            "UTC", "America/New_York", "America/Chicago", "America/Denver",
            "America/Los_Angeles", "Australia/Sydney",
        ]
        current_tz = str(profile.get("timezone") or "Europe/Prague")
        if current_tz not in timezone_options:
            timezone_options.insert(0, current_tz)
        currency_options = ["CZK", "EUR", "USD", "GBP"]
        current_currency = str(profile.get("currency") or "CZK").upper()
        current_evidence = str(prefs.get("default_evidence") or "ULL").upper()
        if current_evidence not in EVIDENCE_OPTIONS:
            current_evidence = "ULL"
        role_value = str(profile.get("default_role") or "PIC").upper()
        if role_value not in ROLE_OPTIONS:
            role_value = "PIC"

        with st.form("profile_defaults_form_v059"):
            c1, c2 = st.columns(2)
            with c1:
                home_airport = st.text_input(
                    "Domovské letiště",
                    value=str(profile.get("home_airport") or ""),
                    placeholder="LKVO",
                    help="Předvyplní odlet při ručním zadávání nového letu.",
                ).upper().strip()
                default_role = st.selectbox(
                    "Výchozí funkce",
                    ROLE_OPTIONS,
                    index=ROLE_OPTIONS.index(role_value),
                )
                default_evidence = st.selectbox(
                    "Výchozí evidence",
                    EVIDENCE_OPTIONS,
                    index=EVIDENCE_OPTIONS.index(current_evidence),
                )
            with c2:
                currency = st.selectbox(
                    "Měna",
                    currency_options,
                    index=currency_options.index(current_currency) if current_currency in currency_options else 0,
                    help="Používá se pro zobrazení cen a nákladů tohoto profilu.",
                )
                timezone_name = st.selectbox(
                    "Časové pásmo",
                    timezone_options,
                    index=timezone_options.index(current_tz),
                    help="Používá se při převodu časů GPS/KML do lokálního času.",
                )
            save_defaults = st.form_submit_button("Uložit výchozí hodnoty", type="primary", use_container_width=True)

        if save_defaults:
            validation_error = None
            try:
                ZoneInfo(timezone_name)
            except (ZoneInfoNotFoundError, ValueError):
                validation_error = "Vybrané časové pásmo není platné."
            if not validation_error and home_airport:
                lookup = airport_coords_for_idents((home_airport,), uid)
                if home_airport not in lookup:
                    validation_error = f"Letiště {home_airport} není v databázi. Nejdřív ho přidej jako vlastní letiště nebo použij známý ident."
            if validation_error:
                st.error(validation_error)
            else:
                new_prefs = dict(prefs)
                new_prefs["default_evidence"] = default_evidence
                with connect() as con:
                    con.execute(
                        """
                        INSERT INTO user_settings
                            (user_id, timezone, currency, home_airport, default_role, preferences_json, created_at, updated_at)
                        VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                        ON CONFLICT(user_id) DO UPDATE SET
                            timezone = excluded.timezone,
                            currency = excluded.currency,
                            home_airport = excluded.home_airport,
                            default_role = excluded.default_role,
                            preferences_json = excluded.preferences_json,
                            updated_at = CURRENT_TIMESTAMP
                        """,
                        (uid, timezone_name, currency, home_airport or None, default_role, json.dumps(new_prefs, ensure_ascii=False)),
                    )
                    record_audit(
                        con,
                        "update_user_settings",
                        "user",
                        uid,
                        {"timezone": timezone_name, "currency": currency, "home_airport": home_airport or None, "default_role": default_role, "default_evidence": default_evidence},
                    )
                    con.commit()
                read_user_profile.clear()
                invalidate_cached_data("all")
                auto_backup_after_change("update_user_settings")
                st.success("Výchozí hodnoty byly uloženy.")
                st.rerun()

        st.info(
            f"Nový ručně zadaný let se nyní předvyplní jako **{default_evidence} / {default_role}**"
            + (f" z **{home_airport}**." if home_airport else ".")
        )

    with tabs[2]:
        st.markdown("### Přihlašovací e-mail")
        st.caption("Změnu e-mailu je nutné potvrdit současným heslem.")
        with st.form("change_user_email_form_v059"):
            new_email = st.text_input("Nový e-mail", value=str(profile.get("email") or ""))
            email_password = st.text_input("Současné heslo", type="password", key="profile_email_password_v059")
            email_submit = st.form_submit_button("Změnit e-mail", use_container_width=True)
        if email_submit:
            with connect() as con:
                result = change_email(con, user_id=uid, current_password=email_password, new_email=new_email)
                if result.ok:
                    record_audit(con, "change_email", "user", uid, {"new_email": str(new_email).strip().lower()})
                    con.commit()
            if result.ok:
                read_user_profile.clear()
                auto_backup_after_change("change_email")
                st.success("Přihlašovací e-mail byl změněn.")
                st.rerun()
            else:
                st.error(result.error or "E-mail se nepodařilo změnit.")

        st.markdown("### Změna hesla")
        with st.form("change_user_password_form_v059"):
            current_password = st.text_input("Současné heslo", type="password", key="profile_current_password_v059")
            new_password = st.text_input(f"Nové heslo (min. {PASSWORD_MIN_LENGTH} znaků)", type="password", key="profile_new_password_v059")
            new_password2 = st.text_input("Potvrzení nového hesla", type="password", key="profile_new_password2_v059")
            change_submitted = st.form_submit_button("Změnit heslo", use_container_width=True)
        if change_submitted:
            if new_password != new_password2:
                st.error("Nová hesla se neshodují.")
            else:
                with connect() as con:
                    result = change_password(
                        con, user_id=uid, current_password=current_password, new_password=new_password
                    )
                    if result.ok:
                        record_audit(con, "change_password", "user", uid)
                        con.commit()
                if result.ok:
                    auto_backup_after_change("change_password")
                    st.success("Heslo bylo změněno.")
                else:
                    st.error(result.error or "Heslo se nepodařilo změnit.")

        st.markdown("### Oprávnění")
        if is_admin():
            st.success("Tento profil je správce aplikace. Admin oprávnění se mění pouze v Admin menu.")
        else:
            st.info("Tento profil je běžný uživatel. Může číst a upravovat pouze vlastní lety, letadla, ceny, GPS tracky a vlastní letiště.")

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
          // CSS already suppresses Streamlit's native sidebar controls. Older
          // versions also ran a document-wide MutationObserver and repeated many
          // querySelectorAll scans while tables/maps were rendering. One pass per
          // rerun is enough and keeps browser-side rendering lighter.
          if (window.parent.__lbSidebarObserver) {
            try { window.parent.__lbSidebarObserver.disconnect(); } catch(e) {}
            window.parent.__lbSidebarObserver = null;
          }
        })();
        </script>
        """,
        height=0,
        width=0,
    )


def render_page_transition_runtime() -> None:
    """Install a tiny front-end page loader.

    Streamlit reruns the Python script after every sidebar button click. Without a
    front-end transition, the previous page visually disappears piece by piece
    while the new page is being generated. This overlay hides that intermediate
    state and makes navigation feel much closer to a normal web app.
    """
    components.html(
        """
        <script>
        (function() {
          const doc = window.parent.document;
          const overlayId = 'lb-page-loader';

          function ensureOverlay() {
            let el = doc.getElementById(overlayId);
            if (!el) {
              el = doc.createElement('div');
              el.id = overlayId;
              el.innerHTML = '<div class="lb-plane-spinner" title="Načítám"><span>✈</span></div>';
              doc.body.appendChild(el);
            }
            return el;
          }
          function showLoader() {
            ensureOverlay();
            doc.body.classList.add('lb-page-loading');
            // Safety timeout: the loader is only a visual transition. It must never
            // stay visible if Streamlit finishes rendering or if an error interrupts
            // the normal page-loaded signal.
            clearTimeout(window.parent.__lbLoaderSafety1);
            clearTimeout(window.parent.__lbLoaderSafety2);
            clearTimeout(window.parent.__lbLoaderSafety3);
            clearTimeout(window.parent.__lbLoaderSafety4);
            window.parent.__lbLoaderSafety1 = setTimeout(hideLoader, 900);
            window.parent.__lbLoaderSafety2 = setTimeout(hideLoader, 1800);
            window.parent.__lbLoaderSafety3 = setTimeout(hideLoader, 4000);
            window.parent.__lbLoaderSafety4 = setTimeout(hideLoader, 7000);
          }
          function hideLoader() {
            ensureOverlay();
            doc.body.classList.remove('lb-page-loading');
          }

          if (!window.parent.__lbPageLoaderInstalled) {
            doc.addEventListener('click', function(ev) {
              const target = ev.target;
              if (!target) return;
              const btn = target.closest && target.closest('button');
              const link = target.closest && target.closest('a');
              if (btn && btn.id !== 'lb-sidebar-toggle') {
                const inSidebar = btn.closest('section[data-testid="stSidebar"]');
                const txt = (btn.innerText || btn.textContent || '').trim();
                const navLabels = ['Souhrn','Lety','Přidat let','Mapa','Databáze','Export','Profil'];
                if (inSidebar && navLabels.indexOf(txt) !== -1) showLoader();
              }
              if (link && link.href && link.href.indexOf('flight_id=') !== -1) {
                showLoader();
              }
            }, true);
            window.parent.__lbPageLoaderInstalled = true;
          }
          // The new page has reached the browser once this component runs.
          setTimeout(hideLoader, 120);
          setTimeout(hideLoader, 800);
          setTimeout(hideLoader, 1800);
          setTimeout(hideLoader, 4000);
        })();
        </script>
        """,
        height=0,
        width=0,
    )


def render_page_loaded_signal() -> None:
    """Hide the front-end loader after the current Streamlit page has rendered."""
    components.html(
        """
        <script>
        (function() {
          const doc = window.parent.document;
          function hideLoader() { doc.body.classList.remove('lb-page-loading'); }
          setTimeout(hideLoader, 40);
          setTimeout(hideLoader, 180);
          setTimeout(hideLoader, 650);
          setTimeout(hideLoader, 1500);
          setTimeout(hideLoader, 4000);
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
    if not _DB_READY:
        with connect():
            pass
    if not render_auth_gate():
        return
    if "page" not in st.session_state:
        st.session_state["page"] = "Dashboard"
    q_flight_id = _query_param_value("flight_id")
    if q_flight_id and str(q_flight_id).isdigit():
        qid = int(q_flight_id)
        if st.session_state.get("dismissed_flight_id") != qid:
            st.session_state["page"] = "Lety"
            st.session_state["open_flight_dialog_id"] = qid
            st.session_state["selected_flight_id"] = qid
    q_map_airport = _query_param_value("map_airport")
    q_map_route = _query_param_value("map_route")
    if q_map_airport:
        st.session_state["page"] = "Mapa"
        st.session_state["map_airport"] = str(q_map_airport).upper().strip()
        st.session_state["map_mode_v039"] = "Orientační mapa letišť"
        st.session_state.pop("map_route", None)
    elif q_map_route:
        st.session_state["page"] = "Mapa"
        st.session_state["map_route"] = str(q_map_route).upper().strip()
        st.session_state["map_mode_v039"] = "Orientační mapa letišť"
        st.session_state.pop("map_airport", None)
    with st.sidebar:
        # Aplikace běží trvale v tmavém režimu; přepínač je z finálního UI odstraněn.
        dark_mode = True
        st.markdown("## Letový zápisník")
        st.markdown(f'<div class="sidebar-version">{APP_VERSION}</div>', unsafe_allow_html=True)
        render_sidebar_nav()
        render_user_sidebar()
    apply_ui_theme(dark_mode)
    render_sidebar_toggle()
    render_page_transition_runtime()
    app_header()
    page = st.session_state.get("page", "Dashboard")

    # Data se načítají až pro aktivní stránku. GPS Map Engine 2.0 ve v0.54
    # pracuje s lehkými metadaty, adaptivním point budgetem a vzorkovanými
    # body z track_points místo plného coordinates_json pro každý track.
    if page == "Dashboard":
        page_dashboard(read_flights(current_user_id()))
    elif page == "Lety":
        page_logbook(read_flights(current_user_id()), dark_mode)
    elif page == "Nový let":
        page_new_flight(read_rates(current_user_id()), dark_mode)
    elif page == "Mapa":
        page_maps(read_flights(current_user_id()), dark_mode)
    elif page == "Ceník":
        # Legacy session/bookmark from <= v0.57. Pricing now lives in aircraft profiles.
        st.session_state["page"] = "Databáze"
        st.rerun()
    elif page == "Databáze":
        page_database()
    elif page == "Kontrola":
        # Legacy route: stránka kontroly už není v navigaci, ale starý stav relace může existovat.
        st.session_state["page"] = "Dashboard"
        st.rerun()
    elif page == "Export":
        page_export(read_flights(current_user_id()))
    elif page == "Profil":
        page_profile()
    elif page == "Admin":
        if is_admin():
            page_admin()
        else:
            st.session_state["page"] = "Dashboard"
            st.rerun()
    render_page_loaded_signal()

if __name__ == "__main__":
    main()
