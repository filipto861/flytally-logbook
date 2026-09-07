import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { after,before,test } from "node:test";

const enabled=process.env.FLYTALLY_POSTGRES_INTEGRATION==="1";
const databaseUrl=process.env.DATABASE_URL??"";
const root=path.resolve(import.meta.dirname,"../..");
const schema=`ft_v200_output_${randomUUID().replaceAll("-","")}`;
const quoted=`"${schema}"`;

function raw(statement:string){return spawnSync("psql",[databaseUrl,"-X","-v","ON_ERROR_STOP=1","-qAt","-c",statement],{encoding:"utf8",env:{...process.env,PGCONNECT_TIMEOUT:"5"},maxBuffer:8*1024*1024})}
function run(statement:string){const result=raw(`SET search_path TO ${quoted};\n${statement}`);if(result.status!==0)throw new Error(result.stderr||result.stdout);return String(result.stdout??"").trim()}
function literal(value:unknown){if(value===null||value===undefined)return"NULL";if(typeof value==="number")return String(value);if(typeof value==="boolean")return value?"TRUE":"FALSE";return`'${String(value).replaceAll("'","''")}'`}
function queryBlock(){const source=fs.readFileSync(path.join(root,"app/api/export/route.ts"),"utf8"),blocks=[...source.matchAll(/sql`([\s\S]*?)`/g)].map(match=>match[1]);const block=blocks.find(value=>value.includes("WITH t AS ("));assert.ok(block,"v2.0-E1 export SQL block not found");return block}
function render(category:string="all",scope:string="all",auxiliary:string="exclude"){
  const values:Record<string,unknown>={"session.userId":1,scope,category,from:null,to:null,registration:null,auxiliary};
  const rendered=queryBlock().replace(/\$\{([^}]+)\}/g,(_all,expression)=>{const key=String(expression).trim();assert.ok(Object.prototype.hasOwnProperty.call(values,key),`No v2.0-E1 SQL fixture for ${key}`);return literal(values[key])});
  assert.doesNotMatch(rendered,/\$\{/);return rendered;
}
function rows(statement:string){const json=run(`WITH q AS (${statement}) SELECT COALESCE(json_agg(row_to_json(q)),'[]'::json)::text FROM q`);return JSON.parse(json||"[]") as Array<Record<string,unknown>>}

before(()=>{
  if(!enabled)return;
  assert.ok(databaseUrl,"DATABASE_URL is required for v2.0-E1 PostgreSQL test");
  const setup=`
    CREATE SCHEMA ${quoted};SET search_path TO ${quoted};
    CREATE TABLE flights(
      id BIGSERIAL PRIMARY KEY,user_id BIGINT NOT NULL,date TEXT,evidence TEXT,regulatory_category TEXT,registration TEXT,
      aircraft_make TEXT,aircraft_model TEXT,aircraft_variant TEXT,aircraft_type TEXT,aircraft_class TEXT,operation_type TEXT,engine_type TEXT,
      departure TEXT,arrival TEXT,off_block TEXT,takeoff TEXT,landing TEXT,on_block TEXT,
      launch_method TEXT,launches INTEGER DEFAULT 0,takeoffs_day INTEGER DEFAULT 0,takeoffs_night INTEGER DEFAULT 0,landings_day INTEGER DEFAULT 0,landings_night INTEGER DEFAULT 0,
      balloon_class TEXT,balloon_group TEXT,balloon_operation TEXT,night_minutes INTEGER DEFAULT 0,ifr_minutes INTEGER DEFAULT 0,role TEXT,
      pic_minutes INTEGER DEFAULT 0,copilot_minutes INTEGER DEFAULT 0,dual_minutes INTEGER DEFAULT 0,instructor_minutes INTEGER DEFAULT 0,
      commander TEXT,instructor TEXT,verification_name TEXT,verification_reference TEXT,task TEXT,note TEXT,certified_at TIMESTAMP,record_revision INTEGER DEFAULT 1,
      correction_reason TEXT,price_per_hour NUMERIC DEFAULT 0,billing_basis TEXT
    );
    CREATE TABLE flight_tracks(user_id BIGINT NOT NULL,flight_id BIGINT NOT NULL,distance_km NUMERIC DEFAULT 0);
    INSERT INTO flights(user_id,date,evidence,regulatory_category,registration,aircraft_type,aircraft_class,operation_type,engine_type,departure,arrival,off_block,takeoff,landing,on_block,launch_method,launches,takeoffs_day,takeoffs_night,landings_day,landings_night,balloon_class,balloon_group,balloon_operation,role,pic_minutes) VALUES
      (1,'2026-09-01','EASA',NULL,'OK-TMG','SF25','TMG','SP','SE','LKPR','LKPR','10:00','10:05','10:55','11:00','',0,1,0,1,0,'','','','PIC',60),
      (1,'2026-09-02','EASA','SAILPLANE','D-KABC','SF25','TMG','SP','SE','LKPR','LKBE','11:00','11:05','12:00','12:05','SELF',0,1,0,1,0,'','','','PIC',55),
      (1,'2026-09-03','EASA',NULL,'OK-GLD','ASK21','GLIDER','SP','SE','LKCM','LKCM','12:00','12:10','12:50','13:20','WINCH',1,0,0,1,0,'','','','PIC',40),
      (1,'2026-09-04','EASA','BALLOON','OK-BAL','Kubicek BB','BALLOON','SP','SE','LKPR','LKBE','13:00','13:20','14:20','14:30','',0,0,0,1,0,'HOT-AIR','A','FREE','PIC',60),
      (1,'2026-09-05','ULL',NULL,'OK-ULL','Bristell','ULL','SP','SE','LKBE','LKBE','14:00','14:05','14:40','14:45','',0,1,0,1,0,'','','','PIC',45),
      (1,'2026-09-06','EASA','HELICOPTER','OK-HEL','R44','HELICOPTER','SP','SE','LKPR','LKPR','15:00','15:05','15:45','15:50','',0,1,0,1,0,'','','','PIC',50),
      (1,'2026-09-07','EASA','SAILPLANE','D-PAX','ASK21','GLIDER','SP','SE','LKCM','LKCM','16:00','16:10','16:40','17:00','AEROTOW',1,0,0,1,0,'','','','PAX',0),
      (2,'2026-09-01','EASA','BALLOON','OTHER','Balloon','BALLOON','SP','SE','AAAA','BBBB','10:00','10:10','11:00','11:10','',0,0,0,1,0,'HOT-AIR','B','FREE','PIC',50);
    INSERT INTO flight_tracks(user_id,flight_id,distance_km) VALUES (1,1,100.5),(1,2,55.2),(1,2,2.3),(2,8,999);
  `;
  const result=raw(setup);if(result.status!==0)throw new Error(result.stderr||result.stdout);
});
after(()=>{if(enabled)raw(`DROP SCHEMA IF EXISTS ${quoted} CASCADE`)});

