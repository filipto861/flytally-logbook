import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const db=fs.readFileSync("lib/db-optimization.ts","utf8");

test("primary database runner implements migration 14",()=>{
  assert.match(db,/14:"user-owned structured flight expenses"/);
  assert.match(db,/if\(version===14\)return\[/);
  assert.match(db,/CREATE TABLE IF NOT EXISTS flight_expenses/);
  assert.match(db,/FOREIGN KEY\(flight_id,user_id\) REFERENCES flights\(id,user_id\) ON DELETE CASCADE/);
  assert.match(db,/ALTER TABLE deleted_flights ADD COLUMN IF NOT EXISTS expenses_data/);
});
