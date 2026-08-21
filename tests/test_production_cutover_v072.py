from pathlib import Path
from types import SimpleNamespace

import pytest

from logbook_core.config import APP_VERSION, DB_SCHEMA_VERSION, DATABASE_RUNTIME, POSTGRES_CUTOVER_VERSION
from logbook_core.database_foundation import postgres_cutover_enabled
from logbook_core.db_runtime import (
    DatabaseBackendConfigurationError,
    POSTGRES_CUTOVER_CONFIRM,
    SQLITE_FALLBACK_CONFIRM,
    CompatRow,
    _translate_qmark_placeholders,
    resolve_runtime_database_config,
)
from logbook_core.production_cutover import ProductionCutoverError, mark_postgres_cutover_ready

ROOT = Path(__file__).resolve().parents[1]


def test_v072_version_without_sqlite_schema_change():
    assert APP_VERSION == "v0.73.3.2"
    assert DB_SCHEMA_VERSION == 11
    assert DATABASE_RUNTIME == "configurable"
    assert POSTGRES_CUTOVER_VERSION == 1


def test_default_runtime_remains_sqlite():
    cfg = resolve_runtime_database_config(secrets_database={}, environ={})
    assert cfg.backend == "sqlite"
    assert not cfg.is_postgresql


def test_postgres_runtime_requires_dsn_and_exact_confirmation():
    with pytest.raises(DatabaseBackendConfigurationError):
        resolve_runtime_database_config(
            secrets_database={"production_backend": "postgresql"}, environ={}
        )
    with pytest.raises(DatabaseBackendConfigurationError):
        resolve_runtime_database_config(
            secrets_database={
                "production_backend": "postgresql",
                "postgres_dsn": "postgresql://u:p@host/db",
                "cutover_confirm": "wrong",
            },
            environ={},
        )
    cfg = resolve_runtime_database_config(
        secrets_database={
            "production_backend": "postgresql",
            "postgres_dsn": "postgresql://u:p@host/db",
            "cutover_confirm": POSTGRES_CUTOVER_CONFIRM,
        },
        environ={},
    )
    assert cfg.is_postgresql
    assert cfg.cutover_confirmed


def test_sqlite_after_cutover_token_requires_explicit_emergency_fallback():
    base = {
        "production_backend": "sqlite",
        "postgres_dsn": "postgresql://u:p@host/db",
        "cutover_confirm": POSTGRES_CUTOVER_CONFIRM,
    }
    with pytest.raises(DatabaseBackendConfigurationError):
        resolve_runtime_database_config(secrets_database=base, environ={})

    cfg = resolve_runtime_database_config(
        secrets_database={**base, "fallback_confirm": SQLITE_FALLBACK_CONFIRM},
        environ={},
    )
    assert cfg.is_sqlite
    assert cfg.sqlite_fallback_confirmed


def test_database_foundation_cutover_helper_is_fail_closed():
    assert not postgres_cutover_enabled(secrets_database={}, environ={})
    assert not postgres_cutover_enabled(
        secrets_database={
            "production_backend": "postgresql",
            "cutover_confirm": "POSTGRESQL_PRODUCTIO",
        },
        environ={},
    )
    assert postgres_cutover_enabled(
        secrets_database={
            "production_backend": "postgresql",
            "cutover_confirm": POSTGRES_CUTOVER_CONFIRM,
        },
        environ={},
    )


def test_qmark_translation_preserves_literals_and_escapes_modulo():
    sql = "SELECT ? AS x, '?' AS literal, (rn - 1) % ? AS mod, \"?\" AS ident"
    translated = _translate_qmark_placeholders(sql)
    assert translated == "SELECT %s AS x, '?' AS literal, (rn - 1) %% %s AS mod, \"?\" AS ident"


def test_compat_row_supports_name_and_sqlite_integer_index():
    row = CompatRow({"id": 7, "name": "Pilot"})
    assert row[0] == 7
    assert row[1] == "Pilot"
    assert row["name"] == "Pilot"
    assert dict(row) == {"id": 7, "name": "Pilot"}


def test_cutover_readiness_requires_deep_current_match_before_any_postgres_write(monkeypatch):
    report = SimpleNamespace(
        ok=True,
        status="match",
        deep_match=False,
        source_watermark="2026-08-20T18:00:00+00:00",
        target_watermark="2026-08-20T18:00:00+00:00",
    )
    config = SimpleNamespace(configured=True)
    with pytest.raises(ProductionCutoverError):
        mark_postgres_cutover_ready(config, report)


def test_app_has_no_automatic_postgres_to_sqlite_fallback():
    source = (ROOT / "app.py").read_text(encoding="utf-8")
    connect_block = source[source.index("def connect() -> Any:"):source.index("def _seed_airports_from_overrides", source.index("def connect() -> Any:"))]
    assert "config.is_postgresql" in connect_block
    assert "return _connect_postgres_runtime(config, read_only=False)" in connect_block
    assert "return _connect_sqlite_runtime()" in connect_block
    assert "except" not in connect_block
    assert "fallback" in connect_block.lower()


