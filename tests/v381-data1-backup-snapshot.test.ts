import assert from "node:assert/strict";
import {test} from "node:test";
import {
  AccountBackupSnapshotError,
  validateAccountBackupSnapshotResults,
} from "../lib/account-backup-snapshot.ts";

const probe=(snapshot="10:20:",isolation="repeatable read",readOnly="on")=>({
  transaction_isolation:isolation,transaction_read_only:readOnly,snapshot_id:snapshot,
});
function fixture(userId=9001):unknown[]{
  const rows=Array.from({length:30},()=>[] as Record<string,unknown>[]);
  rows[29]=[{id:userId,email:"synthetic@example.test"}];
  return[[probe()],...rows,[probe()]];
}
function rejected(result:unknown,code:AccountBackupSnapshotError["code"],userId=9001){
  assert.throws(()=>validateAccountBackupSnapshotResults(result,userId),
    error=>error instanceof AccountBackupSnapshotError&&error.code===code);
}

test("DATA-1 B: all 30 ordered sections and two matching read-only probes are required",()=>{
  const input=fixture();
  const output=validateAccountBackupSnapshotResults(input,9001);
  assert.equal(output.length,30);
  assert.equal(output[29][0].id,9001);
});

test("DATA-1 B: reject missing, extra, malformed and non-row snapshot sections",()=>{
  rejected(fixture().slice(0,-1),"MALFORMED_SNAPSHOT");
  rejected([...fixture(),[]],"MALFORMED_SNAPSHOT");
  const malformed=fixture();
  malformed[3]=null;
  rejected(malformed,"MALFORMED_SNAPSHOT");
  const malformedRecord=fixture();
  malformedRecord[2]=[null];
  rejected(malformedRecord,"MALFORMED_SNAPSHOT");
  const probeMissing=fixture();
  probeMissing[0]=[];
  rejected(probeMissing,"MALFORMED_SNAPSHOT");
});

test("DATA-1 B: refuse ignored READ ONLY/REPEATABLE READ options and drifted MVCC snapshots",()=>{
  const committed=fixture();
  committed[0]=[probe("10:20:","read committed")];
  rejected(committed,"ISOLATION_NOT_ENFORCED");
  const writable=fixture();
  writable[31]=[probe("10:20:","repeatable read","off")];
  rejected(writable,"ISOLATION_NOT_ENFORCED");
  const drift=fixture();
  drift[31]=[probe("11:30:")];
  rejected(drift,"ISOLATION_NOT_ENFORCED");
  const invalidSnapshot=fixture();
  invalidSnapshot[0]=[probe("")];
  rejected(invalidSnapshot,"MALFORMED_SNAPSHOT");
});

test("DATA-1 B: only one exact positive account identity can be signed",()=>{
  const absent=fixture();
  absent[30]=[];
  rejected(absent,"MISSING_PROFILE");
  const wrong=fixture(9002);
  rejected(wrong,"MISSING_PROFILE");
  const duplicate=fixture();
  duplicate[30]=[{id:9001},{id:9001}];
  rejected(duplicate,"MISSING_PROFILE");
  rejected(fixture(),"INVALID_USER_ID",0);
});
