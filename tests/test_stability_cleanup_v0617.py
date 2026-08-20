from pathlib import Path
import ast

ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / "app.py"


def _source() -> str:
    return APP.read_text(encoding="utf-8")


def test_no_legacy_performance_fallback():
    text = _source()
    assert "except ModuleNotFoundError" not in text
    assert "from logbook_core.performance import (" in text


def test_session_user_never_falls_back_to_owner_one():
    text = _source()
    assert "def _session_user_id()" in text
    assert "normalize_user_id(st.session_state" not in text
    assert "return _session_user_id() if is_user_authenticated() else 0" in text


def test_generic_table_reads_are_allowlisted():
    text = _source()
    assert '_READABLE_TABLES = frozenset(USER_SCOPED_TABLES) | {"app_meta"}' in text
    assert "table = _validated_read_table(table)" in text


def test_current_db_bootstrap_skips_duplicate_schema_pass():
    text = _source()
    assert 'tenancy_ready_before = _meta_value(con, "tenancy_v1", "0") == "1"' in text
    assert "if not tenancy_ready_before:" in text


def test_map_cache_does_not_use_pandas_json_parser():
    text = _source()
    assert "pd.read_json" not in text
    assert "pd.DataFrame.from_records(records)" in text


def test_no_global_sqlite_startup_hook():
    assert not (ROOT / "sitecustomize.py").exists()


def test_runtime_dependencies_are_exactly_pinned():
    req = (ROOT / "requirements.txt").read_text(encoding="utf-8").splitlines()
    assert req == [
        "streamlit==1.62.0",
        "pandas==3.0.5",
        "openpyxl==3.1.5",
        "plotly==6.9.0",
        "folium==0.20.0",
        "streamlit-folium==0.27.4",
        "requests==2.34.2",
        "numpy==2.5.2",
        "pyarrow==24.0.0",
        "psycopg[binary,pool]==3.3.4",
    ]


def test_no_confirmed_dead_functions_returned():
    tree = ast.parse(_source())
    names = {
        node.name
        for node in tree.body
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef))
    }
    removed = {
        "import_ourairports_to_database",
        "import_airport_csv_upload",
        "read_track_counts",
        "read_tracks_joined",
        "read_tracks_joined_for_flights",
        "get_selected_dataframe_rows",
        "detail_link",
        "airport_link",
        "route_link",
        "_kml_range_label",
        "_kml_quality",
        "prepare_tracks_for_map",
        "cached_route_overview_map_html",
        "make_track_playback_map",
        "flight_label",
        "flight_display_df",
        "_state_key",
        "set_form_values",
        "recent_flights_for_templates",
        "_template_label",
        "render_flight_validation",
        "_flight_validation_status",
        "_status_badge",
        "page_control",
    }
    assert not (names & removed)


def test_deprecated_streamlit_patterns_stay_removed():
    text = _source()
    assert "use_container_width=" not in text
    assert "streamlit.components.v1" not in text
    assert "width=0" not in text
