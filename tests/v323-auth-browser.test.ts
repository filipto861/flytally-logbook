import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root=path.resolve(import.meta.dirname,"..");
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");

test("v3.2 U4 local Postgres adapter is explicit and localhost-only",()=>{
  const db=read("lib/db.ts");
  const local=read("lib/local-postgres.ts");
  assert.match(db,/FLYTALLY_LOCAL_POSTGRES === "1"/);
  assert.match(db,/createLocalPostgresQuery/);
  assert.match(local,/LOCAL_HOSTS/);
  assert.match(local,/may only target localhost/);
  assert.match(local,/PGCONNECT_TIMEOUT:"5"/);
  assert.match(local,/support mutation statements only/);\n  assert.match(local,/BEGIN;\\n/);\n  assert.match(local,/COMMIT;/);
});

test("v3.2 U4 browser database is isolated and uses production password format",()=>{
  const bootstrap=read("tooling/bootstrap-browser-smoke-db.mjs");
  assert.match(bootstrap,/DROP SCHEMA public CASCADE/);
  assert.match(bootstrap,/generate_series\(1,14\)/);
  assert.match(bootstrap,/scrypt\$n=131072,r=8,p=1/);
  assert.match(bootstrap,/browser-auth@example[.]test/);
  assert.match(bootstrap,/OK-E2E/);
  assert.match(bootstrap,/CREATE TABLE push_preferences/);
  assert.match(bootstrap,/CREATE TABLE push_subscriptions/);
});

test("v3.2 U4 browser workflow provisions ephemeral PostgreSQL without external secrets",()=>{
  const workflow=read(".github/workflows/browser-smoke.yml");
  assert.match(workflow,/image: postgres:16/);
  assert.match(workflow,/postgresql:\/\/flytally:flytally@127[.]0[.]0[.]1:5432\/flytally_browser/);
  assert.match(workflow,/FLYTALLY_LOCAL_POSTGRES: "1"/);
  assert.match(workflow,/Bootstrap isolated browser database/);
  assert.doesNotMatch(workflow,/secrets[.]/);
});

test("v3.2 U4 exercises real authenticated navigation on desktop and mobile",()=>{
  const smoke=read("e2e/public-shell.spec.mjs");
  assert.match(smoke,/browser-auth@example[.]test/);
  assert.match(smoke,/logbook_session/);
  assert.match(smoke,/navigateMain\(page,"Flights"\)/);
  assert.match(smoke,/navigateMain\(page,"Settings"\)/);
  assert.match(smoke,/navigateMain\(page,"Connections"\)/);
  assert.match(smoke,/getByRole\("row",\{name:\/OK-E2E\/}\)/);
  const ui=read("app/ui-system.css");
  assert.match(ui,/[.]ui-page-stack\{[^}]*grid-template-columns:minmax\(0,1fr\);[^}]*min-width:0;/s);
  assert.match(ui,/[.]ui-page-stack > [*][^{]*\{[^}]*min-width:0;[^}]*max-width:100%;/s);
});
