from __future__ import annotations

import base64
import html
import hashlib
import hmac
import json
import math
import re
import sqlite3
import threading
import time as time_module
from datetime import date, datetime, timezone
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
from io import BytesIO
from typing import Any


import numpy as np
import pandas as pd
import streamlit as st

from logbook_core.config import (
    AIRPORT_OVERRIDES_PATH, AIRPORTS_DB_PATH, APP_VERSION,
    BILLING_BASIS_OPTIONS, CLASS_OPTIONS, DATA_DIR, DB_PATH, DB_SCHEMA_VERSION,
    EVIDENCE_OPTIONS, LOCAL_TZ, NAV_ITEMS, POSTGRES_FOUNDATION_VERSION, ROLE_OPTIONS,
)
from logbook_core.schema import SCHEMA
from logbook_core.auth import (
    PASSWORD_MIN_LENGTH, activate_legacy_profile, authenticate_user, change_email, change_password,
    ensure_auth_schema, legacy_profile_needs_activation, register_user,
    admin_set_user_password, set_user_active, set_user_role,
)
from logbook_core.tenancy import DEFAULT_USER_ID, USER_SCOPED_TABLES, ensure_tenancy_schema
from logbook_core.permissions import require_owned_record, strict_user_id
from logbook_core.metrics import (
    build_summary, compute_metrics, fmt_minutes, fmt_money, minutes_diff,
    normalize_date, normalize_registration, normalize_text, normalize_time, parse_time_to_minutes,
)
from logbook_core.pricing import lookup_latest_rate
from logbook_core.tracks import (
    detect_kml_source, detect_takeoff_landing, extract_registration_from_filename,
    haversine_km, inferred_clock_times, normalize_track_points, parse_iso, parse_kml_bytes, point_local_date,
    profile_from_points, track_stats,
)
from logbook_core.smart_import import analyze_track, split_track_points
from logbook_core.currency import (
    expiry_overview, last_activity, recency_by_evidence,
)
from logbook_core.dashboard import (
    PERIOD_PRESETS, aircraft_summary, airport_route_summaries, category_year_summary,
    dashboard_insights, filter_period as filter_dashboard_period, monthly_primary_summary,
    monthly_summary as dashboard_monthly_summary, period_label as dashboard_period_label,
    primary_pilot_summary, yearly_summary as dashboard_yearly_summary,
)
from logbook_core.exports import (
    _export_date_bounds, _export_prefix, build_print_html, export_excel,
    make_group_summary, make_logbook_export_df, make_summary_table,
)
from logbook_core.portability import (
    BackupError, backup_filename, build_user_backup, inspect_user_backup,
    restore_user_backup,
)
from logbook_core.flight_entry import (
    frequent_destinations, manual_entry_defaults,
)
from logbook_core.logbook_view import (
    flight_navigation, quick_search_flights,
)
from logbook_core.track_player import build_track_player_payload
from logbook_core.data_quality import scan_data_quality
from logbook_core.db_runtime import (
    DATABASE_ERRORS, DatabaseBackendError,
    PostgresConnectionAdapter, insert_and_get_id, is_postgres_connection,
    read_sql_query as db_read_sql_query, resolve_runtime_database_config,
)
from logbook_core.production_cutover import (
    ProductionCutoverError, activate_postgres_production,
)
from logbook_core.runtime_metrics import record_page_event
from logbook_core.sqlite_runtime import (
    MAX_ADMIN_RESTORE_BYTES, SQLiteRestoreError, atomic_replace_sqlite,
    inspect_sqlite_bytes, snapshot_sqlite_bytes,
)
from logbook_core.map_engine import (
    build_gps_render_plan, encode_compact_track_points, simplify_track_points,
    viewport_from_coords,
)
from logbook_ui.filters import apply_filters
from logbook_ui.theme import apply_ui_theme, app_header, metric_card, plotly_layout
from logbook_core.performance import (
    apply_sqlite_pragmas,
    compact_records_json,
    optimize_sqlite,
)

_DB_READY = False
_DB_READY_BACKEND = ""
_DB_INIT_LOCK = threading.RLock()
_GITHUB_BACKUP_LOCK = threading.Lock()

# Reinitialized on every Streamlit script run. It avoids repeated st.cache_data
# retrieval/copy work for the same profile inside one rerun without weakening
# cross-rerun profile freshness.
_RUN_USER_PROFILE_CACHE: dict[int, dict[str, Any]] = {}
_RUN_DB_CONFIG: Any | None = None

_REQUIRED_RESTORE_TABLES = frozenset({
    "app_meta", "users", "user_credentials", "user_settings",
    "flights", "aircraft", "rates", "airports", "flight_tracks",
    "track_points", "audit_log", "user_expiries",
})


# -----------------------------------------------------------------------------
# Database
# -----------------------------------------------------------------------------

def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _set_meta(con: Any, key: str, value: Any) -> None:
    con.execute(
        """
        INSERT INTO app_meta (key, value, updated_at)
        VALUES (?, ?, ?)
        ON CONFLICT(key) DO UPDATE SET
            value = excluded.value,
            updated_at = excluded.updated_at
        """,
        (key, str(value), _now_iso()),
    )


def _meta_value(con: sqlite3.Connection, key: str, default: str = "") -> str:
    try:
        row = con.execute("SELECT value FROM app_meta WHERE key = ?", (key,)).fetchone()
        return str(row[0]) if row and row[0] is not None else default
    except DATABASE_ERRORS:
        return default


def _get_secret(section: str, key: str, default: Any = None) -> Any:
    try:
        sec = st.secrets.get(section, {})
        if hasattr(sec, "get"):
            return sec.get(key, default)
    except Exception:
        pass
    return default


def _database_secrets_mapping() -> dict[str, Any]:
    try:
        section = st.secrets.get("database", {})
        if hasattr(section, "items"):
            return {str(k): v for k, v in section.items()}
    except Exception:
        pass
    return {}


def runtime_database_config():
    global _RUN_DB_CONFIG
    if _RUN_DB_CONFIG is None:
        _RUN_DB_CONFIG = resolve_runtime_database_config(
            secrets_database=_database_secrets_mapping()
        )
    return _RUN_DB_CONFIG


def production_backend_name() -> str:
    try:
        return runtime_database_config().backend
    except Exception:
        return "configuration_error"


def production_is_postgresql() -> bool:
    return production_backend_name() == "postgresql"


def emergency_sqlite_fallback_active() -> bool:
    try:
        cfg = runtime_database_config()
        return bool(
            cfg.is_sqlite
            and cfg.cutover_confirmed
            and cfg.sqlite_fallback_confirmed
        )
    except Exception:
        return False


def is_admin() -> bool:
    """Return True when the authenticated profile has the persistent admin role."""
    if not is_user_authenticated():
        return False
    try:
        return str(current_user_profile().get("role") or "user").lower() == "admin"
    except Exception:
        return False


def _session_user_id() -> int:
    """Return a validated positive session user id, otherwise 0.

    An invalid or malformed authenticated session must never fall back to the
    legacy owner (user_id=1).
    """
    try:
        uid = int(st.session_state.get("current_user_id", 0) or 0)
    except (TypeError, ValueError):
        return 0
    return uid if uid > 0 else 0


def is_user_authenticated() -> bool:
    return bool(st.session_state.get("user_authenticated")) and _session_user_id() > 0


def _reset_session_state(*, notice: str | None = None) -> None:
    """Drop all per-browser user state so data cannot survive an account switch."""
    st.session_state.clear()
    if notice:
        st.session_state["auth_notice"] = str(notice)


def _set_authenticated_user(user_id: int) -> None:
    uid = strict_user_id(user_id)
    _reset_session_state()
    st.session_state["user_authenticated"] = True
    st.session_state["current_user_id"] = uid
    st.session_state["page"] = "Dashboard"


def logout_user() -> None:
    _reset_session_state()


def _login_rate_limit_remaining() -> int:
    try:
        until = float(st.session_state.get("auth_lock_until", 0.0) or 0.0)
    except (TypeError, ValueError):
        until = 0.0
    return max(0, int(math.ceil(until - time_module.time())))


def _register_login_failure() -> int:
    failures = int(st.session_state.get("auth_failures", 0) or 0) + 1
    st.session_state["auth_failures"] = failures
    if failures >= 5:
        delay = min(60, 5 * (2 ** min(failures - 5, 4)))
        st.session_state["auth_lock_until"] = time_module.time() + delay
        return int(delay)
    return 0


def actor_name() -> str:
    if is_user_authenticated():
        name = current_user_display_name()
        return f"{name} (admin)" if is_admin() else name
    return "anonymous"


def current_user_id() -> int:
    """Return the authenticated data owner. No authentication means no user data."""
    return _session_user_id() if is_user_authenticated() else 0


@st.cache_data(show_spinner=False, ttl=300)
def read_user_profile(user_id: int) -> dict[str, Any]:
    uid = strict_user_id(user_id)
    try:
        with read_connect() as con:
            row = con.execute(
                """
                SELECT u.id, u.email, u.display_name, u.slug, u.role, u.active, u.created_at, u.updated_at,
                       s.timezone, s.currency, s.home_airport, s.default_role, s.preferences_json
                FROM users u
                LEFT JOIN user_settings s ON s.user_id = u.id
                WHERE u.id = ?
                """,
                (uid,),
            ).fetchone()
            return dict(row) if row else {"id": uid, "display_name": "Local pilot"}
    except DATABASE_ERRORS:
        if production_is_postgresql():
            raise
        return {"id": uid, "display_name": "Local pilot", "active": 0, "_load_error": True}


_SESSION_HOT_PROFILE_PREFIX = "_hot_profile_v0731_"
_SESSION_HOT_FLIGHTS_PREFIX = "_hot_flights_v0731_"
_SESSION_HOT_COUNTS_PREFIX = "_hot_counts_v0731_"
_SESSION_HOT_TTL_SECONDS = 45.0


def _session_hot_key(prefix: str, user_id: int) -> str:
    return f"{prefix}{strict_user_id(user_id)}"


def _session_hot_get(key: str) -> Any:
    cached = st.session_state.get(key)
    try:
        cached_at = float(st.session_state.get(f"{key}__at", 0.0) or 0.0)
    except (TypeError, ValueError):
        cached_at = 0.0
    if cached is not None and cached_at > 0 and (time_module.monotonic() - cached_at) <= _SESSION_HOT_TTL_SECONDS:
        return cached
    st.session_state.pop(key, None)
    st.session_state.pop(f"{key}__at", None)
    return None


def _session_hot_set(key: str, value: Any) -> None:
    st.session_state[key] = value
    st.session_state[f"{key}__at"] = time_module.monotonic()


def _clear_session_hot_cache(kind: str | None = None, user_id: int | None = None) -> None:
    prefixes = {
        "profile": (_SESSION_HOT_PROFILE_PREFIX,),
        "flights": (_SESSION_HOT_FLIGHTS_PREFIX,),
        "counts": (_SESSION_HOT_COUNTS_PREFIX,),
        "all": (
            _SESSION_HOT_PROFILE_PREFIX,
            _SESSION_HOT_FLIGHTS_PREFIX,
            _SESSION_HOT_COUNTS_PREFIX,
        ),
    }
    selected = prefixes.get(str(kind or "all").lower(), prefixes["all"])
    suffix = None
    if user_id is not None:
        try:
            suffix = str(strict_user_id(user_id))
        except Exception:
            suffix = None
    for key in list(st.session_state.keys()):
        skey = str(key)
        if not any(skey.startswith(prefix) for prefix in selected):
            continue
        if suffix is not None and not skey.endswith(suffix):
            continue
        st.session_state.pop(key, None)


def current_user_profile(user_id: int | None = None) -> dict[str, Any]:
    """Return a session-hot profile snapshot and avoid a PostgreSQL read per rerun."""
    uid = strict_user_id(user_id if user_id is not None else current_user_id())
    session_key = _session_hot_key(_SESSION_HOT_PROFILE_PREFIX, uid)

    session_cached = _session_hot_get(session_key)
    if isinstance(session_cached, dict):
        return dict(session_cached)

    request_cached = _RUN_USER_PROFILE_CACHE.get(uid)
    if request_cached is None:
        request_cached = read_user_profile(uid)
        _RUN_USER_PROFILE_CACHE[uid] = request_cached

    snapshot = dict(request_cached)
    _session_hot_set(session_key, snapshot)
    return dict(snapshot)


def current_user_display_name() -> str:
    profile = current_user_profile()
    return normalize_text(profile.get("display_name")) or "Local pilot"


def _profile_preferences(profile: dict[str, Any] | None = None) -> dict[str, Any]:
    profile = profile or current_user_profile()
    raw = profile.get("preferences_json")
    if isinstance(raw, dict):
        return dict(raw)
    try:
        parsed = json.loads(str(raw or "{}"))
        return parsed if isinstance(parsed, dict) else {}
    except Exception:
        return {}


def current_user_currency() -> str:
    profile = current_user_profile()
    currency = str(profile.get("currency") or "CZK").strip().upper()
    return currency if currency in {"CZK", "EUR", "USD", "GBP"} else "CZK"


def currency_symbol(currency: str | None = None) -> str:
    code = str(currency or current_user_currency()).upper()
    return {"CZK": "Kč", "EUR": "€", "USD": "$", "GBP": "£"}.get(code, code)


def current_user_timezone() -> ZoneInfo:
    profile = current_user_profile()
    name = str(profile.get("timezone") or "Europe/Prague").strip()
    try:
        return ZoneInfo(name)
    except (ZoneInfoNotFoundError, ValueError):
        return LOCAL_TZ


def current_user_default_evidence() -> str:
    profile = current_user_profile()
    value = str(_profile_preferences(profile).get("default_evidence") or "ULL").upper().strip()
    return value if value in EVIDENCE_OPTIONS else "ULL"


def current_user_default_role() -> str:
    profile = current_user_profile()
    value = str(profile.get("default_role") or "PIC").upper().strip()
    return value if value in ROLE_OPTIONS else "PIC"


def current_user_home_airport() -> str:
    profile = current_user_profile()
    return str(profile.get("home_airport") or "").upper().strip()


def _render_database_runtime_error(context: str = "") -> None:
    """Show a controlled DB outage state without logging the user out or faking empty data."""
    backend = "PostgreSQL" if production_is_postgresql() else "SQLite"
    st.error(f"{backend} databáze momentálně neodpovídá.")
    if context:
        st.caption(context)
    st.caption(
        "Relace zůstává zachovaná. Zkus stránku znovu načíst; aplikace se automaticky "
        "nepřepíná na jinou databázi."
    )


def _auth_state() -> tuple[bool, dict[str, Any]]:
    """Return whether the legacy owner still needs activation and its profile."""
    with read_connect() as con:
        needs_activation = legacy_profile_needs_activation(con)
    return needs_activation, read_user_profile(DEFAULT_USER_ID)


def render_auth_gate() -> bool:
    """Render login/registration and stop all user-data UI until authenticated."""
    if is_user_authenticated():
        try:
            profile = current_user_profile()
            if int(profile.get("active", 1) or 0) == 1:
                return True
        except DATABASE_ERRORS:
            _render_database_runtime_error("Přihlášený profil se nepodařilo načíst.")
            return False
        except Exception:
            pass
        logout_user()

    apply_ui_theme(True)
    st.markdown(f"### Letový zápisník · {APP_VERSION}")
    st.title("Přihlášení")
    st.caption("Každý profil má vlastní lety, letadla, GPS tracky, ceník a vlastní letiště.")
    auth_notice = st.session_state.pop("auth_notice", None)
    if auth_notice:
        st.success(str(auth_notice))

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
            submitted = st.form_submit_button("Aktivovat můj stávající profil", width="stretch")
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
                    _set_meta(con, "last_change_at", _now_iso())
                    _set_meta(con, "dirty", "1")
                    con.commit()
            if result.ok and result.user_id:
                read_user_profile.clear()
                _clear_session_hot_cache("all")
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
            submitted = st.form_submit_button("Přihlásit se", width="stretch")
        if submitted:
            wait_seconds = _login_rate_limit_remaining()
            if wait_seconds > 0:
                st.error(f"Příliš mnoho neúspěšných pokusů. Zkus to znovu za {wait_seconds} s.")
                return False
            with connect() as con:
                result = authenticate_user(con, email, password)
                if result.ok:
                    con.commit()
            if result.ok and result.user_id:
                _set_authenticated_user(result.user_id)
                st.rerun()
            delay = _register_login_failure()
            if delay:
                st.error(f"Přihlášení se nepodařilo. Další pokus bude možný za {delay} s.")
            else:
                st.error(result.error or "Přihlášení se nepodařilo.")

    if allow_registration:
        with auth_tabs[1]:
            st.caption("Nový účet začne s prázdným letovým zápisníkem. E-mail zatím není ověřován.")
            with st.form("user_register_form"):
                display_name = st.text_input("Jméno", key="register_name")
                email = st.text_input("E-mail", key="register_email")
                password = st.text_input(f"Heslo (min. {PASSWORD_MIN_LENGTH} znaků)", type="password", key="register_password")
                password2 = st.text_input("Potvrzení hesla", type="password", key="register_password2")
                submitted = st.form_submit_button("Vytvořit účet", width="stretch")
            if submitted:
                if password != password2:
                    st.error("Hesla se neshodují.")
                    return False
                with connect() as con:
                    result = register_user(con, email=email, display_name=display_name, password=password)
                    if result.ok and result.user_id:
                        con.execute(
                            "INSERT INTO audit_log (user_id, created_at, actor, action, object_type, object_id, detail_json) VALUES (?, ?, ?, ?, ?, ?, ?)",
                            (
                                int(result.user_id),
                                _now_iso(),
                                str(display_name).strip(),
                                "register_user",
                                "user",
                                str(result.user_id),
                                json.dumps({"email": str(email).strip().lower()}, ensure_ascii=False),
                            ),
                        )
                        _set_meta(con, "last_change_at", _now_iso())
                        _set_meta(con, "dirty", "1")
                        con.commit()
                if result.ok and result.user_id:
                    read_user_profile.clear()
                    _clear_session_hot_cache("all")
                    _set_authenticated_user(result.user_id)
                    auto_backup_after_change("register_user")
                    st.rerun()
                st.error(result.error or "Účet se nepodařilo vytvořit.")
    else:
        st.caption("Registrace nových uživatelů je zatím vypnutá. Lze ji později povolit v Streamlit Secrets.")
    return False


def render_user_sidebar() -> None:
    profile = current_user_profile()
    st.divider()
    st.markdown(f"**👤 {html.escape(str(profile.get('display_name') or 'Pilot'))}**")
    if profile.get("email"):
        st.caption(str(profile.get("email")))
    if str(profile.get("role") or "user").lower() == "admin":
        st.caption("Správce aplikace")
    if st.button("Odhlásit se", width="stretch", key="user_logout"):
        logout_user()
        st.rerun()


def _clear_cached_function(name: str, *args: Any, **kwargs: Any) -> None:
    """Clear one Streamlit cached function, optionally only for one cache key."""
    try:
        fn = globals().get(name)
        clear = getattr(fn, "clear", None)
        if not callable(clear):
            return
        if args or kwargs:
            try:
                clear(*args, **kwargs)
                return
            except TypeError:
                # Older/future Streamlit cache wrappers may not support key-level
                # clearing. Falling back to a function clear is safe.
                pass
        clear()
    except Exception:
        pass


def invalidate_cached_data(scope: str = "all", user_id: int | None = None) -> None:
    """Invalidate the smallest practical cache surface after a committed write.

    Per-user cache keys are cleared where Streamlit supports it. Cache functions
    whose arguments contain arbitrary ID tuples are cleared as a whole because
    enumerating every possible key would be less reliable than recomputation.
    """
    scope = str(scope or "all").lower()

    # Prepared downloadable snapshots/backups and manual Data Quality scans must
    # never survive a data mutation with stale content. Meta-only backup status
    # writes are excluded because they do not change portable user data.
    data_scopes = {
        "all", "database", "restore", "flights", "flight", "flight_tracks",
        "track_points", "tracks", "track", "rates", "rate", "aircraft",
        "airports", "airport", "user_expiries", "expiry", "expiries",
        "profile", "user",
    }
    if scope in data_scopes:
        _clear_cached_function("read_admin_user_overview")
        for key in (
            "portable_backup_bytes_v064", "portable_backup_name_v064",
            "admin_sqlite_snapshot_v069",
        ):
            st.session_state.pop(key, None)
        try:
            uid_for_state = strict_user_id(user_id if user_id is not None else current_user_id())
            st.session_state.pop(f"data_quality_scan_v068_u{uid_for_state}", None)
        except Exception:
            pass

    if scope in {"all", "database", "restore"}:
        _clear_session_hot_cache("all")
        _RUN_USER_PROFILE_CACHE.clear()
        try:
            st.cache_data.clear()
        except Exception:
            pass
        _clear_cached_function("airport_search_index")
        return

    try:
        uid = strict_user_id(user_id if user_id is not None else current_user_id())
    except Exception:
        uid = 0

    if scope in {"flights", "flight"}:
        if uid:
            _clear_session_hot_cache("flights", uid)
            _clear_session_hot_cache("counts", uid)
            _clear_cached_function("read_table", "flights", uid)
            _clear_cached_function("read_flights", uid)
            _clear_cached_function("read_aircraft_usage_summary", uid)
            _clear_cached_function("read_aircraft_database_bundle", uid)
            _clear_cached_function("read_logbook_counts", uid)
        _clear_cached_function("read_track_metadata_for_flights")
        _clear_cached_function("read_track_map_records_for_flights")
        _clear_cached_function("build_database_health_report")
    elif scope in {"flight_tracks", "track_points", "tracks", "track"}:
        if uid:
            _clear_session_hot_cache("flights", uid)
            _clear_session_hot_cache("counts", uid)
            _clear_cached_function("read_table", "flight_tracks", uid)
            _clear_cached_function("read_table", "track_points", uid)
            _clear_cached_function("read_flights", uid)
            _clear_cached_function("read_logbook_counts", uid)
        for name in (
            "read_track_metadata_for_flights", "read_sampled_track_points",
            "read_track_geometry_payloads", "read_track_map_records_for_flights",
            "read_tracks_for_flight",
            "build_database_health_report",
        ):
            _clear_cached_function(name)
    elif scope in {"rates", "rate"}:
        if uid:
            _clear_cached_function("read_table", "rates", uid)
            _clear_cached_function("read_rates", uid)
            _clear_cached_function("read_aircraft_database_bundle", uid)
    elif scope == "aircraft":
        if uid:
            _clear_session_hot_cache("counts", uid)
            _clear_cached_function("read_table", "aircraft", uid)
            _clear_cached_function("read_aircraft_catalog", True, uid)
            _clear_cached_function("read_aircraft_catalog", False, uid)
            _clear_cached_function("read_aircraft_database_bundle", uid)
            _clear_cached_function("read_logbook_counts", uid)
    elif scope in {"airports", "airport"}:
        if uid:
            _clear_cached_function("read_table", "airports", uid)
            _clear_cached_function("read_airports", True, uid)
            _clear_cached_function("read_airports", False, uid)
            _clear_cached_function("read_airport_registry_count", uid)
            _clear_cached_function("airport_search_index", uid)
        _clear_cached_function("airport_coords_for_idents")
        _clear_cached_function("build_database_health_report")
    elif scope in {"user_expiries", "expiry", "expiries"}:
        if uid:
            _clear_cached_function("read_table", "user_expiries", uid)
    elif scope in {"profile", "user"}:
        if uid:
            _clear_session_hot_cache("profile", uid)
            _clear_session_hot_cache("flights", uid)
            _RUN_USER_PROFILE_CACHE.pop(uid, None)
            _clear_cached_function("read_user_profile", uid)
    elif scope in {"app_meta", "meta"}:
        _clear_cached_function("read_table", "app_meta")
    else:
        _clear_cached_function("build_database_health_report")


def require_admin() -> bool:
    if is_admin():
        return True
    st.warning("Tato akce je dostupná jen po přihlášení jako admin.")
    return False


def record_audit(con: Any, action: str, object_type: str | None = None, object_id: Any = None, detail: Any = None) -> None:
    payload = json.dumps(detail, ensure_ascii=False, default=str) if detail is not None else None
    params = (current_user_id(), _now_iso(), actor_name(), action, object_type, str(object_id) if object_id is not None else None, payload)

    if is_postgres_connection(con):
        # In PostgreSQL production the audit row and watermark are part of the
        # same transaction as the business write. Failure must abort the action;
        # silently continuing would weaken cutover recovery/audit semantics.
        con.execute(
            "INSERT INTO audit_log (user_id, created_at, actor, action, object_type, object_id, detail_json) VALUES (?, ?, ?, ?, ?, ?, ?)",
            params,
        )
        _set_meta(con, "last_change_at", _now_iso())
        _set_meta(con, "dirty", "1")
        return

    try:
        con.execute(
            "INSERT INTO audit_log (user_id, created_at, actor, action, object_type, object_id, detail_json) VALUES (?, ?, ?, ?, ?, ?, ?)",
            params,
        )
    except DATABASE_ERRORS:
        try:
            ensure_schema_compatibility(con)
            con.execute(
                "INSERT INTO audit_log (user_id, created_at, actor, action, object_type, object_id, detail_json) VALUES (?, ?, ?, ?, ?, ?, ?)",
                params,
            )
        except Exception:
            # Legacy SQLite audit logging must not block a historical file
            # migration/repair action.
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
    # GitHub stores the legacy SQLite file only. Once PostgreSQL is production,
    # continuing this flow would create a misleading "fresh" backup of a frozen
    # fallback database.
    if production_is_postgresql():
        return False
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
    except DATABASE_ERRORS:
        try:
            if not is_postgres_connection(con):
                ensure_schema_compatibility(con)
                con.execute(
                    "INSERT INTO audit_log (user_id, created_at, actor, action, object_type, object_id, detail_json) VALUES (?, ?, ?, ?, ?, ?, ?)",
                    params,
                )
        except Exception:
            pass


def checkpoint_database(*, truncate: bool = False, require_clean: bool = False) -> None:
    mode = "TRUNCATE" if truncate else "PASSIVE"
    with sqlite3.connect(DB_PATH, timeout=10.0) as con:
        apply_sqlite_pragmas(con, initial=False)
        try:
            row = con.execute(f"PRAGMA wal_checkpoint({mode})").fetchone()
        except DATABASE_ERRORS as exc:
            if require_clean:
                raise RuntimeError(f"SQLite WAL checkpoint selhal: {exc}") from exc
            return
        if require_clean and row and int(row[0] or 0) != 0:
            raise RuntimeError("Databáze je právě používána jinou operací. Obnovu zkus znovu za chvíli.")


def database_snapshot_bytes() -> bytes:
    """Consistent single-file snapshot including committed WAL content."""
    return snapshot_sqlite_bytes(DB_PATH)


def _backup_database_to_github_unlocked(commit_message: str | None = None) -> str:
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
        snapshot_bytes = database_snapshot_bytes()
        sha = None
        get_resp = requests.get(api_url, headers=headers, params={"ref": branch}, timeout=30)
        if get_resp.status_code == 200:
            sha = get_resp.json().get("sha")
        elif get_resp.status_code not in (404,):
            raise RuntimeError(f"GitHub GET selhal: {get_resp.status_code} {get_resp.text[:300]}")
        content_b64 = base64.b64encode(snapshot_bytes).decode("ascii")
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



def backup_database_to_github(commit_message: str | None = None) -> str:
    """Serialize legacy SQLite GitHub backups.

    This operation is intentionally unavailable while PostgreSQL is production;
    otherwise the remote SQLite file could be mistaken for a current backup.
    """
    if production_is_postgresql():
        raise RuntimeError(
            "GitHub SQLite backup je po PostgreSQL cutoveru zmrazený fallback, ne produkční záloha."
        )
    with _GITHUB_BACKUP_LOCK:
        return _backup_database_to_github_unlocked(commit_message)

def auto_backup_after_change(reason: str) -> None:
    """Persist SQLite writes to GitHub only while SQLite is production."""
    if production_is_postgresql():
        st.session_state["last_auto_backup_status"] = "postgresql_production"
        st.session_state.pop("last_auto_backup_error", None)
        st.session_state.pop("last_auto_backup_url", None)
        return
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



def restore_database_from_upload(uploaded_file) -> dict[str, Any]:
    if production_is_postgresql():
        raise SQLiteRestoreError(
            "Plná SQLite obnova je během PostgreSQL produkce zablokovaná. "
            "SQLite soubor je pouze nouzový fallback baseline."
        )
    raw = uploaded_file.read()
    info = inspect_sqlite_bytes(
        raw,
        required_tables=_REQUIRED_RESTORE_TABLES,
        max_schema_version=DB_SCHEMA_VERSION,
        max_bytes=MAX_ADMIN_RESTORE_BYTES,
    )

    # Keep a verified consistent snapshot of the current database before the
    # atomic replacement. It is deliberately outside the uploaded database.
    backup_path = DB_PATH.with_suffix('.sqlite.before_restore')
    if DB_PATH.exists():
        backup_path.write_bytes(database_snapshot_bytes())

    checkpoint_database(truncate=True, require_clean=True)
    atomic_replace_sqlite(DB_PATH, raw)
    global _DB_READY
    _DB_READY = False
    with connect() as con:
        # The restored DB may be an older supported schema; connect() performs
        # the normal migration before the audit row is written.
        record_audit(
            con,
            'restore_database',
            'database',
            None,
            {'file': uploaded_file.name, 'source_schema': info.get('schema_version')},
        )
        con.commit()
    invalidate_cached_data('restore')
    return info


