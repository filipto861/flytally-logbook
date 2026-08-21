from pathlib import Path
import ast

ROOT = Path(__file__).resolve().parents[1]


def _app() -> str:
    return (ROOT / "app.py").read_text(encoding="utf-8")


def _function_block(source: str, name: str) -> str:
    tree = ast.parse(source)
    for node in tree.body:
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)) and node.name == name:
            return ast.get_source_segment(source, node) or ""
    raise AssertionError(f"Function not found: {name}")


def test_critical_postgres_read_helpers_do_not_mask_database_errors_as_empty_data():
    source = _app()
    for name in (
        "read_user_profile",
        "read_app_meta",
        "read_logbook_counts",
        "read_aircraft_usage_summary",
    ):
        block = _function_block(source, name)
        assert "except DATABASE_ERRORS" in block
        assert "production_is_postgresql()" in block
        assert "raise" in block


def test_custom_airport_postgres_failures_are_not_silently_dropped():
    source = _app()
    for name in (
        "read_airports",
        "read_airport_registry_count",
        "airport_coords_for_idents",
        "airport_search_index",
    ):
        block = _function_block(source, name)
        assert "except DATABASE_ERRORS:" in block
        assert "production_is_postgresql()" in block
        assert "raise" in block


def test_database_health_queries_fail_visibly_on_postgres_database_errors():
    source = _app()
    block = _function_block(source, "_safe_df_query")
    assert "except DATABASE_ERRORS:" in block
    assert "is_postgres_connection(con)" in block
    assert "raise" in block


def test_track_json_health_scan_does_not_hide_postgres_database_outage():
    source = _app()
    block = _function_block(source, "build_database_health_report")
    assert "except DATABASE_ERRORS:" in block
    assert "is_postgres_connection(con)" in block
    assert "raise" in block


def test_postgres_profile_read_failure_does_not_log_user_out():
    source = _app()
    block = _function_block(source, "render_auth_gate")
    assert "except DATABASE_ERRORS:" in block
    db_branch = block[block.index("except DATABASE_ERRORS:"):block.index("except Exception:", block.index("except DATABASE_ERRORS:"))]
    assert "_render_database_runtime_error" in db_branch
    assert "logout_user()" not in db_branch


def test_main_has_database_error_boundary_around_active_page():
    source = _app()
    block = _function_block(source, "main")
    assert 'except DATABASE_ERRORS:' in block
    assert '_render_database_runtime_error(f"Stránku „{page}“ se nepodařilo načíst.")' in block


def test_track_map_geometry_reader_does_not_hide_postgres_outage():
    source = _app()
    block = _function_block(source, "read_track_geometry_payloads")
    assert "with read_connect() as con:" in block
    assert "con.execute(" in block
    assert "except DATABASE_ERRORS" not in block
    assert "except Exception" not in block
