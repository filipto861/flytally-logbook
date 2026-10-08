import { randomBytes,scrypt as nodeScrypt } from "node:crypto";
import { spawnSync } from "node:child_process";
import { promisify } from "node:util";

const databaseUrl=process.env.DATABASE_URL?.trim();
if(!databaseUrl)throw new Error("DATABASE_URL is required.");
const parsed=new URL(databaseUrl);
if(!new Set(["127.0.0.1","localhost","::1","[::1]"]).has(parsed.hostname))throw new Error("Browser smoke bootstrap may only target localhost.");

const scrypt=promisify(nodeScrypt);
const password=process.env.FLYTALLY_BROWSER_PASSWORD||"FlyTally-Browser-2026!";
const salt=randomBytes(16);
const digest=await scrypt(password,salt,32,{N:131072,r:8,p:1,maxmem:256*1024*1024});
const passwordHash=`scrypt$n=131072,r=8,p=1$${salt.toString("base64url")}$${Buffer.from(digest).toString("base64url")}`;
const quote=value=>`'${String(value).replaceAll("'","''")}'`;

const featureKeys=[
  "v1.32-integrity-foundation",
  "v1.35.3-fcl060-structured-movements",
  "v1.44-production-hardening-indexes",
  "v1.45-aircraft-qualifications",
  "v1.48-training-purpose-modularity",
  "v1.51-regulatory-credit-profile",
  "v1.59-user-flight-expenses",
  "v1.62-sailplane-regulatory-context",
  "v1.63-helicopter-core",
  "v1.64-balloon-bpl-free-tethered",
  "v1.65-advanced-qualifications",
  "v1.66-professional-pilot-layer",
  "v2.9-c3-entitlement-ledger",
  "v3.0-aircraft-profile-sharing",
  "v3.0-web-push-v1",
];

