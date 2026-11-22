import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const actions=fs.readFileSync("app/(protected)/flights/actions.ts","utf8"),schema=fs.readFileSync("lib/v159-schema.ts","utf8"),backup=fs.readFileSync("lib/account-backup.ts","utf8"),trash=fs.readFileSync("lib/flight-trash.ts","utf8");
test("expenses are user-owned financial metadata outside flight certification fields",()=>{assert.match(schema,/FOREIGN KEY\(flight_id,user_id\) REFERENCES flights\(id,user_id\) ON DELETE CASCADE/);assert.match(actions,/flight_expenses/);assert.doesNotMatch(fs.readFileSync("lib/flight-input.ts","utf8"),/expenseCategory|flight_expenses/);assert.doesNotMatch(fs.readFileSync("lib/certification-integrity.ts","utf8"),/flight_expenses|expenseCategory/)});
test("backup and trash preserve structured expense rows regardless of later portable-backup format additions",()=>{assert.match(backup,/flight_expenses/);assert.match(trash,/expenses_data/);assert.match(trash,/restored_expenses/)});
