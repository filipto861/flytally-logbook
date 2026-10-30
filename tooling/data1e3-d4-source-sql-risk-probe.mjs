// Minimal frozen-source SQL probe. Only called inside a positively verified disposable local PG16.
// Exit 30 = D4 existing-code safety FAIL; exit 0 = synthetic collision not corrupting; exit 2 = blocked.
import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";
import {randomUUID} from "node:crypto";
import {readFileSync,realpathSync} from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
const root=fileURLToPath(new URL("../",import.meta.url));
function refuse(m){throw Error("D4_SOURCE_PROBE_BLOCKED "+m)}
const urlString=process.env.DATABASE_URL||"";
let u;try{u=new URL(urlString)}catch{refuse("No valid URL")}
if(process.env.FLYTALLY_D4_LOCAL_PROBE!=="1"||
  !process.env.FLYTALLY_D4_OWNED_PGDATA||
  u.protocol!=="postgresql:"||u.hostname!=="127.0.0.1"||
  u.pathname!=="/data1e3_synthetic"||u.username!=="data1e3_owner"||
  u.password||!u.port||["5432","55432"].includes(u.port)||
  process.platform!=="win32"||!/^v24\./.test(process.version))refuse("Unsafe purpose/identity");
const normalize=p=>path.normalize(realpathSync(p)).toLowerCase().replace(/[\\/]$/,"");
function sql(query){
  const r=spawnSync("psql",["-d",urlString,"-X","-w","-qAt","-v","ON_ERROR_STOP=1","-c",query],
    {encoding:"utf8",windowsHide:true,shell:false,timeout:25000,maxBuffer:4*1024*1024});
  if(r.error||r.signal||r.status!==0)refuse("psql failed exit="+r.status+" "+String(r.stderr||"").slice(0,240));
  return String(r.stdout||"").trim();
}
const identity=JSON.parse(sql("SELECT row_to_json(t)::text FROM (SELECT current_database() AS db,"+
  "current_user AS usr,inet_server_addr()::text AS addr,current_setting('server_version_num') AS version,"+
  "current_setting('data_directory') AS data) t"));
if(identity.db!=="data1e3_synthetic"||identity.usr!=="data1e3_owner"||
  identity.addr!=="127.0.0.1"||!/^16[0-9]{4}$/.test(identity.version)||
  normalize(identity.data)!==normalize(process.env.FLYTALLY_D4_OWNED_PGDATA))refuse("Not owned PG16");
