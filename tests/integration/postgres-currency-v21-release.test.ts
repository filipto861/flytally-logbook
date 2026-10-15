import assert from "node:assert/strict";
import test,{before} from "node:test";
import {readFileSync} from "node:fs";
import {spawnSync} from "node:child_process";
import {resolve} from "node:path";
import {assertCurrencyV21SchemaEvidence} from "../../lib/currency-v21-migration-safety.ts";

// Run ONLY after tooling/run-currency-m2a0-local.ps1 has verified its own fresh
// loopback PostgreSQL16 instance AND set both purpose-bound environment flags.
// This test owns PUBLIC in that disposable database; never run on Neon/other DBs.
const enabled=process.env.FLYTALLY_V21_RELEASE_DISPOSABLE==="1"&&process.env.FLYTALLY_POSTGRES_INTEGRATION==="1";
const url=process.env.DATABASE_URL||"";
const root=resolve(import.meta.dirname,"../..");
const source=(p:string)=>readFileSync(resolve(root,p),"utf8");
const plan=source("lib/migration-plan.ts");
const pre=source("tooling/v380-v21-preflight.sql");
const migrate=source("tooling/v380-v21-migrate.sql");
const post=source("tooling/v380-v21-postflight.sql");
const expectedDb="flytally_currency_test";
const runtime=source("lib/db-optimization.ts");
const runtimeShapeSql=runtime.match(/const shapeRows=await sql`([\s\S]*?)` as Array<CurrencyV21ShapeEvidence>/)?.[1]??"";
if(!runtimeShapeSql||runtimeShapeSql.includes("${"))throw new Error("v21 runtime shape SQL contract missing or interpolated");


function exec(script:string){
  return spawnSync("psql",["-w","-X","-qAt","-v","ON_ERROR_STOP=1",
    "-v","expected_database="+expectedDb,"-d",url],{
    input:script,encoding:"utf8",env:{...process.env,PGCONNECT_TIMEOUT:"5"},maxBuffer:4*1024*1024,
  });
}
function run(script:string){
  const r=exec(script);
  if(r.error)throw r.error;
  if(r.status!==0)throw new Error(String(r.stderr||r.stdout));
  return String(r.stdout||"").trim();
}
function physicalShape(){
  const values=run(runtimeShapeSql).split("|").map(Number);
  assert.equal(values.length,2,"Runtime v21 physical metadata query must return exactly two counts");
  return {columns_count:values[0],checks_count:values[1]};
}

function reject(script:string,pattern:RegExp){
  const r=exec(script);
  if(r.error)throw r.error;
  assert.notEqual(r.status,0,"Invalid migration unexpectedly succeeded");
  assert.match(String(r.stderr||r.stdout),pattern);
}

