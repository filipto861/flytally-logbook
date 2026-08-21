from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def _admin_source() -> str:
    return (ROOT / "logbook_ui" / "postgres_admin.py").read_text(encoding="utf-8")


def test_admin_has_postgres_production_section():
    app = (ROOT / "app.py").read_text(encoding="utf-8")
    admin = _admin_source()
    assert '"PostgreSQL"' in app
    assert "render_postgres_admin_panel" in app
    assert '"Otestovat PostgreSQL spojení"' in admin
    assert "CUTOVER READY" in admin


def test_ui_makes_runtime_backend_and_manual_fallback_explicit():
    source = _admin_source()
    assert 'metric_card("Production"' in source
    assert '"PostgreSQL" if is_pg_prod else "SQLite"' in source
    assert 'metric_card("Fallback", "RUČNÍ"' in source
    assert "SQLITE_EMERGENCY_FALLBACK" in source


def test_legacy_shadow_and_cutover_controls_are_extracted_but_preserved():
    app = (ROOT / "app.py").read_text(encoding="utf-8")
    source = _admin_source()
    assert "migrate_sqlite_to_postgres(" in source
    assert 'confirm_shadow != "VYTVOŘIT SHADOW"' in source
    assert "acknowledge_credentials" in source
    assert 'confirm_ready == "PŘIPRAVIT CUTOVER"' in source
    assert "mark_postgres_cutover_ready" in source
    assert "migrate_sqlite_to_postgres(" not in app


def test_postgres_secret_example_documents_explicit_cutover():
    example = (ROOT / ".streamlit" / "secrets.toml.example").read_text(encoding="utf-8")
    assert "[database]" in example
    assert "postgres_dsn" in example
    assert "production_backend" in example
    assert "POSTGRESQL_PRODUCTION" in example
    assert "SQLITE_EMERGENCY_FALLBACK" in example


def test_requirements_include_psycopg_pool():
    req = (ROOT / "requirements.txt").read_text(encoding="utf-8")
    assert "psycopg[binary,pool]==" in req


def test_cli_requires_explicit_confirmation_and_has_dry_run():
    cli = (ROOT / "scripts" / "migrate_sqlite_to_postgres.py").read_text(encoding="utf-8")
    assert '"--dry-run"' in cli
    assert '"--confirm"' in cli
    assert 'args.confirm != "MIGRATE"' in cli
