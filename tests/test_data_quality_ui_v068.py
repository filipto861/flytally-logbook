from pathlib import Path

from logbook_core.config import APP_VERSION, DB_SCHEMA_VERSION

ROOT = Path(__file__).resolve().parents[1]


def _app():
    return (ROOT / "app.py").read_text(encoding="utf-8")


def test_version_without_schema_change():
    assert APP_VERSION == "v0.73"
    assert DB_SCHEMA_VERSION == 10


def test_data_quality_lives_under_database_not_sidebar():
    source = _app()
    config = (ROOT / "logbook_core" / "config.py").read_text(encoding="utf-8")
    assert '["Letadla", "Letiště", "Kvalita dat"]' in source
    nav_block = config[config.index("NAV_ITEMS ="):config.index("]", config.index("NAV_ITEMS =")) + 1]
    assert "Kvalita dat" not in nav_block


def test_quality_scan_is_manual_and_session_local():
    source = _app()
    assert '"Spustit kontrolu"' in source
    assert 'scan_key = f"data_quality_scan_v068_u{uid}"' in source
    assert "build_data_quality_scan(uid)" in source
    assert "st.session_state[scan_key]" in source


def test_quality_reader_avoids_coordinates_json():
    source = _app()
    start = source.index("def read_quality_track_metadata")
    end = source.index("def _quality_used_airports", start)
    block = source[start:end]
    sql_start = block.index('SELECT')
    sql_block = block[sql_start:]
    assert "coordinates_json" not in sql_block
    assert "ORDER BY p.seq ASC" in sql_block
    assert "ORDER BY p.seq DESC" in sql_block


def test_safe_bulk_repair_is_profile_only_and_audited():
    source = _app()
    assert 'audit_action="data_quality_safe_fill"' in source
    assert '"evidence",' in source
    assert '"aircraft_type",' in source
    assert '"aircraft_class",' in source
    assert '"role",' in source
    assert "record_audit(" in source
    assert "auto_backup_after_change(audit_action)" in source


def test_gps_airport_suggestion_requires_explicit_button():
    source = _app()
    assert 'issue["patch_kind"] = "gps"' in source
    assert '"Použít GPS návrh"' in source
    assert 'audit_action="data_quality_gps_suggestion"' in source


def test_quality_cards_are_styled():
    theme = (ROOT / "logbook_ui" / "theme.py").read_text(encoding="utf-8")
    assert ".quality-hero {{" in theme
    assert ".quality-issue {{" in theme
    assert ".quality-issue-problem::before {{" in theme
