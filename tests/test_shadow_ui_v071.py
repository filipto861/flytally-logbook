from pathlib import Path

from logbook_core.config import APP_VERSION, DB_SCHEMA_VERSION, POSTGRES_SHADOW_VERSION

ROOT = Path(__file__).resolve().parents[1]


def _admin():
    return (ROOT / "logbook_ui" / "postgres_admin.py").read_text(encoding="utf-8")


def test_version_no_sqlite_schema_migration():
    assert APP_VERSION == "v0.73.1"
    assert DB_SCHEMA_VERSION == 10
    assert POSTGRES_SHADOW_VERSION == 1


def test_admin_can_create_shadow_only_after_strong_confirmation():
    source = _admin()
    assert '"VYTVOŘIT SHADOW"' in source
    assert "acknowledge_credentials" in source
    assert '"Spustit první shadow migraci"' in source
    assert "migrate_sqlite_to_postgres(" in source


def test_admin_has_quick_and_deep_shadow_verification():
    source = _admin()
    assert '"Rychlá kontrola"' in source
    assert '"Hluboká kontrola SHA-256"' in source
    assert "verify_postgres_shadow(" in source
    assert "deep=False" in source
    assert "deep=True" in source


def test_shadow_status_distinguishes_stale_from_mismatch():
    source = _admin()
    assert "SHADOW MATCH" in source
    assert "SHADOW STALE" in source
    assert "SHADOW MISMATCH" in source


def test_runtime_cutover_requires_explicit_confirmation():
    foundation = (ROOT / "logbook_core" / "database_foundation.py").read_text(encoding="utf-8")
    assert "def postgres_cutover_enabled(" in foundation
    assert 'backend == "postgresql"' in foundation
    assert 'confirm == "POSTGRESQL_PRODUCTION"' in foundation
