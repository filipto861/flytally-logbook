from pathlib import Path
import io
import sqlite3

import pytest

from logbook_core.config import APP_VERSION, DB_SCHEMA_VERSION
from logbook_core.schema import SCHEMA
from logbook_core.sqlite_runtime import (
    SQLiteRestoreError,
    inspect_sqlite_bytes,
    snapshot_sqlite_bytes,
)
from logbook_core.tenancy import ensure_tenancy_schema

ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / "app.py"


def _app() -> str:
    return APP.read_text(encoding="utf-8")


def test_v069_schema_and_version():
    assert APP_VERSION == "v0.73.3.1"
    assert DB_SCHEMA_VERSION == 11


def test_duplicate_cache_wrappers_are_gone():
    text = _app()
    assert '@st.cache_data(show_spinner=False, ttl=300)\n\n\n@st.cache_data(show_spinner=False, ttl=300)\ndef read_flights' not in text
    assert text.count('def read_flights(user_id: int)') == 1
    assert text.count('def read_track_metadata_for_flights(') == 1


def test_connection_initialization_is_thread_guarded_and_busy_timeout_extended():
    text = _app()
    perf = (ROOT / 'logbook_core' / 'performance.py').read_text(encoding='utf-8')
    assert '_DB_INIT_LOCK = threading.RLock()' in text
    assert 'with _DB_INIT_LOCK:' in text
    assert 'sqlite3.connect(DB_PATH, timeout=10.0)' in text
    assert 'PRAGMA busy_timeout = 10000' in perf


def test_logout_and_login_reset_full_session_state():
    text = _app()
    assert 'def _reset_session_state' in text
    assert 'st.session_state.clear()' in text
    assert 'def logout_user()' in text
    logout = text[text.index('def logout_user()'):text.index('def actor_name()', text.index('def logout_user()'))]
    assert '_reset_session_state()' in logout
    setter = text[text.index('def _set_authenticated_user'):text.index('def logout_user')]
    assert '_reset_session_state()' in setter


def test_login_has_session_throttle():
    text = _app()
    assert 'def _login_rate_limit_remaining' in text
    assert 'def _register_login_failure' in text
    assert 'Příliš mnoho neúspěšných pokusů' in text


def test_github_backup_uses_consistent_snapshot_and_process_lock():
    text = _app()
    assert '_GITHUB_BACKUP_LOCK = threading.Lock()' in text
    assert 'with _GITHUB_BACKUP_LOCK:' in text
    assert 'snapshot_bytes = database_snapshot_bytes()' in text
    unlocked = text[text.index('def _backup_database_to_github_unlocked'):text.index('def backup_database_to_github')]
    assert 'DB_PATH.read_bytes()' not in unlocked


def test_full_restore_validates_and_forces_reauthentication():
    text = _app()
    assert 'inspect_sqlite_bytes(' in text
    assert 'atomic_replace_sqlite(DB_PATH, raw)' in text
    assert 'max_schema_version=DB_SCHEMA_VERSION' in text
    assert 'Z bezpečnostních důvodů se přihlas znovu' in text


def test_admin_download_does_not_read_live_wal_database_directly():
    text = _app()
    admin = text[text.index('elif section == "Záloha":', text.index('def page_admin')):]
    assert 'Připravit SQLite snapshot' in admin
    assert 'database_snapshot_bytes()' in admin
    assert 'with open(DB_PATH, "rb")' not in admin


def test_unreachable_database_legacy_tabs_removed():
    text = _app()
    database = text[text.index('def page_database'):text.index('# Stability / database control tools')]
    assert 'elif section == "Kontrola"' not in database
    assert 'elif section == "Záloha"' not in database
    assert 'elif section == "Meta"' not in database


def test_safe_database_service_does_not_modify_flight_semantics():
    text = _app()
    block = text[text.index('def run_safe_database_service'):text.index('def run_backend_service')]
    assert 'UPDATE flights SET registration' not in block
    assert 'UPDATE flights SET departure' not in block
    assert 'UPDATE flights SET starts' not in block
    assert 'UPDATE aircraft SET registration' not in block
    assert 'UPDATE rates SET registration' not in block
    assert 'DELETE FROM track_points' in block
    assert 'Synchronizace point_count' in block


def test_health_json_scan_is_bounded():
    text = _app()
    assert 'SELECT id, flight_id, file_name, coordinates_json FROM flight_tracks ORDER BY id DESC LIMIT 500' in text


def test_old_dead_helpers_removed():
    text = _app()
    for name in (
        'app_link', 'base_app_url', '_local_time_label', 'downsample_points',
        'airport_coord_lookup', '_clean_form_value', 'make_control_df', 'read_audit_log',
    ):
        assert f'def {name}(' not in text
    assert not (ROOT / 'sitecustomize.py').exists()


def test_map_html_escapes_route_cells():
    text = _app()
    assert '_safe_text(_range_text(row.get("departure"), row.get("arrival")))' in text
    assert 'return html.escape(_clean_text(value), quote=True)' in text


def _make_db(path: Path) -> None:
    con = sqlite3.connect(path)
    con.row_factory = sqlite3.Row
    con.executescript(SCHEMA)
    ensure_tenancy_schema(con)
    con.execute("INSERT OR IGNORE INTO users (id,display_name,slug,role,active) VALUES (1,'One','one','admin',1)")
    con.execute("INSERT OR IGNORE INTO user_settings (user_id) VALUES (1)")
    con.execute("INSERT INTO flights (id,user_id,date,registration) VALUES (101,1,'2026-08-20','OK-AAA')")
    con.commit()
    con.close()


