import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { releaseAtLeast } from "./release-version.ts";

const root=path.resolve(import.meta.dirname,"..");
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");

test("v1.33.3 adds a PostgreSQL full-workflow acceptance chain",()=>{
  assert.ok(releaseAtLeast(JSON.parse(read("package.json")).version,1,33,3));
  const integration=read("tests/integration/postgres-full-workflow.test.ts");
  assert.match(integration,/AC-01\/03\/04\/05\/06\/26/);
  assert.match(integration,/certification-actions[.]ts/);
  assert.match(integration,/training-verification[.]ts/);
  assert.match(integration,/shared-actions[.]ts/);
  assert.match(integration,/flightCertificationHash/);
  assert.match(integration,/verificationCryptographicStatus/);
});

test("v1.33.3 compares the server-authoritative state used by all four pilot views",()=>{
  const integration=read("tests/integration/postgres-full-workflow.test.ts");
  assert.match(integration,/flights\/\[id\]\/page[.]tsx/);
  assert.match(integration,/flights\/\[id\]\/audit\/page[.]tsx/);
  assert.match(integration,/flights\/\[id\]\/verification-report\/page[.]tsx/);
  assert.match(integration,/print\/page[.]tsx/);
  assert.match(integration,/Historical R1 signature must not leak into current R2 print projection/);
  assert.match(integration,/Flight detail must select the exact current R2 signature/);
});
