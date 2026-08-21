from __future__ import annotations

from .config import DB_SCHEMA_VERSION
from .database_foundation import PostgresTargetConfig
from .postgres_runtime import postgres_connection
from .postgres_schema import POSTGRES_SCHEMA_VERSION
from .map_engine import TRACK_OVERVIEW_VERSION

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
        # One-time v0.73.3.2 backfill runs on the database server, outside
        # interactive Map navigation. It samples normalized track_points into
        # a compact persistent lat/lon overview without transferring full GPS
        # blobs to Streamlit.
        backfill_row = con.execute(
            "SELECT value FROM app_meta WHERE key='track_overview_backfill_version'"
        ).fetchone()
        backfill_version = int((backfill_row["value"] if backfill_row else 0) or 0)
        if backfill_version < TRACK_OVERVIEW_VERSION:
            con.execute(
                """
                WITH ranked AS (
                    SELECT
                        p.track_id,
                        p.seq,
                        p.latitude_deg,
                        p.longitude_deg,
                        ROW_NUMBER() OVER (
                            PARTITION BY p.track_id ORDER BY p.seq
                        ) AS rn,
                        COUNT(*) OVER (
                            PARTITION BY p.track_id
                        ) AS n
                    FROM track_points p
                    JOIN flight_tracks t ON t.id = p.track_id
                    WHERE COALESCE(t.overview_version, 0) < %s
                       OR t.overview_coordinates_json IS NULL
                       OR t.overview_coordinates_json = ''
                ),
                sampled AS (
                    SELECT
                        track_id,
                        seq,
                        latitude_deg,
                        longitude_deg
                    FROM ranked
                    WHERE rn = 1
                       OR rn = n
                       OR (
                           (rn - 1) %% GREATEST(
                               1,
                               CEIL(n::numeric / 180.0)::integer
                           ) = 0
                       )
                ),
                payloads AS (
                    SELECT
                        track_id,
                        jsonb_agg(
                            jsonb_build_object(
                                'lat', ROUND(latitude_deg::numeric, 6),
                                'lon', ROUND(longitude_deg::numeric, 6)
                            )
                            ORDER BY seq
                        )::text AS overview_json
                    FROM sampled
                    GROUP BY track_id
                )
                UPDATE flight_tracks t
                SET overview_coordinates_json = p.overview_json,
                    overview_version = %s
                FROM payloads p
                WHERE t.id = p.track_id
                """,
                (TRACK_OVERVIEW_VERSION, TRACK_OVERVIEW_VERSION),
            )
            con.execute(
                f"""
                INSERT INTO app_meta(key, value, updated_at)
                VALUES ('track_overview_backfill_version', %s, {now_sql})
                ON CONFLICT(key) DO UPDATE
                SET value=EXCLUDED.value, updated_at=EXCLUDED.updated_at
                """,
                (str(TRACK_OVERVIEW_VERSION),),
            )

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
