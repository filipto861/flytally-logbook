import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import path from "node:path";
import {test} from "node:test";
import {portableBackupAuthenticity,signPortableBackup} from "../lib/backup-authenticity.ts";

const read=(name:string)=>readFileSync(path.resolve(import.meta.dirname,"..",name),"utf8");
const digest="a".repeat(64);
const sourceUserId=9001;
const signatureKey="synthetic-only-data1e3-test-signing-key-not-a-user-secret";

test("DATA-1E3 D1: stored v13 HMAC binds account/version/digest, not database digest alone",()=>{
  const old=process.env.SIGNING_SECRET;
  process.env.SIGNING_SECRET=signatureKey;
  try{
    const signature=signPortableBackup(13,sourceUserId,digest);
    const valid={version:13,profile:{id:sourceUserId},integrity:{signature_version:1,server_signature:signature}};
    assert.equal(portableBackupAuthenticity(valid,digest),"verified");
    assert.equal(portableBackupAuthenticity({...valid,profile:{id:sourceUserId+1}},digest),"invalid");
    assert.equal(portableBackupAuthenticity({...valid,version:12},digest),"invalid");
    assert.equal(portableBackupAuthenticity(valid,"b".repeat(64)),"invalid");
    assert.equal(portableBackupAuthenticity({...valid,integrity:{signature_version:1,server_signature:""}} ,digest),"invalid");
    assert.equal(portableBackupAuthenticity({...valid,integrity:{signature_version:1,server_signature:"b".repeat(64)}},digest),"invalid");
  }finally{
    if(old===undefined)delete process.env.SIGNING_SECRET;
    else process.env.SIGNING_SECRET=old;
  }
});

test("DATA-1E3 D1: stored v13 is rejected before preview or restore and pre-restore writes",()=>{
  const code=read("app/(protected)/export/actions.ts");
  const start=code.indexOf("export async function restoreStoredBackup(");
  const end=code.indexOf("export async function restoreDeletedFlight(",start);
  assert.ok(start>=0&&end>start,"stored recovery action present");
  const action=code.slice(start,end);
  const load=action.indexOf("loadStoredBackup(userId,id)");
  const signature=action.indexOf('portableBackupAuthenticity(stored.backup,stored.digest)!=="verified"');
  const dispatch=action.indexOf("restoreParsedBackup(userId,stored,form");
  assert.ok(load>=0&&signature>load&&dispatch>signature,"v13 auth must precede preview/restore dispatch");
  assert.match(action,/Number\(stored\.backup\.version\)>=13/);
  assert.match(action,/trustedSharedState:true/);
  assert.match(action,/authenticity:Number\(stored\.backup\.version\)>=13\?"verified":"stored"/);
  assert.doesNotMatch(action,/return\{error:error instanceof Error\?error\.message/);
});

test("DATA-1E3 D3: backup download errors do not leak internal exceptions and stay private/no-store",()=>{
  const code=read("app/api/backups/[id]/route.ts");
  assert.match(code,/getSession\(\)/);
  assert.match(code,/loadStoredBackup\(session\.userId,id\)/);
  assert.match(code,/new Response\("Backup unavailable",\{status:404,headers:\{"cache-control":"private, no-store"\}\}\)/);
  assert.doesNotMatch(code,/return new Response\(error instanceof Error\?error\.message/);
  assert.match(code,/"content-disposition"/);
  assert.match(code,/"cache-control":"private, no-store"/);
});

function assertD4StrictParentInsert(sqlText:string,label:string){
  assert.match(sqlText,/^INSERT INTO (flights|fstd_sessions) SELECT \(json_populate_record\(NULL::(flights|fstd_sessions),item\)\)\.\*/);
  assert.doesNotMatch(sqlText,/\bON\s+CONFLICT\b/i,label+" must abort on a concurrent primary-key collision");
  assert.match(sqlText,/AS items\(item\)\s*$/i);
}

test("DATA-1E3 D4 A1: flight and FSTD staging INSERTs reject concurrent same-ID collisions",()=>{
  const source=read("lib/account-restore-v6.ts");
  const sqlTemplates=[...source.matchAll(/sql`([^\`]+)`/g)].map(match=>match[1].trim());
  for(const [table,stageMarker] of [
    ["flights","newFlights.map(stageFlight)"],
    ["fstd_sessions","newFstd.map(stageFstd)"],
  ]){
    const statement=sqlTemplates.filter(part=>part.startsWith("INSERT INTO "+table+" SELECT (json_populate_record(NULL::"+table+",item)).*"));
    assert.equal(statement.length,1,table+" must have precisely one staging insertion statement");
    assertD4StrictParentInsert(statement[0],table);
    const index=source.indexOf(stageMarker),update=source.indexOf("UPDATE "+table+" ",index);
    assert.ok(index>=0&&update>index,table+" only receives its certification UPDATE after strict INSERT");
  }
  assert.match(source,/await sql\.transaction\(queries\)/);
  assert.doesNotMatch(source,/await sql\.transaction\(queries\)[\s\S]*?UPDATE (flights|fstd_sessions)/);
  // Counterexample: original vulnerable SQL must fail this guard.
  assert.throws(()=>assertD4StrictParentInsert(
    "INSERT INTO flights SELECT (json_populate_record(NULL::flights,item)).* FROM json_array_elements('[]'::json) AS items(item) ON CONFLICT DO NOTHING",
    "original unsafe parent insert"
  ));
});

test("DATA-1E3 D4 A1: conflict errors disclose retained safety backup without SQL/flight details",()=>{
  const action=read("app/(protected)/export/actions.ts");
  const start=action.indexOf('try{const result=await executeExactAccountRestore(');
  const end=action.indexOf('  }\n  const preview=await buildPreview(',start);
  assert.ok(start>=0&&end>start,"exact restore error handler exists");
  const region=action.slice(start,end);
  assert.match(region,/code==="23505"\|\|code==="23P01"/);
  assert.match(region,/main restore was rolled back; your pre-restore safety backup was retained/);
  assert.doesNotMatch(region,/console\.error\("v6-exact-restore-failed",error\)/);
  assert.doesNotMatch(region,/database \$\{code\}|error\.message|JSON\.stringify\(error\)/);
  assert.match(region,/console\.error\("v6-exact-restore-failed",\{kind:/);
});

test("DATA-1E3 D4 A1: separate preview/backup/transaction boundaries remain explicit",()=>{
  const action=read("app/(protected)/export/actions.ts");
  const start=action.indexOf("async function restoreParsedBackup(");
  const stop=action.indexOf("export async function restorePortableBackup(",start);
  const restore=action.slice(start,stop);
  const preflight=restore.indexOf("prepareExactAccountRestore(userId,");
  const confirm=restore.indexOf('trim().toUpperCase()!=="RESTORE"');
  const safety=restore.indexOf('createStoredBackup(userId,"pre_restore")');
  const execute=restore.indexOf('executeExactAccountRestore(userId,parsed.backup,prepared)');
  assert.ok(preflight>=0&&confirm>preflight&&safety>confirm&&execute>safety);
  assert.match(restore,/The main restore was rolled back; your pre-restore safety backup was retained/);
});
