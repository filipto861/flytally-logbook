from pathlib import Path

from logbook_core.config import APP_VERSION, DB_SCHEMA_VERSION

ROOT = Path(__file__).resolve().parents[1]


def test_version_without_schema_change():
    assert APP_VERSION == "v0.73.2"
    assert DB_SCHEMA_VERSION == 10


def test_manual_entry_uses_compact_layout():
    source = (ROOT / "app.py").read_text(encoding="utf-8")
    assert 'prefix = "new_manual_v065"' in source
    assert "compact_layout=True" in source
    assert "allow_add_another=True" in source
    assert '"Další údaje"' in source
    assert '"Uložit a přidat další"' in source


def test_kml_and_edit_keep_full_layout():
    source = (ROOT / "app.py").read_text(encoding="utf-8")
    assert 'flight_form("new_from_track_v061", defaults, rates, "Pokračovat na finální kontrolu")' in source
    assert 'flight_form(f"edit_flight_{selected_id}", row.to_dict(), rates, "Uložit změny", quick_tools=False, prompt_missing_aircraft=False)' in source


def test_next_leg_continuity_is_explicit():
    source = (ROOT / "app.py").read_text(encoding="utf-8")
    assert "def _prepare_next_manual_entry" in source
    assert 'next_departure = normalize_text(saved.get("arrival")) or normalize_text(saved.get("departure"))' in source
    assert '"arr": ""' in source
    assert '"off": ""' in source
    assert '"to": ""' in source
    assert '"ldg": ""' in source
    assert '"on": ""' in source


def test_manual_entry_has_visual_context_and_route_shortcuts():
    source = (ROOT / "app.py").read_text(encoding="utf-8")
    theme = (ROOT / "logbook_ui" / "theme.py").read_text(encoding="utf-8")
    assert "def _render_manual_entry_context" in source
    assert "def _render_manual_route_shortcuts" in source
    assert ".flight-entry-context {{" in theme
    assert ".flight-entry-section-label {{" in theme