def test_sqlite_snapshot_contains_committed_data(tmp_path: Path):
    path = tmp_path / 'live.sqlite'
    _make_db(path)
    raw = snapshot_sqlite_bytes(path)
    snap = tmp_path / 'snap.sqlite'
    snap.write_bytes(raw)
    con = sqlite3.connect(snap)
    try:
        assert con.execute('SELECT registration FROM flights WHERE id=101').fetchone()[0] == 'OK-AAA'
        assert con.execute('PRAGMA integrity_check').fetchone()[0].lower() == 'ok'
    finally:
        con.close()


def test_restore_validation_rejects_non_sqlite():
    with pytest.raises(SQLiteRestoreError):
        inspect_sqlite_bytes(b'not sqlite', required_tables={'flights'}, max_schema_version=10)


def test_restore_validation_rejects_missing_tables(tmp_path: Path):
    path = tmp_path / 'tiny.sqlite'
    con = sqlite3.connect(path)
    con.execute('CREATE TABLE x (id INTEGER)')
    con.commit(); con.close()
    with pytest.raises(SQLiteRestoreError):
        inspect_sqlite_bytes(path.read_bytes(), required_tables={'flights'}, max_schema_version=10)


def test_cross_tenant_track_insert_is_rejected(tmp_path: Path):
    path = tmp_path / 'tenant.sqlite'
    con = sqlite3.connect(path)
    con.row_factory = sqlite3.Row
    con.executescript(SCHEMA)
    ensure_tenancy_schema(con)
    con.execute("INSERT OR IGNORE INTO users (id,display_name,slug,role,active) VALUES (1,'One','one','admin',1)")
    con.execute("INSERT OR IGNORE INTO users (id,display_name,slug,role,active) VALUES (2,'Two','two','user',1)")
    con.execute("INSERT INTO flights (id,user_id,date) VALUES (1,1,'2026-08-20')")
    with pytest.raises(sqlite3.IntegrityError):
        con.execute("INSERT INTO flight_tracks (user_id,flight_id,coordinates_json) VALUES (2,1,'[]')")
    con.close()


def test_cross_tenant_point_insert_is_rejected(tmp_path: Path):
    path = tmp_path / 'tenant_points.sqlite'
    con = sqlite3.connect(path)
    con.row_factory = sqlite3.Row
    con.executescript(SCHEMA)
    ensure_tenancy_schema(con)
    con.execute("INSERT OR IGNORE INTO users (id,display_name,slug,role,active) VALUES (1,'One','one','admin',1)")
    con.execute("INSERT OR IGNORE INTO users (id,display_name,slug,role,active) VALUES (2,'Two','two','user',1)")
    con.execute("INSERT INTO flights (id,user_id,date) VALUES (1,1,'2026-08-20')")
    con.execute("INSERT INTO flight_tracks (id,user_id,flight_id,coordinates_json) VALUES (11,1,1,'[]')")
    with pytest.raises(sqlite3.IntegrityError):
        con.execute("INSERT INTO track_points (user_id,track_id,seq,latitude_deg,longitude_deg) VALUES (2,11,0,50,14)")
    con.close()


def test_profile_database_error_fails_closed():
    text = _app()
    assert '"active": 0, "_load_error": True' in text


def test_data_mutation_invalidates_prepared_backups_and_quality_scan():
    text = _app()
    block = text[text.index('def invalidate_cached_data'):text.index('def require_admin')]
    assert 'portable_backup_bytes_v064' in block
    assert 'admin_sqlite_snapshot_v069' in block
    assert 'data_quality_scan_v068_u' in block
    assert '"app_meta", "meta"' not in block.split('data_scopes =', 1)[1].split('}', 1)[0]


def test_restore_requires_clean_truncate_checkpoint():
    text = _app()
    assert 'checkpoint_database(truncate=True, require_clean=True)' in text
    assert 'Databáze je právě používána jinou operací' in text


def test_excel_import_script_is_tenant_scoped():
    text = (ROOT / 'scripts' / 'import_excel.py').read_text(encoding='utf-8')
    assert 'user_id: int = 1' in text
    assert 'DELETE FROM flights WHERE user_id = ?' in text
    assert 'DELETE FROM flight_tracks WHERE user_id = ?' in text
    assert 'DELETE FROM rates WHERE user_id = ?' in text
    assert 'DELETE FROM flights")' not in text
    assert '--user-id' in text



def test_portable_backup_signature_tracks_latest_user_audit():
    text = _app()
    assert 'SELECT COALESCE(MAX(id), 0) FROM audit_log WHERE user_id = ?' in text
    assert 'counts.get("audit_id", 0)' in text


def test_admin_snapshot_detects_cross_session_database_change():
    text = _app()
    assert 'def read_app_meta()' in text
    assert 'admin_sqlite_snapshot_change_v072' in text
    assert 'Databáze se od přípravy snapshotu změnila' in text


def test_owner_triggers_are_created_on_already_migrated_database(tmp_path: Path):
    path = tmp_path / 'existing.sqlite'
    con = sqlite3.connect(path)
    con.row_factory = sqlite3.Row
    con.executescript(SCHEMA)
    con.execute("INSERT OR REPLACE INTO app_meta (key,value,updated_at) VALUES ('tenancy_v1','1',CURRENT_TIMESTAMP)")
    ensure_tenancy_schema(con)
    triggers = {row[0] for row in con.execute("SELECT name FROM sqlite_master WHERE type='trigger'").fetchall()}
    assert 'trg_flight_tracks_owner_insert' in triggers
    assert 'trg_track_points_owner_insert' in triggers
    con.close()
