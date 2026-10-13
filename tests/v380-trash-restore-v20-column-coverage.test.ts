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
const excluded=[
  "id","certified_at","certified_by_user_id","certification_hash",
  "certification_version","record_revision","correction_reason",
  "correction_opened_at","correction_opened_by_user_id",
] as const;
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
