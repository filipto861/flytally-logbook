import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { after,before,test } from "node:test";
import { verificationCryptographicStatus } from "../../lib/authority-verification.ts";
import { signVerificationPayload } from "../../lib/verification-signature.ts";

const enabled=process.env.FLYTALLY_POSTGRES_INTEGRATION==="1";
const databaseUrl=process.env.DATABASE_URL??"";
const root=path.resolve(import.meta.dirname,"../..");
const schema=`ft_fi_${randomUUID().replaceAll("-","")}`;
const quotedSchema=`"${schema}"`;
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");

function rawPsql(statement:string){
  const result=spawnSync("psql",["-d",databaseUrl,"-X","-v","ON_ERROR_STOP=1","-qAt","-c",statement],{encoding:"utf8",env:{...process.env,PGCONNECT_TIMEOUT:"5"}});
  if(result.error)throw result.error;
  return result;
}
function run(statement:string){
  const result=rawPsql(`SET search_path TO ${quotedSchema};\n${statement}`);
  if(result.status!==0)throw new Error(`PostgreSQL FI materialisation command failed:\n${result.stderr||result.stdout}`);
  return String(result.stdout??"").trim();
}
function rows(statement:string){
  const clean=statement.trim().replace(/;\s*$/,"");
  return JSON.parse(run(`WITH q AS (${clean}) SELECT COALESCE(json_agg(row_to_json(q)),'[]'::json)::text FROM q`)||"[]") as Array<Record<string,unknown>>;
}
function literal(value:unknown){
  if(value===null||value===undefined)return"NULL";
  if(typeof value==="number")return Number.isFinite(value)?String(value):"NULL";
  if(typeof value==="boolean")return value?"TRUE":"FALSE";
  return`'${String(value).replaceAll("'","''")}'`;
}
function materializeSql(source:string){
  const startNeedle="const result=await sql`WITH locked AS MATERIALIZED";
  const start=source.indexOf(startNeedle);assert.ok(start>=0,"Production FI materialisation SQL start not found");
  const sqlStart=source.indexOf("sql`",start)+4;
  const endNeedle="SELECT participant_flight_id FROM linked` as Array<{participant_flight_id:number|string}>;";
  const end=source.indexOf(endNeedle,sqlStart);assert.ok(end>=0,"Production FI materialisation SQL end not found");
  return source.slice(sqlStart,end+"SELECT participant_flight_id FROM linked".length);
}
function renderMaterialize(block:string,values:Record<string,unknown>){
  const rendered=block.replace(/\$\{([^}]+)\}/g,(_all,expression)=>{
    const key=String(expression).trim();
    assert.ok(Object.prototype.hasOwnProperty.call(values,key),`No FI SQL test value for ${key}`);
    return literal(values[key]);
  });
  assert.doesNotMatch(rendered,/\$\{/);
  return rendered;
}

