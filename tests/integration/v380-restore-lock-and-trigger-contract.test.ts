import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {test} from "node:test";

const source=readFileSync(new URL("../../lib/flight-trash.ts",import.meta.url),"utf8");

test("restore locks the actual deleted_flights row in the candidate CTE",()=>{
  assert.equal((source.match(/FOR UPDATE OF deleted_flights/g)||[]).length,1);
  assert.match(source,/LIMIT 1 FOR UPDATE OF deleted_flights\),restored_flight AS/);
});

test("historical all-blank aircraft identity is blocked when insertion trigger would enrich it",()=>{
  assert.equal((source.match(/COALESCE\(NULLIF\(TRIM\(flight_data->>'aircraft_make'\)/g)||[]).length,2);
  assert.match(source,/NULLIF\(TRIM\(COALESCE\(flight_data->>'aircraft_type',''\)\),' '\) IS NOT NULL|NULLIF\(TRIM\(COALESCE\(flight_data->>'aircraft_type',''\)\),''\) IS NOT NULL/);
  assert.match(source,/aircraft a WHERE a\.user_id=deleted_flights\.user_id/);
});

test("restore does not replace archived values with current aircraft identity",()=>{
  assert.match(source,/flight_data->>'aircraft_make',flight_data->>'aircraft_model',flight_data->>'aircraft_variant'/);
  assert.doesNotMatch(source,/COALESCE\(flight_data->>'aircraft_make',''/);
});


test("same archived identity lock and actual restore run as one two-statement transaction",()=>{
  assert.match(source,/const tx=await sql\.transaction\(\[/);
  assert.match(source,/pg_advisory_xact_lock\(hashtextextended\(jsonb_build_array\(/);
  assert.match(source,/sql\x60WITH candidate AS MATERIALIZED/);
  assert.match(source,/\x60\]\);const rows=tx\[1\] as Array/);
  const restore=source.slice(source.indexOf("export async function restoreDeletedFlightRecord"));
  const lock=restore.slice(restore.indexOf("pg_advisory_xact_lock"),restore.indexOf("sql\x60WITH candidate AS MATERIALIZED"));
  for(const key of ["user_id","flight_data->>'date'","flight_data->>'registration'","flight_data->>'off_block'","flight_data->>'departure'","flight_data->>'arrival'"]){
    assert.ok(lock.includes(key),"Lock key omits natural identity component: "+key);
  }
});
test("cooperating lock is not misrepresented as global Add/Edit or index protection",()=>{
  assert.doesNotMatch(source,/CREATE UNIQUE INDEX.*flights/i);
  assert.match(source,/WHERE NOT EXISTS\(SELECT 1 FROM flights f/);
});
