from pathlib import Path
import ast

from logbook_core.config import APP_VERSION, DB_SCHEMA_VERSION

ROOT = Path(__file__).resolve().parents[1]


def _source() -> str:
    return (ROOT / "app.py").read_text(encoding="utf-8")


def _function(source: str, name: str) -> str:
    tree = ast.parse(source)
    for node in tree.body:
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)) and node.name == name:
            return ast.get_source_segment(source, node) or ""
    raise AssertionError(f"Missing function {name}")


def test_version_is_navigation_latency_hotfix_without_schema_change():
    assert APP_VERSION == "v0.73.2"
    assert DB_SCHEMA_VERSION == 10


def test_main_navigation_uses_session_hot_flights():
    source = _source()
    block = _function(source, "main")
    for page_call in (
        "page_dashboard(session_read_flights(current_user_id()))",
        "page_logbook(session_read_flights(current_user_id()), dark_mode)",
        "page_maps(session_read_flights(current_user_id()), dark_mode)",
        "page_export(session_read_flights(current_user_id()))",
        "page_profile(session_read_flights(current_user_id()))",
    ):
        assert page_call in block


def test_session_hot_flights_wraps_cached_database_read():
    source = _source()
    block = _function(source, "session_read_flights")
    assert "_SESSION_HOT_FLIGHTS_PREFIX" in block
    assert "_session_hot_get(key)" in block
    assert "read_flights(uid)" in block
    assert "_session_hot_set(key" in block


def test_profile_is_session_hot_across_reruns():
    source = _source()
    block = _function(source, "current_user_profile")
    assert "_SESSION_HOT_PROFILE_PREFIX" in block
    assert "_session_hot_get(session_key)" in block
    assert "read_user_profile(uid)" in block
    assert "_session_hot_set(session_key" in block


def test_normal_profile_query_no_longer_joins_credentials():
    source = _source()
    block = _function(source, "read_user_profile")
    assert "FROM users u" in block
    assert "LEFT JOIN user_settings" in block
    assert "LEFT JOIN user_credentials" not in block
    assert "last_login_at" not in block


def test_hot_caches_are_invalidated_after_flight_track_profile_changes():
    source = _source()
    block = _function(source, "invalidate_cached_data")
    assert '_clear_session_hot_cache("flights", uid)' in block
    assert '_clear_session_hot_cache("counts", uid)' in block
    assert '_clear_session_hot_cache("profile", uid)' in block
    assert "_RUN_USER_PROFILE_CACHE.pop(uid, None)" in block


def test_database_restore_clears_all_session_hot_data():
    source = _source()
    block = _function(source, "invalidate_cached_data")
    assert '_clear_session_hot_cache("all")' in block


def test_database_health_keeps_its_own_cached_read_path():
    source = _source()
    block = _function(source, "build_database_health_report")
    assert "read_flights(strict_user_id(user_id))" in block
    assert "session_read_flights(" not in block


def test_session_hot_cache_has_bounded_ttl():
    source = _source()
    assert "_SESSION_HOT_TTL_SECONDS = 45.0" in source
    block = _function(source, "_session_hot_get")
    assert "time_module.monotonic()" in block
    assert "_SESSION_HOT_TTL_SECONDS" in block
