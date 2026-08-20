from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def test_migration_marks_target_as_shadow():
    source = (ROOT / "logbook_core" / "postgres_migration.py").read_text(encoding="utf-8")
    for key in (
        "shadow_mode",
        "shadow_migrated_at",
        "shadow_source_schema_version",
        "shadow_protocol_version",
    ):
        assert key in source


def test_shadow_verifier_uses_consistent_sqlite_snapshot():
    source = (ROOT / "logbook_core" / "shadow_verification.py").read_text(encoding="utf-8")
    assert "snapshot_sqlite_bytes(sqlite_path)" in source
    assert "PRAGMA query_only = ON" in source


def test_shadow_verifier_hashes_all_tables_in_deterministic_order():
    source = (ROOT / "logbook_core" / "shadow_verification.py").read_text(encoding="utf-8")
    assert "_sqlite_table_fingerprint" in source
    assert "_postgres_table_fingerprint" in source
    assert "hashlib.sha256()" in source
    assert "ORDER BY" in source


def test_v071_adds_no_target_reset_or_destructive_resync():
    app = (ROOT / "app.py").read_text(encoding="utf-8").upper()
    shadow = (ROOT / "logbook_core" / "shadow_verification.py").read_text(encoding="utf-8").upper()
    assert "TRUNCATE " not in shadow
    assert "DELETE FROM" not in shadow
    assert "RESET SHADOW" not in app
