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
    raise AssertionError(name)


def test_release_identity():
    assert APP_VERSION == "v0.73.3.2"
    assert DB_SCHEMA_VERSION == 11


def test_map_hot_path_is_one_database_query():
    source = _source()
    block = _function(source, "read_track_map_records_for_flights")
    assert block.count("db_read_sql_query(") == 1
    assert "read_track_metadata_for_flights(" not in block
    assert "read_track_geometry_payloads(" not in block
    assert "overview_coordinates_json AS coordinates_json" in block


def test_map_page_does_not_eagerly_load_full_metadata_table():
    source = _source()
    block = _function(source, "page_maps")
    assert "load_table = st.toggle(" in block
    assert "if load_table:" in block
    table_pos = block.index("read_track_metadata_for_flights(")
    guard_pos = block.index("if load_table:")
    assert guard_pos < table_pos


def test_geometry_reader_has_no_lazy_write_backfill():
    source = _source()
    block = _function(source, "read_track_geometry_payloads")
    assert "UPDATE flight_tracks" not in block
    assert "coordinates_json" not in block.replace("overview_coordinates_json", "")
    assert "with connect() as con:" not in block


def test_runtime_schema_owns_one_time_server_side_backfill():
    source = (ROOT / "logbook_core" / "runtime_schema.py").read_text(encoding="utf-8")
    assert "track_overview_backfill_version" in source
    assert "ROW_NUMBER() OVER" in source
    assert "UPDATE flight_tracks t" in source
    assert "jsonb_agg" in source
