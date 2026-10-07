import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { voidEvidenceSha256 } from "../lib/void-evidence.ts";

const root=path.resolve(import.meta.dirname,"..");
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");

test("void evidence hashes are canonical across object key order",()=>{
  assert.equal(voidEvidenceSha256({b:2,a:{z:1,y:[3,2,1]}}),voidEvidenceSha256({a:{y:[3,2,1],z:1},b:2}));
  assert.notEqual(voidEvidenceSha256({a:1}),voidEvidenceSha256({a:2}));
});

test("3.5.0 M2 mutation is owner-scoped, certified-only and optimistic-lock protected",()=>{
  const service=read("lib/flight-voiding.ts");
  assert.match(service,/WHERE f\.id=\$\{flightId\} AND f\.user_id=\$\{userId\}/);
  assert.match(service,/if\(!flight\.certifiedAt\|\|!flight\.certificationHash\)return\{status:"not-certified"/);
  assert.match(service,/f\.xmin::text=\$\{flight\.xmin\}/);
  assert.match(service,/COALESCE\(f\.record_revision,1\)=\$\{flight\.recordRevision\}/);
  assert.match(service,/COALESCE\(f\.certification_hash,''\)=\$\{flight\.certificationHash\}/);
  assert.match(service,/FOR UPDATE/);
  assert.match(service,/pg_advisory_xact_lock/);
});

test("3.5.0 M2 archives protected evidence before active-row removal",()=>{
  const service=read("lib/flight-voiding.ts");
  for(const source of [
    "flight_certified_revisions","flight_verifications","instructor_flight_approvals","flight_participations",
    "flight_connected_crew","flight_public_shares","flight_expenses","flight_tracks","flight_source_provenance",
  ])assert.ok(service.includes(source),`missing protected evidence source ${source}`);
  for(const kind of ["INSTRUCTOR_APPROVAL","PARTICIPATION","CONNECTED_CREW","PUBLIC_SHARE","EXPENSE","TRACK","SOURCE_PROVENANCE"]){
    assert.ok(service.includes(`'${kind}'`),`missing archive kind ${kind}`);
  }
  assert.match(service,/voidEvidenceSha256/);
  assert.doesNotMatch(service,/track_points|TRACK_POINT/);
  assert.match(service,/to_jsonb\([a-z]+\) IS NOT DISTINCT FROM/);
});

test("3.5.0 M2 final delete is evidence-count gated and rolls back through the deferred tombstone invariant",()=>{
  const service=read("lib/flight-voiding.ts");
  assert.match(service,/DELETE FROM flights f[\s\S]*v\.flight_snapshot IS NOT DISTINCT FROM to_jsonb\(f\)/);
  assert.match(service,/COUNT\(\*\) FROM voided_flight_certified_revisions/);
  assert.match(service,/COUNT\(\*\) FROM voided_flight_verifications/);
  for(const kind of ["INSTRUCTOR_APPROVAL","PARTICIPATION","CONNECTED_CREW","PUBLIC_SHARE","EXPENSE","TRACK","SOURCE_PROVENANCE"]){
    assert.match(service,new RegExp(`item_kind='${kind}'`));
  }
  assert.match(service,/NOT EXISTS\(SELECT 1 FROM flight_certified_revisions/);
  assert.match(service,/NOT EXISTS\(SELECT 1 FROM flight_tracks/);
});

test("3.5.0 M2 supersedes pending workflow, revokes shares, binds provenance and refreshes recency",()=>{
  const service=read("lib/flight-voiding.ts");
  assert.match(service,/UPDATE flight_participations[\s\S]*status='superseded'/);
  assert.match(service,/UPDATE instructor_flight_approvals[\s\S]*status='superseded'/);
  assert.match(service,/UPDATE flight_verifications[\s\S]*status='superseded'/);
  assert.match(service,/UPDATE flight_public_shares[\s\S]*revoked_at=COALESCE/);
  assert.match(service,/UPDATE flight_source_provenance[\s\S]*source_voided_flight_id=v\.id/);
  assert.match(service,/UPDATE user_notifications[\s\S]*read_at=COALESCE/);
  assert.match(service,/await refreshRecencySnapshot\(userId\)/);
});

test("3.5.0 M5 notification history cannot retain dead source-workflow links after void",()=>{
  const service=read("lib/flight-voiding.ts");
  assert.ok(service.includes("href='/audit/voided-flights/'||v.id::text"));
  assert.ok(service.includes("UPDATE user_notifications n SET read_at=COALESCE(n.read_at,NOW()),href=''"));
  assert.ok(service.includes("'/connections/shared/'||p.id"));
  assert.ok(service.includes("'/connections/flight/'||a.id"));
});
test("3.5.0 authenticated action delegates to the canonical void service and hides raw errors",()=>{
  const action=read("app/(protected)/flights/certification-actions.ts");
  assert.match(action,/const \{userId\}=await requireUser\(\)/);
  assert.match(action,/voidCertifiedFlightRecord\(userId,flightId,reason\)/);
  assert.match(action,/revalidateFlightVoidViews\(flightId\)/);
  assert.match(action,/console\.error\("certified-flight-void-failed"/);
  assert.match(action,/Existing logbook data is unchanged/);
  assert.doesNotMatch(action,/DELETE FROM flights/);
});

test("accepted shared-flight materialization creates immutable source provenance before linking the copy",()=>{
  const shared=read("app/(protected)/flights/shared-actions.ts");
  assert.match(shared,/provenance AS\([\s\S]*INSERT INTO flight_source_provenance/);
  assert.match(shared,/source_flight_id,source_user_id,source_revision,source_hash/);
  assert.match(shared,/ON CONFLICT\(participant_flight_id,participant_user_id\) DO UPDATE[\s\S]*WHERE flight_source_provenance\.source_flight_id=EXCLUDED\.source_flight_id/);
  assert.match(shared,/linked AS\([\s\S]*FROM provenance,current_source/);
});

test("certified-flight void revalidation covers all primary active read models",()=>{
  const revalidation=read("lib/flight-revalidation.ts");
  for(const route of ["/flights","/dashboard","/print","/database","/connections","/notifications","/credentials","/statistics","/map","/export","/data"]){
    assert.ok(revalidation.includes(`revalidatePath("${route}")`),`missing revalidation for ${route}`);
  }
});
