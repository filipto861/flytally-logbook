import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { after,before,test } from "node:test";

const enabled=process.env.FLYTALLY_POSTGRES_INTEGRATION==="1";
const databaseUrl=process.env.DATABASE_URL??"";
const root=path.resolve(import.meta.dirname,"../..");
const schema=`ft_v200_dashboard_${randomUUID().replaceAll("-","")}`;
const quoted=`"${schema}"`;

function raw(statement:string){return spawnSync("psql",[databaseUrl,"-X","-v","ON_ERROR_STOP=1","-qAt","-c",statement],{encoding:"utf8",env:{...process.env,PGCONNECT_TIMEOUT:"5"},maxBuffer:8*1024*1024})}
function run(statement:string){const result=raw(`SET search_path TO ${quoted};\n${statement}`);if(result.status!==0)throw new Error(result.stderr||result.stdout);return String(result.stdout??"").trim()}
function literal(value:unknown){if(value===null||value===undefined)return"NULL";if(typeof value==="number")return String(value);if(typeof value==="boolean")return value?"TRUE":"FALSE";return`'${String(value).replaceAll("'","''")}'`}
function queryBlock(){const source=fs.readFileSync(path.join(root,"lib/data/dashboard.ts"),"utf8"),blocks=[...source.matchAll(/sql`([\s\S]*?)`/g)].map(match=>match[1]);const block=blocks.find(value=>value.includes("WITH track AS MATERIALIZED("));assert.ok(block,"v2.0-F Dashboard SQL block not found");return block}
function render(){
  const values:Record<string,unknown>={userId:1,start:null,end:null};
  const rendered=queryBlock().replace(/\$\{([^}]+)\}/g,(_all,expression)=>{const key=String(expression).trim();assert.ok(Object.prototype.hasOwnProperty.call(values,key),`No v2.0-F Dashboard SQL fixture for ${key}`);return literal(values[key])});
  assert.doesNotMatch(rendered,/\$\{/);return rendered;
}
function rows(statement:string){const json=run(`WITH q AS (${statement}) SELECT COALESCE(json_agg(row_to_json(q)),'[]'::json)::text FROM q`);return JSON.parse(json||"[]") as Array<Record<string,unknown>>}
function jsonObjects(value:unknown):Array<Record<string,unknown>>{if(Array.isArray(value))return value as Array<Record<string,unknown>>;if(typeof value==="string")try{const parsed=JSON.parse(value);return Array.isArray(parsed)?parsed:[]}catch{}return[]}