test("v2.0-E1 export SQL resolves mixed categories and category-aware logged time",{skip:!enabled},()=>{
  const data=rows(render());
  assert.equal(data.length,6);
  const byRegistration=new Map(data.map(row=>[String(row.registration),row]));
  assert.equal(byRegistration.get("OK-TMG")?.regulatory_category,"AEROPLANE");
  assert.equal(Number(byRegistration.get("OK-TMG")?.block_minutes),60);
  assert.equal(Number(byRegistration.get("OK-TMG")?.air_minutes),50);
  assert.equal(Number(byRegistration.get("OK-TMG")?.logged_minutes),60);
  assert.equal(byRegistration.get("D-KABC")?.regulatory_category,"SAILPLANE");
  assert.equal(Number(byRegistration.get("D-KABC")?.logged_minutes),55);
  assert.equal(byRegistration.get("OK-GLD")?.regulatory_category,"SAILPLANE");
  assert.equal(Number(byRegistration.get("OK-GLD")?.logged_minutes),40);
  assert.equal(byRegistration.get("OK-BAL")?.regulatory_category,"BALLOON");
  assert.equal(Number(byRegistration.get("OK-BAL")?.logged_minutes),60);
  assert.equal(byRegistration.get("OK-BAL")?.balloon_class,"HOT-AIR");
  assert.equal(byRegistration.get("OK-BAL")?.balloon_group,"A");
  assert.equal(byRegistration.get("OK-BAL")?.balloon_operation,"FREE");
  assert.equal(byRegistration.get("OK-ULL")?.regulatory_category,"ULL");
  assert.equal(byRegistration.get("OK-HEL")?.regulatory_category,"HELICOPTER");
  assert.equal(data.reduce((sum,row)=>sum+Number(row.logged_minutes||0),0),310);
  assert.equal(Number(byRegistration.get("D-KABC")?.track_count),2);
  assert.equal(Number(byRegistration.get("D-KABC")?.gps_km),57.5);
});

test("v2.0-E1 export SQL applies category scope after conservative legacy resolution",{skip:!enabled},()=>{
  const sailplanes=rows(render("SAILPLANE"));
  assert.deepEqual(sailplanes.map(row=>String(row.registration)),["D-KABC","OK-GLD"]);
  assert.equal(sailplanes.reduce((sum,row)=>sum+Number(row.logged_minutes||0),0),95);
  const aeroplanes=rows(render("AEROPLANE"));
  assert.deepEqual(aeroplanes.map(row=>String(row.registration)),["OK-TMG"]);
  const balloons=rows(render("BALLOON"));
  assert.deepEqual(balloons.map(row=>String(row.registration)),["OK-BAL"]);
});

test("v2.0-E1 export keeps auxiliary inclusion explicit",{skip:!enabled},()=>{
  const excluded=rows(render("SAILPLANE","all","exclude")),included=rows(render("SAILPLANE","all","include"));
  assert.equal(excluded.length,2);
  assert.equal(included.length,3);
  assert.ok(included.some(row=>row.registration==="D-PAX"&&row.role==="PAX"));
});