before(()=>{
  if(!enabled)return;
  assert.ok(databaseUrl,"DATABASE_URL is required for PostgreSQL FI materialisation acceptance tests");
  const setup=`
    CREATE SCHEMA ${quotedSchema};
    SET search_path TO ${quotedSchema};
    CREATE TABLE users(id BIGINT PRIMARY KEY,display_name TEXT NOT NULL DEFAULT '');
    CREATE TABLE pilot_connections(
      id BIGSERIAL PRIMARY KEY,
      requester_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      recipient_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      status TEXT NOT NULL
    );
    CREATE TABLE flights(
      id BIGSERIAL PRIMARY KEY,user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,date DATE,evidence TEXT NOT NULL DEFAULT '',registration TEXT NOT NULL DEFAULT '',
      aircraft_type TEXT NOT NULL DEFAULT '',aircraft_class TEXT NOT NULL DEFAULT '',regulatory_category TEXT NOT NULL DEFAULT 'AEROPLANE',balloon_class TEXT NOT NULL DEFAULT '',balloon_group TEXT NOT NULL DEFAULT '',balloon_operation TEXT NOT NULL DEFAULT '',launch_method TEXT NOT NULL DEFAULT '',launches INTEGER NOT NULL DEFAULT 0,aircraft_make TEXT NOT NULL DEFAULT '',aircraft_model TEXT NOT NULL DEFAULT '',aircraft_variant TEXT NOT NULL DEFAULT '',
      departure TEXT NOT NULL DEFAULT '',arrival TEXT NOT NULL DEFAULT '',off_block TEXT NOT NULL DEFAULT '',takeoff TEXT NOT NULL DEFAULT '',landing TEXT NOT NULL DEFAULT '',on_block TEXT NOT NULL DEFAULT '',starts INTEGER NOT NULL DEFAULT 0,
      commander TEXT NOT NULL DEFAULT '',instructor TEXT NOT NULL DEFAULT '',role TEXT NOT NULL DEFAULT '',task TEXT NOT NULL DEFAULT '',purpose_code TEXT NOT NULL DEFAULT '',price_per_hour NUMERIC,billing_basis TEXT NOT NULL DEFAULT 'BLOCK',note TEXT NOT NULL DEFAULT '',
      operation_type TEXT NOT NULL DEFAULT 'SP',engine_type TEXT NOT NULL DEFAULT 'SE',operator_name TEXT NOT NULL DEFAULT '',flight_number TEXT NOT NULL DEFAULT '',operation_context TEXT NOT NULL DEFAULT '',landings_day INTEGER NOT NULL DEFAULT 0,landings_night INTEGER NOT NULL DEFAULT 0,movement_evidence_recorded BOOLEAN NOT NULL DEFAULT FALSE,takeoffs_day INTEGER NOT NULL DEFAULT 0,takeoffs_night INTEGER NOT NULL DEFAULT 0,approaches_day INTEGER NOT NULL DEFAULT 0,approaches_night INTEGER NOT NULL DEFAULT 0,night_minutes INTEGER NOT NULL DEFAULT 0,ifr_minutes INTEGER NOT NULL DEFAULT 0,
      pic_minutes INTEGER NOT NULL DEFAULT 0,copilot_minutes INTEGER NOT NULL DEFAULT 0,dual_minutes INTEGER NOT NULL DEFAULT 0,instructor_minutes INTEGER NOT NULL DEFAULT 0,verification_name TEXT NOT NULL DEFAULT '',verification_reference TEXT NOT NULL DEFAULT '',
      certified_at TIMESTAMPTZ,certification_hash TEXT NOT NULL DEFAULT '',record_revision INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE aircraft(
      id BIGSERIAL PRIMARY KEY,user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,registration TEXT NOT NULL,aircraft_type TEXT NOT NULL DEFAULT '',aircraft_make TEXT NOT NULL DEFAULT '',aircraft_model TEXT NOT NULL DEFAULT '',aircraft_variant TEXT NOT NULL DEFAULT '',
      icao_type TEXT NOT NULL DEFAULT '',aircraft_class TEXT NOT NULL DEFAULT '',regulatory_category TEXT NOT NULL DEFAULT 'AEROPLANE',balloon_class TEXT NOT NULL DEFAULT '',balloon_group TEXT NOT NULL DEFAULT '',evidence TEXT NOT NULL DEFAULT '',default_price_per_hour NUMERIC,default_role TEXT NOT NULL DEFAULT '',billing_basis TEXT NOT NULL DEFAULT 'BLOCK',active INTEGER NOT NULL DEFAULT 1,
      note TEXT NOT NULL DEFAULT '',created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),UNIQUE(user_id,registration)
    );
    CREATE TABLE flight_tracks(
      id BIGSERIAL PRIMARY KEY,user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,flight_id BIGINT NOT NULL REFERENCES flights(id) ON DELETE CASCADE,file_name TEXT NOT NULL DEFAULT '',imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      point_count INTEGER NOT NULL DEFAULT 0,distance_km NUMERIC NOT NULL DEFAULT 0,start_utc TIMESTAMPTZ,end_utc TIMESTAMPTZ,min_alt_m NUMERIC,max_alt_m NUMERIC,coordinates_json TEXT NOT NULL DEFAULT '[]',overview_coordinates_json TEXT NOT NULL DEFAULT '[]',overview_version INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE flight_connected_crew(
      id BIGSERIAL PRIMARY KEY,source_flight_id BIGINT NOT NULL,source_user_id BIGINT NOT NULL,connected_user_id BIGINT NOT NULL,
      intended_role TEXT NOT NULL DEFAULT 'PIC',UNIQUE(source_flight_id,intended_role)
    );
    CREATE TABLE flight_participations(
      id BIGINT PRIMARY KEY,source_flight_id BIGINT NOT NULL REFERENCES flights(id) ON DELETE CASCADE,source_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,participant_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      participant_role TEXT NOT NULL,pic_commander_basis TEXT,source_revision INTEGER NOT NULL,source_hash TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'pending',participant_flight_id BIGINT REFERENCES flights(id) ON DELETE SET NULL,responded_at TIMESTAMPTZ
    );
    CREATE TABLE flight_verifications(
      id BIGSERIAL PRIMARY KEY,flight_id BIGINT NOT NULL REFERENCES flights(id) ON DELETE CASCADE,flight_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,signer_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
      verification_role TEXT NOT NULL,record_revision INTEGER NOT NULL,flight_hash TEXT NOT NULL,credential_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,payload_hash TEXT NOT NULL DEFAULT '',server_signature TEXT NOT NULL DEFAULT '',status TEXT NOT NULL DEFAULT 'pending',signed_at TIMESTAMPTZ
    );
    INSERT INTO users(id,display_name) VALUES(81,'Test Student'),(82,'Test Instructor'),(83,'Linked Actual PIC'),(84,'Generic PIC Recipient');
    INSERT INTO flights(id,user_id,date,evidence,registration,aircraft_type,aircraft_class,regulatory_category,aircraft_make,aircraft_model,departure,arrival,off_block,takeoff,landing,on_block,starts,commander,instructor,role,task,purpose_code,price_per_hour,billing_basis,operation_type,engine_type,operator_name,flight_number,operation_context,landings_day,dual_minutes,certified_at,certification_hash,record_revision)
      VALUES
        (901,81,'2026-08-28','EASA','OK-FI1','B23','SEP','AEROPLANE','Bristell','B23','LKPR','LKBE','08:00','08:05','09:00','09:05',1,'Test Instructor','Test Instructor','DUAL','FCL.140.A refresher training','LAPL_FCL140A_REFRESHER',3000,'BLOCK','SP','SE','FlyTally Training','FT901','TRAINING',1,65,NOW(),'hash-r1',1),
        (902,81,'2026-09-20','EASA','OK-SP4','B23','SEP','AEROPLANE','Bristell','B23','LKPR','LKBE','10:00','10:05','11:05','11:12',3,'Linked Actual PIC','','SAFETY PILOT','','',3000,'BLOCK','SP','SE','FlyTally Training','FT902','PRIVATE',3,0,NOW(),'hash-sp4-r1',1),
        (903,81,'2026-09-21','EASA','OK-GPIC','B23','SEP','AEROPLANE','Bristell','B23','LKPR','LKTB','12:00','12:08','13:02','13:10',2,'Source Commander','','INSTRUCTOR','Training detail','TRAINING',3000,'BLOCK','SP','SE','FlyTally Training','FT903','TRAINING',1,0,NOW(),'hash-gpic-r1',1);
    INSERT INTO aircraft(user_id,registration,aircraft_type,aircraft_make,aircraft_model,icao_type,aircraft_class,regulatory_category,evidence,default_price_per_hour,default_role,billing_basis)
      VALUES
        (81,'OK-FI1','B23','Bristell','B23','BR23','SEP','AEROPLANE','EASA',3000,'DUAL','BLOCK'),
        (81,'OK-SP4','B23','Bristell','B23','BR23','SEP','AEROPLANE','EASA',3000,'SAFETY PILOT','BLOCK'),
        (81,'OK-GPIC','B23','Bristell','B23','BR23','SEP','AEROPLANE','EASA',3000,'INSTRUCTOR','BLOCK');
    UPDATE flights SET note='Complete source note',landings_day=1,landings_night=1,movement_evidence_recorded=TRUE,takeoffs_day=1,takeoffs_night=1,approaches_day=2,approaches_night=0,night_minutes=25,ifr_minutes=18,instructor_minutes=70 WHERE id=903;
    INSERT INTO flight_tracks(user_id,flight_id,file_name,point_count,distance_km,start_utc,end_utc,coordinates_json,overview_coordinates_json,overview_version)
      VALUES
        (81,901,'source.kml',120,42.5,'2026-08-28T08:00:00Z','2026-08-28T09:05:00Z','[{"lat":50.1,"lon":14.3}]','[{"lat":50.1,"lon":14.3}]',1),
        (81,903,'generic.kml',150,55.2,'2026-09-21T12:00:00Z','2026-09-21T13:10:00Z','[{"lat":50.2,"lon":14.4}]','[{"lat":50.2,"lon":14.4}]',1);
    INSERT INTO pilot_connections(requester_user_id,recipient_user_id,status) VALUES(81,83,'accepted'),(81,84,'accepted');
    INSERT INTO flight_connected_crew(source_flight_id,source_user_id,connected_user_id,intended_role) VALUES(902,81,83,'PIC');
    INSERT INTO flight_participations(id,source_flight_id,source_user_id,participant_user_id,participant_role,pic_commander_basis,source_revision,source_hash,status)
      VALUES
        (9001,901,81,82,'INSTRUCTOR',NULL,1,'hash-r1','accepted'),
        (9002,902,81,83,'PIC','CERTIFIED_SOURCE_COMMANDER',1,'hash-sp4-r1','pending'),
        (9003,903,81,84,'PIC','RECIPIENT_ACCOUNT',1,'hash-gpic-r1','pending');
  `;
  const result=rawPsql(setup);if(result.status!==0)throw new Error(`PostgreSQL FI materialisation schema setup failed:\n${result.stderr||result.stdout}`);
});

