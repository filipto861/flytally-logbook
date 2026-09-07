import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { after,before,test } from "node:test";

const enabled=process.env.FLYTALLY_POSTGRES_INTEGRATION==="1";
const databaseUrl=process.env.DATABASE_URL??"";
const root=path.resolve(import.meta.dirname,"../..");
const schema=`ft_v169_${randomUUID().replaceAll("-","")}`;
const quotedSchema=`"${schema}"`;
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");
const evidencePath=path.join(root,"flytally-v169-scale-evidence.json");
const SCALE_USER=74;
const SCALE_ROWS=50_000;
const AUXILIARY_ROWS=6_000;
const SAFETY_ROWS=2_000;
const DASHBOARD_ROWS=SCALE_ROWS-AUXILIARY_ROWS+SAFETY_ROWS;
const LOGGED_ROWS=SCALE_ROWS-AUXILIARY_ROWS;
const evidence:Record<string,unknown>={release:"v1.69-candidate",dataset:{mixedCategoryFlights:SCALE_ROWS,dashboardActivityFlights:DASHBOARD_ROWS,loggedFlights:LOGGED_ROWS,auxiliaryFlights:AUXILIARY_ROWS,categories:["AEROPLANE","SAILPLANE","HELICOPTER","BALLOON"]}};

function rawPsql(statement:string){
  const result=spawnSync("psql",[databaseUrl,"-X","-v","ON_ERROR_STOP=1","-qAt","-c",statement],{encoding:"utf8",env:{...process.env,PGCONNECT_TIMEOUT:"5"},maxBuffer:32*1024*1024});
  if(result.error)throw result.error;
  return result;
}
function run(statement:string){
  const result=rawPsql(`SET search_path TO ${quotedSchema};\n${statement}`);
  if(result.status!==0)throw new Error(`PostgreSQL v1.69 hardening command failed:\n${result.stderr||result.stdout}`);
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
    assert.ok(Object.prototype.hasOwnProperty.call(values,key),`No v1.69 SQL test value for ${key}`);
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
  console.log(`V169 SCALE ${name}: execution=${result.executionMs.toFixed(3)}ms planning=${result.planningMs.toFixed(3)}ms limit=${limitMs}ms`);
  assert.ok(result.executionMs<limitMs,`${name} exceeded ${limitMs}ms on the controlled 50k mixed-category account: ${result.executionMs}ms`);
}
function jsonArray(value:unknown){
  if(Array.isArray(value))return value as Array<Record<string,unknown>>;
  if(typeof value==="string")return JSON.parse(value) as Array<Record<string,unknown>>;
  return[];
}

