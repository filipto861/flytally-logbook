from logbook_core.database_foundation import (
    ACTIVE_RUNTIME_BACKEND,
    POSTGRES_FOUNDATION_VERSION,
    postgres_cutover_enabled,
    postgres_target_config,
    redact_postgres_dsn,
)
from logbook_core.config import APP_VERSION, DB_SCHEMA_VERSION, DATABASE_RUNTIME


def test_version_and_runtime_cutover_lock():
    assert APP_VERSION == "v0.70"
    assert DB_SCHEMA_VERSION == 10
    assert DATABASE_RUNTIME == "sqlite"
    assert ACTIVE_RUNTIME_BACKEND == "sqlite"
    assert POSTGRES_FOUNDATION_VERSION == 1
    assert postgres_cutover_enabled() is False


def test_config_prefers_explicit_streamlit_secret():
    config = postgres_target_config(
        secrets_database={
            "postgres_dsn": "postgresql://u:p@db.example/logbook",
            "postgres_pool_min": 1,
            "postgres_pool_max": 6,
            "postgres_connect_timeout": 7,
        },
        environ={"LOGBOOK_POSTGRES_DSN": "postgresql://wrong/other"},
    )
    assert config.configured
    assert config.dsn == "postgresql://u:p@db.example/logbook"
    assert config.min_pool_size == 1
    assert config.max_pool_size == 6
    assert config.connect_timeout_s == 7


def test_dsn_redaction_never_exposes_password():
    safe = redact_postgres_dsn(
        "postgresql://pilot:super-secret@db.example:5432/logbook?sslmode=require"
    )
    assert "super-secret" not in safe
    assert "pilot:***@" in safe
    assert "sslmode=require" in safe

    keyword = redact_postgres_dsn(
        "host=db.example dbname=logbook user=pilot password='secret value' sslmode=require"
    )
    assert "secret value" not in keyword
    assert "password=***" in keyword
