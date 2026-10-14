import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {spawnSync} from "node:child_process";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
import {after,before,test} from "node:test";

// Focused integration test on a disposable schema with the *actual v20 trigger*.
// NOT a full v20 database migration/portable signed-backup end-to-end test.
const enabled=process.env.FLYTALLY_POSTGRES_INTEGRATION==="1";
let schemaCreated=false;
const databaseUrl=process.env.DATABASE_URL||"";
const schema="ft_currency_"+randomUUID().replaceAll("-","");
const quoted='"'+schema+'"';
const root=resolve(import.meta.dirname,"../..");
const draft=readFileSync(resolve(root,"sql/drafts/3_8_0_currency_v21_additive_candidate.sql"),"utf8");
const dbSource=readFileSync(resolve(root,"lib/db-optimization.ts"),"utf8");

function execSql(statement:string,withSchema=true){
  return spawnSync("psql",["-w","-d",databaseUrl,"-X","-v","ON_ERROR_STOP=1","-qAt"],{
    input:(withSchema?"SET search_path TO "+quoted+";\n":"")+statement,
    encoding:"utf8",env:{...process.env,PGCONNECT_TIMEOUT:"5"},maxBuffer:4*1024*1024,
  });
}
function run(statement:string){
  const result=execSql(statement);
  if(result.error)throw result.error;
  if(result.status!==0)throw new Error(String(result.stderr||result.stdout));
  return String(result.stdout||"").trim();
}
function reject(statement:string,pattern:RegExp){
  const result=execSql(statement);
  if(result.error)throw result.error;
  assert.notEqual(result.status,0,"An invalid currency mutation succeeded");
  assert.match(String(result.stderr||result.stdout),pattern);
}
function rows(query:string):Array<Record<string,unknown>>{
  return JSON.parse(run("SELECT COALESCE(json_agg(row_to_json(t)),'[]'::json)::text FROM ("+query+") t")||"[]");
}
function installedFlightProtection(){
  const blocks=[...dbSource.matchAll(/sql`([\s\S]*?)`/g)].map(m=>m[1])
    .filter(s=>s.includes("CREATE OR REPLACE FUNCTION logbook_protect_locked_flight()"));
  const latest=blocks.at(-1);
  assert.ok(latest&&latest.includes("certified_void_transition"),
    "Unable to find real v20 certification protection function");
  assert.equal(latest.includes("$"+"{"),false,"Unexpected interpolated SQL block");
  return latest;
}
before(()=>{
  if(!enabled)return;
  const url=new URL(databaseUrl);
  assert.ok(["127.0.0.1","localhost","::1","[::1]"].includes(url.hostname),
    "This test must never target a remote database");
  const probe=execSql("SELECT current_database() || '|' || current_user || '|' || inet_server_port()",false);
  if(probe.error)throw new Error("Local PostgreSQL preflight failed (psql unavailable); currency tests NOT RUN.");
  if(probe.status!==0)throw new Error("Local PostgreSQL preflight failed (authentication/connection); currency tests NOT RUN. Verify a disposable localhost test DB and noninteractive credentials before rerunning.");
  assert.ok(String(probe.stdout).includes("|"),"Unexpected local PostgreSQL identity response");
  const created=execSql("CREATE SCHEMA "+quoted,false);
  if(created.error)throw created.error;
  if(created.status!==0)throw new Error(String(created.stderr||created.stdout));
  schemaCreated=true;
  run(`
    CREATE TABLE users(id BIGINT PRIMARY KEY);
    CREATE TABLE flights(
      id BIGINT PRIMARY KEY,user_id BIGINT NOT NULL REFERENCES users(id),
      date DATE,price_per_hour DOUBLE PRECISION,billing_basis TEXT,
      certified_at TIMESTAMPTZ,certified_by_user_id BIGINT,
      certification_hash TEXT NOT NULL DEFAULT '',certification_version INT NOT NULL DEFAULT 8,
      locked_at TIMESTAMPTZ,locked_by_user_id BIGINT,
      record_revision INT NOT NULL DEFAULT 1,correction_reason TEXT NOT NULL DEFAULT '',
      correction_opened_at TIMESTAMPTZ,correction_opened_by_user_id BIGINT
    );
    CREATE TABLE flight_certified_revisions(
      id BIGINT PRIMARY KEY,flight_id BIGINT,user_id BIGINT,
      revision_number INT,certification_hash TEXT
    );
    CREATE TABLE voided_certified_flights(
      id BIGINT PRIMARY KEY,user_id BIGINT,original_flight_id BIGINT,
      record_revision INT,certification_hash TEXT,created_txid BIGINT,flight_snapshot JSONB
    );
    CREATE TABLE rates(
      id BIGINT PRIMARY KEY,user_id BIGINT,registration TEXT,valid_from TEXT,
      price_per_hour DOUBLE PRECISION,dry_price_per_hour DOUBLE PRECISION,
      UNIQUE(user_id,registration,valid_from)
    );
    CREATE TABLE aircraft(
      id BIGINT PRIMARY KEY,user_id BIGINT,registration TEXT,
      default_price_per_hour DOUBLE PRECISION
    );
    CREATE TABLE flight_expenses(
      id BIGINT PRIMARY KEY,user_id BIGINT,flight_id BIGINT,
      category TEXT NOT NULL,label TEXT NOT NULL DEFAULT '',
      amount_minor BIGINT NOT NULL CHECK(amount_minor>0 AND amount_minor<=1000000000),
      currency TEXT NOT NULL CHECK(currency ~ '^[A-Z]{3}$')
    );
    INSERT INTO users(id) VALUES(1);
    INSERT INTO flights(id,user_id,date,price_per_hour,billing_basis) VALUES
      (101,1,'2026-10-10',3060.25,'BLOCK'),(102,1,'2026-10-10',NULL,NULL);
    INSERT INTO flights(id,user_id,date,price_per_hour,billing_basis,
      certified_at,certified_by_user_id,certification_hash,locked_at,locked_by_user_id)
      VALUES
      (100,1,'2026-10-09',1000.5,'BLOCK',NOW(),1,repeat('a',64),NOW(),1),
      (110,1,'2026-10-08',2000.5,'BLOCK',NOW(),1,repeat('b',64),NOW(),1);
    INSERT INTO flight_certified_revisions(id,flight_id,user_id,revision_number,certification_hash)
      VALUES(1,100,1,1,repeat('a',64));
    INSERT INTO rates(id,user_id,registration,valid_from,price_per_hour,dry_price_per_hour)
      VALUES(1,1,'OK-ABC','2026-01-01',3060.25,2540.75);
    INSERT INTO aircraft(id,user_id,registration,default_price_per_hour)
      VALUES(1,1,'OK-ABC',3000.5);
    INSERT INTO flight_expenses(id,user_id,flight_id,category,amount_minor,currency)
      VALUES(1,1,101,'LANDING',1000,'JPY'),(2,1,101,'PARKING',1255,'EUR');
  `);
  run(installedFlightProtection());
  run("CREATE TRIGGER trg_logbook_protect_locked_flight BEFORE UPDATE OR DELETE ON flights FOR EACH ROW EXECUTE FUNCTION logbook_protect_locked_flight()");
});
after(()=>{
  if(!enabled||!schemaCreated)return;
  const result=execSql("DROP SCHEMA IF EXISTS "+quoted+" CASCADE",false);
  if(result.error)throw result.error;
  assert.equal(result.status,0,String(result.stderr||result.stdout));
});

