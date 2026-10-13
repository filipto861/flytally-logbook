import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {readFileSync} from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {spawnSync,spawn} from "node:child_process";
import {before,test} from "node:test";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../..");
const restoreSource=readFileSync(path.join(root,"lib/flight-trash.ts"),"utf8");
const found=restoreSource.match(/const rows=await sql\x60([\s\S]*?)\x60 as Array<\{restored_flight_id:number\|string\}>/);
assert.ok(found,"Exact SQL restore template missing");
const tagged=found[1];
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
function command(trashId:number):string{
  assert.ok(Number.isSafeInteger(trashId)&&trashId>0);
  const a="$"+"{userId}",b="$"+"{trashId}";
  const q=tagged.replaceAll(a,"9001").replaceAll(b,String(trashId));
  assert.doesNotMatch(q,/\$\{/,"New parameter requires explicit test mapping");
  return q;
}
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
  assert.equal(sql("SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='flights'"),"61");
});
test("actual runtime SQL is source-backed and locks archived rows",{skip:false},()=>{
  assert.match(tagged,/^WITH candidate AS MATERIALIZED/);
  assert.match(tagged,/LIMIT 1 FOR UPDATE OF deleted_flights/);
  assert.match(tagged,/restored_tracks AS/);
  assert.match(tagged,/restored_expenses AS/);
});
