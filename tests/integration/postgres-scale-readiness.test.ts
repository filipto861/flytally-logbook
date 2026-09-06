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
  ].join(";\n");
  run(`CREATE TABLE users(id BIGINT PRIMARY KEY,display_name TEXT NOT NULL DEFAULT '');
    CREATE TABLE flights(id BIGINT PRIMARY KEY,user_id BIGINT NOT NULL,date DATE NOT NULL,evidence TEXT NOT NULL DEFAULT '',registration TEXT NOT NULL DEFAULT '',aircraft_type TEXT NOT NULL DEFAULT '',aircraft_class TEXT NOT NULL DEFAULT '',regulatory_category TEXT NOT NULL DEFAULT '',departure TEXT NOT NULL DEFAULT '',arrival TEXT NOT NULL DEFAULT '',off_block TEXT NOT NULL DEFAULT '',takeoff TEXT NOT NULL DEFAULT '',landing TEXT NOT NULL DEFAULT '',on_block TEXT NOT NULL DEFAULT '',role TEXT NOT NULL DEFAULT '',starts INTEGER NOT NULL DEFAULT 0,task TEXT NOT NULL DEFAULT '',billing_basis TEXT NOT NULL DEFAULT 'BLOCK',price_per_hour NUMERIC NOT NULL DEFAULT 0,locked_at TIMESTAMPTZ,certified_at TIMESTAMPTZ,record_revision INTEGER NOT NULL DEFAULT 1,correction_reason TEXT NOT NULL DEFAULT '',pic_minutes INTEGER NOT NULL DEFAULT 0,commander TEXT NOT NULL DEFAULT '',note TEXT NOT NULL DEFAULT '');
    CREATE TABLE flight_tracks(id BIGINT PRIMARY KEY,user_id BIGINT NOT NULL,flight_id BIGINT NOT NULL,distance_km NUMERIC NOT NULL DEFAULT 0);
    CREATE TABLE flight_participations(id BIGINT PRIMARY KEY,source_flight_id BIGINT,source_user_id BIGINT,participant_user_id BIGINT,participant_flight_id BIGINT,status TEXT NOT NULL DEFAULT 'pending');
    ${indexes};
    INSERT INTO users(id,display_name) VALUES(71,'Scale Pilot'),(72,'Noise Pilot');
    INSERT INTO flights(id,user_id,date,evidence,registration,aircraft_type,aircraft_class,regulatory_category,departure,arrival,off_block,takeoff,landing,on_block,role,starts,billing_basis,price_per_hour,pic_minutes)
    SELECT i,71,DATE '2024-01-01'+((i-1)%730),CASE WHEN i%4=0 THEN 'ULL' ELSE 'EASA' END,'OK-'||LPAD(((i-1)%20+1)::text,3,'0'),'TYPE-'||((i-1)%20+1),CASE WHEN i%4=0 THEN 'ULL' ELSE 'SEP' END,CASE WHEN i%4=0 THEN 'ULL' ELSE 'AEROPLANE' END,'LK'||LPAD(((i-1)%30)::text,2,'0'),'LK'||LPAD((i%30)::text,2,'0'),'10:00','10:05','10:55','11:00','PIC',1,'BLOCK',2500,60 FROM generate_series(1,10000) i;
    INSERT INTO flights(id,user_id,date,evidence,registration,aircraft_type,aircraft_class,regulatory_category,departure,arrival,off_block,takeoff,landing,on_block,role,starts,billing_basis,price_per_hour,pic_minutes)
    SELECT 10000+i,72,DATE '2024-01-01'+((i-1)%730),'EASA','NOISE-'||LPAD(((i-1)%20+1)::text,3,'0'),'NOISE','SEP','AEROPLANE','LK00','LK01','10:00','10:05','10:55','11:00','PIC',1,'BLOCK',2500,60 FROM generate_series(1,10000) i;
    INSERT INTO flight_tracks(id,user_id,flight_id,distance_km) SELECT i,71,i,100 FROM generate_series(1,1000) i;`);
});

after(()=>{
  if(!enabled)return;
  fs.writeFileSync(evidencePath,JSON.stringify(evidence,null,2)+"\n");
  rawPsql(`DROP SCHEMA IF EXISTS ${quotedSchema} CASCADE`);
});

test("AC-24 dashboard production query remains bounded with 10,000 pilot flights",{skip:!enabled},()=>{
  const source=read("lib/data/dashboard.ts");
  const query=render(sqlBlock(source,"WITH track AS MATERIALIZED("),{userId:71,start:null,end:null});
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
  const block=sqlBlock(source,"SELECT f.date,f.evidence,f.registration,f.aircraft_type");
  const scoped=render(block,{userId:71,scope:"easa",from:"2025-01-01",to:"2026-12-31",includeAuxiliary:false});
  const scopedResult=explain(scoped);recordMetric("printDateScoped10k",scopedResult,1500);
  const scopedCount=Number(run(`SELECT COUNT(*) FROM (${scoped}) q`));
  assert.ok(scopedCount>0&&scopedCount<10000);

  const complete=render(block,{userId:71,scope:"all",from:null,to:null,includeAuxiliary:false});
  const completeResult=explain(complete);recordMetric("printCompleteSql10k",completeResult,2500);
  assert.equal(Number(run(`SELECT COUNT(*) FROM (${complete}) q`)),10000);
});
