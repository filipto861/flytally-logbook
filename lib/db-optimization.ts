import "server-only";
import { sql } from "@/lib/db";
import { DATABASE_SCHEMA_VERSION,pendingMigrationVersions } from "@/lib/migration-plan";

declare global{
  // eslint-disable-next-line no-var
  var __logbookOptimization:Promise<void>|undefined;
}

const migrationNames:Record<number,string>={
  1:"flight audit and locking",
  2:"backups and recoverable trash",
  3:"core query indexes",
  4:"restore and route performance indexes",
  5:"EASA FCL.050 flight logbook fields",
  6:"FCL.050 structured aircraft, FSTD and certification",
  7:"certified flight correction revisions",
  8:"certified FSTD correction revisions",
  9:"private beta authentication foundation",
  10:"private pilot connections",
};

const migrationQueries=(version:number)=>{
  if(version===1)return[
    sql`ALTER TABLE flights ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ`,
    sql`ALTER TABLE flights ADD COLUMN IF NOT EXISTS locked_by_user_id BIGINT`,
    sql`CREATE TABLE IF NOT EXISTS flight_audit_log (
      id BIGSERIAL PRIMARY KEY,flight_id BIGINT NOT NULL,user_id BIGINT NOT NULL,actor_user_id BIGINT,
      action TEXT NOT NULL CHECK(action IN ('created','updated','deleted')),old_data JSONB,new_data JSONB,
      changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    sql`CREATE OR REPLACE FUNCTION logbook_protect_locked_flight() RETURNS TRIGGER AS $$
      BEGIN
        IF TG_OP='DELETE' AND OLD.locked_at IS NOT NULL THEN RAISE EXCEPTION 'Locked flight cannot be deleted'; END IF;
        IF TG_OP='UPDATE' AND OLD.locked_at IS NOT NULL
          AND (to_jsonb(OLD)-'locked_at'-'locked_by_user_id') IS DISTINCT FROM (to_jsonb(NEW)-'locked_at'-'locked_by_user_id') THEN
          RAISE EXCEPTION 'Locked flight cannot be changed';
        END IF;
        IF TG_OP='DELETE' THEN RETURN OLD; END IF;
        RETURN NEW;
      END;
    $$ LANGUAGE plpgsql`,
    sql`DO $$ BEGIN
      IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='trg_logbook_protect_locked_flight' AND tgrelid='flights'::regclass AND NOT tgisinternal) THEN
        CREATE TRIGGER trg_logbook_protect_locked_flight BEFORE UPDATE OR DELETE ON flights FOR EACH ROW EXECUTE FUNCTION logbook_protect_locked_flight();
      END IF;
    END $$`,
    sql`CREATE OR REPLACE FUNCTION logbook_audit_flight_change() RETURNS TRIGGER AS $$
      BEGIN
        IF TG_OP='INSERT' THEN
          INSERT INTO flight_audit_log(flight_id,user_id,actor_user_id,action,new_data) VALUES(NEW.id,NEW.user_id,NEW.user_id,'created',to_jsonb(NEW));
          RETURN NEW;
        ELSIF TG_OP='UPDATE' THEN
          IF to_jsonb(OLD) IS DISTINCT FROM to_jsonb(NEW) THEN
            INSERT INTO flight_audit_log(flight_id,user_id,actor_user_id,action,old_data,new_data) VALUES(NEW.id,NEW.user_id,NEW.user_id,'updated',to_jsonb(OLD),to_jsonb(NEW));
          END IF;
          RETURN NEW;
        ELSE
          INSERT INTO flight_audit_log(flight_id,user_id,actor_user_id,action,old_data) VALUES(OLD.id,OLD.user_id,OLD.user_id,'deleted',to_jsonb(OLD));
          RETURN OLD;
        END IF;
      END;
    $$ LANGUAGE plpgsql`,
    sql`DO $$ BEGIN
      IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='trg_logbook_audit_flight_change' AND tgrelid='flights'::regclass AND NOT tgisinternal) THEN
        CREATE TRIGGER trg_logbook_audit_flight_change AFTER INSERT OR UPDATE OR DELETE ON flights FOR EACH ROW EXECUTE FUNCTION logbook_audit_flight_change();
      END IF;
    END $$`,
  ];
  if(version===2)return[
    sql`CREATE TABLE IF NOT EXISTS account_backups (
      id BIGSERIAL PRIMARY KEY,user_id BIGINT NOT NULL,kind TEXT NOT NULL CHECK(kind IN ('automatic','manual','pre_restore')),
      version INTEGER NOT NULL,exported_at TIMESTAMPTZ NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      payload_base64 TEXT NOT NULL,payload_sha256 TEXT NOT NULL,raw_bytes BIGINT NOT NULL,compressed_bytes BIGINT NOT NULL,counts JSONB NOT NULL DEFAULT '{}'::jsonb
    )`,
    sql`CREATE TABLE IF NOT EXISTS deleted_flights (
      id BIGSERIAL PRIMARY KEY,user_id BIGINT NOT NULL,original_flight_id BIGINT NOT NULL,delete_token TEXT NOT NULL UNIQUE,
      flight_data JSONB NOT NULL,tracks_data JSONB NOT NULL DEFAULT '[]'::jsonb,deleted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      purge_after TIMESTAMPTZ NOT NULL DEFAULT (NOW()+INTERVAL '90 days'),restored_at TIMESTAMPTZ,restored_flight_id BIGINT
    )`,
  ];
  if(version===3)return[
    sql`CREATE INDEX IF NOT EXISTS idx_logbook_flights_user_date ON flights(user_id,date DESC,id DESC)`,
    sql`CREATE INDEX IF NOT EXISTS idx_logbook_flights_user_registration ON flights(user_id,registration)`,
    sql`CREATE INDEX IF NOT EXISTS idx_logbook_tracks_user_flight ON flight_tracks(user_id,flight_id)`,
    sql`CREATE INDEX IF NOT EXISTS idx_logbook_rates_user_registration_date ON rates(user_id,registration,valid_from DESC)`,
    sql`CREATE INDEX IF NOT EXISTS idx_logbook_aircraft_user_active ON aircraft(user_id,active,registration)`,
    sql`CREATE INDEX IF NOT EXISTS idx_logbook_airports_user_active ON airports(user_id,active,ident)`,
    sql`CREATE INDEX IF NOT EXISTS idx_logbook_expiries_user_active_date ON user_expiries(user_id,active,expiry_date)`,
    sql`CREATE INDEX IF NOT EXISTS idx_logbook_flight_audit_user_flight ON flight_audit_log(user_id,flight_id,changed_at DESC,id DESC)`,
    sql`CREATE INDEX IF NOT EXISTS idx_logbook_account_backups_user_date ON account_backups(user_id,created_at DESC,id DESC)`,
    sql`CREATE INDEX IF NOT EXISTS idx_logbook_deleted_flights_user_date ON deleted_flights(user_id,restored_at,purge_after,deleted_at DESC,id DESC)`,
  ];
  if(version===4)return[
    sql`CREATE INDEX IF NOT EXISTS idx_logbook_flights_restore_key ON flights(user_id,date,registration,off_block,departure,arrival)`,
    sql`CREATE INDEX IF NOT EXISTS idx_logbook_tracks_restore_key ON flight_tracks(user_id,flight_id,file_name,point_count)`,
    sql`CREATE INDEX IF NOT EXISTS idx_logbook_tracks_user_time ON flight_tracks(user_id,start_utc,id)`,
    sql`CREATE INDEX IF NOT EXISTS idx_logbook_flights_user_route ON flights(user_id,departure,arrival,date DESC)`,
  ];
  if(version===5)return[
    sql`ALTER TABLE flights ADD COLUMN IF NOT EXISTS operation_type TEXT NOT NULL DEFAULT 'SP'`,
    sql`ALTER TABLE flights ADD COLUMN IF NOT EXISTS engine_type TEXT NOT NULL DEFAULT 'SE'`,
    sql`ALTER TABLE flights ADD COLUMN IF NOT EXISTS landings_day INTEGER NOT NULL DEFAULT 0`,
    sql`ALTER TABLE flights ADD COLUMN IF NOT EXISTS landings_night INTEGER NOT NULL DEFAULT 0`,
    sql`ALTER TABLE flights ADD COLUMN IF NOT EXISTS night_minutes INTEGER NOT NULL DEFAULT 0`,
    sql`ALTER TABLE flights ADD COLUMN IF NOT EXISTS ifr_minutes INTEGER NOT NULL DEFAULT 0`,
    sql`ALTER TABLE flights ADD COLUMN IF NOT EXISTS pic_minutes INTEGER NOT NULL DEFAULT 0`,
    sql`ALTER TABLE flights ADD COLUMN IF NOT EXISTS copilot_minutes INTEGER NOT NULL DEFAULT 0`,
    sql`ALTER TABLE flights ADD COLUMN IF NOT EXISTS dual_minutes INTEGER NOT NULL DEFAULT 0`,
    sql`ALTER TABLE flights ADD COLUMN IF NOT EXISTS instructor_minutes INTEGER NOT NULL DEFAULT 0`,
    sql`ALTER TABLE flights ADD COLUMN IF NOT EXISTS verification_name TEXT NOT NULL DEFAULT ''`,
    sql`ALTER TABLE flights ADD COLUMN IF NOT EXISTS verification_reference TEXT NOT NULL DEFAULT ''`,
    sql`UPDATE flights SET landings_day=GREATEST(COALESCE(starts,0),0) WHERE landings_day=0 AND landings_night=0 AND COALESCE(starts,0)>0`,
    sql`UPDATE flights SET engine_type=CASE WHEN UPPER(COALESCE(aircraft_class,''))='MEP' THEN 'ME' ELSE 'SE' END WHERE engine_type IS NULL OR engine_type NOT IN ('SE','ME')`,
    sql`UPDATE flights SET pic_minutes=CASE WHEN UPPER(COALESCE(role,'')) IN ('PIC','SPIC','PICUS','INSTRUKTOR','INSTRUCTOR','EXAMINER') THEN CASE WHEN off_block ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' AND on_block ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' THEN MOD((split_part(on_block,':',1)::int*60+split_part(on_block,':',2)::int)-(split_part(off_block,':',1)::int*60+split_part(off_block,':',2)::int)+1440,1440) ELSE 0 END ELSE 0 END, copilot_minutes=CASE WHEN UPPER(COALESCE(role,''))='CO-PILOT' THEN CASE WHEN off_block ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' AND on_block ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' THEN MOD((split_part(on_block,':',1)::int*60+split_part(on_block,':',2)::int)-(split_part(off_block,':',1)::int*60+split_part(off_block,':',2)::int)+1440,1440) ELSE 0 END ELSE 0 END, dual_minutes=CASE WHEN UPPER(COALESCE(role,''))='DUAL' OR NULLIF(TRIM(COALESCE(instructor,'')),'') IS NOT NULL THEN CASE WHEN off_block ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' AND on_block ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' THEN MOD((split_part(on_block,':',1)::int*60+split_part(on_block,':',2)::int)-(split_part(off_block,':',1)::int*60+split_part(off_block,':',2)::int)+1440,1440) ELSE 0 END ELSE 0 END, instructor_minutes=CASE WHEN UPPER(COALESCE(role,'')) IN ('INSTRUKTOR','INSTRUCTOR','EXAMINER') THEN CASE WHEN off_block ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' AND on_block ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' THEN MOD((split_part(on_block,':',1)::int*60+split_part(on_block,':',2)::int)-(split_part(off_block,':',1)::int*60+split_part(off_block,':',2)::int)+1440,1440) ELSE 0 END ELSE 0 END WHERE pic_minutes=0 AND copilot_minutes=0 AND dual_minutes=0 AND instructor_minutes=0`,
    sql`CREATE INDEX IF NOT EXISTS idx_logbook_flights_user_easa ON flights(user_id,evidence,date DESC)`,
  ];
  if(version===6)return[
    sql`ALTER TABLE aircraft ADD COLUMN IF NOT EXISTS aircraft_make TEXT NOT NULL DEFAULT ''`,
    sql`ALTER TABLE aircraft ADD COLUMN IF NOT EXISTS aircraft_model TEXT NOT NULL DEFAULT ''`,
    sql`ALTER TABLE aircraft ADD COLUMN IF NOT EXISTS aircraft_variant TEXT NOT NULL DEFAULT ''`,
    sql`ALTER TABLE flights ADD COLUMN IF NOT EXISTS aircraft_make TEXT NOT NULL DEFAULT ''`,
    sql`ALTER TABLE flights ADD COLUMN IF NOT EXISTS aircraft_model TEXT NOT NULL DEFAULT ''`,
    sql`ALTER TABLE flights ADD COLUMN IF NOT EXISTS aircraft_variant TEXT NOT NULL DEFAULT ''`,
    sql`ALTER TABLE flights ADD COLUMN IF NOT EXISTS certified_at TIMESTAMPTZ`,
    sql`ALTER TABLE flights ADD COLUMN IF NOT EXISTS certified_by_user_id BIGINT`,
    sql`ALTER TABLE flights ADD COLUMN IF NOT EXISTS certification_hash TEXT NOT NULL DEFAULT ''`,
    sql`ALTER TABLE flights ADD COLUMN IF NOT EXISTS certification_version INTEGER NOT NULL DEFAULT 1`,
    sql`UPDATE aircraft SET aircraft_model=COALESCE(NULLIF(TRIM(aircraft_model),''),NULLIF(TRIM(aircraft_type),''),'') WHERE aircraft_model=''`,
    sql`UPDATE flights f SET aircraft_make=COALESCE(NULLIF(TRIM(f.aircraft_make),''),NULLIF(TRIM(a.aircraft_make),''),''),aircraft_model=COALESCE(NULLIF(TRIM(f.aircraft_model),''),NULLIF(TRIM(a.aircraft_model),''),NULLIF(TRIM(f.aircraft_type),''),''),aircraft_variant=COALESCE(NULLIF(TRIM(f.aircraft_variant),''),NULLIF(TRIM(a.aircraft_variant),''),'') FROM aircraft a WHERE a.user_id=f.user_id AND UPPER(TRIM(a.registration))=UPPER(TRIM(f.registration))`,
    sql`UPDATE flights SET aircraft_model=COALESCE(NULLIF(TRIM(aircraft_model),''),NULLIF(TRIM(aircraft_type),''),'') WHERE aircraft_model=''`,
    sql`CREATE OR REPLACE FUNCTION logbook_snapshot_aircraft_identity() RETURNS TRIGGER AS $$
      DECLARE v_make TEXT; v_model TEXT; v_variant TEXT;
      BEGIN
        IF TG_OP='INSERT' OR NEW.registration IS DISTINCT FROM OLD.registration THEN
          SELECT COALESCE(NULLIF(TRIM(a.aircraft_make),''),''),COALESCE(NULLIF(TRIM(a.aircraft_model),''),NULLIF(TRIM(a.aircraft_type),''),''),COALESCE(NULLIF(TRIM(a.aircraft_variant),''),'')
            INTO v_make,v_model,v_variant FROM aircraft a
            WHERE a.user_id=NEW.user_id AND UPPER(TRIM(a.registration))=UPPER(TRIM(NEW.registration)) LIMIT 1;
          NEW.aircraft_make:=COALESCE(v_make,'');
          NEW.aircraft_model:=COALESCE(v_model,NULLIF(TRIM(NEW.aircraft_type),''),'');
          NEW.aircraft_variant:=COALESCE(v_variant,'');
        ELSE
          IF COALESCE(TRIM(NEW.aircraft_model),'')='' THEN NEW.aircraft_model:=COALESCE(NULLIF(TRIM(NEW.aircraft_type),''),''); END IF;
        END IF;
        RETURN NEW;
      END;
    $$ LANGUAGE plpgsql`,
    sql`DROP TRIGGER IF EXISTS trg_logbook_snapshot_aircraft_identity ON flights`,
    sql`CREATE TRIGGER trg_logbook_snapshot_aircraft_identity BEFORE INSERT OR UPDATE OF registration ON flights FOR EACH ROW EXECUTE FUNCTION logbook_snapshot_aircraft_identity()`,
    sql`CREATE TABLE IF NOT EXISTS fstd_sessions (
      id BIGSERIAL PRIMARY KEY,user_id BIGINT NOT NULL,session_date DATE NOT NULL,device_type TEXT NOT NULL,
      qualification_number TEXT NOT NULL DEFAULT '',instruction TEXT NOT NULL DEFAULT '',total_minutes INTEGER NOT NULL CHECK(total_minutes>=0 AND total_minutes<=1440),
      remarks TEXT NOT NULL DEFAULT '',certified_at TIMESTAMPTZ,certified_by_user_id BIGINT,certification_hash TEXT NOT NULL DEFAULT '',certification_version INTEGER NOT NULL DEFAULT 1,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    sql`CREATE INDEX IF NOT EXISTS idx_logbook_fstd_user_date ON fstd_sessions(user_id,session_date DESC,id DESC)`,
    sql`CREATE OR REPLACE FUNCTION logbook_protect_certified_fstd() RETURNS TRIGGER AS $$
      BEGIN
        IF OLD.certified_at IS NOT NULL THEN RAISE EXCEPTION 'Certified FSTD session cannot be changed or deleted'; END IF;
        IF TG_OP='DELETE' THEN RETURN OLD; END IF;
        RETURN NEW;
      END;
    $$ LANGUAGE plpgsql`,
    sql`DROP TRIGGER IF EXISTS trg_logbook_protect_certified_fstd ON fstd_sessions`,
    sql`CREATE TRIGGER trg_logbook_protect_certified_fstd BEFORE UPDATE OR DELETE ON fstd_sessions FOR EACH ROW EXECUTE FUNCTION logbook_protect_certified_fstd()`,
    sql`CREATE OR REPLACE FUNCTION logbook_protect_locked_flight() RETURNS TRIGGER AS $$
      BEGIN
        IF OLD.certified_at IS NOT NULL THEN RAISE EXCEPTION 'Certified flight cannot be changed or deleted'; END IF;
        IF TG_OP='DELETE' AND OLD.locked_at IS NOT NULL THEN RAISE EXCEPTION 'Locked flight cannot be deleted'; END IF;
        IF TG_OP='UPDATE' AND OLD.locked_at IS NOT NULL
          AND (to_jsonb(OLD)-'locked_at'-'locked_by_user_id') IS DISTINCT FROM (to_jsonb(NEW)-'locked_at'-'locked_by_user_id') THEN
          RAISE EXCEPTION 'Locked flight cannot be changed';
        END IF;
        IF TG_OP='DELETE' THEN RETURN OLD; END IF;
        RETURN NEW;
      END;
    $$ LANGUAGE plpgsql`,
  ];
  if(version===7)return[
    sql`ALTER TABLE flights ADD COLUMN IF NOT EXISTS record_revision INTEGER NOT NULL DEFAULT 1`,
    sql`ALTER TABLE flights ADD COLUMN IF NOT EXISTS correction_reason TEXT NOT NULL DEFAULT ''`,
    sql`ALTER TABLE flights ADD COLUMN IF NOT EXISTS correction_opened_at TIMESTAMPTZ`,
    sql`ALTER TABLE flights ADD COLUMN IF NOT EXISTS correction_opened_by_user_id BIGINT`,
    sql`CREATE TABLE IF NOT EXISTS flight_certified_revisions (
      id BIGSERIAL PRIMARY KEY,
      flight_id BIGINT NOT NULL,
      user_id BIGINT NOT NULL,
      revision_number INTEGER NOT NULL CHECK(revision_number>=1),
      snapshot_data JSONB NOT NULL,
      certification_hash TEXT NOT NULL,
      certification_version INTEGER NOT NULL DEFAULT 1,
      certified_at TIMESTAMPTZ NOT NULL,
      certified_by_user_id BIGINT,
      superseded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      superseded_by_user_id BIGINT NOT NULL,
      correction_reason TEXT NOT NULL,
      UNIQUE(user_id,flight_id,revision_number)
    )`,
    sql`CREATE INDEX IF NOT EXISTS idx_logbook_certified_revisions_user_flight ON flight_certified_revisions(user_id,flight_id,revision_number DESC)`,
    sql`CREATE OR REPLACE FUNCTION logbook_protect_locked_flight() RETURNS TRIGGER AS $$
      DECLARE correction_transition BOOLEAN:=FALSE;
      BEGIN
        IF TG_OP='DELETE' THEN
          IF OLD.certified_at IS NOT NULL THEN RAISE EXCEPTION 'Certified flight cannot be deleted'; END IF;
          IF OLD.locked_at IS NOT NULL THEN RAISE EXCEPTION 'Locked flight cannot be deleted'; END IF;
          RETURN OLD;
        END IF;

        IF OLD.certified_at IS NOT NULL THEN
          correction_transition :=
            NEW.certified_at IS NULL
            AND COALESCE(NEW.certification_hash,'')=''
            AND NEW.locked_at IS NULL
            AND COALESCE(NEW.record_revision,1)=COALESCE(OLD.record_revision,1)+1
            AND NULLIF(TRIM(COALESCE(NEW.correction_reason,'')),'') IS NOT NULL
            AND (to_jsonb(OLD)-'certified_at'-'certified_by_user_id'-'certification_hash'-'locked_at'-'locked_by_user_id'-'record_revision'-'correction_reason'-'correction_opened_at'-'correction_opened_by_user_id')
                IS NOT DISTINCT FROM
                (to_jsonb(NEW)-'certified_at'-'certified_by_user_id'-'certification_hash'-'locked_at'-'locked_by_user_id'-'record_revision'-'correction_reason'-'correction_opened_at'-'correction_opened_by_user_id')
            AND EXISTS(
              SELECT 1 FROM flight_certified_revisions r
              WHERE r.user_id=OLD.user_id AND r.flight_id=OLD.id
                AND r.revision_number=COALESCE(OLD.record_revision,1)
                AND r.certification_hash=COALESCE(OLD.certification_hash,'')
            );
          IF NOT correction_transition THEN RAISE EXCEPTION 'Certified flight is immutable; start a traceable correction instead'; END IF;
          RETURN NEW;
        END IF;

        IF OLD.locked_at IS NOT NULL
          AND (to_jsonb(OLD)-'locked_at'-'locked_by_user_id') IS DISTINCT FROM (to_jsonb(NEW)-'locked_at'-'locked_by_user_id') THEN
          RAISE EXCEPTION 'Locked flight cannot be changed';
        END IF;
        RETURN NEW;
      END;
    $$ LANGUAGE plpgsql`,
  ];
  if(version===8)return[
    sql`ALTER TABLE fstd_sessions ADD COLUMN IF NOT EXISTS record_revision INTEGER NOT NULL DEFAULT 1`,
    sql`ALTER TABLE fstd_sessions ADD COLUMN IF NOT EXISTS correction_reason TEXT NOT NULL DEFAULT ''`,
    sql`ALTER TABLE fstd_sessions ADD COLUMN IF NOT EXISTS correction_opened_at TIMESTAMPTZ`,
    sql`ALTER TABLE fstd_sessions ADD COLUMN IF NOT EXISTS correction_opened_by_user_id BIGINT`,
    sql`CREATE TABLE IF NOT EXISTS fstd_certified_revisions (
      id BIGSERIAL PRIMARY KEY,
      fstd_session_id BIGINT NOT NULL,
      user_id BIGINT NOT NULL,
      revision_number INTEGER NOT NULL CHECK(revision_number>=1),
      snapshot_data JSONB NOT NULL,
      certification_hash TEXT NOT NULL,
      certification_version INTEGER NOT NULL DEFAULT 1,
      certified_at TIMESTAMPTZ NOT NULL,
      certified_by_user_id BIGINT,
      superseded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      superseded_by_user_id BIGINT NOT NULL,
      correction_reason TEXT NOT NULL,
      UNIQUE(user_id,fstd_session_id,revision_number)
    )`,
    sql`CREATE INDEX IF NOT EXISTS idx_logbook_fstd_revisions_user_session ON fstd_certified_revisions(user_id,fstd_session_id,revision_number DESC)`,
    sql`CREATE OR REPLACE FUNCTION logbook_protect_certified_fstd() RETURNS TRIGGER AS $$
      DECLARE correction_transition BOOLEAN:=FALSE;
      BEGIN
        IF TG_OP='DELETE' THEN
          IF OLD.certified_at IS NOT NULL THEN RAISE EXCEPTION 'Certified FSTD session cannot be deleted'; END IF;
          RETURN OLD;
        END IF;
        IF OLD.certified_at IS NOT NULL THEN
          correction_transition :=
            NEW.certified_at IS NULL
            AND COALESCE(NEW.certification_hash,'')=''
            AND COALESCE(NEW.record_revision,1)=COALESCE(OLD.record_revision,1)+1
            AND NULLIF(TRIM(COALESCE(NEW.correction_reason,'')),'') IS NOT NULL
            AND (to_jsonb(OLD)-'certified_at'-'certified_by_user_id'-'certification_hash'-'record_revision'-'correction_reason'-'correction_opened_at'-'correction_opened_by_user_id')
                IS NOT DISTINCT FROM
                (to_jsonb(NEW)-'certified_at'-'certified_by_user_id'-'certification_hash'-'record_revision'-'correction_reason'-'correction_opened_at'-'correction_opened_by_user_id')
            AND EXISTS(
              SELECT 1 FROM fstd_certified_revisions r
              WHERE r.user_id=OLD.user_id AND r.fstd_session_id=OLD.id
                AND r.revision_number=COALESCE(OLD.record_revision,1)
                AND r.certification_hash=COALESCE(OLD.certification_hash,'')
            );
          IF NOT correction_transition THEN RAISE EXCEPTION 'Certified FSTD session is immutable; start a traceable correction instead'; END IF;
        END IF;
        RETURN NEW;
      END;
    $$ LANGUAGE plpgsql`,
  ];
  if(version===9)return[
    sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ`,
    sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_flytally_users_email_normalized ON users(LOWER(BTRIM(email)))`,
    sql`CREATE TABLE IF NOT EXISTS auth_identities (
      id BIGSERIAL PRIMARY KEY,user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      provider TEXT NOT NULL,provider_subject TEXT NOT NULL,provider_email TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),last_login_at TIMESTAMPTZ,
      UNIQUE(provider,provider_subject),UNIQUE(user_id,provider)
    )`,
    sql`CREATE TABLE IF NOT EXISTS auth_sessions (
      id UUID PRIMARY KEY,user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL UNIQUE,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),expires_at TIMESTAMPTZ NOT NULL,
      revoked_at TIMESTAMPTZ,user_agent TEXT NOT NULL DEFAULT '',ip_hash TEXT NOT NULL DEFAULT ''
    )`,
    sql`CREATE INDEX IF NOT EXISTS idx_auth_sessions_user_active ON auth_sessions(user_id,expires_at DESC) WHERE revoked_at IS NULL`,
    sql`CREATE TABLE IF NOT EXISTS auth_invites (
      id BIGSERIAL PRIMARY KEY,email TEXT NOT NULL,token_hash TEXT NOT NULL UNIQUE,role TEXT NOT NULL DEFAULT 'user',
      expires_at TIMESTAMPTZ NOT NULL,created_by_user_id BIGINT NOT NULL REFERENCES users(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),used_at TIMESTAMPTZ,used_by_user_id BIGINT REFERENCES users(id),revoked_at TIMESTAMPTZ
    )`,
    sql`CREATE INDEX IF NOT EXISTS idx_auth_invites_email_active ON auth_invites(LOWER(BTRIM(email)),expires_at DESC) WHERE used_at IS NULL AND revoked_at IS NULL`,
    sql`CREATE TABLE IF NOT EXISTS auth_password_resets (
      id BIGSERIAL PRIMARY KEY,user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL UNIQUE,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),expires_at TIMESTAMPTZ NOT NULL,
      used_at TIMESTAMPTZ,requested_ip_hash TEXT NOT NULL DEFAULT ''
    )`,
    sql`CREATE INDEX IF NOT EXISTS idx_auth_password_resets_user_active ON auth_password_resets(user_id,expires_at DESC) WHERE used_at IS NULL`,
    sql`CREATE TABLE IF NOT EXISTS auth_login_attempts (
      id BIGSERIAL PRIMARY KEY,email_hash TEXT NOT NULL,ip_hash TEXT NOT NULL,
      attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),succeeded BOOLEAN NOT NULL DEFAULT FALSE
    )`,
    sql`CREATE INDEX IF NOT EXISTS idx_auth_attempts_email_time ON auth_login_attempts(email_hash,attempted_at DESC)`,
    sql`CREATE INDEX IF NOT EXISTS idx_auth_attempts_ip_time ON auth_login_attempts(ip_hash,attempted_at DESC)`,
    sql`CREATE TABLE IF NOT EXISTS auth_events (
      id BIGSERIAL PRIMARY KEY,user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,event_type TEXT NOT NULL,
      event_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),ip_hash TEXT NOT NULL DEFAULT '',user_agent TEXT NOT NULL DEFAULT '',details JSONB NOT NULL DEFAULT '{}'::jsonb
    )`,
    sql`CREATE INDEX IF NOT EXISTS idx_auth_events_user_time ON auth_events(user_id,event_at DESC)`,
  ];
  if(version===10)return[
    sql`CREATE TABLE IF NOT EXISTS pilot_connections (
      id BIGSERIAL PRIMARY KEY,
      requester_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      recipient_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      relationship TEXT NOT NULL CHECK(relationship IN ('pilot','requester_instructor','recipient_instructor')),
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','accepted')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),accepted_at TIMESTAMPTZ,updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CHECK(requester_user_id<>recipient_user_id)
    )`,
    sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_pilot_connections_pair ON pilot_connections(LEAST(requester_user_id,recipient_user_id),GREATEST(requester_user_id,recipient_user_id))`,
    sql`CREATE INDEX IF NOT EXISTS idx_pilot_connections_recipient_status ON pilot_connections(recipient_user_id,status,created_at DESC)`,
    sql`CREATE INDEX IF NOT EXISTS idx_pilot_connections_requester_status ON pilot_connections(requester_user_id,status,created_at DESC)`,
  ];
  throw new Error(`Unknown database migration ${version}`);
};

async function migrateDatabase(){
  await sql`CREATE TABLE IF NOT EXISTS flytally_schema_migrations (
    version INTEGER PRIMARY KEY,name TEXT NOT NULL,applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  const rows=await sql`SELECT version FROM flytally_schema_migrations WHERE version<=${DATABASE_SCHEMA_VERSION} ORDER BY version` as Array<{version:number|string}>;
  for(const version of pendingMigrationVersions(rows.map(row=>Number(row.version)))){
    await sql.transaction([
      sql`SELECT pg_advisory_xact_lock(704190104)`,
      ...migrationQueries(version),
      sql`INSERT INTO flytally_schema_migrations(version,name) VALUES(${version},${migrationNames[version]}) ON CONFLICT(version) DO NOTHING`,
    ]);
  }
}

export function ensureDatabaseOptimizations():Promise<void>{
  if(!globalThis.__logbookOptimization){
    globalThis.__logbookOptimization=migrateDatabase().catch(error=>{
      globalThis.__logbookOptimization=undefined;
      console.error("database-migration-failed",error);
      throw error;
    });
  }
  return globalThis.__logbookOptimization;
}
