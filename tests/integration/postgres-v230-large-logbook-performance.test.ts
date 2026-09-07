import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { after,before,test } from "node:test";

const enabled=process.env.FLYTALLY_POSTGRES_INTEGRATION==="1";
const databaseUrl=process.env.DATABASE_URL??"";
const root=path.resolve(import.meta.dirname,"../..");
const schema=`ft_v230_${randomUUID().replaceAll("-","")}`;
const quotedSchema=`"${schema}"`;
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");
const evidencePath=path.join(root,"flytally-v230-100k-scale-evidence.json");
const SCALE_USER=174;
const SOURCE_USER=176;
const SCALE_ROWS=100_000;
const AUXILIARY_ROWS=12_000;
const SAFETY_ROWS=4_000;
const DASHBOARD_ROWS=SCALE_ROWS-AUXILIARY_ROWS+SAFETY_ROWS;
const LOGGED_ROWS=SCALE_ROWS-AUXILIARY_ROWS;
const evidence:Record<string,unknown>={
  release:"v2.3-measurement-baseline",
  dataset:{
    mixedCategoryFlights:SCALE_ROWS,
    dashboardActivityFlights:DASHBOARD_ROWS,
    loggedFlights:LOGGED_ROWS,
    auxiliaryFlights:AUXILIARY_ROWS,
    pendingActions:4_500,
    archivedCertifiedRevisions:500,
    verificationHistoryRows:500,
    auditHistoryRows:5_000,
    categories:["AEROPLANE","SAILPLANE","HELICOPTER","BALLOON"],
  },
};

function rawPsql(statement:string){
  const result=spawnSync("psql",[databaseUrl,"-X","-v","ON_ERROR_STOP=1","-qAt","-c",statement],{
    encoding:"utf8",env:{...process.env,PGCONNECT_TIMEOUT:"5"},maxBuffer:64*1024*1024,
  });
  if(result.error)throw result.error;
  return result;
}
function run(statement:string){
  const result=rawPsql(`SET search_path TO ${quotedSchema};\n${statement}`);
  if(result.status!==0)throw new Error(`PostgreSQL v2.3 performance command failed:\n${result.stderr||result.stdout}`);
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
    assert.ok(Object.prototype.hasOwnProperty.call(values,key),`No v2.3 SQL test value for ${key}`);
    return literal(values[key]);
  });
  assert.doesNotMatch(rendered,/\$\{/);
  return rendered;
}
function explain(statement:string){
  const parsed=JSON.parse(run(`EXPLAIN (ANALYZE,BUFFERS,FORMAT JSON) ${statement}`)) as Array<Record<string,unknown>>;
  const top=parsed[0]??{};
  return{planningMs:Number(top["Planning Time"]??0),executionMs:Number(top["Execution Time"]??0),plan:top.Plan};
}
function recordMetric(name:string,result:{planningMs:number;executionMs:number;plan:unknown},limitMs:number){
  evidence[name]={planningMs:result.planningMs,executionMs:result.executionMs,limitMs};
  console.log(`V230 SCALE ${name}: execution=${result.executionMs.toFixed(3)}ms planning=${result.planningMs.toFixed(3)}ms limit=${limitMs}ms`);
  assert.ok(result.executionMs<limitMs,`${name} exceeded ${limitMs}ms on the controlled v2.3 dataset: ${result.executionMs}ms`);
}

