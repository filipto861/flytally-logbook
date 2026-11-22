import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root=path.resolve(import.meta.dirname,"..");
const read=(relative:string)=>fs.readFileSync(path.join(root,relative),"utf8");
const fields=["operator_name","flight_number","operation_context"] as const;

test("v1.66 shared flights copy professional context without inference",()=>{
  const shared=read("app/(protected)/flights/shared-actions.ts");
  for(const field of fields)assert.match(shared,new RegExp(`f[.]${field}`));
  assert.match(shared,/operation_type,engine_type,operator_name,flight_number,operation_context/);
  assert.match(shared,/text\(row[.]operator_name\)/);
  assert.match(shared,/text\(row[.]flight_number\)/);
  assert.match(shared,/text\(row[.]operation_context\)/);
});

test("v1.66 portable backup exports additive flight columns and restore keeps them generically",()=>{
  const restore=read("lib/account-restore-v6.ts"),layout=read("app/(protected)/layout.tsx"),runtime=read("lib/runtime-schema.ts");
  assert.match(restore,/json_populate_record\(NULL::flights,item\)/);
  assert.match(layout,/await ensureRuntimeSchema\(\)/);
  assert.match(runtime,/ensureV166Schema/);
});

test("v1.66 GPS import does not invent professional operation metadata",()=>{
  const actions=read("app/(protected)/flights/actions.ts");
  const gpsSection=actions.slice(actions.indexOf("export async function importKmlFlights"));
  assert.ok(gpsSection.length>0);
  assert.doesNotMatch(gpsSection,/operation_context\s*=\s*'CAT'/i);
  assert.doesNotMatch(gpsSection,/operator_name\s*=\s*[^'\s]/i);
});
