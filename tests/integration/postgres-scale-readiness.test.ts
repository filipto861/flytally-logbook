import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { after,before,test } from "node:test";

const enabled=process.env.FLYTALLY_POSTGRES_INTEGRATION==="1";
const databaseUrl=process.env.DATABASE_URL??"";
const root=path.resolve(import.meta.dirname,"../..");
const schema=`ft_scale_${randomUUID().replaceAll("-","")}`;
const quotedSchema=`"${schema}"`;
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");
const evidencePath=path.join(root,"flytally-scale-evidence.json");
const evidence:Record<string,unknown>={version:"1.44.0",dataset:{targetFlights:10000,noiseFlights:10000}};

function rawPsql(statement:string){
  const result=spawnSync("psql",[databaseUrl,"-X","-v","ON_ERROR_STOP=1","-qAt","-c",statement],{encoding:"utf8",env:{...process.env,PGCONNECT_TIMEOUT:"5"},maxBuffer:16*1024*1024});
  if(result.error)throw result.error;
  return result;
}
function run(statement:string){
  const result=rawPsql(`SET search_path TO ${quotedSchema};\n${statement}`);
  if(result.status!==0)throw new Error(`PostgreSQL scale command failed:\n${result.stderr||result.stdout}`);
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
    assert.ok(Object.prototype.hasOwnProperty.call(values,key),`No scale SQL test value for ${key}`);
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
  console.log(`SCALE ${name}: execution=${result.executionMs.toFixed(3)}ms planning=${result.planningMs.toFixed(3)}ms limit=${limitMs}ms`);
  assert.ok(result.executionMs<limitMs,`${name} exceeded ${limitMs}ms on the controlled 10k-flight account dataset: ${result.executionMs}ms`);
}