before(()=>{
  if(!enabled)return;
  assert.ok(databaseUrl,"DATABASE_URL is required for PostgreSQL v2.3 performance tests");
  const setup=`
    CREATE SCHEMA ${quotedSchema};
    SET search_path TO ${quotedSchema};

    CREATE TABLE users(id BIGINT PRIMARY KEY,display_name TEXT NOT NULL DEFAULT '');
    CREATE TABLE user_settings(user_id BIGINT PRIMARY KEY,home_airport TEXT NOT NULL DEFAULT '');
    CREATE TABLE flights(
      id BIGSERIAL PRIMARY KEY,user_id BIGINT NOT NULL,date DATE,evidence TEXT NOT NULL DEFAULT '',registration TEXT NOT NULL DEFAULT '',aircraft_type TEXT NOT NULL DEFAULT '',aircraft_class TEXT NOT NULL DEFAULT '',regulatory_category TEXT NOT NULL DEFAULT '',
      aircraft_make TEXT NOT NULL DEFAULT '',aircraft_model TEXT NOT NULL DEFAULT '',aircraft_variant TEXT NOT NULL DEFAULT '',departure TEXT NOT NULL DEFAULT '',arrival TEXT NOT NULL DEFAULT '',off_block TEXT NOT NULL DEFAULT '',takeoff TEXT NOT NULL DEFAULT '',landing TEXT NOT NULL DEFAULT '',on_block TEXT NOT NULL DEFAULT '',
      starts INTEGER NOT NULL DEFAULT 0,commander TEXT NOT NULL DEFAULT '',instructor TEXT NOT NULL DEFAULT '',role TEXT NOT NULL DEFAULT '',task TEXT NOT NULL DEFAULT '',purpose_code TEXT NOT NULL DEFAULT '',note TEXT NOT NULL DEFAULT '',
      price_per_hour NUMERIC,billing_basis TEXT NOT NULL DEFAULT 'BLOCK',operation_type TEXT NOT NULL DEFAULT 'SP',engine_type TEXT NOT NULL DEFAULT 'SE',landings_day INTEGER NOT NULL DEFAULT 0,landings_night INTEGER NOT NULL DEFAULT 0,
      takeoffs_day INTEGER NOT NULL DEFAULT 0,takeoffs_night INTEGER NOT NULL DEFAULT 0,approaches_day INTEGER NOT NULL DEFAULT 0,approaches_night INTEGER NOT NULL DEFAULT 0,movement_evidence_recorded BOOLEAN NOT NULL DEFAULT FALSE,
      night_minutes INTEGER NOT NULL DEFAULT 0,ifr_minutes INTEGER NOT NULL DEFAULT 0,pic_minutes INTEGER NOT NULL DEFAULT 0,copilot_minutes INTEGER NOT NULL DEFAULT 0,dual_minutes INTEGER NOT NULL DEFAULT 0,instructor_minutes INTEGER NOT NULL DEFAULT 0,
      launch_method TEXT NOT NULL DEFAULT '',launches INTEGER NOT NULL DEFAULT 0,balloon_class TEXT NOT NULL DEFAULT '',balloon_group TEXT NOT NULL DEFAULT '',balloon_operation TEXT NOT NULL DEFAULT '',
      verification_name TEXT NOT NULL DEFAULT '',verification_reference TEXT NOT NULL DEFAULT '',certified_at TIMESTAMPTZ,certified_by_user_id BIGINT,certification_hash TEXT NOT NULL DEFAULT '',certification_version INTEGER NOT NULL DEFAULT 8,
      record_revision INTEGER NOT NULL DEFAULT 1,correction_reason TEXT NOT NULL DEFAULT '',locked_at TIMESTAMPTZ
    );
    CREATE TABLE flight_tracks(id BIGSERIAL PRIMARY KEY,user_id BIGINT NOT NULL,flight_id BIGINT NOT NULL,file_name TEXT NOT NULL DEFAULT '',distance_km NUMERIC NOT NULL DEFAULT 0);
    CREATE TABLE aircraft(id BIGSERIAL PRIMARY KEY,user_id BIGINT NOT NULL,registration TEXT NOT NULL,icao_type TEXT NOT NULL DEFAULT '');
    CREATE TABLE flight_participations(
      id BIGSERIAL PRIMARY KEY,source_flight_id BIGINT NOT NULL,source_user_id BIGINT NOT NULL,participant_user_id BIGINT NOT NULL,participant_role TEXT NOT NULL,
      source_revision INTEGER NOT NULL,source_hash TEXT NOT NULL DEFAULT '',status TEXT NOT NULL DEFAULT 'pending',participant_flight_id BIGINT,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE pilot_connections(
      id BIGSERIAL PRIMARY KEY,requester_user_id BIGINT NOT NULL,recipient_user_id BIGINT NOT NULL,relationship TEXT NOT NULL DEFAULT 'pilot',status TEXT NOT NULL,
      requester_label TEXT NOT NULL DEFAULT 'pilot',recipient_label TEXT NOT NULL DEFAULT 'pilot',created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE pilot_qualifications(
      id BIGSERIAL PRIMARY KEY,user_id BIGINT NOT NULL,requested_signer_user_id BIGINT,record_kind TEXT,record_active BOOLEAN,signature_status TEXT,verified_at TIMESTAMPTZ,
      verification_role TEXT,qualification_type TEXT,aircraft_make TEXT,aircraft_model TEXT,aircraft_variant TEXT,completed_on DATE,updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE instructor_flight_approvals(
      id BIGSERIAL PRIMARY KEY,flight_id BIGINT NOT NULL,student_user_id BIGINT NOT NULL,instructor_user_id BIGINT NOT NULL,status TEXT NOT NULL,
      record_revision INTEGER NOT NULL,flight_hash TEXT,requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),decided_at TIMESTAMPTZ,decision_note TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE flight_verifications(
      id BIGSERIAL PRIMARY KEY,flight_id BIGINT NOT NULL,flight_user_id BIGINT NOT NULL,signer_user_id BIGINT,verification_role TEXT NOT NULL,record_revision INTEGER NOT NULL,
      flight_hash TEXT NOT NULL,credential_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,payload_hash TEXT NOT NULL DEFAULT '',server_signature TEXT NOT NULL DEFAULT '',status TEXT NOT NULL DEFAULT 'signed',
      requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),signed_at TIMESTAMPTZ,declined_at TIMESTAMPTZ,cancelled_at TIMESTAMPTZ,revoked_at TIMESTAMPTZ,decision_note TEXT NOT NULL DEFAULT '',revocation_reason TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE flight_certified_revisions(
      id BIGSERIAL PRIMARY KEY,flight_id BIGINT NOT NULL,user_id BIGINT NOT NULL,revision_number INTEGER NOT NULL,snapshot_data JSONB NOT NULL,
      certification_hash TEXT NOT NULL,certification_version INTEGER NOT NULL,certified_at TIMESTAMPTZ NOT NULL,superseded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),superseded_by_user_id BIGINT NOT NULL,correction_reason TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE flight_audit_log(
      id BIGSERIAL PRIMARY KEY,flight_id BIGINT NOT NULL,user_id BIGINT NOT NULL,actor_user_id BIGINT,action TEXT NOT NULL,old_data JSONB,new_data JSONB,changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    INSERT INTO users(id,display_name) VALUES(${SCALE_USER},'V230 Scale Pilot'),(175,'V230 Signer'),(${SOURCE_USER},'V230 Source Pilot'),(177,'V230 Noise Pilot');
    INSERT INTO users(id,display_name) SELECT g,'Workflow Pilot '||g FROM generate_series(1000,2999) g;
    INSERT INTO user_settings(user_id,home_airport) SELECT id,'LKPR' FROM users;
    INSERT INTO aircraft(user_id,registration,icao_type)
      SELECT ${SCALE_USER},'OK-P'||LPAD(g::text,2,'0'),CASE WHEN g%4=0 THEN 'BR23' WHEN g%4=1 THEN 'ASW28' WHEN g%4=2 THEN 'R44' ELSE 'BALL' END FROM generate_series(1,40) g;

    INSERT INTO flights(
      user_id,date,evidence,registration,aircraft_type,aircraft_class,regulatory_category,aircraft_make,aircraft_model,departure,arrival,off_block,takeoff,landing,on_block,starts,commander,instructor,role,task,
      price_per_hour,billing_basis,operation_type,engine_type,landings_day,landings_night,takeoffs_day,takeoffs_night,approaches_day,approaches_night,movement_evidence_recorded,
      night_minutes,ifr_minutes,pic_minutes,copilot_minutes,dual_minutes,instructor_minutes,launch_method,launches,balloon_class,balloon_group,balloon_operation,certified_at,certification_hash,record_revision
    )
      SELECT ${SCALE_USER},DATE '1980-01-01'+(g%16500),'EASA',
        CASE WHEN g%4=3 AND g%11=0 THEN '' ELSE 'OK-P'||LPAD(((g%40)+1)::text,2,'0') END,
        CASE g%4 WHEN 0 THEN 'B23' WHEN 1 THEN 'ASW 28' WHEN 2 THEN 'R44 Raven II' ELSE 'Hot-air balloon' END,
        CASE g%4 WHEN 0 THEN 'SEP' WHEN 1 THEN 'GLIDER' WHEN 2 THEN 'HELICOPTER' ELSE 'BALLOON' END,
        CASE g%4 WHEN 0 THEN 'AEROPLANE' WHEN 1 THEN 'SAILPLANE' WHEN 2 THEN 'HELICOPTER' ELSE 'BALLOON' END,
        CASE g%4 WHEN 0 THEN 'Bristell' WHEN 1 THEN 'Alexander Schleicher' WHEN 2 THEN 'Robinson' ELSE '' END,
        CASE g%4 WHEN 0 THEN 'B23' WHEN 1 THEN 'ASW 28' WHEN 2 THEN 'R44' ELSE '' END,
        CASE WHEN g%4=3 THEN 'SITE-'||(g%25) ELSE 'LK'||LPAD((g%50)::text,2,'0') END,
        CASE WHEN g%4=3 THEN 'SITE-'||((g+7)%25) ELSE 'LK'||LPAD(((g+7)%50)::text,2,'0') END,
        '08:00','08:05','09:00','09:05',1,'V230 Scale Pilot',CASE WHEN g%17=0 THEN 'V230 Signer' ELSE '' END,
        CASE WHEN g%25=0 THEN 'PAX' WHEN g%25=1 THEN 'SAFETY PILOT' WHEN g%25=2 THEN 'OBSERVER' WHEN g%17=0 THEN 'DUAL' WHEN g%19=0 THEN 'INSTRUCTOR' ELSE 'PIC' END,
        'V230 mixed-category scale flight',3000,CASE WHEN g%4=3 THEN 'AIR' ELSE 'BLOCK' END,'SP',CASE WHEN g%4=3 THEN '' ELSE 'SE' END,
        1,CASE WHEN g%20=0 THEN 1 ELSE 0 END,1,CASE WHEN g%20=0 THEN 1 ELSE 0 END,CASE WHEN g%4=2 THEN 1 ELSE 0 END,0,g%4=2,
        CASE WHEN g%10=0 THEN 20 ELSE 0 END,CASE WHEN g%8=0 AND g%4 IN(0,2) THEN 30 ELSE 0 END,
        CASE WHEN g%25 IN(0,1,2) OR g%17=0 THEN 0 ELSE 65 END,0,CASE WHEN g%17=0 THEN 65 ELSE 0 END,CASE WHEN g%19=0 THEN 65 ELSE 0 END,
        CASE WHEN g%4=1 THEN CASE WHEN g%3=0 THEN 'WINCH' WHEN g%3=1 THEN 'AEROTOW' ELSE 'SELF' END ELSE '' END,CASE WHEN g%4=1 THEN 1 ELSE 0 END,
        CASE WHEN g%4=3 THEN 'HOT_AIR_BALLOON' ELSE '' END,CASE WHEN g%4=3 THEN CHR(65+(g%4)) ELSE '' END,CASE WHEN g%4=3 THEN CASE WHEN g%9=0 THEN 'TETHERED' ELSE 'FREE' END ELSE '' END,
        CASE WHEN g%13=0 THEN NOW() ELSE NULL END,CASE WHEN g%13=0 THEN 'v230-'||g ELSE '' END,1
      FROM generate_series(1,${SCALE_ROWS}) g;

    INSERT INTO flights(user_id,date,evidence,registration,aircraft_type,aircraft_class,regulatory_category,departure,arrival,off_block,takeoff,landing,on_block,starts,commander,role,landings_day,takeoffs_day,pic_minutes,certified_at,certification_hash,record_revision)
      SELECT 177,DATE '2000-01-01'+(g%9000),'EASA','N'||g,'Noise','SEP','AEROPLANE','KJFK','KBOS','10:00','10:05','11:00','11:05',1,'Noise Pilot','PIC',1,1,65,NOW(),'noise-'||g,1
      FROM generate_series(1,20_000) g;

    INSERT INTO flight_tracks(user_id,flight_id,file_name,distance_km)
      SELECT ${SCALE_USER},id,'v230-scale.kml',80+(id%40) FROM flights WHERE user_id=${SCALE_USER} AND id%5=0;

    INSERT INTO flights(user_id,date,evidence,registration,aircraft_type,aircraft_class,regulatory_category,departure,arrival,off_block,takeoff,landing,on_block,starts,commander,role,landings_day,takeoffs_day,pic_minutes,certified_at,certification_hash,record_revision)
      SELECT ${SOURCE_USER},CURRENT_DATE-(g%365),'EASA','OK-S'||g,'Source','SEP','AEROPLANE','LKPR','LKTB','08:00','08:05','09:00','09:05',1,'V230 Source Pilot','PIC',1,1,65,NOW(),'src-'||g,1
      FROM generate_series(1,2_000) g;

    INSERT INTO flight_participations(source_flight_id,source_user_id,participant_user_id,participant_role,source_revision,source_hash,status,created_at)
      SELECT id,${SOURCE_USER},${SCALE_USER},'CO-PILOT',1,certification_hash,'pending',NOW()-(id%1000)*INTERVAL '1 second' FROM flights WHERE user_id=${SOURCE_USER};
    INSERT INTO flight_participations(source_flight_id,source_user_id,participant_user_id,participant_role,source_revision,source_hash,status,created_at)
      SELECT id,${SOURCE_USER},${SCALE_USER},'INSTRUCTOR',1,certification_hash,'pending',NOW()-(id%1000)*INTERVAL '1 second' FROM flights WHERE user_id=${SOURCE_USER} ORDER BY id LIMIT 250;
    INSERT INTO flight_participations(source_flight_id,source_user_id,participant_user_id,participant_role,source_revision,source_hash,status,created_at)
      SELECT id,${SOURCE_USER},${SCALE_USER},'OBSERVER',2,'stale-hash','pending',NOW() FROM flights WHERE user_id=${SOURCE_USER} ORDER BY id LIMIT 500;

    INSERT INTO pilot_connections(requester_user_id,recipient_user_id,status,recipient_label,created_at)
      SELECT g,${SCALE_USER},'pending','friend',NOW()-(g%500)*INTERVAL '1 second' FROM generate_series(1000,1999) g;
    INSERT INTO pilot_connections(requester_user_id,recipient_user_id,status,recipient_label,created_at)
      SELECT g,${SCALE_USER},'accepted','instructor',NOW() FROM generate_series(2000,2999) g;
    INSERT INTO pilot_connections(requester_user_id,recipient_user_id,status,recipient_label,created_at)
      VALUES(${SOURCE_USER},${SCALE_USER},'accepted','instructor',NOW());

    INSERT INTO pilot_qualifications(user_id,requested_signer_user_id,record_kind,record_active,signature_status,verified_at,verification_role,qualification_type,aircraft_make,aircraft_model,completed_on,updated_at)
      SELECT g,${SCALE_USER},'aircraft_training',TRUE,'pending',NULL,'INSTRUCTOR','SEP differences','Bristell','B23',CURRENT_DATE,NOW()-(g%500)*INTERVAL '1 second' FROM generate_series(2000,2999) g;
    INSERT INTO pilot_qualifications(user_id,requested_signer_user_id,record_kind,record_active,signature_status,verified_at,verification_role,qualification_type,completed_on)
      SELECT g,${SCALE_USER},'aircraft_training',TRUE,'pending',NULL,'INSTRUCTOR','Disconnected training',CURRENT_DATE FROM generate_series(3000,3999) g;

    INSERT INTO instructor_flight_approvals(flight_id,student_user_id,instructor_user_id,status,record_revision,flight_hash,requested_at)
      SELECT id,${SOURCE_USER},${SCALE_USER},'pending',1,certification_hash,NOW()-(id%500)*INTERVAL '1 second' FROM flights WHERE user_id=${SOURCE_USER} ORDER BY id LIMIT 500;

    UPDATE flights SET certified_at=NOW(),certification_hash='deep-current',record_revision=501,certification_version=8 WHERE id=1 AND user_id=${SCALE_USER};
    INSERT INTO flight_certified_revisions(flight_id,user_id,revision_number,snapshot_data,certification_hash,certification_version,certified_at,superseded_at,superseded_by_user_id,correction_reason)
      SELECT 1,${SCALE_USER},g,jsonb_build_object('id',1,'user_id',${SCALE_USER},'record_revision',g,'registration','OK-P02'),'deep-'||g,8,NOW()-g*INTERVAL '2 days',NOW()-g*INTERVAL '1 day',${SCALE_USER},'Scale correction '||g FROM generate_series(1,500) g;
    INSERT INTO instructor_flight_approvals(flight_id,student_user_id,instructor_user_id,status,record_revision,flight_hash,requested_at,decided_at,decision_note)
      SELECT 1,${SCALE_USER},175,'approved',g,'deep-'||g,NOW()-g*INTERVAL '2 days',NOW()-g*INTERVAL '1 day','Approved' FROM generate_series(1,500) g;
    INSERT INTO flight_verifications(flight_id,flight_user_id,signer_user_id,verification_role,record_revision,flight_hash,credential_snapshot,payload_hash,server_signature,status,requested_at,signed_at)
      SELECT 1,${SCALE_USER},175,'INSTRUCTOR',g,'deep-'||g,'{"identity":"V230 Signer"}'::jsonb,'payload-'||g,'sig-'||g,'signed',NOW()-g*INTERVAL '2 days',NOW()-g*INTERVAL '1 day' FROM generate_series(1,500) g;
    INSERT INTO flight_audit_log(flight_id,user_id,actor_user_id,action,old_data,new_data,changed_at)
      SELECT 1,${SCALE_USER},${SCALE_USER},'updated',jsonb_build_object('revision',g-1),jsonb_build_object('revision',g),NOW()-g*INTERVAL '1 minute' FROM generate_series(1,5_000) g;

    CREATE INDEX idx_logbook_flights_user_date ON flights(user_id,date DESC,id DESC);
    CREATE INDEX idx_logbook_flights_user_registration ON flights(user_id,registration);
    CREATE INDEX idx_logbook_flights_user_easa ON flights(user_id,evidence,date DESC);
    CREATE INDEX idx_logbook_flights_user_route ON flights(user_id,departure,arrival,date DESC);
    CREATE INDEX idx_flights_user_regulatory_category_date ON flights(user_id,regulatory_category,date DESC,id DESC);
    CREATE INDEX idx_logbook_tracks_user_flight ON flight_tracks(user_id,flight_id);
    CREATE INDEX idx_flight_participations_recipient_status ON flight_participations(participant_user_id,status,created_at DESC);
    CREATE INDEX idx_flight_participations_source ON flight_participations(source_user_id,source_flight_id,source_revision DESC);
    CREATE INDEX idx_pilot_connections_recipient_status ON pilot_connections(recipient_user_id,status,created_at DESC);
    CREATE INDEX idx_pilot_connections_requester_status ON pilot_connections(requester_user_id,status,created_at DESC);
    CREATE INDEX idx_v145_aircraft_training_signer_pending ON pilot_qualifications(requested_signer_user_id,signature_status,id) WHERE record_kind='aircraft_training' AND record_active IS TRUE;
    CREATE INDEX idx_instructor_approvals_instructor_status ON instructor_flight_approvals(instructor_user_id,status,requested_at DESC);
    CREATE INDEX idx_instructor_approvals_student_flight ON instructor_flight_approvals(student_user_id,flight_id,record_revision DESC);
    CREATE INDEX idx_flight_verifications_flight_revision ON flight_verifications(flight_user_id,flight_id,record_revision DESC);
    CREATE INDEX idx_logbook_certified_revisions_user_flight ON flight_certified_revisions(user_id,flight_id,revision_number DESC);
    CREATE INDEX idx_logbook_flight_audit_user_flight ON flight_audit_log(user_id,flight_id,changed_at DESC,id DESC);
    ANALYZE;
  `;
  const result=rawPsql(setup);
  if(result.status!==0)throw new Error(`PostgreSQL v2.3 scale schema setup failed:\n${result.stderr||result.stdout}`);
});

