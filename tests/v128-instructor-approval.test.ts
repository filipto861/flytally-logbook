import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";

const root=path.resolve(import.meta.dirname,"..");
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");

test("v1.28 binds instructor approval to one protected flight revision",()=>{
  const migration=read("lib/db-optimization.ts"),actions=read("app/(protected)/flights/instructor-actions.ts");
  assert.match(migration,/CREATE TABLE IF NOT EXISTS instructor_flight_approvals/);
  assert.match(migration,/UNIQUE\(flight_id,record_revision\)/);
  assert.match(actions,/f\.certification_hash=a\.flight_hash/);
  assert.match(actions,/COALESCE\(f\.record_revision,1\)=a\.record_revision/);
});

test("only an accepted connected instructor can receive and decide a request",()=>{
  const actions=read("app/(protected)/flights/instructor-actions.ts");
  assert.match(actions,/c\.status='accepted'/);
  assert.match(actions,/a\.instructor_user_id=\$\{userId\}/);
  assert.match(actions,/UPPER\(COALESCE\(f\.role,''\)\) IN \('DUAL','SPIC','PICUS'\)/);
  assert.match(actions,/a\.status='pending'/);
});

test("approval stays contextual instead of adding another menu",()=>{
  const detail=read("app/(protected)/flights/[id]/page.tsx"),connections=read("app/(protected)/connections/page.tsx"),sidebar=read("components/sidebar.tsx");
  assert.match(detail,/Request approval/);
  assert.match(connections,/FLIGHTS TO REVIEW/);
  assert.match(connections,/Review flight/);
  assert.doesNotMatch(sidebar,/\/approvals/);
});

test("navigation uses one consistent SVG icon set",()=>{
  const icons=read("components/nav-icon.tsx"),sidebar=read("components/sidebar.tsx");
  assert.match(icons,/strokeWidth="1\.8"/);
  assert.match(sidebar,/NavIcon name=/);
  assert.doesNotMatch(sidebar,/icon:"[⌂✈↳＋◎◇⚙▤◆]"/);
});

test("approved instructor is printed in remarks",()=>{
  const print=read("app/(protected)/print/page.tsx"),readonly=read("components/readonly-logbook-entry.tsx");
  assert.match(print,/FI APPROVED:/);
  assert.match(readonly,/FI APPROVED:/);
});