before(()=>{
  if(!enabled)return;
  const parsed=new URL(url);
  assert.ok(["127.0.0.1","localhost","::1","[::1]"].includes(parsed.hostname),
    "v21 release integration must only target a disposable loopback host");
  assert.equal(decodeURIComponent(parsed.pathname),"/"+expectedDb,"Unexpected test database");
  assert.equal(parsed.username,"flytally","Unexpected test database role");
  const probe=run("SELECT current_database()||'|'||current_user||'|'||host(inet_server_addr())");
  assert.equal(probe,expectedDb+"|flytally|127.0.0.1","Disposable DB identity mismatch");
  assert.equal(run("SELECT count(*) FROM pg_catalog.pg_tables WHERE schemaname='public'"),"0",
    "Public schema not empty: refusing any modification");
  const entries=[...plan.matchAll(/\{version:(\d+),name:"([^"]+)"\}/g)]
    .map(x=>({v:Number(x[1]),n:x[2]})).filter(x=>x.v<=20);
  assert.equal(entries.length,20);
  const names=entries.map(e=>"("+e.v+",'"+e.n.replaceAll("'","''")+"')").join(",");
  run(`
    CREATE TABLE flytally_schema_migrations(version integer PRIMARY KEY,name text NOT NULL,applied_at timestamptz DEFAULT now());
    INSERT INTO flytally_schema_migrations(version,name) VALUES ${names};
    CREATE TABLE rates(id integer PRIMARY KEY,price_per_hour double precision,dry_price_per_hour double precision);
    CREATE TABLE aircraft(id integer PRIMARY KEY,default_price_per_hour double precision);
    CREATE TABLE flights(id integer PRIMARY KEY,price_per_hour double precision,certified_at timestamptz,certification_hash text);
    CREATE TABLE flight_expenses(id integer PRIMARY KEY,amount_minor bigint,currency text);
    CREATE TABLE voided_certified_flights(id integer PRIMARY KEY,flight_snapshot jsonb);
    CREATE TABLE flight_source_provenance(id integer PRIMARY KEY,source_hash text);
    CREATE TABLE account_backups(id integer PRIMARY KEY,payload_sha256 text);
    CREATE FUNCTION logbook_protect_locked_flight() RETURNS trigger AS $$ BEGIN RETURN NEW; END $$ LANGUAGE plpgsql;
    CREATE FUNCTION logbook_protect_source_provenance() RETURNS trigger AS $$ BEGIN RETURN NEW; END $$ LANGUAGE plpgsql;
    CREATE FUNCTION logbook_prevent_voided_flight_id_reuse() RETURNS trigger AS $$ BEGIN RETURN NEW; END $$ LANGUAGE plpgsql;
    CREATE TRIGGER trg_logbook_protect_locked_flight BEFORE UPDATE ON flights
      FOR EACH ROW EXECUTE FUNCTION logbook_protect_locked_flight();
    CREATE TRIGGER trg_logbook_prevent_voided_flight_id_reuse BEFORE INSERT ON flights
      FOR EACH ROW EXECUTE FUNCTION logbook_prevent_voided_flight_id_reuse();
    INSERT INTO rates VALUES(1,3060.25,2500.75);
    INSERT INTO aircraft VALUES(1,3400.5);
    INSERT INTO flights VALUES(1,1200.25,now(),repeat('a',64));
    INSERT INTO flight_expenses VALUES(1,1255,'EUR');
    INSERT INTO voided_certified_flights VALUES(1,'{"original_flight_id":99,"certification_hash":"signed"}'::jsonb);
    INSERT INTO flight_source_provenance VALUES(1,repeat('b',64));
    INSERT INTO account_backups VALUES(1,repeat('c',64));
  `);
});

test("v21 preflight rejects incomplete schema and aborts migration without a registry write",{skip:!enabled},()=>{
  run(pre);
  run("ALTER TABLE rates ADD COLUMN currency_code TEXT");
  reject(pre,/partial or existing monetary columns - fail closed/);
  reject(migrate,/partial or existing monetary columns - fail closed/);
  assert.equal(run("SELECT count(*) FROM flytally_schema_migrations"),"20");
  run("ALTER TABLE rates DROP COLUMN currency_code");
  run(pre);
});

test("pre-registered v21 with NO physical DDL is rejected by the actual runtime shape query",{skip:!enabled},()=>{
  run("INSERT INTO flytally_schema_migrations(version,name) VALUES(21,'source-backed currency exact-money')");
  const state=physicalShape();
  assert.deepEqual(state,{columns_count:0,checks_count:0});
  assert.throws(()=>assertCurrencyV21SchemaEvidence("source-backed currency exact-money",state),/physical shape invalid/);
  run("DELETE FROM flytally_schema_migrations WHERE version=21");
});

test("v21 production artifact applies atomically and preserves legacy and certified evidence",{skip:!enabled},()=>{
  const beforeSnapshot=run(`SELECT
     (SELECT row_to_json(r)::text FROM (SELECT price_per_hour,dry_price_per_hour FROM rates WHERE id=1) r)||'|'||
     (SELECT row_to_json(a)::text FROM (SELECT default_price_per_hour FROM aircraft WHERE id=1) a)||'|'||
     (SELECT row_to_json(f)::text FROM (SELECT price_per_hour,certified_at,certification_hash FROM flights WHERE id=1) f)||'|'||
     (SELECT row_to_json(e)::text FROM (SELECT amount_minor,currency FROM flight_expenses WHERE id=1) e)||'|'||
     (SELECT flight_snapshot::text FROM voided_certified_flights WHERE id=1)||'|'||
     (SELECT source_hash FROM flight_source_provenance WHERE id=1)||'|'||
     (SELECT payload_sha256 FROM account_backups WHERE id=1)`);
  run(migrate);
  run(post);
  const afterSnapshot=run(`SELECT
     (SELECT row_to_json(r)::text FROM (SELECT price_per_hour,dry_price_per_hour FROM rates WHERE id=1) r)||'|'||
     (SELECT row_to_json(a)::text FROM (SELECT default_price_per_hour FROM aircraft WHERE id=1) a)||'|'||
     (SELECT row_to_json(f)::text FROM (SELECT price_per_hour,certified_at,certification_hash FROM flights WHERE id=1) f)||'|'||
     (SELECT row_to_json(e)::text FROM (SELECT amount_minor,currency FROM flight_expenses WHERE id=1) e)||'|'||
     (SELECT flight_snapshot::text FROM voided_certified_flights WHERE id=1)||'|'||
     (SELECT source_hash FROM flight_source_provenance WHERE id=1)||'|'||
     (SELECT payload_sha256 FROM account_backups WHERE id=1)`);
  assert.equal(afterSnapshot,beforeSnapshot);
  assert.equal(run("SELECT count(*) FROM flytally_schema_migrations WHERE version=21 AND name='source-backed currency exact-money'"),"1");
  assert.deepEqual(physicalShape(),{columns_count:12,checks_count:4});
  reject(migrate,/registry must be exactly 1 through 20/);
});

test("v21 executable CHECKs reject malformed exact monetary tuples",{skip:!enabled},()=>{
  run("UPDATE rates SET currency_code='KWD',currency_minor_units=3,price_per_hour_decimal=3060.125 WHERE id=1");
  assert.equal(run("SELECT price_per_hour_decimal::text FROM rates WHERE id=1"),"3060.125");
  reject("UPDATE rates SET currency_minor_units=NULL WHERE id=1",/rates_exact_currency_tuple_v21_check/);
  reject("UPDATE rates SET price_per_hour_decimal='Infinity'::numeric WHERE id=1",/rates_exact_currency_tuple_v21_check/);
  run("UPDATE flight_expenses SET amount_encoding='iso_minor_units',amount_minor_units=3 WHERE id=1");
  reject("UPDATE flight_expenses SET amount_minor_units=NULL WHERE id=1",/expenses_amount_encoding_v21_check/);
});

test("pre-registered v21 with missing validated CHECK or missing column refuses runtime shape evidence",{skip:!enabled},()=>{
  assert.deepEqual(physicalShape(),{columns_count:12,checks_count:4});
  run("ALTER TABLE rates DROP CONSTRAINT rates_exact_currency_tuple_v21_check");
  const noCheck=physicalShape();
  assert.deepEqual(noCheck,{columns_count:12,checks_count:3});
  assert.throws(()=>assertCurrencyV21SchemaEvidence("source-backed currency exact-money",noCheck),/physical shape invalid/);
  run("ALTER TABLE rates DROP COLUMN currency_code");
  const noColumn=physicalShape();
  assert.deepEqual(noColumn,{columns_count:11,checks_count:3});
  assert.throws(()=>assertCurrencyV21SchemaEvidence("source-backed currency exact-money",noColumn),/physical shape invalid/);
});
