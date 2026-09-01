import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const db=fs.readFileSync("lib/db-optimization.ts","utf8");
const pkg=JSON.parse(fs.readFileSync("package.json","utf8"));
const lock=JSON.parse(fs.readFileSync("package-lock.json","utf8"));

test("v1.59.1 package metadata is synchronized",()=>{
  assert.equal(pkg.version,"1.59.1");
  assert.equal(lock.version,pkg.version);
  assert.equal(lock.packages[""].version,pkg.version);
});

test("primary database runner implements migration 14",()=>{
  assert.match(db,/14:"user-owned structured flight expenses"/);
  assert.match(db,/if\(version===14\)return\[/);
  assert.match(db,/CREATE TABLE IF NOT EXISTS flight_expenses/);
  assert.match(db,/FOREIGN KEY\(flight_id,user_id\) REFERENCES flights\(id,user_id\) ON DELETE CASCADE/);
  assert.match(db,/ALTER TABLE deleted_flights ADD COLUMN IF NOT EXISTS expenses_data/);
});
