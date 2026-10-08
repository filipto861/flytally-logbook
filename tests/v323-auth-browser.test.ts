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
  assert.match(local,/TRANSACTION_RESULT_PREFIX/);
  assert.match(local,/executeLocalTransaction/);
  assert.match(local,/BEGIN;\\n/);
  assert.match(local,/COMMIT;/);
});

test("v3.2 U4 browser database is isolated and uses production password format",()=>{
  const bootstrap=read("tooling/bootstrap-browser-smoke-db.mjs");
  assert.match(bootstrap,/DROP SCHEMA public CASCADE/);
  assert.match(bootstrap,/generate_series\(1,19\)/);
  assert.match(bootstrap,/pic_commander_basis TEXT CHECK/);
  assert.match(bootstrap,/scrypt\$n=131072,r=8,p=1/);
  assert.match(bootstrap,/browser-auth@example[.]test/);
  assert.match(bootstrap,/OK-E2E/);
  assert.match(bootstrap,/CREATE TABLE push_preferences/);
  assert.match(bootstrap,/CREATE TABLE push_subscriptions/);
  assert.match(bootstrap,/PGCONNECT_TIMEOUT:"5"/);
});

test("authenticated browser fixture cleanup is localhost-only and scopes certified trigger bypass to one transaction",()=>{
  const db=read("e2e/browser-db.mjs");
  assert.match(db,/Authenticated mutation smoke may only reset a localhost database/);
  assert.match(db,/runBrowserFlightFixtureCleanup/);
  assert.match(db,/BEGIN;/);
  assert.match(db,/ALTER TABLE flights DISABLE TRIGGER USER/);
  assert.match(db,/ALTER TABLE flights ENABLE TRIGGER USER/);
  assert.match(db,/COMMIT;/);
  assert.match(db,/PGCONNECT_TIMEOUT:"5"/);
  assert.doesNotMatch(db,/PGCONNECTTIMEOUT/);
});

test("v3.2 U4 browser workflow provisions ephemeral PostgreSQL without external secrets",()=>{
  const workflow=read(".github/workflows/browser-smoke.yml");
  assert.match(workflow,/image: postgres:16/);
  assert.match(workflow,/postgresql:\/\/flytally:flytally@127[.]0[.]0[.]1:5432\/flytally_browser/);
  assert.match(workflow,/FLYTALLY_LOCAL_POSTGRES: "1"/);
  assert.match(workflow,/npm run test:browser/);
  const runner=read("tooling/run-auth-browser.mjs");
  assert.match(runner,/FLYTALLY_AUTH_BROWSER!=="1"/);
  assert.match(runner,/FLYTALLY_LOCAL_POSTGRES!=="1"/);
  assert.match(runner,/bootstrap-browser-smoke-db[.]mjs/);
  assert.match(runner,/require\.resolve\("@playwright\/test\/package\.json"\)/);
  assert.match(runner,/spawnSync\(process\.execPath,\[playwrightCli,"test","--config=playwright\.config\.mjs"/);
  assert.doesNotMatch(runner,/npx\.cmd|--no-install","playwright","test/);
  assert.doesNotMatch(workflow,/secrets[.]/);
});

test("v3.2 U4 exercises real authenticated navigation on desktop and mobile",()=>{
  const smoke=read("e2e/public-shell.spec.mjs");
  const actions=read("e2e/browser-actions.mjs");
  assert.match(actions,/browser-auth@example[.]test/);
  assert.match(smoke,/logbook_session/);
  assert.match(smoke,/navigateMain\(page,"Flights"\)/);
  assert.match(smoke,/navigateMain\(page,"Settings"\)/);
  assert.match(smoke,/navigateMain\(page,"Connections"\)/);
  assert.match(smoke,/locator\("tr[.]flight-list-row"\)/);
  assert.match(smoke,/filter\(\{hasText:"18\/09\/2026"\}\)/);
  assert.match(smoke,/filter\(\{hasText:"OK-E2E"\}\)/);
  const ui=read("app/ui-system.css");
  assert.match(ui,/[.]ui-page-stack\{[^}]*grid-template-columns:minmax\(0,1fr\);[^}]*min-width:0;/s);
  assert.match(ui,/[.]ui-page-stack > [*][^{]*\{[^}]*min-width:0;[^}]*max-width:100%;/s);
});


test("authenticated browser projects serialize the shared database fixture locally and in CI",()=>{
  const config=read("playwright.config.mjs");
  assert.match(config,/fullyParallel:false/);
  assert.match(config,/workers:1/);
  assert.doesNotMatch(config,/workers:process[.]env[.]CI\?1:undefined/);
});
