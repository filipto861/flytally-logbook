import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { parsePortableBackup,portableBackupDigest } from "../lib/portable-backup.ts";
import { releaseAtLeast } from "./release-version.ts";

const root=path.resolve(import.meta.dirname,"..");
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");
const backupSections=["flights","aircraft","rates","airports","expiries","settings","flight_tracks","track_points","audit_log","fstd_sessions","flight_certified_revisions","fstd_certified_revisions","deleted_flights","pilot_connections","flight_participations","instructor_flight_approvals","pilot_licences","pilot_qualifications","user_notifications","flight_verifications","connection_audit_log"] as const;

async function signedBackup(overrides:Record<string,unknown>={}){
  const arrays=Object.fromEntries(backupSections.map(key=>[key,[]])) as Record<string,unknown[]>;
  Object.assign(arrays,overrides);
  const payload={format:"pilot-logbook-portable",version:7,schema_version:13,exported_at:"2026-08-30T19:00:00.000Z",profile:{id:41},counts:Object.fromEntries(backupSections.map(key=>[key,arrays[key].length])),...arrays};
  const digest=await portableBackupDigest(JSON.stringify(payload));
  return JSON.stringify({...payload,integrity:{algorithm:"SHA-256",payload_sha256:digest}});
}

test("v1.44.0 prevents duplicate production verification runs",()=>{
  assert.ok(releaseAtLeast(JSON.parse(read("package.json")).version,1,44,0));
  const workflow=read(".github/workflows/verify-web.yml");
  assert.match(workflow,/pull_request:\s*\n\s*branches:\s*\n\s*- main/);
  assert.match(workflow,/concurrency:/);
  assert.match(workflow,/github\.event\.pull_request\.number \|\| github\.ref/);
  assert.match(workflow,/cancel-in-progress: true/);
  assert.doesNotMatch(workflow,/\n  push:/);
  assert.match(workflow,/FLYTALLY_POSTGRES_INTEGRATION: "1"/);
});

test("v1.44.0 hardens current hot paths without removing compatibility data",()=>{
  const runtime=read("lib/runtime-schema.ts"),schema=read("lib/v144-schema.ts"),backup=read("lib/account-backup.ts"),restore=read("lib/account-restore-v6.ts");
  assert.match(runtime,/ensureV144Schema/);
  assert.match(schema,/idx_v144_track_points_user_track_seq/);
  assert.match(schema,/idx_v144_participations_source_status/);
  assert.match(schema,/idx_v144_participations_received/);
  assert.match(schema,/idx_v144_verifications_exact_revision/);
  assert.match(schema,/idx_v144_notifications_user_href/);
  assert.match(backup,/track_points/);
  assert.match(restore,/track_points/);
});

test("v1.44.0 rejects unrelated connection audit evidence even with a recomputed digest",async()=>{
  const valid=await signedBackup({connection_audit_log:[{id:1,actor_user_id:41,subject_user_id:42,event_type:"connection",details:{}}]});
  const parsed=await parsePortableBackup(valid);
  assert.equal(parsed.backup.connection_audit_log?.length,1);
  const forged=await signedBackup({connection_audit_log:[{id:2,actor_user_id:88,subject_user_id:99,event_type:"connection",details:{}}]});
  await assert.rejects(()=>parsePortableBackup(forged),/unrelated connection audit event/);
});

test("v1.44.0 PostgreSQL acceptance keeps certification lineage and canonical participations",()=>{
  const workflow=read("tests/integration/postgres-full-workflow.test.ts"),instructor=read("tests/integration/postgres-instructor-request.test.ts"),scale=read("tests/integration/postgres-scale-readiness.test.ts"),movement=read("tests/v1353-fcl060-evidence.test.ts");
  const fixtureVersion=workflow.match(/certification_version:(\d+)/)?.[1],hashVersion=workflow.match(/flightCertificationHash\(draft,41,(\d+)\)/)?.[1];
  assert.ok(fixtureVersion,"Current workflow fixture must declare a certification version");
  assert.ok(Number(fixtureVersion)>=7,"Current workflow fixture must not regress to a pre-v7 certification payload");
  assert.equal(hashVersion,fixtureVersion,"Current workflow fixture and certification hash must use the same version");
  assert.match(movement,/flightCertificationPayload\(row,4,4\)/);
  assert.match(workflow,/Modern instructor requests must remain participation-only/);
  assert.doesNotMatch(workflow,/const approvalInsert=sqlBlock/);
  assert.match(instructor,/p\.approval_id/);
  assert.match(scale,/status:null,workflow:null/);
  assert.match(scale,/CREATE TABLE flight_participations/);
  assert.match(scale,/version:"1\.44\.0"/);
});

test("v1.44.0 keeps stabilized regulatory and mobile direction unchanged",()=>{
  const roadmap=read("ROADMAP.md"),gps=read("lib/track-processing.ts"),layout=read("app/(protected)/layout.tsx");
  assert.match(roadmap,/## v1\.44\.0 · Production hardening & cleanup/);
  assert.match(roadmap,/preserve certification payloads\/hashes\/revisions/);
  assert.match(roadmap,/FCL\.050 print layout and global mobile navigation/);
  assert.match(roadmap,/## Current release — v\d+\.\d+\.\d+/);
  assert.match(gps,/takeoffEvidenceIndex/);
  assert.match(layout,/viewportFit:"cover"/);
});
