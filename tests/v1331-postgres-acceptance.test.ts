import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";

const root=path.resolve(import.meta.dirname,".."),read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");

test("v1.33.1 keeps isolated PostgreSQL acceptance tests in CI",()=>{
  const workflow=read(".github/workflows/verify-web.yml"),pkg=JSON.parse(read("package.json")),integration=read("tests/integration/postgres-certification.test.ts");
  assert.match(workflow,/image: postgres:16/);
  assert.match(workflow,/PostgreSQL acceptance tests/);
  assert.match(workflow,/actions\/upload-artifact@v4/);
  assert.equal(typeof pkg.scripts["test:postgres"],"string");
  assert.match(integration,/AC-02/);assert.match(integration,/AC-03 and AC-04/);assert.match(integration,/AC-06/);assert.match(integration,/AC-12/);
});

test("PostgreSQL acceptance harness executes production certification DDL",()=>{
  const integration=read("tests/integration/postgres-certification.test.ts");
  assert.match(integration,/lib\/db-optimization\.ts/);
  assert.match(integration,/productionSqlBlock/);
  assert.match(integration,/CREATE OR REPLACE FUNCTION logbook_protect_locked_flight/);
  assert.match(integration,/CREATE TABLE IF NOT EXISTS flight_verifications/);
});

test("v1.33.1 is an evidence release without changing certification payload version",()=>{
  assert.equal(JSON.parse(read("package.json")).version,"1.33.1");
  const integrity=read("lib/certification-integrity.ts");
  assert.match(integrity,/CURRENT_FLIGHT_CERTIFICATION_VERSION=3/);
});
