from pathlib import Path

from logbook_core.config import APP_VERSION, DB_SCHEMA_VERSION

ROOT = Path(__file__).resolve().parents[1]


def _app() -> str:
    return (ROOT / "app.py").read_text(encoding="utf-8")


def test_version_without_schema_change():
    assert APP_VERSION == "v0.73.3.1"
    assert DB_SCHEMA_VERSION == 11


def test_sidebar_navigation_does_not_force_second_rerun():
    source = _app()
    start = source.index("def _set_page_callback")
    end = source.index("def render_sidebar_nav", start)
    block = source[start:end]

    assert "on_click=_set_page_callback" in block
    assert 'args=(page_name,)' in block
    assert "st.rerun()" not in block
    assert "def go_to_page(" not in source


def test_profile_cache_is_session_hot_and_still_keeps_request_cache():
    source = _app()
    assert "_RUN_USER_PROFILE_CACHE: dict[int, dict[str, Any]] = {}" in source
    assert "def current_user_profile(" in source
    helper_start = source.index("def current_user_profile(")
    helper_end = source.index("def current_user_display_name", helper_start)
    helper = source[helper_start:helper_end]

    assert "_session_hot_get(session_key)" in helper
    assert "_RUN_USER_PROFILE_CACHE.get(uid)" in helper
    assert "read_user_profile(uid)" in helper


def test_common_current_user_helpers_reuse_one_profile_snapshot():
    source = _app()
    required = (
        "def current_user_display_name",
        "def current_user_currency",
        "def current_user_timezone",
        "def current_user_default_evidence",
        "def current_user_default_role",
        "def current_user_home_airport",
        "def render_user_sidebar",
    )
    for marker in required:
        assert marker in source

    first_section = source[source.index("def current_user_display_name"):source.index("def _auth_state")]
    assert "read_user_profile(current_user_id())" not in first_section
    assert "current_user_profile()" in first_section


def test_v069_hardening_is_preserved():
    source = _app()
    assert "_DB_INIT_LOCK = threading.RLock()" in source
    assert "_GITHUB_BACKUP_LOCK = threading.Lock()" in source
    assert "snapshot_sqlite_bytes" in source
    assert "atomic_replace_sqlite" in source
    assert "MAX_ADMIN_RESTORE_BYTES" in source
