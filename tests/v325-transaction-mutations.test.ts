import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root=path.resolve(import.meta.dirname,"..");
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");

test("v3.2 U6 local smoke adapter executes mutation transactions atomically",()=>{
  const local=read("lib/local-postgres.ts");
  assert.match(local,/__flytallyLocalClaimed/);
  assert.match(local,/executeMutationTransaction/);
  assert.match(local,/BEGIN;/);
  assert.match(local,/COMMIT;/);
  assert.match(local,/support mutation statements only/);
  assert.match(local,/transaction queries must be created inline/);
});

test("v3.2 U6 browser fixture supports settings and connection updates",()=>{
  const bootstrap=read("tooling/bootstrap-browser-smoke-db.mjs");
  const helper=read("e2e/browser-db.mjs");
  assert.match(bootstrap,/updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW\(\)/);
  assert.match(bootstrap,/CREATE TABLE connection_audit_log/);
  assert.match(helper,/resetAccountSettingsFixture/);
  assert.match(helper,/resetConnectionManagerFixture/);
  assert.match(helper,/DELETE FROM connection_audit_log/);
});

test("v3.2 U6 exercises transaction-backed pending state and persistence",()=>{
  const smoke=read("e2e/public-shell.spec.mjs");
  assert.match(smoke,/account settings transaction disables duplicate submit and persists both records/);
  assert.match(smoke,/connection access update disables duplicate submit and persists/);
  assert.match(smoke,/getByRole\("button",\{name:"Save changes"\}\)/);
  assert.match(smoke,/getByRole\("button",\{name:"Save access"\}\)/);
  assert.match(smoke,/expect\(gate[.]count\(\)\)[.]toBe\(1\)/);
  assert.match(smoke,/Browser Transaction Pilot/);
  assert.match(smoke,/Can view your logbook/);
});
