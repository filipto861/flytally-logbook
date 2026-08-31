import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { releaseAtLeast } from "./release-version.ts";

const root=path.resolve(import.meta.dirname,"..");
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");

test("v1.45.0 adds aircraft training without creating a parallel credential graph",()=>{
  assert.ok(releaseAtLeast(JSON.parse(read("package.json")).version,1,45,0));
  const runtime=read("lib/runtime-schema.ts"),schema=read("lib/v145-schema.ts");
  assert.match(runtime,/ensureV145Schema/);
  assert.match(schema,/ALTER TABLE pilot_qualifications ALTER COLUMN licence_id DROP NOT NULL/);
  assert.match(schema,/record_kind TEXT/);
  assert.match(schema,/record_active BOOLEAN/);
  assert.match(schema,/linked_licence_id BIGINT REFERENCES pilot_licences/);
  assert.match(schema,/training_kind TEXT/);
  assert.match(schema,/completed_on DATE/);
  assert.match(schema,/verification_signature TEXT/);
  assert.match(schema,/idx_v145_aircraft_training_user_active/);
  assert.match(schema,/idx_v145_aircraft_training_signer_pending/);
});

test("v1.45.0 aircraft-training evidence stays outside active ratings and recency credentials",()=>{
  const actions=read("app/(protected)/credentials/aircraft-actions.ts"),credentials=read("app/(protected)/credentials/page.tsx");
  const recency=read("lib/recency-service.ts"),shared=read("app/(protected)/flights/shared-actions.ts"),legacy=read("app/(protected)/flights/instructor-actions.ts");
  assert.match(actions,/NULL,\$\{userId\}[^\n]+FALSE,/);
  assert.match(actions,/'aircraft_training',TRUE/);
  assert.match(credentials,/active=TRUE AND COALESCE\(record_kind,''\)<>'aircraft_training'/);
  assert.match(recency,/FROM pilot_qualifications WHERE user_id=\$\{userId\} AND active=TRUE/);
  assert.match(shared,/FROM pilot_qualifications WHERE user_id=\$\{session\.userId\} AND active=TRUE/);
  assert.match(legacy,/FROM pilot_qualifications WHERE user_id=\$\{session\.userId\} AND active=TRUE/);
});

test("v1.45.0 separates FCL.710-style evidence from informational aircraft flown",()=>{
  const actions=read("app/(protected)/credentials/aircraft-actions.ts"),section=read("components/aircraft-qualifications-section.tsx"),credentials=read("app/(protected)/credentials/page.tsx");
  assert.match(actions,/WHERE id=\$\{requested\} AND user_id=\$\{userId\} AND active=TRUE/);
  assert.match(actions,/record_kind='aircraft_training'/);
  assert.match(section,/A recorded flight never creates a privilege automatically/);
  assert.match(section,/FCL\.710/);
  assert.match(section,/Aircraft flown/);
  assert.match(section,/FROM flights WHERE user_id=\$\{userId\}/);
  assert.match(section,/not evidence that a class, type or variant privilege is valid/);
  assert.match(credentials,/AircraftQualificationsSection/);
});

test("v1.45.0 binds connected and in-person signatures to exact training contents",()=>{
  const actions=read("app/(protected)/credentials/aircraft-actions.ts"),verification=read("lib/aircraft-training-verification.ts"),review=read("app/(protected)/connections/aircraft-training/[id]/page.tsx"),inPerson=read("app/(protected)/credentials/aircraft-training/[id]/in-person-signature/page.tsx"),pad=read("components/in-person-signature-pad.tsx");
  assert.match(verification,/kind:"AIRCRAFT_TRAINING"/);
  assert.match(verification,/linkedLicenceId/);
  assert.match(verification,/verifyVerificationSignature/);
  assert.match(actions,/signVerificationPayload\(aircraftTrainingVerificationPayload/);
  assert.match(actions,/requested_signer_user_id=\$\{signerId\}/);
  assert.match(actions,/signature_status='revoked'/);
  assert.match(review,/Sign this aircraft training record/);
  assert.match(review,/Revoke signature/);
  assert.match(inPerson,/signAircraftQualificationInPerson/);
  assert.match(pad,/recordLabel/);
  assert.match(pad,/allowExaminer/);
});

test("v1.45.0 locks signed or pending contents and keeps corrections append-only",()=>{
  const actions=read("app/(protected)/credentials/aircraft-actions.ts"),section=read("components/aircraft-qualifications-section.tsx"),roadmap=read("ROADMAP.md");
  assert.match(actions,/verified_at IS NULL AND COALESCE\(signature_status,'unsigned'\)<>'pending'/);
  assert.match(actions,/verified_at IS NULL AND COALESCE\(q\.signature_status,'unsigned'\) IN \('unsigned','declined'\)/);
  assert.match(section,/While pending, the training contents are locked/);
  assert.match(section,/archive it and create a corrected record rather than overwriting it/);
  assert.match(roadmap,/corrections use a new evidence record rather than overwriting signed evidence/);
});

test("v1.45.0 training evidence remains user-scoped and inside the portable backup graph",()=>{
  const actions=read("app/(protected)/credentials/aircraft-actions.ts"),section=read("components/aircraft-qualifications-section.tsx"),backup=read("lib/account-backup.ts"),portable=read("lib/portable-backup.ts");
  assert.match(actions,/user_id=\$\{userId\}/);
  assert.match(section,/q\.user_id=\$\{userId\}/);
  assert.match(backup,/SELECT \* FROM pilot_qualifications WHERE user_id=\$\{userId\}/);
  assert.match(portable,/pilot_qualifications\?:BackupRow\[\]/);
});

test("v1.45.0 keeps flight certification GPS and mobile shell direction untouched",()=>{
  const certification=read("lib/certification-integrity.ts"),gps=read("lib/track-processing.ts"),layout=read("app/(protected)/layout.tsx"),rootLayout=read("app/layout.tsx"),roadmap=read("ROADMAP.md");
  assert.match(certification,/flightCertificationHash/);
  assert.match(gps,/takeoffEvidenceIndex/);
  assert.match(layout,/viewportFit:"cover"/);
  assert.match(rootLayout,/v145-credentials\.css/);
  assert.match(roadmap,/## v1\.45\.0 · Licences, pilot profile & aircraft training/);
  assert.match(roadmap,/preserve flight certification payloads\/hashes\/revisions/);
});