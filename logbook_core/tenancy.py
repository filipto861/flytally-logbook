from __future__ import annotations

import sqlite3
from typing import Iterable

DEFAULT_USER_ID = 1
DEFAULT_USER_SLUG = "local"
DEFAULT_USER_NAME = "Local pilot"

USER_SCOPED_TABLES = frozenset({
    "flights",
    "aircraft",
    "rates",
    "airports",
    "flight_tracks",
    "track_points",
    "audit_log",
    "user_expiries",
})


def normalize_user_id(value: object, default: int = DEFAULT_USER_ID) -> int:
    try:
        user_id = int(value)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return int(default)
    return user_id if user_id > 0 else int(default)


def _columns(con: sqlite3.Connection, table: str) -> set[str]:
    try:
        return {str(row[1]) for row in con.execute(f"PRAGMA table_info({table})").fetchall()}
    except sqlite3.DatabaseError:
        return set()


def _table_sql(con: sqlite3.Connection, table: str) -> str:
    row = con.execute(
        "SELECT sql FROM sqlite_master WHERE type='table' AND name=?",
        (table,),
    ).fetchone()
    return str(row[0] or "") if row else ""


def _ensure_default_user(con: sqlite3.Connection) -> None:
    con.execute(
        """
        INSERT OR IGNORE INTO users
            (id, email, display_name, slug, active, created_at, updated_at)
        VALUES
            (?, NULL, ?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        """,
        (DEFAULT_USER_ID, DEFAULT_USER_NAME, DEFAULT_USER_SLUG),
    )
    con.execute(
        """
        INSERT OR IGNORE INTO user_settings
            (user_id, timezone, currency, created_at, updated_at)
        VALUES
            (?, 'Europe/Prague', 'CZK', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        """,
        (DEFAULT_USER_ID,),
    )
    # Preserve the current single-user identity when upgrading an existing
    # logbook: use the most common commander name as the local profile name.
    try:
        profile = con.execute("SELECT display_name FROM users WHERE id = ?", (DEFAULT_USER_ID,)).fetchone()
        if profile and str(profile[0] or "") == DEFAULT_USER_NAME:
            row = con.execute(
                """
                SELECT TRIM(commander) AS commander_name, COUNT(*) AS n
                FROM flights
                WHERE commander IS NOT NULL AND TRIM(commander) <> ''
                GROUP BY TRIM(commander)
                ORDER BY n DESC, commander_name
                LIMIT 1
                """
            ).fetchone()
            if row and row[0]:
                con.execute(
                    "UPDATE users SET display_name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND display_name = ?",
                    (str(row[0]), DEFAULT_USER_ID, DEFAULT_USER_NAME),
                )
    except sqlite3.DatabaseError:
        pass


def _add_user_column(con: sqlite3.Connection, table: str) -> None:
    if "user_id" not in _columns(con, table):
        con.execute(
            f"ALTER TABLE {table} ADD COLUMN user_id INTEGER NOT NULL DEFAULT {DEFAULT_USER_ID}"
        )


def _rebuild_aircraft(con: sqlite3.Connection) -> None:
    old_cols = _columns(con, "aircraft")
    if not old_cols:
        return
    sql = "".join(_table_sql(con, "aircraft").upper().split())
    if "user_id" in old_cols and "UNIQUE(USER_ID,REGISTRATION)" in sql:
        return
    con.execute("DROP TABLE IF EXISTS aircraft__v055")
    con.execute(
        """
        CREATE TABLE aircraft__v055 (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL DEFAULT 1,
            registration TEXT NOT NULL,
            aircraft_type TEXT,
            icao_type TEXT,
            aircraft_class TEXT,
            evidence TEXT,
            default_price_per_hour REAL,
            default_role TEXT DEFAULT 'PIC',
            billing_basis TEXT DEFAULT 'BLOCK',
            active INTEGER DEFAULT 1,
            note TEXT,
            created_at TEXT,
            updated_at TEXT,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
            UNIQUE(user_id, registration)
        )
        """
    )
    user_expr = "COALESCE(user_id, 1)" if "user_id" in old_cols else "1"
    fields = [
        "id", "registration", "aircraft_type", "icao_type", "aircraft_class", "evidence",
        "default_price_per_hour", "default_role", "billing_basis", "active", "note",
        "created_at", "updated_at",
    ]
    select_fields = [field if field in old_cols else "NULL" for field in fields]
    con.execute(
        f"""
        INSERT OR IGNORE INTO aircraft__v055
            (id, user_id, {', '.join(fields)})
        SELECT id, {user_expr}, {', '.join(select_fields)}
        FROM aircraft
        """
    )
    con.execute("DROP TABLE aircraft")
    con.execute("ALTER TABLE aircraft__v055 RENAME TO aircraft")