after(()=>{
  if(!enabled)return;
  fs.writeFileSync(evidencePath,JSON.stringify(evidence,null,2)+"\n");
  rawPsql(`DROP SCHEMA IF EXISTS ${quotedSchema} CASCADE`);
});

test("v2.3 100k fixture preserves mixed-category and auxiliary-role semantics",{skip:!enabled},()=>{
  const counts=rows(`SELECT regulatory_category,COUNT(*)::int flights FROM flights WHERE user_id=${SCALE_USER} GROUP BY regulatory_category ORDER BY regulatory_category`);
  assert.deepEqual(counts.map(row=>[row.regulatory_category,Number(row.flights)]),[["AEROPLANE",25_000],["BALLOON",25_000],["HELICOPTER",25_000],["SAILPLANE",25_000]]);
  assert.equal(Number(run(`SELECT COUNT(*) FROM flights WHERE user_id=${SCALE_USER} AND role IN('PAX','SAFETY PILOT','OBSERVER')`)),AUXILIARY_ROWS);
});

test("v2.3 global production reads remain bounded on 100k flights",{skip:!enabled},()=>{
  const dashboardQuery=render(sqlBlock(read("lib/data/dashboard.ts"),"WITH track AS MATERIALIZED("),{userId:SCALE_USER,start:null,end:null});
  const dashboardResult=explain(dashboardQuery);recordMetric("dashboardAllTime100k",dashboardResult,7_000);
  const dashboardRow=rows(dashboardQuery)[0]??{};
  assert.equal(Number(dashboardRow.total_flights),DASHBOARD_ROWS);
  assert.equal(Number(dashboardRow.safety_minutes),SAFETY_ROWS*65);

  const listQuery=render(sqlBlock(read("lib/data/flights-fast.ts"),"track AS MATERIALIZED(SELECT flight_id,COUNT(*)::int track_count"),{
    userId:SCALE_USER,q:null,e:null,r:null,reg:null,from:null,to:null,c:null,a:null,route:null,rf:null,rt:null,y:null,g:null,status:null,workflow:null,category:null,sort:"newest",size:50,offset:0,
  });
  const listResult=explain(listQuery);recordMetric("flightListFirstPage100k",listResult,4_500);
  const listRows=rows(listQuery);assert.equal(listRows.length,50);assert.equal(Number(listRows[0].total_count),SCALE_ROWS);

  const insightsQuery=render(sqlBlock(read("lib/data/pilot-insights.ts"),"WITH base0 AS MATERIALIZED("),{
    userId:SCALE_USER,"bounds.start":null,"bounds.end":null,scopeCategory:null,
    "rolling.currentStart":"2025-09-07","rolling.currentEnd":"2026-09-06","rolling.previousStart":"2024-09-07","rolling.previousEnd":"2025-09-06",
  });
  const insightsResult=explain(insightsQuery);recordMetric("pilotInsights100k",insightsResult,7_000);
  const insight=rows(insightsQuery)[0]??{};assert.equal(Number(insight.flights),LOGGED_ROWS);
});

