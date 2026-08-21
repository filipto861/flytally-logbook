from logbook_core.postgres_schema import (
    POSTGRES_SCHEMA_STATEMENTS,
    POSTGRES_SCHEMA_VERSION,
    POSTGRES_TABLE_COLUMNS,
    POSTGRES_TABLE_ORDER,
    postgres_schema_sql,
)


def test_postgres_schema_contains_every_transaction_table():
    assert POSTGRES_SCHEMA_VERSION == 2
    assert set(POSTGRES_TABLE_ORDER) == set(POSTGRES_TABLE_COLUMNS)
    sql = postgres_schema_sql()
    for table in POSTGRES_TABLE_ORDER:
        assert f"CREATE TABLE IF NOT EXISTS {table}" in sql


def test_postgres_schema_preserves_multi_user_unique_constraints():
    sql = postgres_schema_sql()
    assert "UNIQUE(user_id, registration)" in sql
    assert "UNIQUE(user_id, registration, valid_from)" in sql
    assert "UNIQUE(user_id, ident)" in sql
    assert "UNIQUE(track_id, seq)" in sql
    assert "idx_users_email_ci" in sql


def test_postgres_schema_has_owner_guard_triggers():
    sql = postgres_schema_sql()
    assert "logbook_check_track_owner" in sql
    assert "flight_tracks.user_id must match flights.user_id" in sql
    assert "logbook_check_point_owner" in sql
    assert "track_points.user_id must match flight_tracks.user_id" in sql