before(()=>{
  if(!enabled)return;
  assert.ok(databaseUrl,"DATABASE_URL is required for v2.0-F PostgreSQL test");
  const setup=`
    CREATE SCHEMA ${quoted};SET search_path TO ${quoted};
    CREATE TABLE users(id BIGINT PRIMARY KEY,display_name TEXT NOT NULL DEFAULT '');
    CREATE TABLE flights(
      id BIGSERIAL PRIMARY KEY,user_id BIGINT NOT NULL,date DATE,evidence TEXT,regulatory_category TEXT,aircraft_class TEXT,
      role TEXT,instructor TEXT,registration TEXT,departure TEXT,arrival TEXT,off_block TEXT,on_block TEXT,takeoff TEXT,landing TEXT,
      starts INTEGER DEFAULT 0,landings_day INTEGER DEFAULT 0,landings_night INTEGER DEFAULT 0,
      night_minutes INTEGER DEFAULT 0,ifr_minutes INTEGER DEFAULT 0,pic_minutes INTEGER DEFAULT 0,copilot_minutes INTEGER DEFAULT 0,dual_minutes INTEGER DEFAULT 0,instructor_minutes INTEGER DEFAULT 0,
      price_per_hour NUMERIC DEFAULT 0,billing_basis TEXT DEFAULT 'BLOCK'
    );
    CREATE TABLE flight_tracks(user_id BIGINT NOT NULL,flight_id BIGINT NOT NULL,distance_km NUMERIC DEFAULT 0);
    INSERT INTO users(id,display_name) VALUES(1,'Dashboard Pilot');
    INSERT INTO flights(user_id,date,evidence,regulatory_category,aircraft_class,role,instructor,registration,departure,arrival,off_block,takeoff,landing,on_block,starts,landings_day,landings_night,pic_minutes,dual_minutes) VALUES
      (1,'2026-09-01','EASA',NULL,'TMG','PIC','','LEGACY-TMG','LKPR','LKPR','10:00','10:05','10:55','11:00',1,0,0,0,0),
      (1,'2026-09-02','EASA','SAILPLANE','TMG','PIC','','SFCL-TMG','LKPR','LKBE','11:00','11:05','12:00','12:05',1,1,0,0,0),
      (1,'2026-09-03','EASA',NULL,'GLIDER','PIC','','GLIDER','LKCM','LKCM','12:00','12:20','13:00','13:20',2,0,0,0,0),
      (1,'2026-09-04','EASA','BALLOON','BALLOON','DUAL','Instructor','BALLOON','LKPR','LKBE','13:00','13:20','14:20','14:30',1,1,0,0,60),
      (1,'2026-09-05','ULL',NULL,'ULL','PIC','','ULL','LKBE','LKBE','14:00','14:05','14:45','14:50',1,0,0,0,0),
      (1,'2026-09-06','EASA','HELICOPTER','HELICOPTER','PIC','','HELI','LKPR','LKPR','15:00','15:05','15:45','15:45',1,1,0,0,0),
      (1,'2026-09-07','EASA','AEROPLANE','SEP','SAFETY PILOT','','SAFETY','LKPR','LKBE','16:00','16:05','17:05','17:10',1,1,0,0,0),
      (1,'2026-09-07','EASA','SAILPLANE','GLIDER','PAX','','PAX-GLIDER','LKCM','LKCM','18:00','18:10','18:40','19:00',1,1,0,0,0);
    INSERT INTO flight_tracks(user_id,flight_id,distance_km) VALUES(1,1,100),(1,2,50),(1,2,5);
  `;
  const result=raw(setup);if(result.status!==0)throw new Error(result.stderr||result.stdout);
});
after(()=>{if(enabled)raw(`DROP SCHEMA IF EXISTS ${quoted} CASCADE`)});

test("v2.0-F Dashboard uses category-aware logged time while preserving Safety Pilot activity semantics",{skip:!enabled},()=>{
  const row=rows(render())[0]??{};
  assert.equal(row.display_name,"Dashboard Pilot");
  assert.equal(Number(row.total_flights),7);
  assert.equal(Number(row.total_minutes),380,"Dashboard activity total must use AIR for SFCL/BFCL but BLOCK for Safety Pilot");
  assert.equal(Number(row.safety_minutes),70);
  assert.equal(Number(row.easa_flights),5);
  assert.equal(Number(row.easa_minutes),260);
  assert.equal(Number(row.ull_flights),1);
  assert.equal(Number(row.ull_minutes),50);
  assert.equal(Number(row.pic_easa_flights),4);
  assert.equal(Number(row.pic_easa_minutes),200);
  assert.equal(Number(row.pic_ull_minutes),50);
  assert.equal(Number(row.total_landings),7);
  assert.equal(Number(row.pic_minutes),250);
  assert.equal(Number(row.air_minutes),285);
  assert.equal(Number(row.tracks),3);
  assert.equal(Number(row.gps_km),155);
});

test("v2.0-F Dashboard trend and aircraft aggregates use the same category-aware basis",{skip:!enabled},()=>{
  const row=rows(render())[0]??{};
  const monthly=jsonObjects(row.monthly),yearly=jsonObjects(row.yearly),aircraft=jsonObjects(row.top_aircraft);
  assert.equal(monthly.length,1);
  assert.equal(Number(monthly[0].total),380);
  assert.equal(Number(monthly[0].easa),260);
  assert.equal(Number(monthly[0].ull),50);
  assert.equal(Number(yearly[0].minutes),380);
  const byRegistration=new Map(aircraft.map(item=>[String(item.registration),Number(item.minutes)]));
  assert.equal(byRegistration.get("LEGACY-TMG"),60);
  assert.equal(byRegistration.get("SFCL-TMG"),55);
  assert.equal(byRegistration.get("GLIDER"),40);
  assert.equal(byRegistration.get("BALLOON"),60);
  assert.equal(byRegistration.has("SAFETY"),true);
  assert.equal(byRegistration.get("SAFETY"),0,"auxiliary rows may remain visible as activity context but must not receive logged-time credit");
});