const source=readFileSync(path.join(root,"lib/account-restore-v6.ts"),"utf8");
const tick=String.fromCharCode(96),blocks=[...source.matchAll(new RegExp("sql"+tick+"([\\s\\S]*?)"+tick,"g"))].map(m=>m[1]);
const block=needle=>{const matches=blocks.filter(s=>s.includes(needle));if(matches.length!==1)refuse("Missing/ambiguous source SQL: "+needle);return matches[0]};
const flightInsert=block("INSERT INTO flights SELECT (json_populate_record(NULL::flights,item)).*");
const flightUpdate=block("UPDATE flights f SET aircraft_make=");
const fstdInsert=block("INSERT INTO fstd_sessions SELECT (json_populate_record(NULL::fstd_sessions,item)).*");
const fstdUpdate=block("UPDATE fstd_sessions s SET certified_at=");
const auditDelete=block("DELETE FROM flight_audit_log WHERE user_id=");
const quote=s=>"'"+String(s).replaceAll("'","''")+"'";
function render(template,values){
  return template.replace(/\$\{([^}]+)\}/g,(_,name)=>{
    if(!Object.prototype.hasOwnProperty.call(values,name))refuse("Unknown source placeholder "+name);
    return quote(values[name]);
  });
}
const schema="d4_race_"+randomUUID().replaceAll("-","");
let schemaCreated=false;
try{
  sql("CREATE SCHEMA "+schema);schemaCreated=true;
  sql("SET search_path TO "+schema+"; CREATE TABLE flights ("+
    "id BIGINT PRIMARY KEY,user_id BIGINT NOT NULL,aircraft_make TEXT DEFAULT '',"+
    "aircraft_model TEXT DEFAULT '',aircraft_variant TEXT DEFAULT '',"+
    "certified_at TIMESTAMPTZ,certified_by_user_id BIGINT,certification_hash TEXT DEFAULT '',"+
    "certification_version INTEGER DEFAULT 1,locked_at TIMESTAMPTZ,locked_by_user_id BIGINT);"+
    "CREATE TABLE fstd_sessions(id BIGINT PRIMARY KEY,user_id BIGINT NOT NULL,"+
    "certified_at TIMESTAMPTZ,certified_by_user_id BIGINT,certification_hash TEXT DEFAULT '',"+
    "certification_version INTEGER DEFAULT 1);"+
    "CREATE TABLE flight_audit_log(id BIGINT PRIMARY KEY,user_id BIGINT NOT NULL,"+
    "flight_id BIGINT NOT NULL,event TEXT NOT NULL DEFAULT '')");
  // Synthetic other-user write occurs after a hypothetical preview said the IDs were missing.
  sql("SET search_path TO "+schema+";"+
    "INSERT INTO flights(id,user_id,certification_hash,certification_version) VALUES (1001,7,'ORIGINAL_FLIGHT',3);"+
    "INSERT INTO fstd_sessions(id,user_id,certification_hash,certification_version) VALUES (2001,7,'ORIGINAL_FSTD',3);"+
    "INSERT INTO flight_audit_log(id,user_id,flight_id,event) VALUES (1,7,1001,'before_preview')");
  const floor=Number(sql("SET search_path TO "+schema+"; SELECT COALESCE(MAX(id),0)::bigint FROM flight_audit_log"));
  assert.equal(floor,1);
  const flight=[{id:1001,user_id:7,aircraft_make:"Synthetic",aircraft_model:"Test",
    aircraft_variant:"",certified_at:"",certified_by_user_id:7,
    certification_hash:"RESTORED_FLIGHT",certification_version:3,locked_at:"",locked_by_user_id:7}];
  const fstd=[{id:2001,user_id:7,certified_at:"",certified_by_user_id:7,
    certification_hash:"RESTORED_FSTD",certification_version:3}];
  const vars=a=>({userId:"7","JSON.stringify(batch)":JSON.stringify(a)});
  sql("SET search_path TO "+schema+";"+render(flightInsert,vars(flight))+";"+render(flightUpdate,vars(flight)));
  sql("SET search_path TO "+schema+";"+render(fstdInsert,vars(fstd))+";"+render(fstdUpdate,vars(fstd)));
  sql("SET search_path TO "+schema+"; INSERT INTO flight_audit_log(id,user_id,flight_id,event) VALUES (2,7,1001,'independent_user_audit')");
  sql("SET search_path TO "+schema+";"+render(auditDelete,{
    userId:"7",auditFloor:String(floor),ids:JSON.stringify(["1001"])}));
  const observed=JSON.parse(sql("SET search_path TO "+schema+"; SELECT row_to_json(t)::text FROM ("+
    "SELECT (SELECT certification_hash FROM flights WHERE id=1001) AS flight,"+
    "(SELECT certification_hash FROM fstd_sessions WHERE id=2001) AS fstd,"+
    "(SELECT COUNT(*) FROM flight_audit_log WHERE id=2) AS audit) t"));
  const f3Flight=observed.flight!=="ORIGINAL_FLIGHT",f3Fstd=observed.fstd!=="ORIGINAL_FSTD",f9=Number(observed.audit)===0;
  const unsafe=f3Flight||f3Fstd||f9;
  console.log(JSON.stringify({phase:"D4_SOURCE_SQL_INTERLEAVING",syntheticOnly:true,
    flightExistingCertificationModified:f3Flight,fstdExistingCertificationModified:f3Fstd,
    independentAuditRecordDeleted:f9,securityResult:unsafe?"FAIL":"PASS",
    simulatedInterleaving:true,twoRealSessions:false,fullAppRestore:false}));
  if(unsafe)process.exitCode=30;
}catch(e){
  console.error(String(e instanceof Error?e.message:e).slice(0,700));process.exitCode=2;
}finally{
  if(schemaCreated){try{sql("DROP SCHEMA "+schema+" CASCADE")}catch(e){
    console.error("D4_PROBE_CLEANUP_FAILED "+String(e));process.exitCode=2;
  }}
}
