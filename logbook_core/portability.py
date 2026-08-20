from __future__ import annotations

import csv
import io
import json
import re
import sqlite3
import zipfile
from datetime import datetime, timezone
from typing import Any

from .permissions import strict_user_id
from .db_runtime import insert_and_get_id

BACKUP_FORMAT = "logbook-user-backup"
BACKUP_FORMAT_VERSION = 1
MAX_BACKUP_BYTES = 250 * 1024 * 1024
MAX_UNCOMPRESSED_BYTES = 700 * 1024 * 1024
MAX_ARCHIVE_FILES = 20

PORTABLE_TABLES = (
    "user_expiries",
    "aircraft",
    "rates",
    "airports",
    "flights",
    "flight_tracks",
    "track_points",
)

# The account identity and credentials deliberately stay outside the restore
# payload. A backup can therefore be restored into another Logbook account
# without overwriting its e-mail, password, role or account id.
_PROFILE_EXPORT_COLUMNS = (
    "id",
    "email",
    "display_name",
    "slug",
    "created_at",
)
_SETTINGS_COLUMNS = (
    "timezone",
    "currency",
    "home_airport",
    "default_role",
    "preferences_json",
)

_RESTORE_COLUMNS = {
    "user_expiries": (
        "category", "label", "expiry_date", "warning_days", "note", "active",
        "created_at", "updated_at",
    ),
    "aircraft": (
        "registration", "aircraft_type", "icao_type", "aircraft_class", "evidence",
        "default_price_per_hour", "default_role", "billing_basis", "active", "note",
        "created_at", "updated_at",
    ),
    "rates": (
        "registration", "aircraft_type", "valid_from", "price_per_hour",
        "dry_price_per_hour", "source",
    ),
    "airports": (
        "ident", "name", "airport_type", "iso_country", "iso_region", "municipality",
        "latitude_deg", "longitude_deg", "elevation_ft", "gps_code", "iata_code",
        "local_code", "source", "active", "closed", "data_quality", "imported_at",
        "updated_at", "raw_json",
    ),
    "flights": (
        "date", "evidence", "registration", "aircraft_type", "aircraft_class",
        "departure", "arrival", "off_block", "takeoff", "landing", "on_block",
        "starts", "commander", "instructor", "role", "task", "price_per_hour",
        "billing_basis", "note",
    ),
    "flight_tracks": (
        "flight_id", "file_name", "imported_at", "point_count", "distance_km",
        "start_utc", "end_utc", "min_alt_m", "max_alt_m", "coordinates_json",
    ),
    "track_points": (
        "track_id", "seq", "time_utc", "latitude_deg", "longitude_deg",
        "altitude_m", "segment_km", "distance_km", "speed_kmh", "speed_kt", "source",
    ),
}


class BackupError(ValueError):
    pass


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _rows(con: sqlite3.Connection, sql: str, params: tuple[Any, ...]) -> list[dict[str, Any]]:
    cur = con.execute(sql, params)
    names = [str(item[0]) for item in cur.description or ()]
    return [dict(zip(names, row)) for row in cur.fetchall()]


def _safe_filename(value: object) -> str:
    text = re.sub(r"[^A-Za-z0-9_-]+", "_", str(value or "").strip()).strip("_")
    return text[:48] or "profile"


def backup_filename(profile: dict[str, Any] | None = None, now: datetime | None = None) -> str:
    profile = profile or {}
    now = now or datetime.now(timezone.utc)
    identity = profile.get("slug") or profile.get("display_name") or "profile"
    return f"logbook_backup_{_safe_filename(identity)}_{now.strftime('%Y%m%d_%H%M')}.zip"


def _profile_snapshot(con: sqlite3.Connection, user_id: int) -> dict[str, Any]:
    uid = strict_user_id(user_id)
    row = con.execute(
        """
        SELECT id, email, display_name, slug, created_at
        FROM users
        WHERE id = ?
        """,
        (uid,),
    ).fetchone()
    if not row:
        return {"id": uid}
    values = dict(zip(_PROFILE_EXPORT_COLUMNS, row))
    return values


