from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def test_admin_has_postgres_foundation_section():
    source = (ROOT / "app.py").read_text(encoding="utf-8")
    assert '"PostgreSQL"' in source
    assert "def render_postgres_foundation_admin()" in source
    assert '"Otestovat spojení"' in source
    assert '"Rychlé počty tabulek"' in source


def test_ui_explicitly_keeps_runtime_sqlite_and_cutover_locked():
    source = (ROOT / "app.py").read_text(encoding="utf-8")
    assert 'metric_card("Production", "SQLite"' in source
    assert 'metric_card("Cutover", "ZAMKNUT"' in source
    assert "postgres_cutover_enabled" in source


def test_v071_admin_shadow_migration_is_explicit_and_cutover_remains_locked():
    source = (ROOT / "app.py").read_text(encoding="utf-8")
    assert "migrate_sqlite_to_postgres(" in source
    assert 'confirm_shadow != "VYTVOŘIT SHADOW"' in source
    assert "acknowledge_credentials" in source
    assert "postgres_cutover_enabled" in source


def test_postgres_secret_example_is_non_destructive_target_only():
    example = (ROOT / ".streamlit" / "secrets.toml.example").read_text(encoding="utf-8")
    assert "[database]" in example
    assert "postgres_dsn" in example
    assert "This does NOT switch the app runtime" in example


def test_requirements_include_psycopg_pool():
    req = (ROOT / "requirements.txt").read_text(encoding="utf-8")
    assert "psycopg[binary,pool]==" in req


def test_cli_requires_explicit_confirmation_and_has_dry_run():
    cli = (ROOT / "scripts" / "migrate_sqlite_to_postgres.py").read_text(encoding="utf-8")
    assert '"--dry-run"' in cli
    assert '"--confirm"' in cli
    assert 'args.confirm != "MIGRATE"' in cli
