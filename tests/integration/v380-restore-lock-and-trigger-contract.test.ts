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
