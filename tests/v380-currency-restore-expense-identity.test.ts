import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";

const source=readFileSync(new URL("../lib/account-restore-v6.ts",import.meta.url),"utf8");

test("exact account restore compares original integer expense text and the storage tuple",()=>{
  assert.match(source,/const expenseKey=\(row:BackupRow\)=>JSON\.stringify\(\[text\(row\.flight_id\),upper\(row\.category\),upper\(row\.label\),text\(row\.amount_minor\),upper\(row\.currency\),text\(row\.amount_encoding\),text\(row\.amount_minor_units\)\]\)/);
  assert.doesNotMatch(source,/Number\(row\.amount_minor\|\|0\)/);
});
test("existing expense SELECT supports pre-v21 schemas while preserving metadata if present",()=>{
  assert.match(source,/to_jsonb\(e\)->>'amount_encoding' amount_encoding/);
  assert.match(source,/to_jsonb\(e\)->>'amount_minor_units' amount_minor_units/);
  assert.match(source,/\["flight_expenses",backup\.flight_expenses\?\?\[\],expenses,expenseKey/);
});
test("v13 exact restore still uses native typed rows and refuses implicit amount scale conversion",()=>{
  assert.match(source,/json_populate_record\(NULL::flight_expenses,item\)/);
  assert.doesNotMatch(source,/UPPER\(COALESCE\(.*currency.*'CZK'/);
});