test("v2.3 print and export production SQL remain bounded on a complete 100k logbook",{skip:!enabled},()=>{
  const printBlock=sqlBlock(read("app/(protected)/print/page.tsx"),"SELECT f.date,f.evidence,f.regulatory_category,f.registration,f.aircraft_type");
  const printQuery=render(printBlock,{userId:SCALE_USER,scope:"all",from:null,to:null,includeAuxiliary:false});
  const printResult=explain(printQuery);recordMetric("printCompleteSql100k",printResult,8_000);
  assert.equal(Number(run(`SELECT COUNT(*) FROM (${printQuery}) q`)),LOGGED_ROWS);

  const exportBlock=sqlBlock(read("app/api/export/route.ts"),"SELECT flight_id,COUNT(*)::int track_count");
  const exportQuery=render(exportBlock,{"session.userId":SCALE_USER,scope:"all",category:"all",from:null,to:null,registration:null,auxiliary:"exclude"});
  const exportResult=explain(exportQuery);recordMetric("exportCompleteSql100k",exportResult,9_000);
  assert.equal(Number(run(`SELECT COUNT(*) FROM (${exportQuery}) q`)),LOGGED_ROWS);
});

test("v2.3 Action Center count and inbox reads stay bounded with thousands of workflow decisions",{skip:!enabled},()=>{
  const source=read("lib/pending-actions.ts");
  const countQuery=render(sqlBlock(source,"(SELECT COUNT(*) FROM flight_participations p JOIN flights f"),{userId:SCALE_USER});
  const countResult=explain(countQuery);recordMetric("pendingActionCount4500",countResult,1_500);
  assert.equal(Number(run(countQuery)),4_500);

  const shared=render(sqlBlock(source,"SELECT p.id,p.participant_role,p.created_at::text created_at"),{userId:SCALE_USER});
  const connections=render(sqlBlock(source,"SELECT c.id,c.created_at::text created_at,c.recipient_label"),{userId:SCALE_USER});
  const training=render(sqlBlock(source,"SELECT q.id,q.updated_at::text created_at,q.verification_role"),{userId:SCALE_USER});
  const legacy=render(sqlBlock(source,"SELECT a.id,a.requested_at::text created_at,f.date::text date"),{userId:SCALE_USER});
  for(const [name,query,expected] of [["pendingSharedList2250",shared,2250],["pendingConnectionList1000",connections,1000],["pendingTrainingList1000",training,1000],["pendingLegacyList250",legacy,250]] as const){
    const result=explain(query);recordMetric(name,result,1_500);assert.equal(Number(run(`SELECT COUNT(*) FROM (${query}) q`)),expected);
  }
});

