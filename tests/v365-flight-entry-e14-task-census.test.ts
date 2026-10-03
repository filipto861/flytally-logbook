import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const actions=fs.readFileSync("app/(protected)/flights/actions.ts","utf8");
const census=fs.readFileSync("tooling/e14-gps-task-census.sql","utf8");

test("E1.4 closes the residual server producer for synthetic GPS import Task",()=>{
  assert.match(actions,/const task=String\(form\.get\("task"\)\?\?""\)/);
  assert.doesNotMatch(actions,/form\.get\("task"\)\?\?"GPS import"/);
});

test("E1.4 census is transactionally read-only and contains no cleanup mutation",()=>{
  assert.match(census,/BEGIN TRANSACTION READ ONLY;/);
  assert.match(census,/ROLLBACK;/);
  const executable=census.replace(/^\s*--.*$/gm,"");
  assert.doesNotMatch(executable,/\b(?:UPDATE|DELETE|INSERT|ALTER|DROP|TRUNCATE|CREATE)\b/i);
});

test("E1.4 census distinguishes ordinary drafts from certified correction history",()=>{
  assert.match(census,/CERTIFIED_CURRENT/);
  assert.match(census,/CORRECTION_OR_CERTIFIED_HISTORY/);
  assert.match(census,/LOCKED_DRAFT/);
  assert.match(census,/INCONSISTENT_UNCERTIFIED_HASH/);
  assert.match(census,/ORDINARY_EDITABLE_DRAFT/);
  assert.match(census,/COALESCE\(record_revision,1\)>1/);
  assert.match(census,/correction_opened_at IS NOT NULL/);
  assert.match(census,/flight_certified_revisions/);
});

test("E1.4 census preserves historical evidence surfaces as census-only",()=>{
  assert.match(census,/snapshot_data->>'task'/);
  assert.match(census,/flight_data->>'task'/);
  assert.match(census,/flight_audit_log/);
  assert.match(census,/has_participation_history/);
  assert.match(census,/has_instructor_approval_history/);
  assert.match(census,/has_verification_history/);
});
