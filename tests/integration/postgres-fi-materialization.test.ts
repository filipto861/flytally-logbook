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
  const result=spawnSync("psql",[databaseUrl,"-X","-v","ON_ERROR_STOP=1","-qAt","-c",statement],{encoding:"utf8",env:{...process.env,PGCONNECT_TIMEOUT:"5"}});
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
function sqlBlock(source:string,needle:string,which:"first"|"last"="first"){
  const blocks=[...source.matchAll(/sql`([\s\S]*?)`/g)].map(match=>match[1]).filter(value=>value.includes(needle));
  const block=which==="last"?blocks.at(-1):blocks[0];
  assert.ok(block,`Production SQL block not found: ${needle}`);
  return block;
}
function literal(value:unknown){
  if(value===null||value===undefined)return"NULL";
  if(typeof value==="number")return Number.isFinite(value)?String(value):"NULL";
  if(typeof value==="boolean")return value?"TRUE":"FALSE";
  return`'${String(value).replaceAll("'","''")}'`;
}
function render(block:string,values:Record<string,unknown>){
  const rendered=block.replace(/\$\{([^}]+)\}/g,(_all,expression)=>{
    const key=String(expression).trim();
    assert.ok(Object.prototype.hasOwnProperty.call(values,key),`No FI SQL test value for ${key}`);
    return literal(values[key]);
  });
  assert.doesNotMatch(rendered,/\$\{/);
  return rendered;
}
function renderMaterialize(block:string,values:Record<string,unknown>){
  const nested=/\$\{instructor\?`FI entry linked to \$\{text\(row[.]source_name\)\}'s verified training flight`:`Shared flight with \$\{text\(row[.]source_name\)\}`\}/;
  const normalized=block.replace(nested,literal(values.materializeNote));
  assert.notEqual(normalized,block,"Expected instructor materialisation note interpolation");
  return render(normalized,values);
}
function productionSqlBlock(source:string,needle:string,which:"first"|"last"="first"){
  const block=sqlBlock(source,needle,which);
  assert.doesNotMatch(block,/\$\{/ ,`Acceptance DDL contains unresolved interpolation: ${needle}`);
  return block;
}

before(()=>{
  if(!enabled)return;
  assert.ok(databaseUrl,"DATABASE_URL is required for PostgreSQL FI materialisation acceptance tests");
  const dbSource=read("lib/db-optimization.ts");
  const participationTable=productionSqlBlock(dbSource,"CREATE TABLE IF NOT EXISTS flight_participations");
  const verificationTable=productionSqlBlock(dbSource,"CREATE TABLE IF NOT EXISTS flight_verifications");
  const setup=`
    CREATE SCHEMA ${quotedSchema};
    SET search_path TO ${quotedSchema};
    CREATE TABLE users(id BIGINT PRIMARY KEY,email TEXT NOT NULL DEFAULT '',display_name TEXT NOT NULL DEFAULT '');
    CREATE TABLE flights(
      id BIGINT PRIMARY KEY,user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,date DATE,evidence TEXT NOT NULL DEFAULT '',registration TEXT NOT NULL DEFAULT '',
      aircraft_type TEXT NOT NULL DEFAULT '',aircraft_class TEXT NOT NULL DEFAULT '',aircraft_make TEXT NOT NULL DEFAULT '',aircraft_model TEXT NOT NULL DEFAULT '',aircraft_variant TEXT NOT NULL DEFAULT '',
      departure TEXT NOT NULL DEFAULT '',arrival TEXT NOT NULL DEFAULT '',off_block TEXT NOT NULL DEFAULT '',takeoff TEXT NOT NULL DEFAULT '',landing TEXT NOT NULL DEFAULT '',on_block TEXT NOT NULL DEFAULT '',
      starts INTEGER NOT NULL DEFAULT 0,commander TEXT NOT NULL DEFAULT '',instructor TEXT NOT NULL DEFAULT '',role TEXT NOT NULL DEFAULT '',task TEXT NOT NULL DEFAULT '',purpose_code TEXT NOT NULL DEFAULT '',
      price_per_hour NUMERIC,billing_basis TEXT NOT NULL DEFAULT 'BLOCK',note TEXT NOT NULL DEFAULT '',operation_type TEXT NOT NULL DEFAULT 'SP',engine_type TEXT NOT NULL DEFAULT 'SE',
      landings_day INTEGER NOT NULL DEFAULT 0,landings_night INTEGER NOT NULL DEFAULT 0,night_minutes INTEGER NOT NULL DEFAULT 0,ifr_minutes INTEGER NOT NULL DEFAULT 0,
      pic_minutes INTEGER NOT NULL DEFAULT 0,copilot_minutes INTEGER NOT NULL DEFAULT 0,dual_minutes INTEGER NOT NULL DEFAULT 0,instructor_minutes INTEGER NOT NULL DEFAULT 0,
      verification_name TEXT NOT NULL DEFAULT '',verification_reference TEXT NOT NULL DEFAULT '',certified_at TIMESTAMPTZ,certification_hash TEXT NOT NULL DEFAULT '',record_revision INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE aircraft(
      id BIGSERIAL PRIMARY KEY,user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,registration TEXT NOT NULL,aircraft_type TEXT NOT NULL DEFAULT '',aircraft_make TEXT NOT NULL DEFAULT '',
      aircraft_model TEXT NOT NULL DEFAULT '',aircraft_variant TEXT NOT NULL DEFAULT '',icao_type TEXT NOT NULL DEFAULT '',aircraft_class TEXT NOT NULL DEFAULT '',evidence TEXT NOT NULL DEFAULT '',
      default_price_per_hour NUMERIC,default_role TEXT NOT NULL DEFAULT '',billing_basis TEXT NOT NULL DEFAULT 'BLOCK',active INTEGER NOT NULL DEFAULT 1,note TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),UNIQUE(user_id,registration)
    );
    CREATE TABLE flight_tracks(
      id BIGSERIAL PRIMARY KEY,user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,flight_id BIGINT NOT NULL REFERENCES flights(id) ON DELETE CASCADE,file_name TEXT NOT NULL DEFAULT '',
      imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),point_count INTEGER NOT NULL DEFAULT 0,distance_km NUMERIC NOT NULL DEFAULT 0,start_utc TIMESTAMPTZ,end_utc TIMESTAMPTZ,min_alt_m NUMERIC,max_alt_m NUMERIC,
      coordinates_json TEXT NOT NULL DEFAULT '[]',overview_coordinates_json TEXT NOT NULL DEFAULT '[]',overview_version INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE instructor_flight_approvals(
      id BIGINT PRIMARY KEY,flight_id BIGINT NOT NULL REFERENCES flights(id) ON DELETE CASCADE,student_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      instructor_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,record_revision INTEGER NOT NULL,flight_hash TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'pending',
      decided_at TIMESTAMPTZ,decision_note TEXT NOT NULL DEFAULT ''
    );
    ${participationTable};
    ALTER TABLE flight_participations ADD COLUMN IF NOT EXISTS decision_note TEXT NOT NULL DEFAULT '';
    ALTER TABLE flight_participations ADD COLUMN IF NOT EXISTS approval_id BIGINT;
    ALTER TABLE flight_participations ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;
    ALTER TABLE flight_participations ADD COLUMN IF NOT EXISTS superseded_at TIMESTAMPTZ;
    ${verificationTable};
    INSERT INTO users(id,email,display_name) VALUES(81,'student@example.test','Test Student'),(82,'fi@example.test','Test Instructor');
    INSERT INTO flights(id,user_id,date,evidence,registration,aircraft_type,aircraft_class,aircraft_make,aircraft_model,departure,arrival,off_block,takeoff,landing,on_block,starts,commander,instructor,role,task,purpose_code,price_per_hour,billing_basis,note,operation_type,engine_type,landings_day,landings_night,dual_minutes,certified_at,certification_hash,record_revision)
      VALUES(901,81,'2026-08-28','EASA','OK-FI1','B23','SEP','Bristell','B23','LKPR','LKBE','08:00','08:05','09:00','09:05',1,'Test Instructor','Test Instructor','DUAL','FCL.140.A refresher training','LAPL_FCL140A_REFRESHER',3000,'BLOCK','','SP','SE',1,0,65,NOW(),'hash-r1',1);
    INSERT INTO aircraft(user_id,registration,aircraft_type,aircraft_make,aircraft_model,icao_type,aircraft_class,evidence,default_price_per_hour,default_role,billing_basis)
      VALUES(81,'OK-FI1','B23','Bristell','B23','BR23','SEP','EASA',3000,'DUAL','BLOCK');
    INSERT INTO flight_tracks(user_id,flight_id,file_name,point_count,distance_km,start_utc,end_utc,coordinates_json,overview_coordinates_json,overview_version)
      VALUES(81,901,'source.kml',120,42.5,'2026-08-28T08:00:00Z','2026-08-28T09:05:00Z','[{"lat":50.1,"lon":14.3}]','[{"lat":50.1,"lon":14.3}]',1);
    INSERT INTO instructor_flight_approvals(id,flight_id,student_user_id,instructor_user_id,record_revision,flight_hash,status) VALUES(9101,901,81,82,1,'hash-r1','pending');
    INSERT INTO flight_participations(id,source_flight_id,source_user_id,participant_user_id,participant_role,source_revision,source_hash,status,approval_id,decision_note)
      VALUES(9001,901,81,82,'INSTRUCTOR',1,'hash-r1','pending',9101,'');
  `;
  const result=rawPsql(setup);
  if(result.status!==0)throw new Error(`PostgreSQL FI materialisation schema setup failed:\n${result.stderr||result.stdout}`);
});

after(()=>{if(enabled)rawPsql(`DROP SCHEMA IF EXISTS ${quotedSchema} CASCADE`)});

test("AC-11 sign and add FI entry creates a separate instructor-owned record without changing the student source",{skip:!enabled},()=>{
  process.env.SIGNING_SECRET=process.env.SIGNING_SECRET||"flytally-ci-signing-secret-with-enough-entropy";
  const shared=read("app/(protected)/flights/shared-actions.ts");
  const credentialSnapshot={identity:"Test Instructor",source:"FlyTally account",licences:[{licence_type:"LAPL(A)",licence_number:"CZ.FCL.TEST"}],qualifications:[{qualification_type:"FI(A)",certificate_reference:"FI-TEST"}]};
  const payload={flightId:901,flightUserId:81,signerUserId:82,recordRevision:1,flightHash:"hash-r1",verificationRole:"INSTRUCTOR",credentialSnapshot};
  const signature=signVerificationPayload(payload),note="Reviewed and signed";
  const signInsert=sqlBlock(shared,"INSERT INTO flight_verifications(flight_id,flight_user_id,signer_user_id,verification_role,record_revision,flight_hash");
  const signParticipation=sqlBlock(shared,"UPDATE flight_participations SET status='accepted',responded_at=NOW(),decision_note=");
  const signApproval=sqlBlock(shared,"UPDATE instructor_flight_approvals SET status='approved',decided_at=NOW(),decision_note=");
  run(render(signInsert,{"payload.flightId":901,"payload.flightUserId":81,"session.userId":82,verificationRole:"INSTRUCTOR","payload.recordRevision":1,"payload.flightHash":"hash-r1","JSON.stringify(credentialSnapshot)":JSON.stringify(credentialSnapshot),signature,note}));
  run(render(signParticipation,{note,participationId:9001,"session.userId":82}));
  run(render(signApproval,{note,"Number(row.approval_id)||0":9101,"payload.flightId":901,"session.userId":82,"payload.recordRevision":1}));
  const signed=rows("SELECT * FROM flight_verifications WHERE flight_id=901 AND signer_user_id=82 AND record_revision=1")[0];
  assert.equal(verificationCryptographicStatus(signed),"verified");

  const materialize=sqlBlock(shared,"WITH locked AS MATERIALIZED(SELECT pg_advisory_xact_lock");
  const values:Record<string,unknown>={
    fingerprint:"fi-materialize-901-82",userId:82,
    "text(row.registration)":"OK-FI1","text(row.aircraft_type)":"B23","text(row.aircraft_make)":"Bristell","text(row.aircraft_model)":"B23","text(row.aircraft_variant)":"","text(row.icao_type)":"BR23","text(row.aircraft_class)":"SEP","text(row.evidence)":"EASA",
    "row.price_per_hour===null?null:Number(row.price_per_hour)||0":3000,role:"FI","text(row.billing_basis)||'BLOCK'":"BLOCK",
    "Number(row.source_flight_id)":901,"Number(row.source_user_id)":81,"Number(row.source_revision)":1,"text(row.source_hash)":"hash-r1",
    "text(row.date)":"2026-08-28","text(row.off_block)":"08:00","text(row.registration).toUpperCase()":"OK-FI1","text(row.departure).toUpperCase()":"LKPR","text(row.arrival).toUpperCase()":"LKBE",
    "participantRole===\"INSTRUCTOR\"":true,"text(row.takeoff)":"08:05","text(row.landing)":"09:00","text(row.on_block)":"09:05","Number(row.starts)||0":1,
    commander:"Test Instructor",instructorName:"","text(row.task)":"FCL.140.A refresher training","text(row.purpose_code)":"LAPL_FCL140A_REFRESHER",
    "text(row.operation_type)||\"SP\"":"SP","text(row.engine_type)||\"SE\"":"SE","Number(row.landings_day)||0":1,"Number(row.landings_night)||0":0,"Number(row.night_minutes)||0":0,"Number(row.ifr_minutes)||0":0,
    "credit.pic":65,"credit.copilot":0,"credit.instructor":65,participationId:9001,materializeNote:"FI entry linked to Test Student's verified training flight"
  };
  const linked=rows(renderMaterialize(materialize,values))[0];
  const fiFlightId=Number(linked.participant_flight_id);
  assert.ok(fiFlightId>0);
  const fi=rows(`SELECT * FROM flights WHERE id=${fiFlightId} AND user_id=82`)[0];
  assert.equal(String(fi.role),"FI");
  assert.equal(String(fi.commander),"Test Instructor");
  assert.equal(Number(fi.pic_minutes),65);
  assert.equal(Number(fi.instructor_minutes),65);
  assert.equal(Number(fi.dual_minutes),0);
  assert.equal(String(fi.note),"FI entry linked to Test Student's verified training flight");
  assert.equal(Number(rows(`SELECT COUNT(*) count FROM flight_tracks WHERE user_id=82 AND flight_id=${fiFlightId}`)[0].count),1);
  assert.equal(String(rows("SELECT certification_hash FROM flights WHERE id=901 AND user_id=81")[0].certification_hash),"hash-r1");

  run(`DELETE FROM flights WHERE id=${fiFlightId} AND user_id=82`);
  const participation=rows("SELECT participant_flight_id,status FROM flight_participations WHERE id=9001")[0];
  assert.equal(participation.participant_flight_id,null,"Deleting the instructor copy must clear only the linked copy reference");
  assert.equal(String(participation.status),"accepted");
  assert.equal(Number(rows("SELECT COUNT(*) count FROM flights WHERE id=901 AND user_id=81 AND certified_at IS NOT NULL AND certification_hash='hash-r1'")[0].count),1);
  assert.equal(Number(rows("SELECT COUNT(*) count FROM flight_verifications WHERE flight_id=901 AND flight_user_id=81 AND signer_user_id=82 AND status='signed'")[0].count),1);
});
