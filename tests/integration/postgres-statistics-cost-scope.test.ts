import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { after,before,test } from "node:test";
import { summarizeRegistrationCosts } from "../../lib/flight-cost-summary.ts";
import { cookSql } from "./production-sql.ts";

// Behavioural replacement for regex checks of the Statistics per-aircraft cost source.
// Runs the real production SQL from lib/data/pilot-insights.ts (section "aircraft")
// on a small fixture and checks which flights feed each registration's cost summary.
const enabled=process.env.FLYTALLY_POSTGRES_INTEGRATION==="1";
const databaseUrl=process.env.DATABASE_URL??"";
const root=path.resolve(import.meta.dirname,"../..");
const schema=`ft_statcost_${randomUUID().replaceAll("-","")}`;
const quotedSchema=`"${schema}"`;
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");
const PILOT=91,OTHER=92;

function rawPsql(statement:string){
  const result=spawnSync("psql",["-d",databaseUrl,"-X","-v","ON_ERROR_STOP=1","-qAt"],{input:statement,encoding:"utf8",env:{...process.env,PGCONNECT_TIMEOUT:"5"},maxBuffer:16*1024*1024});
  if(result.error)throw result.error;
  return result;
}
function run(statement:string){
  const result=rawPsql(`SET search_path TO ${quotedSchema};\n${statement}`);
  if(result.status!==0)throw new Error(`PostgreSQL command failed:\n${result.stderr||result.stdout}`);
  return String(result.stdout??"").trim();
}
function rows(statement:string){
  const clean=statement.trim().replace(/;\s*$/,"");
  return JSON.parse(run(`WITH q AS (${clean}) SELECT COALESCE(json_agg(row_to_json(q)),'[]'::json)::text FROM q`)||"[]") as Array<Record<string,unknown>>;
}
function literal(value:unknown){
  if(value===null||value===undefined)return"NULL";
  if(typeof value==="number")return String(value);
  return`'${String(value).replaceAll("'","''")}'`;
}
type Registration={registration:string;flights:number;cost_rows:unknown};
function registrations(values:{userId?:number;start?:string|null;end?:string|null;category?:string|null}={}){
  const source=read("lib/data/pilot-insights.ts");
  const block=[...source.matchAll(/sql`([\s\S]*?)`/g)].map(m=>cookSql(m[1])).find(b=>b.includes("WITH base0 AS MATERIALIZED("));
  assert.ok(block,"Statistics SQL not found in lib/data/pilot-insights.ts");
  const all:Record<string,unknown>={
    userId:values.userId??PILOT,"bounds.start":values.start===undefined?"2026-01-01":values.start,"bounds.end":values.end===undefined?"2026-12-31":values.end,
    scopeCategory:values.category??null,section:"aircraft",
    "rolling.currentStart":"2025-11-22","rolling.currentEnd":"2026-11-21","rolling.previousStart":"2024-11-22","rolling.previousEnd":"2025-11-21",
  };
  const rendered=block.replace(/\$\{([^}]+)\}/g,(_m,expr)=>{
    const key=String(expr).trim();
    assert.ok(Object.prototype.hasOwnProperty.call(all,key),`No test value for ${key}`);
    return literal(all[key]);
  });
  const row=rows(rendered)[0]??{};
  const list=(typeof row.registrations==="string"?JSON.parse(row.registrations):row.registrations) as Registration[];
  return new Map(list.map(item=>[item.registration,item]));
}

