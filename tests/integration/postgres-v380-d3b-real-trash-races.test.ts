import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {readFileSync} from "node:fs";
import {spawn,spawnSync} from "node:child_process";
import {after,before,test} from "node:test";

const enabled=process.env.FLYTALLY_D3B_FULL_V20_DISPOSABLE==="1";
const url=process.env.DATABASE_URL??"";
const schema="ft_d3b_"+randomUUID().replaceAll("-","");
const ns='"'+schema+'"';
const root=new URL("../../",import.meta.url);
const source=readFileSync(new URL("lib/flight-trash.ts",root),"utf8");
const first=source.indexOf("const token=randomUUID(),results=await sql.transaction([");
const last=source.indexOf("]);return Boolean",first);
assert.ok(first>=0 && last>first,"Cannot locate exact Trash SQL transaction");
const queries=[...source.slice(first,last).matchAll(/sql`([^`]+)`/g)].map(m=>m[1]);
assert.equal(queries.length,5,"Trash transaction SQL changed: review this test");

function target(){
  assert.ok(enabled,"Explicit D3b test opt-in required");
  const u=new URL(url);
  assert.equal(u.protocol,"postgresql:");
  assert.equal(u.hostname,"127.0.0.1");
  assert.equal(u.username,"flytally");
  assert.equal(u.password,"");
  assert.equal(u.pathname,"/flytally_currency_test");
  assert.equal(u.search,"");
  assert.equal(u.hash,"");
  assert.ok(Number(u.port)>1024 && ![5432,55432].includes(Number(u.port)));
}
function env(){
  const e={...process.env,PGCONNECT_TIMEOUT:"5"};
  for(const k of Object.keys(e))if(k.startsWith("PG") && k!=="PGCONNECT_TIMEOUT")delete e[k];
  return e;
}
function raw(statement:string){
  return spawnSync("psql",["-X","-w","-qAt","-v","ON_ERROR_STOP=1","-d",url],
    {input:statement,encoding:"utf8",env:env(),timeout:30000});
}
function sql(statement:string){
  const r=raw('SET search_path TO '+ns+';\n'+statement);
  if(r.error)throw r.error;
  assert.equal(r.status,0,"SQL failed: "+String(r.stderr).slice(0,600));
  return String(r.stdout).trim();
}
function count(table:string,where:string){
  return Number(sql("SELECT count(*) FROM "+table+" WHERE "+where));
}
const quote=(s:string)=>"'"+s.replaceAll("'","''")+"'";
function flight(user=9001,certified=false):number{
  return Number(sql("INSERT INTO flights(user_id,registration,certified_at,certification_hash) VALUES ("+
    user+",'D3B-ONLY',"+(certified?"NOW()":"NULL")+","+
    quote(certified?"a".repeat(64):"")+") RETURNING id"));
}
function render(query:string,id:number,token:string){
  const values:Record<string,string>={userId:"9001",flightId:String(id),token:quote(token)};
  const expanded=query.replace(/\$\{(userId|flightId|token)\}/g,(_,key:string)=>values[key]);
  assert.doesNotMatch(expanded,/\$\{/,"Unexpected new parameter in Trash SQL");
  return expanded;
}
function trashSql(id:number,token:string){
  return queries.map(q=>render(q,id,token));
}
function migration20(){
  const db=readFileSync(new URL("lib/db-optimization.ts",root),"utf8");
  const a=db.indexOf("if(version===20)return[");
  const b=db.indexOf("  ];",a);
  assert.ok(a>=0 && b>a,"v20 migration code is missing");
  const blocks=[...db.slice(a,b).matchAll(/sql`([\s\S]*?)`/g)].map(m=>m[1]);
  assert.ok(blocks.length>=20,"Incomplete actual v20 migration extraction");
  return blocks;
}
before(()=>{
  if(!enabled)return;
  target();
  const probe=raw("SELECT current_database()||'|'||current_user||'|'||host(inet_server_addr())||'|'||current_setting('server_version_num')");
  assert.equal(probe.status,0,"PG16 identity query unavailable");
  assert.match(String(probe.stdout).trim(),/^flytally_currency_test\|flytally\|127\.0\.0\.1\|16[0-9]{4}$/);
  // Only a random isolated schema; never mutate public or existing tests.
  const setup=raw(`
