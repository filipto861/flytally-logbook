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
SELECT value,'browser-smoke-preapplied' FROM generate_series(1,14) value;

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
  deleted_at TIMESTAMPTZ
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
  preferences_json JSONB NOT NULL DEFAULT '{}'::jsonb
);

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
  date DATE NOT NULL,
  evidence TEXT NOT NULL DEFAULT '',
  registration TEXT NOT NULL DEFAULT '',
  aircraft_type TEXT NOT NULL DEFAULT '',
  aircraft_class TEXT NOT NULL DEFAULT '',
  regulatory_category TEXT NOT NULL DEFAULT 'AEROPLANE',
  departure TEXT NOT NULL DEFAULT '',
  arrival TEXT NOT NULL DEFAULT '',
  off_block TEXT NOT NULL DEFAULT '',
  takeoff TEXT NOT NULL DEFAULT '',
  landing TEXT NOT NULL DEFAULT '',
  on_block TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT '',
  starts INTEGER NOT NULL DEFAULT 0,
  task TEXT NOT NULL DEFAULT '',
  billing_basis TEXT NOT NULL DEFAULT 'BLOCK',
  price_per_hour NUMERIC NOT NULL DEFAULT 0,
  locked_at TIMESTAMPTZ,
  locked_by_user_id BIGINT,
  certified_at TIMESTAMPTZ,
  certified_by_user_id BIGINT,
  certification_hash TEXT NOT NULL DEFAULT '',
  certification_version INTEGER NOT NULL DEFAULT 8,
  record_revision INTEGER NOT NULL DEFAULT 1,
  correction_reason TEXT NOT NULL DEFAULT '',
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
  approaches_night INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE flight_tracks(
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL,
  flight_id BIGINT NOT NULL,
  distance_km NUMERIC NOT NULL DEFAULT 0
);
CREATE TABLE flight_participations(
  id BIGSERIAL PRIMARY KEY,
  source_flight_id BIGINT NOT NULL,
  source_user_id BIGINT NOT NULL,
  participant_user_id BIGINT NOT NULL,
  participant_role TEXT NOT NULL DEFAULT 'OBSERVER',
  source_revision INTEGER NOT NULL DEFAULT 1,
  source_hash TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending',
  participant_flight_id BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  responded_at TIMESTAMPTZ
);
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
CREATE TABLE pilot_qualifications(
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL,
  requested_signer_user_id BIGINT,
  record_kind TEXT,
  record_active BOOLEAN,
  signature_status TEXT,
  verified_at TIMESTAMPTZ
);
CREATE TABLE instructor_flight_approvals(
  id BIGSERIAL PRIMARY KEY,
  flight_id BIGINT NOT NULL,
  student_user_id BIGINT NOT NULL,
  instructor_user_id BIGINT NOT NULL,
  record_revision INTEGER NOT NULL DEFAULT 1,
  flight_hash TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending',
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE user_notifications(
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL,
  read_at TIMESTAMPTZ
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
VALUES(9001,'browser-auth@example.test','Browser Smoke Pilot','user',1,NOW());
INSERT INTO user_credentials(user_id,password_hash) VALUES(9001,${quote(passwordHash)});
INSERT INTO user_settings(user_id,timezone,currency,home_airport,default_role,preferences_json)
VALUES(9001,'Europe/Prague','CZK','LKLT','PIC','{}'::jsonb);

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

const result=spawnSync("psql",[databaseUrl,"-X","-v","ON_ERROR_STOP=1","-q","-c",sql],{
  encoding:"utf8",
  env:{...process.env,PGCONNECTTIMEOUT:"5"},
  maxBuffer:16*1024*1024,
});
if(result.error)throw result.error;
if(result.status!==0)throw new Error(`Browser smoke database bootstrap failed:\n${result.stderr||result.stdout}`);
console.log("Browser smoke database ready.");