before(()=>{
  if(!enabled)return;
  assert.ok(databaseUrl,"DATABASE_URL is required for PostgreSQL v1.69 hardening tests");
  const dbSource=read("lib/db-optimization.ts");
  const v162=read("lib/v162-schema.ts");
  const v164=read("lib/v164-schema.ts");
  const indexes=[
    sqlBlock(dbSource,"CREATE INDEX IF NOT EXISTS idx_logbook_flights_user_date"),
    sqlBlock(dbSource,"CREATE INDEX IF NOT EXISTS idx_logbook_flights_user_registration"),
    sqlBlock(dbSource,"CREATE INDEX IF NOT EXISTS idx_logbook_tracks_user_flight"),
    sqlBlock(dbSource,"CREATE INDEX IF NOT EXISTS idx_logbook_flights_user_easa"),
    sqlBlock(dbSource,"CREATE INDEX IF NOT EXISTS idx_flight_verifications_flight_revision"),
    sqlBlock(dbSource,"CREATE INDEX IF NOT EXISTS idx_flight_participations_recipient_status"),
    sqlBlock(dbSource,"CREATE INDEX IF NOT EXISTS idx_flight_participations_source"),
    sqlBlock(v162,"CREATE INDEX IF NOT EXISTS idx_flights_user_regulatory_category_date"),
    sqlBlock(v164,"CREATE INDEX IF NOT EXISTS idx_flights_user_balloon_context_date"),
    sqlBlock(v164,"CREATE INDEX IF NOT EXISTS idx_flights_user_balloon_operation_date"),
  ];
  const setup=`
    CREATE SCHEMA ${quotedSchema};
    SET search_path TO ${quotedSchema};
    CREATE TABLE users(id BIGINT PRIMARY KEY,display_name TEXT NOT NULL DEFAULT '');
    CREATE TABLE flights(
      id BIGSERIAL PRIMARY KEY,user_id BIGINT NOT NULL,date DATE,evidence TEXT NOT NULL DEFAULT '',registration TEXT NOT NULL DEFAULT '',aircraft_type TEXT NOT NULL DEFAULT '',aircraft_class TEXT NOT NULL DEFAULT '',regulatory_category TEXT NOT NULL DEFAULT '',
      aircraft_make TEXT NOT NULL DEFAULT '',aircraft_model TEXT NOT NULL DEFAULT '',aircraft_variant TEXT NOT NULL DEFAULT '',departure TEXT NOT NULL DEFAULT '',arrival TEXT NOT NULL DEFAULT '',off_block TEXT NOT NULL DEFAULT '',takeoff TEXT NOT NULL DEFAULT '',landing TEXT NOT NULL DEFAULT '',on_block TEXT NOT NULL DEFAULT '',
      starts INTEGER NOT NULL DEFAULT 0,commander TEXT NOT NULL DEFAULT '',instructor TEXT NOT NULL DEFAULT '',role TEXT NOT NULL DEFAULT '',task TEXT NOT NULL DEFAULT '',purpose_code TEXT NOT NULL DEFAULT '',note TEXT NOT NULL DEFAULT '',
      price_per_hour NUMERIC,billing_basis TEXT NOT NULL DEFAULT 'BLOCK',operation_type TEXT NOT NULL DEFAULT 'SP',engine_type TEXT NOT NULL DEFAULT 'SE',landings_day INTEGER NOT NULL DEFAULT 0,landings_night INTEGER NOT NULL DEFAULT 0,
      takeoffs_day INTEGER NOT NULL DEFAULT 0,takeoffs_night INTEGER NOT NULL DEFAULT 0,approaches_day INTEGER NOT NULL DEFAULT 0,approaches_night INTEGER NOT NULL DEFAULT 0,movement_evidence_recorded BOOLEAN NOT NULL DEFAULT FALSE,
      night_minutes INTEGER NOT NULL DEFAULT 0,ifr_minutes INTEGER NOT NULL DEFAULT 0,pic_minutes INTEGER NOT NULL DEFAULT 0,copilot_minutes INTEGER NOT NULL DEFAULT 0,dual_minutes INTEGER NOT NULL DEFAULT 0,instructor_minutes INTEGER NOT NULL DEFAULT 0,
      launch_method TEXT NOT NULL DEFAULT '',launches INTEGER NOT NULL DEFAULT 0,balloon_class TEXT NOT NULL DEFAULT '',balloon_group TEXT NOT NULL DEFAULT '',balloon_operation TEXT NOT NULL DEFAULT '',
      verification_name TEXT NOT NULL DEFAULT '',verification_reference TEXT NOT NULL DEFAULT '',certified_at TIMESTAMPTZ,certification_hash TEXT NOT NULL DEFAULT '',record_revision INTEGER NOT NULL DEFAULT 1,correction_reason TEXT NOT NULL DEFAULT '',locked_at TIMESTAMPTZ
    );
    CREATE TABLE flight_tracks(id BIGSERIAL PRIMARY KEY,user_id BIGINT NOT NULL,flight_id BIGINT NOT NULL,file_name TEXT NOT NULL DEFAULT '',distance_km NUMERIC NOT NULL DEFAULT 0);
    CREATE TABLE aircraft(id BIGSERIAL PRIMARY KEY,user_id BIGINT NOT NULL,registration TEXT NOT NULL,icao_type TEXT NOT NULL DEFAULT '');
    CREATE TABLE flight_participations(
      id BIGSERIAL PRIMARY KEY,source_flight_id BIGINT NOT NULL,source_user_id BIGINT NOT NULL,participant_user_id BIGINT NOT NULL,participant_role TEXT NOT NULL,
      source_revision INTEGER NOT NULL,source_hash TEXT NOT NULL DEFAULT '',status TEXT NOT NULL DEFAULT 'pending',participant_flight_id BIGINT,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE flight_verifications(
      id BIGSERIAL PRIMARY KEY,flight_id BIGINT NOT NULL,flight_user_id BIGINT NOT NULL,signer_user_id BIGINT,verification_role TEXT NOT NULL,record_revision INTEGER NOT NULL,flight_hash TEXT NOT NULL,
      credential_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,status TEXT NOT NULL DEFAULT 'signed',signed_at TIMESTAMPTZ
    );
    INSERT INTO users(id,display_name) VALUES(${SCALE_USER},'V169 Scale Pilot'),(75,'V169 Instructor');
    INSERT INTO aircraft(user_id,registration,icao_type)
      SELECT ${SCALE_USER},'OK-H'||LPAD(g::text,2,'0'),CASE WHEN g%4=0 THEN 'BR23' WHEN g%4=1 THEN 'ASW28' WHEN g%4=2 THEN 'R44' ELSE 'BALL' END FROM generate_series(1,40) g;
    INSERT INTO flights(
      user_id,date,evidence,registration,aircraft_type,aircraft_class,regulatory_category,aircraft_make,aircraft_model,departure,arrival,off_block,takeoff,landing,on_block,starts,commander,instructor,role,task,
      price_per_hour,billing_basis,operation_type,engine_type,landings_day,landings_night,takeoffs_day,takeoffs_night,approaches_day,approaches_night,movement_evidence_recorded,
      night_minutes,ifr_minutes,pic_minutes,copilot_minutes,dual_minutes,instructor_minutes,launch_method,launches,balloon_class,balloon_group,balloon_operation,certified_at,certification_hash,record_revision
    )
      SELECT ${SCALE_USER},DATE '1990-01-01'+(g%13000),'EASA',
        CASE WHEN g%4=3 AND g%11=0 THEN '' ELSE 'OK-H'||LPAD(((g%40)+1)::text,2,'0') END,
        CASE g%4 WHEN 0 THEN 'B23' WHEN 1 THEN 'ASW 28' WHEN 2 THEN 'R44 Raven II' ELSE 'Hot-air balloon' END,
        CASE g%4 WHEN 0 THEN 'SEP' WHEN 1 THEN 'GLIDER' WHEN 2 THEN 'HELICOPTER' ELSE 'BALLOON' END,
        CASE g%4 WHEN 0 THEN 'AEROPLANE' WHEN 1 THEN 'SAILPLANE' WHEN 2 THEN 'HELICOPTER' ELSE 'BALLOON' END,
        CASE g%4 WHEN 0 THEN 'Bristell' WHEN 1 THEN 'Alexander Schleicher' WHEN 2 THEN 'Robinson' ELSE '' END,
        CASE g%4 WHEN 0 THEN 'B23' WHEN 1 THEN 'ASW 28' WHEN 2 THEN 'R44' ELSE '' END,
        CASE WHEN g%4=3 THEN 'SITE-'||(g%25) ELSE 'LK'||LPAD((g%50)::text,2,'0') END,
        CASE WHEN g%4=3 THEN 'SITE-'||((g+7)%25) ELSE 'LK'||LPAD(((g+7)%50)::text,2,'0') END,
        '08:00','08:05','09:00','09:05',1,'V169 Scale Pilot',CASE WHEN g%17=0 THEN 'V169 Instructor' ELSE '' END,
        CASE WHEN g%25=0 THEN 'PAX' WHEN g%25=1 THEN 'SAFETY PILOT' WHEN g%25=2 THEN 'OBSERVER' WHEN g%17=0 THEN 'DUAL' WHEN g%19=0 THEN 'INSTRUCTOR' ELSE 'PIC' END,
        'V169 mixed-category scale flight',3000,CASE WHEN g%4=3 THEN 'AIR' ELSE 'BLOCK' END,'SP',CASE WHEN g%4=3 THEN '' ELSE 'SE' END,
        1,CASE WHEN g%20=0 THEN 1 ELSE 0 END,1,CASE WHEN g%20=0 THEN 1 ELSE 0 END,CASE WHEN g%4=2 THEN 1 ELSE 0 END,0,g%4=2,
        CASE WHEN g%10=0 THEN 20 ELSE 0 END,CASE WHEN g%8=0 AND g%4 IN(0,2) THEN 30 ELSE 0 END,
        CASE WHEN g%25 IN(0,1,2) OR g%17=0 THEN 0 ELSE 65 END,0,CASE WHEN g%17=0 THEN 65 ELSE 0 END,CASE WHEN g%19=0 THEN 65 ELSE 0 END,
        CASE WHEN g%4=1 THEN CASE WHEN g%3=0 THEN 'WINCH' WHEN g%3=1 THEN 'AEROTOW' ELSE 'SELF' END ELSE '' END,CASE WHEN g%4=1 THEN 1 ELSE 0 END,
        CASE WHEN g%4=3 THEN 'HOT_AIR_BALLOON' ELSE '' END,CASE WHEN g%4=3 THEN CHR(65+(g%4)) ELSE '' END,CASE WHEN g%4=3 THEN CASE WHEN g%9=0 THEN 'TETHERED' ELSE 'FREE' END ELSE '' END,
        CASE WHEN g%13=0 THEN NOW() ELSE NULL END,CASE WHEN g%13=0 THEN 'v169-'||g ELSE '' END,1
      FROM generate_series(1,${SCALE_ROWS}) g;
    INSERT INTO flight_tracks(user_id,flight_id,file_name,distance_km)
      SELECT ${SCALE_USER},id,'v169-scale.kml',80+(id%40) FROM flights WHERE user_id=${SCALE_USER} AND id%5=0;
    INSERT INTO flight_verifications(flight_id,flight_user_id,signer_user_id,verification_role,record_revision,flight_hash,credential_snapshot,status,signed_at)
      SELECT id,${SCALE_USER},75,'INSTRUCTOR',record_revision,certification_hash,'{"identity":"V169 Instructor"}'::jsonb,'signed',NOW()
      FROM flights WHERE user_id=${SCALE_USER} AND role='DUAL' AND certification_hash<>'';
    ${indexes.join(";\n")};
    ANALYZE;
  `;
  const result=rawPsql(setup);
  if(result.status!==0)throw new Error(`PostgreSQL v1.69 scale schema setup failed:\n${result.stderr||result.stdout}`);
});