def _rebuild_rates(con: sqlite3.Connection) -> None:
    old_cols = _columns(con, "rates")
    if not old_cols:
        return
    sql = "".join(_table_sql(con, "rates").upper().split())
    if "user_id" in old_cols and "UNIQUE(USER_ID,REGISTRATION,VALID_FROM)" in sql:
        return
    con.execute("DROP TABLE IF EXISTS rates__v055")
    con.execute(
        """
        CREATE TABLE rates__v055 (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL DEFAULT 1,
            registration TEXT NOT NULL,
            aircraft_type TEXT,
            valid_from TEXT,
            price_per_hour REAL,
            dry_price_per_hour REAL,
            source TEXT,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
            UNIQUE(user_id, registration, valid_from)
        )
        """
    )
    user_expr = "COALESCE(user_id, 1)" if "user_id" in old_cols else "1"
    fields = ["registration", "aircraft_type", "valid_from", "price_per_hour", "dry_price_per_hour", "source"]
    select_fields = [field if field in old_cols else "NULL" for field in fields]
    con.execute(
        f"""
        INSERT OR IGNORE INTO rates__v055
            (id, user_id, {', '.join(fields)})
        SELECT id, {user_expr}, {', '.join(select_fields)}
        FROM rates
        """
    )
    con.execute("DROP TABLE rates")
    con.execute("ALTER TABLE rates__v055 RENAME TO rates")


def _rebuild_airports(con: sqlite3.Connection) -> None:
    old_cols = _columns(con, "airports")
    if not old_cols:
        return
    sql = "".join(_table_sql(con, "airports").upper().split())
    if "user_id" in old_cols and "UNIQUE(USER_ID,IDENT)" in sql:
        return
    con.execute("DROP TABLE IF EXISTS airports__v055")
    con.execute(
        """
        CREATE TABLE airports__v055 (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL DEFAULT 1,
            ident TEXT NOT NULL,
            name TEXT,
            airport_type TEXT,
            iso_country TEXT,
            iso_region TEXT,
            municipality TEXT,
            latitude_deg REAL,
            longitude_deg REAL,
            elevation_ft REAL,
            gps_code TEXT,
            iata_code TEXT,
            local_code TEXT,
            source TEXT,
            active INTEGER DEFAULT 1,
            closed INTEGER DEFAULT 0,
            data_quality TEXT,
            imported_at TEXT,
            updated_at TEXT,
            raw_json TEXT,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
            UNIQUE(user_id, ident)
        )
        """
    )
    user_expr = "COALESCE(user_id, 1)" if "user_id" in old_cols else "1"
    fields = [
        "ident", "name", "airport_type", "iso_country", "iso_region", "municipality",
        "latitude_deg", "longitude_deg", "elevation_ft", "gps_code", "iata_code", "local_code",
        "source", "active", "closed", "data_quality", "imported_at", "updated_at", "raw_json",
    ]
    select_fields = [field if field in old_cols else "NULL" for field in fields]
    con.execute(
        f"""
        INSERT OR IGNORE INTO airports__v055
            (id, user_id, {', '.join(fields)})
        SELECT id, {user_expr}, {', '.join(select_fields)}
        FROM airports
        """
    )
    con.execute("DROP TABLE airports")
    con.execute("ALTER TABLE airports__v055 RENAME TO airports")


def _create_user_indexes(con: sqlite3.Connection) -> None:
    statements: Iterable[str] = (
        "CREATE INDEX IF NOT EXISTS idx_flights_user_date ON flights(user_id, date)",
        "CREATE INDEX IF NOT EXISTS idx_flights_user_registration ON flights(user_id, registration)",
        "CREATE INDEX IF NOT EXISTS idx_aircraft_user_active_registration ON aircraft(user_id, active, registration)",
        "CREATE INDEX IF NOT EXISTS idx_rates_user_registration_valid ON rates(user_id, registration, valid_from)",
        "CREATE INDEX IF NOT EXISTS idx_airports_user_ident ON airports(user_id, ident)",
        "CREATE INDEX IF NOT EXISTS idx_tracks_user_flight ON flight_tracks(user_id, flight_id)",
        "CREATE INDEX IF NOT EXISTS idx_track_points_user_track_seq ON track_points(user_id, track_id, seq)",
        "CREATE INDEX IF NOT EXISTS idx_audit_user_created_at ON audit_log(user_id, created_at)",
        "CREATE INDEX IF NOT EXISTS idx_audit_user_id_desc ON audit_log(user_id, id DESC)",
        "CREATE INDEX IF NOT EXISTS idx_user_expiries_user_expiry ON user_expiries(user_id, active, expiry_date)",
    )
    for statement in statements:
        con.execute(statement)