before(()=>{
  if(!enabled)return;
  assert.ok(databaseUrl,"DATABASE_URL is required for PostgreSQL scale acceptance tests");
  const dbSource=read("lib/db-optimization.ts");
  const indexes=[
    sqlBlock(dbSource,"CREATE INDEX IF NOT EXISTS idx_logbook_flights_user_date"),
    sqlBlock(dbSource,"CREATE INDEX IF NOT EXISTS idx_logbook_flights_user_registration"),
    sqlBlock(dbSource,"CREATE INDEX IF NOT EXISTS idx_logbook_tracks_user_flight"),
    sqlBlock(dbSource,"CREATE INDEX IF NOT EXISTS idx_logbook_flights_user_easa"),
    sqlBlock(dbSource,"CREATE INDEX IF NOT EXISTS idx_flight_verifications_flight_revision"),
    sqlBlock(dbSource,"CREATE INDEX IF NOT EXISTS idx_flight_participations_recipient_status"),
    sqlBlock(dbSource,"CREATE INDEX IF NOT EXISTS idx_flight_participations_source"),
  ];
  const setup=`
    CREATE SCHEMA ${quotedSchema};
    SET search_path TO ${quotedSchema};
    CREATE TABLE users(id BIGINT PRIMARY KEY,display_name TEXT NOT NULL DEFAULT '');
    CREATE TABLE flights(
      id BIGSERIAL PRIMARY KEY,user_id BIGINT NOT NULL,date DATE,evidence TEXT NOT NULL DEFAULT '',registration TEXT NOT NULL DEFAULT '',aircraft_type TEXT NOT NULL DEFAULT '',aircraft_class TEXT NOT NULL DEFAULT '',regulatory_category TEXT NOT NULL DEFAULT '',
      aircraft_make TEXT NOT NULL DEFAULT '',aircraft_model TEXT NOT NULL DEFAULT '',aircraft_variant TEXT NOT NULL DEFAULT '',departure TEXT NOT NULL DEFAULT '',arrival TEXT NOT NULL DEFAULT '',off_block TEXT NOT NULL DEFAULT '',takeoff TEXT NOT NULL DEFAULT '',landing TEXT NOT NULL DEFAULT '',on_block TEXT NOT NULL DEFAULT '',launch_method TEXT NOT NULL DEFAULT '',launches INTEGER NOT NULL DEFAULT 0,takeoffs_day INTEGER NOT NULL DEFAULT 0,takeoffs_night INTEGER NOT NULL DEFAULT 0,balloon_class TEXT NOT NULL DEFAULT '',balloon_group TEXT NOT NULL DEFAULT '',balloon_operation TEXT NOT NULL DEFAULT '',
      starts INTEGER NOT NULL DEFAULT 0,commander TEXT NOT NULL DEFAULT '',instructor TEXT NOT NULL DEFAULT '',role TEXT NOT NULL DEFAULT '',task TEXT NOT NULL DEFAULT '',purpose_code TEXT NOT NULL DEFAULT '',note TEXT NOT NULL DEFAULT '',
      price_per_hour NUMERIC,billing_basis TEXT NOT NULL DEFAULT 'BLOCK',operation_type TEXT NOT NULL DEFAULT 'SP',engine_type TEXT NOT NULL DEFAULT 'SE',landings_day INTEGER NOT NULL DEFAULT 0,landings_night INTEGER NOT NULL DEFAULT 0,
      night_minutes INTEGER NOT NULL DEFAULT 0,ifr_minutes INTEGER NOT NULL DEFAULT 0,pic_minutes INTEGER NOT NULL DEFAULT 0,copilot_minutes INTEGER NOT NULL DEFAULT 0,dual_minutes INTEGER NOT NULL DEFAULT 0,instructor_minutes INTEGER NOT NULL DEFAULT 0,
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
    INSERT INTO users(id,display_name) VALUES(71,'Scale Pilot'),(72,'Noise Pilot'),(73,'Scale Instructor');
    INSERT INTO aircraft(user_id,registration,icao_type)
      SELECT 71,'OK-S'||LPAD(g::text,2,'0'),'BR23' FROM generate_series(1,20) g;
    INSERT INTO flights(user_id,date,evidence,registration,aircraft_type,aircraft_class,aircraft_make,aircraft_model,aircraft_variant,departure,arrival,off_block,takeoff,landing,on_block,starts,commander,instructor,role,task,purpose_code,note,price_per_hour,billing_basis,operation_type,engine_type,landings_day,landings_night,night_minutes,ifr_minutes,pic_minutes,copilot_minutes,dual_minutes,instructor_minutes,certified_at,certification_hash,record_revision)
      SELECT 71,DATE '2000-01-01'+(g%10000),CASE WHEN g%3=0 THEN 'ULL' ELSE 'EASA' END,'OK-S'||LPAD(((g%20)+1)::text,2,'0'),'B23',CASE WHEN g%3=0 THEN 'ULL' ELSE 'SEP' END,'Bristell','B23','',
        'LK'||LPAD((g%50)::text,2,'0'),'LK'||LPAD(((g+7)%50)::text,2,'0'),'08:00','08:05','09:00','09:05',1,
        CASE WHEN g%5=0 THEN 'Scale Instructor' ELSE 'Scale Pilot' END,CASE WHEN g%5=0 THEN 'Scale Instructor' ELSE '' END,CASE WHEN g%5=0 THEN 'DUAL' WHEN g%7=0 THEN 'INSTRUCTOR' ELSE 'PIC' END,
        'Scale flight','','',3000,'BLOCK','SP','SE',1,0,CASE WHEN g%10=0 THEN 20 ELSE 0 END,CASE WHEN g%8=0 THEN 30 ELSE 0 END,
        CASE WHEN g%5=0 THEN 0 ELSE 65 END,0,CASE WHEN g%5=0 THEN 65 ELSE 0 END,CASE WHEN g%7=0 THEN 65 ELSE 0 END,NOW(),'scale-'||g,1
      FROM generate_series(1,10000) g;
    INSERT INTO flights(user_id,date,evidence,registration,aircraft_type,aircraft_class,departure,arrival,off_block,takeoff,landing,on_block,starts,role,price_per_hour,billing_basis,landings_day,pic_minutes)
      SELECT 72,DATE '2000-01-01'+(g%10000),'EASA','NOISE-'||((g%20)+1),'B23','SEP','AAAA','BBBB','10:00','10:05','11:00','11:05',1,'PIC',2500,'BLOCK',1,65 FROM generate_series(1,10000) g;
    INSERT INTO flight_tracks(user_id,flight_id,file_name,distance_km)
      SELECT 71,id,'scale.kml',80+(id%40) FROM flights WHERE user_id=71 AND id%5=0;
    INSERT INTO flight_verifications(flight_id,flight_user_id,signer_user_id,verification_role,record_revision,flight_hash,credential_snapshot,status,signed_at)
      SELECT id,71,73,'INSTRUCTOR',record_revision,certification_hash,'{"identity":"Scale Instructor"}'::jsonb,'signed',NOW() FROM flights WHERE user_id=71 AND role='DUAL' AND id%10=0;
    ${indexes.join(";\n")};
    ANALYZE;
  `;
  const result=rawPsql(setup);
  if(result.status!==0)throw new Error(`PostgreSQL scale schema setup failed:\n${result.stderr||result.stdout}`);
});