after(()=>{if(enabled)rawPsql(`DROP SCHEMA IF EXISTS ${quotedSchema} CASCADE`)});

test("AC-11 sign and add FI entry creates a separate instructor-owned record without changing the student source",{skip:!enabled},()=>{
  process.env.SIGNING_SECRET=process.env.SIGNING_SECRET||"flytally-ci-signing-secret-with-enough-entropy";
  const credentialSnapshot={identity:"Test Instructor",source:"FlyTally account",licences:[{licence_type:"LAPL(A)",licence_number:"CZ.FCL.TEST"}],qualifications:[{qualification_type:"FI(A)",certificate_reference:"FI-TEST"}]};
  const payload={flightId:901,flightUserId:81,signerUserId:82,recordRevision:1,flightHash:"hash-r1",verificationRole:"INSTRUCTOR",credentialSnapshot};
  const signature=signVerificationPayload(payload);
  run(`INSERT INTO flight_verifications(flight_id,flight_user_id,signer_user_id,verification_role,record_revision,flight_hash,credential_snapshot,payload_hash,server_signature,status,signed_at)
    VALUES(901,81,82,'INSTRUCTOR',1,'hash-r1','${JSON.stringify(credentialSnapshot).replaceAll("'","''")}'::jsonb,'hash-r1','${signature}','signed',NOW())`);
  const signed=rows("SELECT * FROM flight_verifications WHERE flight_id=901 AND signer_user_id=82 AND record_revision=1")[0];
  assert.equal(verificationCryptographicStatus(signed),"verified");

  const shared=read("app/(protected)/flights/shared-actions.ts");
  const materialize=materializeSql(shared);
  const values:Record<string,unknown>={
    fingerprint:"fi-materialize-901-82",userId:82,
    "text(row.registration)":"OK-FI1","text(row.aircraft_type)":"B23","text(row.aircraft_make)":"Bristell","text(row.aircraft_model)":"B23","text(row.aircraft_variant)":"","text(row.icao_type)":"BR23","text(row.aircraft_class)":"SEP","text(row.regulatory_category)":"AEROPLANE","text(row.balloon_class)":"","text(row.balloon_group)":"","text(row.balloon_operation)":"","text(row.launch_method)":"","Number(row.launches)||0":0,"text(row.evidence)":"EASA",
    "row.price_per_hour===null?null:Number(row.price_per_hour)||0":3000,role:"FI","text(row.billing_basis)||'BLOCK'":"BLOCK",
    "Number(row.source_flight_id)":901,"Number(row.source_user_id)":81,"Number(row.source_revision)":1,"text(row.source_hash)":"hash-r1","participantRole!==\"PIC\"":true,"picCommanderBasis!==\"CERTIFIED_SOURCE_COMMANDER\"":true,"picCommanderBasis!==\"RECIPIENT_ACCOUNT\"":true,
    "text(row.date)":"2026-08-28","text(row.departure)":"LKPR","text(row.arrival)":"LKBE","text(row.off_block)":"08:00","text(row.registration).toUpperCase()":"OK-FI1","text(row.departure).toUpperCase()":"LKPR","text(row.arrival).toUpperCase()":"LKBE",
    "participantRole===\"INSTRUCTOR\"":true,"text(row.takeoff)":"08:05","text(row.landing)":"09:00","text(row.on_block)":"09:05","Number(row.starts)||0":1,
    commander:"Test Instructor",instructorName:"","text(row.task)":"FCL.140.A refresher training","text(row.purpose_code)":"LAPL_FCL140A_REFRESHER",
    "text(row.operation_type)||\"SP\"":"SP","text(row.engine_type)||\"SE\"":"SE","text(row.operator_name)":"FlyTally Training","text(row.flight_number)":"FT901","text(row.operation_context)":"TRAINING","Number(row.landings_day)||0":1,"Number(row.landings_night)||0":0,"Boolean(row.movement_evidence_recorded)":false,"Number(row.takeoffs_day)||0":0,"Number(row.takeoffs_night)||0":0,"Number(row.approaches_day)||0":0,"Number(row.approaches_night)||0":0,"Number(row.night_minutes)||0":0,"Number(row.ifr_minutes)||0":0,
    "credit.pic":65,"credit.copilot":0,"credit.instructor":65,participationId:9001,recipientNote:"FI entry linked to Test Student's verified training flight"
  };
  const fiFlightId=Number(run(renderMaterialize(materialize,values)));assert.ok(fiFlightId>0);
  const fi=rows(`SELECT * FROM flights WHERE id=${fiFlightId} AND user_id=82`)[0];
  assert.equal(String(fi.role),"FI");assert.equal(String(fi.commander),"Test Instructor");assert.equal(Number(fi.pic_minutes),65);assert.equal(Number(fi.instructor_minutes),65);assert.equal(Number(fi.dual_minutes),0);
  assert.equal(String(fi.regulatory_category),"AEROPLANE");assert.equal(String(fi.balloon_class),"");assert.equal(String(fi.balloon_group),"");assert.equal(String(fi.balloon_operation),"");assert.equal(String(fi.launch_method),"");assert.equal(Number(fi.launches),0);
  assert.equal(String(fi.operator_name),"FlyTally Training");assert.equal(String(fi.flight_number),"FT901");assert.equal(String(fi.operation_context),"TRAINING");
  assert.equal(String(fi.note),"FI entry linked to Test Student's verified training flight");
  assert.equal(Number(rows(`SELECT COUNT(*) count FROM flight_tracks WHERE user_id=82 AND flight_id=${fiFlightId}`)[0].count),1);
  assert.equal(String(rows("SELECT certification_hash FROM flights WHERE id=901 AND user_id=81")[0].certification_hash),"hash-r1");

  run(`DELETE FROM flights WHERE id=${fiFlightId} AND user_id=82`);
  const participation=rows("SELECT participant_flight_id,status FROM flight_participations WHERE id=9001")[0];
  assert.equal(participation.participant_flight_id,null);assert.equal(String(participation.status),"accepted");
  assert.equal(Number(rows("SELECT COUNT(*) count FROM flights WHERE id=901 AND user_id=81 AND certified_at IS NOT NULL AND certification_hash='hash-r1'")[0].count),1);
  assert.equal(Number(rows("SELECT COUNT(*) count FROM flight_verifications WHERE flight_id=901 AND flight_user_id=81 AND signer_user_id=82 AND status='signed'")[0].count),1);
});


