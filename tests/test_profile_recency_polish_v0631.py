from pathlib import Path

from logbook_core.config import APP_VERSION, DB_SCHEMA_VERSION, NAV_ITEMS

ROOT = Path(__file__).resolve().parents[1]


def test_version_and_schema():
    assert APP_VERSION == "v0.73.1"
    assert DB_SCHEMA_VERSION == 10


def test_recency_is_not_a_sidebar_item():
    assert ("Recency", "Recency") not in NAV_ITEMS
    assert ("Profil", "Profil") in NAV_ITEMS


def test_profile_contains_validity_tab():
    source = (ROOT / "app.py").read_text(encoding="utf-8")
    assert 'st.tabs(["Profil", "Platnosti", "Výchozí hodnoty", "Zabezpečení"])' in source
    assert "def _render_profile_validity_tab(df: pd.DataFrame)" in source
    assert "_render_profile_validity_tab(df)" in source


def test_recency_ui_is_simplified():
    source = (ROOT / "app.py").read_text(encoding="utf-8")
    assert "Aktivita podle období" not in source
    assert "activity_windows(" not in source
    assert "PIC ULL • 90 dní" in source
    assert "PIC EASA • 90 dní" in source
    assert "Doklady a platnosti" in source


def test_legacy_recency_route_redirects_to_profile():
    source = (ROOT / "app.py").read_text(encoding="utf-8")
    assert 'elif page == "Recency":' in source
    assert 'st.session_state["page"] = "Profil"' in source


def test_profile_route_loads_flights_for_embedded_activity():
    source = (ROOT / "app.py").read_text(encoding="utf-8")
    assert 'page_profile(session_read_flights(current_user_id()))' in source
