from pathlib import Path

from logbook_core.config import APP_VERSION, DB_SCHEMA_VERSION

ROOT = Path(__file__).resolve().parents[1]


def test_version_without_schema_migration():
    assert APP_VERSION == "v0.73.3.2"
    assert DB_SCHEMA_VERSION == 11


def test_export_has_account_backup_section():
    source = (ROOT / "app.py").read_text(encoding="utf-8")
    assert '["Soubory", "Tisk", "Náhled dat", "Záloha účtu"]' in source
    assert "def render_portable_backup()" in source
    assert "Připravit přenosnou zálohu" in source
    assert "OBNOVIT MOJE DATA" in source


def test_restore_is_current_user_scoped_and_has_safety_snapshot():
    source = (ROOT / "app.py").read_text(encoding="utf-8")
    assert "restore_user_backup(con, uid" in source
    assert "portable_pre_restore_backup_v064" in source
    assert "auto_backup_after_change(\"restore_portable_backup\")" in source


def test_admin_sqlite_backup_is_not_duplicated_in_export_files():
    source = (ROOT / "app.py").read_text(encoding="utf-8")
    export = source[source.index("def page_export"):source.index("def read_admin_user_overview")]
    files_branch = export[export.index('if section == "Soubory":'):export.index('elif section == "Tisk":')]
    assert "SQLite databáze" not in files_branch


def test_portability_core_excludes_security_tables():
    source = (ROOT / "logbook_core" / "portability.py").read_text(encoding="utf-8")
    assert '"user_credentials"' not in source.split("PORTABLE_TABLES =", 1)[1].split(")", 1)[0]
    assert '"audit_log"' not in source.split("PORTABLE_TABLES =", 1)[1].split(")", 1)[0]
    assert "restore_overwrites_account_identity" in source
