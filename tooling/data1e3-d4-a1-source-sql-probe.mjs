// D4 A1 regression. Execute ONLY inside the owned, physically verified disposable
// PostgreSQL16 cluster created by data1e3-d4-a1-owned-local-pg16.mjs.
// Exact restored parent SQL and source-defined audit/protection triggers are loaded
// from current checkout. This is NOT full canonical-v21/application acceptance.
import assert from "node:assert/strict";
import {spawn,spawnSync} from "node:child_process";
import {randomUUID} from "node:crypto";
import {readFileSync,realpathSync} from "node:fs";
import {tmpdir} from "node:os";
import path from "node:path";
import {fileURLToPath} from "node:url";

const root=fileURLToPath(new URL("../",import.meta.url));
const urlString=process.env.DATABASE_URL||"";
const data=process.env.FLYTALLY_D4_A1_OWNED_PGDATA||"";
const stop=(reason)=>{throw Error("D4_A1_TARGET_REJECTED "+reason)};
let target;
try{target=new URL(urlString)}catch{stop("Missing URL")}
if(process.platform!=="win32"||!/^v24\./.test(process.version)||
  process.env.FLYTALLY_D4_A1_LOCAL_PROBE!=="1"||!data||
  target.protocol!=="postgresql:"||target.hostname!=="127.0.0.1"||
  target.pathname!=="/data1e3_synthetic"||target.username!=="data1e3_owner"||
  target.password||!target.port||["5432","55432"].includes(target.port)||
  target.searchParams.get("sslmode")!=="disable")stop("Require positive owned loopback target");
const norm=(s)=>path.normalize(realpathSync(s)).toLowerCase().replace(/[\\/]$/,"");
const ownedParent=path.dirname(realpathSync(data));
const ownedToken=process.env.FLYTALLY_D4_A1_OWNERSHIP_TOKEN||"";
assert.match(ownedToken,/^[a-f0-9-]{36}$/i);
assert.equal(path.dirname(ownedParent).toLowerCase(),realpathSync(tmpdir()).toLowerCase(),
  "A1 must only operate under newly owned OS temp");
assert.ok(path.basename(ownedParent).startsWith("flytally-data1e3-d4-a1-"),
  "A1 disposable prefix required");
