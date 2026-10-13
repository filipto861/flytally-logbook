import assert from "node:assert/strict";
import {createHash,randomUUID} from "node:crypto";
import {readFileSync} from "node:fs";
import {spawn,spawnSync} from "node:child_process";
import {before,after,test} from "node:test";
import {validateDisposablePgTarget,verifyDisposablePg16Identity} from "../../tooling/currency-a1t2b-local-target.ts";

// D1 only: reduced-fixture PG16 test, NOT app runtime or a full-v20 restore.
const source=readFileSync(new URL("../fixtures/a1t2c-reduced-atomic-restore-prototype.sql",import.meta.url),"utf8").replace(/\r\n/g,"\n");
const v21=readFileSync(new URL("../fixtures/currency-v21-a1t2b-from-322.sql",import.meta.url),"utf8").replace(/\r\n/g,"\n");
function blobHash(s:string){const b=Buffer.from(s,"utf8");return createHash("sha1").update("blob "+b.length+"\0").update(b).digest("hex")}
const asked=process.env.FLYTALLY_POSTGRES_INTEGRATION==="1"||process.env.FLYTALLY_A1T2C_DISPOSABLE==="1";
const permitted=process.env.FLYTALLY_POSTGRES_INTEGRATION==="1"&&process.env.FLYTALLY_A1T2C_DISPOSABLE==="1";
const url=process.env.DATABASE_URL||"";
const schema="a1t2c_"+randomUUID().replaceAll("-","");
let created=false;
function pgEnv():NodeJS.ProcessEnv {
  const e:NodeJS.ProcessEnv={...process.env,PGCONNECT_TIMEOUT:"5"};
  for(const key of Object.keys(e))if(key.startsWith("PG")&&key!=="PGCONNECT_TIMEOUT")delete e[key];
  return e;
}
function invoke(q:string,scoped=true){
  return spawnSync("psql",["-X","-w","-qAt","-v","ON_ERROR_STOP=1","-d",url],{
    input:(scoped?'SET search_path TO "'+schema+'";\n':"")+q,
    env:pgEnv(),encoding:"utf8",maxBuffer:4000000,timeout:20000,
  });
}
function run(q:string,scoped=true){
  const r=invoke(q,scoped);
  if(r.error)throw r.error;
  if(r.status!==0)throw new Error("Disposable PG16 step failed: "+String(r.stderr).slice(0,500));
  return String(r.stdout).trim();
}
function expectError(q:string,re:RegExp){
  const r=invoke(q);
  if(r.error)throw r.error;
  assert.notEqual(r.status,0,"Expected transaction rollback");
  assert.match(String(r.stderr),re);
}
function concurrentRestore(id:number,delay:number):Promise<string>{
  return new Promise((resolve,reject)=>{
    const p=spawn("psql",["-X","-w","-qAt","-v","ON_ERROR_STOP=1","-d",url],{env:pgEnv()});
    let out="",err="";
    p.stdout.setEncoding("utf8").on("data",(x:string)=>{out+=x});
    p.stderr.setEncoding("utf8").on("data",(x:string)=>{err+=x});
    p.on("error",reject);
    p.on("close",code=>code===0?resolve(out.trim()):reject(new Error(err.slice(0,500))));
    p.stdin.end('SET search_path TO "'+schema+'"; SELECT * FROM a1t2c_try_restore(1,'+id+','+delay+');');
  });
}
const quote=(value:string)=>"'"+value.replaceAll("'","''")+"'";
function seed(date:string,registration:string,exact?:{code:string;units:number;rate:string;expenseCode:string;encoding:string;expenseUnits:number}){
  const flightId=Number(run("INSERT INTO flights(user_id,date,registration,off_block,departure,arrival,price_per_hour,billing_basis,note,price_currency_code,price_currency_minor_units,price_per_hour_decimal) VALUES(1,"+
    quote(date)+","+quote(registration)+",'07:00','LKPR','LKTB',36.25,'BLOCK','seed',"+
    (exact?quote(exact.code):"NULL")+","+(exact?exact.units:"NULL")+","+(exact?exact.rate:"NULL")+") RETURNING id"));
  run("INSERT INTO flight_tracks(user_id,flight_id,file_name,point_count,distance_km,coordinates_json,overview_coordinates_json,overview_version) VALUES(1,"+flightId+",'trace.gpx',2,12.5,'[[1,2]]','[[1,2]]',1)");
  run("INSERT INTO flight_expenses(user_id,flight_id,category,label,amount_minor,currency,amount_encoding,amount_minor_units) VALUES(1,"+flightId+",'LANDING','Fee',1255,"+
     quote(exact?exact.expenseCode:"CZK")+","+(exact?quote(exact.encoding):"NULL")+","+(exact?exact.expenseUnits:"NULL")+")");
  const id=Number(run("INSERT INTO deleted_flights(user_id,original_flight_id,flight_data,tracks_data,expenses_data) SELECT f.user_id,f.id,to_jsonb(f),COALESCE((SELECT jsonb_agg(to_jsonb(t)) FROM flight_tracks t WHERE t.flight_id=f.id),'[]'::jsonb),COALESCE((SELECT jsonb_agg(to_jsonb(e)) FROM flight_expenses e WHERE e.flight_id=f.id),'[]'::jsonb) FROM flights f WHERE f.id="+flightId+" RETURNING id"));
  run("DELETE FROM flights WHERE id="+flightId);
  return id;
}
function restore(id:number) {
  const [status,flightId=""]=run("SELECT * FROM a1t2c_try_restore(1,"+id+");").split("|");
  return {status,flightId};
}
test("A1-T2c prototype static safety properties and exact pinned v21 DDL",()=>{
  assert.match(source,/TEST-ONLY prototype/);
  assert.match(source,/FOR UPDATE/);
  assert.match(source,/RAISE EXCEPTION/);
  assert.match(source,/pg_advisory_xact_lock/);
  assert.doesNotMatch(source,/\bASSERT\b/i);
  assert.equal(blobHash(v21),"74b482b265cf3085a99ccbf2837614f382b04ed5");
});
before(()=>{
  if(!asked)return;
  if(!permitted)throw new Error("Both disposable PG16 flags are mandatory");
  const target=validateDisposablePgTarget(url);
  assert.equal(target.ok,true,"Refusing non-disposable/remote DB");
  if(!target.ok)return;
  const actual=JSON.parse(run("SELECT json_build_object('database',current_database(),'user',current_user,'address',host(inet_server_addr()),'port',inet_server_port(),'serverVersionNumber',current_setting('server_version_num'))::text",false));
  assert.equal(verifyDisposablePg16Identity(actual,target.target),true);
  run('CREATE SCHEMA "'+schema+'"',false);created=true;
  const setup=[
    "CREATE TABLE flights(id BIGSERIAL PRIMARY KEY,user_id BIGINT NOT NULL,date DATE NOT NULL,registration TEXT NOT NULL,off_block TEXT,departure TEXT,arrival TEXT,price_per_hour DOUBLE PRECISION,billing_basis TEXT,note TEXT,certified_at TIMESTAMPTZ,locked_at TIMESTAMPTZ,certification_hash TEXT NOT NULL DEFAULT '',record_revision INT NOT NULL DEFAULT 1)",
    "CREATE TABLE rates(id BIGSERIAL PRIMARY KEY,price_per_hour DOUBLE PRECISION,dry_price_per_hour DOUBLE PRECISION)",
    "CREATE TABLE aircraft(id BIGSERIAL PRIMARY KEY,default_price_per_hour DOUBLE PRECISION)",
    "CREATE TABLE flight_tracks(id BIGSERIAL PRIMARY KEY,user_id BIGINT NOT NULL,flight_id BIGINT NOT NULL REFERENCES flights(id) ON DELETE CASCADE,file_name TEXT,imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),point_count INT,distance_km NUMERIC,start_utc TIMESTAMPTZ,end_utc TIMESTAMPTZ,min_alt_m NUMERIC,max_alt_m NUMERIC,coordinates_json TEXT,overview_coordinates_json TEXT,overview_version INT)",
    "CREATE TABLE flight_expenses(id BIGSERIAL PRIMARY KEY,user_id BIGINT NOT NULL,flight_id BIGINT NOT NULL REFERENCES flights(id) ON DELETE CASCADE,category TEXT NOT NULL CHECK(category IN ('LANDING','HANDLING','PARKING','FUEL','OTHER')),label TEXT NOT NULL,amount_minor BIGINT NOT NULL CHECK(amount_minor>0 AND amount_minor<=1000000000),currency TEXT NOT NULL CHECK(currency ~ '^[A-Z]{3}$'),created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())",
    "CREATE TABLE deleted_flights(id BIGSERIAL PRIMARY KEY,user_id BIGINT NOT NULL,original_flight_id BIGINT NOT NULL,flight_data JSONB NOT NULL,tracks_data JSONB NOT NULL DEFAULT '[]'::jsonb,expenses_data JSONB NOT NULL DEFAULT '[]'::jsonb,purge_after TIMESTAMPTZ NOT NULL DEFAULT NOW()+INTERVAL '90 days',restored_at TIMESTAMPTZ,restored_flight_id BIGINT)",
    "CREATE TABLE flight_certified_revisions(user_id BIGINT NOT NULL,flight_id BIGINT NOT NULL)"
  ];
  run(setup.join(";\n")+";");
  run(v21);
  run(source);
});
after(()=>{if(created)run('DROP SCHEMA "'+schema+'" CASCADE',false)});
test("legacy unresolved flight price and recorded CZK expense are preserved",{skip:!asked},()=>{
  const t=seed("2026-10-01","OK-A01");
  const result=restore(t);
  assert.equal(result.status,"restored");
  assert.equal(run("SELECT price_currency_code IS NULL FROM flights WHERE id="+result.flightId),"t");
  assert.equal(run("SELECT currency||':'||amount_minor||':'||COALESCE(amount_encoding,'legacy') FROM flight_expenses WHERE flight_id="+result.flightId),"CZK:1255:legacy");
  assert.equal(run("SELECT count(*) FROM flight_tracks WHERE flight_id="+result.flightId),"1");
});
test("exact EUR/JPY and KWD monetary tuples roundtrip",{skip:!asked},()=>{
  const t=seed("2026-10-02","OK-A02",{code:"EUR",units:2,rate:"3060.25001001",expenseCode:"JPY",encoding:"iso_minor_units",expenseUnits:0});
  const r=restore(t);assert.equal(r.status,"restored");
  assert.equal(run("SELECT price_currency_code||':'||price_currency_minor_units||':'||price_per_hour_decimal::TEXT FROM flights WHERE id="+r.flightId),"EUR:2:3060.25001001");
  assert.equal(run("SELECT currency||':'||amount_minor||':'||amount_encoding||':'||amount_minor_units FROM flight_expenses WHERE flight_id="+r.flightId),"JPY:1255:iso_minor_units:0");
  const k=seed("2026-10-03","OK-A03",{code:"KWD",units:3,rate:"100.12511",expenseCode:"KWD",encoding:"iso_minor_units",expenseUnits:3});
  assert.equal(restore(k).status,"restored");
});
test("missing archived currency fails closed, without any restored rows",{skip:!asked},()=>{
  const t=seed("2026-10-04","OK-A04");
  run("UPDATE deleted_flights SET expenses_data=(SELECT jsonb_agg(e-'currency') FROM jsonb_array_elements(expenses_data) e) WHERE id="+t);
  expectError("SELECT * FROM a1t2c_try_restore(1,"+t+");",/a1t2c_expense_source_invalid/);
  assert.equal(run("SELECT count(*) FROM flights WHERE registration='OK-A04'"),"0");
  assert.equal(run("SELECT restored_at IS NULL FROM deleted_flights WHERE id="+t),"t");
});
test("late expense CHECK error rolls back new flight and track",{skip:!asked},()=>{
  const t=seed("2026-10-05","OK-A05");
  run("UPDATE deleted_flights SET expenses_data=(SELECT jsonb_agg(jsonb_set(e,'{category}','\"INVALID\"'::jsonb)) FROM jsonb_array_elements(expenses_data) e) WHERE id="+t);
  expectError("SELECT * FROM a1t2c_try_restore(1,"+t+");",/violates check constraint/);
  assert.equal(run("SELECT count(*) FROM flights WHERE registration='OK-A05'"),"0");
  assert.equal(run("SELECT restored_at IS NULL FROM deleted_flights WHERE id="+t),"t");
});
test("expired/already-restored and existing normalized duplicate cause no write",{skip:!asked},()=>{
  const a=seed("2026-10-06","OK-A06");
  assert.equal(restore(a).status,"restored");assert.equal(restore(a).status,"not_found_or_expired");
  const b=seed("2026-10-07","OK-A07");
  run("UPDATE deleted_flights SET purge_after=NOW()-INTERVAL '1 minute' WHERE id="+b);
  assert.equal(restore(b).status,"not_found_or_expired");
  const d=seed("2026-10-08","OK-A08");
  run("INSERT INTO flights(user_id,date,registration,off_block,departure,arrival) VALUES(1,'2026-10-08',' ok-a08 ','07:00','LKPR','LKTB')");
  assert.equal(restore(d).status,"duplicate");
});
test("certified history and revision snapshot reject",{skip:!asked},()=>{
  const a=seed("2026-10-09","OK-A09");
  run("UPDATE deleted_flights SET flight_data=jsonb_set(flight_data,'{record_revision}','2'::jsonb) WHERE id="+a);
  expectError("SELECT * FROM a1t2c_try_restore(1,"+a+");",/a1t2c_protected_archive/);
  const b=seed("2026-10-10","OK-A10");
  run("INSERT INTO flight_certified_revisions(user_id,flight_id) SELECT user_id,original_flight_id FROM deleted_flights WHERE id="+b);
  expectError("SELECT * FROM a1t2c_try_restore(1,"+b+");",/a1t2c_protected_archive/);
});
test("tampered original ownership and malformed exact tuple both fail closed",{skip:!asked},()=>{
  const a=seed("2026-10-13","OK-A13");
  run("UPDATE deleted_flights SET flight_data=jsonb_set(flight_data,'{user_id}','999'::jsonb) WHERE id="+a);
  expectError("SELECT * FROM a1t2c_try_restore(1,"+a+");",/a1t2c_invalid_archive/);
  assert.equal(run("SELECT restored_at IS NULL FROM deleted_flights WHERE id="+a),"t");
  const b=seed("2026-10-14","OK-A14");
  run("UPDATE deleted_flights SET flight_data=jsonb_set(flight_data,'{price_currency_code}','\"EUR\"'::jsonb) WHERE id="+b);
  expectError("SELECT * FROM a1t2c_try_restore(1,"+b+");",/a1t2c_invalid_flight_money/);
  assert.equal(run("SELECT count(*) FROM flights WHERE registration='OK-A14'"),"0");
});
test("empty child arrays restore without invented children",{skip:!asked},()=>{
  const t=seed("2026-10-15","OK-A15");
  run("UPDATE deleted_flights SET tracks_data='[]'::jsonb,expenses_data='[]'::jsonb WHERE id="+t);
  const r=restore(t);
  assert.equal(r.status,"restored");
  assert.equal(run("SELECT count(*) FROM flight_tracks WHERE flight_id="+r.flightId),"0");
  assert.equal(run("SELECT count(*) FROM flight_expenses WHERE flight_id="+r.flightId),"0");
});
test("two independent sessions on SAME trash restore only once",{skip:!asked},async()=>{
  const t=seed("2026-10-11","OK-A11");
  const responses=await Promise.all([concurrentRestore(t,450),concurrentRestore(t,0)]);
  assert.deepEqual(responses.map(x=>x.split("|")[0]).sort(),["not_found_or_expired","restored"]);
});
test("two independent trash IDs, same normalized identity, serialize cooperating restores",{skip:!asked},async()=>{
  const a=seed("2026-10-12","OK-A12"),b=seed("2026-10-12","OK-A12");
  const responses=await Promise.all([concurrentRestore(a,450),concurrentRestore(b,0)]);
  assert.deepEqual(responses.map(x=>x.split("|")[0]).sort(),["duplicate","restored"]);
  assert.equal(run("SELECT count(*) FROM flights WHERE registration='OK-A12'"),"1");
});
