from __future__ import annotations

POSTGRES_SCHEMA_VERSION = 2

POSTGRES_TABLE_ORDER = (
    "app_meta",
    "users",
    "user_credentials",
    "user_settings",
    "user_expiries",
    "flights",
    "aircraft",
    "rates",
    "airports",
    "flight_tracks",
    "track_points",
    "audit_log",
)

POSTGRES_SERIAL_TABLES = (
    "users",
    "user_expiries",
    "flights",
    "aircraft",
    "rates",
    "airports",
    "flight_tracks",
    "track_points",
    "audit_log",
)

POSTGRES_TABLE_COLUMNS: dict[str, tuple[str, ...]] = {
    "app_meta": ("key", "value", "updated_at"),
    "users": (
        "id", "email", "display_name", "slug", "role", "active",
        "created_at", "updated_at",
    ),
    "user_credentials": (
        "user_id", "password_hash", "created_at", "updated_at", "last_login_at",
    ),
    "user_settings": (
        "user_id", "timezone", "currency", "home_airport", "default_role",
        "preferences_json", "created_at", "updated_at",
    ),
    "user_expiries": (
        "id", "user_id", "category", "label", "expiry_date", "warning_days",
        "note", "active", "created_at", "updated_at",
    ),
    "flights": (
        "id", "user_id", "date", "evidence", "registration", "aircraft_type",
        "aircraft_class", "departure", "arrival", "off_block", "takeoff",
        "landing", "on_block", "starts", "commander", "instructor", "role",
        "task", "price_per_hour", "billing_basis", "note",
    ),
    "aircraft": (
        "id", "user_id", "registration", "aircraft_type", "icao_type",
        "aircraft_class", "evidence", "default_price_per_hour", "default_role",
        "billing_basis", "active", "note", "created_at", "updated_at",
    ),
    "rates": (
        "id", "user_id", "registration", "aircraft_type", "valid_from",
        "price_per_hour", "dry_price_per_hour", "source",
    ),
    "airports": (
        "id", "user_id", "ident", "name", "airport_type", "iso_country",
        "iso_region", "municipality", "latitude_deg", "longitude_deg",
        "elevation_ft", "gps_code", "iata_code", "local_code", "source",
        "active", "closed", "data_quality", "imported_at", "updated_at",
        "raw_json",
    ),
    "flight_tracks": (
        "id", "user_id", "flight_id", "file_name", "imported_at", "point_count",
        "distance_km", "start_utc", "end_utc", "min_alt_m", "max_alt_m",
        "coordinates_json", "overview_coordinates_json", "overview_version",
    ),
    "track_points": (
        "id", "user_id", "track_id", "seq", "time_utc", "latitude_deg",
        "longitude_deg", "altitude_m", "segment_km", "distance_km", "speed_kmh",
        "speed_kt", "source",
    ),
    "audit_log": (
        "id", "user_id", "created_at", "actor", "action", "object_type",
        "object_id", "detail_json",
    ),
}


