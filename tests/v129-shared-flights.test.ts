import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";

const root=path.resolve(import.meta.dirname,"..");
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");

test("v1.29 stores one participant entry per protected source revision and role",()=>{
  const migration=read("lib/db-optimization.ts"),plan=read("lib/migration-plan.ts");
  assert.match(plan,/DATABASE_SCHEMA_VERSION=12/);
  assert.match(migration,/CREATE TABLE IF NOT EXISTS flight_participations/);
  assert.match(migration,/UNIQUE\(source_flight_id,source_revision,participant_role\)/);
  assert.match(migration,/UNIQUE\(participant_flight_id\)/);
});

test("Safety Pilot invitations require a certified PIC flight and an accepted connection",()=>{
  const actions=read("app/(protected)/flights/shared-actions.ts");
  assert.match(actions,/UPPER\(TRIM\(COALESCE\(f\.role,''\)\)\)='PIC'/);
  assert.match(actions,/f\.certified_at IS NOT NULL/);
  assert.match(actions,/c\.status='accepted'/);
  assert.match(actions,/\$\{participantId\},'SAFETY PILOT'/);
});

test("participant acceptance rechecks the exact certification fingerprint",()=>{
  const actions=read("app/(protected)/flights/shared-actions.ts");
  assert.match(actions,/sf\.certification_hash=\$\{text\(row\.source_hash\)\}/);
  assert.match(actions,/COALESCE\(sf\.record_revision,1\)=\$\{Number\(row\.source_revision\)\}/);
  assert.match(actions,/pg_advisory_xact_lock/);
});

test("shared entries copy the certified flight facts into a separate draft",()=>{
  const actions=read("app/(protected)/flights/shared-actions.ts");
  assert.match(actions,/participant_flight_id=chosen\.id/);
  assert.match(actions,/Number\(row\.starts\)/);
  assert.match(actions,/row\.price_per_hour===null/);
  assert.match(actions,/text\(row\.billing_basis\)/);
  assert.match(actions,/INSERT INTO flight_tracks/);
  assert.match(actions,/source_track\.coordinates_json/);
  assert.match(actions,/INSERT INTO aircraft/);
  assert.match(actions,/ON CONFLICT\(user_id,registration\) DO NOTHING/);
  assert.doesNotMatch(actions,/\$\{text\(row\.note\)\}/);
});

test("instructor and Safety Pilot use the same one-click Connections workflow",()=>{
  const connections=read("app/(protected)/connections/page.tsx"),instructor=read("app/(protected)/connections/flight/[id]/page.tsx"),shared=read("app/(protected)/connections/shared/[id]/page.tsx"),sidebar=read("components/sidebar.tsx");
  assert.match(connections,/Shared flights/);
  assert.match(instructor,/Add to my logbook/);
  assert.match(shared,/Add to my logbook/);
  assert.doesNotMatch(sidebar,/shared|participation|approval/i);
});