assert.equal(readFileSync(path.join(ownedParent,".data1e3-owned"),"utf8"),ownedToken);
const result=(query)=>{
  const p=spawnSync("psql",["-d",urlString,"-X","-w","-qAt","-v","ON_ERROR_STOP=1","-c",query],
    {encoding:"utf8",windowsHide:true,shell:false,timeout:30000,maxBuffer:1024*1024});
  if(p.error||p.signal||p.status!==0)throw Error("Owned synthetic psql failed (exit "+p.status+"): "+String(p.stderr||"").slice(0,400));
  return String(p.stdout||"").trim();
};
const identity=JSON.parse(result("SELECT row_to_json(z)::text FROM (SELECT current_database() db,current_user usr,host(inet_server_addr()) addr,inet_server_port() port,current_setting('server_version_num') version,current_setting('data_directory') dir) z"));
assert.equal(identity.db,"data1e3_synthetic");assert.equal(identity.usr,"data1e3_owner");
assert.equal(identity.addr,"127.0.0.1");assert.equal(identity.port,Number(target.port));
assert.match(identity.version,/^16[0-9]{4}$/);assert.equal(norm(identity.dir),norm(data));
const restore=readFileSync(path.join(root,"lib/account-restore-v6.ts"),"utf8");
const migrations=readFileSync(path.join(root,"lib/db-optimization.ts"),"utf8");
const tick=String.fromCharCode(96);
const templates=(code)=>[...code.matchAll(new RegExp("sql"+tick+"([\\s\\S]*?)"+tick,"g"))].map(x=>x[1].trim());
const restoreBlocks=templates(restore),migrBlocks=templates(migrations);
function block(collection,needle,{last=false}={}){
  const found=collection.filter(s=>s.includes(needle));
  if(!found.length||(!last&&found.length!==1))stop("Ambiguous/missing exact source SQL: "+needle);
  return last?found.at(-1):found[0];
}
const flightInsert=block(restoreBlocks,"INSERT INTO flights SELECT (json_populate_record(NULL::flights,item)).*");
const flightUpdate=block(restoreBlocks,"UPDATE flights f SET aircraft_make=");
const fstdInsert=block(restoreBlocks,"INSERT INTO fstd_sessions SELECT (json_populate_record(NULL::fstd_sessions,item)).*");
const fstdUpdate=block(restoreBlocks,"UPDATE fstd_sessions s SET certified_at=");
for(const parent of [flightInsert,fstdInsert]){
  assert.doesNotMatch(parent,/\bON\s+CONFLICT\b/i,"parent collision must not be swallowed");
}
const flightGuard=block(migrBlocks,"CREATE OR REPLACE FUNCTION logbook_protect_locked_flight()",{last:true});
const fstdGuard=block(migrBlocks,"CREATE OR REPLACE FUNCTION logbook_protect_certified_fstd()",{last:true});
const flightAudit=block(migrBlocks,"CREATE OR REPLACE FUNCTION logbook_audit_flight_change()");
const auditTable=block(migrBlocks,"CREATE TABLE IF NOT EXISTS flight_audit_log (");
for(const s of [flightGuard,fstdGuard,flightAudit,auditTable])assert.doesNotMatch(s,/\$\{/);
const quote=(v)=>"'"+String(v).replaceAll("'","''")+"'";
const interpolate=(statement,variables)=>statement.replace(/\$\{([^}]+)\}/g,(_hit,name)=>{
  if(!Object.hasOwn(variables,name))stop("Unknown SQL placeholder: "+name);
  return quote(variables[name]);
});
const batch=(parent,rows)=>interpolate(parent,{userId:7,"JSON.stringify(batch)":JSON.stringify(rows)});
const apply=(query)=>result("SET search_path TO "+schema+"; "+query);
const schema="d4a1_"+randomUUID().replaceAll("-","");
const flightRow=(id,hash)=>({
  id,user_id:7,date:"2026-10-30",registration:"OK-SYN",
  departure:"LKPR",arrival:"LKVO",off_block:"12:00",
  aircraft_make:"Synthetic",aircraft_model:"A1",aircraft_variant:"Original",
  certified_at:"2026-10-30T12:20:00Z",certified_by_user_id:7,
  certification_hash:hash,certification_version:3,
  locked_at:"2026-10-30T12:20:00Z",locked_by_user_id:7,record_revision:1
});
const fstdRow=(id,hash)=>({
  id,user_id:7,session_date:"2026-10-30",device_type:"Synthetic FSTD",
  qualification_number:"TEST",instruction:"Training",total_minutes:60,
  certified_at:"2026-10-30T12:20:00Z",certified_by_user_id:7,
  certification_hash:hash,certification_version:3,record_revision:1
});
const stagedFlight=(row)=>({...row,aircraft_make:"",aircraft_model:"",aircraft_variant:"",
  certified_at:null,certified_by_user_id:null,certification_hash:"",
  locked_at:null,locked_by_user_id:null});