after(()=>{
  if(!enabled)return;
  fs.writeFileSync(evidencePath,JSON.stringify(evidence,null,2)+"\n");
  rawPsql(`DROP SCHEMA IF EXISTS ${quotedSchema} CASCADE`);
});

test("v1.69 50k mixed-category fixture preserves sparse regulatory contexts",{skip:!enabled},()=>{
  const counts=rows(`SELECT regulatory_category,COUNT(*)::int flights,COUNT(*) FILTER(WHERE registration='')::int sparse_registration FROM flights WHERE user_id=${SCALE_USER} GROUP BY regulatory_category ORDER BY regulatory_category`);
  assert.deepEqual(counts.map(row=>[row.regulatory_category,Number(row.flights)]),[["AEROPLANE",12500],["BALLOON",12500],["HELICOPTER",12500],["SAILPLANE",12500]]);
  assert.ok(Number(counts.find(row=>row.regulatory_category==="BALLOON")?.sparse_registration)>0);
  assert.equal(Number(run(`SELECT COUNT(*) FROM flights WHERE user_id=${SCALE_USER} AND regulatory_category='SAILPLANE' AND launch_method<>'' AND launches=1`)),12500);
  assert.equal(Number(run(`SELECT COUNT(*) FROM flights WHERE user_id=${SCALE_USER} AND regulatory_category='BALLOON' AND balloon_class='HOT_AIR_BALLOON' AND balloon_operation IN('FREE','TETHERED')`)),12500);
});

