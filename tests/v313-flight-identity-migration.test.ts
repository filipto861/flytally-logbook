import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const db=fs.readFileSync("lib/db-optimization.ts","utf8");
const plan=fs.readFileSync("lib/migration-plan.ts","utf8");
const sharing=fs.readFileSync("app/(protected)/flights/shared-actions.ts","utf8");
const restore=fs.readFileSync("lib/account-restore-v6.ts","utf8");

test("migration 17 preserves explicit historical aircraft identity as an atomic tuple",()=>{
  assert.match(plan,/version:17,name:"historical flight aircraft identity preservation"/);
  assert.match(db,/17:"historical flight aircraft identity preservation"/);
  assert.match(db,/if\(version===17\)return\[/);
  assert.match(db,/IF TG_OP='INSERT' THEN/);
  assert.match(db,/NULLIF\(TRIM\(COALESCE\(NEW\.aircraft_make,''\)\),''\) IS NULL/);
  assert.match(db,/NULLIF\(TRIM\(COALESCE\(NEW\.aircraft_model,''\)\),''\) IS NULL/);
  assert.match(db,/NULLIF\(TRIM\(COALESCE\(NEW\.aircraft_variant,''\)\),''\) IS NULL/);
  assert.match(db,/ELSIF NEW\.registration IS DISTINCT FROM OLD\.registration THEN/);
  assert.doesNotMatch(db.slice(db.indexOf("if(version===17)return[")),/ELSE\s+IF COALESCE\(TRIM\(NEW\.aircraft_model\)/);
});

test("shared-flight acceptance supplies source snapshot identity that migration 17 must preserve",()=>{
  assert.match(sharing,/INSERT INTO flights\(user_id,date,evidence,registration,aircraft_type,aircraft_class/);
  assert.match(sharing,/aircraft_make,aircraft_model,aircraft_variant/);
  assert.match(sharing,/\$\{text\(row\.aircraft_make\)\},\$\{text\(row\.aircraft_model\)\},\$\{text\(row\.aircraft_variant\)\}/);
});

test("exact restore remains a two-stage explicit identity restore and does not rely on trigger refresh",()=>{
  assert.match(restore,/function stageFlight\(row:BackupRow\):BackupRow\{return\{\.\.\.row,aircraft_make:"",aircraft_model:"",aircraft_variant:""/);
  assert.match(restore,/UPDATE flights f SET aircraft_make=COALESCE\(item->>'aircraft_make',''\),aircraft_model=COALESCE\(item->>'aircraft_model',item->>'aircraft_type',''\),aircraft_variant=COALESCE\(item->>'aircraft_variant',''\)/);
});
