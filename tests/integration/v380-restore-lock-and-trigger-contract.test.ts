import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {test} from "node:test";

const source=readFileSync(new URL("../../lib/flight-trash.ts",import.meta.url),"utf8");
const restore=source.slice(source.indexOf("export async function restoreDeletedFlightRecord"));
assert.match(restore,/^export async function restoreDeletedFlightRecord/);
const parsed=restore.match(/const restoreQuery=currencyRestore \? sql`(WITH candidate AS MATERIALIZED[\s\S]*?)`\s*:\s*sql`(WITH candidate AS MATERIALIZED[\s\S]*?)`;\s*const tx=await sql\.transaction\(\[\s*sql`([\s\S]*?)`,\s*restoreQuery\],\{isolationLevel:'ReadCommitted'\}\);const rows=tx\[1\] as Array<\{restored_flight_id:number\|string\}>/);
assert.ok(parsed,"Both restore variants must stay behind one advisory-locked ReadCommitted transaction");
const [,modern,legacy,advisory]=parsed;

test("both restore variants lock the actual deleted_flights row before insertion",()=>{
  for(const sql of [modern,legacy]){
    assert.equal((sql.match(/FOR UPDATE OF deleted_flights/g)||[]).length,1);
    assert.match(sql,/LIMIT 1 FOR UPDATE OF deleted_flights\),restored_flight AS/);
  }
  assert.match(restore,/const restoreQuery=currencyRestore \? sql`/);
});
test("historical all-blank aircraft identity is blocked in each variant and fallback",()=>{
  const guard=/COALESCE\(NULLIF\(TRIM\(flight_data->>'aircraft_make'\)/;
  for(const sql of [modern,legacy]){
    assert.match(sql,guard);
    assert.match(sql,/NULLIF\(TRIM\(COALESCE\(flight_data->>'aircraft_type',''\)\),''\) IS NOT NULL/);
    assert.match(sql,/aircraft a WHERE a\.user_id=deleted_flights\.user_id/);
  }
  const fallback=restore.slice(restore.indexOf("const invalidArchive="));
  assert.match(fallback,guard);
  assert.match(fallback,/aircraft a WHERE a\.user_id=deleted_flights\.user_id/);
});
test("legacy and modern restore keep archived aircraft identity, never enrich from current profile",()=>{
  for(const sql of [modern,legacy]){
    assert.match(sql,/flight_data->>'aircraft_make',flight_data->>'aircraft_model',flight_data->>'aircraft_variant'/);
    assert.doesNotMatch(sql,/COALESCE\(flight_data->>'aircraft_make',''/);
  }
});
test("one advisory lock and selected restore query execute as one atomic transaction",()=>{
  assert.match(restore,/const tx=await sql\.transaction\(\[/);
  assert.match(advisory,/pg_advisory_xact_lock\(hashtextextended\(concat_ws\('\|',/);
  assert.match(restore,/restoreQuery\],\{isolationLevel:'ReadCommitted'\}\);const rows=tx\[1\] as Array/);
  for(const sql of [modern,legacy]) assert.match(sql,/WHERE NOT EXISTS\(SELECT 1 FROM flights f/);
  const pieces=["user_id::text","UPPER(TRIM(COALESCE(flight_data->>'date','')))","UPPER(TRIM(COALESCE(flight_data->>'registration','')))","UPPER(TRIM(COALESCE(flight_data->>'off_block','')))","UPPER(TRIM(COALESCE(flight_data->>'departure','')))","UPPER(TRIM(COALESCE(flight_data->>'arrival','')))"];
  let previous=0;
  for(const piece of pieces){const next=advisory.indexOf(piece,previous);assert.ok(next>previous,"Advisory key missing or out of order: "+piece);previous=next+piece.length}
});
test("cooperating lock is not misrepresented as global Add/Edit or index protection",()=>{
  assert.doesNotMatch(restore,/CREATE UNIQUE INDEX.*flights/i);
});
test("Create and Restore retain identical normalized six-field text fingerprint",()=>{
  const actions=readFileSync(new URL("../../app/(protected)/flights/actions.ts",import.meta.url),"utf8");
  const dedup=readFileSync(new URL("../../lib/flight-dedup.ts",import.meta.url),"utf8");
  assert.match(dedup,/return \[userId,clean\(flight\.date\),clean\(flight\.registration\),clean\(flight\.offBlock\),clean\(flight\.departure\),clean\(flight\.arrival\)\]\.join\("\|"\)/);
  assert.match(actions,/fingerprint=flightFingerprint\(userId,\{date:f\.date,registration:f\.registration,offBlock:f\.offBlock,departure,arrival\}\)/);
  assert.match(actions,/pg_advisory_xact_lock\(hashtextextended\(\$\{fingerprint\},0\)\)/);
  assert.match(advisory,/hashtextextended\(concat_ws\('\|',/);
  assert.doesNotMatch(advisory,/jsonb_build_array/);
});
test("modern restore retains exact currency tuples; legacy refuses accidental currency attribution",()=>{
  assert.match(modern,/price_currency_code,price_currency_minor_units,price_per_hour_decimal/);
  assert.match(modern,/amount_minor,currency,amount_encoding,amount_minor_units,created_at/);
  assert.match(modern,/md5\(flight_data::text \|\| expenses_data::text\)/);
  assert.doesNotMatch(legacy,/INSERT INTO flights\([\s\S]*?price_currency_code/);
  assert.match(legacy,/flight_data->>'price_currency_code' IS NULL/);
});