const stagedFstd=(row)=>({...row,certified_at:null,certified_by_user_id:null,certification_hash:""});
const idVal=(table,id)=>apply("SELECT to_jsonb(t)::text FROM "+table+" t WHERE id="+id);
const auditState=()=>apply("SELECT COALESCE(jsonb_agg(to_jsonb(a) ORDER BY a.id),'[]'::jsonb)::text FROM flight_audit_log a");
const markerCount=()=>Number(apply("SELECT COUNT(*) FROM d4_a1_marker"));
async function racingSession(kind,ready,sqlAfter,rowId,certified){
  const child=spawn("psql",["-d",urlString,"-X","-w","-qAt","-v","ON_ERROR_STOP=1"],{
    windowsHide:true,shell:false,env:process.env,stdio:["pipe","pipe","pipe"]});
  let stdout="",stderr="";
  child.stdout.setEncoding("utf8");child.stderr.setEncoding("utf8");
  child.stdout.on("data",s=>{stdout+=s});
  child.stderr.on("data",s=>{stderr+=s});
  const completed=new Promise(resolve=>child.once("close",code=>resolve(code)));
  child.stdin.write("SET search_path TO "+schema+";\nBEGIN;\n"+
    "INSERT INTO d4_a1_marker(kind) VALUES("+quote(kind)+");\n"+
    "SELECT COUNT(*) FROM "+(kind==="flight"?"flights":"fstd_sessions")+
    " WHERE id="+rowId+";\n"+
    "SELECT "+quote(ready)+";\n");
  const deadline=Date.now()+12000;
  while(!stdout.includes(ready)){
    if(child.exitCode!==null||Date.now()>deadline)throw Error("Session A preview barrier did not complete");
    await new Promise(r=>setTimeout(r,50));
  }
  // Session B commits a certified/locked OR unprotected draft identity, depending
  // on the case. Draft paths prove strict INSERT is not only relying on triggers.
  const table=kind==="flight"?"flights":"fstd_sessions";
  const existingRow=kind==="flight"?flightRow(rowId,"EXISTING_FLIGHT"):
    fstdRow(rowId,"EXISTING_FSTD");
  if(!certified){
    existingRow.certified_at=null;
    existingRow.certified_by_user_id=null;
    existingRow.certification_hash="DRAFT_ORIGINAL";
    if(kind==="flight"){existingRow.locked_at=null;existingRow.locked_by_user_id=null;}
  }
  apply("INSERT INTO "+table+" SELECT (json_populate_record(NULL::"+table+",item)).* FROM "+
    "json_array_elements("+quote(JSON.stringify([existingRow]))+"::json) items(item)");
  const id=rowId;
  const existing=idVal(table,id),audits=auditState(),markers=markerCount();
  assert.equal(markers,0,"uncommitted A marker is invisible in session B");
  child.stdin.end(sqlAfter+"\nCOMMIT;\n");
  const code=await Promise.race([completed,new Promise((_,reject)=>setTimeout(()=>reject(Error("Session A timeout")),15000))]);
  assert.notEqual(code,0,"A1 must fail close on concurrent same-ID insert");
  assert.match(stderr,/duplicate key|unique constraint/i,"expected actual PostgreSQL key collision");
  assert.equal(idVal(table,id),existing,"pre-existing record must remain byte-identical");
  assert.equal(auditState(),audits,"independent audit must survive the rejected A1 transaction");
  assert.equal(markerCount(),0,"all preceding changes in failed A transaction must roll back");
  return {kind,certified,duplicateRejected:true,existingUnchanged:true,auditUnchanged:true,rolledBack:true};
}
let schemaCreated=false;
try{
  result("CREATE SCHEMA "+schema);schemaCreated=true;
  apply("CREATE TABLE flights (id BIGINT PRIMARY KEY,user_id BIGINT NOT NULL,date DATE,registration TEXT DEFAULT '',departure TEXT DEFAULT '',arrival TEXT DEFAULT '',off_block TEXT DEFAULT '',aircraft_make TEXT DEFAULT '',aircraft_model TEXT DEFAULT '',aircraft_variant TEXT DEFAULT '',certified_at TIMESTAMPTZ,certified_by_user_id BIGINT,certification_hash TEXT DEFAULT '',certification_version INT DEFAULT 1,locked_at TIMESTAMPTZ,locked_by_user_id BIGINT,record_revision INT DEFAULT 1,correction_reason TEXT DEFAULT '',correction_opened_at TIMESTAMPTZ,correction_opened_by_user_id BIGINT)");
  apply("CREATE TABLE fstd_sessions (id BIGINT PRIMARY KEY,user_id BIGINT NOT NULL,session_date DATE NOT NULL,device_type TEXT NOT NULL,qualification_number TEXT DEFAULT '',instruction TEXT DEFAULT '',total_minutes INT NOT NULL,certified_at TIMESTAMPTZ,certified_by_user_id BIGINT,certification_hash TEXT DEFAULT '',certification_version INT DEFAULT 1,record_revision INT DEFAULT 1,correction_reason TEXT DEFAULT '',correction_opened_at TIMESTAMPTZ,correction_opened_by_user_id BIGINT)");
  apply("CREATE TABLE d4_a1_marker(id BIGSERIAL PRIMARY KEY,kind TEXT NOT NULL)");
  apply("CREATE TABLE flight_certified_revisions(user_id BIGINT,flight_id BIGINT,revision_number INT,certification_hash TEXT)");
  apply("CREATE TABLE fstd_certified_revisions(user_id BIGINT,fstd_session_id BIGINT,revision_number INT,certification_hash TEXT)");
  apply(auditTable);apply(flightGuard);apply(fstdGuard);apply(flightAudit);
  apply("CREATE TRIGGER trg_logbook_protect_locked_flight BEFORE UPDATE OR DELETE ON flights FOR EACH ROW EXECUTE FUNCTION logbook_protect_locked_flight()");
  apply("CREATE TRIGGER trg_logbook_audit_flight_change AFTER INSERT OR UPDATE OR DELETE ON flights FOR EACH ROW EXECUTE FUNCTION logbook_audit_flight_change()");
  apply("CREATE TRIGGER trg_logbook_protect_certified_fstd BEFORE UPDATE OR DELETE ON fstd_sessions FOR EACH ROW EXECUTE FUNCTION logbook_protect_certified_fstd()");
  const triggers=JSON.parse(apply("SELECT json_agg(tgname ORDER BY tgname)::text FROM pg_trigger WHERE NOT tgisinternal"));
  assert.deepEqual(triggers,["trg_logbook_audit_flight_change","trg_logbook_protect_certified_fstd","trg_logbook_protect_locked_flight"]);
  console.log(JSON.stringify({phase:"D4_A1_SELECTED_SOURCE_TRIGGERS",status:"PASS",threeTriggers:true,fullCanonicalV21:false}));
  for(const [kind,id,certified] of [["flight",1001,true],["fstd",2001,true],
    ["flight",1003,false],["fstd",2003,false]]){
    const name="D4_A1_"+kind.toUpperCase()+"_"+(certified?"CERTIFIED":"DRAFT")+"_TWO_SESSION";
    const row=kind==="flight"?flightRow(id,"ARCHIVED_FLIGHT"):fstdRow(id,"ARCHIVED_FSTD");
    const staged=kind==="flight"?stagedFlight(row):stagedFstd(row);
    const insert=kind==="flight"?flightInsert:fstdInsert;
    const update=kind==="flight"?flightUpdate:fstdUpdate;
    const result=await racingSession(kind,name+"_READY",batch(insert,[staged])+";\n"+
      batch(update,[row])+";",id,certified);
    console.log(JSON.stringify({phase:name,status:"PASS",...result}));
  }
  // Separate positive path: A1 still permits a genuinely new flight/FSTD and
  // executes the original post-stage update with active source-defined triggers.
  const goodFlight=flightRow(1002,"NEW_FLIGHT"),goodFstd=fstdRow(2002,"NEW_FSTD");
  apply("BEGIN; "+batch(flightInsert,[stagedFlight(goodFlight)])+"; "+
    batch(flightUpdate,[goodFlight])+"; "+batch(fstdInsert,[stagedFstd(goodFstd)])+"; "+
    batch(fstdUpdate,[goodFstd])+"; COMMIT");
  assert.equal(JSON.parse(idVal("flights",1002)).certification_hash,"NEW_FLIGHT");
  assert.equal(JSON.parse(idVal("fstd_sessions",2002)).certification_hash,"NEW_FSTD");
  assert.equal(Number(apply("SELECT COUNT(*) FROM flight_audit_log WHERE flight_id=1002")),2);
  assert.equal(markerCount(),0);
  console.log(JSON.stringify({phase:"D4_A1_POSITIVE_SOURCE_SQL",status:"PASS",flightAndFstd:true,auditCreatedAndUpdated:true}));
  console.log(JSON.stringify({phase:"D4_A1_TEST_COMPLETE",status:"PASS",twoRealSessions:true,fourRaceCases:true,
    sourceSql:true,sourceDefinedTriggers:true,fullCanonicalV21:false,authenticatedAppRestore:false,
    auditFloorF9StillOpen:true,naturalKeyStillOpen:true,protectedChildStillOpen:true}));
}catch(e){
  console.error("D4_A1_ACCEPTANCE_FAIL "+String(e instanceof Error?e.message:e).slice(0,500));
  process.exitCode=1;
}finally{
  if(schemaCreated){
    try{result("DROP SCHEMA "+schema+" CASCADE")}catch{
      console.error("D4_A1_SCHEMA_CLEANUP_FAIL");process.exitCode=2;
    }
  }
}
