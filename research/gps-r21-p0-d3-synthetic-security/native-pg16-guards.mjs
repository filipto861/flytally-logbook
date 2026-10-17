/**
 * FlyTally R2.1b P0-D3 native PG16 validation predicates (I1).
 * NO filesystem/process/network/SQL side effects. Actual PG16 runner NOT
 * implemented here; do not treat passing these guards as PG16 RLS evidence.
 */
import {win32 as path} from "node:path";

export const EXPECTED_BINARIES=["initdb","pg_ctl","psql","postgres","pg_controldata"];
export const EXPECTED_VERSION="16.15";
export const ATTEST_SQL=String.raw\`SELECT json_build_object(
 'data_directory',current_setting('data_directory'),
 'server_version_num',current_setting('server_version_num'),
 'listen_addresses',current_setting('listen_addresses'),
 'server_addr',inet_server_addr()::text,
 'server_port',inet_server_port(),
 'system_identifier',(pg_control_system()).system_identifier::text,
 'nonce',pg_read_file('r21_nonce.txt')
)::text;\`;

const dangerousNames=new Set(["DATABASE_URL","DIRECT_URL","NEON_DATABASE_URL","DOCKER_HOST","DOCKER_CONTEXT"]);
export function ambientConnectionOverrides(env){
  return Object.entries(env).filter(([key,value])=>{
    const name=key.toUpperCase();
    return !!value&&(dangerousNames.has(name)||/^PG[A-Z0-9_]*$/.test(name));
  }).map(([key])=>key); // never print values
}

export function validatePg16Versions(outputs){
  if(!outputs||typeof outputs!=="object")return false;
  return EXPECTED_BINARIES.every(name=>{
    const expected=name+" (PostgreSQL) "+EXPECTED_VERSION;
    return outputs[name]===expected;
  });
}

function canonicalWinPath(input){
  if(typeof input!=="string"||input.length<5||input.includes("\0")||
      !path.isAbsolute(input)||! /^[a-zA-Z]:\\/.test(input) ||
      input.startsWith("\\\\"))return null;
  return path.normalize(input).replace(/\\+$/,"").toLowerCase();
}
export function sameWindowsPath(a,b){
  const x=canonicalWinPath(a),y=canonicalWinPath(b);
  return x!==null&&x===y;
}

function insideWindowsPath(parent,child){
  const p=canonicalWinPath(parent),c=canonicalWinPath(child);
  if(!p||!c)return false;
  const rel=path.relative(p,c);
  return rel!==""&&rel!==".."&&!rel.startsWith("..\\")&&!path.isAbsolute(rel);
}

/**
 * Path / ACL guard accepts externally verified, canonical Windows metadata.
 * Caller must acquire information from Windows and reject any unknown ACL.
 * I1 does not query ACLs or create dirs. The root itself must already exist
 * and must be under owner profile, not Program Files or existing DB paths.
 */
export function validateNativeRunPaths({root,runDir,pgdata,ownerProfile,entries}){
  if(![root,runDir,pgdata,ownerProfile].every(x=>typeof x==="string"))return false;
  const cRoot=canonicalWinPath(root),cRun=canonicalWinPath(runDir);
  if(!cRoot||!cRun||!insideWindowsPath(ownerProfile,root)||
     !insideWindowsPath(root,runDir)||!insideWindowsPath(runDir,pgdata)||
     !sameWindowsPath(pgdata,path.join(runDir,"pgdata")))return false;
  if(!/^flytally-r21-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      .test(path.basename(cRun)))return false;
  const unsafe=/(?:^|\\)(?:public|program files|programdata|postgresql|github)(?:\\|$)/i;
  if(unsafe.test(cRoot))return false;
  if(!Array.isArray(entries)||entries.length<3)return false;
  const allowed=new Set(entries.map(e=>canonicalWinPath(e?.path)));
  if(allowed.has(null)||allowed.size!==entries.length||!allowed.has(cRoot)||
      !allowed.has(cRun)||!allowed.has(canonicalWinPath(pgdata)))return false;
  return entries.every(e=>e?.isReparsePoint===false&&e?.aclTrusted===true&&
    e?.trustedOwner===true&&e?.exists===true);
}

/**
 * Auth check for a *minimal replaced* HBA. Not a parser for arbitrary HBA
 * policy. Before start write a single approved rule and verify exact text;
 * do not accept generated broad/trust host/replication rules or include dirs.
 */
export function validateMinimalHba(content){
  if(typeof content!=="string")return false;
  const active=content.split(/\r?\n/).map(x=>x.replace(/#.*$/,"").trim())
    .filter(Boolean).map(x=>x.split(/\s+/).join(" "));
  return active.length===1&&
    active[0]==="host all postgres 127.0.0.1/32 scram-sha-256";
}

export function validateStartupLog(text,port){
  if(typeof text!=="string"||!Number.isInteger(port)||port<49152||port>65535)return false;
  if(/\b(?:FATAL|PANIC)\b|could not (?:bind|create|listen)|address already in use/i.test(text))
    return false;
  const expected=new RegExp('listening on IPv4 address "127\\.0\\.0\\.1", port '+port+'\\b');
  return expected.test(text);
}

export function parseControlSystemIdentifier(text){
  if(typeof text!=="string")return null;
  const found=text.match(/^Database system identifier:\s*([0-9]{10,})\s*$/m);
  return found?found[1]:null;
}

export function validateServerAttestation(expected,raw){
  if(typeof raw==="string"){
    try{raw=JSON.parse(raw);}catch{return false;}
  }
  if(!raw||typeof raw!=="object"||Array.isArray(raw)||!expected)return false;
  const {pgdata,port,systemId,nonce}=expected;
  return sameWindowsPath(raw.data_directory,pgdata)&&
    raw.server_version_num==="160015"&&
    raw.listen_addresses==="127.0.0.1"&&
    raw.server_addr==="127.0.0.1"&&
    Number.isInteger(port)&&port>=49152&&port<=65535&&
    raw.server_port===port&&
    typeof systemId==="string"&&/^[0-9]{10,}$/.test(systemId)&&
    raw.system_identifier===systemId&&
    typeof nonce==="string"&&nonce.length>=32&&
    raw.nonce===nonce;
}

/**
 * Only for identity checks BEFORE stopping a known server; not a process
 * termination command. Actual Windows process PID/executable/creation proof
 * must come from independently obtained OS metadata (never from pidfile).
 */
export function validateOwnedPostmaster({pidfile,pgdata,port,process,expectedPid}){
  if(typeof pidfile!=="string"||!process||typeof process!=="object")return false;
  const lines=pidfile.split(/\r?\n/);
  if(lines.length<6)return false;
  const pid=Number(lines[0]),filePort=Number(lines[3]);
  if(!Number.isSafeInteger(pid)||pid<=0||pid!==expectedPid||port!==filePort||
     !sameWindowsPath(lines[1],pgdata)||process.pid!==pid||
     !sameWindowsPath(process.executable,
       "C:\\Program Files\\PostgreSQL\\16\\bin\\postgres.exe")||
     !process.startedByThisRun||!process.commandLineMatchesPgdata)return false;
  return true;
}

export function validateRunOwnershipForCleanup(state){
  return state?.createdByThisRun===true&&state?.stoppedVerified===true&&
    state?.pidNotAliveVerified===true&&state?.aclTrusted===true&&
    state?.noReparsePoints===true&&state?.markerMatched===true&&
    typeof state?.systemId==="string"&&state.systemId.length>=10&&
    state.systemId===state?.expectedSystemId&&
    state?.pathOwnedVerified===true;
}
