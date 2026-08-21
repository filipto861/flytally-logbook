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
    raise AssertionError(f"Missing function: {name}")


def test_release_version_without_schema_migration():
    assert APP_VERSION == "v0.73.2"
    assert DB_SCHEMA_VERSION == 10


def test_overview_map_no_longer_reads_track_points():
    source = _source()
    block = _function(source, "read_track_map_records_for_flights")
    assert "read_track_geometry_payloads(" in block
    assert "read_sampled_track_points(" not in block
    assert "_decode_points_for_map(" in block


def test_geometry_reader_is_simple_flight_tracks_query():
    source = _source()
    block = _function(source, "read_track_geometry_payloads")
    assert "FROM flight_tracks" in block
    assert "coordinates_json" in block
    assert "FROM track_points" not in block
    assert "ROW_NUMBER()" not in block
    assert "COUNT(*) OVER" not in block


def test_track_geometry_cache_is_invalidated_with_track_mutation():
    source = _source()
    block = _function(source, "invalidate_cached_data")
    assert '"read_track_geometry_payloads"' in block


def test_database_aircraft_uses_one_bundle_reader():
    source = _source()
    block = _function(source, "page_database")
    assert "aircraft, rates, usage = read_aircraft_database_bundle(uid)" in block
    aircraft_section = block[block.index('elif section == "Letadla":'):]
    assert 'read_table("aircraft", uid)' not in aircraft_section
    assert "rates = read_rates(uid)" not in aircraft_section
    assert "usage = read_aircraft_usage_summary(uid)" not in aircraft_section


def test_postgres_aircraft_bundle_is_single_query():
    source = _source()
    block = _function(source, "read_aircraft_database_bundle")
    pg_branch = block[block.index("if not production_is_postgresql():"):]
    assert pg_branch.count("db_read_sql_query(") == 1
    assert "WITH usage AS" in pg_branch
    assert "LEFT JOIN rates" in pg_branch


def test_airport_count_remote_read_is_deferred_to_airport_section():
    source = _source()
    block = _function(source, "page_database")
    assert 'if section == "Letiště"' in block
    assert "read_airport_registry_count(current_user_id())" in block
    section_pos = block.index('section = st.radio(')
    count_pos = block.index("read_airport_registry_count(current_user_id())")
    assert section_pos < count_pos


def test_aircraft_bundle_invalidated_by_flights_rates_and_aircraft():
    source = _source()
    block = _function(source, "invalidate_cached_data")
    assert block.count('read_aircraft_database_bundle') >= 3
