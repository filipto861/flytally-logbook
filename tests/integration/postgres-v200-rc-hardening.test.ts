import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { after,before,test } from "node:test";

const enabled=process.env.FLYTALLY_POSTGRES_INTEGRATION==="1";
const databaseUrl=process.env.DATABASE_URL??"";
const root=path.resolve(import.meta.dirname,"../..");
const schema=`ft_v200_rc_${randomUUID().replaceAll("-","")}`,quoted=`"${schema}"`;
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");
function raw(statement:string){return spawnSync("psql",[databaseUrl,"-X","-v","ON_ERROR_STOP=1","-qAt","-c",statement],{encoding:"utf8",env:{...process.env,PGCONNECT_TIMEOUT:"5"},maxBuffer:8*1024*1024})}
function run(statement:string){const result=raw(`SET search_path TO ${quoted};\n${statement}`);if(result.status!==0)throw new Error(result.stderr||result.stdout);return String(result.stdout??"").trim()}
function sqlBlock(source:string,needle:string){const block=[...source.matchAll(/sql`([\s\S]*?)`/g)].map(match=>match[1]).find(value=>value.includes(needle));assert.ok(block,`Production SQL block not found: ${needle}`);return block}
function literal(value:unknown){if(value===null||value===undefined)return"NULL";if(typeof value==="number")return String(value);return`'${String(value).replaceAll("'","''")}'`}
function render(block:string,values:Record<string,unknown>){const rendered=block.replace(/\$\{([^}]+)\}/g,(_all,expression)=>{const key=String(expression).trim();assert.ok(Object.prototype.hasOwnProperty.call(values,key),`No RC SQL value for ${key}`);return literal(values[key])});assert.doesNotMatch(rendered,/\$\{/);return rendered}

before(()=>{
  if(!enabled)return;
  assert.ok(databaseUrl,"DATABASE_URL is required for v2.0-RC PostgreSQL acceptance");
  const setup=`
    CREATE SCHEMA ${quoted};SET search_path TO ${quoted};
    CREATE TABLE flights(
      id BIGINT PRIMARY KEY,user_id BIGINT NOT NULL,date DATE,evidence TEXT NOT NULL DEFAULT '',registration TEXT NOT NULL DEFAULT '',aircraft_class TEXT NOT NULL DEFAULT '',regulatory_category TEXT NOT NULL DEFAULT '',
      balloon_class TEXT NOT NULL DEFAULT '',balloon_group TEXT NOT NULL DEFAULT '',balloon_operation TEXT NOT NULL DEFAULT '',launch_method TEXT NOT NULL DEFAULT '',launches INTEGER NOT NULL DEFAULT 0,
      departure TEXT NOT NULL DEFAULT '',arrival TEXT NOT NULL DEFAULT '',off_block TEXT NOT NULL DEFAULT '',takeoff TEXT NOT NULL DEFAULT '',landing TEXT NOT NULL DEFAULT '',on_block TEXT NOT NULL DEFAULT '',
      certified_at TIMESTAMPTZ,certified_by_user_id BIGINT,certification_hash TEXT NOT NULL DEFAULT '',certification_version INTEGER NOT NULL DEFAULT 8,record_revision INTEGER NOT NULL DEFAULT 1,
      locked_at TIMESTAMPTZ,locked_by_user_id BIGINT,correction_reason TEXT NOT NULL DEFAULT '',correction_opened_at TIMESTAMPTZ,correction_opened_by_user_id BIGINT
    );
    CREATE TABLE flight_certified_revisions(
      id BIGSERIAL PRIMARY KEY,flight_id BIGINT NOT NULL,user_id BIGINT NOT NULL,revision_number INTEGER NOT NULL,snapshot_data JSONB NOT NULL,certification_hash TEXT NOT NULL,certification_version INTEGER NOT NULL,
      certified_at TIMESTAMPTZ,certified_by_user_id BIGINT,superseded_at TIMESTAMPTZ,superseded_by_user_id BIGINT,correction_reason TEXT NOT NULL DEFAULT '',UNIQUE(user_id,flight_id,revision_number)
    );
    INSERT INTO flights(id,user_id,date,evidence,registration,aircraft_class,regulatory_category,launch_method,launches,departure,arrival,off_block,takeoff,landing,on_block,certified_at,certified_by_user_id,certification_hash,certification_version,record_revision)
      VALUES(101,1,'2026-08-01','EASA','LEGACY-GLIDER','GLIDER','','WINCH',1,'LKCM','LKCM','10:00','10:10','10:50','11:00',NOW(),1,'glider-hash',8,1);
    INSERT INTO flights(id,user_id,date,evidence,registration,aircraft_class,regulatory_category,balloon_class,balloon_group,balloon_operation,departure,arrival,off_block,takeoff,landing,on_block,certified_at,certified_by_user_id,certification_hash,certification_version,record_revision)
      VALUES(102,1,'2026-08-02','EASA','BALLOON-1','BALLOON','','HOT_AIR_BALLOON','B','TETHERED','LKPR','LKPR','12:00','12:10','12:40','12:50',NOW(),1,'balloon-hash',8,2);
  `;
  const result=raw(setup);if(result.status!==0)throw new Error(result.stderr||result.stdout);
});
after(()=>{if(enabled)raw(`DROP SCHEMA IF EXISTS ${quoted} CASCADE`)});

test("v2.0-RC certified correction archives complete legacy Sailplane evidence",{skip:!enabled},()=>{
  const block=sqlBlock(read("app/(protected)/flights/certification-actions.ts"),"INSERT INTO flight_certified_revisions(flight_id,user_id,revision_number,snapshot_data");
  run(render(block,{flightId:101,userId:1,reason:"RC legacy glider correction"}));
  const value=run(`SELECT concat_ws('|',snapshot_data->>'regulatory_category',snapshot_data->>'aircraft_class',snapshot_data->>'launch_method',snapshot_data->>'launches',certification_hash,revision_number) FROM flight_certified_revisions WHERE flight_id=101`);
  assert.equal(value,"|GLIDER|WINCH|1|glider-hash|1","archive must preserve the blank historical category instead of silently rewriting it");
});

test("v2.0-RC certified correction archives complete BFCL evidence",{skip:!enabled},()=>{
  const block=sqlBlock(read("app/(protected)/flights/certification-actions.ts"),"INSERT INTO flight_certified_revisions(flight_id,user_id,revision_number,snapshot_data");
  run(render(block,{flightId:102,userId:1,reason:"RC balloon correction"}));
  const value=run(`SELECT concat_ws('|',snapshot_data->>'regulatory_category',snapshot_data->>'aircraft_class',snapshot_data->>'balloon_class',snapshot_data->>'balloon_group',snapshot_data->>'balloon_operation',certification_hash,revision_number) FROM flight_certified_revisions WHERE flight_id=102`);
  assert.equal(value,"|BALLOON|HOT_AIR_BALLOON|B|TETHERED|balloon-hash|2");
});