POSTGRES_SCHEMA_STATEMENTS = (
    """
    CREATE TABLE IF NOT EXISTS app_meta (
        key TEXT PRIMARY KEY,
        value TEXT,
        updated_at TEXT
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS users (
        id BIGSERIAL PRIMARY KEY,
        email TEXT,
        display_name TEXT NOT NULL,
        slug TEXT NOT NULL UNIQUE,
        role TEXT NOT NULL DEFAULT 'user',
        active INTEGER DEFAULT 1,
        created_at TEXT,
        updated_at TEXT
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS user_credentials (
        user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        password_hash TEXT NOT NULL,
        created_at TEXT,
        updated_at TEXT,
        last_login_at TEXT
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS user_settings (
        user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        timezone TEXT DEFAULT 'Europe/Prague',
        currency TEXT DEFAULT 'CZK',
        home_airport TEXT,
        default_role TEXT DEFAULT 'PIC',
        preferences_json TEXT,
        created_at TEXT,
        updated_at TEXT
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS user_expiries (
        id BIGSERIAL PRIMARY KEY,
        user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        category TEXT NOT NULL DEFAULT 'Doklad',
        label TEXT NOT NULL,
        expiry_date TEXT NOT NULL,
        warning_days INTEGER NOT NULL DEFAULT 30,
        note TEXT,
        active INTEGER DEFAULT 1,
        created_at TEXT,
        updated_at TEXT
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS flights (
        id BIGSERIAL PRIMARY KEY,
        user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
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
        price_per_hour DOUBLE PRECISION,
        billing_basis TEXT DEFAULT 'BLOCK',
        note TEXT
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS aircraft (
        id BIGSERIAL PRIMARY KEY,
        user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        registration TEXT NOT NULL,
        aircraft_type TEXT,
        icao_type TEXT,
        aircraft_class TEXT,
        evidence TEXT,
        default_price_per_hour DOUBLE PRECISION,
        default_role TEXT DEFAULT 'PIC',
        billing_basis TEXT DEFAULT 'BLOCK',
        active INTEGER DEFAULT 1,
        note TEXT,
        created_at TEXT,
        updated_at TEXT,
        UNIQUE(user_id, registration)
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS rates (
        id BIGSERIAL PRIMARY KEY,
        user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        registration TEXT NOT NULL,
        aircraft_type TEXT,
        valid_from TEXT,
        price_per_hour DOUBLE PRECISION,
        dry_price_per_hour DOUBLE PRECISION,
        source TEXT,
        UNIQUE(user_id, registration, valid_from)
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS airports (
        id BIGSERIAL PRIMARY KEY,
        user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        ident TEXT NOT NULL,
        name TEXT,
        airport_type TEXT,
        iso_country TEXT,
        iso_region TEXT,
        municipality TEXT,
        latitude_deg DOUBLE PRECISION,
        longitude_deg DOUBLE PRECISION,
        elevation_ft DOUBLE PRECISION,
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
        UNIQUE(user_id, ident)
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS flight_tracks (
        id BIGSERIAL PRIMARY KEY,
        user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        flight_id BIGINT NOT NULL REFERENCES flights(id) ON DELETE CASCADE,
        file_name TEXT,
        imported_at TEXT,
        point_count INTEGER,
        distance_km DOUBLE PRECISION,
        start_utc TEXT,
        end_utc TEXT,
        min_alt_m DOUBLE PRECISION,
        max_alt_m DOUBLE PRECISION,
        coordinates_json TEXT NOT NULL,
        overview_coordinates_json TEXT,
        overview_version INTEGER DEFAULT 0
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS track_points (
        id BIGSERIAL PRIMARY KEY,
        user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        track_id BIGINT NOT NULL REFERENCES flight_tracks(id) ON DELETE CASCADE,
        seq INTEGER NOT NULL,
        time_utc TEXT,
        latitude_deg DOUBLE PRECISION NOT NULL,
        longitude_deg DOUBLE PRECISION NOT NULL,
        altitude_m DOUBLE PRECISION,
        segment_km DOUBLE PRECISION,
        distance_km DOUBLE PRECISION,
        speed_kmh DOUBLE PRECISION,
        speed_kt DOUBLE PRECISION,
        source TEXT,
        UNIQUE(track_id, seq)
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS audit_log (
        id BIGSERIAL PRIMARY KEY,
        user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TEXT NOT NULL,
        actor TEXT,
        action TEXT NOT NULL,
        object_type TEXT,
        object_id TEXT,
        detail_json TEXT
    )
    """,
    """
    CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_ci
    ON users(LOWER(BTRIM(email)))
    WHERE email IS NOT NULL AND BTRIM(email) <> ''
    """,
    "CREATE INDEX IF NOT EXISTS idx_users_active ON users(active)",
    "CREATE INDEX IF NOT EXISTS idx_user_expiries_user_expiry ON user_expiries(user_id, active, expiry_date)",
    "CREATE INDEX IF NOT EXISTS idx_flights_user_date ON flights(user_id, date)",
    "CREATE INDEX IF NOT EXISTS idx_flights_user_registration ON flights(user_id, registration)",
    "CREATE INDEX IF NOT EXISTS idx_flights_user_evidence_role ON flights(user_id, evidence, role)",
    "CREATE INDEX IF NOT EXISTS idx_flights_user_route ON flights(user_id, departure, arrival)",
    "CREATE INDEX IF NOT EXISTS idx_rates_user_registration_valid ON rates(user_id, registration, valid_from)",
    "CREATE INDEX IF NOT EXISTS idx_aircraft_user_active_registration ON aircraft(user_id, active, registration)",
    "CREATE INDEX IF NOT EXISTS idx_airports_user_ident ON airports(user_id, ident)",
    "CREATE INDEX IF NOT EXISTS idx_tracks_user_flight ON flight_tracks(user_id, flight_id)",
    "CREATE INDEX IF NOT EXISTS idx_track_points_user_track_seq ON track_points(user_id, track_id, seq)",
    "CREATE INDEX IF NOT EXISTS idx_track_points_user_track_time ON track_points(user_id, track_id, time_utc)",
    "CREATE INDEX IF NOT EXISTS idx_audit_user_created_at ON audit_log(user_id, created_at)",
    """
    CREATE OR REPLACE FUNCTION logbook_check_track_owner()
    RETURNS trigger AS $$
    DECLARE parent_user BIGINT;
    BEGIN
        SELECT user_id INTO parent_user FROM flights WHERE id = NEW.flight_id;
        IF parent_user IS NULL THEN
            RAISE EXCEPTION 'flight % does not exist', NEW.flight_id;
        END IF;
        IF parent_user <> NEW.user_id THEN
            RAISE EXCEPTION 'flight_tracks.user_id must match flights.user_id';
        END IF;
        RETURN NEW;
    END;
    $$ LANGUAGE plpgsql
    """,
    "DROP TRIGGER IF EXISTS trg_flight_tracks_owner ON flight_tracks",
    """
    CREATE TRIGGER trg_flight_tracks_owner
    BEFORE INSERT OR UPDATE OF user_id, flight_id ON flight_tracks
    FOR EACH ROW EXECUTE FUNCTION logbook_check_track_owner()
    """,
    """
    CREATE OR REPLACE FUNCTION logbook_check_point_owner()
    RETURNS trigger AS $$
    DECLARE parent_user BIGINT;
    BEGIN
        SELECT user_id INTO parent_user FROM flight_tracks WHERE id = NEW.track_id;
        IF parent_user IS NULL THEN
            RAISE EXCEPTION 'track % does not exist', NEW.track_id;
        END IF;
        IF parent_user <> NEW.user_id THEN
            RAISE EXCEPTION 'track_points.user_id must match flight_tracks.user_id';
        END IF;
        RETURN NEW;
    END;
    $$ LANGUAGE plpgsql
    """,
    "DROP TRIGGER IF EXISTS trg_track_points_owner ON track_points",
    """
    CREATE TRIGGER trg_track_points_owner
    BEFORE INSERT OR UPDATE OF user_id, track_id ON track_points
    FOR EACH ROW EXECUTE FUNCTION logbook_check_point_owner()
    """,
)


def postgres_schema_sql() -> str:
    return ";\n\n".join(statement.strip().rstrip(";") for statement in POSTGRES_SCHEMA_STATEMENTS) + ";\n"