def initialize_database(con: sqlite3.Connection) -> None:
    """Fast, idempotent database bootstrap.

    Schema creation stays defensive, but expensive data migrations are guarded by
    persistent markers so they run once per database instead of on every cold
    Streamlit process start.
    """
    apply_sqlite_pragmas(con, initial=True)
    con.executescript(SCHEMA)
    tenancy_ready_before = _meta_value(con, "tenancy_v1", "0") == "1"
    # Current databases already carry tenancy_v1, so the second full DDL pass is
    # unnecessary on normal cold starts. It is retained only for a fresh/legacy
    # migration because that migration can rebuild tables and needs indexes
    # restored afterward.
    ensure_schema_compatibility(con)
    ensure_tenancy_schema(con)
    ensure_auth_schema(con)
    if not tenancy_ready_before:
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


def _connect_sqlite_runtime() -> sqlite3.Connection:
    global _DB_READY, _DB_READY_BACKEND
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    con = sqlite3.connect(DB_PATH, timeout=10.0)
    con.row_factory = sqlite3.Row
    try:
        if _DB_READY and _DB_READY_BACKEND == "sqlite":
            apply_sqlite_pragmas(con, initial=False)
            return con
        with _DB_INIT_LOCK:
            if not _DB_READY or _DB_READY_BACKEND != "sqlite":
                initialize_database(con)
                _DB_READY = True
                _DB_READY_BACKEND = "sqlite"
            else:
                apply_sqlite_pragmas(con, initial=False)
        return con
    except Exception:
        con.close()
        raise


def _connect_postgres_runtime(config, *, read_only: bool = False) -> PostgresConnectionAdapter:
    global _DB_READY, _DB_READY_BACKEND
    if not _DB_READY or _DB_READY_BACKEND != "postgresql":
        with _DB_INIT_LOCK:
            if not _DB_READY or _DB_READY_BACKEND != "postgresql":
                # First production activation is fail-closed. The PostgreSQL
                # target must have a deep-verified cutover readiness marker and
                # still match the frozen SQLite source watermark.
                activate_postgres_production(config.postgres, sqlite_path=DB_PATH)
                _DB_READY = True
                _DB_READY_BACKEND = "postgresql"
    return PostgresConnectionAdapter(config.postgres, read_only=read_only)


def connect() -> Any:
    """Open the explicitly configured transactional production database.

    There is intentionally no automatic PostgreSQL→SQLite fallback. If
    PostgreSQL is selected and unavailable, the request fails rather than
    writing into a stale local SQLite copy.
    """
    config = runtime_database_config()
    if config.is_postgresql:
        return _connect_postgres_runtime(config, read_only=False)
    return _connect_sqlite_runtime()


def read_connect() -> Any:
    """Open a production connection optimized for pure reads.

    PostgreSQL uses a temporary autocommit checkout so cached SELECT helpers pay
    one SQL network round-trip instead of SELECT + transaction cleanup. SQLite
    retains the normal initialized connection path for emergency fallback.
    """
    config = runtime_database_config()
    if config.is_postgresql:
        return _connect_postgres_runtime(config, read_only=True)
    return _connect_sqlite_runtime()


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
    except DATABASE_ERRORS:
        return
    for tr in tracks:
        try:
            points = json.loads(tr["coordinates_json"] or "[]")
        except Exception:
            points = []
        insert_track_points(con, int(tr["id"]), points, user_id=DEFAULT_USER_ID)
    _set_meta(con, "track_points_backfill_v1", "1")


_READABLE_TABLES = frozenset(USER_SCOPED_TABLES) | {"app_meta"}


def _validated_read_table(table: str) -> str:
    name = str(table or "").strip()
    if name not in _READABLE_TABLES:
        raise ValueError(f"Unsupported table read: {name!r}")
    return name


@st.cache_data(show_spinner=False, ttl=300)
def read_table(table: str, user_id: int | None = None) -> pd.DataFrame:
    table = _validated_read_table(table)
    with read_connect() as con:
        if table in USER_SCOPED_TABLES:
            return db_read_sql_query(f"SELECT * FROM {table} WHERE user_id = ?", con, params=(strict_user_id(user_id),))
        return db_read_sql_query(f"SELECT * FROM {table}", con)


def read_app_meta() -> pd.DataFrame:
    """Read tiny global metadata uncached; backup freshness must be cross-session."""
    try:
        with read_connect() as con:
            return db_read_sql_query("SELECT * FROM app_meta ORDER BY key", con)
    except DATABASE_ERRORS:
        if production_is_postgresql():
            raise
        return pd.DataFrame()


EXPIRY_CATEGORIES = ["Medical", "Licence", "Rating", "Průkaz", "Pojištění", "Jiné"]


def save_user_expiry(
    *,
    label: str,
    category: str,
    expiry_date: date,
    warning_days: int = 30,
    note: str = "",
    expiry_id: int | None = None,
) -> int:
    uid = strict_user_id(current_user_id())
    clean_label = str(label or "").strip()
    if not clean_label:
        raise ValueError("Název dokladu nebo platnosti nesmí být prázdný.")
    clean_category = str(category or "Doklad").strip() or "Doklad"
    clean_warning = max(0, min(int(warning_days or 0), 3650))
    clean_note = str(note or "").strip()
    expiry_iso = pd.Timestamp(expiry_date).date().isoformat()

    with connect() as con:
        if expiry_id is None:
            saved_id = insert_and_get_id(
                con,
                """
                INSERT INTO user_expiries
                    (user_id, category, label, expiry_date, warning_days, note, active, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                """,
                (uid, clean_category, clean_label, expiry_iso, clean_warning, clean_note or None),
            )
            action = "create_user_expiry"
        else:
            saved_id = int(expiry_id)
            require_owned_record(con, "user_expiries", saved_id, uid)
            con.execute(
                """
                UPDATE user_expiries
                SET category = ?, label = ?, expiry_date = ?, warning_days = ?, note = ?,
                    active = 1, updated_at = CURRENT_TIMESTAMP
                WHERE id = ? AND user_id = ?
                """,
                (clean_category, clean_label, expiry_iso, clean_warning, clean_note or None, saved_id, uid),
            )
            action = "update_user_expiry"
        record_audit(
            con, action, "user_expiry", saved_id,
            {"label": clean_label, "category": clean_category, "expiry_date": expiry_iso, "warning_days": clean_warning},
        )
        con.commit()
    invalidate_cached_data("user_expiries")
    auto_backup_after_change(action)
    return saved_id


def delete_user_expiry(expiry_id: int) -> None:
    uid = strict_user_id(current_user_id())
    rid = int(expiry_id)
    with connect() as con:
        require_owned_record(con, "user_expiries", rid, uid)
        row = con.execute("SELECT label FROM user_expiries WHERE id = ? AND user_id = ?", (rid, uid)).fetchone()
        con.execute("DELETE FROM user_expiries WHERE id = ? AND user_id = ?", (rid, uid))
        record_audit(con, "delete_user_expiry", "user_expiry", rid, {"label": str(row[0]) if row else ""})
        con.commit()
    invalidate_cached_data("user_expiries")
    auto_backup_after_change("delete_user_expiry")


@st.cache_data(show_spinner=False, ttl=300)
def read_rates(user_id: int) -> pd.DataFrame:
    rates = read_table("rates", user_id)
    if not rates.empty and "registration" in rates.columns:
        rates = rates.copy()
        rates["registration"] = rates["registration"].fillna("").astype(str).str.upper()
    return rates

@st.cache_data(show_spinner=False, ttl=300)
def read_logbook_counts(user_id: int) -> dict[str, int]:
    """Database header counters in one PostgreSQL/SQLite SQL round-trip."""
    try:
        with read_connect() as con:
            uid = strict_user_id(user_id)
            row = con.execute(
                """
                SELECT
                    (SELECT COUNT(*) FROM flights WHERE user_id = ?) AS flights,
                    (SELECT COUNT(*) FROM aircraft WHERE user_id = ?) AS aircraft,
                    (SELECT COUNT(*) FROM flight_tracks WHERE user_id = ?) AS tracks,
                    (SELECT COUNT(*) FROM track_points WHERE user_id = ?) AS points
                """,
                (uid, uid, uid, uid),
            ).fetchone()
            return {
                "flights": int(row["flights"] if row else 0),
                "aircraft": int(row["aircraft"] if row else 0),
                "tracks": int(row["tracks"] if row else 0),
                "points": int(row["points"] if row else 0),
            }
    except DATABASE_ERRORS:
        if production_is_postgresql():
            raise
        return {"flights": 0, "aircraft": 0, "tracks": 0, "points": 0}


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
                INSERT INTO airports (user_id, ident, name, airport_type, iso_country, iso_region, municipality,
                    latitude_deg, longitude_deg, elevation_ft, gps_code, iata_code, local_code,
                    source, active, closed, data_quality, imported_at, updated_at, raw_json)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(user_id, ident) DO NOTHING
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
                frames.append(db_read_sql_query(query, airport_con))
        except Exception:
            pass

    try:
        with read_connect() as con:
            frames.append(db_read_sql_query(local_query, con, params=(strict_user_id(user_id),)))
    except DATABASE_ERRORS:
        if production_is_postgresql():
            raise

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
        with read_connect() as con:
            local_idents = [
                str(r[0]).upper().strip()
                for r in con.execute("SELECT ident FROM airports WHERE user_id = ? AND ident IS NOT NULL AND TRIM(ident) <> ''", (strict_user_id(user_id),)).fetchall()
            ]
    except DATABASE_ERRORS:
        if production_is_postgresql():
            raise
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
                f"SELECT COUNT(*) FROM airports WHERE ident IN ({placeholders})",
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
        WHERE ident IN ({placeholders})
          AND latitude_deg IS NOT NULL AND longitude_deg IS NOT NULL
    """
    frames: list[pd.DataFrame] = []
    if AIRPORTS_DB_PATH.exists():
        try:
            with connect_airports_ro() as airport_con:
                frames.append(db_read_sql_query(query, airport_con, params=clean))
        except Exception:
            pass
    try:
        with read_connect() as con:
            local_query = query.replace("WHERE ident IN", "WHERE user_id = ? AND ident IN")
            frames.append(db_read_sql_query(local_query, con, params=(strict_user_id(user_id), *clean)))
    except DATABASE_ERRORS:
        if production_is_postgresql():
            raise
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
                frames.append(db_read_sql_query(query, airport_con))
        except Exception:
            pass
    try:
        with read_connect() as con:
            local_query = query.replace("WHERE active = 1", "WHERE user_id = ? AND active = 1")
            frames.append(db_read_sql_query(local_query, con, params=(strict_user_id(user_id),)))
    except DATABASE_ERRORS:
        if production_is_postgresql():
            raise
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






def insert_track_points(con: Any, track_id: int, points: list[dict[str, Any]], user_id: int) -> None:
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
        INSERT INTO track_points
        (user_id, track_id, seq, time_utc, latitude_deg, longitude_deg, altitude_m,
         segment_km, distance_km, speed_kmh, speed_kt, source)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(track_id, seq) DO UPDATE SET
            user_id = excluded.user_id,
            time_utc = excluded.time_utc,
            latitude_deg = excluded.latitude_deg,
            longitude_deg = excluded.longitude_deg,
            altitude_m = excluded.altitude_m,
            segment_km = excluded.segment_km,
            distance_km = excluded.distance_km,
            speed_kmh = excluded.speed_kmh,
            speed_kt = excluded.speed_kt,
            source = excluded.source
        """,
        rows,
    )

