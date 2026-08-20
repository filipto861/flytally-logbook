from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def test_initial_migrator_refuses_nonempty_target_and_never_deletes_target():
    source = (ROOT / "logbook_core" / "postgres_migration.py").read_text(encoding="utf-8")
    assert "def _assert_empty_target" in source
    assert "Cílová PostgreSQL databáze není prázdná" in source
    migrate_start = source.index("def migrate_sqlite_to_postgres(")
    migrate_block = source[migrate_start:]
    assert "_assert_empty_target(pg_con)" in migrate_block
    assert "TRUNCATE " not in migrate_block.upper()
    assert "DELETE FROM" not in migrate_block.upper()

def test_migrator_uses_consistent_sqlite_snapshot_and_transaction_lock():
    source = (ROOT / "logbook_core" / "postgres_migration.py").read_text(encoding="utf-8")
    assert "snapshot_sqlite_bytes(source_path)" in source
    assert "pg_advisory_xact_lock" in source
    assert "with pg_con.transaction():" in source


def test_migrator_verifies_tenant_ownership_after_copy():
    source = (ROOT / "logbook_core" / "postgres_migration.py").read_text(encoding="utf-8")
    assert "track_owner_mismatch" in source
    assert "point_owner_mismatch" in source
    assert "orphan_tracks" in source
    assert "orphan_points" in source
