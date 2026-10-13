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
const moveStart=trashSource.indexOf("export async function moveFlightToTrash(");
const restoreStart=trashSource.indexOf("export async function restoreDeletedFlightRecord(",moveStart);
assert.ok(moveStart>=0 && restoreStart>moveStart,"Actual Trash method boundary mismatch");
const transaction=trashSource.slice(moveStart,restoreStart).match(/const results=await sql\.transaction\(\[([\s\S]*?)\]\);\s*const deleted=/);
assert.ok(transaction,"Actual A+ Trash transaction boundary mismatch");
const trash=[...transaction[1].matchAll(template)].map(x=>x[1]);
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
  // Share-table feature is provisioned lazily, independently of optimizer v20.
  // Use the canonical source DDL instead of inventing a test-only declaration.
  const sharing=readFileSync(new URL("lib/flight-sharing.ts",root),"utf8");
  const canonicalShares=sharing.match(/sql`(CREATE TABLE IF NOT EXISTS flight_public_shares[^`]+)`/);
  assert.ok(canonicalShares,"Canonical flight sharing table DDL changed");
  run(canonicalShares[1]+";");

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
test("D3b-1 A+: linked draft preserves crew and verification in migrated v20",{skip:!enabled},()=>{
  const id=insertFlight(9001),token=randomUUID();
  run("INSERT INTO flight_connected_crew(source_flight_id,source_user_id,connected_user_id,intended_role) VALUES("+id+",9001,9002,'PIC');");
  run("INSERT INTO flight_verifications(flight_id,flight_user_id,verification_role,record_revision,flight_hash) VALUES("+id+",9001,'INSTRUCTOR',1,"+q("a".repeat(64))+");");
  run("BEGIN;\n"+trashSql(id,token).join(";\n")+";\nCOMMIT;");
  assert.equal(count("flights","id="+id),1);
  assert.equal(count("deleted_flights","delete_token="+q(token)),0);
  assert.equal(count("flight_connected_crew","source_flight_id="+id),1);
  assert.equal(count("flight_verifications","flight_id="+id),1);
});
test("migration-chain certified flight cannot enter ordinary Trash",{skip:!enabled},()=>{
  const id=insertFlight(9001,true),token=randomUUID();
  run("BEGIN;\n"+trashSql(id,token).join(";\n")+";\nCOMMIT;");
  assert.equal(count("flights","id="+id+" AND certified_at IS NOT NULL"),1);
  assert.equal(count("deleted_flights","delete_token="+q(token)),0);
});
test("D3b-1 A+: legacy pending participation remains untouched by Trash",{skip:!enabled},()=>{
  const id=insertFlight(9001),token=randomUUID();
  run("INSERT INTO flight_participations(source_flight_id,source_user_id,participant_user_id,participant_role,source_revision,source_hash,status)"+
    " VALUES("+id+",9001,9002,'INSTRUCTOR',1,"+q("p".repeat(64))+",'pending');");
  run("BEGIN;\n"+trashSql(id,token).join(";\n")+";\nCOMMIT;");
  assert.equal(count("flights","id="+id),1);
  assert.equal(count("deleted_flights","delete_token="+q(token)),0);
  assert.equal(count("flight_participations","source_flight_id="+id),1);
  // Characterizes a legacy/synthetic draft invitation: current canonical
  // invitation creation may require certification. Do not infer UI reachability.
});
test("D3b-1 A+: immutable recipient provenance blocks ordinary Trash without changes",{skip:!enabled},()=>{
  const source=insertFlight(9001,true),recipient=insertFlight(9002),token=randomUUID(),hash="a".repeat(64);
  run("INSERT INTO flight_participations(source_flight_id,source_user_id,participant_user_id,participant_role,source_revision,source_hash,status,participant_flight_id)"+
    " VALUES("+source+",9001,9002,'INSTRUCTOR',1,"+q(hash)+",'accepted',"+recipient+");");
  run("INSERT INTO flight_source_provenance(participant_flight_id,participant_user_id,source_flight_id,source_user_id,source_revision,source_hash,participant_role)"+
    " VALUES("+recipient+",9002,"+source+",9001,1,"+q(hash)+",'INSTRUCTOR');");
  run("BEGIN;\n"+trashSql(recipient,token,9002).join(";\n")+";\nCOMMIT;");
  // A+ fails closed by excluding protected children before destructive SQL.
  // No PostgreSQL exception is required for an ineligible Trash attempt.
  assert.equal(count("flights","id="+recipient),1);
  assert.equal(count("deleted_flights","delete_token="+q(token)),0);
  assert.equal(count("flight_source_provenance","participant_flight_id="+recipient),1);
});
test("D3b-1 A+: legacy instructor approval remains when draft Trash is refused",{skip:!enabled},()=>{
  const id=insertFlight(9001),token=randomUUID();
  run("INSERT INTO instructor_flight_approvals(flight_id,student_user_id,instructor_user_id,record_revision,flight_hash)"+
    " VALUES("+id+",9001,9002,1,"+q("a".repeat(64))+");");
  run("BEGIN;\n"+trashSql(id,token).join(";\n")+";\nCOMMIT;");
  assert.equal(count("flights","id="+id),1);
  assert.equal(count("instructor_flight_approvals","flight_id="+id),1);
  assert.equal(count("deleted_flights","delete_token="+q(token)),0);
});

test("D3b-1 A+: legacy revoked public share remains when draft Trash is refused",{skip:!enabled},()=>{
  const id=insertFlight(9001),token=randomUUID();
  run("INSERT INTO flight_public_shares(user_id,flight_id,token_hash,revoked_at)"+
    " VALUES(9001,"+id+","+q(randomUUID())+",NOW());");
  run("BEGIN;\n"+trashSql(id,token).join(";\n")+";\nCOMMIT;");
  assert.equal(count("flights","id="+id),1);
  assert.equal(count("flight_public_shares","flight_id="+id),1);
  assert.equal(count("deleted_flights","delete_token="+q(token)),0);
});

test("D3b-1 A+: orphan source-provenance reference without source FK blocks draft Trash",{skip:!enabled},()=>{
  const source=insertFlight(9001),recipient=insertFlight(9002),token=randomUUID();
  run("INSERT INTO flight_source_provenance(participant_flight_id,participant_user_id,source_flight_id,source_user_id,source_revision,source_hash,participant_role)"+
    " VALUES("+recipient+",9002,"+source+",9001,1,"+q("x".repeat(64))+",'INSTRUCTOR');");
  run("BEGIN;\n"+trashSql(source,token).join(";\n")+";\nCOMMIT;");
  assert.equal(count("flights","id="+source),1);
  assert.equal(count("flight_source_provenance","source_flight_id="+source),1);
  assert.equal(count("deleted_flights","delete_token="+q(token)),0);
});
test("D3b-1 A+: forced zero-row conditional DELETE rolls back the earlier archive",{skip:!enabled},()=>{
  const id=insertFlight(9001),token=randomUUID(),steps=trashSql(id,token);
  const failed=raw("SET search_path TO "+ns+",pg_catalog;BEGIN;"+
    steps[0]+";"+steps[1]+";"+
    "UPDATE flights SET locked_at=NOW() WHERE id="+id+";"+
    steps.slice(2).join(";")+";COMMIT;");
  assert.notEqual(failed.status,0,"Archive-delete mismatch must fail the transaction");
  assert.match(String(failed.stderr),/division by zero/i);
  assert.equal(count("flights","id="+id+" AND locked_at IS NULL"),1);
  assert.equal(count("deleted_flights","delete_token="+q(token)),0);
});

test("D3b-1 A+: parent row lock serializes a competing certification writer",{skip:!enabled,timeout:25000},async()=>{
  const id=insertFlight(9001),token=randomUUID(),steps=trashSql(id,token);
  const xmin=run("SELECT xmin::text FROM flights WHERE id="+id+";");
  const launch=()=>{
    const child=spawn("psql",["-X","-w","-qAt","-v","ON_ERROR_STOP=1","-d",url],
      {env:safeEnv(),stdio:["pipe","pipe","pipe"]});
    let stdout="",stderr="";
    child.stdout.setEncoding("utf8").on("data",(x:string)=>{stdout+=x;});
    child.stderr.setEncoding("utf8").on("data",(x:string)=>{stderr+=x;});
    const stopped=new Promise<number|null>((resolve,reject)=>{child.on("error",reject);child.on("close",resolve);});
    return {child,stopped,output:()=>stdout,error:()=>stderr};
  };
  const a=launch(),b=launch();
  async function waitFor(marker:string,read:()=>string){
    for(let n=0;n<90;n++){
      if(read().includes(marker))return;
      await new Promise(resolve=>setTimeout(resolve,60));
    }
    throw new Error("Concurrent session marker not observed: "+marker);
  }
  try{
    a.child.stdin.write("SET search_path TO "+ns+",pg_catalog;BEGIN;\n"+
      steps[0]+";\n"+steps[1]+";\nSELECT 'D3B1_ARCHIVED_A';\n");
    await waitFor("D3B1_ARCHIVED_A",a.output);
    // Writer B uses a stale-row xmin gate, as canonical certification does.
    b.child.stdin.end("SET search_path TO "+ns+",pg_catalog;BEGIN;\n"+
      "SELECT 'D3B1_PID:'||pg_backend_pid();\n"+
      "UPDATE flights SET certified_at=NOW(),locked_at=NOW(),certification_hash="+q("c".repeat(64))+
      " WHERE id="+id+" AND certified_at IS NULL AND locked_at IS NULL AND xmin::text="+q(xmin)+" RETURNING id;\n"+
      "SELECT 'D3B1_CERTIFY_FINISHED_B';\nCOMMIT;\n");
    await waitFor("D3B1_PID:",b.output);
    const pid=Number(b.output().match(/D3B1_PID:([0-9]+)/)?.[1]);
    assert.ok(Number.isSafeInteger(pid)&&pid>0,"Backend PID missing");
    let waited=false;
    for(let n=0;n<90;n++){
      if(num("SELECT count(*) FROM pg_stat_activity WHERE pid="+pid+" AND wait_event_type='Lock';")>0){
        waited=true;break;
      }
      await new Promise(resolve=>setTimeout(resolve,60));
    }
    assert.ok(waited,"Competing certification writer did not wait for the Trash parent lock");
    a.child.stdin.end(steps.slice(2).join(";\n")+";\nCOMMIT;\n");
    assert.equal(await a.stopped,0,"Trash session A failed: "+a.error());
    assert.equal(await b.stopped,0,"Certification session B failed: "+b.error());
    assert.ok(b.output().includes("D3B1_CERTIFY_FINISHED_B"));
    assert.equal(count("flights","id="+id),0);
    assert.equal(count("deleted_flights","delete_token="+q(token)),1);
  }finally{
    for(const p of [a,b]){
      if(p.child.exitCode===null){p.child.kill();await p.stopped;}
    }
  }
});


test("NEGATIVE CONTROL D3b-1e (pre-fix): no-lock GPS INSERT can orphan child during Trash",{skip:!enabled,timeout:25000},async()=>{
  // Negative control deliberately recreates PRE-FIX child-first behaviour.
  // PASS demonstrates why the new writer lock is needed; it is NOT proof that
  // the CURRENT writer remains unsafe, or a production-schema claim.
  const action=readFileSync(new URL("app/(protected)/flights/actions.ts",root),"utf8");
  const start=action.indexOf("export async function attachKmlTrack(");
  const end=action.indexOf("export async function deleteTrack(",start);
  assert.ok(start>=0 && end>start,"Track writer source boundary not found");
  const writer=action.slice(start,end),tick=String.fromCharCode(96);
  assert.ok(writer.includes("await sql"+tick+"SELECT id,locked_at FROM flights"),"Track writer has an unlocked parent read");
  const insertAt=writer.indexOf("queries.push(sql"+tick+"INSERT INTO flight_tracks(");
  const updateAt=writer.indexOf("queries.push(sql"+tick+"UPDATE flights SET ");
  assert.ok(insertAt>=0 && updateAt>insertAt,"Track INSERT remains before final parent UPDATE");
  assert.ok(writer.includes("queries=[sql"+tick+"SELECT f.id FROM flights f WHERE f.id=${flightId} AND f.user_id=${userId} AND f.locked_at IS NULL FOR UPDATE"),"Current writer must lock parent BEFORE this child-first negative-control sequence");
  assert.match(writer,/FROM flights f WHERE f\.id=\$\{flightId\} AND f\.user_id=\$\{userId\} AND f\.locked_at IS NULL RETURNING id/);
  assert.match(writer,/await sql\.transaction\(queries\)/);
  const trackFk=num("SELECT count(*) FROM pg_constraint WHERE conrelid='flight_tracks'::regclass AND contype='f' AND confrelid='flights'::regclass;");
  assert.equal(trackFk,0,"Fixture acquired parent FK; re-review this characterization");

  const id=insertFlight(9001),token=randomUUID(),steps=trashSql(id,token);
  const launch=()=>{
    const child=spawn("psql",["-X","-w","-qAt","-v","ON_ERROR_STOP=1","-d",url],
      {env:safeEnv(),stdio:["pipe","pipe","pipe"]});
    let stdout="",stderr="";
    child.stdout.setEncoding("utf8").on("data",(x:string)=>{stdout+=x;});
    child.stderr.setEncoding("utf8").on("data",(x:string)=>{stderr+=x;});
    const stopped=new Promise<number|null>((resolve,reject)=>{child.on("error",reject);child.on("close",resolve);});
    return {child,stopped,output:()=>stdout,error:()=>stderr};
  };
  const a=launch(),b=launch();
  async function waitFor(marker:string,read:()=>string){
    for(let n=0;n<100;n++){
      if(read().includes(marker))return;
      await new Promise(resolve=>setTimeout(resolve,50));
    }
    throw new Error("Race session marker absent: "+marker);
  }
  try{
    a.child.stdin.write("SET search_path TO "+ns+",pg_catalog;BEGIN;\n"+
      steps[0]+";\n"+steps[1]+";\nSELECT 'D3B1E_ARCHIVE_A';\n");
    await waitFor("D3B1E_ARCHIVE_A",a.output);

    // Mirrors the source child-first ordering of attachKmlTrack. Without a
    // parent FK, B INSERT is not blocked by A holding parent FOR UPDATE.
    b.child.stdin.end("SET search_path TO "+ns+",pg_catalog;BEGIN;\n"+
      "INSERT INTO flight_tracks(user_id,flight_id,file_name) VALUES(9001,"+id+",'race-no-fk') RETURNING id;\n"+
      "SELECT 'D3B1E_PID:'||pg_backend_pid();\n"+
      "UPDATE flights SET departure='LKAA' WHERE id="+id+" AND user_id=9001;\n"+
      "SELECT 'D3B1E_UPDATE_FINISHED_B';\nCOMMIT;\n");
    await waitFor("D3B1E_PID:",b.output);
    const pid=Number(b.output().match(/D3B1E_PID:([0-9]+)/)?.[1]);
    assert.ok(Number.isSafeInteger(pid)&&pid>0,"Writer B backend PID missing");
    let waiting=false;
    for(let n=0;n<100;n++){
      if(num("SELECT count(*) FROM pg_stat_activity WHERE pid="+pid+" AND wait_event_type='Lock';")>0){
        waiting=true;break;
      }
      await new Promise(resolve=>setTimeout(resolve,50));
    }
    assert.ok(waiting,"Writer B did not wait on Trash parent lock at UPDATE");

    a.child.stdin.end(steps.slice(2).join(";\n")+";\nCOMMIT;\n");
    assert.equal(await a.stopped,0,"Trash A failed: "+a.error());
    assert.equal(await b.stopped,0,"Track writer B failed: "+b.error());
    assert.ok(b.output().includes("D3B1E_UPDATE_FINISHED_B"));
    assert.equal(count("flights","id="+id),0);
    assert.equal(count("deleted_flights","delete_token="+q(token)),1);
    assert.equal(num("SELECT jsonb_array_length(tracks_data) FROM deleted_flights WHERE delete_token="+q(token)+";"),0,
      "Uncommitted track omitted from archive");
    assert.equal(count("flight_tracks","flight_id="+id+" AND user_id=9001"),1,
      "The unsafe no-FK fixture must retain the orphan track");
    assert.equal(num("SELECT count(*) FROM flight_tracks t JOIN flights f ON f.id=t.flight_id WHERE t.flight_id="+id+";"),0,
      "Orphan track must not have a live parent");
  }finally{
    for(const p of [a,b]){
      if(p.child.exitCode===null){p.child.kill();await p.stopped;}
    }
  }
});


function gpsParentGuardSql(id:number){
  // Extract the FIRST transaction query verbatim from the runtime writer.
  const text=readFileSync(new URL("app/(protected)/flights/actions.ts",root),"utf8");
  const a=text.indexOf("export async function attachKmlTrack(");
  const b=text.indexOf("export async function deleteTrack(",a);
  assert.ok(a>=0&&b>a,"GPS writer source missing");
  const writer=text.slice(a,b),tick=String.fromCharCode(96),prefix="queries=[sql"+tick;
  const start=writer.indexOf(prefix),end=writer.indexOf(tick+"];if(replace)",start);
  assert.ok(start>=0&&end>start,"GPS parent-first transaction boundary changed");
  const sql=writer.slice(start+prefix.length,end);
  assert.match(sql,/SELECT f\.id FROM flights f WHERE f\.id=\$\{flightId\} AND f\.user_id=\$\{userId\} AND f\.locked_at IS NULL FOR UPDATE/);
  assert.match(writer,/INSERT INTO flight_tracks[\s\S]*FROM flights f WHERE f\.id=\$\{flightId\} AND f\.user_id=\$\{userId\} AND f\.locked_at IS NULL RETURNING id/);
  return sql.replaceAll("$"+"{flightId}",String(id)).replaceAll("$"+"{userId}","9001");
}
function guardedGpsInsert(id:number,filename:string){
  // Foundational isolated fixture intentionally has fewer track columns than
  // the real upload. This reproduces exact source-backed parent gating/order,
  // NOT the entire Next.js form/Neon SDK upload workflow.
  return "INSERT INTO flight_tracks(user_id,flight_id,file_name) SELECT 9001,f.id,"+q(filename)+
    " FROM flights f WHERE f.id="+id+" AND f.user_id=9001 AND f.locked_at IS NULL RETURNING id";
}
function gpsRaceSession(){
  const child=spawn("psql",["-X","-w","-qAt","-v","ON_ERROR_STOP=1","-d",url],
    {env:safeEnv(),stdio:["pipe","pipe","pipe"]});
  let stdout="",stderr="";
  child.stdout.setEncoding("utf8").on("data",(x:string)=>{stdout+=x;});
  child.stderr.setEncoding("utf8").on("data",(x:string)=>{stderr+=x;});
  const stopped=new Promise<number|null>((resolve,reject)=>{child.on("error",reject);child.on("close",resolve);});
  return {child,stopped,output:()=>stdout,error:()=>stderr};
}
async function gpsWaitFor(marker:string,read:()=>string){
  for(let n=0;n<100;n++){
    if(read().includes(marker))return;
    await new Promise(resolve=>setTimeout(resolve,50));
  }
  throw new Error("D3b-1e concurrent session marker missing: "+marker);
}
async function gpsWaitForLock(pid:number){
  assert.ok(Number.isSafeInteger(pid)&&pid>0,"D3b-1e backend PID missing");
  for(let n=0;n<100;n++){
    if(num("SELECT count(*) FROM pg_stat_activity WHERE pid="+pid+" AND wait_event_type='Lock';")>0)return;
    await new Promise(resolve=>setTimeout(resolve,50));
  }
  throw new Error("D3b-1e expected row-lock wait was not observed");
}
async function stopGpsSessions(...sessions:ReturnType<typeof gpsRaceSession>[]){
  for(const p of sessions){
    if(p.child.exitCode===null){p.child.kill();await p.stopped;}
  }
}

test("D3b-1e SAFE writer: Trash-first parent lock prevents no-FK GPS orphan",{skip:!enabled,timeout:25000},async()=>{
  const id=insertFlight(9001),token=randomUUID(),steps=trashSql(id,token),guard=gpsParentGuardSql(id);
  assert.equal(num("SELECT count(*) FROM pg_constraint WHERE conrelid='flight_tracks'::regclass AND contype='f' AND confrelid='flights'::regclass;"),0);
  const a=gpsRaceSession(),b=gpsRaceSession();
  try{
    a.child.stdin.write("SET search_path TO "+ns+",pg_catalog;BEGIN;\n"+
      steps[0]+";\n"+steps[1]+";\nSELECT 'D3B1E_ARCHIVED_A';\n");
    await gpsWaitFor("D3B1E_ARCHIVED_A",a.output);

    b.child.stdin.end("SET search_path TO "+ns+",pg_catalog;BEGIN;\n"+
      "SELECT 'D3B1E_WRITER_PID:'||pg_backend_pid();\n"+
      guard+";\n"+
      guardedGpsInsert(id,"guarded-after-trash")+";\n"+
      "UPDATE flights SET departure='LKAA' WHERE id="+id+" AND user_id=9001 AND locked_at IS NULL RETURNING id;\n"+
      "SELECT 'D3B1E_WRITER_DONE';\nCOMMIT;\n");
    await gpsWaitFor("D3B1E_WRITER_PID:",b.output);
    await gpsWaitForLock(Number(b.output().match(/D3B1E_WRITER_PID:([0-9]+)/)?.[1]));

    a.child.stdin.end(steps.slice(2).join(";\n")+";\nCOMMIT;\n");
    assert.equal(await a.stopped,0,"Trash A failed: "+a.error());
    assert.equal(await b.stopped,0,"Guarded GPS writer B failed: "+b.error());
    assert.ok(b.output().includes("D3B1E_WRITER_DONE"));
    assert.equal(count("flights","id="+id),0);
    assert.equal(count("deleted_flights","delete_token="+q(token)),1);
    assert.equal(num("SELECT jsonb_array_length(tracks_data) FROM deleted_flights WHERE delete_token="+q(token)+";"),0);
    assert.equal(count("flight_tracks","flight_id="+id+" AND user_id=9001"),0,
      "Parent-first writer must not create an orphan after Trash");
  }finally{await stopGpsSessions(a,b)}
});

test("D3b-1e SAFE writer: GPS-first parent lock makes Trash archive the whole track",{skip:!enabled,timeout:25000},async()=>{
  const id=insertFlight(9001),token=randomUUID(),steps=trashSql(id,token),guard=gpsParentGuardSql(id);
  const a=gpsRaceSession(),b=gpsRaceSession();
  try{
    b.child.stdin.write("SET search_path TO "+ns+",pg_catalog;BEGIN;\n"+
      guard+";\n"+guardedGpsInsert(id,"guarded-before-trash")+";\n"+
      "UPDATE flights SET departure='LKAA' WHERE id="+id+" AND user_id=9001 AND locked_at IS NULL RETURNING id;\n"+
      "SELECT 'D3B1E_WRITER_READY_B';\n");
    await gpsWaitFor("D3B1E_WRITER_READY_B",b.output);

    a.child.stdin.end("SET search_path TO "+ns+",pg_catalog;BEGIN;\n"+
      "SELECT 'D3B1E_TRASH_PID:'||pg_backend_pid();\n"+
      steps.join(";\n")+";\nCOMMIT;\n");
    await gpsWaitFor("D3B1E_TRASH_PID:",a.output);
    await gpsWaitForLock(Number(a.output().match(/D3B1E_TRASH_PID:([0-9]+)/)?.[1]));
    b.child.stdin.end("COMMIT;\n");
    assert.equal(await b.stopped,0,"GPS B failed: "+b.error());
    assert.equal(await a.stopped,0,"Trash A failed: "+a.error());
    assert.equal(count("flights","id="+id),0);
    assert.equal(count("deleted_flights","delete_token="+q(token)),1);
    assert.equal(num("SELECT jsonb_array_length(tracks_data) FROM deleted_flights WHERE delete_token="+q(token)+";"),1,
      "Completed GPS track must be in the Trash snapshot");
    assert.equal(count("flight_tracks","flight_id="+id+" AND user_id=9001"),0,
      "Archived track must not remain live/orphaned");
  }finally{await stopGpsSessions(a,b)}
});


// D3b-1f: run actual source SQL statements, not reimplemented query text.
function childWriterSql(name:string,next:string,variables:Record<string,string>){
  const source=readFileSync(new URL("app/(protected)/flights/actions.ts",root),"utf8");
  const a=source.indexOf("export async function "+name+"(");
  const b=source.indexOf("export async function "+next+"(",a);
  assert.ok(a>=0&&b>a,name+" action boundary changed");
  const writer=source.slice(a,b),tx=writer.indexOf("sql.transaction([");
  const end=writer.indexOf("]) as Array",tx);
  assert.ok(tx>=0&&end>tx,"Expected batch transaction missing for "+name);
  const sqls=[...writer.slice(tx,end).matchAll(template)].map(x=>x[1]);
  assert.equal(sqls.length,3,"Expected parent-first three-statement "+name+" batch");
  assert.match(sqls[0],/SELECT f\.id FROM flights f[\s\S]*FOR UPDATE/);
  return sqls.map(statement=>statement.replace(/\$\{([A-Za-z]+)\}/g,(_,key:string)=>{
    assert.ok(Object.prototype.hasOwnProperty.call(variables,key),"Unexpected "+name+" interpolation: "+key);
    return variables[key];
  }));
}
function trackDeleteSql(flightId:number,trackId:number,userId=9001){
  const steps=childWriterSql("deleteTrack","saveFlightExpenses",{
    userId:String(userId),flightId:String(flightId),trackId:String(trackId)
  });
  assert.match(steps[1],new RegExp("track_id="+trackId+"\\\\b"));
  return steps;
}
function expensesSaveSql(flightId:number,items:Array<Record<string,string|number>>,userId=9001){
  return childWriterSql("saveFlightExpenses","applyGpsTimes",{
    userId:String(userId),id:String(flightId),expenseJson:q(JSON.stringify(items))
  });
}
const expense=(label:string,amount_minor:number)=>({
  category:"OTHER",label,amount_minor,currency:"EUR"
});
function seedExpense(flightId:number,label:string,amount=100){
  run("INSERT INTO flight_expenses(user_id,flight_id,category,label,amount_minor,currency) VALUES(9001,"+
    flightId+",'OTHER',"+q(label)+","+amount+",'EUR');");
}
function seedTrack(flightId:number,name:string){
  const id=num("INSERT INTO flight_tracks(user_id,flight_id,file_name) VALUES(9001,"+flightId+","+q(name)+") RETURNING id;");
  run("INSERT INTO track_points(user_id,track_id) VALUES(9001,"+id+"),(9001,"+id+");");
  return id;
}

test("D3b-1f: deleting one GPS track preserves other tracks and their legacy points",{skip:!enabled},()=>{
  const flightId=insertFlight(9001),selected=seedTrack(flightId,"selected"),other=seedTrack(flightId,"other");
  const foreignFlightId=insertFlight(9001),foreign=seedTrack(foreignFlightId,"different-flight");
  const steps=trackDeleteSql(flightId,selected);
  run("BEGIN;\n"+steps.join(";\n")+";\nCOMMIT;");
  assert.equal(count("track_points","track_id="+selected),0,"Selected legacy points deleted");
  assert.equal(count("flight_tracks","id="+selected),0,"Selected metadata deleted");
  assert.equal(count("track_points","track_id="+other),2,"Other track points must survive");
  assert.equal(count("flight_tracks","id="+other),1,"Other track metadata survives");
  assert.equal(count("track_points","track_id="+foreign),2,"Other flight stays untouched");
  assert.equal(count("flights","id="+flightId),1);
});

test("D3b-1f: Trash-first lock blocks selected-track deletion without orphaning children",{skip:!enabled,timeout:25000},async()=>{
  const flightId=insertFlight(9001),trackId=seedTrack(flightId,"trash-first-track"),token=randomUUID();
  const trashSteps=trashSql(flightId,token),remove=trackDeleteSql(flightId,trackId);
  const a=gpsRaceSession(),b=gpsRaceSession();
  try{
    a.child.stdin.write("SET search_path TO "+ns+",pg_catalog;BEGIN;\n"+
      trashSteps[0]+";\n"+trashSteps[1]+";\nSELECT 'D3B1F_TRASH_ARCHIVED';\n");
    await gpsWaitFor("D3B1F_TRASH_ARCHIVED",a.output);
    b.child.stdin.end("SET search_path TO "+ns+",pg_catalog;BEGIN;\n"+
      "SELECT 'D3B1F_DELETE_PID:'||pg_backend_pid();\n"+
      remove.join(";\n")+";\nSELECT 'D3B1F_DELETE_DONE';\nCOMMIT;\n");
    await gpsWaitFor("D3B1F_DELETE_PID:",b.output);
    await gpsWaitForLock(Number(b.output().match(/D3B1F_DELETE_PID:([0-9]+)/)?.[1]));
    a.child.stdin.end(trashSteps.slice(2).join(";\n")+";\nCOMMIT;\n");
    assert.equal(await a.stopped,0,"Trash A failed: "+a.error());
    assert.equal(await b.stopped,0,"Delete track B failed: "+b.error());
    assert.equal(count("flights","id="+flightId),0);
    assert.equal(count("flight_tracks","id="+trackId),0);
    assert.equal(count("track_points","track_id="+trackId),0);
    assert.equal(num("SELECT jsonb_array_length(tracks_data) FROM deleted_flights WHERE delete_token="+q(token)+";"),1,
      "Trash must archive the existing track when it wins the lock");
  }finally{await stopGpsSessions(a,b)}
});

test("D3b-1f: deleteTrack-first lock lets Trash archive only the remaining track",{skip:!enabled,timeout:25000},async()=>{
  const flightId=insertFlight(9001),selected=seedTrack(flightId,"selected"),other=seedTrack(flightId,"retained");
  const token=randomUUID(),remove=trackDeleteSql(flightId,selected),trashSteps=trashSql(flightId,token);
  const a=gpsRaceSession(),b=gpsRaceSession();
  try{
    b.child.stdin.write("SET search_path TO "+ns+",pg_catalog;BEGIN;\n"+
      remove.join(";\n")+";\nSELECT 'D3B1F_DELETE_READY';\n");
    await gpsWaitFor("D3B1F_DELETE_READY",b.output);
    a.child.stdin.end("SET search_path TO "+ns+",pg_catalog;BEGIN;\n"+
      "SELECT 'D3B1F_TRASH_PID:'||pg_backend_pid();\n"+
      trashSteps.join(";\n")+";\nCOMMIT;\n");
    await gpsWaitFor("D3B1F_TRASH_PID:",a.output);
    await gpsWaitForLock(Number(a.output().match(/D3B1F_TRASH_PID:([0-9]+)/)?.[1]));
    b.child.stdin.end("COMMIT;\n");
    assert.equal(await b.stopped,0,"Delete B failed: "+b.error());
    assert.equal(await a.stopped,0,"Trash A failed: "+a.error());
    assert.equal(count("flights","id="+flightId),0);
    assert.equal(count("flight_tracks","flight_id="+flightId),0);
    assert.equal(count("track_points","track_id IN ("+selected+","+other+")"),0);
    assert.equal(num("SELECT jsonb_array_length(tracks_data) FROM deleted_flights WHERE delete_token="+q(token)+";"),1,
      "Trash must contain retained track after selected track deletion commits");
  }finally{await stopGpsSessions(a,b)}
});

test("D3b-1f: expense replacement is serialized in both Trash-first and writer-first orders",{skip:!enabled,timeout:25000},async()=>{
  for(const trashFirst of [true,false]){
    const flightId=insertFlight(9001),token=randomUUID();
    seedExpense(flightId,"previous",100);
    const update=expensesSaveSql(flightId,[expense(trashFirst?"after-trash":"latest",250)]);
    const trashSteps=trashSql(flightId,token);
    const a=gpsRaceSession(),b=gpsRaceSession();
    try{
      if(trashFirst){
        a.child.stdin.write("SET search_path TO "+ns+",pg_catalog;BEGIN;\n"+
          trashSteps[0]+";\n"+trashSteps[1]+";\nSELECT 'D3B1F_EXP_TRASH_READY';\n");
        await gpsWaitFor("D3B1F_EXP_TRASH_READY",a.output);
        b.child.stdin.end("SET search_path TO "+ns+",pg_catalog;BEGIN;\n"+
          "SELECT 'D3B1F_EXP_PID:'||pg_backend_pid();\n"+
          update.join(";\n")+";\nSELECT 'D3B1F_EXP_DONE';\nCOMMIT;\n");
        await gpsWaitFor("D3B1F_EXP_PID:",b.output);
        await gpsWaitForLock(Number(b.output().match(/D3B1F_EXP_PID:([0-9]+)/)?.[1]));
        a.child.stdin.end(trashSteps.slice(2).join(";\n")+";\nCOMMIT;\n");
      }else{
        b.child.stdin.write("SET search_path TO "+ns+",pg_catalog;BEGIN;\n"+
          update.join(";\n")+";\nSELECT 'D3B1F_EXP_UPDATED';\n");
        await gpsWaitFor("D3B1F_EXP_UPDATED",b.output);
        a.child.stdin.end("SET search_path TO "+ns+",pg_catalog;BEGIN;\n"+
          "SELECT 'D3B1F_EXP_TRASH_PID:'||pg_backend_pid();\n"+
          trashSteps.join(";\n")+";\nCOMMIT;\n");
        await gpsWaitFor("D3B1F_EXP_TRASH_PID:",a.output);
        await gpsWaitForLock(Number(a.output().match(/D3B1F_EXP_TRASH_PID:([0-9]+)/)?.[1]));
        b.child.stdin.end("COMMIT;\n");
      }
      assert.equal(await b.stopped,0,"Expenses B failed: "+b.error());
      assert.equal(await a.stopped,0,"Trash A failed: "+a.error());
      assert.equal(count("flights","id="+flightId),0);
      assert.equal(count("flight_expenses","flight_id="+flightId),0);
      assert.equal(num("SELECT jsonb_array_length(expenses_data) FROM deleted_flights WHERE delete_token="+q(token)+";"),1);
      const archived=run("SELECT expenses_data->0->>'label' FROM deleted_flights WHERE delete_token="+q(token)+";");
      assert.equal(archived,trashFirst?"previous":"latest",
        "Archive expense must match the transaction winning the parent lock");
    }finally{await stopGpsSessions(a,b)}
  }
});