test("candidate applies twice, preserves legacy prices, certifications and row counts",{skip:!enabled},()=>{
  const source={
    flights:rows("SELECT id,price_per_hour,certification_hash,locked_at IS NOT NULL AS locked FROM flights ORDER BY id"),
    rates:rows("SELECT id,price_per_hour,dry_price_per_hour FROM rates ORDER BY id"),
    aircraft:rows("SELECT id,default_price_per_hour FROM aircraft"),
    expenses:rows("SELECT id,amount_minor,currency FROM flight_expenses ORDER BY id")
  };
  run(draft);
  run(draft);
  assert.deepEqual(rows("SELECT id,price_per_hour,certification_hash,locked_at IS NOT NULL AS locked FROM flights ORDER BY id"),source.flights);
  assert.deepEqual(rows("SELECT id,price_per_hour,dry_price_per_hour FROM rates ORDER BY id"),source.rates);
  assert.deepEqual(rows("SELECT id,default_price_per_hour FROM aircraft"),source.aircraft);
  assert.deepEqual(rows("SELECT id,amount_minor,currency FROM flight_expenses ORDER BY id"),source.expenses);
  assert.equal(run("SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=current_schema() AND ((table_name='rates' AND column_name IN ('currency_code','currency_minor_units','price_per_hour_decimal','dry_price_per_hour_decimal')) OR (table_name='aircraft' AND column_name IN ('default_price_currency_code','default_price_currency_minor_units','default_price_per_hour_decimal')) OR (table_name='flights' AND column_name IN ('price_currency_code','price_currency_minor_units','price_per_hour_decimal')) OR (table_name='flight_expenses' AND column_name IN ('amount_encoding','amount_minor_units')))"),"12");
  assert.equal(run("SELECT COUNT(*) FROM pg_constraint WHERE connamespace=current_schema()::regnamespace AND conname IN ('rates_exact_currency_tuple_v21_check','aircraft_exact_currency_tuple_v21_check','flights_exact_currency_tuple_v21_check','expenses_amount_encoding_v21_check')"),"4");
  assert.equal(run("SELECT COUNT(*) FROM flights WHERE price_currency_code IS NOT NULL"),"0");
});
test("exact tuples accept JPY/EUR/KWD scale and reject malformed/null/NaN/Infinity",{skip:!enabled},()=>{
  run("UPDATE rates SET currency_code='EUR',currency_minor_units=2,price_per_hour_decimal=3060.25001 WHERE id=1");
  run("UPDATE aircraft SET default_price_currency_code='JPY',default_price_currency_minor_units=0,default_price_per_hour_decimal=1200 WHERE id=1");
  run("UPDATE flights SET price_currency_code='KWD',price_currency_minor_units=3,price_per_hour_decimal=1500.125 WHERE id=101");
  assert.equal(run("SELECT currency_code||':'||currency_minor_units FROM rates WHERE id=1"),"EUR:2");
  assert.equal(run("SELECT price_currency_code||':'||price_currency_minor_units FROM flights WHERE id=101"),"KWD:3");
  reject("UPDATE rates SET currency_minor_units=NULL WHERE id=1",/rates_exact_currency_tuple_v21_check/);
  reject("UPDATE rates SET price_per_hour_decimal='NaN'::numeric WHERE id=1",/rates_exact_currency_tuple_v21_check/);
  reject("UPDATE rates SET price_per_hour_decimal='Infinity'::numeric WHERE id=1",/rates_exact_currency_tuple_v21_check/);
  reject("UPDATE aircraft SET default_price_currency_code=NULL WHERE id=1",/aircraft_exact_currency_tuple_v21_check/);
  reject("UPDATE flights SET price_currency_minor_units=NULL WHERE id=101",/flights_exact_currency_tuple_v21_check/);
  reject("UPDATE flights SET price_currency_code='BAD1' WHERE id=101",/flights_exact_currency_tuple_v21_check/);
});
test("legacy expense encoding remains NULL/NULL; new encoding is explicit",{skip:!enabled},()=>{
  assert.deepEqual(rows("SELECT id,currency,amount_minor,amount_encoding,amount_minor_units FROM flight_expenses ORDER BY id"),[
    {id:1,currency:"JPY",amount_minor:1000,amount_encoding:null,amount_minor_units:null},
    {id:2,currency:"EUR",amount_minor:1255,amount_encoding:null,amount_minor_units:null},
  ]);
  run("INSERT INTO flight_expenses(id,user_id,flight_id,category,amount_minor,currency,amount_encoding,amount_minor_units) VALUES(3,1,101,'OTHER',500,'KWD','iso_minor_units',3)");
  reject("UPDATE flight_expenses SET amount_minor_units=NULL WHERE id=3",/expenses_amount_encoding_v21_check/);
  reject("UPDATE flight_expenses SET amount_encoding=NULL WHERE id=3",/expenses_amount_encoding_v21_check/);
  reject("UPDATE flight_expenses SET amount_encoding='legacy_two_decimal' WHERE id=3",/expenses_amount_encoding_v21_check/);
  assert.equal(run("SELECT amount_minor||':'||COALESCE(amount_encoding,'legacy_two_decimal') FROM flight_expenses WHERE id=1"),"1000:legacy_two_decimal");
});
test("pre-3.8.0 JSON records restore without inferring currency or amount scale",{skip:!enabled},()=>{
  run(`INSERT INTO rates SELECT (json_populate_record(NULL::rates,
    '{"id":2,"user_id":1,"registration":"OK-OLD","valid_from":"2020-01-01","price_per_hour":999.25}'::json)).*`);
  run(`INSERT INTO flights SELECT (json_populate_record(NULL::flights,
    '{"id":120,"user_id":1,"date":"2020-01-01","price_per_hour":850.5,"billing_basis":"BLOCK","certification_hash":"","certification_version":8,"record_revision":1,"correction_reason":""}'::json)).*`);
  run(`INSERT INTO flight_expenses SELECT (json_populate_record(NULL::flight_expenses,
    '{"id":4,"user_id":1,"flight_id":120,"category":"LANDING","label":"","amount_minor":1000,"currency":"JPY"}'::json)).*`);
  assert.equal(run("SELECT COALESCE(currency_code,'unknown') FROM rates WHERE id=2"),"unknown");
  assert.equal(run("SELECT COALESCE(price_currency_code,'unknown') FROM flights WHERE id=120"),"unknown");
  assert.equal(run("SELECT COALESCE(amount_encoding,'legacy_two_decimal') FROM flight_expenses WHERE id=4"),"legacy_two_decimal");
});
test("v20 certified flight protection rejects relabel and preserves valid correction",{skip:!enabled},()=>{
  reject("UPDATE flights SET price_currency_code='CZK',price_currency_minor_units=2,price_per_hour_decimal=1000.5 WHERE id=100",/Certified flight is immutable/);
  run("UPDATE flights SET certified_at=NULL,certified_by_user_id=NULL,certification_hash='',locked_at=NULL,locked_by_user_id=NULL,record_revision=2,correction_reason='Source correction',correction_opened_at=NOW(),correction_opened_by_user_id=1 WHERE id=100");
  assert.equal(run("SELECT record_revision||':'||COALESCE(price_currency_code,'unknown') FROM flights WHERE id=100"),"2:unknown");
  reject("DELETE FROM flights WHERE id=110",/Certified flight cannot be deleted/);
});
test("v20 void trigger requires same-transaction exact to_jsonb(OLD) snapshot",{skip:!enabled},()=>{
  run(`BEGIN;
    INSERT INTO voided_certified_flights(id,user_id,original_flight_id,record_revision,certification_hash,created_txid,flight_snapshot)
      SELECT 1,user_id,id,record_revision,certification_hash,txid_current(),to_jsonb(f)
      FROM flights f WHERE id=110;
    DELETE FROM flights WHERE id=110;
    COMMIT;`);
  assert.equal(run("SELECT COUNT(*) FROM flights WHERE id=110"),"0");
  assert.equal(run("SELECT flight_snapshot->>'price_per_hour' FROM voided_certified_flights WHERE id=1"),"2000.5");
});

