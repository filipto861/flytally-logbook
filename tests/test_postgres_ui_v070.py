from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def test_admin_has_postgres_production_cutover_section():
    source = (ROOT / "app.py").read_text(encoding="utf-8")
    assert '"PostgreSQL"' in source
    assert "def render_postgres_foundation_admin()" in source
    assert '"Otestovat PostgreSQL spojení"' in source
    assert 'CUTOVER READY' in source


def test_ui_makes_runtime_backend_and_manual_fallback_explicit():
    source = (ROOT / "app.py").read_text(encoding="utf-8")
    assert '"Production",' in source
    assert '"PostgreSQL" if is_pg_prod else "SQLite"' in source
    assert '"Fallback", "RUČNÍ"' in source
    assert 'SQLITE_EMERGENCY_FALLBACK' in source


def test_v072_admin_shadow_and_cutover_are_explicit():
    source = (ROOT / "app.py").read_text(encoding="utf-8")
    assert "migrate_sqlite_to_postgres(" in source
    assert 'confirm_shadow != "VYTVOŘIT SHADOW"' in source
    assert "acknowledge_credentials" in source
    assert 'confirm_ready == "PŘIPRAVIT CUTOVER"' in source
    assert "mark_postgres_cutover_ready" in source


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