before(()=>{
  if(!enabled)return;
  assert.ok(databaseUrl,"DATABASE_URL is required");
  const flight=(user:number,date:string,registration:string,category:string,aircraftClass:string,role:string,currency:string,minorUnits:number,rate:string)=>
    `INSERT INTO flights(user_id,date,evidence,registration,aircraft_type,aircraft_class,regulatory_category,departure,arrival,off_block,takeoff,landing,on_block,role,pic_minutes,billing_basis,price_currency_code,price_currency_minor_units,price_per_hour_decimal)
     VALUES(${user},DATE '${date}','EASA','${registration}','T1','${aircraftClass}','${category}','LKPR','LKTB','08:00','08:05','08:25','08:30','${role}',30,'BLOCK','${currency}',${minorUnits},${rate});`;
  const result=rawPsql(`
    CREATE SCHEMA ${quotedSchema};
    SET search_path TO ${quotedSchema};
    CREATE TABLE users(id BIGINT PRIMARY KEY,display_name TEXT NOT NULL DEFAULT '');
    CREATE TABLE user_settings(user_id BIGINT PRIMARY KEY,home_airport TEXT NOT NULL DEFAULT '');
    CREATE TABLE flights(
      id BIGSERIAL PRIMARY KEY,user_id BIGINT NOT NULL,date DATE,evidence TEXT NOT NULL DEFAULT '',registration TEXT NOT NULL DEFAULT '',aircraft_type TEXT NOT NULL DEFAULT '',aircraft_class TEXT NOT NULL DEFAULT '',regulatory_category TEXT NOT NULL DEFAULT '',
      aircraft_make TEXT NOT NULL DEFAULT '',aircraft_model TEXT NOT NULL DEFAULT '',aircraft_variant TEXT NOT NULL DEFAULT '',departure TEXT NOT NULL DEFAULT '',arrival TEXT NOT NULL DEFAULT '',off_block TEXT NOT NULL DEFAULT '',takeoff TEXT NOT NULL DEFAULT '',landing TEXT NOT NULL DEFAULT '',on_block TEXT NOT NULL DEFAULT '',
      starts INTEGER NOT NULL DEFAULT 0,commander TEXT NOT NULL DEFAULT '',instructor TEXT NOT NULL DEFAULT '',role TEXT NOT NULL DEFAULT '',task TEXT NOT NULL DEFAULT '',purpose_code TEXT NOT NULL DEFAULT '',note TEXT NOT NULL DEFAULT '',
      price_per_hour NUMERIC,price_currency_code TEXT,price_currency_minor_units SMALLINT,price_per_hour_decimal NUMERIC,billing_basis TEXT NOT NULL DEFAULT 'BLOCK',operation_type TEXT NOT NULL DEFAULT 'SP',engine_type TEXT NOT NULL DEFAULT 'SE',landings_day INTEGER NOT NULL DEFAULT 0,landings_night INTEGER NOT NULL DEFAULT 0,
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
    INSERT INTO users(id,display_name) VALUES(${PILOT},'Statistics Pilot'),(${OTHER},'Other Pilot');
    -- Counted: two aeroplane PIC flights in 2026, 30 min at 100.01 CZK/h = 50.01 each.
    ${flight(PILOT,"2026-03-10","OK-AAA","AEROPLANE","SEP","PIC","CZK",2,"100.01")}
    ${flight(PILOT,"2026-04-10","OK-AAA","AEROPLANE","SEP","PIC","CZK",2,"100.01")}
    -- Not counted: same aircraft flown as a passenger (auxiliary role).
    ${flight(PILOT,"2026-05-10","OK-AAA","AEROPLANE","SEP","PAX","CZK",2,"5000.00")}
    -- Not counted in a 2026 period: same aircraft in 2024.
    ${flight(PILOT,"2024-05-10","OK-AAA","AEROPLANE","SEP","PIC","CZK",2,"7000.00")}
    -- Helicopter flight: counted only without a category filter. 30 min at 1001 JPY/h = 501.
    ${flight(PILOT,"2026-06-10","OK-HEL","HELICOPTER","SEH","PIC","JPY",0,"1001")}
    -- Another pilot on the same registration must never leak in.
    ${flight(OTHER,"2026-03-10","OK-AAA","AEROPLANE","SEP","PIC","CZK",2,"9999.00")}
    ANALYZE;
  `);
  if(result.status!==0)throw new Error(`fixture setup failed:\n${result.stderr||result.stdout}`);
});

after(()=>{
  if(!enabled)return;
  rawPsql(`DROP SCHEMA IF EXISTS ${quotedSchema} CASCADE`);
});

test("Statistics aircraft costs use only the pilot's own non-auxiliary flights in the selected period",{skip:!enabled},()=>{
  const regs=registrations();
  const aaa=regs.get("OK-AAA");
  assert.ok(aaa,"OK-AAA is listed");
  assert.equal(Number(aaa.flights),2);
  const summary=summarizeRegistrationCosts(aaa.cost_rows);
  assert.deepEqual(summary.breakdown,["100.02 CZK"]);
  assert.equal(summary.headline,"100.02 CZK");
  assert.equal(summary.pricedFlights,2);
  assert.equal(summary.complete,true);
});

test("Statistics aircraft costs respect the category filter",{skip:!enabled},()=>{
  const all=registrations();
  assert.deepEqual(summarizeRegistrationCosts(all.get("OK-HEL")?.cost_rows).breakdown,["501 JPY"]);
  const aeroplaneOnly=registrations({category:"AEROPLANE"});
  assert.equal(aeroplaneOnly.has("OK-HEL"),false);
  assert.deepEqual(summarizeRegistrationCosts(aeroplaneOnly.get("OK-AAA")?.cost_rows).breakdown,["100.02 CZK"]);
});

test("Statistics aircraft costs include an earlier year only when the period includes it",{skip:!enabled},()=>{
  const allTime=registrations({start:null,end:null});
  assert.equal(Number(allTime.get("OK-AAA")?.flights),3);
  assert.deepEqual(summarizeRegistrationCosts(allTime.get("OK-AAA")?.cost_rows).breakdown,["3,600.02 CZK"]);
});

test("another pilot's Statistics never include this pilot's flights",{skip:!enabled},()=>{
  const other=registrations({userId:OTHER});
  assert.equal(Number(other.get("OK-AAA")?.flights),1);
  assert.deepEqual(summarizeRegistrationCosts(other.get("OK-AAA")?.cost_rows).breakdown,["4,999.50 CZK"]);
  assert.equal(other.has("OK-HEL"),false);
});