def _settings_snapshot(con: sqlite3.Connection, user_id: int) -> dict[str, Any]:
    uid = strict_user_id(user_id)
    row = con.execute(
        """
        SELECT timezone, currency, home_airport, default_role, preferences_json
        FROM user_settings
        WHERE user_id = ?
        """,
        (uid,),
    ).fetchone()
    if not row:
        return {}
    return dict(zip(_SETTINGS_COLUMNS, row))


def collect_user_data(con: sqlite3.Connection, user_id: int) -> dict[str, Any]:
    """Collect only records owned by one user.

    Credentials, roles, other users, app metadata and the audit log are not part
    of the portable restore payload.
    """
    uid = strict_user_id(user_id)
    tables: dict[str, list[dict[str, Any]]] = {}
    for table in PORTABLE_TABLES:
        tables[table] = _rows(
            con,
            f"SELECT * FROM {table} WHERE user_id = ? ORDER BY id",
            (uid,),
        )
    return {
        "profile": _profile_snapshot(con, uid),
        "settings": _settings_snapshot(con, uid),
        "tables": tables,
    }


def _csv_bytes(records: list[dict[str, Any]]) -> bytes:
    if not records:
        return b""
    buffer = io.StringIO(newline="")
    fieldnames: list[str] = []
    seen: set[str] = set()
    for record in records:
        for key in record:
            if key not in seen:
                seen.add(key)
                fieldnames.append(key)
    writer = csv.DictWriter(buffer, fieldnames=fieldnames, extrasaction="ignore")
    writer.writeheader()
    writer.writerows(records)
    return buffer.getvalue().encode("utf-8-sig")


def build_user_backup(
    con: sqlite3.Connection,
    user_id: int,
    *,
    app_version: str,
    schema_version: int,
    created_at: str | None = None,
) -> bytes:
    uid = strict_user_id(user_id)
    payload = collect_user_data(con, uid)
    tables = payload["tables"]
    created_at = created_at or _utc_now()

    manifest = {
        "format": BACKUP_FORMAT,
        "format_version": BACKUP_FORMAT_VERSION,
        "created_at": created_at,
        "app_version": str(app_version),
        "schema_version": int(schema_version),
        "source_profile": payload["profile"],
        "counts": {table: len(tables.get(table, [])) for table in PORTABLE_TABLES},
        "security": {
            "contains_password": False,
            "contains_credentials": False,
            "contains_other_users": False,
            "restore_overwrites_account_identity": False,
        },
    }

    data_document = {
        "format": BACKUP_FORMAT,
        "format_version": BACKUP_FORMAT_VERSION,
        "settings": payload["settings"],
        "tables": tables,
    }

    readme = f"""Logbook portable user backup
Created: {created_at}
Application: {app_version}
Backup format: {BACKUP_FORMAT_VERSION}

This archive contains only portable data belonging to the source profile:
flights, aircraft, price history, custom airports, GPS tracks/points,
licence/medical validity records and user preferences.

It does NOT contain passwords, password hashes, authentication credentials,
application roles, other users, global airport catalogue or the application
audit log.

Restore is designed to replace only the currently signed-in user's portable
data. Account identity (e-mail/password/role) is preserved.
"""

    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=6) as zf:
        zf.writestr(
            "manifest.json",
            json.dumps(manifest, ensure_ascii=False, indent=2, default=str).encode("utf-8"),
        )
        zf.writestr(
            "data.json",
            json.dumps(data_document, ensure_ascii=False, separators=(",", ":"), default=str).encode("utf-8"),
        )
        zf.writestr("README.txt", readme.encode("utf-8"))
        # Human-readable copies. GPS points stay in data.json only to keep the
        # archive compact even for long tracking histories.
        for table in ("flights", "aircraft", "rates", "airports", "user_expiries"):
            csv_data = _csv_bytes(tables.get(table, []))
            if csv_data:
                zf.writestr(f"csv/{table}.csv", csv_data)

    return buffer.getvalue()


