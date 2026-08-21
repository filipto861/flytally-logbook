from pathlib import Path
import ast
import json
import sqlite3

from logbook_core.config import APP_VERSION, DB_SCHEMA_VERSION, POSTGRES_FOUNDATION_VERSION
from logbook_core.map_engine import (
    TRACK_OVERVIEW_MAX_POINTS,
    TRACK_OVERVIEW_VERSION,
    encode_overview_track_points,
)
from logbook_core.postgres_schema import POSTGRES_SCHEMA_VERSION, POSTGRES_TABLE_COLUMNS
from logbook_core.schema import SCHEMA

ROOT = Path(__file__).resolve().parents[1]


def _source() -> str:
    return (ROOT / "app.py").read_text(encoding="utf-8")


def _function(source: str, name: str) -> str:
    tree = ast.parse(source)
    for node in tree.body:
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)) and node.name == name:
            return ast.get_source_segment(source, node) or ""
    raise AssertionError(f"Missing function: {name}")


def test_release_versions_and_schema_upgrade():
    assert APP_VERSION == "v0.73.3.1"
    assert DB_SCHEMA_VERSION == 11
    assert POSTGRES_FOUNDATION_VERSION == 2
    assert POSTGRES_SCHEMA_VERSION == 2


def test_overview_geometry_is_bounded_latlon_only():
    points = [
        {"lat": 50.0 + i * 0.0001, "lon": 14.0 + i * 0.0002, "alt": 300 + i, "time": f"2026-01-01T10:{i%60:02d}:00Z"}
        for i in range(1000)
    ]
    raw = encode_overview_track_points(points)
    out = json.loads(raw)
    assert 2 <= len(out) <= TRACK_OVERVIEW_MAX_POINTS
    assert out[0]["lat"] == 50.0
    assert set(out[0]) == {"lat", "lon"}
    assert all(set(item) == {"lat", "lon"} for item in out)
    assert TRACK_OVERVIEW_VERSION == 1


def test_sqlite_and_postgres_schema_have_persistent_overview_columns():
    con = sqlite3.connect(":memory:")
    con.executescript(SCHEMA)
    cols = {row[1] for row in con.execute("PRAGMA table_info(flight_tracks)").fetchall()}
    assert {"overview_coordinates_json", "overview_version"} <= cols
    assert {"overview_coordinates_json", "overview_version"} <= set(POSTGRES_TABLE_COLUMNS["flight_tracks"])


def test_runtime_postgres_schema_upgrade_is_called_before_ready():
    source = _source()
    block = _function(source, "_connect_postgres_runtime")
    assert "activate_postgres_production" in block
    assert "ensure_postgres_runtime_schema(config.postgres)" in block
    assert block.index("ensure_postgres_runtime_schema") < block.index('_DB_READY = True')


def test_runtime_schema_upgrade_is_idempotent_ddl():
    source = (ROOT / "logbook_core" / "runtime_schema.py").read_text(encoding="utf-8")
    assert "ADD COLUMN IF NOT EXISTS overview_coordinates_json" in source
    assert "ADD COLUMN IF NOT EXISTS overview_version" in source
    assert "CREATE INDEX IF NOT EXISTS" in source
    assert "pg_advisory_xact_lock" in source


def test_new_tracks_store_overview_at_import_time():
    source = _source()
    block = _function(source, "save_track")
    assert "encode_overview_track_points" in block
    assert "overview_coordinates_json" in block
    assert "overview_version" in block
    assert "TRACK_OVERVIEW_VERSION" in block


def test_map_warm_path_reads_only_small_overview_payload():
    source = _source()
    block = _function(source, "read_track_geometry_payloads")
    first_select = block[:block.index("if missing:")]
    assert "SELECT id, overview_coordinates_json" in first_select
    assert "SELECT id, coordinates_json" not in first_select
    assert "overview_version" in first_select
    # Full payload remains a legacy-only branch.
    legacy = block[block.index("if missing:"):]
    assert "SELECT id, coordinates_json" in legacy
    assert "UPDATE flight_tracks" in legacy


def test_dashboard_has_compact_postgres_dataset_and_session_hot_path():
    source = _source()
    reader = _function(source, "read_dashboard_flights")
    assert "SELECT" in reader
    assert "f.*" not in reader
    for heavy in ("f.note", "f.commander", "f.instructor", "f.task"):
        assert heavy not in reader
    assert "compute_metrics" in reader

    hot = _function(source, "session_read_dashboard_flights")
    assert "_SESSION_HOT_DASHBOARD_PREFIX" in hot
    assert "_SESSION_HOT_FLIGHTS_PREFIX" in hot
    assert "read_dashboard_flights" in hot

    main = _function(source, "main")
    assert "page_dashboard(session_read_dashboard_flights(current_user_id()))" in main


def test_default_dashboard_chart_does_not_import_plotly():
    source = _source()
    block = _function(source, "page_dashboard")
    before_details = block[:block.index("show_details = st.toggle")]
    assert "render_dashboard_primary_chart_light" in before_details
    assert "import plotly" not in before_details
    assert "st.plotly_chart" not in before_details


def test_hot_cache_ttl_is_longer_but_mutation_invalidated():
    source = _source()
    assert "_SESSION_HOT_TTL_SECONDS = 300.0" in source
    invalidation = _function(source, "invalidate_cached_data")
    assert '_clear_session_hot_cache("dashboard", uid)' in invalidation
    assert '_clear_session_hot_cache("flights", uid)' in invalidation
