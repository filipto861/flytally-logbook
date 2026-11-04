import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";

const source=readFileSync(new URL("../lib/flight-trash.ts",import.meta.url),"utf8");
const start=source.indexOf("export async function restoreDeletedFlightRecord");
const restore=source.slice(start);
const branches=restore.match(/const restoreQuery=currencyRestore \? sql`([\s\S]*?)` : sql`([\s\S]*?)`;/);
assert.ok(branches,"Both explicit v21 and canonical legacy SQL variants must exist");
const newer=branches[1],legacy=branches[2];

test("currency-bearing Trash restore keeps parent, tracks, expenses and mark atomic",()=>{
  assert.match(restore,/const tx=await sql\.transaction\(\[/);
  // OFF leaves the original advisory-lock + restoreQuery pair intact;
  // the staged V22 branch adds account gate and source finalizer to that
  // same ordered sql.transaction, never a detached later HTTP request.
  assert.match(readFileSync(new URL("../lib/v22-trash-retention-mode.ts",import.meta.url),"utf8"),
    /V22_OWNER_TRASH_RETENTION_MODE = "off" as const/);
  assert.match(restore,/v22RestorationActive=v22RestoreMode!=="off"/);
  assert.match(restore,/SELECT id FROM users WHERE id=\$\{userId\} FOR UPDATE/);
  assert.match(restore,/pg_advisory_xact_lock/);
  assert.match(restore,/restoreQuery,\s*\.\.\.\(v22RestorationActive/);
  assert.match(restore,/public\.logbook_v22_finalize_restored_source_candidate/);
  assert.match(restore,/\],\{isolationLevel:'ReadCommitted'\}\)/);
  assert.match(restore,/tx\[v22RestorationActive \? 3 : 1\]/);
  for(const body of [newer,legacy]){
    assert.match(body,/restored_flight AS \(INSERT INTO flights\(/);
    assert.match(body,/restored_tracks AS \(INSERT INTO flight_tracks\(/);
    assert.match(body,/restored_expenses AS \(INSERT INTO flight_expenses\(/);
    assert.match(body,/marked AS \(UPDATE deleted_flights SET restored_at=NOW\(\)/);
  }
});

test("v21 variant restores exact rate and individual expense scale instead of guessing",()=>{
  assert.match(newer,/price_per_hour,price_currency_code,price_currency_minor_units,price_per_hour_decimal,billing_basis/);
  assert.match(newer,/flight_data->>'price_currency_code',NULLIF\(flight_data->>'price_currency_minor_units',''\)::smallint,NULLIF\(flight_data->>'price_per_hour_decimal',''\)::numeric/);
  assert.match(newer,/amount_minor,currency,amount_encoding,amount_minor_units,created_at/);
  assert.match(newer,/e->>'amount_encoding',NULLIF\(e->>'amount_minor_units',''\)::smallint/);
  assert.match(restore,/supportedIsoCurrency/);
  assert.match(restore,/columns\.length!==5/);
  assert.match(restore,/archiveDigest/);
  assert.match(newer,/md5\(flight_data::text \|\| expenses_data::text\)=\$\{archiveDigest\}/);
});

test("legacy Trash writer remains v20-compatible and rejects any nonnull v21 values",()=>{
  assert.doesNotMatch(legacy,/INSERT INTO flight_expenses\([^)]*amount_encoding/);
  assert.doesNotMatch(legacy,/INSERT INTO flights\([^)]*price_currency_code/);
  for(const key of ["price_currency_code","price_currency_minor_units","price_per_hour_decimal"])
    assert.match(legacy,new RegExp("flight_data->>'"+key+"' IS NULL"));
  for(const key of ["amount_encoding","amount_minor_units"])
    assert.match(legacy,new RegExp("e\\.value->>'"+key+"' IS NOT NULL"));
});
