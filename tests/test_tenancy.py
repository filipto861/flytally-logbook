from __future__ import annotations

import sqlite3
import unittest

from logbook_core.schema import SCHEMA
from logbook_core.tenancy import DEFAULT_USER_ID, ensure_tenancy_schema


OLD_SCHEMA = """
PRAGMA foreign_keys = ON;
CREATE TABLE app_meta (key TEXT PRIMARY KEY, value TEXT, updated_at TEXT);
CREATE TABLE flights (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    evidence TEXT,
    registration TEXT,
    aircraft_type TEXT,
    aircraft_class TEXT,
    departure TEXT,
    arrival TEXT,
    off_block TEXT,
    takeoff TEXT,
    landing TEXT,
    on_block TEXT,
    starts INTEGER DEFAULT 1,
    commander TEXT,
    instructor TEXT,
    role TEXT,
    task TEXT,
    price_per_hour REAL,
    billing_basis TEXT DEFAULT 'BLOCK',
    note TEXT
);
CREATE TABLE aircraft (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    registration TEXT NOT NULL UNIQUE,
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
    updated_at TEXT
);
CREATE TABLE rates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    registration TEXT NOT NULL,
    aircraft_type TEXT,
    valid_from TEXT,
    price_per_hour REAL,
    dry_price_per_hour REAL,
    source TEXT,
    UNIQUE(registration, valid_from)
);
CREATE TABLE airports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ident TEXT NOT NULL UNIQUE,
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
    raw_json TEXT
);
CREATE TABLE flight_tracks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    flight_id INTEGER NOT NULL,
    file_name TEXT,
    imported_at TEXT,
    point_count INTEGER,
    distance_km REAL,
    start_utc TEXT,
    end_utc TEXT,
    min_alt_m REAL,
    max_alt_m REAL,
    coordinates_json TEXT NOT NULL,
    FOREIGN KEY(flight_id) REFERENCES flights(id) ON DELETE CASCADE
);
CREATE TABLE track_points (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    track_id INTEGER NOT NULL,
    seq INTEGER NOT NULL,
    time_utc TEXT,
    latitude_deg REAL NOT NULL,
    longitude_deg REAL NOT NULL,
    altitude_m REAL,
    segment_km REAL,
    distance_km REAL,
    speed_kmh REAL,
    speed_kt REAL,
    source TEXT,
    FOREIGN KEY(track_id) REFERENCES flight_tracks(id) ON DELETE CASCADE,
    UNIQUE(track_id, seq)
);
CREATE TABLE audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at TEXT NOT NULL,
    actor TEXT,
    action TEXT NOT NULL,
    object_type TEXT,
    object_id TEXT,
    detail_json TEXT
);
"""


class TenancyMigrationTests(unittest.TestCase):
    def make_old_db(self) -> sqlite3.Connection:
        con = sqlite3.connect(":memory:")
        con.row_factory = sqlite3.Row
        con.executescript(OLD_SCHEMA)
        con.execute("INSERT INTO flights (date, registration) VALUES ('2026-08-20', 'OK-ABC')")
        con.execute("INSERT INTO aircraft (registration, aircraft_type) VALUES ('OK-ABC', 'B23')")
        con.execute("INSERT INTO rates (registration, valid_from, price_per_hour) VALUES ('OK-ABC', '2026-01-01', 3000)")
        con.execute("INSERT INTO airports (ident, name, latitude_deg, longitude_deg) VALUES ('LKVO', 'Vodochody', 50.216, 14.395)")
        con.execute("INSERT INTO flight_tracks (flight_id, coordinates_json) VALUES (1, '[]')")
        con.execute("INSERT INTO track_points (track_id, seq, latitude_deg, longitude_deg) VALUES (1, 0, 50.0, 14.0)")
        con.execute("INSERT INTO audit_log (created_at, action) VALUES ('2026-08-20T00:00:00Z', 'seed')")
        con.commit()
        return con

    def test_old_database_is_assigned_to_default_user(self) -> None:
        con = self.make_old_db()
        # Create new global tables first, exactly as app bootstrap does.
        con.executescript(SCHEMA)
        ensure_tenancy_schema(con)
        con.commit()

        self.assertEqual(con.execute("SELECT COUNT(*) FROM users WHERE id = ?", (DEFAULT_USER_ID,)).fetchone()[0], 1)
        for table in ("flights", "aircraft", "rates", "airports", "flight_tracks", "track_points", "audit_log"):
            row = con.execute(f"SELECT user_id FROM {table} LIMIT 1").fetchone()
            self.assertIsNotNone(row, table)
            self.assertEqual(int(row[0]), DEFAULT_USER_ID, table)
        con.close()

    def test_same_registration_and_airport_can_exist_for_two_users(self) -> None:
        con = self.make_old_db()
        con.executescript(SCHEMA)
        ensure_tenancy_schema(con)
        con.execute("INSERT INTO users (id, display_name, slug, active) VALUES (2, 'Second', 'second', 1)")
        con.execute("INSERT INTO aircraft (user_id, registration) VALUES (2, 'OK-ABC')")
        con.execute("INSERT INTO rates (user_id, registration, valid_from) VALUES (2, 'OK-ABC', '2026-01-01')")
        con.execute("INSERT INTO airports (user_id, ident, latitude_deg, longitude_deg) VALUES (2, 'LKVO', 50.2, 14.4)")
        con.commit()

        self.assertEqual(con.execute("SELECT COUNT(*) FROM aircraft WHERE registration='OK-ABC'").fetchone()[0], 2)
        self.assertEqual(con.execute("SELECT COUNT(*) FROM rates WHERE registration='OK-ABC'").fetchone()[0], 2)
        self.assertEqual(con.execute("SELECT COUNT(*) FROM airports WHERE ident='LKVO'").fetchone()[0], 2)
        con.close()

    def test_migration_is_idempotent(self) -> None:
        con = self.make_old_db()
        con.executescript(SCHEMA)
        ensure_tenancy_schema(con)
        ensure_tenancy_schema(con)
        con.commit()
        self.assertEqual(con.execute("SELECT COUNT(*) FROM flights").fetchone()[0], 1)
        self.assertEqual(con.execute("SELECT COUNT(*) FROM aircraft").fetchone()[0], 1)
        con.close()


if __name__ == "__main__":
    unittest.main()
