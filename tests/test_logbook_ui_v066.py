from pathlib import Path

from logbook_core.config import APP_VERSION, DB_SCHEMA_VERSION

ROOT = Path(__file__).resolve().parents[1]


def test_version_without_schema_change():
    assert APP_VERSION == "v0.68"
    assert DB_SCHEMA_VERSION == 9


def test_list_is_reduced_to_one_action_and_nine_columns():
    source = (ROOT / "app.py").read_text(encoding="utf-8")
    start = source.index("def render_flight_list(")
    end = source.index("def _format_recency_date", start)
    block = source[start:end]

    for header in ("Detail", "Datum", "Letadlo", "Trasa", "Časy", "Block", "Funkce", "Přist.", "GPS"):
        assert f'"{header}"' in block
    assert "widths = [0.72, 0.92, 1.18, 1.24, 1.17, 0.76, 1.02, 0.58, 0.68]" in block
    assert "flight_edit_btn_" not in block
    assert "flight_track_btn_" not in block
    assert "flight_detail_btn_v066_" in block
    assert "quick_search_flights(table_df, quick_filter)" in block


def test_detail_has_filtered_previous_next_navigation():
    source = (ROOT / "app.py").read_text(encoding="utf-8")
    assert "navigation_ids: list[int] | None = None" in source
    assert 'flight_navigation(navigation_ids or [], selected_id)' in source
    assert '"← Předchozí"' in source
    assert '"Další →"' in source
    assert "navigation_ids=navigation_ids" in source


def test_detail_overview_is_pilot_focused():
    source = (ROOT / "app.py").read_text(encoding="utf-8")
    assert '<div class="detail-card-label">Block</div>' in source
    assert '<div class="detail-card-label">Air</div>' in source
    assert '<div class="detail-card-label">Přistání</div>' in source
    assert '<div class="detail-card-label">Náklady</div>' in source
    assert '<div class="detail-kv-title">Let a časy</div>' in source
    assert '<div class="detail-kv-title">Letadlo a posádka</div>' in source


def test_logbook_summary_prioritises_landings_over_gps_card():
    source = (ROOT / "app.py").read_text(encoding="utf-8")
    start = source.index("def page_logbook")
    end = source.index("def _smart_import_signature", start)
    block = source[start:end]
    assert 'metric_card("Přistání", str(s["starts"])' in block
    assert 'metric_card("GPS"' not in block


def test_unsafe_html_user_text_is_escaped_in_list_and_detail():
    source = (ROOT / "app.py").read_text(encoding="utf-8")
    assert "main_txt = html.escape(_safe_text(main))" in source
    assert "sub_txt = html.escape(_safe_text(sub))" in source
    assert "html.escape(note_text)" in source