test("v2.3 certified history reads stay bounded on a deep correction/signature chain",{skip:!enabled},()=>{
  const page=read("app/(protected)/flights/[id]/audit/page.tsx");
  const current=render(sqlBlock(page,"SELECT f.*,u.display_name pilot_name"),{id:1,userId:SCALE_USER});
  const revisions=render(sqlBlock(page,"SELECT revision_number,certification_hash,certification_version"),{id:1,userId:SCALE_USER});
  const approvals=render(sqlBlock(page,"SELECT a.record_revision,a.status,a.requested_at"),{id:1,userId:SCALE_USER});
  const verifications=render(sqlBlock(page,"SELECT v.*,u.display_name signer_name"),{id:1,userId:SCALE_USER});
  for(const [name,query,expected] of [["auditCurrentFlight",current,1],["auditArchivedRevisions500",revisions,500],["auditApprovals500",approvals,500],["auditVerifications500",verifications,500]] as const){
    const result=explain(query);recordMetric(name,result,1_000);assert.equal(Number(run(`SELECT COUNT(*) FROM (${query}) q`)),expected);
  }

  const auditQuery=render(sqlBlock(read("lib/data/flight-audit.ts"),"SELECT a.id,a.flight_id,a.action"),{userId:SCALE_USER,flightId:1});
  const auditResult=explain(auditQuery);recordMetric("flightAuditLatest100Of5000",auditResult,1_000);
  assert.equal(Number(run(`SELECT COUNT(*) FROM (${auditQuery}) q`)),100);
});