test("SP4 connected PIC materialization creates an independent PIC record from certified source commander and rechecks Connection",{skip:!enabled},()=>{
  const shared=read("app/(protected)/flights/shared-actions.ts");
  const materialize=materializeSql(shared);
  const values:Record<string,unknown>={
    fingerprint:"pic-materialize-902-83",userId:83,
    "text(row.registration)":"OK-SP4","text(row.aircraft_type)":"B23","text(row.aircraft_make)":"Bristell","text(row.aircraft_model)":"B23","text(row.aircraft_variant)":"","text(row.icao_type)":"BR23","text(row.aircraft_class)":"SEP","text(row.regulatory_category)":"AEROPLANE","text(row.balloon_class)":"","text(row.balloon_group)":"","text(row.balloon_operation)":"","text(row.launch_method)":"","Number(row.launches)||0":0,"text(row.evidence)":"EASA",
    "row.price_per_hour===null?null:Number(row.price_per_hour)||0":3000,role:"PIC","text(row.billing_basis)||'BLOCK'":"BLOCK",
    "Number(row.source_flight_id)":902,"Number(row.source_user_id)":81,"Number(row.source_revision)":1,"text(row.source_hash)":"hash-sp4-r1","participantRole!==\"PIC\"":false,"picCommanderBasis!==\"CERTIFIED_SOURCE_COMMANDER\"":false,"picCommanderBasis!==\"RECIPIENT_ACCOUNT\"":true,
    "text(row.date)":"2026-09-20","text(row.departure)":"LKPR","text(row.arrival)":"LKBE","text(row.off_block)":"10:00","text(row.registration).toUpperCase()":"OK-SP4","text(row.departure).toUpperCase()":"LKPR","text(row.arrival).toUpperCase()":"LKBE",
    "participantRole===\"INSTRUCTOR\"":false,"text(row.takeoff)":"10:05","text(row.landing)":"11:05","text(row.on_block)":"11:12","Number(row.starts)||0":3,
    commander:"Linked Actual PIC",instructorName:"","text(row.task)":"","text(row.purpose_code)":"",
    "text(row.operation_type)||\"SP\"":"SP","text(row.engine_type)||\"SE\"":"SE","text(row.operator_name)":"FlyTally Training","text(row.flight_number)":"FT902","text(row.operation_context)":"PRIVATE","Number(row.landings_day)||0":3,"Number(row.landings_night)||0":0,"Boolean(row.movement_evidence_recorded)":false,"Number(row.takeoffs_day)||0":0,"Number(row.takeoffs_night)||0":0,"Number(row.approaches_day)||0":0,"Number(row.approaches_night)||0":0,"Number(row.night_minutes)||0":0,"Number(row.ifr_minutes)||0":0,
    "credit.pic":72,"credit.copilot":0,"credit.instructor":0,participationId:9002,recipientNote:""
  };

  const picFlightId=Number(run(renderMaterialize(materialize,values)));assert.ok(picFlightId>0);
  const pic=rows(`SELECT * FROM flights WHERE id=${picFlightId} AND user_id=83`)[0];
  assert.equal(String(pic.role),"PIC");
  assert.equal(String(pic.commander),"Linked Actual PIC");
  assert.equal(Number(pic.pic_minutes),72);
  assert.equal(Number(pic.copilot_minutes),0);
  assert.equal(Number(pic.instructor_minutes),0);
  assert.equal(String(rows("SELECT commander FROM flights WHERE id=902 AND user_id=81")[0].commander),"Linked Actual PIC");
  assert.equal(Number(rows("SELECT pic_minutes FROM flights WHERE id=902 AND user_id=81")[0].pic_minutes),0);
  assert.equal(Number(rows("SELECT participant_flight_id FROM flight_participations WHERE id=9002")[0].participant_flight_id),picFlightId);

  run(`UPDATE flight_participations SET participant_flight_id=NULL,status='accepted' WHERE id=9002`);
  const duplicateId=Number(run(renderMaterialize(materialize,values)));
  assert.equal(duplicateId,picFlightId);
  assert.equal(Number(rows("SELECT COUNT(*) count FROM flights WHERE user_id=83 AND registration='OK-SP4'")[0].count),1);

  run(`DELETE FROM flights WHERE id=${picFlightId} AND user_id=83`);
  run("UPDATE flight_participations SET participant_flight_id=NULL,status='pending' WHERE id=9002");
  run("UPDATE pilot_connections SET status='cancelled' WHERE requester_user_id=81 AND recipient_user_id=83");
  assert.equal(run(renderMaterialize(materialize,values)),"");
  assert.equal(Number(rows("SELECT COUNT(*) count FROM flights WHERE user_id=83 AND registration='OK-SP4'")[0].count),0);
  assert.equal(String(rows("SELECT status FROM flight_participations WHERE id=9002")[0].status),"pending");
});