def test_postgres_first_activation_checks_cutover_gate():
    source = (ROOT / "app.py").read_text(encoding="utf-8")
    block = source[source.index("def _connect_postgres_runtime"):source.index("def connect() -> Any:")]
    assert "activate_postgres_production(config.postgres, sqlite_path=DB_PATH)" in block
    cutover = (ROOT / "logbook_core" / "production_cutover.py").read_text(encoding="utf-8")
    assert "pg_advisory_xact_lock" in cutover
    assert "source_watermark != ready_watermark" in cutover
    assert '"production_mode", "1"' in cutover


def test_runtime_crud_uses_backend_neutral_id_and_dataframe_helpers():
    source = (ROOT / "app.py").read_text(encoding="utf-8")
    assert ".lastrowid" not in source
    assert "pd.read_sql_query(" not in source
    assert source.count("insert_and_get_id(") >= 3
    assert source.count("db_read_sql_query(") >= 10


def test_postgresql_production_disables_sqlite_github_backup_and_restore():
    source = (ROOT / "app.py").read_text(encoding="utf-8")
    backup_block = source[source.index("def github_auto_backup_enabled"):source.index("def initialize_database")]
    assert "if production_is_postgresql():" in backup_block
    assert "return False" in backup_block
    assert "GitHub SQLite backup je po PostgreSQL cutoveru" in backup_block
    assert "Plná SQLite obnova je během PostgreSQL produkce zablokovaná" in backup_block


def test_cutover_ui_documents_exact_activation_and_manual_fallback_tokens():
    source = (ROOT / "logbook_ui" / "postgres_admin.py").read_text(encoding="utf-8")
    app = (ROOT / "app.py").read_text(encoding="utf-8")
    assert 'confirm_ready == "PŘIPRAVIT CUTOVER"' in source
    assert 'cutover_confirm = "POSTGRESQL_PRODUCTION"' in source
    assert 'fallback_confirm = "SQLITE_EMERGENCY_FALLBACK"' in source
    assert "Automatický fallback" in app


def test_shadow_hash_excludes_v072_postgres_only_lifecycle_metadata():
    shadow = (ROOT / "logbook_core" / "shadow_verification.py").read_text(encoding="utf-8")
    for key in (
        "cutover_ready_at",
        "cutover_ready_watermark",
        "production_mode",
        "production_cutover_at",
        "production_backend",
    ):
        assert f'"{key}"' in shadow


def test_portable_restore_uses_backend_neutral_generated_ids():
    source = (ROOT / "logbook_core" / "portability.py").read_text(encoding="utf-8")
    assert "insert_and_get_id" in source
    assert ".lastrowid" not in source


def test_all_postgres_lifecycle_operations_share_one_advisory_lock():
    migration = (ROOT / "logbook_core" / "postgres_migration.py").read_text(encoding="utf-8")
    cutover = (ROOT / "logbook_core" / "production_cutover.py").read_text(encoding="utf-8")
    lock = "logbook-postgres-lifecycle"
    assert migration.count(lock) >= 2
    assert cutover.count(lock) >= 2


def test_rejoin_after_sqlite_fallback_has_divergence_guard():
    cutover = (ROOT / "logbook_core" / "production_cutover.py").read_text(encoding="utf-8")
    assert "source_watermark and source_watermark != frozen_watermark" in cutover
    assert "Automatický návrat na PostgreSQL je zablokovaný" in cutover
    app = (ROOT / "app.py").read_text(encoding="utf-8")
    assert "def emergency_sqlite_fallback_active()" in app
    assert "NOUZOVÝ SQLITE FALLBACK JE AKTIVNÍ" in app


def test_public_registration_marks_durable_source_change():
    app = (ROOT / "app.py").read_text(encoding="utf-8")
    start = app.index("def render_auth_gate")
    end = app.index("def render_user_sidebar", start)
    block = app[start:end]
    assert '"register_user"' in block
    assert '_set_meta(con, "last_change_at", _now_iso())' in block
    assert '_set_meta(con, "dirty", "1")' in block


def test_postgres_business_audit_is_transaction_strict():
    app = (ROOT / "app.py").read_text(encoding="utf-8")
    start = app.index("def record_audit(")
    end = app.index("def github_backup_configured", start)
    block = app[start:end]
    assert "if is_postgres_connection(con):" in block
    pg_start = block.index("if is_postgres_connection(con):")
    pg_end = block.index("\n    try:", pg_start)
    strict = block[pg_start:pg_end]
    assert "con.execute(" in strict
    assert '_set_meta(con, "last_change_at", _now_iso())' in strict
    assert "return" in strict