def _read_backup(raw: bytes) -> tuple[dict[str, Any], dict[str, Any]]:
    if not isinstance(raw, (bytes, bytearray)) or not raw:
        raise BackupError("Záloha je prázdná.")
    if len(raw) > MAX_BACKUP_BYTES:
        raise BackupError("Záloha je příliš velká.")

    try:
        with zipfile.ZipFile(io.BytesIO(bytes(raw)), "r") as zf:
            infos = zf.infolist()
            if len(infos) > MAX_ARCHIVE_FILES:
                raise BackupError("Archiv obsahuje příliš mnoho souborů.")
            if sum(int(info.file_size) for info in infos) > MAX_UNCOMPRESSED_BYTES:
                raise BackupError("Rozbalený obsah zálohy je příliš velký.")
            names = {info.filename for info in infos}
            if "manifest.json" not in names or "data.json" not in names:
                raise BackupError("Archiv není platná přenosná záloha Logbooku.")
            manifest = json.loads(zf.read("manifest.json").decode("utf-8"))
            data = json.loads(zf.read("data.json").decode("utf-8"))
    except BackupError:
        raise
    except (zipfile.BadZipFile, UnicodeDecodeError, json.JSONDecodeError, KeyError) as exc:
        raise BackupError("Soubor není platná přenosná záloha Logbooku.") from exc

    if not isinstance(manifest, dict) or not isinstance(data, dict):
        raise BackupError("Záloha má neplatnou strukturu.")
    if manifest.get("format") != BACKUP_FORMAT or data.get("format") != BACKUP_FORMAT:
        raise BackupError("Tento ZIP není přenosná záloha Logbooku.")
    try:
        version = int(manifest.get("format_version", 0))
        data_version = int(data.get("format_version", 0))
    except (TypeError, ValueError) as exc:
        raise BackupError("Záloha má neplatnou verzi formátu.") from exc
    if version != BACKUP_FORMAT_VERSION or data_version != BACKUP_FORMAT_VERSION:
        raise BackupError(
            f"Nepodporovaná verze zálohy ({version}). "
            f"Tato verze aplikace podporuje formát {BACKUP_FORMAT_VERSION}."
        )

    tables = data.get("tables")
    if not isinstance(tables, dict):
        raise BackupError("Záloha neobsahuje tabulková data.")
    unexpected = set(tables) - set(PORTABLE_TABLES)
    if unexpected:
        raise BackupError("Záloha obsahuje neočekávané datové tabulky.")
    for table in PORTABLE_TABLES:
        records = tables.get(table, [])
        if not isinstance(records, list) or any(not isinstance(row, dict) for row in records):
            raise BackupError(f"Tabulka {table} má neplatný formát.")

    settings = data.get("settings", {})
    if settings is not None and not isinstance(settings, dict):
        raise BackupError("Uživatelské nastavení má neplatný formát.")
    return manifest, data


def inspect_user_backup(raw: bytes) -> dict[str, Any]:
    manifest, data = _read_backup(raw)
    counts = {
        table: len(data.get("tables", {}).get(table, []))
        for table in PORTABLE_TABLES
    }
    return {
        "format": manifest.get("format"),
        "format_version": int(manifest.get("format_version", 0)),
        "created_at": manifest.get("created_at"),
        "app_version": manifest.get("app_version"),
        "schema_version": manifest.get("schema_version"),
        "source_profile": manifest.get("source_profile") or {},
        "counts": counts,
    }


def _insert_record(
    con: sqlite3.Connection,
    table: str,
    user_id: int,
    record: dict[str, Any],
    columns: tuple[str, ...],
) -> int:
    values = [record.get(col) for col in columns]
    sql = (
        f"INSERT INTO {table} (user_id, {', '.join(columns)}) "
        f"VALUES (?, {', '.join('?' for _ in columns)})"
    )
    return insert_and_get_id(con, sql, (strict_user_id(user_id), *values))


