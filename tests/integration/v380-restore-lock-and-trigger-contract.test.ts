import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {test} from "node:test";

const source=readFileSync(new URL("../../lib/flight-trash.ts",import.meta.url),"utf8");
const restore=source.slice(source.indexOf("export async function restoreDeletedFlightRecord"));
assert.match(restore,/^export async function restoreDeletedFlightRecord/);
// Source-backed extraction of both exact V21 SQL variants, without
// depending on the old fixed-size transaction array. V22 OFF keeps the
// advisory + restore pair; candidate V22 adds an owner gate and finalizer.
const parsed=restore.match(/const restoreQuery=currencyRestore \? sql`(WITH candidate AS MATERIALIZED[\s\S]*?)`\s*:\s*sql`(WITH candidate AS MATERIALIZED[\s\S]*?)`;/);
assert.ok(parsed,"Both production V21 restore SQL variants must be present");
const [,modern,legacy]=parsed;
const txStart=restore.indexOf("const tx=await sql.transaction([",parsed.index);
assert.ok(txStart>0,"One ordered restore transaction not found");
const txEndNeedle="],{isolationLevel:'ReadCommitted'});const rows=tx[v22RestorationActive ? 3 : 1] as Array<{restored_flight_id:number|string}>";
const txEnd=restore.indexOf(txEndNeedle,txStart);
assert.ok(txEnd>txStart,"ReadCommitted transaction and V22-dependent result index missing");
const transaction=restore.slice(txStart,txEnd+txEndNeedle.length);
const advisoryStart=transaction.indexOf("sql`SELECT pg_advisory_xact_lock(");
assert.ok(advisoryStart>=0,"Production restore advisory lock missing");
const locateRestoreAfterAdvisory=(value:string,offset:number)=>{
  const match=value.slice(offset).search(/`,\r?\n  restoreQuery,/);
  return match<0 ? -1 : offset+match;
};
const advisoryEnd=locateRestoreAfterAdvisory(transaction,advisoryStart);
assert.ok(advisoryEnd>advisoryStart,"Restore SQL not immediately following advisory lock");
const advisory=transaction.slice(advisoryStart+4,advisoryEnd);
assert.equal((transaction.match(/pg_advisory_xact_lock\(/g)||[]).length,1);
assert.match(restore,/const v22RestoreMode:string=V22_OWNER_TRASH_RETENTION_MODE/);
assert.match(restore,/const v22RestorationActive=v22RestoreMode!=="off"/);
assert.match(restore,/if\(v22RestorationActive\)\{\s*const session=await requireUser\(\);\s*if\(session.userId!==userId\)throw new Error/);
assert.match(transaction,/\.\.\.\(v22RestorationActive \? \[sql`SELECT id FROM users WHERE id=\$\{userId\} FOR UPDATE`\] : \[\]\)/);
assert.match(transaction,/restoreQuery,\s*\.\.\.\(v22RestorationActive\s*\?\s*\[sql`SELECT public\.logbook_v22_finalize_restored_source_candidate\(\$\{userId\},\$\{trashId\}\) AS restored_flight_id`\]\s*:\s*\[\]\)/);

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
  const windowsTx=transaction.replace(/\r?\n/g,"\r\n");
  const windowsAdvisoryStart=windowsTx.indexOf("sql`SELECT pg_advisory_xact_lock(");
  assert.ok(locateRestoreAfterAdvisory(windowsTx,windowsAdvisoryStart)>windowsAdvisoryStart,
    "Restore adjacency must also hold with Windows CRLF checkout");
  assert.match(restore,/const tx=await sql\.transaction\(\[/);
  assert.match(advisory,/pg_advisory_xact_lock\(hashtextextended\(concat_ws\('\|',/);
  assert.match(transaction,/restoreQuery,\s*\.\.\.\(v22RestorationActive/);
  assert.match(transaction,/\],\{isolationLevel:'ReadCommitted'\}\);const rows=tx\[v22RestorationActive \? 3 : 1\] as Array/);
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
