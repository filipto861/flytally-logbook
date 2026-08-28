import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root=path.resolve(import.meta.dirname,"..");
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");

test("v1.33.3 adds a PostgreSQL full-workflow acceptance chain",()=>{
  assert.match(JSON.parse(read("package.json")).version,/^1[.]33[.]/);
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

test("v1.33.3 documents evidence scope without changing certification payload version",()=>{
  const docs=read("docs/certification-readiness/FULL_WORKFLOW_EVIDENCE.md");
  const matrix=read("docs/certification-readiness/ACCEPTANCE_MATRIX.md");
  const integrity=read("lib/certification-integrity.ts");
  assert.match(docs,/v1\.33\.3/);
  assert.match(docs,/not a browser\/session end-to-end test/i);
  assert.match(matrix,/AC-26/);
  assert.match(integrity,/if\(version===3\)return/);
  assert.doesNotMatch(integrity,/version===4/);
});
