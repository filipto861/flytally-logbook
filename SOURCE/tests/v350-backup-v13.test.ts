import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root=path.resolve(import.meta.dirname,"..");
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");

test("3.5.0 generates signed portable backup v13 with protected void history and no legacy point section",()=>{
  const backup=read("lib/account-backup.ts");
  assert.match(backup,/version:13/);
  for(const section of ["voided_certified_flights","voided_flight_certified_revisions","voided_flight_verifications","voided_flight_archive_items","flight_source_provenance"]){
    assert.ok(backup.includes(section),`missing v13 backup section ${section}`);
  }
  assert.doesNotMatch(backup,/FROM track_points|track_points:/);
  assert.match(backup,/signPortableBackup\(payload\.version,userId,digest\)/);
  assert.doesNotMatch(backup,/created_txid/);
});

test("v13 section contract retires track_points only for newly generated format while preserving legacy parsing",()=>{
  const portable=read("lib/portable-backup.ts");
  assert.match(portable,/const legacyArrays=\[[^\]]*"track_points"/);
  assert.match(portable,/const currentCoreArrays=\[[^\]]*"flight_tracks"[^\]]*\]/);
  assert.doesNotMatch(portable,/const currentCoreArrays=\[[^\]]*"track_points"/);
  assert.match(portable,/if\(version>=13\)return v13Arrays/);
  assert.match(portable,/if\(!Array\.isArray\(payload\.track_points\)\)payload\.track_points=\[\]/);
});

test("v13 exact restore never resurrects a tombstone snapshot and never touches a track_points table",()=>{
  const restore=read("lib/account-restore-v6.ts");
  assert.doesNotMatch(restore,/SELECT[^\n]*FROM track_points|INSERT INTO track_points|NULL::track_points/);
  assert.match(restore,/INSERT INTO voided_certified_flights/);
  assert.match(restore,/txid_current\(\)/);
  assert.match(restore,/INSERT INTO voided_flight_certified_revisions/);
  assert.match(restore,/INSERT INTO voided_flight_verifications/);
  assert.match(restore,/INSERT INTO voided_flight_archive_items/);
  assert.match(restore,/INSERT INTO flight_source_provenance/);
  assert.doesNotMatch(restore,/flight_snapshot[^\n]*INSERT INTO flights|INSERT INTO flights[^\n]*flight_snapshot/);
  assert.doesNotMatch(restore,/DISABLE TRIGGER|session_replication_role|SET LOCAL app\.restore/i);
});

test("v13 restore preflight is symmetric for active and tombstone identities",()=>{
  const restore=read("lib/account-restore-v6.ts");
  assert.match(restore,/A voided certified flight cannot be restored while its active flight identity exists/);
  assert.match(restore,/An active flight cannot be restored because that identity is permanently voided/);
  assert.match(restore,/Existing immutable void archive is missing protected child evidence and cannot be modified during restore/);
});

test("portable v13 protected history requires trusted server authenticity",()=>{
  const actions=read("app/(protected)/export/actions.ts"),auth=read("lib/backup-authenticity.ts");
  assert.match(actions,/Number\(parsed\.backup\.version\)>=13&&authenticity!=="verified"/);
  for(const section of ["voided_certified_flights","voided_flight_certified_revisions","voided_flight_verifications","voided_flight_archive_items","flight_source_provenance"]){
    assert.ok(auth.includes(`"${section}"`),`missing server-authoritative section ${section}`);
  }
});

test("client backup validator consumes the canonical version-aware section contract",()=>{
  const validator=read("components/backup-validator.tsx");
  assert.match(validator,/portableBackupRequiredSections/);
  assert.doesNotMatch(validator,/const legacy=|const v6=/);
});