after(()=>{
  if(!enabled)return;
  fs.writeFileSync(evidencePath,JSON.stringify(evidence,null,2)+"\n");
  rawPsql(`DROP SCHEMA IF EXISTS ${quotedSchema} CASCADE`);
});

test("AC-24 dashboard production query remains bounded with 10,000 pilot flights",{skip:!enabled},()=>{
  const source=read("lib/data/dashboard.ts");
  const query=render(sqlBlock(source,"WITH track AS MATERIALIZED(","last"),{userId:71,start:null,end:null});
  const result=explain(query);recordMetric("dashboardAllTime10k",result,2000);
  const row=rows(query)[0];
  assert.equal(Number(row.total_flights),10000);
  assert.equal(Number(row.unique_aircraft),20);
});

test("AC-24 flight list production query returns a responsive first page over 10,000 flights",{skip:!enabled},()=>{
  const source=read("lib/data/flights-fast.ts");
  const query=render(sqlBlock(source,"track AS MATERIALIZED(SELECT flight_id,COUNT(*)::int track_count"),{
    userId:71,q:null,e:null,r:null,reg:null,from:null,to:null,c:null,a:null,route:null,rf:null,rt:null,y:null,g:null,status:null,workflow:null,category:null,sort:"newest",size:50,offset:0
  });
  const result=explain(query);recordMetric("flightListFirstPage10k",result,1500);
  const data=rows(query);
  assert.equal(data.length,50);
  assert.equal(Number(data[0].total_count),10000);
});

test("AC-25 print production query remains bounded for date-scoped and complete 10,000-flight selection",{skip:!enabled},()=>{
  const source=read("app/(protected)/print/page.tsx");
  const block=sqlBlock(source,"SELECT f.date,f.evidence,f.regulatory_category,f.registration,f.aircraft_type");
  const scoped=render(block,{userId:71,scope:"easa",from:"2025-01-01",to:"2026-12-31",includeAuxiliary:false});
  const scopedResult=explain(scoped);recordMetric("printDateScoped10k",scopedResult,1500);
  const scopedCount=Number(run(`SELECT COUNT(*) FROM (${scoped}) q`));
  assert.ok(scopedCount>0&&scopedCount<10000);

  const complete=render(block,{userId:71,scope:"all",from:null,to:null,includeAuxiliary:false});
  const completeResult=explain(complete);recordMetric("printCompleteSql10k",completeResult,2500);
  assert.equal(Number(run(`SELECT COUNT(*) FROM (${complete}) q`)),10000);
  evidence.printCompleteSelectedRecords=10000;
});