CREATE SCHEMA ${ns};
SET search_path TO ${ns};
CREATE TABLE flights(
 id BIGSERIAL PRIMARY KEY,user_id BIGINT NOT NULL,
 date TEXT NOT NULL DEFAULT '2026-10-13',registration TEXT NOT NULL DEFAULT '',
 certified_at TIMESTAMPTZ,certified_by_user_id BIGINT,certification_hash TEXT NOT NULL DEFAULT '',
 certification_version INTEGER NOT NULL DEFAULT 8,locked_at TIMESTAMPTZ,
 locked_by_user_id BIGINT,record_revision INTEGER NOT NULL DEFAULT 1,
 correction_reason TEXT NOT NULL DEFAULT '',correction_opened_at TIMESTAMPTZ,
 correction_opened_by_user_id BIGINT
);
CREATE UNIQUE INDEX flights_id_user_owner_uq ON flights(id,user_id);
CREATE TABLE flight_certified_revisions(
 id BIGSERIAL PRIMARY KEY,flight_id BIGINT NOT NULL,user_id BIGINT NOT NULL,
 revision_number INTEGER NOT NULL,certification_hash TEXT NOT NULL,
 snapshot_data JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE TABLE deleted_flights(
 id BIGSERIAL PRIMARY KEY,user_id BIGINT NOT NULL,original_flight_id BIGINT NOT NULL,
 delete_token TEXT NOT NULL UNIQUE,flight_data JSONB NOT NULL,
 tracks_data JSONB NOT NULL DEFAULT '[]'::jsonb,
 expenses_data JSONB NOT NULL DEFAULT '[]'::jsonb
);
CREATE TABLE flight_tracks(
 id BIGSERIAL PRIMARY KEY,user_id BIGINT NOT NULL,flight_id BIGINT NOT NULL
);
CREATE TABLE track_points(
 id BIGSERIAL PRIMARY KEY,user_id BIGINT NOT NULL,track_id BIGINT NOT NULL
);
CREATE TABLE flight_expenses(
 id BIGSERIAL PRIMARY KEY,user_id BIGINT NOT NULL,flight_id BIGINT NOT NULL
);
CREATE TABLE flight_participations(
 id BIGSERIAL PRIMARY KEY,
 source_flight_id BIGINT NOT NULL REFERENCES flights(id) ON DELETE CASCADE,
 source_user_id BIGINT NOT NULL,participant_user_id BIGINT NOT NULL,
 participant_role TEXT NOT NULL DEFAULT 'PIC',
 pic_commander_basis TEXT,source_revision INTEGER NOT NULL DEFAULT 1,
 source_hash TEXT NOT NULL DEFAULT '',status TEXT NOT NULL DEFAULT 'pending',
 participant_flight_id BIGINT REFERENCES flights(id) ON DELETE SET NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),responded_at TIMESTAMPTZ
);
CREATE TABLE flight_connected_crew(
 id BIGSERIAL PRIMARY KEY,source_flight_id BIGINT NOT NULL,
 source_user_id BIGINT NOT NULL,connected_user_id BIGINT NOT NULL,
 intended_role TEXT NOT NULL DEFAULT 'PIC',
 CONSTRAINT connected_flight_fk FOREIGN KEY(source_flight_id,source_user_id)
 REFERENCES flights(id,user_id) ON DELETE CASCADE
);
CREATE TABLE flight_verifications(
 id BIGSERIAL PRIMARY KEY,flight_id BIGINT NOT NULL REFERENCES flights(id) ON DELETE CASCADE,
 flight_user_id BIGINT NOT NULL,status TEXT NOT NULL DEFAULT 'pending'
);
`);
  if(setup.error)throw setup.error;
  assert.equal(setup.status,0,"D3b schema setup failed: "+String(setup.stderr));
  for(const block of migration20())sql(block);
});
after(()=>{
  if(!enabled)return;
  const result=raw("DROP SCHEMA IF EXISTS "+ns+" CASCADE;");
  assert.equal(result.status,0,"D3b temporary schema cleanup failed");
});

test("actual Trash SQL: unlinked draft archives and deletes", {skip:!enabled},()=>{
  const id=flight(),token=randomUUID();
  sql("BEGIN;\n"+trashSql(id,token).join(";\n")+";\nCOMMIT;");
  assert.equal(count("flights","id="+id),0);
  assert.equal(count("deleted_flights","delete_token="+quote(token)),1);
});

test("actual Trash SQL: linked draft loses connected-crew and verification via CASCADE", {skip:!enabled},()=>{
  const id=flight(),token=randomUUID();
  sql("INSERT INTO flight_connected_crew(source_flight_id,source_user_id,connected_user_id) VALUES ("+id+",9001,9002)");
  sql("INSERT INTO flight_verifications(flight_id,flight_user_id) VALUES ("+id+",9001)");
  sql("BEGIN;\n"+trashSql(id,token).join(";\n")+";\nCOMMIT;");
  assert.equal(count("flights","id="+id),0);
  assert.equal(count("deleted_flights","delete_token="+quote(token)),1);
  assert.equal(count("flight_connected_crew","source_flight_id="+id),0);
  assert.equal(count("flight_verifications","flight_id="+id),0);
  // This characterizes CURRENT behavior and is a blocker for A+ acceptance.
});

test("actual Trash SQL: immutable participant provenance rejects DELETE and rolls back archive", {skip:!enabled},()=>{
  const sourceId=flight(9001,true);
  const participantId=flight(9001,false);
  sql("INSERT INTO flight_participations(source_flight_id,source_user_id,participant_user_id,participant_role,source_revision,source_hash,status,participant_flight_id) VALUES ("+
     sourceId+",9001,9001,'PIC',1,"+quote("a".repeat(64))+",'accepted',"+participantId+")");
  sql("INSERT INTO flight_source_provenance(participant_flight_id,participant_user_id,source_flight_id,source_user_id,source_revision,source_hash,participant_role) VALUES ("+
     participantId+",9001,"+sourceId+",9001,1,"+quote("a".repeat(64))+",'PIC')");
  const token=randomUUID();
  const result=raw("SET search_path TO "+ns+";BEGIN;"+trashSql(participantId,token).join(";")+";COMMIT;");
  assert.notEqual(result.status,0,"Immutable provenance must reject draft DELETE");
  assert.equal(count("flights","id="+participantId),1);
  assert.equal(count("deleted_flights","delete_token="+quote(token)),0);
  assert.equal(count("flight_source_provenance","participant_flight_id="+participantId),1);
});

test("actual Trash SQL: certified source is not archived or deleted", {skip:!enabled},()=>{
  const id=flight(9001,true),token=randomUUID();
  sql("BEGIN;\n"+trashSql(id,token).join(";\n")+";\nCOMMIT;");
  assert.equal(count("flights","id="+id),1);
  assert.equal(count("deleted_flights","delete_token="+quote(token)),0);
});

test("two sessions: certification after snapshot, before final DELETE leaves archive and active flight", {skip:!enabled,timeout:20000},async()=>{
  const id=flight(),token=randomUUID(),queriesForFlight=trashSql(id,token);
  const p=spawn("psql",["-X","-w","-qAt","-v","ON_ERROR_STOP=1","-d",url],
    {env:env(),stdio:["pipe","pipe","pipe"]});
  let stdout="",stderr="";
  p.stdout.setEncoding("utf8").on("data",(part:string)=>{stdout+=part});
  p.stderr.setEncoding("utf8").on("data",(part:string)=>{stderr+=part});
  const stopped=new Promise<number|null>((resolve,reject)=>{
    p.on("error",reject);p.on("close",resolve);
  });
  try{
    p.stdin.write("SET search_path TO "+ns+";BEGIN;\n"+
      queriesForFlight[0]+";\n"+queriesForFlight[1]+";\nSELECT 'D3B_ARCHIVE_READY';\n");
    await new Promise<void>((resolve,reject)=>{
      const timer=setTimeout(()=>reject(new Error("Archive readiness timed out: "+stderr)),6000);
      const check=()=>{if(stdout.includes("D3B_ARCHIVE_READY")){clearTimeout(timer);p.stdout.off("data",check);resolve()}};
      p.stdout.on("data",check);check();
    });
    const certification=sql("UPDATE flights SET certified_at=NOW(),certification_hash="+quote("b".repeat(64))+
      " WHERE id="+id+" RETURNING id");
    assert.equal(certification,String(id));
    p.stdin.end(queriesForFlight.slice(2).join(";\n")+";\nCOMMIT;\n");
    assert.equal(await stopped,0,"Transaction A failed: "+stderr);
    assert.equal(count("flights","id="+id),1);
    assert.equal(count("deleted_flights","delete_token="+quote(token)),1);
    assert.ok(stdout.includes("D3B_ARCHIVE_READY"));
  }finally{
    if(p.exitCode===null){p.kill();await stopped;}
  }
});
