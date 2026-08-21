from pathlib import Path

from logbook_core.config import APP_VERSION, DB_SCHEMA_VERSION

ROOT = Path(__file__).resolve().parents[1]


def test_hotfix_version_without_schema_change():
    assert APP_VERSION == "v0.73.3.1"
    assert DB_SCHEMA_VERSION == 11


def test_route_shortcuts_are_none_safe():
    source = (ROOT / "app.py").read_text(encoding="utf-8")
    assert 'dep = (normalize_text(st.session_state.get(f"{prefix}_dep", defaults.get("departure"))) or "").upper()' in source
    assert 'arr = (normalize_text(st.session_state.get(f"{prefix}_arr", defaults.get("arrival"))) or "").upper()' in source


def test_next_leg_optional_uppercase_values_are_none_safe():
    source = (ROOT / "app.py").read_text(encoding="utf-8")
    assert '"ev": (normalize_text(saved.get("evidence")) or "").upper(),' in source
    assert '"class": (normalize_text(saved.get("aircraft_class")) or "").upper(),' in source
    assert '"role": (normalize_text(saved.get("role")) or "").upper() or current_user_default_role(),' in source


def test_no_unsafe_normalize_text_upper_patterns_remain_in_manual_helpers():
    source = (ROOT / "app.py").read_text(encoding="utf-8")
    start = source.index("def _render_manual_route_shortcuts")
    end = source.index("def _track_time_proposal", start)
    manual_helpers = source[start:end]
    assert "normalize_text(st.session_state.get" not in manual_helpers or 'or "").upper()' in manual_helpers
    assert "normalize_text(saved.get(\"evidence\")).upper()" not in manual_helpers
    assert "normalize_text(saved.get(\"aircraft_class\")).upper()" not in manual_helpers
    assert "normalize_text(saved.get(\"role\")).upper()" not in manual_helpers
