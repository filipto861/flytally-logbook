from __future__ import annotations

import csv
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
DB_PATH = ROOT / "data" / "logbook.sqlite"
CSV_PATH = ROOT / "data" / "airports.csv"


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def float_or_none(value: Any) -> float | None:
    try:
        text = str(value or "").strip()
        return float(text) if text else None
    except Exception:
        return None


def ensure_schema(conn: sqlite3.Connection) -> None:
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS app_meta (
            key TEXT PRIMARY KEY,
            value TEXT,
            updated_at TEXT
        )
        """
    )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS airports (
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
        )
        """
    )
    conn.execute("CREATE INDEX IF NOT EXISTS idx_airports_ident ON airports(ident)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_airports_country ON airports(iso_country)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_airports_active ON airports(active, closed)")


def set_meta(conn: sqlite3.Connection, key: str, value: str) -> None:
    conn.execute(
        "INSERT OR REPLACE INTO app_meta (key, value, updated_at) VALUES (?, ?, ?)",
        (key, value, now_iso()),
    )


def main() -> None:
    if not DB_PATH.exists():
        raise SystemExit(f"Database not found: {DB_PATH}")
    if not CSV_PATH.exists():
        raise SystemExit(f"Airports CSV not found: {CSV_PATH}")

    with sqlite3.connect(DB_PATH) as conn:
        ensure_schema(conn)
        before = int(conn.execute("SELECT COUNT(*) FROM airports").fetchone()[0])
        rows: list[tuple[Any, ...]] = []
        ts = now_iso()
        with CSV_PATH.open("r", encoding="utf-8-sig", newline="") as fh:
            reader = csv.DictReader(fh)
            for row in reader:
                ident = (row.get("ident") or "").strip().upper()
                if not ident:
                    continue
                lat = float_or_none(row.get("latitude_deg"))
                lon = float_or_none(row.get("longitude_deg"))
                if lat is None or lon is None:
                    continue
                airport_type = (row.get("type") or row.get("airport_type") or "").strip()
                closed = 1 if airport_type == "closed" else 0
                active = 0 if closed else 1
                rows.append((
                    ident,
                    row.get("name"),
                    airport_type,
                    row.get("iso_country"),
                    row.get("iso_region"),
                    row.get("municipality"),
                    lat,
                    lon,
                    float_or_none(row.get("elevation_ft")),
                    row.get("gps_code"),
                    row.get("iata_code"),
                    row.get("local_code") or ident,
                    "ourairports_csv",
                    active,
                    closed,
                    "ourairports_public_domain",
                    ts,
                    ts,
                    None,
                ))
        conn.executemany(
            """
            INSERT OR IGNORE INTO airports
            (ident, name, airport_type, iso_country, iso_region, municipality,
             latitude_deg, longitude_deg, elevation_ft, gps_code, iata_code,
             local_code, source, active, closed, data_quality, imported_at,
             updated_at, raw_json)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            rows,
        )
        after = int(conn.execute("SELECT COUNT(*) FROM airports").fetchone()[0])
        set_meta(conn, "airports_fixed_import_at", ts)
        set_meta(conn, "airports_fixed_import_rows_csv", str(len(rows)))
        set_meta(conn, "airports_fixed_import_before", str(before))
        set_meta(conn, "airports_fixed_import_after", str(after))
        conn.execute("PRAGMA wal_checkpoint(FULL)")
        conn.commit()
        print(f"Airport rows before: {before}")
        print(f"Airport CSV usable rows: {len(rows)}")
        print(f"Airport rows after: {after}")


if __name__ == "__main__":
    main()
