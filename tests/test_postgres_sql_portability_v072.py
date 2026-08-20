from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def test_known_sqlite_only_constructs_are_guarded_or_outside_production_crud():
    source = (ROOT / "app.py").read_text(encoding="utf-8")
    assert "date('now')" not in source
    assert "date(valid_from)" not in source
    assert "HAVING normalized_points" not in source
    assert ".lastrowid" not in source
    assert "pd.read_sql_query(" not in source

    # Remaining SQLite syntax belongs to explicit SQLite-only init/maintenance/
    # world-airport paths; PostgreSQL runtime never calls those branches.
    assert "if is_postgres_connection(con) or not AIRPORTS_DB_PATH.exists():" in source
    assert "if is_postgres_connection(con):\n            try:\n                con.execute(\"ANALYZE\")" in source
    assert "if not is_postgres_connection(con):\n            ensure_schema_compatibility(con)" in source


def test_track_sampling_query_uses_portable_case_not_sqlite_scalar_max():
    source = (ROOT / "app.py").read_text(encoding="utf-8")
    start = source.index("def read_sampled_track_points")
    end = source.index("def _points_dataframe_to_json", start)
    block = source[start:end]
    assert "CASE" in block
    assert "MAX(1," not in block
    assert "%" in block


def test_health_queries_are_tenant_aware_after_cutover():
    source = (ROOT / "app.py").read_text(encoding="utf-8")
    assert "GROUP BY user_id, date" in source
    assert "a.user_id = f.user_id" in source
    assert "GROUP BY t.id, f.date, f.registration" in source


def test_auth_generated_user_id_is_backend_neutral():
    source = (ROOT / "logbook_core" / "auth.py").read_text(encoding="utf-8")
    assert "insert_and_get_id(" in source
    assert ".lastrowid" not in source
    assert "DATABASE_INTEGRITY_ERRORS" in source