def _create_owner_guard_triggers(con: sqlite3.Connection) -> None:
    """Reject future cross-tenant child relations at the SQLite boundary."""
    statements: Iterable[str] = (
        """
        CREATE TRIGGER IF NOT EXISTS trg_flight_tracks_owner_insert
        BEFORE INSERT ON flight_tracks
        FOR EACH ROW
        WHEN NOT EXISTS (
            SELECT 1 FROM flights f
            WHERE f.id = NEW.flight_id AND f.user_id = NEW.user_id
        )
        BEGIN
            SELECT RAISE(ABORT, 'flight_tracks owner mismatch');
        END
        """,
        """
        CREATE TRIGGER IF NOT EXISTS trg_flight_tracks_owner_update
        BEFORE UPDATE OF user_id, flight_id ON flight_tracks
        FOR EACH ROW
        WHEN NOT EXISTS (
            SELECT 1 FROM flights f
            WHERE f.id = NEW.flight_id AND f.user_id = NEW.user_id
        )
        BEGIN
            SELECT RAISE(ABORT, 'flight_tracks owner mismatch');
        END
        """,
        """
        CREATE TRIGGER IF NOT EXISTS trg_track_points_owner_insert
        BEFORE INSERT ON track_points
        FOR EACH ROW
        WHEN NOT EXISTS (
            SELECT 1 FROM flight_tracks t
            WHERE t.id = NEW.track_id AND t.user_id = NEW.user_id
        )
        BEGIN
            SELECT RAISE(ABORT, 'track_points owner mismatch');
        END
        """,
        """
        CREATE TRIGGER IF NOT EXISTS trg_track_points_owner_update
        BEFORE UPDATE OF user_id, track_id ON track_points
        FOR EACH ROW
        WHEN NOT EXISTS (
            SELECT 1 FROM flight_tracks t
            WHERE t.id = NEW.track_id AND t.user_id = NEW.user_id
        )
        BEGIN
            SELECT RAISE(ABORT, 'track_points owner mismatch');
        END
        """,
    )
    for statement in statements:
        con.execute(statement)

def ensure_tenancy_schema(con: sqlite3.Connection) -> None:
    """Make the SQLite database multi-user ready without changing current UX.

    Existing pre-v0.55 rows are assigned to the local default user (ID 1). The
    function is deliberately idempotent so it is safe on every database startup.
    """
    _ensure_default_user(con)
    try:
        marker = con.execute("SELECT value FROM app_meta WHERE key = 'tenancy_v1'").fetchone()
        if marker and str(marker[0] or "") == "1":
            _create_user_indexes(con)
            _create_owner_guard_triggers(con)
            return
    except sqlite3.DatabaseError:
        pass

    # Tables with old global UNIQUE constraints need a one-time rebuild so two
    # future users can own the same registration/airport ident independently.
    _rebuild_aircraft(con)
    _rebuild_rates(con)
    _rebuild_airports(con)

    for table in ("flights", "flight_tracks", "track_points", "audit_log"):
        _add_user_column(con, table)

    # Keep ownership consistent down the flight -> track -> point hierarchy.
    con.execute(
        """
        UPDATE flight_tracks
        SET user_id = COALESCE((SELECT f.user_id FROM flights f WHERE f.id = flight_tracks.flight_id), user_id, 1)
        WHERE user_id IS NULL OR user_id <= 0
           OR EXISTS (SELECT 1 FROM flights f WHERE f.id = flight_tracks.flight_id AND f.user_id <> flight_tracks.user_id)
        """
    )
    con.execute(
        """
        UPDATE track_points
        SET user_id = COALESCE((SELECT t.user_id FROM flight_tracks t WHERE t.id = track_points.track_id), user_id, 1)
        WHERE user_id IS NULL OR user_id <= 0
           OR EXISTS (SELECT 1 FROM flight_tracks t WHERE t.id = track_points.track_id AND t.user_id <> track_points.user_id)
        """
    )
    con.execute("UPDATE flights SET user_id = 1 WHERE user_id IS NULL OR user_id <= 0")
    con.execute("UPDATE aircraft SET user_id = 1 WHERE user_id IS NULL OR user_id <= 0")
    con.execute("UPDATE rates SET user_id = 1 WHERE user_id IS NULL OR user_id <= 0")
    con.execute("UPDATE airports SET user_id = 1 WHERE user_id IS NULL OR user_id <= 0")
    con.execute("UPDATE audit_log SET user_id = 1 WHERE user_id IS NULL OR user_id <= 0")

    _create_user_indexes(con)
    _create_owner_guard_triggers(con)
    try:
        con.execute(
            "INSERT OR REPLACE INTO app_meta (key, value, updated_at) VALUES ('tenancy_v1', '1', CURRENT_TIMESTAMP)"
        )
    except sqlite3.DatabaseError:
        pass
