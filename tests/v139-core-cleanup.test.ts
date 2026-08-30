import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root=path.resolve(import.meta.dirname,"..");
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");

test("v1.39.0 uses one retryable runtime schema gate",()=>{
  assert.equal(JSON.parse(read("package.json")).version,"1.39.0");
  const runtime=read("lib/runtime-schema.ts"),layout=read("app/(protected)/layout.tsx"),shared=read("app/(protected)/flights/shared-actions.ts");
  assert.match(runtime,/await ensureDatabaseOptimizations\(\)/);
  assert.match(runtime,/Promise\.all\(\[ensureV132Schema\(\),ensureV1353Schema\(\)\]\)/);
  assert.match(runtime,/__logbookRuntimeSchema=undefined/);
  assert.match(layout,/ensureRuntimeSchema/);
  assert.doesNotMatch(layout,/ensureDatabaseOptimizations|ensureV132Schema|ensureV1353Schema/);
  assert.match(shared,/ensureRuntimeSchema/);
  assert.doesNotMatch(shared,/ensureDatabaseOptimizations|ensureV132Schema/);
});

test("v1.39.0 modern instructor requests stop creating legacy approval projections",()=>{
  const source=read("lib/training-verification.ts");
  assert.match(source,/INSERT INTO flight_participations/);
  assert.match(source,/approval_id=NULL/);
  assert.match(source,/return\{participationId,approvalId:0\}/);
  assert.doesNotMatch(source,/INSERT INTO instructor_flight_approvals/);
  assert.match(source,/ensureRuntimeSchema/);
});

test("v1.39.0 legacy approval synchronization is exact rather than fuzzy",()=>{
  const shared=read("app/(protected)/flights/shared-actions.ts");
  assert.match(shared,/RETURNING source_flight_id,source_user_id,source_revision,source_hash,participant_role,approval_id/);
  assert.match(shared,/student_user_id=\$\{Number\(rows\[0\]\.source_user_id\)\}/);
  assert.match(shared,/record_revision=\$\{Number\(rows\[0\]\.source_revision\)\}/);
  assert.match(shared,/flight_hash=\$\{text\(rows\[0\]\.source_hash\)\}/);
  assert.match(shared,/student_user_id=\$\{payload\.flightUserId\}/);
  assert.match(shared,/record_revision=\$\{payload\.recordRevision\}/);
  assert.match(shared,/flight_hash=\$\{payload\.flightHash\}/);
  assert.doesNotMatch(shared,/instructor_flight_approvals SET status='declined'[\s\S]{0,500}\bOR\s*\(/);
  assert.doesNotMatch(shared,/instructor_flight_approvals SET status='approved'[\s\S]{0,500}\bOR\s*\(/);
});

test("v1.39.0 mapped legacy approval URLs converge on the shared workflow",()=>{
  const page=read("app/(protected)/connections/flight/[id]/page.tsx");
  assert.match(page,/p\.id participation_id/);
  assert.match(page,/redirect\(`\/connections\/shared\/\$\{Number\(row\.participation_id\)\}`\)/);
  assert.match(page,/ensureRuntimeSchema/);
});

test("v1.39.0 deliberately preserves backup restore compatibility tables",()=>{
  const backup=read("lib/account-backup.ts"),restore=read("lib/account-restore-v6.ts"),roadmap=read("ROADMAP.md");
  assert.match(backup,/track_points/);
  assert.match(backup,/instructor_flight_approvals/);
  assert.match(restore,/track_points/);
  assert.match(restore,/instructor_flight_approvals/);
  assert.match(roadmap,/explicitly retain legacy `track_points`/);
  assert.match(roadmap,/no longer populated by the modern request path/);
});

test("v1.39.0 does not alter the stabilized GPS inference module",()=>{
  const roadmap=read("ROADMAP.md"),gps=read("lib/track-processing.ts");
  assert.match(roadmap,/keep certification payloads\/hashes\/revisions, Recency Engine, GPS inference/);
  assert.match(gps,/takeoffEvidenceIndex/);
  assert.match(gps,/hasImplausibleAltitudeJump/);
});