const sql=`
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;

CREATE TABLE flytally_schema_migrations(version INTEGER PRIMARY KEY,name TEXT NOT NULL,applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
INSERT INTO flytally_schema_migrations(version,name)
SELECT value,'browser-smoke-preapplied' FROM generate_series(1,19) value;

CREATE TABLE flytally_feature_migrations(migration_key TEXT PRIMARY KEY,applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
INSERT INTO flytally_feature_migrations(migration_key) VALUES
${featureKeys.map(key=>`(${quote(key)})`).join(",\n")};

CREATE TABLE users(
  id BIGINT PRIMARY KEY,
  email TEXT NOT NULL,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  active INTEGER NOT NULL DEFAULT 1,
  email_verified_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE user_credentials(
  user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  password_hash TEXT NOT NULL,
  last_login_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE user_settings(
  user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  timezone TEXT NOT NULL DEFAULT 'Europe/Prague',
  currency TEXT NOT NULL DEFAULT 'CZK',
  home_airport TEXT NOT NULL DEFAULT '',
  default_role TEXT NOT NULL DEFAULT 'PIC',
  preferences_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE airports(
  ident TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  latitude_deg DOUBLE PRECISION,
  longitude_deg DOUBLE PRECISION,
  user_id BIGINT NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT '',
  active INTEGER NOT NULL DEFAULT 1,
  closed INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX airports_ident_idx ON airports(ident);

CREATE TABLE auth_sessions(
  id UUID PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  user_agent TEXT NOT NULL DEFAULT '',
  ip_hash TEXT NOT NULL DEFAULT ''
);
CREATE TABLE auth_login_attempts(
  id BIGSERIAL PRIMARY KEY,
  email_hash TEXT NOT NULL,
  ip_hash TEXT NOT NULL,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  succeeded BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE TABLE auth_events(
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  event_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_hash TEXT NOT NULL DEFAULT '',
  user_agent TEXT NOT NULL DEFAULT '',
  details JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE flights(
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  evidence TEXT NOT NULL DEFAULT '',
  registration TEXT NOT NULL DEFAULT '',
  aircraft_type TEXT NOT NULL DEFAULT '',
  aircraft_make TEXT NOT NULL DEFAULT '',
  aircraft_model TEXT NOT NULL DEFAULT '',
  aircraft_variant TEXT NOT NULL DEFAULT '',
  aircraft_class TEXT NOT NULL DEFAULT '',
  regulatory_category TEXT NOT NULL DEFAULT 'AEROPLANE',
  balloon_class TEXT NOT NULL DEFAULT '',
  balloon_group TEXT NOT NULL DEFAULT '',
  balloon_operation TEXT NOT NULL DEFAULT '',
  launch_method TEXT NOT NULL DEFAULT '',
  launches INTEGER NOT NULL DEFAULT 0,
  departure TEXT NOT NULL DEFAULT '',
  arrival TEXT NOT NULL DEFAULT '',
  off_block TEXT NOT NULL DEFAULT '',
  takeoff TEXT NOT NULL DEFAULT '',
  landing TEXT NOT NULL DEFAULT '',
  on_block TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT '',
  starts INTEGER NOT NULL DEFAULT 0,
  task TEXT NOT NULL DEFAULT '',
  purpose_code TEXT NOT NULL DEFAULT '',
  billing_basis TEXT NOT NULL DEFAULT 'BLOCK',
  price_per_hour NUMERIC DEFAULT 0,
  locked_at TIMESTAMPTZ,
  locked_by_user_id BIGINT,
  certified_at TIMESTAMPTZ,
  certified_by_user_id BIGINT,
  certification_hash TEXT NOT NULL DEFAULT '',
  certification_version INTEGER NOT NULL DEFAULT 8,
  record_revision INTEGER NOT NULL DEFAULT 1,
  correction_reason TEXT NOT NULL DEFAULT '',
  correction_opened_at TIMESTAMPTZ,
  correction_opened_by_user_id BIGINT,
  pic_minutes INTEGER NOT NULL DEFAULT 0,
  copilot_minutes INTEGER NOT NULL DEFAULT 0,
  dual_minutes INTEGER NOT NULL DEFAULT 0,
  instructor_minutes INTEGER NOT NULL DEFAULT 0,
  night_minutes INTEGER NOT NULL DEFAULT 0,
  ifr_minutes INTEGER NOT NULL DEFAULT 0,
  commander TEXT NOT NULL DEFAULT '',
  instructor TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  operation_type TEXT NOT NULL DEFAULT 'SP',
  engine_type TEXT NOT NULL DEFAULT 'SE',
  operator_name TEXT NOT NULL DEFAULT '',
  flight_number TEXT NOT NULL DEFAULT '',
  operation_context TEXT NOT NULL DEFAULT '',
  landings_day INTEGER NOT NULL DEFAULT 0,
  landings_night INTEGER NOT NULL DEFAULT 0,
  movement_evidence_recorded BOOLEAN NOT NULL DEFAULT FALSE,
  takeoffs_day INTEGER NOT NULL DEFAULT 0,
  takeoffs_night INTEGER NOT NULL DEFAULT 0,
  approaches_day INTEGER NOT NULL DEFAULT 0,
  approaches_night INTEGER NOT NULL DEFAULT 0,
  verification_name TEXT NOT NULL DEFAULT '',
  verification_reference TEXT NOT NULL DEFAULT '',
  UNIQUE(id,user_id)
);
CREATE TABLE flight_audit_log (
  id BIGSERIAL PRIMARY KEY,
  flight_id BIGINT NOT NULL,
  user_id BIGINT NOT NULL,
  actor_user_id BIGINT,
  action TEXT NOT NULL CHECK(action IN ('created','updated','deleted')),
  old_data JSONB,
  new_data JSONB,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE deleted_flights (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL,
  original_flight_id BIGINT NOT NULL,
  delete_token TEXT NOT NULL UNIQUE,
  flight_data JSONB NOT NULL,
  tracks_data JSONB NOT NULL DEFAULT '[]'::jsonb,
  deleted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  purge_after TIMESTAMPTZ NOT NULL DEFAULT (NOW()+INTERVAL '90 days'),
  restored_at TIMESTAMPTZ,
  restored_flight_id BIGINT
);
CREATE TABLE flight_certified_revisions (
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
);

CREATE TABLE flight_expenses(
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL,
  flight_id BIGINT NOT NULL,
  category TEXT NOT NULL,
  label TEXT NOT NULL DEFAULT '',
  amount_minor BIGINT NOT NULL CHECK(amount_minor>0 AND amount_minor<=1000000000),
  currency TEXT NOT NULL CHECK(currency ~ '^[A-Z]{3}$'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT flight_expenses_owner_flight_fk FOREIGN KEY(flight_id,user_id) REFERENCES flights(id,user_id) ON DELETE CASCADE
);
CREATE TABLE aircraft(
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  registration TEXT NOT NULL,
  aircraft_type TEXT NOT NULL DEFAULT '',
  aircraft_make TEXT NOT NULL DEFAULT '',
  aircraft_model TEXT NOT NULL DEFAULT '',
  aircraft_variant TEXT NOT NULL DEFAULT '',
  icao_type TEXT NOT NULL DEFAULT '',
  aircraft_class TEXT NOT NULL DEFAULT '',
  regulatory_category TEXT NOT NULL DEFAULT '',
  balloon_class TEXT NOT NULL DEFAULT '',
  balloon_group TEXT NOT NULL DEFAULT '',
  evidence TEXT NOT NULL DEFAULT '',
  part_fcl_credit_class TEXT NOT NULL DEFAULT '',
  part_fcl_credit_basis TEXT NOT NULL DEFAULT '',
  part_fcl_credit_from TEXT NOT NULL DEFAULT '',
  default_role TEXT NOT NULL DEFAULT 'PIC',
  default_operation_type TEXT CHECK(default_operation_type IS NULL OR default_operation_type IN ('SP','MP')),
  default_engine_type TEXT CHECK(default_engine_type IS NULL OR default_engine_type IN ('SE','ME')),
  billing_basis TEXT NOT NULL DEFAULT 'BLOCK',
  default_price_per_hour NUMERIC NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  note TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id,registration)
);

CREATE OR REPLACE FUNCTION logbook_snapshot_aircraft_identity() RETURNS TRIGGER AS $flytally$
  DECLARE v_make TEXT; v_model TEXT; v_variant TEXT;
  BEGIN
    IF TG_OP='INSERT' THEN
      IF NULLIF(TRIM(COALESCE(NEW.aircraft_make,'')),'') IS NULL
        AND NULLIF(TRIM(COALESCE(NEW.aircraft_model,'')),'') IS NULL
        AND NULLIF(TRIM(COALESCE(NEW.aircraft_variant,'')),'') IS NULL THEN
        SELECT COALESCE(NULLIF(TRIM(a.aircraft_make),''),''),
               COALESCE(NULLIF(TRIM(a.aircraft_model),''),NULLIF(TRIM(a.aircraft_type),''),''),
               COALESCE(NULLIF(TRIM(a.aircraft_variant),''),'')
          INTO v_make,v_model,v_variant
          FROM aircraft a
          WHERE a.user_id=NEW.user_id AND UPPER(TRIM(a.registration))=UPPER(TRIM(NEW.registration))
          LIMIT 1;
        NEW.aircraft_make:=COALESCE(v_make,'');
        NEW.aircraft_model:=COALESCE(v_model,NULLIF(TRIM(NEW.aircraft_type),''),'');
        NEW.aircraft_variant:=COALESCE(v_variant,'');
      END IF;
    ELSIF NEW.registration IS DISTINCT FROM OLD.registration THEN
      SELECT COALESCE(NULLIF(TRIM(a.aircraft_make),''),''),
             COALESCE(NULLIF(TRIM(a.aircraft_model),''),NULLIF(TRIM(a.aircraft_type),''),''),
             COALESCE(NULLIF(TRIM(a.aircraft_variant),''),'')
        INTO v_make,v_model,v_variant
        FROM aircraft a
        WHERE a.user_id=NEW.user_id AND UPPER(TRIM(a.registration))=UPPER(TRIM(NEW.registration))
        LIMIT 1;
      NEW.aircraft_make:=COALESCE(v_make,'');
      NEW.aircraft_model:=COALESCE(v_model,NULLIF(TRIM(NEW.aircraft_type),''),'');
      NEW.aircraft_variant:=COALESCE(v_variant,'');
    END IF;
    RETURN NEW;
  END;
$flytally$ LANGUAGE plpgsql;
CREATE TRIGGER trg_logbook_snapshot_aircraft_identity
  BEFORE INSERT OR UPDATE OF registration ON flights
  FOR EACH ROW EXECUTE FUNCTION logbook_snapshot_aircraft_identity();

CREATE TABLE rates(
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  registration TEXT NOT NULL,
  valid_from TEXT,
  price_per_hour NUMERIC NOT NULL DEFAULT 0
);
CREATE TABLE flight_tracks(
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL,
  flight_id BIGINT NOT NULL,
  file_name TEXT NOT NULL DEFAULT '',
  imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  point_count INTEGER NOT NULL DEFAULT 0,
  distance_km NUMERIC NOT NULL DEFAULT 0,
  start_utc TIMESTAMPTZ,
  end_utc TIMESTAMPTZ,
  min_alt_m NUMERIC,
  max_alt_m NUMERIC,
  coordinates_json TEXT NOT NULL DEFAULT '[]',
  overview_coordinates_json TEXT NOT NULL DEFAULT '[]',
  overview_version INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE flight_connected_crew(
  id BIGSERIAL PRIMARY KEY,
  source_flight_id BIGINT NOT NULL,
  source_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  connected_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  intended_role TEXT NOT NULL CHECK(intended_role='PIC'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT flight_connected_crew_source_owner_fk FOREIGN KEY(source_flight_id,source_user_id) REFERENCES flights(id,user_id) ON DELETE CASCADE,
  CONSTRAINT flight_connected_crew_distinct_users_check CHECK(source_user_id<>connected_user_id),
  CONSTRAINT flight_connected_crew_flight_role_uq UNIQUE(source_flight_id,intended_role)
);
CREATE TABLE flight_participations(
  id BIGSERIAL PRIMARY KEY,
  source_flight_id BIGINT NOT NULL,
  source_user_id BIGINT NOT NULL,
  participant_user_id BIGINT NOT NULL,
  participant_role TEXT NOT NULL DEFAULT 'OBSERVER',
  pic_commander_basis TEXT CHECK(pic_commander_basis IS NULL OR (participant_role='PIC' AND pic_commander_basis IN ('CERTIFIED_SOURCE_COMMANDER','RECIPIENT_ACCOUNT'))),
  source_revision INTEGER NOT NULL DEFAULT 1,
  source_hash TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending',
  participant_flight_id BIGINT,
  decision_note TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  responded_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  superseded_at TIMESTAMPTZ,
  UNIQUE(source_flight_id,source_revision,participant_user_id)
);
CREATE UNIQUE INDEX flight_participations_one_active_pic_uq ON flight_participations(source_flight_id,source_revision) WHERE participant_role='PIC' AND status IN ('pending','accepted');
CREATE TABLE pilot_connections(
  id BIGSERIAL PRIMARY KEY,
  requester_user_id BIGINT NOT NULL,
  recipient_user_id BIGINT NOT NULL,
  relationship TEXT NOT NULL DEFAULT 'pilot',
  status TEXT NOT NULL DEFAULT 'pending',
  requester_label TEXT NOT NULL DEFAULT 'friend',
  recipient_label TEXT NOT NULL DEFAULT 'friend',
  requester_shares_logbook BOOLEAN NOT NULL DEFAULT FALSE,
  recipient_shares_logbook BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE connection_audit_log(
  id BIGSERIAL PRIMARY KEY,
  actor_user_id BIGINT NOT NULL,
  subject_user_id BIGINT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id BIGINT NOT NULL,
  event_type TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE pilot_licences(
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  licence_type TEXT NOT NULL,
  licence_number TEXT NOT NULL,
  authority TEXT NOT NULL DEFAULT '',
  country TEXT NOT NULL DEFAULT '',
  validity_mode TEXT NOT NULL CHECK(validity_mode IN ('unlimited','date','recency')),
  valid_until DATE,
  recency_until DATE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id,licence_type,licence_number)
);
CREATE TABLE pilot_qualifications(
  id BIGSERIAL PRIMARY KEY,
  licence_id BIGINT REFERENCES pilot_licences(id) ON DELETE CASCADE,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  qualification_type TEXT NOT NULL,
  certificate_reference TEXT NOT NULL DEFAULT '',
  validity_mode TEXT NOT NULL CHECK(validity_mode IN ('unlimited','date','recency')),
  valid_until DATE,
  recency_until DATE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  record_kind TEXT,
  record_active BOOLEAN,
  linked_licence_id BIGINT REFERENCES pilot_licences(id) ON DELETE SET NULL,
  training_kind TEXT,
  aircraft_make TEXT,
  aircraft_model TEXT,
  aircraft_variant TEXT,
  differences TEXT,
  completed_on DATE,
  instructor_name TEXT,
  training_organisation TEXT,
  notes TEXT,
  requested_signer_user_id BIGINT,
  signature_status TEXT,
  verification_role TEXT,
  verified_at TIMESTAMPTZ,
  verified_by_user_id BIGINT,
  verification_snapshot JSONB,
  verification_signature TEXT,
  verification_note TEXT,
  verification_version INTEGER,
  qualification_family TEXT,
  regulatory_category TEXT,
  qualification_scope TEXT,
  privilege_role TEXT,
  classification_source TEXT,
  issued_on DATE,
  limitations TEXT,
  UNIQUE(licence_id,qualification_type,certificate_reference)
);
CREATE TABLE user_expiries(
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category TEXT NOT NULL DEFAULT '',
  label TEXT NOT NULL,
  expiry_date DATE NOT NULL,
  warning_days INTEGER NOT NULL DEFAULT 30,
  note TEXT NOT NULL DEFAULT '',
  active INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE spl_recency_evidence(
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  evidence_kind TEXT NOT NULL DEFAULT 'PROFICIENCY_CHECK',
  aircraft_context TEXT NOT NULL,
  evidence_date DATE NOT NULL,
  signer TEXT NOT NULL,
  reference TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK(evidence_kind IN ('PROFICIENCY_CHECK')),
  CHECK(aircraft_context IN ('SAILPLANE','TMG'))
);
CREATE TABLE helicopter_recency_evidence(
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  evidence_kind TEXT NOT NULL DEFAULT 'PROFICIENCY_CHECK',
  helicopter_type TEXT NOT NULL,
  evidence_date DATE NOT NULL,
  signer TEXT NOT NULL,
  reference TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK(evidence_kind IN ('PROFICIENCY_CHECK'))
);
CREATE TABLE bpl_recency_evidence(
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  evidence_kind TEXT NOT NULL DEFAULT 'PROFICIENCY_CHECK',
  balloon_class TEXT NOT NULL,
  balloon_group TEXT NOT NULL DEFAULT '',
  evidence_date DATE NOT NULL,
  signer TEXT NOT NULL,
  reference TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK(evidence_kind IN ('PROFICIENCY_CHECK')),
  CHECK(balloon_class IN ('HOT_AIR_BALLOON','GAS_BALLOON','HOT_AIR_AIRSHIP','MIXED_BALLOON')),
  CHECK(balloon_group IN ('','A','B','C','D'))
);
CREATE TABLE instructor_flight_approvals(
  id BIGSERIAL PRIMARY KEY,
  flight_id BIGINT NOT NULL,
  student_user_id BIGINT NOT NULL,
  instructor_user_id BIGINT NOT NULL,
  record_revision INTEGER NOT NULL DEFAULT 1,
  flight_hash TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending',
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  decided_at TIMESTAMPTZ,
  decision_note TEXT NOT NULL DEFAULT ''
);
CREATE TABLE flight_verifications(
  id BIGSERIAL PRIMARY KEY,
  flight_id BIGINT NOT NULL,
  flight_user_id BIGINT NOT NULL,
  signer_user_id BIGINT,
  verification_role TEXT NOT NULL DEFAULT 'SUPERVISING PIC',
  record_revision INTEGER NOT NULL DEFAULT 1,
  flight_hash TEXT NOT NULL DEFAULT '',
  credential_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  payload_hash TEXT NOT NULL DEFAULT '',
  server_signature TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending',
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  signed_at TIMESTAMPTZ,
  declined_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  decision_note TEXT NOT NULL DEFAULT '',
  revocation_reason TEXT NOT NULL DEFAULT ''
);
CREATE TABLE feature_switches(
  key TEXT PRIMARY KEY,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  updated_by_user_id BIGINT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
INSERT INTO feature_switches(key,enabled) VALUES('crew_sharing',TRUE),('verified_approvals',TRUE);

CREATE TABLE user_notifications(
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL,
  kind TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  href TEXT NOT NULL DEFAULT '',
  dedupe_key TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  read_at TIMESTAMPTZ,
  UNIQUE(user_id,dedupe_key)
);
CREATE TABLE push_preferences(
  user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  compliance BOOLEAN NOT NULL DEFAULT TRUE,
  activity BOOLEAN NOT NULL DEFAULT TRUE,
  security BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE push_subscriptions(
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES auth_sessions(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL DEFAULT '',
  auth TEXT NOT NULL DEFAULT '',
  user_agent TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_success_at TIMESTAMPTZ,
  failure_count INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE aircraft_profile_shares(
  id UUID PRIMARY KEY,
  source_user_id BIGINT NOT NULL,
  recipient_user_id BIGINT NOT NULL,
  snapshot_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO users(id,email,display_name,role,active,email_verified_at)
VALUES
  (9001,'browser-auth@example.test','Browser Smoke Pilot','user',1,NOW()),
  (9002,'browser-friend@example.test','Browser Friend','user',1,NOW());
INSERT INTO user_credentials(user_id,password_hash) VALUES(9001,${quote(passwordHash)});
INSERT INTO user_settings(user_id,timezone,currency,home_airport,default_role,preferences_json)
VALUES
  (9001,'Europe/Prague','CZK','LKLT','PIC','{}'::jsonb),
  (9002,'Europe/Prague','CZK','LKPR','PIC','{}'::jsonb);
INSERT INTO pilot_connections(id,requester_user_id,recipient_user_id,relationship,status,requester_label,recipient_label)
VALUES(7001,9002,9001,'pilot','pending','friend','friend');
INSERT INTO aircraft(user_id,registration,aircraft_type,aircraft_make,aircraft_model,aircraft_class,regulatory_category,evidence,default_role,billing_basis,default_price_per_hour,active)
VALUES
  (9001,'OK-E2E','B23','BRM Aero','Bristell B23','SEP','AEROPLANE','EASA','PIC','BLOCK',0,1),
  (9001,'OK-SP2E','B23','BRM Aero','Bristell B23','SEP','AEROPLANE','EASA','PIC','BLOCK',0,1),
  (9001,'OK-TMG1','TMG','SCHEIBE','SF25C','TMG','AEROPLANE','EASA','PIC','BLOCK',0,1),
  (9001,'OK-ULL1','UL','','','ULL','ULL','ULL','PIC','',0,1),
  (9001,'OK-BAD1','B23','','Bristell B23','SEP','AEROPLANE','EASA','PIC','',0,1);
INSERT INTO user_notifications(user_id,kind,title,body,href,dedupe_key)
VALUES(9001,'connection_request','New connection request','Browser fixture request','/connections','connection:7001');

INSERT INTO flights(
  user_id,date,evidence,registration,aircraft_type,aircraft_class,regulatory_category,
  departure,arrival,off_block,takeoff,landing,on_block,role,starts,pic_minutes,
  landings_day,operator_name,flight_number,operation_context,commander
) VALUES(
  9001,'2026-09-18','EASA','OK-E2E','B23','SEP','AEROPLANE',
  'LKLT','LKPR','10:00','10:05','10:45','10:50','PIC',1,50,
  1,'FlyTally Browser CI','E2E001','PRIVATE','Browser Smoke Pilot'
);
`;

const result=spawnSync("psql",["-d",databaseUrl,"-X","-v","ON_ERROR_STOP=1","-q"],{input:sql,
  encoding:"utf8",
  env:{...process.env,PGCONNECT_TIMEOUT:"5"},
  maxBuffer:16*1024*1024,
});
if(result.error)throw result.error;
if(result.status!==0)throw new Error(`Browser smoke database bootstrap failed:\n${result.stderr||result.stdout}`);
console.log("Browser smoke database ready.");
