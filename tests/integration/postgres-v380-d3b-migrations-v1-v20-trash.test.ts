import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {spawn,spawnSync} from "node:child_process";
import {readFileSync} from "node:fs";
import {before,after,test} from "node:test";

// D3b migration fidelity: execute real v1..v20 SQL against a minimal isolated
// pre-optimization base. This is NOT a clone of all historic product tables.
const enabled=process.env.FLYTALLY_D3B_MIGRATIONS_PG16_DISPOSABLE==="1";
const url=process.env.DATABASE_URL??"";
const ns='"ft_d3b_chain_'+randomUUID().replaceAll("-","")+'"';
let targetVerified=false,created=false;
const root=new URL("../../",import.meta.url);
const migrationSource=readFileSync(new URL("lib/db-optimization.ts",root),"utf8");
const trashSource=readFileSync(new URL("lib/flight-trash.ts",root),"utf8");
const tick=String.fromCharCode(96);
const template=new RegExp("sql"+tick+"([\\s\\S]*?)"+tick,"g");
const head=migrationSource.slice(migrationSource.indexOf("const migrationNames:"),migrationSource.indexOf("const migrationQueries="));
const names=new Map<number,string>([...head.matchAll(/([0-9]+):"([^"]+)"/g)].map((x):[number,string]=>[Number(x[1]),x[2]]));
assert.equal(names.size,20,"Unexpected migration name registry");
const migrations=new Map<number,string[]>();
for(let v=1;v<=20;v++){
  const a=migrationSource.indexOf("if(version==="+v+")return[");
  const b=migrationSource.indexOf("  ];",a);
  assert.ok(a>=0&&b>a,"Migration SQL version "+v+" missing");
  const statements=[...migrationSource.slice(a,b).matchAll(template)].map(x=>x[1]);
  assert.ok(statements.length>=2,"Migration SQL block mismatch at "+v);
  assert.ok(!statements.some(x=>x.includes("$"+"{") || /\bpublic\./i.test(x)),
    "Dynamic or public-schema SQL not safe for isolated fixture at v"+v);
  migrations.set(v,statements);
}
const a=trashSource.indexOf("const token=randomUUID(),results=await sql.transaction([");
const b=trashSource.indexOf("]);return Boolean",a);
assert.ok(a>=0&&b>a,"Actual Trash SQL boundary mismatch");
const trash=[...trashSource.slice(a,b).matchAll(template)].map(x=>x[1]);
assert.equal(trash.length,5,"Expected five original Trash SQL statements");

function safeEnv():NodeJS.ProcessEnv{
  const env:NodeJS.ProcessEnv={...process.env,PGCONNECT_TIMEOUT:"5"};
  for(const k of Object.keys(env))if(k.startsWith("PG")&&k!=="PGCONNECT_TIMEOUT")delete env[k];
  return env;
}
function target(){
  const u=new URL(url);
  assert.equal(u.protocol,"postgresql:");
  assert.equal(u.hostname,"127.0.0.1");
  assert.equal(u.username,"flytally");
  assert.equal(u.password,"");
  assert.equal(u.pathname,"/flytally_currency_test");
  assert.equal(u.search,"");
  assert.equal(u.hash,"");
  assert.ok(Number(u.port)>1024&&![5432,55432].includes(Number(u.port)));
}
function raw(q:string){
  return spawnSync("psql",["-X","-w","-qAt","-v","ON_ERROR_STOP=1","-d",url],
    {input:q,env:safeEnv(),encoding:"utf8",timeout:30000});
}
function run(q:string){
  const r=raw("SET search_path TO "+ns+",pg_catalog;\n"+q+"\n");
  if(r.error)throw r.error;
  assert.equal(r.status,0,"PG SQL failed: "+String(r.stderr).slice(0,600));
  return String(r.stdout).trim();
}
const q=(s:string)=>"'"+s.replaceAll("'","''")+"'";
const num=(s:string)=>Number(run(s));
const count=(t:string,p:string)=>num("SELECT count(*) FROM "+t+" WHERE "+p+";");
function insertFlight(user:number,certified=false){
  return num("INSERT INTO flights(user_id,date,evidence,registration,aircraft_type,aircraft_class,departure,arrival,off_block,on_block,certified_at,certification_hash)"+
    " VALUES("+user+",'2026-10-13','EASA','OK-D3B','TEST','SEP','LKLT','LKPR','10:00','11:00',"+
    (certified?"NOW()":"NULL")+","+q(certified?"a".repeat(64):"")+") RETURNING id;");
}
function trashSql(id:number,token:string,user=9001){
  const p:Record<string,string>={userId:String(user),flightId:String(id),token:q(token)};
  return trash.map(sql=>{
    const x=sql.replace(/\$\{(userId|flightId|token)\}/g,(_,k:string)=>p[k]);
    assert.doesNotMatch(x,/\$\{/,"New Trash interpolation needs review");
    return x;
  });
}
before(()=>{
  if(!enabled)return;
  target();
  const probe=raw("SELECT current_database()||'|'||current_user||'|'||host(inet_server_addr())||'|'||inet_server_port()||'|'||current_setting('server_version_num');");
  if(probe.error)throw probe.error;
  assert.equal(probe.status,0,"Native PG16 identity probe failed");
  const u=new URL(url),parts=String(probe.stdout).trim().split("|");
  assert.deepEqual(parts.slice(0,4),["flytally_currency_test","flytally","127.0.0.1",u.port]);
  assert.match(parts[4],/^16[0-9]{4}$/);
  targetVerified=true;
  const base=[
    "CREATE SCHEMA "+ns,
    "SET search_path TO "+ns+",pg_catalog",
    "CREATE TABLE flytally_schema_migrations(version INTEGER PRIMARY KEY,name TEXT NOT NULL,applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW())",
    "CREATE TABLE users(id BIGINT PRIMARY KEY,email TEXT NOT NULL)",
    "CREATE TABLE flights(id BIGSERIAL PRIMARY KEY,user_id BIGINT NOT NULL REFERENCES users(id),date TEXT NOT NULL,evidence TEXT NOT NULL DEFAULT '',registration TEXT NOT NULL DEFAULT '',aircraft_type TEXT NOT NULL DEFAULT '',aircraft_class TEXT NOT NULL DEFAULT '',departure TEXT NOT NULL DEFAULT '',arrival TEXT NOT NULL DEFAULT '',off_block TEXT NOT NULL DEFAULT '',on_block TEXT NOT NULL DEFAULT '',starts INTEGER NOT NULL DEFAULT 0,role TEXT NOT NULL DEFAULT '',instructor TEXT NOT NULL DEFAULT '')",
    "CREATE TABLE aircraft(id BIGSERIAL PRIMARY KEY,user_id BIGINT NOT NULL REFERENCES users(id),registration TEXT NOT NULL,aircraft_type TEXT NOT NULL DEFAULT '',active INTEGER NOT NULL DEFAULT 1)",
    "CREATE TABLE airports(ident TEXT NOT NULL,user_id BIGINT NOT NULL DEFAULT 0,active INTEGER NOT NULL DEFAULT 1)",
    "CREATE TABLE rates(id BIGSERIAL PRIMARY KEY,user_id BIGINT NOT NULL,registration TEXT NOT NULL,valid_from TEXT)",
    "CREATE TABLE user_expiries(id BIGSERIAL PRIMARY KEY,user_id BIGINT NOT NULL,active INTEGER NOT NULL DEFAULT 1,expiry_date DATE NOT NULL)",
    "CREATE TABLE flight_tracks(id BIGSERIAL PRIMARY KEY,user_id BIGINT NOT NULL,flight_id BIGINT NOT NULL,file_name TEXT NOT NULL DEFAULT '',point_count INTEGER NOT NULL DEFAULT 0,start_utc TIMESTAMPTZ)",
    "CREATE TABLE track_points(id BIGSERIAL PRIMARY KEY,user_id BIGINT NOT NULL,track_id BIGINT NOT NULL)",
    "INSERT INTO users(id,email) VALUES(9001,'source@example.test'),(9002,'participant@example.test')"
  ];
  const r=raw(base.join(";\n")+";\n");
  if(r.error)throw r.error;
  assert.equal(r.status,0,"Foundational schema failed: "+String(r.stderr).slice(0,650));
  created=true;
  for(let v=1;v<=20;v++){
    const sql="BEGIN;\nSET LOCAL search_path TO "+ns+",pg_catalog;\n"+
      "SELECT pg_advisory_xact_lock(704190104);\n"+
      migrations.get(v)!.join(";\n")+";\n"+
      "INSERT INTO flytally_schema_migrations(version,name) VALUES("+v+","+q(names.get(v)!)+");\nCOMMIT;\n";
    const applied=raw(sql);
    if(applied.error)throw applied.error;
    assert.equal(applied.status,0,"Actual migration v"+v+" failed: "+String(applied.stderr).slice(0,700));
  }
  assert.equal(num("SELECT count(*) FROM flytally_schema_migrations"),20);
});
after(()=>{
  if(!enabled||!targetVerified||!created)return;
  const r=raw("DROP SCHEMA "+ns+" CASCADE;");
  if(r.error)throw r.error;
  assert.equal(r.status,0,"Fixture cleanup failed");
});
test("applied migrations 1..20 expose actual foreign keys and enabled protection triggers",{skip:!enabled},()=>{
  assert.equal(num("SELECT count(*) FROM flytally_schema_migrations WHERE version BETWEEN 1 AND 20"),20);
  for(const [table,col,action] of [
    ["flight_participations","source_flight_id","ON DELETE CASCADE"],
    ["flight_participations","participant_flight_id","ON DELETE SET NULL"],
    ["flight_connected_crew","source_flight_id, source_user_id","ON DELETE CASCADE"],
    ["flight_verifications","flight_id","ON DELETE CASCADE"],
    ["flight_source_provenance","participant_flight_id, participant_user_id","ON DELETE CASCADE"],
  ]){
    assert.equal(num("SELECT count(*) FROM pg_constraint WHERE contype='f' AND conrelid="+q(table)+"::regclass AND pg_get_constraintdef(oid) LIKE "+
      q("%"+col+"%"+action+"%")),1,"Missing FK "+table+" "+col+" "+action);
  }
  for(const [table,trigger] of [
    ["flights","trg_logbook_protect_locked_flight"],
    ["flights","trg_logbook_prevent_voided_flight_id_reuse"],
    ["flight_source_provenance","trg_logbook_protect_source_provenance"],
    ["voided_certified_flights","trg_logbook_protect_voided_certified_flights"],
  ]){
    assert.equal(num("SELECT count(*) FROM pg_trigger WHERE tgrelid="+q(table)+"::regclass AND tgname="+q(trigger)+
      " AND tgenabled IN ('O','A') AND NOT tgisinternal"),1,"Inactive trigger "+trigger);
  }
});
test("ordinary draft is archived and deleted by original five Trash statements",{skip:!enabled},()=>{
  const id=insertFlight(9001),token=randomUUID();
  run("BEGIN;\n"+trashSql(id,token).join(";\n")+";\nCOMMIT;");
  assert.equal(count("flights","id="+id),0);
  assert.equal(count("deleted_flights","delete_token="+q(token)),1);
});
test("linked draft deletion cascades crew and verification in migrated v20",{skip:!enabled},()=>{
  const id=insertFlight(9001),token=randomUUID();
  run("INSERT INTO flight_connected_crew(source_flight_id,source_user_id,connected_user_id,intended_role) VALUES("+id+",9001,9002,'PIC');");
  run("INSERT INTO flight_verifications(flight_id,flight_user_id,verification_role,record_revision,flight_hash) VALUES("+id+",9001,'INSTRUCTOR',1,"+q("a".repeat(64))+");");
  run("BEGIN;\n"+trashSql(id,token).join(";\n")+";\nCOMMIT;");
  assert.equal(count("flights","id="+id),0);
  assert.equal(count("deleted_flights","delete_token="+q(token)),1);
  assert.equal(count("flight_connected_crew","source_flight_id="+id),0);
  assert.equal(count("flight_verifications","flight_id="+id),0);
});
test("migration-chain certified flight cannot enter ordinary Trash",{skip:!enabled},()=>{
  const id=insertFlight(9001,true),token=randomUUID();
  run("BEGIN;\n"+trashSql(id,token).join(";\n")+";\nCOMMIT;");
  assert.equal(count("flights","id="+id+" AND certified_at IS NOT NULL"),1);
  assert.equal(count("deleted_flights","delete_token="+q(token)),0);
});
test("legacy pending draft participation is cascaded by current Trash SQL",{skip:!enabled},()=>{
  const id=insertFlight(9001),token=randomUUID();
  run("INSERT INTO flight_participations(source_flight_id,source_user_id,participant_user_id,participant_role,source_revision,source_hash,status)"+
    " VALUES("+id+",9001,9002,'INSTRUCTOR',1,"+q("p".repeat(64))+",'pending');");
  run("BEGIN;\n"+trashSql(id,token).join(";\n")+";\nCOMMIT;");
  assert.equal(count("flights","id="+id),0);
  assert.equal(count("deleted_flights","delete_token="+q(token)),1);
  assert.equal(count("flight_participations","source_flight_id="+id),0);
  // Characterizes a legacy/synthetic draft invitation: current canonical
  // invitation creation may require certification. Do not infer UI reachability.
});
test("immutable recipient provenance rejects deletion and rolls back archive",{skip:!enabled},()=>{
  const source=insertFlight(9001,true),recipient=insertFlight(9002),token=randomUUID(),hash="a".repeat(64);
  run("INSERT INTO flight_participations(source_flight_id,source_user_id,participant_user_id,participant_role,source_revision,source_hash,status,participant_flight_id)"+
    " VALUES("+source+",9001,9002,'INSTRUCTOR',1,"+q(hash)+",'accepted',"+recipient+");");
  run("INSERT INTO flight_source_provenance(participant_flight_id,participant_user_id,source_flight_id,source_user_id,source_revision,source_hash,participant_role)"+
    " VALUES("+recipient+",9002,"+source+",9001,1,"+q(hash)+",'INSTRUCTOR');");
  const attempted=raw("SET search_path TO "+ns+",pg_catalog;BEGIN;"+trashSql(recipient,token,9002).join(";")+";COMMIT;");
  assert.notEqual(attempted.status,0,"Provenance should make Trash fail closed");
  assert.equal(count("flights","id="+recipient),1);
  assert.equal(count("deleted_flights","delete_token="+q(token)),0);
  assert.equal(count("flight_source_provenance","participant_flight_id="+recipient),1);
});
test("two PG sessions archive then certify before final conditional DELETE",{skip:!enabled,timeout:23000},async()=>{
  const id=insertFlight(9001),token=randomUUID(),steps=trashSql(id,token);
  const p=spawn("psql",["-X","-w","-qAt","-v","ON_ERROR_STOP=1","-d",url],{env:safeEnv(),stdio:["pipe","pipe","pipe"]});
  let out="",err="";
  p.stdout.setEncoding("utf8").on("data",(x:string)=>{out+=x;});
  p.stderr.setEncoding("utf8").on("data",(x:string)=>{err+=x;});
  const stopped=new Promise<number|null>((resolve,reject)=>{p.on("error",reject);p.on("close",resolve);});
  try{
    p.stdin.write("SET search_path TO "+ns+",pg_catalog;BEGIN;\n"+steps[0]+";\n"+steps[1]+";\nSELECT 'D3B_MIGRATION_ARCHIVED';\n");
    await new Promise<void>((resolve,reject)=>{
      const timeout=setTimeout(()=>reject(new Error("Archive readiness timed out: "+err)),8000);
      const check=()=>{if(out.includes("D3B_MIGRATION_ARCHIVED")){clearTimeout(timeout);p.stdout.off("data",check);resolve();}};
      p.stdout.on("data",check);check();
    });
    assert.equal(run("UPDATE flights SET certified_at=NOW(),certification_hash="+q("b".repeat(64))+" WHERE id="+id+" RETURNING id;"),String(id));
    p.stdin.end(steps.slice(2).join(";\n")+";\nCOMMIT;\n");
    assert.equal(await stopped,0,"Archived transaction failed: "+err);
    assert.equal(count("flights","id="+id+" AND certified_at IS NOT NULL"),1);
    assert.equal(count("deleted_flights","delete_token="+q(token)),1);
  }finally{
    if(p.exitCode===null){p.kill();await stopped;}
  }
});
