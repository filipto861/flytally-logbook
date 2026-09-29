import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root=path.resolve(import.meta.dirname,"..");
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");

test("SP5 correction supersedes only pending current-revision invitations and preserves the connected-PIC link",()=>{
  const certification=read("app/(protected)/flights/certification-actions.ts");
  const start=certification.indexOf("export async function startCertifiedCorrection");
  assert.ok(start>=0);
  const correction=certification.slice(start);
  assert.match(correction,/UPDATE flight_participations SET status='superseded',superseded_at=NOW\(\),responded_at=NOW\(\),decision_note='Source flight opened for correction\.'/);
  assert.match(correction,/source_flight_id=\$\{flightId\} AND source_user_id=\$\{userId\} AND source_revision=\$\{Number\(current\.record_revision\)\|\|1\} AND status='pending'/);
  assert.doesNotMatch(correction,/participant_role='PIC'/);
  assert.doesNotMatch(correction,/DELETE FROM flight_connected_crew/);
  assert.doesNotMatch(correction,/UPDATE flight_connected_crew/);
});

test("SP5 correction leaves already materialized accepted recipient records independent",()=>{
  const certification=read("app/(protected)/flights/certification-actions.ts");
  const start=certification.indexOf("export async function startCertifiedCorrection");
  const correction=certification.slice(start);
  assert.match(correction,/status='pending'/);
  assert.doesNotMatch(correction,/status IN \('pending','accepted'\)/);
  assert.doesNotMatch(correction,/participant_flight_id/);
});

test("SP5 cancellation and decline are owner or recipient scoped and only mutate pending requests",()=>{
  const actions=read("app/(protected)/flights/shared-actions.ts");
  const cancelStart=actions.indexOf("export async function cancelSafetyInvitation");
  const declineStart=actions.indexOf("export async function declineSharedFlight");
  const signStart=actions.indexOf("async function signInstructorParticipation",declineStart);
  assert.ok(cancelStart>=0&&declineStart>cancelStart&&signStart>declineStart);
  const cancel=actions.slice(cancelStart,declineStart);
  const decline=actions.slice(declineStart,signStart);
  assert.match(cancel,/source_flight_id=\$\{sourceFlightId\} AND source_user_id=\$\{userId\} AND status='pending'/);
  assert.match(cancel,/status='cancelled'/);
  assert.match(decline,/participant_user_id=\$\{userId\} AND status='pending'/);
  assert.match(decline,/status='declined'/);
});

test("SP5 dedicated PIC reinvite reopens declined or cancelled requests but never rewrites accepted materialization",()=>{
  const actions=read("app/(protected)/flights/shared-actions.ts");
  const start=actions.indexOf("async function insertPicParticipation");
  const end=actions.indexOf("export async function inviteSafetyPilot",start);
  assert.ok(start>=0&&end>start);
  const invite=actions.slice(start,end);
  assert.match(invite,/flight_participations\.status IN \('pending','declined','cancelled'\)/);
  assert.doesNotMatch(invite,/flight_participations\.status IN \('pending','accepted'/);
  assert.doesNotMatch(invite,/participant_flight_id=/);
  assert.match(invite,/WHEN flight_participations\.participant_role='PIC' THEN flight_participations\.pic_commander_basis/);
});

test("SP5 PIC collaboration does not change the certification payload version",()=>{
  const certification=read("app/(protected)/flights/certification-actions.ts");
  assert.match(certification,/flightCertificationHash\(\{\.\.\.row,certification_version:8\},userId,8\)/);
  assert.match(certification,/certification_version=8/);
});
