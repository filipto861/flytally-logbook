from __future__ import annotations

import os
from pathlib import Path
import sqlite3
import tempfile
from typing import Iterable, Any

DEFAULT_SQLITE_TIMEOUT = 10.0
DEFAULT_BUSY_TIMEOUT_MS = 10_000
MAX_ADMIN_RESTORE_BYTES = 512 * 1024 * 1024


class SQLiteRestoreError(ValueError):
    pass


def _temp_path(parent: Path, prefix: str) -> Path:
    parent.mkdir(parents=True, exist_ok=True)
    handle = tempfile.NamedTemporaryFile(
        prefix=prefix,
        suffix='.sqlite',
        dir=parent,
        delete=False,
    )
    path = Path(handle.name)
    handle.close()
    return path


def _connect(path: Path, *, read_only: bool = False) -> sqlite3.Connection:
    if read_only:
        uri = f"file:{path.resolve().as_posix()}?mode=ro"
        con = sqlite3.connect(uri, uri=True, timeout=DEFAULT_SQLITE_TIMEOUT)
    else:
        con = sqlite3.connect(path, timeout=DEFAULT_SQLITE_TIMEOUT)
    con.execute(f"PRAGMA busy_timeout = {DEFAULT_BUSY_TIMEOUT_MS}")
    con.execute("PRAGMA foreign_keys = ON")
    return con


def snapshot_sqlite_bytes(db_path: str | Path) -> bytes:
    """Return a transactionally consistent standalone SQLite snapshot.

    sqlite3.Connection.backup() sees committed WAL content and creates a normal
    single-file database, so callers never need to copy a live WAL-mode file.
    """
    path = Path(db_path)
    if not path.exists():
        raise FileNotFoundError(path)
    temp = _temp_path(path.parent, '.logbook_snapshot_')
    source: sqlite3.Connection | None = None
    target: sqlite3.Connection | None = None
    try:
        source = _connect(path, read_only=False)
        source.execute('PRAGMA query_only = ON')
        target = _connect(temp, read_only=False)
        source.backup(target, pages=2048, sleep=0.01)
        target.commit()
        target.close(); target = None
        source.close(); source = None
        raw = temp.read_bytes()
        if not raw.startswith(b'SQLite format 3'):
            raise RuntimeError('Vytvořený snapshot není platná SQLite databáze.')
        return raw
    finally:
        if target is not None:
            target.close()
        if source is not None:
            source.close()
        try:
            temp.unlink(missing_ok=True)
        except Exception:
            pass


def inspect_sqlite_bytes(
    raw: bytes,
    *,
    required_tables: Iterable[str],
    max_schema_version: int | None = None,
    max_bytes: int = MAX_ADMIN_RESTORE_BYTES,
) -> dict[str, Any]:
    """Validate an uploaded SQLite database before it can replace the live DB."""
    if not isinstance(raw, (bytes, bytearray)) or not raw:
        raise SQLiteRestoreError('Nahraná databáze je prázdná.')
    raw = bytes(raw)
    if len(raw) > int(max_bytes):
        raise SQLiteRestoreError('Nahraná databáze je příliš velká.')
    if not raw.startswith(b'SQLite format 3'):
        raise SQLiteRestoreError('Nahraný soubor nevypadá jako SQLite databáze.')

    temp_root = Path(tempfile.gettempdir())
    temp = _temp_path(temp_root, '.logbook_restore_check_')
    try:
        temp.write_bytes(raw)
        try:
            con = _connect(temp, read_only=True)
        except sqlite3.DatabaseError as exc:
            raise SQLiteRestoreError(f'Databázi nelze otevřít: {exc}') from exc
        try:
            integrity_rows = con.execute('PRAGMA integrity_check').fetchall()
            integrity = [str(row[0]) for row in integrity_rows]
            if not integrity or any(value.lower() != 'ok' for value in integrity):
                raise SQLiteRestoreError('SQLite integrity_check není OK.')

            fk_rows = con.execute('PRAGMA foreign_key_check').fetchall()
            if fk_rows:
                raise SQLiteRestoreError(
                    f'Databáze obsahuje {len(fk_rows)} porušení foreign key vazeb.'
                )

            existing = {
                str(row[0])
                for row in con.execute(
                    "SELECT name FROM sqlite_master WHERE type='table'"
                ).fetchall()
            }
            required = {str(name) for name in required_tables}
            missing = sorted(required - existing)
            if missing:
                raise SQLiteRestoreError(
                    'Databázi chybí povinné tabulky: ' + ', '.join(missing)
                )

            schema_version = 0
            if 'app_meta' in existing:
                row = con.execute(
                    "SELECT value FROM app_meta WHERE key='schema_version'"
                ).fetchone()
                try:
                    schema_version = int(row[0]) if row and row[0] is not None else 0
                except (TypeError, ValueError):
                    schema_version = 0
            if max_schema_version is not None and schema_version > int(max_schema_version):
                raise SQLiteRestoreError(
                    f'Databáze používá novější schema {schema_version}; '
                    f'tato aplikace podporuje nejvýše {int(max_schema_version)}.'
                )
            return {
                'size_bytes': len(raw),
                'schema_version': schema_version,
                'tables': tuple(sorted(existing)),
                'integrity': 'ok',
                'foreign_key_violations': 0,
            }
        except sqlite3.DatabaseError as exc:
            raise SQLiteRestoreError(f'Kontrola SQLite selhala: {exc}') from exc
        finally:
            con.close()
    finally:
        try:
            temp.unlink(missing_ok=True)
        except Exception:
            pass


def remove_sqlite_sidecars(db_path: str | Path) -> None:
    path = Path(db_path)
    for suffix in ('-wal', '-shm'):
        try:
            Path(str(path) + suffix).unlink(missing_ok=True)
        except Exception:
            pass


def atomic_replace_sqlite(db_path: str | Path, raw: bytes) -> None:
    """Atomically replace a SQLite main file after the caller validates it."""
    path = Path(db_path)
    temp = _temp_path(path.parent, '.logbook_restore_')
    try:
        with temp.open('wb') as handle:
            handle.write(bytes(raw))
            handle.flush()
            os.fsync(handle.fileno())
        remove_sqlite_sidecars(path)
        os.replace(temp, path)
    finally:
        try:
            temp.unlink(missing_ok=True)
        except Exception:
            pass