test("v1.69 category index remains usable at 50k flights",{skip:!enabled},()=>{
  const statement=`SELECT id,date,registration FROM flights WHERE user_id=${SCALE_USER} AND regulatory_category='HELICOPTER' ORDER BY date DESC LIMIT 50`;
  const result=explain(statement);recordMetric("categoryBrowse50k",result,750);
  assert.match(JSON.stringify(result.plan),/Index/i);
});

test("v1.69 dashboard and flight-list production SQL remain bounded at 50k",{skip:!enabled},()=>{
  const dashboardSource=read("lib/data/dashboard.ts");
  const dashboardQuery=render(sqlBlock(dashboardSource,"WITH track AS MATERIALIZED("),{userId:SCALE_USER,start:null,end:null});
  const dashboardResult=explain(dashboardQuery);recordMetric("dashboardAllTime50k",dashboardResult,3500);
  const dashboardRow=rows(dashboardQuery)[0]??{};
  assert.equal(Number(dashboardRow.total_flights),DASHBOARD_ROWS);
  assert.equal(Number(dashboardRow.safety_minutes),SAFETY_ROWS*65);

  const flightsSource=read("lib/data/flights-fast.ts");
  const listQuery=render(sqlBlock(flightsSource,"track AS MATERIALIZED(SELECT flight_id,COUNT(*)::int track_count"),{
    userId:SCALE_USER,q:null,e:null,r:null,reg:null,from:null,to:null,c:null,a:null,route:null,rf:null,rt:null,y:null,g:null,status:null,workflow:null,category:null,sort:"newest",size:50,offset:0
  });
  const listResult=explain(listQuery);recordMetric("flightListFirstPage50k",listResult,2500);
  const data=rows(listQuery);assert.equal(data.length,50);assert.equal(Number(data[0].total_count),SCALE_ROWS);
});

