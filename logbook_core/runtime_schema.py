from __future__ import annotations

from .config import DB_SCHEMA_VERSION
from .database_foundation import PostgresTargetConfig
from .postgres_runtime import postgres_connection
from .postgres_schema import POSTGRES_SCHEMA_VERSION

_RUNTIME_SCHEMA_LOCK = "logbook-runtime-schema"


def ensure_postgres_runtime_schema(config: PostgresTargetConfig) -> None:
    """Idempotently upgrade an already-live PostgreSQL production database.

    v0.73.3 adds only derived map-cache columns and supporting indexes.  No
    user-visible flight data is rewritten and no automatic fallback is involved.
    """
    with postgres_connection(config) as con:
        con.execute(
            "SELECT pg_advisory_xact_lock(hashtext(%s))",
            (_RUNTIME_SCHEMA_LOCK,),
        )
        con.execute(
            "ALTER TABLE flight_tracks ADD COLUMN IF NOT EXISTS overview_coordinates_json TEXT"
        )
        con.execute(
            "ALTER TABLE flight_tracks ADD COLUMN IF NOT EXISTS overview_version INTEGER DEFAULT 0"
        )
        con.execute(
            "CREATE INDEX IF NOT EXISTS idx_tracks_user_flight_v2 ON flight_tracks(user_id, flight_id, id)"
        )
        con.execute(
            "CREATE INDEX IF NOT EXISTS idx_flights_user_date_v2 ON flights(user_id, date, id)"
        )
        now_sql = "to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS') || '+00:00'"
        con.execute(
            f"""
            INSERT INTO app_meta(key, value, updated_at)
            VALUES ('postgres_foundation_schema', %s, {now_sql})
            ON CONFLICT(key) DO UPDATE
            SET value=EXCLUDED.value, updated_at=EXCLUDED.updated_at
            """,
            (str(POSTGRES_SCHEMA_VERSION),),
        )
        con.execute(
            f"""
            INSERT INTO app_meta(key, value, updated_at)
            VALUES ('schema_version', %s, {now_sql})
            ON CONFLICT(key) DO UPDATE
            SET value=EXCLUDED.value, updated_at=EXCLUDED.updated_at
            """,
            (str(DB_SCHEMA_VERSION),),
        )
        con.commit()
