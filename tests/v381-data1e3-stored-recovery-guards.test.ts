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
