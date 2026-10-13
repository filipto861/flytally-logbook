import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
import path from "node:path";
import test from "node:test";

// Source-backed full-v20 flight column coverage gate, not a substitute for DB/Neon tests.
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const restore=readFileSync(path.join(root,"lib/flight-trash.ts"),"utf8");
const schema=readFileSync(path.join(root,"tooling/bootstrap-browser-smoke-db.mjs"),"utf8");
const baseline=schema.match(/CREATE TABLE flights\(([\s\S]*?)\n\);/);
assert.ok(baseline,"Expected full smoke fixture flights definition");
const columns=baseline[1].split("\n").map(x=>x.trim()).filter(x=>/^[a-z][a-z0-9_]*\s+(?:BIGSERIAL|BIGINT|TEXT|INTEGER|BOOLEAN|NUMERIC|TIMESTAMPTZ|DATE)\b/i.test(x)).map(x=>x.split(/\s+/)[0]);
const insert=restore.match(/restored_flight AS \(INSERT INTO flights\(([^)]+)\) SELECT /);
assert.ok(insert,"Expected canonical restore INSERT declaration");
const selected=insert[1].split(",").map(x=>x.trim());
const excluded: readonly string[]=[
  "id","certified_at","certified_by_user_id","certification_hash",
  "certification_version","record_revision","correction_reason",
  "correction_opened_at","correction_opened_by_user_id",
];
test("complete full-v20 column coverage, explicit exclusions only",()=>{
  assert.equal(columns.length,61,"Canonical flight schema changed: reevaluate restore contract");
  assert.deepEqual(columns.filter(x=>!selected.includes(x)&&!excluded.includes(x)),[]);
  assert.equal(new Set(selected).size,selected.length,"Duplicate destination column");
  assert.deepEqual(selected.filter(x=>!columns.includes(x)),[]);
});
test("historical aircraft identification is read from the archived snapshot",()=>{
  for(const key of ["aircraft_make","aircraft_model","aircraft_variant"]){
    assert.ok(selected.includes(key),key+" not restored");
    assert.ok(restore.includes("flight_data->>'"+key+"'"),key+" not read from archived snapshot");
    assert.ok(!restore.includes("COALESCE(flight_data->>'"+key+"','')"),key+" silently defaulted");
  }
});
test("protection fields remain excluded from direct historic recertification",()=>{
  for(const key of excluded)assert.ok(!selected.includes(key),"Potential protected history replay: "+key);
  assert.match(restore,/locked_at,locked_by_user_id/);
  assert.match(restore,/NULL,NULL,COALESCE\(flight_data->>'operation_type'/);
});

test("future v21 monetary snapshots cannot silently enter the legacy v20 writer",()=>{
  assert.match(restore,/NOT \(flight_data \?\| ARRAY\['price_currency_code','price_currency_minor_units','price_per_hour_decimal'\]\)/);
  assert.match(restore,/e\.value \?\| ARRAY\['amount_encoding','amount_minor_units'\]/);
  assert.match(restore,/needsNewRestore=await sql/);
  assert.match(restore,/requires the newer monetary restore process/);
});
test("legacy expense records cannot be silently omitted or assigned a guessed currency",()=>{
  assert.ok(!restore.includes("UPPER(COALESCE(e->>'currency','CZK'))"));
  assert.ok(!restore.includes("WHERE COALESCE(NULLIF(e->>'amount_minor','')::bigint,0)>0"));
  assert.match(restore,/COALESCE\(e\.value->>'currency',''\) !~ '\^\[A-Z\]\{3\}\$'/);
  assert.match(restore,/Archived flight data needs review before it can be restored/);
});
test("restore refuses mismatched owner/protected source snapshots and child parents",()=>{
  assert.match(restore,/flight_data->>'id'=original_flight_id::text/);
  assert.match(restore,/flight_data->>'user_id'=user_id::text/);
  assert.match(restore,/flight_certified_revisions r/);
  assert.match(restore,/t\.value->>'flight_id' IS DISTINCT FROM original_flight_id::text/);
  assert.match(restore,/e\.value->>'flight_id' IS DISTINCT FROM original_flight_id::text/);
});

test("track and expense restore no longer invent absent archival metadata",()=>{
  const forbidden=[
    "restored-track","COALESCE(s.track->>'coordinates_json','[]')",
    "COALESCE(s.track->>'overview_coordinates_json','[]')",
    "COALESCE(e->>'category','OTHER')",
    "COALESCE(e->>'label','')",
    "COALESCE(NULLIF(e->>'created_at','')::timestamptz,NOW())",
  ];
  for(const value of forbidden)assert.ok(!restore.includes(value),"Unexpected legacy default: "+value);
  assert.ok(restore.includes("(e->>'amount_minor')::bigint,e->>'currency'"));
  assert.ok(restore.includes("(s.track->>'point_count')::int"));
});