test("v1.69 pilot insights exclude auxiliary modes on the mixed-category 50k account",{skip:!enabled},()=>{
  const source=read("lib/data/pilot-insights.ts");
  const query=render(sqlBlock(source,"WITH base0 AS MATERIALIZED("),{
    userId:SCALE_USER,"bounds.start":null,"bounds.end":null,scopeCategory:null,section:"all",
    "rolling.currentStart":"2025-09-07","rolling.currentEnd":"2026-09-06","rolling.previousStart":"2024-09-07","rolling.previousEnd":"2025-09-06"
  });
  const result=explain(query);recordMetric("pilotInsights50k",result,3000);
  const row=rows(query)[0]??{};
  assert.equal(Number(row.flights),LOGGED_ROWS);
  const roleRows=jsonArray(row.roles);
  const roles=new Set(roleRows.map(item=>String(item.role)));
  assert.equal(roles.has("PAX"),false);assert.equal(roles.has("SAFETY PILOT"),false);assert.equal(roles.has("OBSERVER"),false);
  assert.ok(roleRows.some(item=>item.role==="PIC"));
});

test("v1.69 complete print selection remains bounded at 50k without auxiliary-role pollution",{skip:!enabled},()=>{
  const source=read("app/(protected)/print/page.tsx");
  const block=sqlBlock(source,"SELECT f.date,f.evidence,f.regulatory_category,f.registration,f.aircraft_type");
  const complete=render(block,{userId:SCALE_USER,scope:"all",from:null,to:null,includeAuxiliary:false});
  const result=explain(complete);recordMetric("printCompleteSql50k",result,4000);
  assert.equal(Number(run(`SELECT COUNT(*) FROM (${complete}) q`)),LOGGED_ROWS);
});