test("generic PIC materialization from INSTRUCTOR source copies the complete event and uses recipient commander",{skip:!enabled},()=>{
  const shared=read("app/(protected)/flights/shared-actions.ts");
  const materialize=materializeSql(shared);
  const values:Record<string,unknown>={
    fingerprint:"generic-pic-903-84",userId:84,
    "text(row.registration)":"OK-GPIC","text(row.aircraft_type)":"B23","text(row.aircraft_make)":"Bristell","text(row.aircraft_model)":"B23","text(row.aircraft_variant)":"","text(row.icao_type)":"BR23","text(row.aircraft_class)":"SEP","text(row.regulatory_category)":"AEROPLANE","text(row.balloon_class)":"","text(row.balloon_group)":"","text(row.balloon_operation)":"","text(row.launch_method)":"","Number(row.launches)||0":0,"text(row.evidence)":"EASA",
    "row.price_per_hour===null?null:Number(row.price_per_hour)||0":3000,role:"PIC","text(row.billing_basis)||'BLOCK'":"BLOCK",
    "Number(row.source_flight_id)":903,"Number(row.source_user_id)":81,"Number(row.source_revision)":1,"text(row.source_hash)":"hash-gpic-r1","participantRole!==\"PIC\"":false,"picCommanderBasis!==\"CERTIFIED_SOURCE_COMMANDER\"":true,"picCommanderBasis!==\"RECIPIENT_ACCOUNT\"":false,
    "text(row.date)":"2026-09-21","text(row.departure)":"LKPR","text(row.arrival)":"LKTB","text(row.off_block)":"12:00","text(row.registration).toUpperCase()":"OK-GPIC","text(row.departure).toUpperCase()":"LKPR","text(row.arrival).toUpperCase()":"LKTB",
    "participantRole===\"INSTRUCTOR\"":false,"text(row.takeoff)":"12:08","text(row.landing)":"13:02","text(row.on_block)":"13:10","Number(row.starts)||0":2,
    commander:"Generic PIC Recipient",instructorName:"","text(row.task)":"Training detail","text(row.purpose_code)":"TRAINING",
    "text(row.operation_type)||\"SP\"":"SP","text(row.engine_type)||\"SE\"":"SE","text(row.operator_name)":"FlyTally Training","text(row.flight_number)":"FT903","text(row.operation_context)":"TRAINING",
    "Number(row.landings_day)||0":1,"Number(row.landings_night)||0":1,"Boolean(row.movement_evidence_recorded)":true,
    "Number(row.takeoffs_day)||0":1,"Number(row.takeoffs_night)||0":1,"Number(row.approaches_day)||0":2,"Number(row.approaches_night)||0":0,
    "Number(row.night_minutes)||0":25,"Number(row.ifr_minutes)||0":18,
    "credit.pic":70,"credit.copilot":0,"credit.instructor":0,participationId:9003,recipientNote:"Complete source note"
  };

  const picFlightId=Number(run(renderMaterialize(materialize,values)));assert.ok(picFlightId>0);
  const pic=rows(`SELECT * FROM flights WHERE id=${picFlightId} AND user_id=84`)[0];
  assert.equal(String(pic.role),"PIC");
  assert.equal(String(pic.commander),"Generic PIC Recipient");
  assert.equal(String(pic.note),"Complete source note");
  assert.equal(Number(pic.pic_minutes),70);
  assert.equal(Number(pic.instructor_minutes),0);
  assert.equal(Number(pic.dual_minutes),0);
  assert.equal(Number(pic.landings_day),1);
  assert.equal(Number(pic.landings_night),1);
  assert.equal(Boolean(pic.movement_evidence_recorded),true);
  assert.equal(Number(pic.takeoffs_day),1);
  assert.equal(Number(pic.takeoffs_night),1);
  assert.equal(Number(pic.approaches_day),2);
  assert.equal(Number(pic.night_minutes),25);
  assert.equal(Number(pic.ifr_minutes),18);
  assert.equal(String(pic.task),"Training detail");
  assert.equal(String(pic.purpose_code),"TRAINING");
  assert.equal(Number(rows(`SELECT COUNT(*) count FROM flight_tracks WHERE user_id=84 AND flight_id=${picFlightId}`)[0].count),1);
  assert.equal(String(rows("SELECT role FROM flights WHERE id=903 AND user_id=81")[0].role),"INSTRUCTOR");
  assert.equal(Number(rows("SELECT instructor_minutes FROM flights WHERE id=903 AND user_id=81")[0].instructor_minutes),70);
});