def _restore_settings(con: sqlite3.Connection, user_id: int, settings: dict[str, Any]) -> None:
    if not settings:
        return
    clean = {key: settings.get(key) for key in _SETTINGS_COLUMNS}
    con.execute(
        """
        INSERT INTO user_settings
            (user_id, timezone, currency, home_airport, default_role, preferences_json, created_at, updated_at)
        VALUES
            (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT(user_id) DO UPDATE SET
            timezone = excluded.timezone,
            currency = excluded.currency,
            home_airport = excluded.home_airport,
            default_role = excluded.default_role,
            preferences_json = excluded.preferences_json,
            updated_at = CURRENT_TIMESTAMP
        """,
        (
            strict_user_id(user_id),
            clean.get("timezone"),
            clean.get("currency"),
            clean.get("home_airport"),
            clean.get("default_role"),
            clean.get("preferences_json"),
        ),
    )


def restore_user_backup(con: sqlite3.Connection, user_id: int, raw: bytes) -> dict[str, int]:
    """Atomically replace portable data for one user.

    All inserted records are assigned to ``user_id`` irrespective of the source
    account id stored in the archive. Other users and account credentials are
    never touched.
    """
    uid = strict_user_id(user_id)
    _manifest, data = _read_backup(raw)
    tables: dict[str, list[dict[str, Any]]] = data["tables"]

    con.execute("SAVEPOINT portable_restore")
    try:
        # Child rows first. Audit history intentionally remains outside the
        # portable data set.
        for table in (
            "track_points",
            "flight_tracks",
            "flights",
            "rates",
            "aircraft",
            "airports",
            "user_expiries",
        ):
            con.execute(f"DELETE FROM {table} WHERE user_id = ?", (uid,))

        _restore_settings(con, uid, data.get("settings") or {})

        for table in ("user_expiries", "aircraft", "rates", "airports"):
            for record in tables.get(table, []):
                _insert_record(con, table, uid, record, _RESTORE_COLUMNS[table])

        flight_map: dict[int, int] = {}
        for record in tables.get("flights", []):
            old_id = int(record.get("id") or 0)
            new_id = _insert_record(con, "flights", uid, record, _RESTORE_COLUMNS["flights"])
            if old_id > 0:
                flight_map[old_id] = new_id

        track_map: dict[int, int] = {}
        for record in tables.get("flight_tracks", []):
            old_id = int(record.get("id") or 0)
            old_flight_id = int(record.get("flight_id") or 0)
            new_flight_id = flight_map.get(old_flight_id)
            if not new_flight_id:
                raise BackupError("Záloha obsahuje GPS track bez odpovídajícího letu.")
            mapped = dict(record)
            mapped["flight_id"] = new_flight_id
            new_id = _insert_record(
                con,
                "flight_tracks",
                uid,
                mapped,
                _RESTORE_COLUMNS["flight_tracks"],
            )
            if old_id > 0:
                track_map[old_id] = new_id

        point_columns = _RESTORE_COLUMNS["track_points"]
        point_sql = (
            f"INSERT INTO track_points (user_id, {', '.join(point_columns)}) "
            f"VALUES (?, {', '.join('?' for _ in point_columns)})"
        )
        point_rows: list[tuple[Any, ...]] = []
        for record in tables.get("track_points", []):
            old_track_id = int(record.get("track_id") or 0)
            new_track_id = track_map.get(old_track_id)
            if not new_track_id:
                raise BackupError("Záloha obsahuje GPS bod bez odpovídajícího tracku.")
            mapped = dict(record)
            mapped["track_id"] = new_track_id
            point_rows.append((uid, *(mapped.get(col) for col in point_columns)))
        if point_rows:
            con.executemany(point_sql, point_rows)

        con.execute("RELEASE SAVEPOINT portable_restore")
    except Exception:
        con.execute("ROLLBACK TO SAVEPOINT portable_restore")
        con.execute("RELEASE SAVEPOINT portable_restore")
        raise

    return {table: len(tables.get(table, [])) for table in PORTABLE_TABLES}