test("v21 monetary draft and expense snapshot restore exactly in one disposable PostgreSQL transaction",{skip:!enabled},()=>{
  const flight=JSON.stringify({id:130,user_id:1,date:"2026-10-12",billing_basis:"BLOCK",price_per_hour:1234.125,price_currency_code:"KWD",price_currency_minor_units:3,price_per_hour_decimal:"1234.125",certification_hash:"",certification_version:8,record_revision:1,correction_reason:""});
  const expense=JSON.stringify({id:31,user_id:1,flight_id:130,category:"LANDING",label:"Fee",amount_minor:12345,currency:"KWD",amount_encoding:"iso_minor_units",amount_minor_units:3});
  // Typed JSON restore is already the canonical exact-account restore mechanism.
  // Both INSERTs share one database transaction; no missing currency defaults.
  run("BEGIN; INSERT INTO flights SELECT (json_populate_record(NULL::flights,'"+flight.replaceAll("'","''")+"'::json)).*; INSERT INTO flight_expenses SELECT (json_populate_record(NULL::flight_expenses,'"+expense.replaceAll("'","''")+"'::json)).*; COMMIT;");
  assert.deepEqual(rows("SELECT price_currency_code,price_currency_minor_units,price_per_hour_decimal::text rate FROM flights WHERE id=130"),
    [{price_currency_code:"KWD",price_currency_minor_units:3,rate:"1234.125"}]);
  assert.deepEqual(rows("SELECT amount_minor,currency,amount_encoding,amount_minor_units FROM flight_expenses WHERE id=31"),
    [{amount_minor:12345,currency:"KWD",amount_encoding:"iso_minor_units",amount_minor_units:3}]);
  assert.equal(run("SELECT COUNT(*) FROM flights WHERE id=130 AND certified_at IS NOT NULL"),"0");
});

test("invalid currency-bearing expense rolls back the parent flight in the same transaction",{skip:!enabled},()=>{
  const flight=JSON.stringify({id:131,user_id:1,date:"2026-10-12",price_per_hour:1200,price_currency_code:"JPY",price_currency_minor_units:0,price_per_hour_decimal:"1200",certification_hash:"",certification_version:8,record_revision:1,correction_reason:""});
  const badExpense=JSON.stringify({id:32,user_id:1,flight_id:131,category:"LANDING",label:"Invalid precision fixture",amount_minor:1000,currency:"JPY",amount_encoding:"iso_minor_units",amount_minor_units:null});
  reject("BEGIN; INSERT INTO flights SELECT (json_populate_record(NULL::flights,'"+flight.replaceAll("'","''")+"'::json)).*; INSERT INTO flight_expenses SELECT (json_populate_record(NULL::flight_expenses,'"+badExpense.replaceAll("'","''")+"'::json)).*; COMMIT;",/expenses_amount_encoding_v21_check/);
  assert.equal(run("SELECT COUNT(*) FROM flights WHERE id=131"),"0");
  assert.equal(run("SELECT COUNT(*) FROM flight_expenses WHERE id=32"),"0");
});
