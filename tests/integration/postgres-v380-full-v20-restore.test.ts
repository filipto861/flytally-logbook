import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {readFileSync} from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {spawnSync,spawn} from "node:child_process";
import {before,test} from "node:test";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../..");
const restoreSource=readFileSync(path.join(root,"lib/flight-trash.ts"),"utf8");
const start=restoreSource.indexOf("export async function restoreDeletedFlightRecord");
assert.ok(start>=0,"Restore function not found");
const restoreBlock=restoreSource.slice(start);
// Parse both canonical branches, then execute ONLY the historical v20 SQL
// from the explicit currencyRestore=false branch in the isolated v20 fixture.
// Runtime transaction now passes the selected restoreQuery as its second query.
const branches=restoreBlock.match(/const restoreQuery=currencyRestore \? sql`(WITH candidate AS MATERIALIZED[\s\S]*?)`\s*:\s*sql`(WITH candidate AS MATERIALIZED[\s\S]*?)`;\s*const tx=await sql\.transaction\(\[\s*sql`([\s\S]*?)`,\s*restoreQuery\],\{isolationLevel:'ReadCommitted'\}\);const rows=tx\[1\] as Array<\{restored_flight_id:number\|string\}>/);
assert.ok(branches,"Both guarded currency and legacy restore SQL and their atomic advisory-lock transaction must exist");
const [,currencyTagged,tagged,advisory]=branches;
assert.match(currencyTagged,/price_currency_code,price_currency_minor_units,price_per_hour_decimal/);
assert.match(currencyTagged,/LIMIT 1 FOR UPDATE OF deleted_flights/);
assert.match(tagged,/LIMIT 1 FOR UPDATE OF deleted_flights/);
assert.match(advisory,/pg_advisory_xact_lock\(hashtextextended\(concat_ws/);
const asked=process.env.FLYTALLY_POSTGRES_INTEGRATION==="1"||process.env.FLYTALLY_D2_FULL_V20_DISPOSABLE==="1";
const enabled=process.env.FLYTALLY_POSTGRES_INTEGRATION==="1"&&process.env.FLYTALLY_D2_FULL_V20_DISPOSABLE==="1";
const url=process.env.DATABASE_URL||"";
function safeEnv():NodeJS.ProcessEnv{
  const env:NodeJS.ProcessEnv={...process.env,PGCONNECT_TIMEOUT:"5"};
  for(const k of Object.keys(env))if(k.startsWith("PG")&&k!=="PGCONNECT_TIMEOUT")delete env[k];
  return env;
}
function invoke(q:string){
  return spawnSync("psql",["-X","-w","-qAt","-v","ON_ERROR_STOP=1","-d",url],{
    input:q.endsWith(";")?q:q+";",env:safeEnv(),encoding:"utf8",timeout:30000,
  });
}
function sql(q:string):string{
  const r=invoke(q);
  if(r.error)throw r.error;
  if(r.status!==0)throw new Error("Disposable SQL operation failed: "+String(r.stderr).slice(0,450));
  return String(r.stdout).trim();
}
function interpolate(s:string,trashId:number):string{
  assert.ok(Number.isSafeInteger(trashId)&&trashId>0);
  const a="$"+"{userId}",b="$"+"{trashId}";
  const q=s.replaceAll(a,"9001").replaceAll(b,String(trashId));
  assert.doesNotMatch(q,/\$\{/,"New parameter requires explicit test mapping");
  return q;
}
function command(trashId:number){return interpolate(tagged,trashId)}
function txCommand(trashId:number){
  return "BEGIN;\nSET TRANSACTION ISOLATION LEVEL READ COMMITTED;\n"+interpolate(advisory,trashId)+";\n"+command(trashId)+";\nCOMMIT;";
}
function restore(trashId:number){return sql(txCommand(trashId))}
const quote=(v:string)=>"'"+v.replaceAll("'","''")+"'";
before(()=>{
  if(!asked)return;
  if(!enabled)throw new Error("Both full-v20 disposable flags must be set");
  const parsed=new URL(url);
  const port=Number(parsed.port);
  assert.ok(["postgres:","postgresql:"].includes(parsed.protocol));
  assert.equal(parsed.hostname,"127.0.0.1");
  assert.equal(parsed.username,"flytally");
  assert.equal(parsed.password,"");
  assert.equal(parsed.pathname,"/flytally_currency_test");
  assert.equal(parsed.search,"");assert.equal(parsed.hash,"");
  assert.ok(parsed.port!==""&&Number.isSafeInteger(port)&&port>1024&&port<=65535&&port!==5432);
  const actual=JSON.parse(sql("SELECT json_build_object('database',current_database(),'user',current_user,'address',host(inet_server_addr()),'port',inet_server_port(),'version',current_setting('server_version_num'))::text"));
  assert.equal(actual.database,"flytally_currency_test");
  assert.equal(actual.user,"flytally");
  assert.equal(actual.address,"127.0.0.1");
  assert.equal(Number(actual.port),port);
  assert.match(String(actual.version),/^16[0-9]{4}$/);
  const full=spawnSync(process.execPath,[path.join(root,"tooling/bootstrap-browser-smoke-db.mjs")],{
    env:safeEnv(),encoding:"utf8",timeout:60000,maxBuffer:4*1024*1024,
  });
  if(full.error)throw full.error;
  assert.equal(full.status,0,"Full-v20 schema bootstrap failed: "+String(full.stderr).slice(0,450));
  // The canonical bootstrap already creates the v14+ expense archive column.
  // Assert its exact shape; never repair an incompatible fixture with ALTER.
  assert.equal(sql("SELECT data_type||'|'||is_nullable||'|'||COALESCE(column_default,'') FROM information_schema.columns WHERE table_schema='public' AND table_name='deleted_flights' AND column_name='expenses_data'"),"jsonb|NO|'[]'::jsonb");
  assert.equal(sql("SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='flights'"),"61");
});
test("actual runtime SQL is source-backed and locks archived rows",{skip:false},()=>{
  assert.match(advisory,/pg_advisory_xact_lock\(hashtextextended\(concat_ws/);
  assert.match(tagged,/^WITH candidate AS MATERIALIZED/);
  assert.match(tagged,/LIMIT 1 FOR UPDATE OF deleted_flights/);
  assert.match(tagged,/restored_tracks AS/);
  assert.match(tagged,/restored_expenses AS/);
});

function archived(date:string,opts?:{blankIdentity?:boolean;amount?:number}){
  const fee=opts?.amount??1255;
  assert.ok(Number.isSafeInteger(fee)&&fee>0&&fee<=1000000000);
  const oldId=Number(sql("INSERT INTO flights(user_id,date,evidence,registration,aircraft_type,aircraft_make,aircraft_model,aircraft_variant,aircraft_class,departure,arrival,off_block,starts,price_per_hour,billing_basis) VALUES(9001,"+
    quote(date)+",'EASA','OK-E2E','B23','Historic Maker','Historic Model','Legacy Option','SEP','LKLT','LKPR','09:00',1,75.125,'BLOCK') RETURNING id"));
  if(opts?.blankIdentity)sql("UPDATE flights SET aircraft_make='',aircraft_model='',aircraft_variant='' WHERE id="+oldId);
  sql("INSERT INTO flight_tracks(user_id,flight_id,file_name,point_count,distance_km,coordinates_json,overview_coordinates_json,overview_version) VALUES(9001,"+oldId+",'historic.gpx',2,12.5,'[[1,2]]','[[1,2]]',1)");
  sql("INSERT INTO flight_expenses(user_id,flight_id,category,label,amount_minor,currency) VALUES(9001,"+oldId+",'LANDING','Historic fee',"+fee+",'CZK')");
  const trash=Number(sql("INSERT INTO deleted_flights(user_id,original_flight_id,delete_token,flight_data,tracks_data,expenses_data) SELECT f.user_id,f.id,"+quote(randomUUID())+
    ",to_jsonb(f),COALESCE((SELECT jsonb_agg(to_jsonb(t) ORDER BY t.id) FROM flight_tracks t WHERE t.flight_id=f.id),'[]'::jsonb),"+
    "COALESCE((SELECT jsonb_agg(to_jsonb(e) ORDER BY e.id) FROM flight_expenses e WHERE e.flight_id=f.id),'[]'::jsonb) FROM flights f WHERE f.id="+oldId+" RETURNING id"));
  sql("DELETE FROM flight_tracks WHERE flight_id="+oldId);
  sql("DELETE FROM flights WHERE id="+oldId);
  return {trash,oldId};
}
function noWrite(trash:number){
  assert.equal(sql("SELECT restored_at IS NULL FROM deleted_flights WHERE id="+trash),"t");
  assert.equal(sql("SELECT count(*) FROM deleted_flights d JOIN flights f ON f.id=d.restored_flight_id WHERE d.id="+trash),"0");
}
test("real v20 flight, track and expense roundtrip preserves historical fields",{skip:!asked},()=>{
  const {trash,oldId}=archived("2026-10-20");
  const id=Number(restore(trash));
  assert.ok(Number.isSafeInteger(id)&&id>0&&id!==oldId);
  assert.equal(sql("SELECT restored_flight_id FROM deleted_flights WHERE id="+trash),String(id));
  assert.equal(sql("SELECT aircraft_make||'|'||aircraft_model||'|'||aircraft_variant FROM flights WHERE id="+id),"Historic Maker|Historic Model|Legacy Option");
  assert.equal(sql("SELECT (to_jsonb(f)-'id')=(d.flight_data-'id') FROM flights f JOIN deleted_flights d ON d.restored_flight_id=f.id WHERE d.id="+trash),"t");
  assert.equal(sql("SELECT count(*) FROM flight_tracks WHERE flight_id="+id),"1");
  assert.equal(sql("SELECT count(*) FROM flight_expenses WHERE flight_id="+id),"1");
  assert.equal(sql("SELECT currency||':'||amount_minor FROM flight_expenses WHERE flight_id="+id),"CZK:1255");
  assert.equal(sql("SELECT (to_jsonb(t)-'id'-'flight_id')=(j.value-'id'-'flight_id') FROM flight_tracks t JOIN deleted_flights d ON d.restored_flight_id=t.flight_id CROSS JOIN LATERAL jsonb_array_elements(d.tracks_data) j WHERE d.id="+trash),"t");
  assert.equal(sql("SELECT (to_jsonb(e)-'id'-'flight_id')=(j.value-'id'-'flight_id') FROM flight_expenses e JOIN deleted_flights d ON d.restored_flight_id=e.flight_id CROSS JOIN LATERAL jsonb_array_elements(d.expenses_data) j WHERE d.id="+trash),"t");
});
test("blank historical aircraft identity cannot be silently overwritten by current profile",{skip:!asked},()=>{
  const {trash}=archived("2026-10-21",{blankIdentity:true});
  assert.equal(restore(trash),"");
  noWrite(trash);
});
test("missing recorded currency fails closed, never infers CZK",{skip:!asked},()=>{
  const {trash}=archived("2026-10-22");
  sql("UPDATE deleted_flights SET expenses_data=(SELECT jsonb_agg(e.value-'currency') FROM jsonb_array_elements(expenses_data) e) WHERE id="+trash);
  assert.equal(restore(trash),"");
  noWrite(trash);
});

test("late database expense CHECK failure leaves no partial restored flight or track",{skip:!asked},()=>{
  const {trash}=archived("2026-10-23",{amount:7777});
  sql("ALTER TABLE flight_expenses ADD CONSTRAINT disposable_reject_amount CHECK(amount_minor<>7777)");
  try{
    const result=invoke(txCommand(trash));
    assert.notEqual(result.status,0,"Expected rejected expense");
    assert.match(String(result.stderr),/violates check constraint/);
    noWrite(trash);
  }finally{
    sql("ALTER TABLE flight_expenses DROP CONSTRAINT disposable_reject_amount");
  }
});
test("two separate PostgreSQL sessions restoring one trash item produce one flight",{skip:!asked},async()=>{
  const {trash}=archived("2026-10-24");
  const q=txCommand(trash);
  const session=()=>new Promise<string>((resolve,reject)=>{
    const p=spawn("psql",["-X","-w","-qAt","-v","ON_ERROR_STOP=1","-d",url],{env:safeEnv()});
    let output="",stderr="";
    p.stdout.setEncoding("utf8").on("data",(chunk:string)=>{output+=chunk});
    p.stderr.setEncoding("utf8").on("data",(chunk:string)=>{stderr+=chunk});
    p.on("error",reject);
    p.on("close",code=>code===0?resolve(output.trim()):reject(new Error(stderr.slice(0,500))));
    p.stdin.end(q+";");
  });
  const output=await Promise.all([session(),session()]);
  assert.equal(output.filter(x=>x!=="").length,1);
  assert.equal(sql("SELECT count(*) FROM deleted_flights d JOIN flights f ON f.id=d.restored_flight_id WHERE d.id="+trash),"1");
});

test("two distinct trash IDs with the SAME natural flight identity restore only once",{skip:!asked},async()=>{
  const first=archived("2026-10-25"),second=archived("2026-10-25");
  assert.notEqual(first.trash,second.trash);
  const session=(trashId:number)=>new Promise<string>((resolve,reject)=>{
    const p=spawn("psql",["-X","-w","-qAt","-v","ON_ERROR_STOP=1","-d",url],{env:safeEnv()});
    let output="",stderr="";
    p.stdout.setEncoding("utf8").on("data",(chunk:string)=>{output+=chunk});
    p.stderr.setEncoding("utf8").on("data",(chunk:string)=>{stderr+=chunk});
    p.on("error",reject);
    p.on("close",code=>code===0?resolve(output.trim()):reject(new Error(stderr.slice(0,500))));
    p.stdin.end(txCommand(trashId)+"\n");
  });
  const results=await Promise.all([session(first.trash),session(second.trash)]);
  assert.equal(results.filter(x=>x!=="").length,1,"Two cooperating restores duplicated one natural identity");
  assert.equal(sql("SELECT count(*) FROM flights WHERE user_id=9001 AND date='2026-10-25' AND registration='OK-E2E'"),"1");
  assert.equal(sql("SELECT count(*) FROM deleted_flights WHERE id IN ("+first.trash+","+second.trash+") AND restored_at IS NOT NULL"),"1");
});


test("Create and Restore of one natural identity use the same advisory lock and insert once",{skip:!asked},async()=>{
  const flight=archived("2026-10-26");
  const fingerprint="9001|2026-10-26|OK-E2E|09:00|LKLT|LKPR";
  // Model the canonical Create Flight flightFingerprint + two-query transaction
  // using native PG16 to exercise contention with the actual Restore SQL.
  const create="BEGIN;\nSET TRANSACTION ISOLATION LEVEL READ COMMITTED;\n"+
    "SELECT pg_advisory_xact_lock(hashtextextended("+quote(fingerprint)+",0));\n"+
    "INSERT INTO flights(user_id,date,evidence,registration,aircraft_type,aircraft_make,aircraft_model,aircraft_variant,aircraft_class,departure,arrival,off_block,starts,price_per_hour,billing_basis) "+
    "SELECT 9001,'2026-10-26','EASA','OK-E2E','B23','Historic Maker','Historic Model','Legacy Option','SEP','LKLT','LKPR','09:00',1,75.125,'BLOCK' "+
    "WHERE NOT EXISTS(SELECT 1 FROM flights WHERE user_id=9001 AND date::text='2026-10-26' AND UPPER(TRIM(registration))='OK-E2E' AND COALESCE(off_block,'')='09:00' AND UPPER(TRIM(COALESCE(departure,'')))='LKLT' AND UPPER(TRIM(COALESCE(arrival,'')))='LKPR') RETURNING id;\nCOMMIT;";
  const launch=(statement:string)=>new Promise<string>((resolve,reject)=>{
    const p=spawn("psql",["-X","-w","-qAt","-v","ON_ERROR_STOP=1","-d",url],{env:safeEnv()});
    let output="",stderr="";
    p.stdout.setEncoding("utf8").on("data",(x:string)=>{output+=x});
    p.stderr.setEncoding("utf8").on("data",(x:string)=>{stderr+=x});
    p.on("error",reject);
    p.on("close",code=>code===0?resolve(output.trim()):reject(new Error(stderr.slice(0,500))));
    p.stdin.end(statement+"\n");
  });
  const values=await Promise.all([launch(create),launch(txCommand(flight.trash))]);
  assert.equal(values.filter(x=>x!=="").length,1,"Create+Restore must not insert two copies");
  assert.equal(sql("SELECT COUNT(*) FROM flights WHERE user_id=9001 AND date='2026-10-26' AND registration='OK-E2E'"),"1");
  assert.equal(sql("SELECT COUNT(*) FROM deleted_flights WHERE id="+flight.trash+" AND restored_at IS NOT NULL"),values[1]===""?"0":"1");
});