@st.cache_data(show_spinner=False, ttl=300)
def read_flights(user_id: int) -> pd.DataFrame:
    """Read flight rows and GPS aggregates in one production-database round-trip."""
    with read_connect() as con:
        flights = db_read_sql_query(
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


def session_read_flights(user_id: int) -> pd.DataFrame:
    """Keep the current user's computed flight table hot across Streamlit reruns."""
    uid = strict_user_id(user_id)
    key = _session_hot_key(_SESSION_HOT_FLIGHTS_PREFIX, uid)
    cached = _session_hot_get(key)
    if isinstance(cached, pd.DataFrame):
        return cached.copy(deep=True)

    flights = read_flights(uid)
    _session_hot_set(key, flights.copy(deep=True))
    return flights.copy(deep=True)


def session_read_logbook_counts(user_id: int) -> dict[str, int]:
    uid = strict_user_id(user_id)
    key = _session_hot_key(_SESSION_HOT_COUNTS_PREFIX, uid)
    cached = _session_hot_get(key)
    if isinstance(cached, dict):
        return dict(cached)
    counts = read_logbook_counts(uid)
    _session_hot_set(key, dict(counts))
    return dict(counts)


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
    with read_connect() as con:
        return db_read_sql_query(query, con, params=(strict_user_id(user_id), *ids))


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


@st.cache_data(show_spinner=False, ttl=600)
def read_track_geometry_payloads(track_ids: tuple[int, ...], user_id: int) -> dict[int, str]:
    """Read stored geometry only for tracks selected for the overview map.

    v0.73.1 telemetry showed the PostgreSQL window query over track_points at
    ~723 ms. flight_tracks already stores canonical coordinates_json, so the
    overview can fetch a small number of indexed rows and simplify locally.
    """
    ids = tuple(sorted({int(x) for x in track_ids if x is not None}))
    if not ids:
        return {}
    placeholders = ",".join("?" for _ in ids)
    with read_connect() as con:
        rows = con.execute(
            f"""
            SELECT id, coordinates_json
            FROM flight_tracks
            WHERE user_id = ? AND id IN ({placeholders})
            ORDER BY id
            """,
            (strict_user_id(user_id), *ids),
        ).fetchall()
    return {
        int(row["id"]): str(row["coordinates_json"] or "[]")
        for row in rows
    }


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
           OR (
               (rn - 1) % (
                   CASE
                       WHEN CAST((n + ? - 1) / ? AS INTEGER) < 1 THEN 1
                       ELSE CAST((n + ? - 1) / ? AS INTEGER)
                   END
               ) = 0
           )
        ORDER BY track_id, seq
    """
    with read_connect() as con:
        return db_read_sql_query(
            query,
            con,
            params=(
                strict_user_id(user_id),
                *ids,
                max_points, max_points,
                max_points, max_points,
            ),
        )


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
    """Return lightweight track records ready for the GPS overview map.

    The overview deliberately avoids track_points. Only the selected
    flight_tracks.coordinates_json payloads cross the network and geometric
    simplification runs locally in Python.
    """
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
        selected = selected.sort_values(
            sort_cols,
            ascending=[False] * len(sort_cols),
            na_position="last",
        )

    raw_geometry = read_track_geometry_payloads(track_ids, user_id)
    coord_map = {
        int(track_id): _decode_points_for_map(
            payload,
            max_points=plan.points_per_track,
        )
        for track_id, payload in raw_geometry.items()
    }

    selected["coordinates_json"] = (
        selected["id"].astype(int).map(coord_map).fillna("[]")
    )
    selected = selected[
        selected["coordinates_json"].astype(str).str.len() > 2
    ]
    return selected.reset_index(drop=True)


@st.cache_data(show_spinner=False, ttl=300)
def read_tracks_for_flight(flight_id: int, user_id: int) -> pd.DataFrame:
    with read_connect() as con:
        return db_read_sql_query("SELECT * FROM flight_tracks WHERE user_id = ? AND flight_id = ? ORDER BY id", con, params=(strict_user_id(user_id), flight_id))


def _columns_for_table(con: sqlite3.Connection, table: str) -> set[str]:
    try:
        return {row[1] for row in con.execute(f"PRAGMA table_info({table})").fetchall()}
    except DATABASE_ERRORS:
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
    except DATABASE_ERRORS:
        pass
    try:
        _add_column_if_missing(con, "flight_tracks", "min_alt_m", "min_alt_m REAL")
        _add_column_if_missing(con, "flight_tracks", "max_alt_m", "max_alt_m REAL")
        _add_column_if_missing(con, "flights", "note", "note TEXT")
        _add_column_if_missing(con, "flights", "billing_basis", "billing_basis TEXT DEFAULT 'BLOCK'")
        _add_column_if_missing(con, "aircraft", "default_role", "default_role TEXT DEFAULT 'PIC'")
        _add_column_if_missing(con, "aircraft", "billing_basis", "billing_basis TEXT DEFAULT 'BLOCK'")
    except DATABASE_ERRORS:
        pass



# -----------------------------------------------------------------------------
# UI
# -----------------------------------------------------------------------------



def _set_page_callback(page_name: str) -> None:
    st.session_state["page"] = page_name


def render_nav_button(page_name: str, label: str, key: str) -> None:
    current = st.session_state.get("page", "Dashboard") == page_name
    st.button(
        label,
        key=key,
        width="stretch",
        type="primary" if current else "secondary",
        on_click=_set_page_callback,
        args=(page_name,),
    )


def render_sidebar_nav() -> None:
    st.markdown("### Navigace")
    for page_name, label in NAV_ITEMS:
        render_nav_button(page_name, label, f"side_nav_{page_name}")
    if is_admin():
        render_nav_button("Admin", "Admin", "side_nav_Admin")




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
        track_id = insert_and_get_id(
            con,
            """
            INSERT INTO flight_tracks (user_id, flight_id, file_name, imported_at, point_count, distance_km, start_utc, end_utc, min_alt_m, max_alt_m, coordinates_json)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (uid, flight_id, file_name, _now_iso(), stats["point_count"], stats["distance_km"], stats["start_utc"], stats["end_utc"], stats["min_alt_m"], stats["max_alt_m"], json.dumps(points, ensure_ascii=False)),
        )
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
        flight_id = insert_and_get_id(
            con,
            """
            INSERT INTO flights (user_id, date, evidence, registration, aircraft_type, aircraft_class, departure, arrival, off_block, takeoff, landing, on_block, starts, commander, instructor, role, task, price_per_hour, billing_basis, note)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            [uid, *values],
        )
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
        if not is_postgres_connection(con):
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
        st.iframe(html, height=height)
    except Exception:
        try:
            st_folium(m, height=height, width=None, key=key, returned_objects=[])
        except TypeError:
            st_folium(m, height=height, width=None, key=key)


def render_folium_navigable(m: folium.Map, *, height: int = 680, key: str | None = None) -> Any:
    from streamlit_folium import st_folium
    try:
        return st_folium(
            m,
            height=height,
            width=None,
            key=key,
            returned_objects=["last_object_clicked", "last_object_clicked_tooltip", "last_object_clicked_popup"],
        )
    except TypeError:
        return st_folium(m, height=height, width=None, key=key)


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
    records = json.loads(records_json) if records_json and records_json != "[]" else []
    df = pd.DataFrame.from_records(records) if records else pd.DataFrame()
    if df.empty:
        return ""
    m = make_map(df, dark_mode=dark_mode, line_weight=2, line_opacity=0.46, show_endpoints=False, extend_to_airports=True)
    return m.get_root().render()


def render_map_html(html: str, *, height: int = 680) -> None:
    if not html:
        st.info("Mapa nemá data k zobrazení.")
        return
    st.iframe(html, height=height)


def render_lazy_table(title: str, data: pd.DataFrame, *, height: int = 360, expanded: bool = False) -> None:
    """Keep heavy tables out of the main render path unless the user needs them."""
    with st.expander(title, expanded=expanded):
        if data.empty:
            st.info("Tabulka je prázdná.")
        else:
            st.dataframe(data, hide_index=True, width="stretch", height=height)


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
    st.plotly_chart(plotly_layout(fig), width="stretch")

















def _track_player_html(
    points_data: list[dict[str, Any]],
    default_idx: int,
    dark_mode: bool,
    original_count: int,
) -> str:
    points_json = json.dumps(points_data, ensure_ascii=False, separators=(",", ":"))
    tile_url = (
        "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        if dark_mode
        else "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
    )
    tile_attrib = (
        "&copy; OpenStreetMap &copy; CARTO"
        if dark_mode
        else "&copy; OpenStreetMap contributors"
    )
    replacements = {
        "__DATA__": html.escape(points_json, quote=False),
        "__DEFAULT__": str(int(default_idx)),
        "__ORIGINAL_COUNT__": str(int(original_count)),
        "__TILE_URL__": json.dumps(tile_url),
        "__TILE_ATTRIB__": json.dumps(tile_attrib),
        "__BG__": "#07111f" if dark_mode else "#ffffff",
        "__PANEL_BG__": "rgba(7,17,31,.94)" if dark_mode else "rgba(255,255,255,.97)",
        "__FG__": "#e5edf7" if dark_mode else "#0f172a",
        "__MUTED__": "#8aa4bd" if dark_mode else "#475569",
        "__BORDER__": "rgba(56,189,248,.24)" if dark_mode else "rgba(14,165,233,.24)",
        "__METRIC_BG__": "rgba(15,23,42,.46)" if dark_mode else "rgba(241,245,249,.82)",
        "__CHART_BG__": "rgba(2,8,23,.44)" if dark_mode else "rgba(248,250,252,.96)",
    }

    template = r"""
<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>
  * { box-sizing:border-box; }
  html, body {
    margin:0; padding:0; background:__BG__; color:__FG__;
    font-family:Inter,Segoe UI,Arial,sans-serif;
  }
  .track-player {
    border:1px solid __BORDER__; border-radius:17px; overflow:hidden;
    background:__PANEL_BG__; box-shadow:0 18px 44px rgba(0,0,0,.22);
  }
  .map-wrap { position:relative; }
  #map { height:390px; width:100%; background:#0b1220; }
  .map-badge {
    position:absolute; z-index:500; left:12px; top:12px;
    display:inline-flex; align-items:center; gap:6px;
    border:1px solid __BORDER__; border-radius:999px;
    padding:6px 9px; background:__PANEL_BG__; color:__MUTED__;
    font-size:11px; font-weight:750; backdrop-filter:blur(10px);
    pointer-events:none;
  }
  .map-badge-dot {
    width:7px; height:7px; border-radius:50%; background:#38bdf8;
    box-shadow:0 0 10px rgba(56,189,248,.65);
  }
  .hud {
    display:grid; grid-template-columns:repeat(4,minmax(0,1fr));
    gap:9px; padding:11px 13px 7px 13px;
  }
  .metric {
    border:1px solid __BORDER__; border-radius:13px; padding:9px 11px;
    background:__METRIC_BG__; min-width:0;
  }
  .label {
    color:__MUTED__; font-size:10px; letter-spacing:.085em;
    text-transform:uppercase; white-space:nowrap; overflow:hidden;
    text-overflow:ellipsis;
  }
  .value {
    color:__FG__; font-size:20px; line-height:1.1; font-weight:780;
    margin-top:4px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
    font-variant-numeric:tabular-nums;
  }
  .subvalue {
    color:__MUTED__; font-size:10px; margin-top:2px; min-height:11px;
    font-variant-numeric:tabular-nums;
  }
  .chart-wrap { padding:7px 13px 0 13px; }
  #profile {
    width:100%; height:190px; display:block; border:1px solid __BORDER__;
    border-radius:14px; background:__CHART_BG__; touch-action:none;
    cursor:ew-resize; user-select:none;
  }
  .controls {
    display:grid; grid-template-columns:48px minmax(0,1fr) 48px;
    gap:9px; align-items:center; padding:11px 13px 7px 13px;
  }
  .btn {
    height:39px; border:1px solid rgba(56,189,248,.34); border-radius:11px;
    background:#0ea5e9; color:white; font-weight:820; cursor:pointer;
    transition:background 120ms ease,border-color 120ms ease,transform 120ms ease;
  }
  .btn:hover { transform:translateY(-1px); }
  .btn.secondary { background:__METRIC_BG__; color:__FG__; }
  .btn.active {
    border-color:rgba(34,197,94,.62);
    background:rgba(34,197,94,.14); color:#86efac;
  }
  #idx { width:100%; accent-color:#38bdf8; cursor:pointer; }
  .timeline-labels {
    display:grid; grid-template-columns:1fr auto 1fr; gap:8px;
    padding:0 13px 8px 13px; color:__MUTED__; font-size:10px;
    font-variant-numeric:tabular-nums;
  }
  .timeline-labels span:nth-child(2) { color:__FG__; font-weight:720; text-align:center; }
  .timeline-labels span:last-child { text-align:right; }
  .tools {
    display:flex; align-items:center; justify-content:space-between; gap:8px;
    padding:0 13px 10px 13px;
  }
  .tools-left,.tools-right { display:flex; align-items:center; gap:7px; flex-wrap:wrap; }
  .tool-btn {
    min-height:32px; border:1px solid __BORDER__; border-radius:10px;
    background:__METRIC_BG__; color:__FG__; font-size:11px; font-weight:760;
    padding:5px 9px; cursor:pointer;
  }
  .tool-btn.active {
    border-color:rgba(34,197,94,.58); color:#86efac;
    background:rgba(34,197,94,.12);
  }
  .source-note {
    color:__MUTED__; font-size:10.5px; line-height:1.35;
    padding:0 13px 11px 13px;
  }
  .plane-wrap {
    width:34px; height:34px; display:flex; align-items:center; justify-content:center;
    filter:drop-shadow(0 0 7px rgba(0,0,0,.82));
  }
  .plane-svg {
    width:30px; height:30px; transform-origin:50% 50%;
    will-change:transform;
  }
  .leaflet-control-attribution {
    font-size:10px; background:rgba(0,0,0,.36) !important;
    color:#b8c7d8 !important;
  }
  .leaflet-control-attribution a { color:#7dd3fc !important; }
  @media (max-width:760px) {
    #map { height:315px; }
    .hud { grid-template-columns:repeat(2,minmax(0,1fr)); }
    #profile { height:165px; }
    .value { font-size:18px; }
    .tools { align-items:flex-start; flex-direction:column; }
    .tools-left,.tools-right { width:100%; }
    .tools-right { justify-content:flex-start; }
  }
</style>
</head>
<body>
<div class="track-player">
  <div class="map-wrap">
    <div id="map"></div>
    <div class="map-badge"><span class="map-badge-dot"></span><span id="map-mode">Celý let</span></div>
  </div>

  <div class="hud">
    <div class="metric">
      <div class="label">Čas</div><div class="value" id="v-time">—</div>
      <div class="subvalue" id="v-elapsed">—</div>
    </div>
    <div class="metric">
      <div class="label">Altitude</div><div class="value" id="v-alt">—</div>
      <div class="subvalue">GPS altitude</div>
    </div>
    <div class="metric">
      <div class="label">Groundspeed</div><div class="value" id="v-speed">—</div>
      <div class="subvalue" id="v-speed-kmh">—</div>
    </div>
    <div class="metric">
      <div class="label">Vzdálenost</div><div class="value" id="v-dist">—</div>
      <div class="subvalue">od začátku tracku</div>
    </div>
  </div>

  <div class="chart-wrap">
    <svg id="profile" viewBox="0 0 1000 220" preserveAspectRatio="none" aria-label="Profil letu – tažením změníš pozici">
      <line x1="52" y1="178" x2="970" y2="178" stroke="rgba(148,163,184,.24)" stroke-width="1" />
      <line x1="52" y1="42" x2="52" y2="178" stroke="rgba(148,163,184,.24)" stroke-width="1" />
      <g id="grid"></g>
      <polyline id="alt-line" fill="none" stroke="#38bdf8" stroke-width="3" stroke-linejoin="round" stroke-linecap="round" />
      <polyline id="speed-line" fill="none" stroke="#f59e0b" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" opacity=".94" />
      <line id="cursor" x1="52" y1="30" x2="52" y2="187" stroke="#e5edf7" stroke-width="1.4" stroke-dasharray="5 5" opacity=".82" />
      <circle id="alt-dot" r="6" fill="#22c55e" stroke="#e5edf7" stroke-width="1.4" />
      <circle id="speed-dot" r="5" fill="#f59e0b" stroke="#e5edf7" stroke-width="1.2" />
      <text x="56" y="27" fill="#38bdf8" font-size="13" font-weight="700">Altitude ft</text>
      <text x="870" y="27" fill="#f59e0b" font-size="13" font-weight="700">GS km/h</text>
    </svg>
  </div>

  <div class="controls">
    <button class="btn" id="play" title="Přehrát / pauza">▶</button>
    <input id="idx" type="range" min="0" max="10000" value="0" step="1" aria-label="Pozice v letu" />
    <button class="btn secondary" id="reset" title="Zpět na detekovaný vzlet">↺</button>
  </div>

  <div class="timeline-labels">
    <span id="time-start">—</span>
    <span id="time-current">—</span>
    <span id="time-end">—</span>
  </div>

  <div class="tools">
    <div class="tools-left">
      <button class="tool-btn" id="speed">1×</button>
      <button class="tool-btn" id="follow">Sledovat letadlo</button>
      <button class="tool-btn" id="fit">Celý let</button>
    </div>
    <div class="tools-right">
      <span style="color:__MUTED__;font-size:10.5px;">Timeline i graf jsou interaktivní</span>
    </div>
  </div>

  <div class="source-note" id="source-note"></div>
</div>

<script id="track-data" type="application/json">__DATA__</script>
<script>
(function() {
  const points = JSON.parse(document.getElementById('track-data').textContent || '[]');
  const originalCount = __ORIGINAL_COUNT__;
  const tileUrl = __TILE_URL__;
  const tileAttrib = __TILE_ATTRIB__;
  const defaultIdx = Math.max(0, Math.min(__DEFAULT__, Math.max(0, points.length - 1)));
  const slider = document.getElementById('idx');
  const playBtn = document.getElementById('play');
  const resetBtn = document.getElementById('reset');
  const speedBtn = document.getElementById('speed');
  const followBtn = document.getElementById('follow');
  const fitBtn = document.getElementById('fit');
  const profile = document.getElementById('profile');

  if (!points.length) {
    document.getElementById('map').innerHTML =
      '<div style="padding:20px;color:__MUTED__;">Track nemá data pro přehrávání.</div>';
    return;
  }

  const clamp = (value, min=0, max=1) => Math.max(min, Math.min(max, value));
  const numeric = value => Number.isFinite(Number(value)) ? Number(value) : null;
  const lerp = (a, b, t) => {
    const na = numeric(a), nb = numeric(b);
    if (na !== null && nb !== null) return na + (nb - na) * t;
    if (na !== null) return na;
    if (nb !== null) return nb;
    return null;
  };
  const angleLerp = (a, b, t) => {
    const na = numeric(a) ?? 0;
    const nb = numeric(b) ?? na;
    const delta = ((nb - na + 540) % 360) - 180;
    return (na + delta * t + 360) % 360;
  };

  const hasTimeline =
    points.length > 1 &&
    points.every(p => numeric(p.elapsed_s) !== null) &&
    numeric(points[points.length - 1].elapsed_s) > numeric(points[0].elapsed_s);

  const axis = hasTimeline
    ? points.map(p => Number(p.elapsed_s))
    : points.map((_, i) => i);
  const axisStart = axis[0];
  const axisEnd = axis[axis.length - 1];
  const axisSpan = Math.max(1e-9, axisEnd - axisStart);

  function progressForIndex(index) {
    index = Math.max(0, Math.min(points.length - 1, Number(index) || 0));
    return clamp((axis[index] - axisStart) / axisSpan);
  }

  function locate(progress) {
    progress = clamp(Number(progress) || 0);
    const target = axisStart + progress * axisSpan;

    let lo = 0, hi = axis.length - 1;
    while (lo < hi) {
      const mid = Math.floor((lo + hi + 1) / 2);
      if (axis[mid] <= target) lo = mid;
      else hi = mid - 1;
    }

    const lower = Math.min(lo, points.length - 1);
    const upper = Math.min(lower + 1, points.length - 1);
    const segmentSpan = Math.max(1e-9, axis[upper] - axis[lower]);
    const fraction = lower === upper
      ? 0
      : clamp((target - axis[lower]) / segmentSpan);

    const a = points[lower], b = points[upper];
    return {
      progress, lower, upper, fraction,
      lat: lerp(a.lat, b.lat, fraction),
      lon: lerp(a.lon, b.lon, fraction),
      alt_ft: lerp(a.alt_ft, b.alt_ft, fraction),
      speed_kmh: lerp(a.speed_kmh, b.speed_kmh, fraction),
      speed_kt: lerp(a.speed_kt, b.speed_kt, fraction),
      distance_km: lerp(a.distance_km, b.distance_km, fraction),
      clock_s: lerp(a.clock_s, b.clock_s, fraction),
      elapsed_s: lerp(a.elapsed_s, b.elapsed_s, fraction),
      bearing: angleLerp(a.bearing, b.bearing, fraction),
      fallbackTime: fraction < .5 ? a.time : b.time,
    };
  }

  const route = points.map(p => [Number(p.lat), Number(p.lon)]);
  const map = L.map('map', {
    preferCanvas:true, zoomControl:true, attributionControl:true,
    zoomAnimation:true, fadeAnimation:true, markerZoomAnimation:true
  });
  L.tileLayer(tileUrl, { maxZoom:18, attribution:tileAttrib }).addTo(map);
  const whole = L.polyline(route, {
    color:'#64748b', weight:3, opacity:.50, lineCap:'round', lineJoin:'round'
  }).addTo(map);

  if (route.length > 1) map.fitBounds(whole.getBounds(), { padding:[20,20] });
  else map.setView(route[0], 11);

  L.circleMarker(route[0], {
    radius:5, color:'#dcfce7', weight:1.5, fillColor:'#22c55e', fillOpacity:.95
  }).addTo(map);
  L.circleMarker(route[route.length - 1], {
    radius:5, color:'#fee2e2', weight:1.5, fillColor:'#ef4444', fillOpacity:.95
  }).addTo(map);

  function planeHtml() {
    return `<div class="plane-wrap"><svg class="plane-svg" viewBox="0 0 64 64" aria-hidden="true"><path d="M32 3 C35 3 37 6 37 10 L37 26 L59 40 L59 47 L37 40 L37 53 L46 59 L46 63 L32 58 L18 63 L18 59 L27 53 L27 40 L5 47 L5 40 L27 26 L27 10 C27 6 29 3 32 3 Z" fill="#38bdf8" stroke="#e5edf7" stroke-width="2" /></svg></div>`;
  }

  const plane = L.marker(route[defaultIdx], {
    icon:L.divIcon({
      className:'', html:planeHtml(), iconSize:[34,34], iconAnchor:[17,17]
    }),
    zIndexOffset:1000,
  }).addTo(map);

  const progressDone = L.polyline(route.slice(0, defaultIdx + 1), {
    color:'#38bdf8', weight:4, opacity:.95, lineCap:'round', lineJoin:'round'
  }).addTo(map);
  const progressActive = L.polyline(
    [route[defaultIdx], route[defaultIdx]],
    { color:'#38bdf8', weight:4, opacity:.95, lineCap:'round' }
  ).addTo(map);

  function setPlaneBearing(degrees) {
    const element = plane.getElement();
    const svg = element ? element.querySelector('.plane-svg') : null;
    if (svg) svg.style.transform = `rotate(${Number(degrees || 0).toFixed(1)}deg)`;
  }

  function fmt(value, suffix='', decimals=0) {
    const number = numeric(value);
    if (number === null) return '—';
    return `${number.toFixed(decimals)}${suffix}`;
  }

  function fmtClock(clockSeconds, fallback='—') {
    const raw = numeric(clockSeconds);
    if (raw === null) return fallback || '—';
    let seconds = Math.round(raw) % 86400;
    if (seconds < 0) seconds += 86400;
    const hh = String(Math.floor(seconds / 3600)).padStart(2,'0');
    const mm = String(Math.floor((seconds % 3600) / 60)).padStart(2,'0');
    const ss = String(seconds % 60).padStart(2,'0');
    return `${hh}:${mm}:${ss}`;
  }

  function fmtElapsed(seconds) {
    const value = numeric(seconds);
    if (value === null) return hasTimeline ? 'GPS timeline' : 'relativní timeline';
    const total = Math.max(0, Math.round(value));
    const hh = Math.floor(total / 3600);
    const mm = Math.floor((total % 3600) / 60);
    const ss = total % 60;
    return hh > 0
      ? `+${hh}:${String(mm).padStart(2,'0')}:${String(ss).padStart(2,'0')}`
      : `+${mm}:${String(ss).padStart(2,'0')}`;
  }

  // Profile drawing uses the same axis as playback: actual GPS time when
  // available, otherwise point order. Cursor and aircraft therefore stay synced.
  const altLine = document.getElementById('alt-line');
  const speedLine = document.getElementById('speed-line');
  const cursor = document.getElementById('cursor');
  const altDot = document.getElementById('alt-dot');
  const speedDot = document.getElementById('speed-dot');
  const grid = document.getElementById('grid');
  const L0 = 52, R0 = 970, T0 = 42, B0 = 178;
  const altVals = points.map(p => numeric(p.alt_ft)).filter(v => v !== null);
  const speedVals = points.map(p => numeric(p.speed_kmh)).filter(v => v !== null);
  const altMax = Math.max(500, ...(altVals.length ? altVals : [0]));
  const speedMax = Math.max(80, ...(speedVals.length ? speedVals : [0]));

  function xProgress(progress) {
    return L0 + (R0 - L0) * clamp(progress);
  }
  function xPoint(index) {
    return xProgress((axis[index] - axisStart) / axisSpan);
  }
  function yAlt(value) {
    const number = numeric(value) ?? 0;
    return B0 - (B0 - T0) * clamp(number / altMax);
  }
  function ySpeed(value) {
    const number = numeric(value) ?? 0;
    return B0 - (B0 - T0) * clamp(number / speedMax);
  }
  function polyline(values, yFn) {
    return values.map((value,index) =>
      `${xPoint(index).toFixed(1)},${yFn(value).toFixed(1)}`
    ).join(' ');
  }

  for (let gridIndex=1; gridIndex<=3; gridIndex++) {
    const y = T0 + (B0 - T0) * gridIndex / 4;
    const line = document.createElementNS('http://www.w3.org/2000/svg','line');
    line.setAttribute('x1',L0); line.setAttribute('x2',R0);
    line.setAttribute('y1',y); line.setAttribute('y2',y);
    line.setAttribute('stroke','rgba(148,163,184,.16)');
    line.setAttribute('stroke-width','1');
    grid.appendChild(line);
  }

  altLine.setAttribute('points', polyline(points.map(p => p.alt_ft), yAlt));
  speedLine.setAttribute('points', polyline(points.map(p => p.speed_kmh), ySpeed));

  let currentProgress = progressForIndex(defaultIdx);
  let lastCompletedIndex = -1;
  let follow = false;
  let followLastAt = 0;
  let animationFrame = null;
  let animationLastTs = null;
  let playbackSpeed = 1;
  const playbackSpeeds = [1,2,4];
  const basePlaybackDurationMs = 48000;

  function updateFollowUi() {
    followBtn.classList.toggle('active', follow);
    document.getElementById('map-mode').textContent =
      follow ? 'Sledování letadla' : 'Celý let';
  }

  function setFollow(enabled) {
    follow = Boolean(enabled);
    updateFollowUi();
    if (follow) {
      const sample = locate(currentProgress);
      const targetZoom = Math.max(map.getZoom(), 13);
      map.setView([sample.lat, sample.lon], targetZoom, { animate:false });
    }
  }

  function update(progress, allowFollow=true) {
    currentProgress = clamp(progress);
    const sample = locate(currentProgress);
    const latLng = [sample.lat, sample.lon];

    slider.value = String(Math.round(currentProgress * 10000));
    plane.setLatLng(latLng);
    setPlaneBearing(sample.bearing);

    if (sample.lower !== lastCompletedIndex) {
      progressDone.setLatLngs(route.slice(0, sample.lower + 1));
      lastCompletedIndex = sample.lower;
    }
    progressActive.setLatLngs([route[sample.lower], latLng]);

    const currentClock = fmtClock(sample.clock_s, sample.fallbackTime);
    document.getElementById('v-time').textContent = currentClock;
    document.getElementById('v-elapsed').textContent = fmtElapsed(sample.elapsed_s);
    document.getElementById('v-alt').textContent = fmt(sample.alt_ft,' ft',0);
    document.getElementById('v-speed').textContent = fmt(sample.speed_kt,' kt',0);
    document.getElementById('v-speed-kmh').textContent = fmt(sample.speed_kmh,' km/h',0);
    document.getElementById('v-dist').textContent = fmt(sample.distance_km,' km',1);
    document.getElementById('time-current').textContent = currentClock;

    const cursorX = xProgress(currentProgress);
    cursor.setAttribute('x1',cursorX); cursor.setAttribute('x2',cursorX);
    altDot.setAttribute('cx',cursorX); altDot.setAttribute('cy',yAlt(sample.alt_ft));
    speedDot.setAttribute('cx',cursorX); speedDot.setAttribute('cy',ySpeed(sample.speed_kmh));

    if (follow && allowFollow) {
      const now = performance.now();
      if (now - followLastAt > 120) {
        map.panTo(latLng, { animate:false });
        followLastAt = now;
      }
    }
  }

  function stop() {
    if (animationFrame !== null) {
      cancelAnimationFrame(animationFrame);
      animationFrame = null;
    }
    animationLastTs = null;
    playBtn.textContent = '▶';
  }

  function animationTick(timestamp) {
    if (animationLastTs === null) animationLastTs = timestamp;
    const delta = Math.min(80, Math.max(0, timestamp - animationLastTs));
    animationLastTs = timestamp;
    currentProgress += (delta / basePlaybackDurationMs) * playbackSpeed;

    if (currentProgress >= 1) {
      update(1);
      stop();
      return;
    }

    update(currentProgress);
    animationFrame = requestAnimationFrame(animationTick);
  }

  function play() {
    if (animationFrame !== null) {
      stop();
      return;
    }
    if (currentProgress >= .9999) update(0);
    playBtn.textContent = 'Ⅱ';
    animationLastTs = null;
    animationFrame = requestAnimationFrame(animationTick);
  }

  function cycleSpeed() {
    const index = playbackSpeeds.indexOf(playbackSpeed);
    playbackSpeed = playbackSpeeds[(index + 1) % playbackSpeeds.length];
    speedBtn.textContent = `${playbackSpeed}×`;
  }

  function fitWholeFlight() {
    setFollow(false);
    if (route.length > 1) map.fitBounds(whole.getBounds(), { padding:[20,20] });
    else map.setView(route[0],11);
  }

  // Timeline scrubber – no Streamlit rerun.
  slider.addEventListener('input', event => {
    stop();
    update(Number(event.target.value) / 10000);
  });
  slider.addEventListener('pointerdown', stop);

  // SVG profile is a second scrubber. Dragging the cursor is intentionally
  // continuous so altitude/speed/map stay synchronized.
  let chartDragging = false;
  function chartProgress(clientX) {
    const rect = profile.getBoundingClientRect();
    const svgX = ((clientX - rect.left) / Math.max(1, rect.width)) * 1000;
    return clamp((svgX - L0) / (R0 - L0));
  }
  profile.addEventListener('pointerdown', event => {
    stop();
    chartDragging = true;
    try { profile.setPointerCapture(event.pointerId); } catch (_err) {}
    update(chartProgress(event.clientX));
  });
  profile.addEventListener('pointermove', event => {
    if (chartDragging) update(chartProgress(event.clientX));
  });
  profile.addEventListener('pointerup', event => {
    chartDragging = false;
    try { profile.releasePointerCapture(event.pointerId); } catch (_err) {}
  });
  profile.addEventListener('pointercancel', () => { chartDragging = false; });

  playBtn.addEventListener('click', play);
  resetBtn.addEventListener('click', () => {
    stop();
    update(progressForIndex(defaultIdx));
  });
  speedBtn.addEventListener('click', cycleSpeed);
  followBtn.addEventListener('click', () => setFollow(!follow));
  fitBtn.addEventListener('click', fitWholeFlight);

  // Manual map movement means the pilot wants to inspect another area.
  map.on('dragstart', () => setFollow(false));

  const startPoint = points[0];
  const endPoint = points[points.length - 1];
  document.getElementById('time-start').textContent = startPoint.time || 'Start';
  document.getElementById('time-end').textContent = endPoint.time || 'Konec';

  const timelineLabel = hasTimeline ? 'GPS čas' : 'pořadí bodů';
  document.getElementById('source-note').textContent =
    originalCount > points.length
      ? `Plynulý playback · ${points.length} optimalizovaných bodů z původních ${originalCount} · osa: ${timelineLabel}. Plný KML zůstává uložený.`
      : `Plynulý playback · ${points.length} bodů · osa: ${timelineLabel}. Tažením po grafu nebo timeline posouváš let.`;

  setTimeout(() => {
    map.invalidateSize();
    update(currentProgress, false);
  }, 120);
  updateFollowUi();
  update(currentProgress, false);
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

    player_points, default_idx, original_count = build_track_player_payload(
        points,
        current_user_timezone(),
        max_points=2800,
    )
    if len(player_points) < 2:
        st.info("Track nemá dostatek bodů pro přehrávání.")
        return

    html_doc = _track_player_html(
        player_points,
        default_idx,
        dark_mode,
        original_count,
    )
    st.iframe(html_doc, height=760)



# -----------------------------------------------------------------------------
# Pages
# -----------------------------------------------------------------------------

def page_dashboard(df: pd.DataFrame):
    st.markdown("## Dashboard")

    today = datetime.now(LOCAL_TZ).date()
    currency = current_user_currency()
    period = st.radio(
        "Období",
        list(PERIOD_PRESETS),
        horizontal=True,
        label_visibility="collapsed",
        key="dashboard_period_v0621",
    )
    period_df = filter_dashboard_period(df, period, today)
    filtered = apply_filters(period_df, "dash_v0621")
    primary = primary_pilot_summary(filtered)
    insights = dashboard_insights(filtered)

    st.caption(
        f"Období: {dashboard_period_label(period, today)} • "
        f"zobrazeno {len(filtered)} z {len(df)} letů"
    )

    if filtered.empty:
        st.info("Pro zvolené období a filtry nejsou žádná data.")
        return

    # Primary pilot metric: the complete logged block time.
    st.markdown(
        f"""
        <div class="dashboard-primary-card">
          <div class="dashboard-card-top">
            <div class="dashboard-primary-label">Celkový čas</div>
            <div class="dashboard-card-badge">TOTAL</div>
          </div>
          <div class="dashboard-primary-value">{fmt_minutes(primary['total_minutes'])}</div>
          <div class="dashboard-stat-chips">
            <span class="dashboard-stat-chip">✈ <strong>{primary['total_flights']}</strong> letů</span>
            <span class="dashboard-stat-chip">↘ <strong>{primary['total_landings']}</strong> přistání</span>
          </div>
        </div>
        """,
        unsafe_allow_html=True,
    )

    # Evidence split – the second most important view.
    evidence_cols = st.columns(2)
    with evidence_cols[0]:
        st.markdown(
            f"""
            <div class="dashboard-category-card ull">
              <div class="dashboard-card-top">
                <div class="dashboard-category-label">ULL</div>
                <div class="dashboard-card-badge">ULL</div>
              </div>
              <div class="dashboard-category-value">{fmt_minutes(primary['ull_minutes'])}</div>
              <div class="dashboard-stat-chips">
                <span class="dashboard-stat-chip">✈ <strong>{primary['ull_flights']}</strong> letů</span>
                <span class="dashboard-stat-chip">↘ <strong>{primary['ull_landings']}</strong> přistání</span>
              </div>
            </div>
            """,
            unsafe_allow_html=True,
        )
    with evidence_cols[1]:
        st.markdown(
            f"""
            <div class="dashboard-category-card easa">
              <div class="dashboard-card-top">
                <div class="dashboard-category-label">EASA</div>
                <div class="dashboard-card-badge">EASA</div>
              </div>
              <div class="dashboard-category-value">{fmt_minutes(primary['easa_minutes'])}</div>
              <div class="dashboard-stat-chips">
                <span class="dashboard-stat-chip">✈ <strong>{primary['easa_flights']}</strong> letů</span>
                <span class="dashboard-stat-chip">↘ <strong>{primary['easa_landings']}</strong> přistání</span>
              </div>
            </div>
            """,
            unsafe_allow_html=True,
        )

    st.markdown("<div style='height:.42rem'></div>", unsafe_allow_html=True)

    # PIC split follows the same ULL / EASA structure.
    pic_cols = st.columns(2)
    with pic_cols[0]:
        st.markdown(
            f"""
            <div class="dashboard-category-card pic-ull">
              <div class="dashboard-card-top">
                <div class="dashboard-category-label">PIC • ULL</div>
                <div class="dashboard-card-badge">PIC</div>
              </div>
              <div class="dashboard-category-value">{fmt_minutes(primary['pic_ull_minutes'])}</div>
              <div class="dashboard-stat-chips">
                <span class="dashboard-stat-chip">✈ <strong>{primary['pic_ull_flights']}</strong> letů</span>
                <span class="dashboard-stat-chip">↘ <strong>{primary['pic_ull_landings']}</strong> přistání</span>
              </div>
            </div>
            """,
            unsafe_allow_html=True,
        )
    with pic_cols[1]:
        st.markdown(
            f"""
            <div class="dashboard-category-card pic-easa">
              <div class="dashboard-card-top">
                <div class="dashboard-category-label">PIC • EASA</div>
                <div class="dashboard-card-badge">PIC</div>
              </div>
              <div class="dashboard-category-value">{fmt_minutes(primary['pic_easa_minutes'])}</div>
              <div class="dashboard-stat-chips">
                <span class="dashboard-stat-chip">✈ <strong>{primary['pic_easa_flights']}</strong> letů</span>
                <span class="dashboard-stat-chip">↘ <strong>{primary['pic_easa_landings']}</strong> přistání</span>
              </div>
            </div>
            """,
            unsafe_allow_html=True,
        )

    # Compact context line instead of another row of KPI cards.
    last_flight = filtered.sort_values(
        ["date_dt", "off_block", "id"],
        ascending=[False, False, False],
        na_position="last",
    ).head(1)
    last_text = "—"
    if not last_flight.empty:
        lr = last_flight.iloc[0]
        route = f"{lr.get('departure') or ''}–{lr.get('arrival') or ''}".strip("–")
        reg = str(lr.get("registration") or "").strip()
        last_text = " ".join(v for v in (str(lr.get("date") or ""), reg, route) if v)
    st.markdown(
        f"""
        <div class="dashboard-quickline">
          Poslední let <strong>{last_text}</strong>
          &nbsp;·&nbsp; {insights['unique_aircraft']} letadel
          &nbsp;·&nbsp; {insights['unique_airports']} letišť
          &nbsp;·&nbsp; {float(filtered.get('gps_km', pd.Series(dtype=float)).fillna(0).sum()):.0f} km GPS
        </div>
        """,
        unsafe_allow_html=True,
    )

    # One dominant chart. The user chooses which primary quantity it shows.
    chart_metric = st.segmented_control(
        "Graf",
        ["Celkový čas", "ULL", "EASA", "PIC ULL", "PIC EASA", "Přistání"],
        default="Celkový čas",
        label_visibility="collapsed",
        key="dashboard_primary_chart_v0621",
    )
    primary_monthly = monthly_primary_summary(filtered)
    if not primary_monthly.empty:
        import plotly.express as px

        metric_map = {
            "Celkový čas": ("total_hours", "Block h"),
            "ULL": ("ull_hours", "ULL h"),
            "EASA": ("easa_hours", "EASA h"),
            "PIC ULL": ("pic_ull_hours", "PIC ULL h"),
            "PIC EASA": ("pic_easa_hours", "PIC EASA h"),
            "Přistání": ("landings", "Přistání"),
        }
        y_col, y_title = metric_map.get(chart_metric or "Celkový čas", ("total_hours", "Block h"))
        fig_main = px.bar(
            primary_monthly.tail(24),
            x="month",
            y=y_col,
            title="Vývoj po měsících",
        )
        fig_main.update_yaxes(title=y_title)
        fig_main.update_xaxes(title=None)
        st.plotly_chart(plotly_layout(fig_main), width="stretch")

    show_details = st.toggle(
        "Detailní statistiky",
        value=False,
        help="Letadla, letiště, náklady, roční přehled a poslední lety.",
        key="dashboard_show_details_v0621",
    )
    if not show_details:
        return

    st.markdown("### Detailní statistiky")
    section = st.radio(
        "Dashboard sekce",
        ["Roční přehled", "Letadla", "Letiště a trasy", "Náklady", "Poslední lety"],
        horizontal=True,
        label_visibility="collapsed",
        key="dashboard_section_v0621",
    )

    if section == "Roční přehled":
        insight_cols = st.columns(4)
        with insight_cols[0]:
            metric_card("Nejaktivnější měsíc", insights["busiest_month"], fmt_minutes(insights["busiest_month_minutes"]))
        with insight_cols[1]:
            metric_card("Nejdelší let", fmt_minutes(insights["longest_flight_minutes"]), insights["longest_flight_label"])
        with insight_cols[2]:
            metric_card("Top letadlo", insights["top_aircraft"], fmt_minutes(insights["top_aircraft_minutes"]))
        with insight_cols[3]:
            metric_card("Top trasa", insights["top_route"], f"{insights['top_route_flights']} letů")

        ctrl1, ctrl2 = st.columns([1, 3])
        with ctrl1:
            horizon = st.selectbox("Měsíční historie", [12, 24, 36, "Vše"], index=1, key="dashboard_month_horizon_v062")
        with ctrl2:
            show_charts = st.toggle("Grafy", value=True, key="show_dashboard_charts_v062")

        monthly = dashboard_monthly_summary(filtered)
        yearly = dashboard_yearly_summary(filtered)
        if horizon != "Vše" and not monthly.empty:
            monthly = monthly.tail(int(horizon))

        if show_charts and not monthly.empty:
            from plotly.subplots import make_subplots
            import plotly.graph_objects as go

            fig = make_subplots(specs=[[{"secondary_y": True}]])
            fig.add_trace(
                go.Bar(x=monthly["month"], y=monthly["block_hours"], name="Block h", hovertemplate="%{x|%Y-%m}<br>%{y:.1f} h<extra></extra>"),
                secondary_y=False,
            )
            fig.add_trace(
                go.Scatter(x=monthly["month"], y=monthly["flights"], name="Lety", mode="lines+markers", hovertemplate="%{x|%Y-%m}<br>%{y} letů<extra></extra>"),
                secondary_y=True,
            )
            fig.update_layout(title="Měsíční aktivita", hovermode="x unified")
            fig.update_yaxes(title_text="Block h", secondary_y=False)
            fig.update_yaxes(title_text="Lety", secondary_y=True, showgrid=False)
            st.plotly_chart(plotly_layout(fig), width="stretch")

            role_year = category_year_summary(filtered, "role")
            evidence_year = category_year_summary(filtered, "evidence")
            left, right = st.columns(2)
            with left:
                if not role_year.empty:
                    import plotly.express as px
                    fig_role = px.bar(role_year, x="year", y="block_hours", color="role", barmode="stack", title="Block time podle funkce")
                    fig_role.update_xaxes(dtick=1)
                    st.plotly_chart(plotly_layout(fig_role), width="stretch")
            with right:
                if not evidence_year.empty:
                    import plotly.express as px
                    fig_ev = px.bar(evidence_year, x="year", y="block_hours", color="evidence", barmode="stack", title="Block time podle evidence")
                    fig_ev.update_xaxes(dtick=1)
                    st.plotly_chart(plotly_layout(fig_ev), width="stretch")

        with st.expander("Roční souhrn", expanded=False):
            if yearly.empty:
                st.info("Roční souhrn není k dispozici.")
            else:
                annual = yearly.copy()
                annual["Block"] = annual["block_minutes"].apply(fmt_minutes)
                annual["Air"] = annual["air_minutes"].apply(fmt_minutes)
                annual["PIC"] = annual["pic_minutes"].apply(fmt_minutes)
                annual["DUAL"] = annual["dual_minutes"].apply(fmt_minutes)
                annual["ULL"] = annual["ull_minutes"].apply(fmt_minutes)
                annual["EASA"] = annual["easa_minutes"].apply(fmt_minutes)
                annual["Náklady"] = annual["cost"].apply(lambda v: fmt_money(v, currency))
                annual["GPS km"] = annual["gps_km"].round(0).astype(int)
                st.dataframe(
                    annual[["year", "flights", "starts", "Block", "Air", "PIC", "DUAL", "ULL", "EASA", "Náklady", "GPS km"]]
                    .rename(columns={"year": "Rok", "flights": "Lety", "starts": "Starty"}),
                    hide_index=True,
                    width="stretch",
                )

    elif section == "Letadla":
        aircraft = aircraft_summary(filtered)
        if aircraft.empty:
            st.info("Žádná letadla v aktuálním výběru.")
            return

        top_by_flights = aircraft.sort_values(["flights", "block_minutes"], ascending=[False, False]).iloc[0]
        top_by_gps = aircraft.sort_values(["gps_km", "block_minutes"], ascending=[False, False]).iloc[0]
        cards = st.columns(4)
        with cards[0]:
            metric_card("Použitá letadla", str(len(aircraft)), f"{int(aircraft['flights'].sum())} letů")
        with cards[1]:
            metric_card("Největší nálet", str(aircraft.iloc[0]["registration"]), fmt_minutes(aircraft.iloc[0]["block_minutes"]))
        with cards[2]:
            metric_card("Nejvíc letů", str(top_by_flights["registration"]), f"{int(top_by_flights['flights'])} letů")
        with cards[3]:
            metric_card("Nejvíc GPS", str(top_by_gps["registration"]), f"{float(top_by_gps['gps_km']):.0f} km")

        sort_mode = st.selectbox("Seřadit graf podle", ["Block time", "Počet letů", "Náklady", "GPS km"], key="dashboard_aircraft_sort_v062")
        sort_map = {
            "Block time": ("block_hours", "Block h"),
            "Počet letů": ("flights", "Lety"),
            "Náklady": ("cost", f"Náklady ({currency})"),
            "GPS km": ("gps_km", "GPS km"),
        }
        sort_col, y_label = sort_map[sort_mode]
        chart_data = aircraft.sort_values(sort_col, ascending=False).head(15)
        import plotly.express as px
        fig_aircraft = px.bar(chart_data, x="registration", y=sort_col, title=f"Letadla – {sort_mode.lower()}")
        fig_aircraft.update_yaxes(title=y_label)
        st.plotly_chart(plotly_layout(fig_aircraft), width="stretch")

        table = aircraft.copy()
        table["Block"] = table["block_minutes"].apply(fmt_minutes)
        table["Air"] = table["air_minutes"].apply(fmt_minutes)
        table["Ø let"] = table["avg_block_minutes"].apply(fmt_minutes)
        table["Náklady"] = table["cost"].apply(lambda v: fmt_money(v, currency))
        table["Cena / block h"] = table["cost_per_block_hour"].apply(lambda v: fmt_money(v, currency))
        table["GPS km"] = table["gps_km"].round(0).astype(int)
        table["Podíl"] = table["share_block_pct"].map(lambda v: f"{v:.1f}%")
        table["Poslední let"] = pd.to_datetime(table["last_date"], errors="coerce").dt.strftime("%Y-%m-%d").fillna("")
        st.dataframe(
            table[["registration", "aircraft_type", "evidence", "flights", "starts", "Block", "Air", "Ø let", "Podíl", "Náklady", "Cena / block h", "GPS km", "Poslední let"]]
            .rename(columns={"registration": "Imatrikulace", "aircraft_type": "Typ", "evidence": "Evidence", "flights": "Lety", "starts": "Starty"}),
            hide_index=True,
            width="stretch",
            height=430,
        )

        selected_reg = st.selectbox("Detail letadla", list(aircraft["registration"]), key="dashboard_aircraft_detail_v062")
        selected_df = filtered[filtered["registration"].eq(selected_reg)].copy()
        selected_monthly = dashboard_monthly_summary(selected_df)
        selected_summary = build_summary(selected_df)
        detail_cards = st.columns(4)
        with detail_cards[0]: metric_card("Block", fmt_minutes(selected_summary["total"]), f"{selected_summary['flights']} letů")
        with detail_cards[1]: metric_card("PIC", fmt_minutes(selected_summary["pic"]), "")
        with detail_cards[2]: metric_card("Náklady", fmt_money(selected_summary["cost"], currency), "")
        with detail_cards[3]: metric_card("GPS", f"{selected_summary['gps_km']:.0f} km", f"{selected_summary['tracks']} tracků")
        if not selected_monthly.empty:
            fig_selected = px.bar(selected_monthly.tail(24), x="month", y="block_hours", title=f"{selected_reg} – posledních 24 aktivních měsíců")
            fig_selected.update_yaxes(title="Block h")
            st.plotly_chart(plotly_layout(fig_selected), width="stretch")

    elif section == "Letiště a trasy":
        airports, routes = airport_route_summaries(filtered)
        top_airport = airports.iloc[0] if not airports.empty else None
        top_route = routes.iloc[0] if not routes.empty else None
        cards = st.columns(4)
        with cards[0]: metric_card("Letiště", str(len(airports)), "unikátních ICAO / kódů")
        with cards[1]: metric_card("Trasy", str(len(routes)), "unikátních směrů")
        with cards[2]: metric_card("Top letiště", str(top_airport["airport"]) if top_airport is not None else "—", f"{int(top_airport['visits']) if top_airport is not None else 0} návštěv")
        with cards[3]: metric_card("Top trasa", str(top_route["route"]) if top_route is not None else "—", f"{int(top_route['flights']) if top_route is not None else 0} letů")

        import plotly.express as px
        left, right = st.columns(2)
        with left:
            st.markdown("### Letiště")
            if airports.empty:
                st.info("Žádná letiště.")
            else:
                fig_airports = px.bar(airports.head(15), x="airport", y="visits", title="Nejčastější letiště")
                st.plotly_chart(plotly_layout(fig_airports), width="stretch")
                st.dataframe(
                    airports.head(40).rename(columns={"airport": "Letiště", "departures": "Odlety", "arrivals": "Přílety", "visits": "Návštěvy"}),
                    hide_index=True,
                    width="stretch",
                    height=390,
                )
        with right:
            st.markdown("### Trasy")
            if routes.empty:
                st.info("Žádné trasy.")
            else:
                fig_routes = px.bar(routes.head(15), x="route", y="flights", title="Nejčastější trasy")
                st.plotly_chart(plotly_layout(fig_routes), width="stretch")
                route_table = routes.copy()
                route_table["Block"] = route_table["block_minutes"].apply(fmt_minutes)
                route_table["Ø let"] = route_table["avg_block_minutes"].apply(fmt_minutes)
                route_table["GPS km"] = route_table["gps_km"].round(0).astype(int)
                route_table["Poslední"] = pd.to_datetime(route_table["last_date"], errors="coerce").dt.strftime("%Y-%m-%d").fillna("")
                st.dataframe(
                    route_table[["route", "flights", "Block", "Ø let", "GPS km", "Poslední"]].head(40)
                    .rename(columns={"route": "Trasa", "flights": "Lety"}),
                    hide_index=True,
                    width="stretch",
                    height=390,
                )

    elif section == "Náklady":
        priced = filtered[pd.to_numeric(filtered.get("cost", pd.Series(dtype=float)), errors="coerce").fillna(0).gt(0)].copy()
        if priced.empty:
            st.info("V aktuálním výběru nejsou žádná nákladová data.")
            return

        cost_total = float(priced["cost"].sum())
        priced_block_hours = float(priced["block_minutes"].fillna(0).sum()) / 60.0
        avg_flight = cost_total / max(len(priced), 1)
        avg_block_hour = cost_total / priced_block_hours if priced_block_hours > 0 else 0.0
        by_aircraft = aircraft_summary(priced).sort_values("cost", ascending=False)
        top_cost = by_aircraft.iloc[0] if not by_aircraft.empty else None

        cards = st.columns(4)
        with cards[0]: metric_card("Celkem", fmt_money(cost_total, currency), f"{len(priced)} oceněných letů")
        with cards[1]: metric_card("Ø / let", fmt_money(avg_flight, currency), "")
        with cards[2]: metric_card("Ø / block h", fmt_money(avg_block_hour, currency), "")
        with cards[3]: metric_card("Nejvyšší podíl", str(top_cost["registration"]) if top_cost is not None else "—", fmt_money(float(top_cost["cost"]) if top_cost is not None else 0, currency))

        import plotly.express as px
        cost_monthly = dashboard_monthly_summary(priced)
        left, right = st.columns(2)
        with left:
            if not cost_monthly.empty:
                fig_cost_month = px.bar(cost_monthly.tail(24), x="month", y="cost", title="Náklady po měsících")
                fig_cost_month.update_yaxes(title=currency)
                st.plotly_chart(plotly_layout(fig_cost_month), width="stretch")
        with right:
            if not by_aircraft.empty:
                fig_cost_aircraft = px.bar(by_aircraft.head(12), x="registration", y="cost", title="Náklady podle letadla")
                fig_cost_aircraft.update_yaxes(title=currency)
                st.plotly_chart(plotly_layout(fig_cost_aircraft), width="stretch")

        cost_table = by_aircraft.copy()
        cost_table["Block"] = cost_table["block_minutes"].apply(fmt_minutes)
        cost_table["Náklady"] = cost_table["cost"].apply(lambda v: fmt_money(v, currency))
        cost_table["Cena / block h"] = cost_table["cost_per_block_hour"].apply(lambda v: fmt_money(v, currency))
        cost_table["Podíl"] = (cost_table["cost"] / cost_total * 100.0).map(lambda v: f"{v:.1f}%")
        st.dataframe(
            cost_table[["registration", "flights", "Block", "Náklady", "Cena / block h", "Podíl"]]
            .rename(columns={"registration": "Imatrikulace", "flights": "Lety"}),
            hide_index=True,
            width="stretch",
            height=390,
        )

    elif section == "Poslední lety":
        row_count = st.selectbox("Počet letů", [10, 20, 50], index=1, key="dashboard_recent_count_v062")
        recent = filtered.sort_values(["date_dt", "off_block", "id"], ascending=[False, False, False], na_position="last").head(int(row_count)).copy()

        dates = pd.to_datetime(filtered.get("date_dt"), errors="coerce")
        recent_30 = filtered[dates.ge(pd.Timestamp(today) - pd.Timedelta(days=29)) & dates.le(pd.Timestamp(today))].copy()
        recent_30_summary = build_summary(recent_30)
        cards = st.columns(4)
        with cards[0]: metric_card("Posledních 30 dní", f"{recent_30_summary['flights']} letů", fmt_minutes(recent_30_summary["total"]))
        with cards[1]: metric_card("Starty / přistání", str(recent_30_summary["starts"]), "za posledních 30 dní")
        with cards[2]: metric_card("PIC", fmt_minutes(recent_30_summary["pic"]), "za posledních 30 dní")
        with cards[3]: metric_card("Náklady", fmt_money(recent_30_summary["cost"], currency), "za posledních 30 dní")

        if recent.empty:
            st.info("Žádné lety.")
        else:
            recent_table = recent[[
                "date", "registration", "departure", "arrival", "off_block", "on_block", "block_time",
                "air_time", "starts", "role", "evidence", "cost_label", "track_count", "gps_km",
            ]].copy()
            recent_table["GPS km"] = recent_table["gps_km"].round(0).astype(int)
            recent_table = recent_table.drop(columns=["gps_km"])
            recent_table = recent_table.rename(columns={
                "date": "Datum", "registration": "Imatrikulace", "departure": "Odlet", "arrival": "Přílet",
                "off_block": "Off", "on_block": "On", "block_time": "Block", "air_time": "Air",
                "starts": "Starty", "role": "Role", "evidence": "Evidence", "cost_label": "Cena", "track_count": "Tracky",
            })
            st.dataframe(recent_table, hide_index=True, width="stretch", height=min(720, 90 + int(row_count) * 28))


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
                if r1.button("Použít trasu", key=f"{prefix}_apply_route_v0401", width="stretch"):
                    st.session_state[f"{prefix}_dep"] = dep
                    st.session_state[f"{prefix}_arr"] = arr
                if r2.button("Otočit trasu", key=f"{prefix}_reverse_route_v0401", width="stretch"):
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
            if st.button("Doplnit časy", key=f"{prefix}_apply_times_v0401", width="stretch"):
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
        if st.button("Zavřít", width="stretch", key=f"inline_aircraft_close_{prefix}"):
            st.rerun()
        return

    profile = dict(payload.get("profile") or {})
    form_data = dict(payload.get("form_data") or {})
    mode = normalize_text(payload.get("mode")) or "preflight"
    reg = normalize_registration(profile.get("registration") or form_data.get("registration"))
    if not reg:
        st.error("Chybí imatrikulace letadla.")
        if st.button("Zpět", width="stretch", key=f"inline_aircraft_missing_reg_{prefix}"):
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
        create_profile = st.form_submit_button("Vytvořit profil a pokračovat", type="primary", width="stretch")

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
        if st.button("Pokračovat bez profilu", width="stretch", key=f"inline_aircraft_skip_{token}"):
            if mode == "postsubmit":
                st.session_state[resolution_key] = "skip"
            else:
                st.session_state[bypass_key] = reg
                st.session_state.pop(pending_key, None)
            st.rerun()
    with c2:
        if st.button("Vrátit se k formuláři", width="stretch", key=f"inline_aircraft_back_{token}"):
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



def _render_manual_entry_context(context: dict[str, Any], defaults: dict[str, Any]) -> None:
    if context:
        route = " → ".join(
            part for part in (
                normalize_text(context.get("departure")),
                normalize_text(context.get("arrival")),
            )
            if part
        ) or "bez trasy"
        registration = normalize_registration(defaults.get("registration"))
        aircraft_part = (
            f'<span class="flight-entry-chip">✈ {html.escape(registration)}</span>'
            if registration else ""
        )
        dep = normalize_text(defaults.get("departure"))
        dep_part = (
            f'<span class="flight-entry-chip">Odlet {html.escape(dep)}</span>'
            if dep else ""
        )
        st.markdown(
            f"""
            <div class="flight-entry-context">
              <div>
                <div class="flight-entry-context-title">Chytré předvyplnění</div>
                <div class="flight-entry-context-sub">
                  Poslední let {html.escape(str(context.get('date') or ''))}
                  • {html.escape(route)}
                </div>
              </div>
              <div class="flight-entry-chip-row">
                {aircraft_part}{dep_part}
              </div>
            </div>
            """,
            unsafe_allow_html=True,
        )
    else:
        st.markdown(
            """
            <div class="flight-entry-context">
              <div>
                <div class="flight-entry-context-title">Nový ruční let</div>
                <div class="flight-entry-context-sub">
                  Používám výchozí hodnoty z profilu. Časy ani cílové letiště se nikdy neodhadují.
                </div>
              </div>
            </div>
            """,
            unsafe_allow_html=True,
        )


def _render_manual_route_shortcuts(
    prefix: str,
    defaults: dict[str, Any],
    history: pd.DataFrame,
) -> None:
    dep = (normalize_text(st.session_state.get(f"{prefix}_dep", defaults.get("departure"))) or "").upper()
    arr = (normalize_text(st.session_state.get(f"{prefix}_arr", defaults.get("arrival"))) or "").upper()
    home = current_user_home_airport()

    actions: list[tuple[str, str, str]] = []
    if dep:
        actions.append(("local", f"{dep} → {dep}", "Lokální"))
    if dep and home and dep != home:
        actions.append(("home", f"{dep} → {home}", "Domů"))
    if dep and arr:
        actions.append(("reverse", f"{arr} → {dep}", "Otočit"))

    known_targets = {item[1].split(" → ")[-1] for item in actions if " → " in item[1]}
    for destination, count in frequent_destinations(history, dep, limit=3):
        if destination in known_targets:
            continue
        actions.append((f"dest:{destination}", f"{dep} → {destination}", f"{count}×"))
        if len(actions) >= 4:
            break

    if not actions:
        return

    st.caption("Rychlá trasa")
    cols = st.columns(len(actions))
    for col, (action, label, meta) in zip(cols, actions):
        with col:
            button_label = f"{label} · {meta}"
            if st.button(
                button_label,
                width="stretch",
                key=f"{prefix}_shortcut_{hashlib.sha1(action.encode('utf-8')).hexdigest()[:8]}",
            ):
                if action == "local":
                    st.session_state[f"{prefix}_arr"] = dep
                elif action == "home":
                    st.session_state[f"{prefix}_arr"] = home
                elif action == "reverse":
                    st.session_state[f"{prefix}_dep"] = arr
                    st.session_state[f"{prefix}_arr"] = dep
                elif action.startswith("dest:"):
                    st.session_state[f"{prefix}_arr"] = action.split(":", 1)[1]


def _prepare_next_manual_entry(prefix: str, saved: dict[str, Any]) -> None:
    """Keep continuity for another leg while clearing flight-specific values."""
    next_departure = normalize_text(saved.get("arrival")) or normalize_text(saved.get("departure"))
    values = {
        "date": saved.get("date") if isinstance(saved.get("date"), date) else date.today(),
        "reg": normalize_registration(saved.get("registration")),
        "ev": (normalize_text(saved.get("evidence")) or "").upper(),
        "type": normalize_text(saved.get("aircraft_type")),
        "class": (normalize_text(saved.get("aircraft_class")) or "").upper(),
        "dep": next_departure.upper(),
        "arr": "",
        "off": "",
        "to": "",
        "ldg": "",
        "on": "",
        "starts": 1,
        "cmd": normalize_text(saved.get("commander")) or current_user_display_name(),
        "instr": normalize_text(saved.get("instructor")),
        "role": (normalize_text(saved.get("role")) or "").upper() or current_user_default_role(),
        "task": normalize_text(saved.get("task")),
        "price": float(saved.get("price_per_hour") or 0),
        "billing_basis": _normalize_billing_basis(saved.get("billing_basis")),
        "note": "",
    }
    for suffix, value in values.items():
        st.session_state[f"{prefix}_{suffix}"] = value
    if values["reg"]:
        st.session_state[f"{prefix}_aircraft_pick"] = values["reg"]


def flight_form(
    prefix: str,
    defaults: dict[str, Any],
    rates: pd.DataFrame,
    submit_label: str,
    *,
    quick_tools: bool = True,
    prompt_missing_aircraft: bool = True,
    compact_layout: bool = False,
    allow_add_another: bool = False,
) -> dict[str, Any] | None:
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

    inferred_reg = normalize_registration(
        st.session_state.get(f"{prefix}_reg", defaults.get("registration"))
    )
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
    reg = str(
        st.session_state.get(f"{prefix}_reg", defaults.get("registration") or "")
    ).upper()
    default_rate_date = defaults.get("date") or date.today()
    rate = lookup_latest_rate(rates, reg, default_rate_date)
    default_price = st.session_state.get(
        f"{prefix}_price",
        defaults.get("price_per_hour") or rate.get("price_per_hour") or 0.0,
    )
    default_type = st.session_state.get(
        f"{prefix}_type",
        defaults.get("aircraft_type") or rate.get("aircraft_type") or "",
    )
    default_billing_basis = _normalize_billing_basis(
        st.session_state.get(
            f"{prefix}_billing_basis",
            defaults.get("billing_basis") or "BLOCK",
        )
    )

    with st.form(prefix):
        if compact_layout:
            st.markdown('<div class="flight-entry-section-label">Základ letu</div>', unsafe_allow_html=True)

            top1, top2, top3, top4 = st.columns([1.05, 1.15, 1, .8])
            with top1:
                flight_date = st.date_input(
                    "Datum",
                    value=defaults.get("date")
                    if isinstance(defaults.get("date"), date)
                    else pd.to_datetime(defaults.get("date") or date.today()).date(),
                    key=f"{prefix}_date",
                )
            with top2:
                registration = st.text_input(
                    "Imatrikulace",
                    value=reg,
                    key=f"{prefix}_reg",
                ).upper()
            with top3:
                role_def = st.session_state.get(
                    f"{prefix}_role",
                    defaults.get("role") or "PIC",
                )
                role = st.selectbox(
                    "Funkce",
                    ROLE_OPTIONS,
                    index=ROLE_OPTIONS.index(role_def) if role_def in ROLE_OPTIONS else 0,
                    key=f"{prefix}_role",
                )
            with top4:
                starts = st.number_input(
                    "Přistání",
                    min_value=0,
                    step=1,
                    value=int(defaults.get("starts") or 1),
                    key=f"{prefix}_starts",
                )

            route1, route2 = st.columns(2)
            with route1:
                departure = st.text_input(
                    "Odlet",
                    value=str(defaults.get("departure") or ""),
                    key=f"{prefix}_dep",
                ).upper()
            with route2:
                arrival = st.text_input(
                    "Přílet",
                    value=str(defaults.get("arrival") or ""),
                    key=f"{prefix}_arr",
                ).upper()

            st.markdown('<div class="flight-entry-section-label">Časy</div>', unsafe_allow_html=True)
            time1, time2, time3, time4 = st.columns(4)
            with time1:
                off_block = st.text_input(
                    "Off Block",
                    value=str(defaults.get("off_block") or ""),
                    placeholder="HH:MM",
                    key=f"{prefix}_off",
                )
            with time2:
                takeoff = st.text_input(
                    "Takeoff",
                    value=str(defaults.get("takeoff") or ""),
                    placeholder="HH:MM",
                    key=f"{prefix}_to",
                )
            with time3:
                landing = st.text_input(
                    "Landing",
                    value=str(defaults.get("landing") or ""),
                    placeholder="HH:MM",
                    key=f"{prefix}_ldg",
                )
            with time4:
                on_block = st.text_input(
                    "On Block",
                    value=str(defaults.get("on_block") or ""),
                    placeholder="HH:MM",
                    key=f"{prefix}_on",
                )

            ev_def = st.session_state.get(
                f"{prefix}_ev",
                defaults.get("evidence") or evidence_from_registration(registration),
            )
            cls_def = st.session_state.get(
                f"{prefix}_class",
                defaults.get("aircraft_class") or default_class_for(ev_def),
            )

            with st.expander("Další údaje", expanded=False):
                ex1, ex2, ex3 = st.columns(3)
                with ex1:
                    evidence = st.selectbox(
                        "Evidence",
                        EVIDENCE_OPTIONS,
                        index=EVIDENCE_OPTIONS.index(ev_def) if ev_def in EVIDENCE_OPTIONS else 0,
                        key=f"{prefix}_ev",
                    )
                    aircraft_type = st.text_input(
                        "Typ",
                        value=str(default_type or ""),
                        key=f"{prefix}_type",
                    )
                    aircraft_class = st.selectbox(
                        "Třída",
                        CLASS_OPTIONS,
                        index=CLASS_OPTIONS.index(cls_def) if cls_def in CLASS_OPTIONS else 0,
                        key=f"{prefix}_class",
                    )
                with ex2:
                    commander = st.text_input(
                        "Velitel",
                        value=str(defaults.get("commander") or current_user_display_name()),
                        key=f"{prefix}_cmd",
                    )
                    instructor = st.text_input(
                        "Instruktor",
                        value=str(defaults.get("instructor") or ""),
                        key=f"{prefix}_instr",
                    )
                    task = st.text_input(
                        "Úloha",
                        value=str(defaults.get("task") or ""),
                        key=f"{prefix}_task",
                    )
                with ex3:
                    price = st.number_input(
                        f"Cena {currency_symbol()}/h",
                        min_value=0.0,
                        step=50.0,
                        value=float(default_price or 0),
                        key=f"{prefix}_price",
                    )
                    billing_basis = st.selectbox(
                        "Účtovat podle",
                        BILLING_BASIS_OPTIONS,
                        index=BILLING_BASIS_OPTIONS.index(default_billing_basis)
                        if default_billing_basis in BILLING_BASIS_OPTIONS
                        else 0,
                        key=f"{prefix}_billing_basis",
                        format_func=_billing_basis_label,
                    )
                    note = st.text_input(
                        "Poznámka",
                        value=str(defaults.get("note") or ""),
                        key=f"{prefix}_note",
                    )
        else:
            col1, col2, col3 = st.columns(3)
            with col1:
                flight_date = st.date_input(
                    "Datum",
                    value=defaults.get("date")
                    if isinstance(defaults.get("date"), date)
                    else pd.to_datetime(defaults.get("date") or date.today()).date(),
                    key=f"{prefix}_date",
                )
                registration = st.text_input(
                    "Imatrikulace",
                    value=reg,
                    key=f"{prefix}_reg",
                ).upper()
                ev_def = st.session_state.get(
                    f"{prefix}_ev",
                    defaults.get("evidence") or evidence_from_registration(reg),
                )
                evidence = st.selectbox(
                    "Evidence",
                    EVIDENCE_OPTIONS,
                    index=EVIDENCE_OPTIONS.index(ev_def) if ev_def in EVIDENCE_OPTIONS else 0,
                    key=f"{prefix}_ev",
                )
                aircraft_type = st.text_input(
                    "Typ",
                    value=str(default_type or ""),
                    key=f"{prefix}_type",
                )
                cls_def = st.session_state.get(
                    f"{prefix}_class",
                    defaults.get("aircraft_class") or default_class_for(evidence),
                )
                aircraft_class = st.selectbox(
                    "Třída",
                    CLASS_OPTIONS,
                    index=CLASS_OPTIONS.index(cls_def) if cls_def in CLASS_OPTIONS else 0,
                    key=f"{prefix}_class",
                )
            with col2:
                departure = st.text_input(
                    "Odlet",
                    value=str(defaults.get("departure") or ""),
                    key=f"{prefix}_dep",
                ).upper()
                arrival = st.text_input(
                    "Přílet",
                    value=str(defaults.get("arrival") or ""),
                    key=f"{prefix}_arr",
                ).upper()
                off_block = st.text_input(
                    "Off Block",
                    value=str(defaults.get("off_block") or ""),
                    key=f"{prefix}_off",
                )
                takeoff = st.text_input(
                    "Takeoff",
                    value=str(defaults.get("takeoff") or ""),
                    key=f"{prefix}_to",
                )
                landing = st.text_input(
                    "Landing",
                    value=str(defaults.get("landing") or ""),
                    key=f"{prefix}_ldg",
                )
                on_block = st.text_input(
                    "On Block",
                    value=str(defaults.get("on_block") or ""),
                    key=f"{prefix}_on",
                )
            with col3:
                starts = st.number_input(
                    "Starty / přistání",
                    min_value=0,
                    step=1,
                    value=int(defaults.get("starts") or 1),
                    key=f"{prefix}_starts",
                )
                commander = st.text_input(
                    "Velitel",
                    value=str(defaults.get("commander") or current_user_display_name()),
                    key=f"{prefix}_cmd",
                )
                instructor = st.text_input(
                    "Instruktor",
                    value=str(defaults.get("instructor") or ""),
                    key=f"{prefix}_instr",
                )
                role_def = defaults.get("role") or "PIC"
                role = st.selectbox(
                    "Funkce",
                    ROLE_OPTIONS,
                    index=ROLE_OPTIONS.index(role_def) if role_def in ROLE_OPTIONS else 0,
                    key=f"{prefix}_role",
                )
                price = st.number_input(
                    f"Cena {currency_symbol()}/h",
                    min_value=0.0,
                    step=50.0,
                    value=float(default_price or 0),
                    key=f"{prefix}_price",
                )
                billing_basis = st.selectbox(
                    "Účtovat podle",
                    BILLING_BASIS_OPTIONS,
                    index=BILLING_BASIS_OPTIONS.index(default_billing_basis)
                    if default_billing_basis in BILLING_BASIS_OPTIONS
                    else 0,
                    key=f"{prefix}_billing_basis",
                    format_func=_billing_basis_label,
                )
                task = st.text_input(
                    "Úloha",
                    value=str(defaults.get("task") or ""),
                    key=f"{prefix}_task",
                )
                note = st.text_input(
                    "Poznámka",
                    value=str(defaults.get("note") or ""),
                    key=f"{prefix}_note",
                )

        form_data = {
            "date": flight_date,
            "evidence": evidence,
            "registration": registration,
            "aircraft_type": aircraft_type,
            "aircraft_class": aircraft_class,
            "departure": departure,
            "arrival": arrival,
            "off_block": off_block,
            "takeoff": takeoff,
            "landing": landing,
            "on_block": on_block,
            "starts": int(starts),
            "commander": commander,
            "instructor": instructor,
            "role": role,
            "task": task,
            "price_per_hour": price,
            "billing_basis": billing_basis,
            "note": note,
        }

        block = minutes_diff(off_block, on_block)
        air = minutes_diff(takeoff, landing)
        c1, c2, c3 = st.columns(3)
        with c1:
            metric_card("Block Time", fmt_minutes(block), "")
        with c2:
            metric_card("Air Time", fmt_minutes(air), "")
        bill_minutes = air if billing_basis == "AIR" else block
        with c3:
            metric_card(
                "Cena letu",
                fmt_money((bill_minutes or 0) / 60 * price, current_user_currency()),
                _billing_basis_label(billing_basis),
            )

        preview_errors, preview_warnings = validate_flight_data(form_data)
        if preview_errors:
            st.error("Kontrola: " + " • ".join(preview_errors[:5]))
        elif preview_warnings:
            if compact_layout:
                st.caption("Kontrola: " + " • ".join(preview_warnings[:4]))
            else:
                st.warning("Kontrola: " + " • ".join(preview_warnings[:5]))

        submitted = False
        add_another = False
        if compact_layout and allow_add_another:
            s1, s2 = st.columns([1.15, 1])
            with s1:
                submitted = st.form_submit_button(
                    submit_label,
                    type="primary",
                    width="stretch",
                )
            with s2:
                add_another = st.form_submit_button(
                    "Uložit a přidat další",
                    width="stretch",
                )
        else:
            submitted = st.form_submit_button(
                submit_label,
                type="primary",
                width="stretch",
            )

    if submitted or add_another:
        errors, _warnings = validate_flight_data(form_data)
        if errors:
            return None
        form_data["_entry_action"] = "another" if add_another else "save"
        if prompt_missing_aircraft:
            submitted_reg = normalize_registration(form_data.get("registration"))
            bypass_reg = normalize_registration(st.session_state.get(bypass_key))
            if (
                submitted_reg
                and submitted_reg != bypass_reg
                and not _aircraft_profile_exists(submitted_reg)
            ):
                _prompt_inline_aircraft_profile(
                    prefix,
                    defaults,
                    form_data=form_data,
                )
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
def flight_detail_dialog(
    selected_id: int,
    row_data: dict[str, Any],
    rates: pd.DataFrame,
    dark_mode: bool,
    navigation_ids: list[int] | None = None,
) -> None:
    row = pd.Series(row_data)
    departure = html.escape(_safe_text(row_data.get("departure")) or "—")
    arrival = html.escape(_safe_text(row_data.get("arrival")) or "—")
    route_text = f"{departure} → {arrival}"
    st.markdown(
        f"""
        <div class="flight-detail-hero">
            <div class="flight-detail-route">{route_text}</div>
            <div class="flight-detail-meta">
                <span>{html.escape(_safe_text(row_data.get('date')) or 'bez data')}</span>
                <span>{html.escape(_safe_text(row_data.get('registration')) or 'bez imatrikulace')}</span>
                <span>{html.escape(_safe_text(row_data.get('evidence')) or 'bez evidence')}</span>
                <span>{html.escape(_safe_text(row_data.get('role')) or 'bez funkce')}</span>
                <span>ID {int(selected_id)}</span>
            </div>
        </div>
        """,
        unsafe_allow_html=True,
    )

    navigation = flight_navigation(navigation_ids or [], selected_id)
    if int(navigation.get("total") or 0) > 1:
        previous_id = navigation.get("previous_id")
        next_id = navigation.get("next_id")
        nav_left, nav_middle, nav_right = st.columns([1, 1.25, 1])
        with nav_left:
            if st.button(
                "← Předchozí",
                disabled=previous_id is None,
                width="stretch",
                key=f"detail_prev_{selected_id}",
            ):
                target = int(previous_id)
                st.session_state[f"detail_section_{target}"] = "Přehled"
                st.session_state["open_flight_dialog_id"] = target
                st.session_state["selected_flight_id"] = target
                st.rerun()
        with nav_middle:
            st.markdown(
                f'<div class="detail-position">{int(navigation.get("position") or 0)} / {int(navigation.get("total") or 0)} v aktuálním seznamu</div>',
                unsafe_allow_html=True,
            )
        with nav_right:
            if st.button(
                "Další →",
                disabled=next_id is None,
                width="stretch",
                key=f"detail_next_{selected_id}",
            ):
                target = int(next_id)
                st.session_state[f"detail_section_{target}"] = "Přehled"
                st.session_state["open_flight_dialog_id"] = target
                st.session_state["selected_flight_id"] = target
                st.rerun()
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
        block_text = html.escape(_safe_text(row.get("block_time")) or "—")
        air_text = html.escape(_safe_text(row.get("air_time")) or "—")
        price_text = html.escape(_safe_text(row.get("cost_label")) or "—")
        starts_text = html.escape(_safe_text(row.get("starts")) or "0")
        gps_count = int(_safe_float(row.get("track_count"), 0))
        gps_km = _safe_float(row.get("gps_km"), 0)

        aircraft = html.escape(_safe_text(row.get("registration")) or "—")
        aircraft_sub = html.escape(
            _join_nonblank([row.get("aircraft_type"), row.get("aircraft_class")]) or "—"
        )
        date_text = html.escape(_safe_text(row.get("date")) or "—")
        evidence_text = html.escape(_safe_text(row.get("evidence")) or "—")
        role_text = html.escape(_safe_text(row.get("role")) or "—")
        block_range = html.escape(_range_text(row.get("off_block"), row.get("on_block")) or "—")
        air_range = html.escape(_range_text(row.get("takeoff"), row.get("landing")) or "—")
        commander_text = html.escape(_safe_text(row.get("commander")) or "—")
        instructor_text = html.escape(_safe_text(row.get("instructor")) or "—")
        task_text = html.escape(_safe_text(row.get("task")) or "—")
        price_rate = html.escape(_price_rate_label(row.get("price_per_hour")) or "—")
        gps_text = f"{gps_count} track" + ("" if gps_count == 1 else "y")
        gps_detail = f"{gps_text} · {gps_km:.1f} km" if gps_count > 0 else "bez GPS tracku"

        st.markdown(
            f"""
            <div class="detail-grid">
              <div class="detail-card detail-card-primary">
                <div class="detail-card-label">Block</div>
                <div class="detail-card-value">{block_text}</div>
                <div class="detail-card-sub">{block_range}</div>
              </div>
              <div class="detail-card">
                <div class="detail-card-label">Air</div>
                <div class="detail-card-value">{air_text}</div>
                <div class="detail-card-sub">{air_range}</div>
              </div>
              <div class="detail-card">
                <div class="detail-card-label">Přistání</div>
                <div class="detail-card-value">{starts_text}</div>
                <div class="detail-card-sub">{evidence_text} · {role_text}</div>
              </div>
              <div class="detail-card">
                <div class="detail-card-label">Náklady</div>
                <div class="detail-card-value">{price_text}</div>
                <div class="detail-card-sub">{price_rate}</div>
              </div>
            </div>

            <div class="detail-split">
              <div class="detail-kv">
                <div class="detail-kv-title">Let a časy</div>
                <div class="detail-kv-row"><span>Datum</span><span>{date_text}</span></div>
                <div class="detail-kv-row"><span>Trasa</span><span>{route_text}</span></div>
                <div class="detail-kv-row"><span>Block</span><span>{block_range}</span></div>
                <div class="detail-kv-row"><span>Air</span><span>{air_range}</span></div>
                <div class="detail-kv-row"><span>GPS</span><span>{html.escape(gps_detail)}</span></div>
              </div>

              <div class="detail-kv">
                <div class="detail-kv-title">Letadlo a posádka</div>
                <div class="detail-kv-row"><span>Letadlo</span><span>{aircraft} · {aircraft_sub}</span></div>
                <div class="detail-kv-row"><span>Funkce</span><span>{role_text}</span></div>
                <div class="detail-kv-row"><span>Velitel</span><span>{commander_text}</span></div>
                <div class="detail-kv-row"><span>Instruktor</span><span>{instructor_text}</span></div>
                <div class="detail-kv-row"><span>Úloha</span><span>{task_text}</span></div>
              </div>
            </div>
            """,
            unsafe_allow_html=True,
        )

        note_text = _safe_text(row.get("note"))
        if note_text:
            st.markdown(
                f'<div class="detail-note"><div class="detail-kv-title">Poznámka</div>{html.escape(note_text)}</div>',
                unsafe_allow_html=True,
            )

        detail_errors, detail_warnings = validate_flight_data(row_data)
        if detail_errors:
            st.error("Kontrola letu: " + " • ".join(detail_errors[:5]))
        elif detail_warnings:
            with st.expander(
                f"Kontrola záznamu · {len(detail_warnings)} upozornění",
                expanded=False,
            ):
                st.warning(" • ".join(detail_warnings[:8]))
    elif detail_section == "Editace":
        edit_tracks = read_tracks_for_flight(int(selected_id), current_user_id())
        gps_proposal, _gps_points, _gps_track_row = _gps_proposal_from_tracks(edit_tracks)
        if gps_proposal:
            with st.expander("GPS návrh časů", expanded=False):
                _render_gps_time_proposal(gps_proposal, compact=True)
                g1, g2 = st.columns(2)
                with g1:
                    if st.button("Použít GPS Block + Air", key=f"edit_apply_gps_all_{selected_id}", width="stretch"):
                        _set_edit_times_from_gps(int(selected_id), gps_proposal, air_only=False)
                        st.toast("GPS časy byly vloženy do editace.")
                with g2:
                    if st.button("Použít jen Takeoff + Landing", key=f"edit_apply_gps_air_{selected_id}", width="stretch"):
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
            st.caption(
                "Tažením timeline nebo přímo grafu plynule posouváš let. "
                "Režim Sledovat letadlo drží mapu u aktuální pozice."
            )
            render_track_playback(first_points, int(selected_id), dark_mode)
            if gps_proposal:
                _render_gps_time_proposal(gps_proposal, compact=True)
                if st.button("Použít GPS časy v editaci", key=f"track_to_edit_gps_{selected_id}", type="secondary", width="stretch"):
                    _set_edit_times_from_gps(int(selected_id), gps_proposal, air_only=False)
                    st.session_state[f"_detail_pending_section_{selected_id}"] = "Editace"
                    st.session_state[f"_detail_flash_{selected_id}"] = "GPS návrh byl vložen do editace. Zkontroluj časy a ulož změny."
                    st.rerun()

            show = flight_tracks[["id","file_name","point_count","distance_km","start_utc","end_utc","max_alt_m"]].rename(columns={"id":"Track ID","file_name":"Soubor","point_count":"Body","distance_km":"Km","start_utc":"Start UTC","end_utc":"End UTC","max_alt_m":"Max alt m"})
            with st.expander("GPS soubory", expanded=False):
                st.dataframe(show, hide_index=True, width="stretch")
                del_id = st.selectbox("Track", show["Track ID"].tolist(), format_func=lambda x: f"Track ID {x}", key=f"delete_track_select_{selected_id}")
                confirm_track_delete = st.checkbox("Potvrzuji smazání vybraného tracku", value=False, key=f"confirm_track_delete_{selected_id}")
                if st.button("Smazat vybraný track", type="secondary", disabled=not confirm_track_delete, width="stretch", key=f"delete_track_btn_{selected_id}"):
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
                    if st.button("Uložit track k letu", type="primary", width="stretch"):
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
            if st.button("Trvale smazat let", type="primary", width="stretch", key=f"delete_flight_btn_{selected_id}"):
                if confirm.strip() == str(selected_id):
                    delete_flight(int(selected_id))
                    st.success(f"Let ID {selected_id} byl smazán.")
                    clear_open_flight_dialog()
                    st.rerun()
                else:
                    st.error("Potvrzení nesouhlasí. Napiš přesné ID letu.")
        with c_cancel:
            if st.button("Nemazat", width="stretch", key=f"delete_flight_cancel_{selected_id}"):
                clear_open_flight_dialog()
                st.rerun()
    if st.button("Zavřít detail", width="stretch"):
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
    return html.escape(_clean_text(value), quote=True)


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
    main_txt = html.escape(_safe_text(main))
    sub_txt = html.escape(_safe_text(sub))
    if sub_txt:
        return f'<div class="flight-cell"><div class="flight-cell-main">{main_txt}</div><div class="flight-cell-sub">{sub_txt}</div></div>'
    return f'<div class="flight-cell"><div class="flight-cell-main">{main_txt}</div></div>'






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


def render_flight_list(
    table_df: pd.DataFrame,
    dark_mode: bool,
    rates: pd.DataFrame | None = None,
) -> None:
    """Clean paginated logbook list.

    Only one Streamlit button is rendered per visible flight. Edit, GPS and
    deletion actions live inside the detail dialog, which cuts widget count
    and makes the overview substantially easier to scan.
    """
    if table_df.empty:
        st.info("Filtr nevrátil žádné lety.")
        return

    controls = st.columns([2.5, .8, .9, 1.0])
    with controls[0]:
        quick_filter = st.text_input(
            "Rychlé hledání",
            value="",
            placeholder="registrace, letiště, typ, funkce…",
            key="flight_table_quick_filter_v066",
        )
    with controls[1]:
        page_size_choice = st.selectbox(
            "Řádků",
            [25, 50, 100, "Vše"],
            index=0,
            key="flight_page_size_v066",
        )

    shown_table = quick_search_flights(table_df, quick_filter).reset_index(drop=True)
    total_rows = len(shown_table)
    show_all_rows = page_size_choice == "Vše"
    page_size = total_rows if show_all_rows else int(page_size_choice)
    page_size = max(1, page_size)
    page_count = max(1, math.ceil(total_rows / page_size))

    with controls[2]:
        if show_all_rows:
            page = 1
            st.text_input(
                "Stránka",
                value="Vše",
                disabled=True,
                key="flight_page_all_v066",
            )
        else:
            page = st.number_input(
                "Stránka",
                min_value=1,
                max_value=page_count,
                value=min(
                    max(1, int(st.session_state.get("flight_page_v066", 1))),
                    page_count,
                ),
                step=1,
                key="flight_page_v066",
            )
    with controls[3]:
        st.markdown(
            f'<div class="flight-page-info">{total_rows} letů • {page_count} stran</div>',
            unsafe_allow_html=True,
        )

    if shown_table.empty:
        st.info("Rychlé hledání nevrátilo žádné lety.")
        return

    start = 0 if show_all_rows else (int(page) - 1) * page_size
    end = total_rows if show_all_rows else start + page_size
    page_rows = shown_table.iloc[start:end].copy()

    widths = [0.72, 0.92, 1.18, 1.24, 1.17, 0.76, 1.02, 0.58, 0.68]
    headers = [
        "Detail",
        "Datum",
        "Letadlo",
        "Trasa",
        "Časy",
        "Block",
        "Funkce",
        "Přist.",
        "GPS",
    ]
    hcols = st.columns(widths, gap="small", vertical_alignment="top")
    for col, header in zip(hcols, headers):
        col.markdown(
            f'<div class="flight-list-head">{header}</div>',
            unsafe_allow_html=True,
        )
    st.markdown('<div class="flight-list-first-gap"></div>', unsafe_allow_html=True)

    for _, row in page_rows.iterrows():
        flight_id = int(row.get("id"))
        cols = st.columns(widths, gap="small", vertical_alignment="top")

        with cols[0]:
            if st.button(
                "Detail",
                key=f"flight_detail_btn_v066_{flight_id}",
                width="stretch",
            ):
                st.session_state[f"detail_section_{flight_id}"] = "Přehled"
                st.session_state["open_flight_dialog_id"] = flight_id
                st.session_state["selected_flight_id"] = flight_id
                st.session_state.pop("dismissed_flight_id", None)
                st.rerun()

        cols[1].markdown(
            _cell(row.get("date"), row.get("evidence")),
            unsafe_allow_html=True,
        )

        aircraft_sub = _join_nonblank(
            [row.get("aircraft_type"), row.get("aircraft_class")]
        )
        cols[2].markdown(
            _cell(row.get("registration"), aircraft_sub),
            unsafe_allow_html=True,
        )

        cols[3].markdown(
            _cell(_range_text(row.get("departure"), row.get("arrival"))),
            unsafe_allow_html=True,
        )

        block_range = _range_text(row.get("off_block"), row.get("on_block"))
        air_range = _range_text(row.get("takeoff"), row.get("landing"))
        cols[4].markdown(
            _cell(block_range, f"Air {air_range}" if air_range else ""),
            unsafe_allow_html=True,
        )

        cols[5].markdown(
            _cell(
                row.get("block_time"),
                f"Air {row.get('air_time') or ''}" if row.get("air_time") else "",
            ),
            unsafe_allow_html=True,
        )

        crew_sub = _safe_text(row.get("commander"))
        if not _is_blank(row.get("instructor")):
            crew_sub = _join_nonblank([crew_sub, f"Instr. {row.get('instructor')}"])
        cols[6].markdown(
            _cell(row.get("role"), crew_sub),
            unsafe_allow_html=True,
        )

        cols[7].markdown(
            _cell(_safe_int(row.get("starts"))),
            unsafe_allow_html=True,
        )

        track_count = _safe_int(row.get("track_count"))
        gps_km = _safe_float(row.get("gps_km"))
        cols[8].markdown(
            _cell(
                "GPS" if track_count > 0 else "—",
                f"{gps_km:.0f} km" if track_count > 0 else "",
            ),
            unsafe_allow_html=True,
        )
        st.markdown('<div class="flight-row-sep"></div>', unsafe_allow_html=True)

    open_id = st.session_state.get("open_flight_dialog_id")
    valid_ids = set(shown_table["id"].astype(int).tolist())
    if open_id is not None and int(open_id) in valid_ids:
        dialog_row = shown_table[
            shown_table["id"].astype(int).eq(int(open_id))
        ].iloc[0]
        dialog_rates = rates if rates is not None else read_rates(current_user_id())
        navigation_ids = shown_table["id"].astype(int).tolist()
        flight_detail_dialog(
            int(open_id),
            dialog_row.to_dict(),
            dialog_rates,
            dark_mode,
            navigation_ids=navigation_ids,
        )


def _format_recency_date(value: object) -> str:
    if value is None or value == "":
        return "—"
    try:
        return pd.Timestamp(value).strftime("%d. %m. %Y")
    except Exception:
        return str(value)


def _days_since_text(value: object) -> str:
    if value is None:
        return "bez záznamu"
    days = int(value)
    if days == 0:
        return "dnes"
    if days == 1:
        return "před 1 dnem"
    return f"před {days} dny"


def _recency_activity_tone(landings: int) -> str:
    if int(landings or 0) >= 3:
        return "ok"
    if int(landings or 0) > 0:
        return "warn"
    return "bad"


def _render_recency_card(label: str, value: str, sub: str, tone: str = "") -> None:
    tone_class = f" {tone}" if tone else ""
    st.markdown(
        f"""
        <div class="recency-card{tone_class}">
          <div class="recency-card-label">{html.escape(label)}</div>
          <div class="recency-card-value">{html.escape(value)}</div>
          <div class="recency-card-sub">{html.escape(sub)}</div>
        </div>
        """,
        unsafe_allow_html=True,
    )


def _render_profile_validity_tab(df: pd.DataFrame) -> None:
    """Compact validity/recency section embedded in the user profile."""
    uid = strict_user_id(current_user_id())
    today = datetime.now(LOCAL_TZ).date()
    activity = last_activity(df, today)
    recency = recency_by_evidence(df, today, days=90)
    recency_map = {str(row["evidence"]): row for _, row in recency.iterrows()}

    st.markdown("### Doklady a platnosti")
    st.caption("Medical, licence, ratingy, průkazy a další termíny. Upozornění se řídí nastaveným předstihem.")

    expiries = read_table("user_expiries", uid)
    overview = expiry_overview(expiries, today)

    if overview.empty:
        st.info("Zatím nemáš uložený žádný termín platnosti.")
    else:
        for _, row in overview.iterrows():
            state = str(row.get("state") or "missing")
            pill_class = state if state in {"ok", "warning", "expired"} else ""
            days_left = row.get("days_left")
            if days_left is None or pd.isna(days_left):
                remain = "bez data"
            elif int(days_left) < 0:
                remain = f"{abs(int(days_left))} dní po expiraci"
            elif int(days_left) == 0:
                remain = "expiruje dnes"
            else:
                remain = f"zbývá {int(days_left)} dní"

            st.markdown(
                f"""
                <div class="validity-card">
                  <div class="validity-head">
                    <div>
                      <div class="validity-title">{html.escape(str(row.get('label') or ''))}</div>
                      <div class="validity-meta">
                        {html.escape(str(row.get('category') or 'Doklad'))}
                        • do {_format_recency_date(row.get('expiry_date'))}
                        • {html.escape(remain)}
                      </div>
                    </div>
                    <span class="recency-status-pill {pill_class}">
                      {html.escape(str(row.get('status') or ''))}
                    </span>
                  </div>
                </div>
                """,
                unsafe_allow_html=True,
            )

    with st.expander("Přidat nový termín", expanded=overview.empty):
        with st.form("add_user_expiry_v0631", clear_on_submit=True):
            a1, a2 = st.columns(2)
            with a1:
                category = st.selectbox("Kategorie", EXPIRY_CATEGORIES, key="expiry_category_new_v0631")
                label = st.text_input(
                    "Název", placeholder="Medical Class 2 / SEP / ULL průkaz…", key="expiry_label_new_v0631"
                )
            with a2:
                expiry_date_value = st.date_input("Platnost do", value=today, key="expiry_date_new_v0631")
                warning_days = st.number_input(
                    "Upozornit předem (dní)", min_value=0, max_value=3650, value=30, step=1, key="expiry_warning_new_v0631"
                )
            note = st.text_input("Poznámka", value="", key="expiry_note_new_v0631")
            add_expiry = st.form_submit_button("Přidat termín", type="primary", width="stretch")

        if add_expiry:
            try:
                save_user_expiry(
                    label=label, category=category, expiry_date=expiry_date_value, warning_days=int(warning_days), note=note
                )
                st.success("Termín byl uložen.")
                st.rerun()
            except Exception as exc:
                st.error(str(exc))

    if not expiries.empty:
        active_records = expiries.copy()
        if "active" in active_records.columns:
            active_records = active_records[
                pd.to_numeric(active_records["active"], errors="coerce").fillna(0).astype(int).eq(1)
            ]

        if not active_records.empty:
            with st.expander("Upravit nebo odstranit termín", expanded=False):
                records = {
                    int(row["id"]): row
                    for _, row in active_records.sort_values(["expiry_date", "label"]).iterrows()
                }
                ids = list(records)
                selected_id = int(st.selectbox(
                    "Termín", ids,
                    format_func=lambda rid: f"{records[rid].get('label') or ''} • {records[rid].get('expiry_date') or '—'}",
                    key="expiry_edit_select_v0631",
                ))
                selected = records[selected_id]
                category_value = str(selected.get("category") or "Jiné")
                if category_value not in EXPIRY_CATEGORIES:
                    category_value = "Jiné"
                try:
                    selected_date = pd.Timestamp(selected.get("expiry_date")).date()
                except Exception:
                    selected_date = today

                with st.form(f"edit_user_expiry_v0631_{selected_id}"):
                    e1, e2 = st.columns(2)
                    with e1:
                        edit_category = st.selectbox(
                            "Kategorie", EXPIRY_CATEGORIES, index=EXPIRY_CATEGORIES.index(category_value), key=f"expiry_category_edit_v0631_{selected_id}"
                        )
                        edit_label = st.text_input("Název", value=str(selected.get("label") or ""), key=f"expiry_label_edit_v0631_{selected_id}")
                    with e2:
                        edit_date = st.date_input("Platnost do", value=selected_date, key=f"expiry_date_edit_v0631_{selected_id}")
                        edit_warning = st.number_input(
                            "Upozornit předem (dní)", min_value=0, max_value=3650, value=int(selected.get("warning_days") or 0), step=1, key=f"expiry_warning_edit_v0631_{selected_id}"
                        )
                    edit_note = st.text_input("Poznámka", value=str(selected.get("note") or ""), key=f"expiry_note_edit_v0631_{selected_id}")
                    save_edit = st.form_submit_button("Uložit změny", type="primary", width="stretch")

                if save_edit:
                    try:
                        save_user_expiry(
                            expiry_id=selected_id, label=edit_label, category=edit_category, expiry_date=edit_date, warning_days=int(edit_warning), note=edit_note
                        )
                        st.success("Změny byly uloženy.")
                        st.rerun()
                    except Exception as exc:
                        st.error(str(exc))

                if st.button("Odstranit termín", width="stretch", key=f"delete_expiry_v0631_{selected_id}"):
                    try:
                        delete_user_expiry(selected_id)
                        st.success("Termín byl odstraněn.")
                        st.rerun()
                    except Exception as exc:
                        st.error(str(exc))

    st.markdown("### Letová aktivita")
    st.caption("Pouze orientační přehled podle záznamů v logbooku.")

    ull = recency_map.get("ULL", {})
    easa = recency_map.get("EASA", {})
    c1, c2, c3 = st.columns(3)

    with c1:
        _render_recency_card(
            "Poslední let",
            _format_recency_date(activity.get("last_flight_date")),
            _days_since_text(activity.get("days_since_last_flight")),
        )

    with c2:
        ull_landings = int(ull.get("pic_landings", 0) or 0)
        _render_recency_card(
            "PIC ULL • 90 dní",
            str(ull_landings),
            f"přistání • {fmt_minutes(int(ull.get('pic_minutes', 0) or 0))}",
            _recency_activity_tone(ull_landings),
        )

    with c3:
        easa_landings = int(easa.get("pic_landings", 0) or 0)
        _render_recency_card(
            "PIC EASA • 90 dní",
            str(easa_landings),
            f"přistání • {fmt_minutes(int(easa.get('pic_minutes', 0) or 0))}",
            _recency_activity_tone(easa_landings),
        )

    st.caption(
        "90denní údaje jsou informační aktivita, ne právní rozhodnutí ani automatické potvrzení recency; nezohledňují např. den/noc nebo všechny další regulatorní podmínky."
    )



def page_logbook(df: pd.DataFrame, dark_mode: bool):
    st.markdown("## Lety")
    notice = st.session_state.pop("_post_import_notice", None)
    if notice:
        st.success(str(notice))
    filtered = apply_logbook_filters_v2(df)
    s = build_summary(filtered)
    c1, c2, c3, c4 = st.columns(4)
    with c1:
        metric_card("Lety", str(s["flights"]), "zobrazeno")
    with c2:
        metric_card("Block", fmt_minutes(s["total"]), "celkový čas")
    with c3:
        metric_card("PIC", fmt_minutes(s["pic"]), "z filtrovaných letů")
    with c4:
        metric_card("Přistání", str(s["starts"]), f"{s['tracks']} GPS tracků")

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



def render_import_stepper(active_step: int, *, caption: str = "") -> None:
    """Compact four-step import progress indicator used by KML workflows."""
    active = max(1, min(4, int(active_step or 1)))
    labels = [
        (1, "KML", "Soubor"),
        (2, "Smart KML", "Analýza"),
        (3, "Údaje letu", "Kontrola polí"),
        (4, "Finální kontrola", "Uložit"),
    ]
    items: list[str] = []
    for number, title, subtitle in labels:
        state = "done" if number < active else ("active" if number == active else "todo")
        icon = "✓" if number < active else str(number)
        items.append(
            f'<div class="lb-import-step {state}">'
            f'<span class="lb-import-step-dot">{icon}</span>'
            f'<span><b>{title}</b><small>{subtitle}</small></span>'
            f'</div>'
        )
    st.markdown(
        """
        <style>
        .lb-import-steps{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin:8px 0 18px 0}
        .lb-import-step{display:flex;align-items:center;gap:9px;padding:10px 12px;border:1px solid rgba(125,150,175,.28);border-radius:13px;background:rgba(15,36,58,.36);min-width:0}
        .lb-import-step span:last-child{min-width:0;display:flex;flex-direction:column;line-height:1.15}
        .lb-import-step b{font-size:.86rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .lb-import-step small{opacity:.62;font-size:.72rem;margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .lb-import-step-dot{width:25px;height:25px;min-width:25px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;border:1px solid rgba(130,170,205,.5);font-size:.78rem;font-weight:700}
        .lb-import-step.done{opacity:.78}.lb-import-step.done .lb-import-step-dot{background:rgba(43,190,125,.18);border-color:rgba(43,190,125,.6)}
        .lb-import-step.active{border-color:#38bdf8;background:rgba(56,189,248,.11)}
        .lb-import-step.active .lb-import-step-dot{background:#38bdf8;color:#062033;border-color:#38bdf8}
        @media(max-width:700px){.lb-import-steps{grid-template-columns:repeat(2,minmax(0,1fr))}}
        </style>
        """ + f'<div class="lb-import-steps">{"".join(items)}</div>',
        unsafe_allow_html=True,
    )
    if caption:
        st.caption(caption)


def _import_review_metrics(saved: dict[str, Any]) -> dict[str, Any]:
    block = minutes_diff(saved.get("off_block"), saved.get("on_block"))
    air = minutes_diff(saved.get("takeoff"), saved.get("landing"))
    basis = _normalize_billing_basis(saved.get("billing_basis") or "BLOCK")
    billed = air if basis == "AIR" else block
    price = float(saved.get("price_per_hour") or 0)
    cost = (float(billed or 0) / 60.0) * price
    return {"block": block, "air": air, "basis": basis, "price": price, "cost": cost}


def render_import_final_review(
    saved: dict[str, Any],
    *,
    points: list[dict[str, Any]] | None,
    file_name: str | None,
    dark_mode: bool,
    key_prefix: str,
    heading: str = "Finální kontrola před uložením",
) -> str | None:
    """Render a non-destructive final review and return ``save`` / ``back``."""
    st.markdown(f"### {heading}")
    st.info("Ještě se nic neuložilo. Zkontroluj údaje a až potom potvrď uložení letu.")

    metrics = _import_review_metrics(saved)
    route = f"{normalize_text(saved.get('departure')) or '—'} → {normalize_text(saved.get('arrival')) or '—'}"
    time_range = f"{normalize_text(saved.get('takeoff')) or '—'}–{normalize_text(saved.get('landing')) or '—'}"
    date_value = saved.get("date")
    try:
        date_label = pd.to_datetime(date_value).strftime("%d.%m.%Y") if date_value else "—"
    except Exception:
        date_label = str(date_value or "—")

    c1, c2, c3, c4 = st.columns(4)
    with c1:
        metric_card("Datum", date_label, normalize_text(saved.get("evidence")) or "")
    with c2:
        metric_card("Letadlo", normalize_registration(saved.get("registration")) or "—", normalize_text(saved.get("aircraft_type")) or "")
    with c3:
        metric_card("Trasa", route, normalize_text(saved.get("role")) or "")
    with c4:
        metric_card("Air", time_range, f"{fmt_minutes(metrics['air']) or '—'}")

    d1, d2, d3, d4 = st.columns(4)
    with d1:
        metric_card("Block", fmt_minutes(metrics["block"]) or "—", f"{normalize_text(saved.get('off_block')) or '—'}–{normalize_text(saved.get('on_block')) or '—'}")
    with d2:
        metric_card("Starty / přistání", str(int(saved.get("starts") or 0)), "")
    with d3:
        metric_card("Sazba", _price_rate_label(metrics["price"]), _billing_basis_label(metrics["basis"]))
    with d4:
        metric_card("Cena letu", fmt_money(metrics["cost"], current_user_currency()), _billing_basis_label(metrics["basis"]))

    detail_bits = [
        f"**Velitel:** {normalize_text(saved.get('commander')) or '—'}",
        f"**Instruktor:** {normalize_text(saved.get('instructor')) or '—'}",
        f"**Třída:** {normalize_text(saved.get('aircraft_class')) or '—'}",
        f"**Úloha:** {normalize_text(saved.get('task')) or '—'}",
    ]
    st.markdown(" · ".join(detail_bits))
    if normalize_text(saved.get("note")):
        st.caption(f"Poznámka: {normalize_text(saved.get('note'))}")

    errors, warnings = validate_flight_data(saved)
    if errors:
        st.error("Před uložením je nutné opravit: " + " • ".join(errors[:6]))
    elif warnings:
        st.warning("Kontrola: " + " • ".join(warnings[:6]))
    else:
        st.success("Kontrola údajů neodhalila žádný problém.")

    if points and len(points) >= 2:
        stats = track_stats(points)
        preview_df = pd.DataFrame([{
            "id": -777,
            "flight_id": -777,
            "coordinates_json": json.dumps(points),
            "file_name": file_name or "track.kml",
            "distance_km": stats.get("distance_km"),
            "date": saved.get("date"),
            "registration": saved.get("registration"),
            "departure": saved.get("departure"),
            "arrival": saved.get("arrival"),
            "role": saved.get("role"),
            "evidence": saved.get("evidence"),
        }])
        render_folium_readonly(
            make_map(preview_df, dark_mode),
            height=330,
            key=f"final_review_map_{key_prefix}_{len(points)}",
        )
        with st.expander("GPS / profil tracku", expanded=False):
            st.caption(f"{len(points)} GPS bodů · {float(stats.get('distance_km') or 0):.1f} km")
            render_track_profile(points)

    b1, b2 = st.columns([1, 1.6])
    with b1:
        if st.button("← Upravit údaje", width="stretch", key=f"review_back_{key_prefix}"):
            return "back"
    with b2:
        if st.button("Uložit let", type="primary", width="stretch", disabled=bool(errors), key=f"review_save_{key_prefix}"):
            return "save"
    return None


def _single_import_review_key(signature: str) -> str:
    return f"kml_import_review_{signature}"


def _split_import_review_key(signature: str, progress: int) -> str:
    return f"split_import_review_{signature}_{int(progress)}"


def _clear_import_review_keys(signature: str) -> None:
    prefix = f"kml_import_review_{signature}"
    for key in list(st.session_state.keys()):
        if str(key).startswith(prefix) or str(key).startswith(f"split_import_review_{signature}_"):
            st.session_state.pop(key, None)

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
    review_key = _split_import_review_key(signature, progress)
    review_payload = st.session_state.get(review_key)

    render_import_stepper(
        4 if isinstance(review_payload, dict) else 3,
        caption=f"Rozdělený import · let {progress + 1} z {len(parts)}",
    )

    if isinstance(review_payload, dict):
        decision = render_import_final_review(
            review_payload,
            points=current,
            file_name=current_name,
            dark_mode=dark_mode,
            key_prefix=f"split_{signature}_{progress}",
            heading=f"Finální kontrola · let {progress + 1} z {len(parts)}",
        )
        if decision == "back":
            st.session_state.pop(review_key, None)
            st.rerun()
        if decision != "save":
            return

        if not locked:
            st.session_state[locked_key] = [int(x) for x in effective_splits]
        flight_id = create_flight(review_payload, auto_backup=False)
        save_track(flight_id, current_name, current, replace_existing=True)
        created_ids.append(int(flight_id))
        st.session_state[created_key] = created_ids
        st.session_state.pop(review_key, None)

        if progress + 1 < len(parts):
            st.session_state[progress_key] = progress + 1
            st.rerun()

        _clear_import_review_keys(signature)
        _clear_smart_import_progress(signature)
        st.session_state["page"] = "Lety"
        st.session_state["open_flight_dialog_id"] = int(created_ids[-1])
        st.session_state["selected_flight_id"] = int(created_ids[-1])
        st.session_state.pop("dismissed_flight_id", None)
        st.session_state["_post_import_notice"] = f"Smart KML uložil {len(created_ids)} samostatné lety: " + ", ".join(f"ID {x}" for x in created_ids)
        st.rerun()

    st.markdown(f"### Údaje letu · část {progress + 1} z {len(parts)}")
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
        "Pokračovat na finální kontrolu",
    )
    if saved is not None:
        st.session_state[review_key] = dict(saved)
        st.rerun()

def page_new_flight(rates: pd.DataFrame, dark_mode: bool):
    st.markdown("## Nový let")

    mode = st.radio(
        "Způsob přidání",
        ["KML import", "Ručně"],
        horizontal=True,
        label_visibility="collapsed",
        key="new_flight_mode_v061",
    )

    if mode == "KML import":
        uploaded = st.file_uploader("KML track", type=["kml"], key="new_track_kml_v061")
        if uploaded is None:
            render_import_stepper(1, caption="Nahraj KML soubor. Nic se neuloží, dokud neprojdeš finální kontrolou.")
            st.info("Po nahrání Logbook provede Smart KML analýzu, navrhne případné rozdělení a před uložením zobrazí finální souhrn.")
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
        render_import_stepper(2, caption=f"{uploaded.name} · {len(points)} GPS bodů")
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

        # Explicit fallback chosen by the user, or no split was detected. Keep the
        # original KML intact and import it as one flight.
        _clear_smart_import_progress(signature)
        defaults = infer_from_track(points, uploaded.name, rates, smart_analysis=smart)
        stats = defaults.pop("stats")
        defaults.pop("detect_idx", None)
        has_clock = defaults.pop("has_clock", False)
        review_key = _single_import_review_key(signature)
        review_payload = st.session_state.get(review_key)

        if isinstance(review_payload, dict):
            render_import_stepper(4, caption="Celý KML bude uložen jako jeden let.")
            decision = render_import_final_review(
                review_payload,
                points=points,
                file_name=uploaded.name,
                dark_mode=dark_mode,
                key_prefix=f"single_{signature}",
            )
            if decision == "back":
                st.session_state.pop(review_key, None)
                st.rerun()
            if decision == "save":
                flight_id = create_flight(review_payload, auto_backup=False)
                save_track(flight_id, uploaded.name, points, replace_existing=True)
                _clear_import_review_keys(signature)
                st.session_state["page"] = "Lety"
                st.session_state["open_flight_dialog_id"] = flight_id
                st.session_state["selected_flight_id"] = flight_id
                st.session_state.pop("dismissed_flight_id", None)
                st.session_state["_post_import_notice"] = f"KML uložen jako jeden let ID {flight_id}."
                st.rerun()
            return

        render_import_stepper(3, caption="Zkontroluj automaticky předvyplněné údaje. Další krok je finální náhled.")
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
            key=f"new_flight_preview_map_v061_{signature}_{len(points)}_{int(stats.get('distance_km') or 0)}",
        )

        if not has_clock:
            st.warning("KML neobsahuje spolehlivé časy. Doplň je ručně před pokračováním.")

        if int(smart.get("flight_count") or 1) > 1:
            st.info("Zvolil jsi nahrání bez rozdělení. Celý původní KML track bude uložen k jednomu záznamu beze změny.")

        show_profile = st.toggle("Profil tracku", value=False, key=f"show_import_profile_v061_{signature}_{len(points)}")
        if show_profile:
            render_track_profile(points)

        saved = flight_form("new_from_track_v061", defaults, rates, "Pokračovat na finální kontrolu")
        if saved is not None:
            st.session_state[review_key] = dict(saved)
            st.rerun()
    else:
        prefix = "new_manual_v065"
        flash = st.session_state.pop("_manual_entry_flash_v065", None)
        if flash:
            st.success(str(flash))

        history = session_read_flights(current_user_id())
        default_evidence = current_user_default_evidence()
        defaults, context = manual_entry_defaults(
            history,
            today=date.today(),
            home_airport=current_user_home_airport(),
            default_evidence=default_evidence,
            default_role=current_user_default_role(),
            commander=current_user_display_name(),
        )

        # Reuse the last aircraft only when it still has a profile. This avoids
        # opening the inline-aircraft dialog just because an old historical
        # registration is no longer active/configured.
        if defaults.get("registration") and not _aircraft_profile_exists(defaults["registration"]):
            defaults["registration"] = ""
        defaults["aircraft_class"] = default_class_for(default_evidence)

        _render_manual_entry_context(context, defaults)
        _render_manual_route_shortcuts(prefix, defaults, history)

        saved = flight_form(
            prefix,
            defaults,
            rates,
            "Uložit let",
            quick_tools=False,
            compact_layout=True,
            allow_add_another=True,
        )
        if saved is not None:
            action = str(saved.pop("_entry_action", "save"))
            flight_id = create_flight(saved)

            if action == "another":
                _prepare_next_manual_entry(prefix, saved)
                st.session_state["_manual_entry_flash_v065"] = (
                    f"Let ID {flight_id} uložen. Připravil jsem navazující úsek."
                )
                st.rerun()

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
        st.markdown(f'<div class="map-selection-panel"><div class="map-selection-title">{_safe_text(title)}</div></div>', unsafe_allow_html=True)
        return
    work = selection_df.sort_values(["date_dt", "off_block", "id"], ascending=[False, False, False], na_position="last").reset_index(drop=True)
    total_minutes = int(work.get("block_minutes", pd.Series(dtype=float)).fillna(0).sum()) if "block_minutes" in work else 0
    tracks = int(work.get("track_count", pd.Series(dtype=float)).fillna(0).sum()) if "track_count" in work else 0
    gps = float(work.get("gps_km", pd.Series(dtype=float)).fillna(0).sum()) if "gps_km" in work else 0.0
    st.markdown(
        f"""<div class="map-selection-panel">
            <div class="map-selection-title">{_safe_text(title)}</div>
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
            if st.button("Detail", key=f"map_selection_detail_{flight_id}", width="stretch"):
                st.session_state[f"detail_section_{flight_id}"] = "Přehled"
                st.session_state["open_flight_dialog_id"] = flight_id
                st.session_state["selected_flight_id"] = flight_id
                st.session_state.pop("dismissed_flight_id", None)
                st.rerun()
        with cols[1]:
            track_count = int(_safe_float(row.get("track_count"), 0))
            if st.button("Track", key=f"map_selection_track_{flight_id}", disabled=track_count <= 0, width="stretch"):
                st.session_state[f"detail_section_{flight_id}"] = "Track"
                st.session_state["open_flight_dialog_id"] = flight_id
                st.session_state["selected_flight_id"] = flight_id
                st.session_state.pop("dismissed_flight_id", None)
                st.rerun()
        cols[2].markdown(f'<div class="map-mini-cell">{flight_id}</div>', unsafe_allow_html=True)
        cols[3].markdown(f'<div class="map-mini-cell">{_safe_text(row.get("date"))}</div>', unsafe_allow_html=True)
        cols[4].markdown(f'<div class="map-mini-cell">{_safe_text(row.get("registration"))}<div class="map-mini-sub">{_safe_text(row.get("aircraft_type"))}</div></div>', unsafe_allow_html=True)
        cols[5].markdown(f'<div class="map-mini-cell">{_safe_text(_range_text(row.get("departure"), row.get("arrival")))}<div class="map-mini-sub">{_safe_text(row.get("evidence"))}</div></div>', unsafe_allow_html=True)
        cols[6].markdown(f'<div class="map-mini-cell">{_safe_text(_range_text(row.get("off_block"), row.get("on_block")))}</div>', unsafe_allow_html=True)
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
                if st.button("Zrušit", key="map_selection_clear", width="stretch"):
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
def read_aircraft_database_bundle(user_id: int) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    """Load aircraft, rates and usage in one PostgreSQL round-trip.

    SQLite fallback keeps the existing readers. PostgreSQL uses one denormalized
    result and splits it locally; the dataset is small (aircraft/rate history).
    """
    uid = strict_user_id(user_id)

    if not production_is_postgresql():
        return (
            read_table("aircraft", uid),
            read_rates(uid),
            read_aircraft_usage_summary(uid),
        )

    with read_connect() as con:
        joined = db_read_sql_query(
            """
            WITH usage AS (
                SELECT
                    UPPER(TRIM(registration)) AS registration,
                    COUNT(*) AS flight_count,
                    MAX(date) AS last_flight,
                    COALESCE(SUM(starts), 0) AS starts
                FROM flights
                WHERE user_id = ?
                  AND registration IS NOT NULL
                  AND TRIM(registration) <> ''
                GROUP BY UPPER(TRIM(registration))
            )
            SELECT
                a.id AS aircraft_id,
                a.user_id AS aircraft_user_id,
                a.registration AS aircraft_registration,
                a.aircraft_type AS aircraft_type,
                a.icao_type AS icao_type,
                a.aircraft_class AS aircraft_class,
                a.evidence AS evidence,
                a.default_price_per_hour AS default_price_per_hour,
                a.default_role AS default_role,
                a.billing_basis AS billing_basis,
                a.active AS active,
                a.note AS note,
                a.created_at AS aircraft_created_at,
                a.updated_at AS aircraft_updated_at,

                r.id AS rate_id,
                r.user_id AS rate_user_id,
                r.registration AS rate_registration,
                r.aircraft_type AS rate_aircraft_type,
                r.valid_from AS valid_from,
                r.price_per_hour AS price_per_hour,
                r.dry_price_per_hour AS dry_price_per_hour,
                r.source AS rate_source,

                COALESCE(u.flight_count, 0) AS flight_count,
                u.last_flight AS last_flight,
                COALESCE(u.starts, 0) AS starts
            FROM aircraft a
            LEFT JOIN rates r
              ON r.user_id = a.user_id
             AND UPPER(TRIM(r.registration)) = UPPER(TRIM(a.registration))
            LEFT JOIN usage u
              ON u.registration = UPPER(TRIM(a.registration))
            WHERE a.user_id = ?
            ORDER BY UPPER(TRIM(a.registration)), r.valid_from, r.id
            """,
            con,
            params=(uid, uid),
        )

    aircraft_columns = [
        "id", "user_id", "registration", "aircraft_type", "icao_type",
        "aircraft_class", "evidence", "default_price_per_hour",
        "default_role", "billing_basis", "active", "note",
        "created_at", "updated_at",
    ]
    rate_columns = [
        "id", "user_id", "registration", "aircraft_type", "valid_from",
        "price_per_hour", "dry_price_per_hour", "source",
    ]
    usage_columns = ["registration", "flight_count", "last_flight", "starts"]

    if joined.empty:
        return (
            pd.DataFrame(columns=aircraft_columns),
            pd.DataFrame(columns=rate_columns),
            pd.DataFrame(columns=usage_columns),
        )

    aircraft = pd.DataFrame({
        "id": joined["aircraft_id"],
        "user_id": joined["aircraft_user_id"],
        "registration": joined["aircraft_registration"],
        "aircraft_type": joined["aircraft_type"],
        "icao_type": joined["icao_type"],
        "aircraft_class": joined["aircraft_class"],
        "evidence": joined["evidence"],
        "default_price_per_hour": joined["default_price_per_hour"],
        "default_role": joined["default_role"],
        "billing_basis": joined["billing_basis"],
        "active": joined["active"],
        "note": joined["note"],
        "created_at": joined["aircraft_created_at"],
        "updated_at": joined["aircraft_updated_at"],
    }).drop_duplicates(subset=["id"], keep="first").reset_index(drop=True)

    rate_mask = joined["rate_id"].notna()
    rates = pd.DataFrame({
        "id": joined.loc[rate_mask, "rate_id"],
        "user_id": joined.loc[rate_mask, "rate_user_id"],
        "registration": joined.loc[rate_mask, "rate_registration"],
        "aircraft_type": joined.loc[rate_mask, "rate_aircraft_type"],
        "valid_from": joined.loc[rate_mask, "valid_from"],
        "price_per_hour": joined.loc[rate_mask, "price_per_hour"],
        "dry_price_per_hour": joined.loc[rate_mask, "dry_price_per_hour"],
        "source": joined.loc[rate_mask, "rate_source"],
    }).reset_index(drop=True)
    if not rates.empty:
        rates["registration"] = (
            rates["registration"].fillna("").astype(str).str.upper()
        )

    usage = pd.DataFrame({
        "registration": joined["aircraft_registration"],
        "flight_count": joined["flight_count"],
        "last_flight": joined["last_flight"],
        "starts": joined["starts"],
    }).drop_duplicates(
        subset=["registration"], keep="first"
    ).reset_index(drop=True)

    return aircraft, rates, usage


@st.cache_data(show_spinner=False, ttl=300)
def read_aircraft_usage_summary(user_id: int) -> pd.DataFrame:
    uid = strict_user_id(user_id)
    try:
        with read_connect() as con:
            return db_read_sql_query(
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
    except DATABASE_ERRORS:
        if production_is_postgresql():
            raise
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


def _refresh_aircraft_current_price_in_connection(con: Any, user_id: int, registration: str) -> None:
    row = con.execute(
        """
        SELECT price_per_hour
        FROM rates
        WHERE user_id = ? AND UPPER(TRIM(registration)) = ?
          AND valid_from IS NOT NULL AND TRIM(valid_from) <> ''
          AND valid_from <= ?
        ORDER BY valid_from DESC, id DESC
        LIMIT 1
        """,
        (
            strict_user_id(user_id),
            str(registration or "").strip().upper(),
            date.today().isoformat(),
        ),
    ).fetchone()
    if row is not None:
        con.execute(
            "UPDATE aircraft SET default_price_per_hour = ?, updated_at = ? WHERE user_id = ? AND UPPER(TRIM(registration)) = ?",
            (float(row[0] or 0), _now_iso(), strict_user_id(user_id), str(registration or "").strip().upper()),
        )


def _upsert_aircraft_rate_in_connection(
    con: Any,
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



@st.cache_data(show_spinner=False, ttl=300)
def read_quality_track_metadata(user_id: int) -> pd.DataFrame:
    """Minimal GPS metadata for the manual Data Quality scan.

    Four indexed point lookups expose only track endpoints; the heavy
    coordinates_json payload is deliberately not loaded.
    """
    uid = strict_user_id(user_id)
    with read_connect() as con:
        return db_read_sql_query(
            """
            SELECT
                t.id,
                t.flight_id,
                t.point_count,
                t.distance_km,
                t.start_utc,
                t.end_utc,
                (
                    SELECT p.latitude_deg
                    FROM track_points p
                    WHERE p.user_id = t.user_id AND p.track_id = t.id
                    ORDER BY p.seq ASC
                    LIMIT 1
                ) AS start_lat,
                (
                    SELECT p.longitude_deg
                    FROM track_points p
                    WHERE p.user_id = t.user_id AND p.track_id = t.id
                    ORDER BY p.seq ASC
                    LIMIT 1
                ) AS start_lon,
                (
                    SELECT p.latitude_deg
                    FROM track_points p
                    WHERE p.user_id = t.user_id AND p.track_id = t.id
                    ORDER BY p.seq DESC
                    LIMIT 1
                ) AS end_lat,
                (
                    SELECT p.longitude_deg
                    FROM track_points p
                    WHERE p.user_id = t.user_id AND p.track_id = t.id
                    ORDER BY p.seq DESC
                    LIMIT 1
                ) AS end_lon
            FROM flight_tracks t
            WHERE t.user_id = ?
            ORDER BY t.flight_id, t.id
            """,
            con,
            params=(uid,),
        )


def _quality_used_airports(flights: pd.DataFrame) -> tuple[str, ...]:
    if flights.empty:
        return ()
    idents: set[str] = set()
    for column in ("departure", "arrival"):
        if column not in flights.columns:
            continue
        for value in flights[column].tolist():
            ident = (normalize_text(value) or "").upper().strip()
            if ident:
                idents.add(ident)
    return tuple(sorted(idents))


def _quality_track_endpoint(
    tracks: pd.DataFrame,
    flight_id: int,
    *,
    endpoint: str,
) -> dict[str, float] | None:
    if tracks.empty or "flight_id" not in tracks.columns:
        return None
    sub = tracks[pd.to_numeric(tracks["flight_id"], errors="coerce").fillna(0).astype(int).eq(int(flight_id))]
    if sub.empty:
        return None
    row = sub.iloc[0] if endpoint == "start" else sub.iloc[-1]
    lat_key = "start_lat" if endpoint == "start" else "end_lat"
    lon_key = "start_lon" if endpoint == "start" else "end_lon"
    try:
        lat = float(row.get(lat_key))
        lon = float(row.get(lon_key))
    except (TypeError, ValueError):
        return None
    if not (math.isfinite(lat) and math.isfinite(lon)):
        return None
    return {"lat": lat, "lon": lon}


def build_data_quality_scan(user_id: int) -> dict[str, Any]:
    uid = strict_user_id(user_id)
    flights = session_read_flights(uid)
    aircraft = read_aircraft_catalog(active_only=False, user_id=uid)
    tracks = read_quality_track_metadata(uid)

    used_airports = _quality_used_airports(flights)
    known_lookup = airport_coords_for_idents(used_airports, uid)
    scan = scan_data_quality(
        flights,
        aircraft,
        known_airports=known_lookup.keys(),
        tracks=tracks,
    )

    # GPS endpoint suggestions are intentionally generated outside the pure
    # engine because they depend on the shared airport spatial index.
    gps_patches: dict[int, dict[str, str]] = {}
    for issue in scan.get("issues", []):
        flight_id = issue.get("flight_id")
        if not flight_id:
            continue
        if issue.get("code") == "missing_departure":
            point = _quality_track_endpoint(tracks, int(flight_id), endpoint="start")
            suggestion = nearest_airport(point, max_km=18.0) if point else ""
            if suggestion:
                issue["suggested_patch"] = {"departure": suggestion}
                issue["patch_kind"] = "gps"
                issue["detail"] += f" Nejbližší známé letiště k začátku tracku: {suggestion}."
                gps_patches.setdefault(int(flight_id), {})["departure"] = suggestion
        elif issue.get("code") == "missing_arrival":
            point = _quality_track_endpoint(tracks, int(flight_id), endpoint="end")
            suggestion = nearest_airport(point, max_km=18.0) if point else ""
            if suggestion:
                issue["suggested_patch"] = {"arrival": suggestion}
                issue["patch_kind"] = "gps"
                issue["detail"] += f" Nejbližší známé letiště ke konci tracku: {suggestion}."
                gps_patches.setdefault(int(flight_id), {})["arrival"] = suggestion

    scan["gps_patches"] = gps_patches
    scan["scanned_at"] = datetime.now(current_user_timezone()).isoformat(timespec="seconds")
    scan["flight_total"] = int(len(flights))
    scan["track_total"] = int(len(tracks))
    return scan


def apply_data_quality_patches(
    patches: dict[int, dict[str, Any]],
    *,
    audit_action: str,
) -> tuple[int, int]:
    """Apply explicit, user-confirmed partial patches to owned flight rows."""
    allowed_fields = {
        "evidence",
        "aircraft_type",
        "aircraft_class",
        "role",
        "departure",
        "arrival",
    }
    uppercase_fields = {"evidence", "aircraft_class", "role", "departure", "arrival"}

    uid = strict_user_id(current_user_id())
    normalized: dict[int, dict[str, Any]] = {}
    for raw_flight_id, raw_patch in (patches or {}).items():
        try:
            flight_id = int(raw_flight_id)
        except (TypeError, ValueError):
            continue
        clean: dict[str, Any] = {}
        for field, value in dict(raw_patch or {}).items():
            if field not in allowed_fields:
                continue
            text = normalize_text(value)
            clean[field] = text.upper() if text and field in uppercase_fields else text
        clean = {field: value for field, value in clean.items() if value is not None}
        if clean:
            normalized[flight_id] = clean

    if not normalized:
        return 0, 0

    rows_changed = 0
    fields_changed = 0
    with connect() as con:
        for flight_id, patch in normalized.items():
            require_owned_record(con, "flights", flight_id, uid)

            existing = con.execute(
                "SELECT " + ", ".join(patch.keys()) + " FROM flights WHERE id = ? AND user_id = ?",
                (flight_id, uid),
            ).fetchone()
            if existing is None:
                continue

            effective: dict[str, Any] = {}
            for index, (field, value) in enumerate(patch.items()):
                current = normalize_text(existing[index])
                current_cmp = current.upper() if current and field in uppercase_fields else current
                if current_cmp != value:
                    effective[field] = value

            if not effective:
                continue

            assignments = ", ".join(f"{field} = ?" for field in effective)
            con.execute(
                f"UPDATE flights SET {assignments} WHERE id = ? AND user_id = ?",
                (*effective.values(), flight_id, uid),
            )
            record_audit(
                con,
                audit_action,
                "flights",
                flight_id,
                {"patch": effective},
            )
            rows_changed += 1
            fields_changed += len(effective)
        con.commit()

    if rows_changed:
        invalidate_cached_data("flights")
        auto_backup_after_change(audit_action)
    return rows_changed, fields_changed


def _quality_status_meta(status: str) -> tuple[str, str, str]:
    if status == "problem":
        return "PROBLÉM", "Některé záznamy vyžadují kontrolu", "problem"
    if status == "warning":
        return "UPOZORNĚNÍ", "Data jsou použitelná, ale některé záznamy stojí za kontrolu", "warning"
    return "OK", "Kontrola nenašla žádný problém ani upozornění", "ok"


def _quality_flight_label(issue: dict[str, Any]) -> str:
    parts = []
    if issue.get("date"):
        parts.append(str(issue["date"]))
    if issue.get("registration"):
        parts.append(str(issue["registration"]))
    route = " → ".join(
        value for value in (
            normalize_text(issue.get("departure")),
            normalize_text(issue.get("arrival")),
        )
        if value
    )
    if route:
        parts.append(route)
    if issue.get("flight_id"):
        parts.append(f"ID {int(issue['flight_id'])}")
    return " • ".join(parts) or "Databázový nález"


def _open_quality_flight(flight_id: int) -> None:
    st.session_state[f"detail_section_{int(flight_id)}"] = "Přehled"
    st.session_state["open_flight_dialog_id"] = int(flight_id)
    st.session_state["selected_flight_id"] = int(flight_id)
    st.session_state.pop("dismissed_flight_id", None)
    st.session_state["page"] = "Lety"


def render_data_quality_page() -> None:
    uid = strict_user_id(current_user_id())
    scan_key = f"data_quality_scan_v068_u{uid}"
    flash = st.session_state.pop("data_quality_flash_v068", None)
    if flash:
        st.success(str(flash))

    st.markdown("### Kvalita dat")
    st.caption(
        "Kontrola je pouze diagnostická. Nic se neopravuje ani nemaže bez tvého potvrzení. "
        "Spouští se ručně, aby běžný chod aplikace zůstal rychlý."
    )

    left, right = st.columns([1.3, 1])
    with left:
        run_scan = st.button(
            "Spustit kontrolu",
            type="primary",
            width="stretch",
            key="run_data_quality_scan_v068",
        )
    with right:
        if st.session_state.get(scan_key):
            clear_scan = st.button(
                "Zahodit výsledek",
                width="stretch",
                key="clear_data_quality_scan_v068",
            )
            if clear_scan:
                st.session_state.pop(scan_key, None)
                st.rerun()

    if run_scan:
        with st.spinner("Kontroluji lety, profily letadel, letiště a GPS metadata…"):
            st.session_state[scan_key] = build_data_quality_scan(uid)

    scan = st.session_state.get(scan_key)
    if not isinstance(scan, dict):
        st.markdown(
            """
            <div class="quality-empty">
              <div class="quality-empty-title">Databáze zatím nebyla zkontrolována</div>
              <div class="quality-empty-sub">
                Kontrola hledá duplicity, chybějící údaje, podezřelé časy,
                nesoulad s profily letadel, neznámá letiště a poškozená GPS metadata.
              </div>
            </div>
            """,
            unsafe_allow_html=True,
        )
        return

    status_label, status_sub, status_tone = _quality_status_meta(str(scan.get("status") or "ok"))
    counts = scan.get("counts") or {}
    scanned_at = str(scan.get("scanned_at") or "")
    st.markdown(
        f"""
        <div class="quality-hero quality-{status_tone}">
          <div>
            <div class="quality-kicker">DATA QUALITY</div>
            <div class="quality-status">{html.escape(status_label)}</div>
            <div class="quality-sub">{html.escape(status_sub)}</div>
          </div>
          <div class="quality-meta">
            {int(scan.get('flight_total') or 0)} letů · {int(scan.get('track_total') or 0)} GPS tracků
            <br>{html.escape(scanned_at)}
          </div>
        </div>
        """,
        unsafe_allow_html=True,
    )

    m1, m2, m3, m4 = st.columns(4)
    with m1:
        metric_card("Problémy", str(int(counts.get("problem", 0))), "vyžadují kontrolu")
    with m2:
        metric_card("Upozornění", str(int(counts.get("warning", 0))), "doporučená kontrola")
    with m3:
        metric_card("Lety", str(int(counts.get("flights", 0))), "dotčené záznamy")
    with m4:
        metric_card("Bezpečné opravy", str(int(counts.get("safe_repairs", 0))), "doplnění z profilů")

    safe_patches = {
        int(flight_id): dict(patch)
        for flight_id, patch in (scan.get("safe_patches") or {}).items()
        if patch
    }
    if safe_patches:
        with st.container(border=True):
            st.markdown("#### Bezpečné doplnění z profilů letadel")
            field_count = sum(len(patch) for patch in safe_patches.values())
            st.caption(
                f"Lze doplnit {field_count} chybějících hodnot u {len(safe_patches)} letů. "
                "Doplňují se pouze prázdná pole z odpovídajícího profilu letadla; existující hodnoty se nepřepisují."
            )
            if st.button(
                f"Doplnit bezpečně {len(safe_patches)} letů",
                type="primary",
                width="stretch",
                key="apply_safe_quality_repairs_v068",
            ):
                try:
                    rows_changed, fields_changed = apply_data_quality_patches(
                        safe_patches,
                        audit_action="data_quality_safe_fill",
                    )
                    st.session_state.pop(scan_key, None)
                    st.session_state["data_quality_flash_v068"] = (
                        f"Doplněno {fields_changed} hodnot u {rows_changed} letů. Spusť kontrolu znovu pro nový stav."
                    )
                    st.rerun()
                except Exception as exc:
                    st.error(f"Opravu se nepodařilo provést: {exc}")

    issues = list(scan.get("issues") or [])
    if not issues:
        st.success("Kontrola je čistá. Nebyl nalezen žádný problém ani upozornění.")
        return

    st.markdown("#### Nálezy")
    filters = st.columns([1, 1.2, 1.7])
    with filters[0]:
        severity = st.selectbox(
            "Závažnost",
            ["Vše", "Problémy", "Upozornění"],
            key="quality_severity_filter_v068",
        )
    categories = sorted({str(issue.get("category") or "Ostatní") for issue in issues})
    with filters[1]:
        category = st.selectbox(
            "Kategorie",
            ["Vše"] + categories,
            key="quality_category_filter_v068",
        )
    with filters[2]:
        query = st.text_input(
            "Hledat v nálezech",
            value="",
            placeholder="registrace, letiště, ID, text problému…",
            key="quality_search_v068",
        )

    filtered_issues = []
    query_cf = query.strip().casefold()
    for issue in issues:
        if severity == "Problémy" and issue.get("severity") != "problem":
            continue
        if severity == "Upozornění" and issue.get("severity") != "warning":
            continue
        if category != "Vše" and str(issue.get("category")) != category:
            continue
        if query_cf:
            haystack = " ".join(
                str(issue.get(key) or "")
                for key in (
                    "flight_id", "date", "registration", "departure", "arrival",
                    "category", "title", "detail",
                )
            ).casefold()
            if query_cf not in haystack:
                continue
        filtered_issues.append(issue)

    st.caption(
        f"Zobrazeno {min(len(filtered_issues), 50)} z {len(filtered_issues)} odpovídajících nálezů."
        + (" Pro rychlost UI se zobrazuje maximálně prvních 50." if len(filtered_issues) > 50 else "")
    )

    for index, issue in enumerate(filtered_issues[:50]):
        severity_value = str(issue.get("severity") or "warning")
        severity_text = "PROBLÉM" if severity_value == "problem" else "UPOZORNĚNÍ"
        flight_label = _quality_flight_label(issue)
        st.markdown(
            f"""
            <div class="quality-issue quality-issue-{html.escape(severity_value)}">
              <div class="quality-issue-top">
                <span class="quality-badge">{severity_text}</span>
                <span class="quality-category">{html.escape(str(issue.get('category') or ''))}</span>
              </div>
              <div class="quality-issue-title">{html.escape(str(issue.get('title') or ''))}</div>
              <div class="quality-issue-flight">{html.escape(flight_label)}</div>
              <div class="quality-issue-detail">{html.escape(str(issue.get('detail') or ''))}</div>
            </div>
            """,
            unsafe_allow_html=True,
        )

        flight_id = issue.get("flight_id")
        patch = dict(issue.get("suggested_patch") or {})
        patch_kind = issue.get("patch_kind")
        action_cols = st.columns([1, 1, 2.2])
        if flight_id:
            with action_cols[0]:
                if st.button(
                    "Otevřít let",
                    width="stretch",
                    key=f"quality_open_{index}_{int(flight_id)}",
                ):
                    _open_quality_flight(int(flight_id))
                    st.rerun()

        if flight_id and patch and patch_kind == "gps":
            label = "Použít GPS návrh"
            with action_cols[1]:
                if st.button(
                    label,
                    width="stretch",
                    key=f"quality_patch_{index}_{int(flight_id)}",
                ):
                    try:
                        rows_changed, fields_changed = apply_data_quality_patches(
                            {int(flight_id): patch},
                            audit_action="data_quality_gps_suggestion",
                        )
                        st.session_state.pop(scan_key, None)
                        st.session_state["data_quality_flash_v068"] = (
                            f"GPS návrh použit: {fields_changed} hodnota u {rows_changed} letu. Spusť kontrolu znovu."
                        )
                        st.rerun()
                    except Exception as exc:
                        st.error(f"Návrh se nepodařilo použít: {exc}")

        st.markdown('<div class="quality-issue-gap"></div>', unsafe_allow_html=True)


def page_database():
    st.markdown("## Databáze")

    # Resolve the selected section before section-specific PostgreSQL reads.
    section = st.radio(
        "Databáze sekce",
        ["Letadla", "Letiště", "Kvalita dat"],
        horizontal=True,
        label_visibility="collapsed",
        key="database_section_v058",
    )

    counts = session_read_logbook_counts(current_user_id())
    aircraft_count_total = counts["aircraft"]
    track_count_total = counts["tracks"]
    point_count_total = counts["points"]

    # Exact airport total needs tenant override idents from PostgreSQL. Do not
    # pay that network round-trip while the user is in Aircraft/Data Quality.
    airport_count_total = (
        read_airport_registry_count(current_user_id())
        if section == "Letiště"
        else None
    )

    c1, c2, c3, c4 = st.columns(4)
    with c1:
        metric_card(
            "Letiště / plochy",
            str(airport_count_total) if airport_count_total is not None else "—",
            "načte se v sekci Letiště" if airport_count_total is None else "databázová tabulka",
        )
    with c2: metric_card("Letadla", str(aircraft_count_total), "registrace")
    with c3: metric_card("Tracky", str(track_count_total), "KML soubory")
    with c4: metric_card("GPS body", f"{point_count_total:,}".replace(",", " "), "normalizováno")

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
        st.dataframe(view[[c for c in cols if c in view.columns]].head(1000), hide_index=True, width="stretch", height=430)

        prepare_airport_export = st.button("Připravit export letišť CSV", key="prepare_airport_csv_v052", width="stretch")
        if prepare_airport_export or st.session_state.get("airport_csv_ready_v052"):
            st.session_state["airport_csv_ready_v052"] = True
            st.download_button(
                "Stáhnout letiště CSV",
                data=airports.to_csv(index=False).encode("utf-8"),
                file_name="airports_export.csv",
                mime="text/csv",
                width="stretch",
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
    elif section == "Kvalita dat":
        render_data_quality_page()
    elif section == "Letadla":
        uid = current_user_id()
        aircraft, rates, usage = read_aircraft_database_bundle(uid)
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
                if st.button("← Zpět", width="stretch", key="aircraft_new_back_v058"):
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
                    submitted_aircraft = st.form_submit_button("Přidat letadlo", type="primary", width="stretch")
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
                if st.button("← Letadla", width="stretch", key=f"aircraft_back_{selected_reg}"):
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
                        save_profile = st.form_submit_button("Uložit profil letadla", type="primary", width="stretch")
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
                        save_rate = st.form_submit_button("Uložit změnu ceny", type="primary", width="stretch")
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
                            width="stretch",
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
                        save_history = st.form_submit_button("Uložit historickou sazbu", width="stretch")
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
                if st.button("＋ Přidat letadlo", type="primary", width="stretch", key="aircraft_add_v058"):
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
                                if st.button("Otevřít profil", width="stretch", key=f"aircraft_open_{key_hash}"):
                                    st.session_state["aircraft_profile_selected_v058"] = reg0
                                    st.rerun()



# -----------------------------------------------------------------------------
# Stability / database control tools
# -----------------------------------------------------------------------------

def _safe_df_query(con: Any, query: str, params: tuple[Any, ...] = ()) -> pd.DataFrame:
    """Best-effort health query on SQLite; fail visibly on PostgreSQL production."""
    try:
        return db_read_sql_query(query, con, params=params)
    except DATABASE_ERRORS:
        if is_postgres_connection(con):
            raise
        return pd.DataFrame()
    except Exception:
        # Non-database parsing/compatibility errors in manual diagnostics remain
        # non-fatal; a production database outage must never be masked as empty data.
        return pd.DataFrame()


def _attach_world_airports(con: Any) -> bool:
    if is_postgres_connection(con) or not AIRPORTS_DB_PATH.exists():
        return False
    try:
        existing = [str(row[1]) for row in con.execute("PRAGMA database_list").fetchall()]
        if "world_airports" not in existing:
            con.execute("ATTACH DATABASE ? AS world_airports", (str(AIRPORTS_DB_PATH),))
        return True
    except DATABASE_ERRORS:
        return False


def _health_table_preview(df: pd.DataFrame, limit: int = 200) -> pd.DataFrame:
    if df is None or df.empty:
        return pd.DataFrame()
    return df.head(limit).copy()


@st.cache_data(show_spinner=False, ttl=120)
def build_database_health_report(user_id: int) -> dict[str, Any]:
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
    with read_connect() as con:
        tables = ["flights", "aircraft", "rates", "flight_tracks", "track_points", "airports", "user_expiries", "audit_log", "app_meta"]
        count_row = con.execute(
            """
            SELECT
                (SELECT COUNT(*) FROM flights) AS flights,
                (SELECT COUNT(*) FROM aircraft) AS aircraft,
                (SELECT COUNT(*) FROM rates) AS rates,
                (SELECT COUNT(*) FROM flight_tracks) AS flight_tracks,
                (SELECT COUNT(*) FROM track_points) AS track_points,
                (SELECT COUNT(*) FROM airports) AS airports,
                (SELECT COUNT(*) FROM user_expiries) AS user_expiries,
                (SELECT COUNT(*) FROM audit_log) AS audit_log,
                (SELECT COUNT(*) FROM app_meta) AS app_meta
            """
        ).fetchone()
        report["counts"] = {table: int(count_row[table] if count_row else 0) for table in tables}
        if is_postgres_connection(con):
            # PostgreSQL has no PRAGMA integrity_check. Structural integrity is
            # guarded by FK constraints plus owner triggers. Keep the explicit
            # verification, but collapse four network round-trips into one.
            report["checks"]["integrity_check"] = "OK"
            integrity = con.execute(
                """
                SELECT
                    (SELECT COUNT(*) FROM flight_tracks t LEFT JOIN flights f ON f.id=t.flight_id WHERE f.id IS NULL) AS orphan_track,
                    (SELECT COUNT(*) FROM track_points p LEFT JOIN flight_tracks t ON t.id=p.track_id WHERE t.id IS NULL) AS orphan_point,
                    (SELECT COUNT(*) FROM flight_tracks t JOIN flights f ON f.id=t.flight_id WHERE t.user_id<>f.user_id) AS track_owner,
                    (SELECT COUNT(*) FROM track_points p JOIN flight_tracks t ON t.id=p.track_id WHERE p.user_id<>t.user_id) AS point_owner
                """
            ).fetchone()
            integrity_rows = []
            for label in ("orphan_track", "orphan_point", "track_owner", "point_owner"):
                count = int(integrity[label] if integrity else 0)
                if count:
                    integrity_rows.append({"check": label, "count": count})
            report["checks"]["foreign_key_check"] = "OK" if not integrity_rows else f"{sum(r['count'] for r in integrity_rows)} problémů"
            if integrity_rows:
                report["tables"]["foreign_key_check"] = pd.DataFrame(integrity_rows)
        else:
            try:
                row = con.execute("PRAGMA integrity_check").fetchone()
                report["checks"]["integrity_check"] = str(row[0] if row else "unknown")
            except DATABASE_ERRORS as exc:
                report["checks"]["integrity_check"] = f"error: {exc}"
            try:
                fk_rows = con.execute("PRAGMA foreign_key_check").fetchall()
                if fk_rows:
                    report["tables"]["foreign_key_check"] = pd.DataFrame([dict(r) for r in fk_rows])
                report["checks"]["foreign_key_check"] = "OK" if not fk_rows else f"{len(fk_rows)} problémů"
            except DATABASE_ERRORS as exc:
                report["checks"]["foreign_key_check"] = f"error: {exc}"

        ids_aggregate = (
            "STRING_AGG(CAST(id AS TEXT), ',')" if is_postgres_connection(con)
            else "GROUP_CONCAT(id)"
        )
        duplicate_flights = _safe_df_query(con, f"""
            SELECT user_id, date, UPPER(TRIM(COALESCE(registration,''))) AS registration,
                   UPPER(TRIM(COALESCE(departure,''))) AS departure,
                   UPPER(TRIM(COALESCE(arrival,''))) AS arrival,
                   COALESCE(takeoff,'') AS takeoff, COALESCE(landing,'') AS landing,
                   COUNT(*) AS pocet, {ids_aggregate} AS ids
            FROM flights
            GROUP BY user_id, date, UPPER(TRIM(COALESCE(registration,''))), UPPER(TRIM(COALESCE(departure,''))),
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
            SELECT f.user_id, UPPER(TRIM(f.registration)) AS registration, COUNT(*) AS flights
            FROM flights f
            LEFT JOIN aircraft a ON a.user_id = f.user_id AND UPPER(TRIM(a.registration)) = UPPER(TRIM(f.registration))
            WHERE TRIM(COALESCE(f.registration,'')) <> '' AND a.id IS NULL
            GROUP BY f.user_id, UPPER(TRIM(f.registration))
            ORDER BY flights DESC, registration
            LIMIT 250
        """)
        if not missing_aircraft.empty:
            report["tables"]["missing_aircraft"] = missing_aircraft

        # The 85k-row world airport catalogue intentionally remains a local
        # read-only SQLite asset. Only the SQLite backend can ATTACH it inside
        # SQL. PostgreSQL runtime delegates this check to Data Quality, whose
        # Python airport index already combines the global catalogue with
        # tenant-owned overrides.
        world_ok = _attach_world_airports(con)
        if world_ok:
            unknown_airports_query = """
                WITH used AS (
                    SELECT user_id, id AS flight_id, 'Odlet' AS field, UPPER(TRIM(departure)) AS ident
                    FROM flights WHERE TRIM(COALESCE(departure,'')) <> ''
                    UNION ALL
                    SELECT user_id, id AS flight_id, 'Přílet' AS field, UPPER(TRIM(arrival)) AS ident
                    FROM flights WHERE TRIM(COALESCE(arrival,'')) <> ''
                )
                SELECT u.user_id, u.field, u.ident, COUNT(*) AS flights,
                       GROUP_CONCAT(u.flight_id) AS flight_ids
                FROM used u
                LEFT JOIN airports a ON a.user_id=u.user_id AND UPPER(TRIM(a.ident))=u.ident
                LEFT JOIN world_airports.airports wa ON UPPER(TRIM(wa.ident))=u.ident
                WHERE a.id IS NULL AND wa.id IS NULL
                GROUP BY u.user_id, u.field, u.ident
                ORDER BY flights DESC, u.ident
                LIMIT 250
            """
            unknown_airports = _safe_df_query(con, unknown_airports_query)
            if not unknown_airports.empty:
                report["tables"]["unknown_airports"] = unknown_airports
        elif not is_postgres_connection(con):
            report["checks"]["world_airports"] = "reference DB unavailable"
        else:
            report["checks"]["world_airports"] = "Data Quality / Python index"

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
            GROUP BY t.id, f.date, f.registration
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
            GROUP BY t.id, f.date, f.registration
            HAVING COUNT(p.id) > 0
               AND COALESCE(t.point_count, 0) > 0
               AND ABS(COALESCE(t.point_count, 0) - COUNT(p.id)) > 5
            ORDER BY ABS(COALESCE(t.point_count, 0) - COUNT(p.id)) DESC
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
            rows = con.execute("SELECT id, flight_id, file_name, coordinates_json FROM flight_tracks ORDER BY id DESC LIMIT 500").fetchall()
            for row in rows:
                try:
                    points = json.loads(row["coordinates_json"] or "[]")
                    if not isinstance(points, list) or len(points) < 2:
                        invalid_json_rows.append({"track_id": row["id"], "flight_id": row["flight_id"], "file_name": row["file_name"], "problem": "málo bodů / špatná struktura"})
                except Exception as exc:
                    invalid_json_rows.append({"track_id": row["id"], "flight_id": row["flight_id"], "file_name": row["file_name"], "problem": str(exc)[:120]})
                if len(invalid_json_rows) >= 250:
                    break
        except DATABASE_ERRORS:
            if is_postgres_connection(con):
                raise
        if invalid_json_rows:
            report["tables"]["invalid_track_json"] = pd.DataFrame(invalid_json_rows)

    # Time anomalies are easier and safer to evaluate with the existing Python duration logic.
    flights = read_flights(strict_user_id(user_id))
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
            st.dataframe(_health_table_preview(df), hide_index=True, width="stretch", height=260)


def run_safe_database_service() -> dict[str, Any]:
    """Apply only structural, non-semantic database repairs.

    Flight values are intentionally not normalized here anymore. User-visible
    data corrections belong to Data Quality, where each change is explicit.
    """
    result: dict[str, Any] = {"changed": 0, "actions": []}
    with connect() as con:
        before = con.total_changes

        def step(label: str, sql: str, params: tuple[Any, ...] = ()) -> None:
            prev = con.total_changes
            con.execute(sql, params)
            result["actions"].append({"Akce": label, "Změny": int(con.total_changes - prev)})

        step(
            "Odstranění osiřelých GPS bodů",
            """
            DELETE FROM track_points
            WHERE NOT EXISTS (
                SELECT 1 FROM flight_tracks t WHERE t.id = track_points.track_id
            )
            """,
        )
        step(
            "Synchronizace point_count",
            """
            UPDATE flight_tracks
            SET point_count = (
                SELECT COUNT(*) FROM track_points p
                WHERE p.track_id = flight_tracks.id
            )
            WHERE EXISTS (
                SELECT 1 FROM track_points p WHERE p.track_id = flight_tracks.id
            )
              AND COALESCE(point_count, -1) <> (
                SELECT COUNT(*) FROM track_points p
                WHERE p.track_id = flight_tracks.id
            )
            """,
        )
        # SQLite can rebuild its migration-era tenant guards. PostgreSQL owner
        # guards are part of the versioned schema and must not be rewritten here.
        if is_postgres_connection(con):
            con.execute("ANALYZE")
            result["actions"].append({"Akce": "PostgreSQL ANALYZE", "Změny": 0})
        else:
            ensure_tenancy_schema(con)
            optimize_sqlite(con)
        result["changed"] = int(con.total_changes - before)
        record_audit(con, "safe_database_service", "database", None, result)
        con.commit()
    build_database_health_report.clear()
    invalidate_cached_data("database")
    auto_backup_after_change("safe_database_service")
    return result


def run_backend_service() -> dict[str, Any]:
    result = {"Akce": [], "Stav": "OK", "Backend": production_backend_name()}
    with connect() as con:
        if is_postgres_connection(con):
            try:
                con.execute("ANALYZE")
                result["Akce"].append("PostgreSQL ANALYZE")
            except DATABASE_ERRORS as exc:
                result["Akce"].append(f"PostgreSQL ANALYZE selhalo: {exc}")
        else:
            try:
                con.execute("PRAGMA optimize")
                result["Akce"].append("PRAGMA optimize")
            except DATABASE_ERRORS as exc:
                result["Akce"].append(f"PRAGMA optimize selhalo: {exc}")
            try:
                con.execute("PRAGMA wal_checkpoint(TRUNCATE)")
                result["Akce"].append("WAL checkpoint")
            except DATABASE_ERRORS as exc:
                result["Akce"].append(f"WAL checkpoint selhal: {exc}")
        record_audit(con, "database_backend_service", "database", None, result)
        con.commit()
    invalidate_cached_data("database")
    return result


def render_database_control_panel() -> None:
    st.markdown("### Kontrola a servis")
    st.caption("Bezpečný servis mění jen strukturální metadata databáze; obsah letů se opravuje výhradně přes Kvalitu dat.")
    c1, c2, c3 = st.columns(3)
    with c1:
        if st.button("Spustit kontrolu", type="primary", width="stretch", key="run_db_health_v047"):
            with st.spinner("Kontroluji databázi…"):
                st.session_state["db_health_report_v047"] = build_database_health_report(current_user_id())
    with c2:
        if st.button("Bezpečný servis", width="stretch", disabled=not is_admin(), key="run_safe_service_v047"):
            if require_admin():
                with st.spinner("Provádím bezpečný servis…"):
                    try:
                        st.session_state["safe_service_result_v047"] = run_safe_database_service()
                        st.session_state["db_health_report_v047"] = build_database_health_report(current_user_id())
                        st.success("Bezpečný servis dokončen.")
                    except Exception as exc:
                        st.error(f"Servis selhal: {exc}")
    with c3:
        maintenance_label = "PostgreSQL ANALYZE" if production_is_postgresql() else "SQLite optimize"
        if st.button(maintenance_label, width="stretch", disabled=not is_admin(), key="run_backend_service_v072"):
            if require_admin():
                try:
                    st.session_state["backend_service_result_v072"] = run_backend_service()
                    st.success("Databázová údržba dokončena.")
                except Exception as exc:
                    st.error(f"Databázová údržba selhala: {exc}")

    if not is_admin():
        st.caption("Servisní opravy jsou dostupné jen po přihlášení jako admin.")

    result = st.session_state.get("safe_service_result_v047")
    if result:
        with st.expander("Poslední bezpečný servis", expanded=False):
            st.metric("Změny", int(result.get("changed", 0)))
            actions = pd.DataFrame(result.get("actions", []))
            if not actions.empty:
                st.dataframe(actions, hide_index=True, width="stretch")

    backend_result = st.session_state.get("backend_service_result_v072")
    if backend_result:
        with st.expander("Poslední databázová údržba", expanded=False):
            st.write(" • ".join(backend_result.get("Akce", [])))

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
        st.success(f"{'PostgreSQL' if production_is_postgresql() else 'SQLite'} integrita a vazby: OK")
    else:
        st.error(
            f"{'PostgreSQL' if production_is_postgresql() else 'SQLite'} kontrola: "
            f"integrity={checks.get('integrity_check')} • foreign_keys={checks.get('foreign_key_check')}"
        )

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



def _portable_backup_bytes(user_id: int) -> bytes:
    with read_connect() as con:
        return build_user_backup(
            con,
            strict_user_id(user_id),
            app_version=APP_VERSION,
            schema_version=DB_SCHEMA_VERSION,
        )


def _portable_backup_counts(user_id: int) -> dict[str, int]:
    uid = strict_user_id(user_id)
    with read_connect() as con:
        def count(table: str) -> int:
            row = con.execute(
                f"SELECT COUNT(*) FROM {table} WHERE user_id = ?",
                (uid,),
            ).fetchone()
            return int(row[0]) if row else 0
        audit_row = con.execute(
            "SELECT COALESCE(MAX(id), 0) FROM audit_log WHERE user_id = ?",
            (uid,),
        ).fetchone()
        return {
            "flights": count("flights"),
            "aircraft": count("aircraft"),
            "tracks": count("flight_tracks"),
            "points": count("track_points"),
            "expiries": count("user_expiries"),
            "audit_id": int(audit_row[0]) if audit_row else 0,
        }


def render_portable_backup() -> None:
    uid = strict_user_id(current_user_id())
    profile = current_user_profile(uid)
    counts = _portable_backup_counts(uid)

    st.markdown("### Přenosná záloha účtu")
    st.caption(
        "Kompletní přenosná kopie dat tohoto profilu. Neobsahuje heslo, "
        "přihlašovací údaje, data ostatních uživatelů ani globální databázi letišť."
    )

    c1, c2, c3, c4 = st.columns(4)
    with c1:
        metric_card("Lety", str(counts["flights"]), "v tomto profilu")
    with c2:
        metric_card("Letadla", str(counts["aircraft"]), "profily a ceny")
    with c3:
        metric_card("GPS tracky", str(counts["tracks"]), f"{counts['points']:,} bodů".replace(",", " "))
    with c4:
        metric_card("Platnosti", str(counts["expiries"]), "licence / medical")

    backup_signature = (
        uid,
        counts["flights"],
        counts["aircraft"],
        counts["tracks"],
        counts["points"],
        counts["expiries"],
        counts.get("audit_id", 0),
        str(profile.get("updated_at") or ""),
    )
    if st.session_state.get("portable_backup_signature_v064") != backup_signature:
        st.session_state["portable_backup_signature_v064"] = backup_signature
        st.session_state.pop("portable_backup_bytes_v064", None)
        st.session_state.pop("portable_backup_name_v064", None)

    prepare = st.button(
        "Připravit přenosnou zálohu",
        type="primary",
        width="stretch",
        key="prepare_portable_backup_v064",
    )
    if prepare:
        try:
            with st.spinner("Připravuji zálohu profilu…"):
                raw = _portable_backup_bytes(uid)
            st.session_state["portable_backup_bytes_v064"] = raw
            st.session_state["portable_backup_name_v064"] = backup_filename(profile)
        except Exception as exc:
            st.error(f"Zálohu se nepodařilo připravit: {exc}")

    ready = st.session_state.get("portable_backup_bytes_v064")
    if ready:
        st.download_button(
            "Stáhnout zálohu účtu",
            data=ready,
            file_name=st.session_state.get("portable_backup_name_v064") or backup_filename(profile),
            mime="application/zip",
            width="stretch",
            key="download_portable_backup_v064",
        )
        st.caption(
            "ZIP obsahuje strojově obnovitelná data a čitelné CSV kopie hlavních tabulek."
        )

    pre_restore = st.session_state.get("portable_pre_restore_backup_v064")
    if pre_restore:
        st.warning("Je k dispozici bezpečnostní kopie stavu před poslední obnovou.")
        st.download_button(
            "Stáhnout stav před obnovou",
            data=pre_restore,
            file_name=st.session_state.get(
                "portable_pre_restore_name_v064",
                f"logbook_before_restore_{datetime.now(LOCAL_TZ).strftime('%Y%m%d_%H%M')}.zip",
            ),
            mime="application/zip",
            width="stretch",
            key="download_pre_restore_backup_v064",
        )

    if st.session_state.pop("portable_restore_success_v064", False):
        st.success("Data profilu byla z přenosné zálohy úspěšně obnovena.")

    st.markdown("### Obnova dat")
    with st.expander("Obnovit tento profil z přenosné zálohy", expanded=False):
        st.warning(
            "Obnova **nahradí lety, letadla, ceny, vlastní letiště, GPS tracky a platnosti "
            "aktuálního profilu**. Ostatní účty, e-mail, heslo a role se nezmění."
        )
        uploaded = st.file_uploader(
            "Přenosná záloha Logbooku (.zip)",
            type=["zip"],
            key="portable_restore_upload_v064",
        )

        backup_raw: bytes | None = None
        backup_info: dict[str, Any] | None = None
        if uploaded is not None:
            try:
                backup_raw = uploaded.getvalue()
                backup_info = inspect_user_backup(backup_raw)
                source = backup_info.get("source_profile") or {}
                source_name = normalize_text(source.get("display_name")) or "Neznámý profil"
                source_email = normalize_text(source.get("email"))
                created = str(backup_info.get("created_at") or "—")
                bcounts = backup_info.get("counts") or {}

                st.success("Záloha je platná a lze ji obnovit.")
                st.markdown(
                    f"**Zdroj:** {html.escape(source_name)}"
                    + (f" • {html.escape(source_email)}" if source_email else "")
                    + f"  \n**Vytvořeno:** {html.escape(created)}"
                )
                p1, p2, p3, p4 = st.columns(4)
                with p1:
                    st.metric("Lety", int(bcounts.get("flights", 0)))
                with p2:
                    st.metric("Letadla", int(bcounts.get("aircraft", 0)))
                with p3:
                    st.metric("Tracky", int(bcounts.get("flight_tracks", 0)))
                with p4:
                    st.metric("GPS body", int(bcounts.get("track_points", 0)))
            except BackupError as exc:
                st.error(str(exc))
                backup_raw = None
                backup_info = None
            except Exception as exc:
                st.error(f"Zálohu nelze načíst: {exc}")
                backup_raw = None
                backup_info = None

        confirm = st.text_input(
            "Pro potvrzení napiš OBNOVIT MOJE DATA",
            value="",
            key="portable_restore_confirm_v064",
        )
        can_restore = backup_raw is not None and confirm.strip().upper() == "OBNOVIT MOJE DATA"
        if st.button(
            "Obnovit data tohoto profilu",
            type="primary",
            disabled=not can_restore,
            width="stretch",
            key="portable_restore_button_v064",
        ):
            try:
                # Always preserve a portable snapshot of the current state first.
                before = _portable_backup_bytes(uid)
                before_name = (
                    f"logbook_before_restore_{datetime.now(LOCAL_TZ).strftime('%Y%m%d_%H%M')}.zip"
                )

                with connect() as con:
                    restored = restore_user_backup(con, uid, backup_raw or b"")
                    record_audit(
                        con,
                        "restore_portable_backup",
                        "user",
                        uid,
                        {
                            "file": uploaded.name if uploaded is not None else None,
                            "restored": restored,
                            "format_version": (backup_info or {}).get("format_version"),
                        },
                    )
                    con.commit()

                read_user_profile.clear()
                _clear_session_hot_cache("all")
                invalidate_cached_data("all")
                st.session_state["portable_pre_restore_backup_v064"] = before
                st.session_state["portable_pre_restore_name_v064"] = before_name
                st.session_state["portable_restore_success_v064"] = True
                st.session_state.pop("portable_backup_bytes_v064", None)
                st.session_state.pop("portable_backup_name_v064", None)

                auto_backup_after_change("restore_portable_backup")
                st.rerun()
            except BackupError as exc:
                st.error(str(exc))
            except Exception as exc:
                st.error(f"Obnova selhala: {exc}")


def page_export(df: pd.DataFrame):
    st.markdown("## Export")

    section = st.radio(
        "Export sekce",
        ["Soubory", "Tisk", "Náhled dat", "Záloha účtu"],
        horizontal=True,
        label_visibility="collapsed",
        key="export_section_v064",
    )

    if section == "Záloha účtu":
        render_portable_backup()
        return

    if df.empty:
        st.info("Zatím nejsou uložené žádné lety. Přenosnou zálohu profilu můžeš vytvořit v sekci **Záloha účtu**.")
        return

    filtered = render_export_filters(df)
    render_export_summary(filtered)
    prefix = _export_prefix(filtered, "letovy_zapisnik")
    export_signature = _flight_id_tuple(filtered)
    if st.session_state.get("export_signature_v044") != export_signature:
        st.session_state["export_signature_v044"] = export_signature
        st.session_state.pop("export_files_ready_v044", None)
        st.session_state.pop("export_print_ready_v044", None)

    if section == "Soubory":
        st.markdown("### Soubory zápisníku")
        prepare_files = st.button(
            "Připravit exportní soubory",
            type="primary",
            width="stretch",
            key="export_prepare_files_v064",
        )

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
                    width="stretch",
                )
            with c2:
                st.download_button("CSV", data=csv, file_name=f"{prefix}.csv", mime="text/csv", width="stretch")
            with c3:
                st.download_button("Tisk HTML", data=html_doc.encode("utf-8"), file_name=f"{prefix}_tisk.html", mime="text/html", width="stretch")
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
            width="stretch",
        )

    elif section == "Tisk":
        st.markdown("### Tiskový přehled")
        if st.button("Vygenerovat tiskový náhled", width="stretch", key="export_print_preview_v044") or st.session_state.get("export_print_ready_v044"):
            st.session_state["export_print_ready_v044"] = True
            st.iframe(build_print_html(filtered, currency=current_user_currency()), height=620)
        else:
            st.caption("Tiskový náhled se vygeneruje až na vyžádání.")

    elif section == "Náhled dat":
        detail = make_logbook_export_df(filtered, current_user_currency())
        c1, c2 = st.columns(2)
        with c1:
            st.markdown("### Lety")
            st.dataframe(detail.head(300), hide_index=True, width="stretch", height=420)
        with c2:
            st.markdown("### Souhrn")
            st.dataframe(make_summary_table(filtered, current_user_currency()), hide_index=True, width="stretch", height=420)
        st.markdown("### Letadla")
        st.dataframe(make_group_summary(filtered, ["registration", "aircraft_type", "evidence"], current_user_currency()), hide_index=True, width="stretch")




@st.cache_data(show_spinner=False, ttl=30)
def read_admin_user_overview() -> pd.DataFrame:
    """Global admin overview with one aggregate pass per tenant table."""
    with read_connect() as con:
        return db_read_sql_query(
            """
            WITH flight_counts AS (
                SELECT user_id, COUNT(*) AS flights FROM flights GROUP BY user_id
            ),
            aircraft_counts AS (
                SELECT user_id, COUNT(*) AS aircraft FROM aircraft GROUP BY user_id
            ),
            airport_counts AS (
                SELECT user_id, COUNT(*) AS custom_airports FROM airports GROUP BY user_id
            ),
            track_counts AS (
                SELECT user_id, COUNT(*) AS tracks FROM flight_tracks GROUP BY user_id
            ),
            point_counts AS (
                SELECT user_id, COUNT(*) AS gps_points FROM track_points GROUP BY user_id
            )
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
                COALESCE(f.flights, 0) AS flights,
                COALESCE(a.aircraft, 0) AS aircraft,
                COALESCE(ap.custom_airports, 0) AS custom_airports,
                COALESCE(t.tracks, 0) AS tracks,
                COALESCE(p.gps_points, 0) AS gps_points
            FROM users u
            LEFT JOIN user_credentials c ON c.user_id = u.id
            LEFT JOIN user_settings s ON s.user_id = u.id
            LEFT JOIN flight_counts f ON f.user_id = u.id
            LEFT JOIN aircraft_counts a ON a.user_id = u.id
            LEFT JOIN airport_counts ap ON ap.user_id = u.id
            LEFT JOIN track_counts t ON t.user_id = u.id
            LEFT JOIN point_counts p ON p.user_id = u.id
            ORDER BY u.id
            """,
            con,
        )

@st.cache_data(show_spinner=False, ttl=120)
def read_permission_health() -> dict[str, Any]:
    """Global tenant-integrity checks in one production-database round-trip."""
    issue_selects: list[str] = []
    for table in sorted(USER_SCOPED_TABLES):
        # Table names come only from the internal allow-list.
        issue_selects.extend([
            f"SELECT '{table}' AS check_name, 'chybí user_id' AS problem, COUNT(*) AS n "
            f"FROM {table} WHERE user_id IS NULL OR user_id <= 0",
            f"SELECT '{table}' AS check_name, 'neexistující vlastník' AS problem, COUNT(*) AS n "
            f"FROM {table} t LEFT JOIN users u ON u.id=t.user_id WHERE u.id IS NULL",
        ])
    issue_selects.extend([
        """
        SELECT 'flight_tracks' AS check_name,
               'track patří jinému uživateli než let' AS problem,
               COUNT(*) AS n
        FROM flight_tracks t
        JOIN flights f ON f.id=t.flight_id
        WHERE t.user_id<>f.user_id
        """,
        """
        SELECT 'track_points' AS check_name,
               'GPS bod patří jinému uživateli než track' AS problem,
               COUNT(*) AS n
        FROM track_points p
        JOIN flight_tracks t ON t.id=p.track_id
        WHERE p.user_id<>t.user_id
        """,
        """
        SELECT 'users' AS check_name,
               'neplatná role' AS problem,
               COUNT(*) AS n
        FROM users
        WHERE role NOT IN ('admin','user') OR role IS NULL
        """,
        f"""
        SELECT 'users' AS check_name,
               'hlavní profil #1 není aktivní admin' AS problem,
               CASE WHEN COUNT(*)=1 THEN 0 ELSE 1 END AS n
        FROM users
        WHERE id={int(DEFAULT_USER_ID)} AND role='admin' AND active=1
        """,
    ])

    with read_connect() as con:
        # One network round-trip returns all issue counters plus active-user/admin
        # summary rows. Zero-count issue rows are discarded in Python.
        query = " UNION ALL ".join(issue_selects) + " UNION ALL " + """
            SELECT '__stats__' AS check_name, 'active_users' AS problem, COUNT(*) AS n
            FROM users WHERE active=1
            UNION ALL
            SELECT '__stats__' AS check_name, 'admins' AS problem, COUNT(*) AS n
            FROM users WHERE active=1 AND role='admin'
        """
        rows = con.execute(query).fetchall()

    issues: list[dict[str, Any]] = []
    active_users = 0
    admins = 0
    for row in rows:
        check_name = str(row["check_name"])
        problem = str(row["problem"])
        count = int(row["n"] or 0)
        if check_name == "__stats__":
            if problem == "active_users":
                active_users = count
            elif problem == "admins":
                admins = count
            continue
        if count:
            issues.append({"Kontrola": check_name, "Problém": problem, "Počet": count})

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
        ["Přehled", "Uživatelé", "Bezpečnost", "PostgreSQL", "Záloha", "Servis", "Meta"],
        horizontal=True,
        label_visibility="collapsed",
        key="admin_section_v057",
    )

    if section == "Přehled":
        users = read_admin_user_overview()
        counts = {
            "users": int(len(users)),
            "flights": int(pd.to_numeric(users.get("flights", pd.Series(dtype=float)), errors="coerce").fillna(0).sum()) if not users.empty else 0,
            "tracks": int(pd.to_numeric(users.get("tracks", pd.Series(dtype=float)), errors="coerce").fillna(0).sum()) if not users.empty else 0,
            "points": int(pd.to_numeric(users.get("gps_points", pd.Series(dtype=float)), errors="coerce").fillna(0).sum()) if not users.empty else 0,
        }
        active_users = int(pd.to_numeric(users.get("active", pd.Series(dtype=int)), errors="coerce").fillna(0).eq(1).sum()) if not users.empty else 0
        admins = int(users.get("role", pd.Series(dtype=str)).fillna("user").astype(str).str.lower().eq("admin").sum()) if not users.empty else 0
        c1, c2, c3, c4 = st.columns(4)
        with c1: metric_card("Uživatelé", str(counts["users"]), f"{active_users} aktivních")
        with c2: metric_card("Lety", str(counts["flights"]), "všechny profily")
        with c3: metric_card("GPS tracky", str(counts["tracks"]), f"{counts['points']:,} bodů".replace(",", " "))
        with c4: metric_card("Správci", str(admins), f"schema {DB_SCHEMA_VERSION}")
        db_size = DB_PATH.stat().st_size if DB_PATH.exists() else 0
        backend_label = "PostgreSQL" if production_is_postgresql() else "SQLite"
        st.caption(
            f"Aplikace {APP_VERSION} · runtime {backend_label} · "
            f"SQLite fallback {db_size / (1024 * 1024):.1f} MB · "
            f"SQLite schema {DB_SCHEMA_VERSION} · PostgreSQL schema {POSTGRES_FOUNDATION_VERSION}"
        )
        if not users.empty:
            show = users.rename(columns={
                "id":"ID", "display_name":"Jméno", "email":"E-mail", "role":"Role", "active":"Aktivní",
                "created_at":"Vytvořen", "last_login_at":"Poslední přihlášení", "flights":"Lety",
                "aircraft":"Letadla", "custom_airports":"Vlastní letiště", "tracks":"Tracky", "gps_points":"GPS body",
                "home_airport":"Domovské letiště", "currency":"Měna", "timezone":"Časové pásmo", "default_role":"Výchozí funkce",
            })
            st.dataframe(show, hide_index=True, width="stretch", height=420)

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
            create_submitted = st.form_submit_button("Vytvořit profil", type="primary", width="stretch")
        if create_submitted:
            role = "admin" if role_label == "Správce" else "user"
            with connect() as con:
                result = register_user(con, email=email, display_name=display_name, password=password, role=role)
                if result.ok:
                    record_audit(con, "admin_create_user", "user", result.user_id, {"email": str(email).strip().lower(), "role": role})
                    con.commit()
            if result.ok:
                read_user_profile.clear()
                _clear_session_hot_cache("all")
                read_permission_health.clear()
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
            save_user_state = st.form_submit_button("Uložit oprávnění", width="stretch")
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
                    _clear_session_hot_cache("all")
                    read_permission_health.clear()
                    auto_backup_after_change("admin_update_user")
                    st.success("Oprávnění uživatele byla uložena.")
                    st.rerun()
                else:
                    st.error(role_result.error or active_result.error or "Změna se nepodařila.")

        st.markdown("#### Nastavit nové heslo")
        with st.form("admin_reset_user_password_v057"):
            new_password = st.text_input(f"Nové heslo pro #{selected_uid}", type="password")
            reset_password = st.form_submit_button("Nastavit nové heslo", width="stretch")
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
            st.dataframe(issues, hide_index=True, width="stretch")
        else:
            st.success("Všechny uživatelské tabulky mají platného vlastníka a vazby track → let → uživatel jsou konzistentní.")
        st.markdown("#### Bezpečnostní model")
        st.write("• Běžný uživatel čte a mění pouze řádky se svým `user_id`.")
        st.write("• ID bez platného přihlášeného uživatele se už nesmí tiše převést na původní profil #1.")
        st.write("• Admin nástroje jsou oddělené od běžných uživatelských operací.")
        st.write("• Celá produkční databáze a globální audit jsou dostupné pouze administrátorovi.")
        if st.button("Spustit kontrolu znovu", width="stretch", key="admin_permission_recheck_v059"):
            read_permission_health.clear()
            st.rerun()

    elif section == "PostgreSQL":
        # Migration/shadow tooling is intentionally lazy-imported. Normal users
        # and normal admin pages do not import the historical cutover stack.
        from logbook_ui.postgres_admin import render_postgres_admin_panel
        render_postgres_admin_panel()

    elif section == "Záloha":
        metas = read_app_meta()
        md = dict(zip(metas["key"], metas["value"])) if not metas.empty else {}
        last_change = str(md.get("last_change_at") or "")
        is_pg_prod = production_is_postgresql()

        st.markdown("### Záloha a obnova")
        if is_pg_prod:
            st.success("Produkční source of truth je PostgreSQL.")
            st.caption(
                "Přenosná záloha jednotlivého profilu v Export → Záloha účtu dál čte aktuální PostgreSQL data."
            )
            b1, b2, b3, b4 = st.columns(4)
            with b1:
                metric_card("Backend", "PostgreSQL", "production")
            with b2:
                metric_card("Poslední změna", last_change[:19] if last_change else "—", "UTC")
            with b3:
                metric_card("Cutover", str(md.get("production_cutover_at") or "—")[:19], "UTC")
            with b4:
                sqlite_size = DB_PATH.stat().st_size if DB_PATH.exists() else 0
                metric_card("SQLite baseline", f"{sqlite_size / (1024 * 1024):.1f} MB", "frozen fallback")

            st.warning(
                "GitHub SQLite auto-backup je po cutoveru záměrně vypnutý. "
                "Soubor SQLite už není aktuální produkční databáze."
            )
            st.info(
                "Plná SQLite obnova je v PostgreSQL režimu zablokovaná. "
                "To brání tomu, aby se starý SQLite snapshot omylem vydával za obnovenou produkci."
            )
            if DB_PATH.exists():
                with st.expander("Zmrazený SQLite fallback baseline", expanded=False):
                    st.caption(
                        "Tento snapshot je užitečný pouze pro nouzovou diagnostiku/rollback baseline. "
                        "Po cutoveru neobsahuje nové PostgreSQL zápisy."
                    )
                    if st.button("Připravit fallback SQLite snapshot", width="stretch", key="admin_prepare_fallback_sqlite_v072"):
                        try:
                            st.session_state["admin_fallback_sqlite_v072"] = database_snapshot_bytes()
                            st.success("Fallback snapshot připraven.")
                        except Exception as exc:
                            st.error(f"Snapshot selhal: {exc}")
                    frozen = st.session_state.get("admin_fallback_sqlite_v072")
                    if frozen:
                        st.download_button(
                            "Stáhnout fallback logbook.sqlite",
                            data=frozen,
                            file_name="logbook-fallback-baseline.sqlite",
                            mime="application/x-sqlite3",
                            width="stretch",
                            key="admin_download_fallback_sqlite_v072",
                        )
        else:
            st.caption(
                "SQLite je produkční databáze. GitHub snapshot zůstává technická celá záloha; "
                "přenosná záloha jednoho profilu je v Export → Záloha účtu."
            )
            dirty = str(md.get("dirty") or "")
            last_backup = str(md.get("last_github_backup_at") or "")
            b1, b2, b3 = st.columns(3)
            with b1:
                metric_card("Stav", "Nezálohováno" if dirty == "1" else "OK", "dirty flag")
            with b2:
                metric_card("Poslední změna", last_change[:19] if last_change else "—", "UTC")
            with b3:
                metric_card("GitHub backup", last_backup[:19] if last_backup else "—", "UTC")

            if github_auto_backup_enabled():
                st.success("Automatická GitHub SQLite záloha je zapnutá.")
            elif github_backup_configured():
                st.warning("GitHub token je nastavený, ale automatická záloha je vypnutá.")
            else:
                st.warning("GitHub backup není nakonfigurovaný.")

            if DB_PATH.exists():
                if st.button("Připravit SQLite snapshot", width="stretch", key="admin_prepare_snapshot_v072"):
                    try:
                        with st.spinner("Připravuji konzistentní SQLite snapshot…"):
                            st.session_state["admin_sqlite_snapshot_v072"] = database_snapshot_bytes()
                            st.session_state["admin_sqlite_snapshot_change_v072"] = last_change
                        st.success("Snapshot je připravený ke stažení.")
                    except Exception as exc:
                        st.error(f"Snapshot se nepodařilo připravit: {exc}")
                snapshot = st.session_state.get("admin_sqlite_snapshot_v072")
                snapshot_change = str(st.session_state.get("admin_sqlite_snapshot_change_v072") or "")
                if snapshot and snapshot_change == last_change:
                    st.download_button(
                        "Stáhnout celou SQLite databázi",
                        data=snapshot,
                        file_name="logbook.sqlite",
                        mime="application/x-sqlite3",
                        width="stretch",
                        key="admin_download_snapshot_v072",
                    )
                elif snapshot:
                    st.session_state.pop("admin_sqlite_snapshot_v072", None)
                    st.session_state.pop("admin_sqlite_snapshot_change_v072", None)
                    st.warning("Databáze se od přípravy snapshotu změnila. Připrav nový snapshot.")

            if github_backup_configured():
                if st.button("Uložit aktuální SQLite na GitHub", type="primary", width="stretch", key="admin_backup_now_v072"):
                    try:
                        url = backup_database_to_github()
                        st.success("Databáze zazálohována na GitHub." + (f" Commit: {url}" if url else ""))
                    except Exception as exc:
                        st.error(f"Backup selhal: {exc}")

            st.markdown("#### Obnova celé SQLite databáze")
            restore = st.file_uploader("SQLite databáze", type=["sqlite", "db"], key="admin_restore_db_v072")
            confirm = st.text_input("Pro obnovení napiš OBNOVIT", value="", key="admin_restore_confirm_v072")
            if restore is not None and st.button(
                "Obnovit databázi",
                disabled=confirm != "OBNOVIT",
                width="stretch",
                key="admin_restore_btn_v072",
            ):
                try:
                    restore_database_from_upload(restore)
                    _reset_session_state(
                        notice="Databáze byla obnovena. Z bezpečnostních důvodů se přihlas znovu."
                    )
                    st.rerun()
                except SQLiteRestoreError as exc:
                    st.error(f"Obnova odmítnuta: {exc}")
                except Exception as exc:
                    st.error(f"Obnova selhala: {exc}")

    elif section == "Servis":
        render_database_control_panel()

    elif section == "Meta":
        st.markdown("### Metadata aplikace")
        metas = read_app_meta()
        if metas.empty:
            st.info("Žádná metadata.")
        else:
            st.dataframe(metas.sort_values("key"), hide_index=True, width="stretch")
        st.markdown("### Poslední auditní události napříč profily")
        with connect() as con:
            audits = db_read_sql_query("SELECT * FROM audit_log ORDER BY id DESC LIMIT 500", con)
        if audits.empty:
            st.info("Žádný audit log.")
        else:
            st.dataframe(audits, hide_index=True, width="stretch", height=420)

def page_profile(df: pd.DataFrame) -> None:
    uid = strict_user_id(current_user_id())
    profile = current_user_profile(uid)
    prefs = _profile_preferences(profile)
    counts = session_read_logbook_counts(uid)
    flights_count = int(len(df))

    st.markdown("## Profil a nastavení")
    st.caption("Všechna nastavení patří pouze tomuto účtu. Ostatní uživatelé mají vlastní profil i vlastní data.")

    p1, p2, p3, p4 = st.columns(4)
    with p1: metric_card("Profil", f"#{uid}", "Správce" if is_admin() else "Uživatel")
    with p2: metric_card("Lety", str(flights_count), "vlastní záznamy")
    with p3: metric_card("Letadla", str(counts.get("aircraft", 0)), "vlastní profily")
    with p4: metric_card("GPS", str(counts.get("tracks", 0)), "vlastní tracky")

    tabs = st.tabs(["Profil", "Platnosti", "Výchozí hodnoty", "Zabezpečení"])

    with tabs[0]:
        st.markdown("### Osobní profil")
        st.caption("Jméno se používá například jako výchozí velitel nového letu.")
        with st.form("profile_identity_form_v059"):
            display_name = st.text_input("Jméno", value=str(profile.get("display_name") or ""))
            st.text_input("E-mail účtu", value=str(profile.get("email") or ""), disabled=True)
            submitted = st.form_submit_button("Uložit profil", type="primary", width="stretch")
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
                _clear_session_hot_cache("all")
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
        _render_profile_validity_tab(df)

    with tabs[2]:
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
            save_defaults = st.form_submit_button("Uložit výchozí hodnoty", type="primary", width="stretch")

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
                _clear_session_hot_cache("all")
                invalidate_cached_data("all")
                auto_backup_after_change("update_user_settings")
                st.success("Výchozí hodnoty byly uloženy.")
                st.rerun()

        st.info(
            f"Nový ručně zadaný let se nyní předvyplní jako **{default_evidence} / {default_role}**"
            + (f" z **{home_airport}**." if home_airport else ".")
        )

    with tabs[3]:
        st.markdown("### Přihlašovací e-mail")
        st.caption("Změnu e-mailu je nutné potvrdit současným heslem.")
        with st.form("change_user_email_form_v059"):
            new_email = st.text_input("Nový e-mail", value=str(profile.get("email") or ""))
            email_password = st.text_input("Současné heslo", type="password", key="profile_email_password_v059")
            email_submit = st.form_submit_button("Změnit e-mail", width="stretch")
        if email_submit:
            with connect() as con:
                result = change_email(con, user_id=uid, current_password=email_password, new_email=new_email)
                if result.ok:
                    record_audit(con, "change_email", "user", uid, {"new_email": str(new_email).strip().lower()})
                    con.commit()
            if result.ok:
                read_user_profile.clear()
                _clear_session_hot_cache("all")
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
            change_submitted = st.form_submit_button("Změnit heslo", width="stretch")
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
    """Render a compositor-friendly edge handle for the sidebar.

    The control is deliberately minimal (two horizontal chevrons in the sidebar header area, no visible button chrome).
    It toggles only a CSS class on ``body`` and never triggers a Streamlit rerun.
    """
    st.html(
        """
        <button id="lb-sidebar-toggle" type="button"
                aria-label="Skrýt nebo zobrazit menu"
                aria-expanded="true"
                title="Skrýt / zobrazit menu">
          <span class="lb-sidebar-chevron" aria-hidden="true">‹</span>
          <span class="lb-sidebar-chevron" aria-hidden="true">‹</span>
        </button>
        <script>
        (function() {
          const doc = document;
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

          function paintButton(hidden) {
            const btn = doc.getElementById(btnId);
            if (!btn) return;
            btn.setAttribute('aria-expanded', hidden ? 'false' : 'true');
            btn.dataset.sidebarState = hidden ? 'closed' : 'open';
            btn.querySelectorAll('.lb-sidebar-chevron').forEach(el => {
              el.textContent = hidden ? '›' : '‹';
            });
          }

          function setHidden(hidden, persist=true) {
            if (doc.body.classList.contains('lb-sidebar-hidden') === hidden) {
              paintButton(hidden);
              return;
            }
            // One rAF keeps the class change aligned with the browser's compositor
            // frame instead of mixing it with Streamlit's HTML reconciliation.
            window.requestAnimationFrame(() => {
              doc.body.classList.toggle('lb-sidebar-hidden', hidden);
              paintButton(hidden);
              if (persist) {
                try { window.localStorage.setItem(storageKey, hidden ? '1' : '0'); } catch(e) {}
              }
            });
          }

          function install() {
            const btn = doc.getElementById(btnId);
            if (!btn) return false;
            btn.onclick = function(ev) {
              ev.preventDefault();
              ev.stopPropagation();
              setHidden(!doc.body.classList.contains('lb-sidebar-hidden'));
            };
            hideNativeButtons();
            const saved = (function() {
              try { return window.localStorage.getItem(storageKey) === '1'; }
              catch(e) { return false; }
            })();
            // Initial state must not animate from the opposite side on page load.
            doc.body.classList.toggle('lb-sidebar-hidden', saved);
            paintButton(saved);
            return true;
          }

          install();
          setTimeout(install, 80);
          setTimeout(install, 260);

          if (window.__lbSidebarObserver) {
            try { window.__lbSidebarObserver.disconnect(); } catch(e) {}
            window.__lbSidebarObserver = null;
          }
        })();
        </script>
        """,
        width="content",
        unsafe_allow_javascript=True,
    )


def render_page_transition_runtime() -> None:
    """Install a tiny front-end page loader.

    Streamlit reruns the Python script after every sidebar button click. Without a
    front-end transition, the previous page visually disappears piece by piece
    while the new page is being generated. This overlay hides that intermediate
    state and makes navigation feel much closer to a normal web app.
    """
    st.html(
        """
        <script>
        (function() {
          const doc = document;
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
            clearTimeout(window.__lbLoaderSafety1);
            clearTimeout(window.__lbLoaderSafety2);
            clearTimeout(window.__lbLoaderSafety3);
            clearTimeout(window.__lbLoaderSafety4);
            window.__lbLoaderSafety1 = setTimeout(hideLoader, 900);
            window.__lbLoaderSafety2 = setTimeout(hideLoader, 1800);
            window.__lbLoaderSafety3 = setTimeout(hideLoader, 4000);
            window.__lbLoaderSafety4 = setTimeout(hideLoader, 7000);
          }
          function hideLoader() {
            ensureOverlay();
            doc.body.classList.remove('lb-page-loading');
          }

          if (!window.__lbPageLoaderInstalled) {
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
            window.__lbPageLoaderInstalled = true;
          }
          // The new page has reached the browser once this component runs.
          setTimeout(hideLoader, 70);
          setTimeout(hideLoader, 500);
          setTimeout(hideLoader, 1800);
          setTimeout(hideLoader, 4000);
        })();
        </script>
        """,
        unsafe_allow_javascript=True,
    )


def render_page_loaded_signal() -> None:
    """Hide the front-end loader after the current Streamlit page has rendered."""
    st.html(
        """
        <script>
        (function() {
          const doc = document;
          function hideLoader() { doc.body.classList.remove('lb-page-loading'); }
          setTimeout(hideLoader, 20);
          setTimeout(hideLoader, 100);
          setTimeout(hideLoader, 420);
          setTimeout(hideLoader, 1500);
          setTimeout(hideLoader, 4000);
        })();
        </script>
        """,
        unsafe_allow_javascript=True,
    )


# -----------------------------------------------------------------------------
# Main
# -----------------------------------------------------------------------------

def main():
    st.set_page_config(page_title="Letový zápisník", page_icon="assets/logbook_icon_32.png", layout="wide", initial_sidebar_state="expanded")
    if not _DB_READY:
        try:
            with connect():
                pass
        except (DatabaseBackendError, ProductionCutoverError) as exc:
            st.error("Produkční databázi se nepodařilo bezpečně otevřít.")
            st.code(str(exc), language=None)
            st.warning(
                "Automatický fallback na jiný backend je záměrně vypnutý, aby nevznikly dvě rozdílné databáze."
            )
            return
        except Exception as exc:
            st.error("Start databáze selhal.")
            st.code(str(exc), language=None)
            return
    try:
        if not render_auth_gate():
            return
    except DATABASE_ERRORS:
        _render_database_runtime_error("Přihlašovací data se nepodařilo načíst.")
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
    if emergency_sqlite_fallback_active():
        st.error(
            "NOUZOVÝ SQLITE FALLBACK JE AKTIVNÍ · případné nové zápisy vytvoří vědomou divergenci "
            "a automatický návrat na PostgreSQL bude zablokovaný."
        )
    page = st.session_state.get("page", "Dashboard")
    page_render_started = time_module.perf_counter()

    # Data se načítají až pro aktivní stránku. GPS Map Engine 2.0 ve v0.54
    # pracuje s lehkými metadaty, adaptivním point budgetem a vzorkovanými
    # body z track_points místo plného coordinates_json pro každý track.
    try:
        if page == "Dashboard":
            page_dashboard(session_read_flights(current_user_id()))
        elif page == "Recency":
            # Legacy bookmark/session from v0.63: recency now lives inside Profile.
            st.session_state["page"] = "Profil"
            st.rerun()
        elif page == "Lety":
            page_logbook(session_read_flights(current_user_id()), dark_mode)
        elif page == "Nový let":
            page_new_flight(read_rates(current_user_id()), dark_mode)
        elif page == "Mapa":
            page_maps(session_read_flights(current_user_id()), dark_mode)
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
            page_export(session_read_flights(current_user_id()))
        elif page == "Profil":
            page_profile(session_read_flights(current_user_id()))
        elif page == "Admin":
            if is_admin():
                page_admin()
            else:
                st.session_state["page"] = "Dashboard"
                st.rerun()
    except DATABASE_ERRORS:
        _render_database_runtime_error(f"Stránku „{page}“ se nepodařilo načíst.")
    record_page_event(
        page=str(page),
        duration_ms=(time_module.perf_counter() - page_render_started) * 1000.0,
    )
    render_page_loaded_signal()

if __name__ == "__main__":
    main()
