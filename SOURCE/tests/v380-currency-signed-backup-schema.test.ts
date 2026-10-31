import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";
import {backupContainsExactMonetaryData,type PortableBackup} from "../lib/portable-backup.ts";

function sample(overrides:Record<string,unknown>={}):PortableBackup{
  return {
    version:13,format:"pilot-logbook-portable",exported_at:"2026-10-14T08:00:00Z",profile:{id:7},
    counts:{},integrity:{algorithm:"SHA-256",payload_sha256:"x"},
    flights:[],aircraft:[],rates:[],airports:[],expiries:[],settings:[],flight_tracks:[],
    audit_log:[],fstd_sessions:[],flight_certified_revisions:[],fstd_certified_revisions:[],deleted_flights:[],
    flight_expenses:[],...overrides
  } as PortableBackup;
}

test("signed v13 legacy backup with NULL-added columns does not invent a currency",()=>{
  assert.equal(backupContainsExactMonetaryData(sample({
    flights:[{price_currency_code:null,price_currency_minor_units:null,price_per_hour_decimal:null}],
    rates:[{currency_code:null,currency_minor_units:null,price_per_hour_decimal:null,dry_price_per_hour_decimal:null}],
    flight_expenses:[{currency:"JPY",amount_minor:12345,amount_encoding:null,amount_minor_units:null}],
    deleted_flights:[{flight_data:{price_currency_code:null},expenses_data:[{amount_encoding:null,amount_minor_units:null}]}]
  })),false);
});

test("signed v13 monetary metadata is detected regardless of the declared schema version",()=>{
  for(const changes of [
    {flights:[{price_currency_code:"KWD",price_currency_minor_units:3,price_per_hour_decimal:"1234.125"}]},
    {aircraft:[{default_price_currency_code:"EUR"}]},
    {rates:[{dry_price_per_hour_decimal:"1000.50"}]},
    {flight_expenses:[{currency:"JPY",amount_minor:150,amount_encoding:"iso_minor_units",amount_minor_units:0}]},
    {flight_expenses:[{amount_minor_units:3}]}, // incomplete is not legacy
    {deleted_flights:[{flight_data:{price_currency_code:"KWD"},expenses_data:[]}]},
    {deleted_flights:[{flight_data:{price_currency_code:null},expenses_data:[{amount_encoding:"iso_minor_units"}]}]},
    {voided_certified_flights:[{flight_snapshot:{price_currency_code:"EUR"}}]},
    {voided_flight_archive_items:[{source_data:{amount_minor_units:3}}]}
  ]){
    assert.equal(backupContainsExactMonetaryData(sample({schema_version:20,...changes})),true,JSON.stringify(changes));
  }
});

test("signed v13 exact restore refuses currency-bearing backup if schema v21 is absent",()=>{
  const restore=readFileSync(new URL("../lib/account-restore-v6.ts",import.meta.url),"utf8");
  assert.match(restore,/async function requireMonetaryRestoreSchema\(backup:PortableBackup\)/);
  assert.match(restore,/if\(!backupContainsExactMonetaryData\(backup\)\)return/);
  for(const name of ["currency_code","currency_minor_units","price_per_hour_decimal",
    "dry_price_per_hour_decimal","default_price_currency_code","default_price_currency_minor_units",
    "default_price_per_hour_decimal","price_currency_code","price_currency_minor_units","amount_encoding","amount_minor_units"]){
    assert.ok(restore.includes('"'+name+'"'),name+" must be inspected");
  }
  const prepare=restore.slice(restore.indexOf("export async function prepareExactAccountRestore"),
    restore.indexOf("function stageFlight"));
  const execute=restore.slice(restore.indexOf("export async function executeExactAccountRestore"));
  assert.match(prepare,/await requireMonetaryRestoreSchema\(backup\)/);
  assert.match(execute,/await requireMonetaryRestoreSchema\(backup\)/);
  assert.match(restore,/Currency recovery requires schema v21/);
  assert.match(restore,/table_schema=current_schema\(\)/);
});

test("exact v21 Trash rate validator accepts decimal rates rather than double-escaped regex",()=>{
  const trash=readFileSync(new URL("../lib/flight-trash.ts",import.meta.url),"utf8");
  const decimal=/^\d+(?:\.\d+)?$/;
  assert.ok(trash.includes("!"+decimal.toString()+".test(String(decimal))"));
  assert.equal(decimal.test("1234.125"),true);
  assert.equal(decimal.test("1200"),true);
  assert.equal(decimal.test("1e6"),false);
  assert.equal(decimal.test("NaN"),false);
});

test("flight detail expense projection reads exact money on v21 and stays valid on legacy v20",()=>{
  const source=readFileSync(new URL("../app/(protected)/flights/[id]/page.tsx",import.meta.url),"utf8");
  assert.match(source,/to_jsonb\(e\)->>'amount_encoding' amount_encoding/);
  assert.match(source,/\(to_jsonb\(e\)->>'amount_minor_units'\)::smallint amount_minor_units/);
  assert.doesNotMatch(source,/SELECT id,category,label,amount_minor,currency,amount_encoding,amount_minor_units,created_at/);
});

test("Currency browser v21 setup only runs inside a dedicated disposable localhost fixture",()=>{
  const harness=readFileSync(new URL("../tooling/run-auth-browser.mjs",import.meta.url),"utf8");
  const runner=readFileSync(new URL("../tooling/run-currency-380-browser-local.ps1",import.meta.url),"utf8");
  assert.match(harness,/FLYTALLY_CURRENCY_V21_BROWSER==="1"/);
  assert.match(harness,/parsedDatabaseUrl\.hostname!=="127\.0\.0\.1"/);
  assert.match(harness,/parsedDatabaseUrl\.pathname!=="\/flytally_currency_test"/);
  const fixture=readFileSync(new URL("../tooling/bootstrap-browser-smoke-db.mjs",import.meta.url),"utf8");
  const plan=readFileSync(new URL("../lib/migration-plan.ts",import.meta.url),"utf8");
  const runtime=readFileSync(new URL("../lib/db-optimization.ts",import.meta.url),"utf8");
  const migrations=[...plan.matchAll(/\{version:(\d+),name:"([^"]+)"\}/g)]
    .map(match=>({version:Number(match[1]),name:match[2]}));
  assert.deepEqual(migrations.map(item=>item.version),Array.from({length:21},(_,index)=>index+1));
  for(const item of migrations){
    assert.ok(runtime.includes(item.version+':"'+item.name+'"'),"Registry/runtime name mismatch "+item.version);
  }
  assert.ok(fixture.includes('readFileSync(new URL("../lib/migration-plan.ts"'));
  assert.ok(fixture.includes("preappliedMigrations.length!==19"));
  assert.ok(fixture.includes("preappliedMigrations.map(migration"));
  assert.doesNotMatch(fixture,/browser-smoke-preapplied/);
  assert.ok(harness.indexOf("const bootstrapResult=")<harness.indexOf("const browserResult="));
  assert.doesNotMatch(harness,/3_8_0_currency_v21_additive_candidate\.sql/);
  assert.ok(harness.includes("schema-first v20/v21 migration"));
  const schemaFirst=readFileSync(new URL("../tooling/apply-currency-v21-disposable.mjs",import.meta.url),"utf8");
  const playwrightConfig=readFileSync(new URL("../playwright.config.mjs",import.meta.url),"utf8");
  assert.match(schemaFirst,/FLYTALLY_CURRENCY_V21_BROWSER/);
  assert.match(schemaFirst,/env.VERCEL!==undefined\|\|env.VERCEL_ENV!==undefined/);
  assert.match(schemaFirst,/if\(registered!==expected\)/);
  assert.match(schemaFirst,/blocks.length!==\(version===20\?39:9\)/);
  // PostgreSQL psql receives one concatenated transactional script, not the
  // separate driver calls used by runtime: every extracted block must terminate.
  assert.match(schemaFirst,/return blocks\.map\(statement=>statement\.trimEnd\(\)\.replace\(\/;\+\$\/,""\)\+";"\)/);
  assert.match(schemaFirst,/SELECT pg_advisory_xact_lock\(704190104\)/);
  assert.match(schemaFirst,/if\(evidence!=="1\|12\|4"\)/);
  assert.match(playwrightConfig,/reuseExistingServer:process.env.FLYTALLY_CURRENCY_V21_BROWSER==="1"\?false:!process.env.CI/);
  assert.ok(harness.indexOf("const schemaResult=")>harness.indexOf("const bootstrapResult="));
  assert.ok(harness.indexOf("const schemaResult=")<harness.indexOf("const browserResult="));
  assert.ok(harness.includes("schema-first v21 registry/column/constraint postcheck failed"));
  assert.ok(harness.includes('String(observed.stdout).trim()!=="1|12|4"'));
  assert.match(runner,/\$env:FLYTALLY_CURRENCY_V21_BROWSER = "1"/);
  assert.match(runner,/Restore-Env "FLYTALLY_CURRENCY_V21_BROWSER"/);
  assert.match(runner,/npm\.cmd run test:browser -- --currency-v21 e2e\/trash-integrity\.spec\.mjs/);
  assert.match(runner,/Currency browser PowerShell-to-Node purpose preflight PASS/);
  assert.ok(runner.indexOf('Currency purpose environment preflight')<runner.indexOf("npm.cmd run build"));
  assert.match(harness,/const currencyIntent=playwrightArgs\[0\]==="--currency-v21"/);
  assert.match(harness,/Currency browser purpose\/hosting flags missing or invalid in Node harness/);
  assert.match(harness,/Currency browser pre-bootstrap purpose and database URL checks PASS/);
  assert.match(harness,/schemaFirstIntent\?playwrightArgs\.slice\(1\):playwrightArgs/);
  assert.ok(harness.indexOf("const currencyIntent=")<harness.indexOf("const bootstrapResult="));
  // Next's optimized server bundle must be built against the verified fixture
  // environment; building first can freeze the deny-by-default v21 gate.
  const checked=runner.indexOf('Write-Host "Verified disposable DB identity."');
  const purpose=runner.indexOf('$env:FLYTALLY_CURRENCY_V21_BROWSER = "1"');
  const build=runner.indexOf("npm.cmd run build");
  const browser=runner.indexOf("npm.cmd run test:browser");
  assert.ok(checked>=0&&purpose>=0&&build>=0&&browser>=0);
  assert.ok(purpose<checked&&checked<build&&build<browser,
    "Fixture purpose + verified database must precede optimized browser build");
  assert.equal((runner.match(/npm\.cmd run build/g)||[]).length,1);
  assert.match(runner,/if \(Test-Path Env:VERCEL\)/);
  assert.match(runner,/if \(Test-Path Env:VERCEL_ENV\)/);
});

test("signed v13 browser download retains the protected endpoint and clicks actual Download UI",()=>{
  const browser=readFileSync(new URL("../e2e/trash-integrity.spec.mjs",import.meta.url),"utf8");
  const api=readFileSync(new URL("../app/api/backups/[id]/route.ts",import.meta.url),"utf8");
  assert.ok(browser.includes('page.waitForEvent("download"'),"Test must exercise a real browser download");
  assert.ok(browser.includes('.stored-backup-list a[href="/api/backups/'));
  assert.ok(browser.includes("downloaded.createReadStream()"));
  assert.ok(!browser.includes('page.request.get("/api/backups/'),"Do not bypass the browser session in signed backup E2E");
  assert.ok(api.includes("const session=await getSession()"),"Stored backup download must remain authenticated");
  assert.ok(api.includes('new Response("Unauthorized",{status:401})'),"Unauthenticated backup access remains forbidden");
});

test("isolated browser FSTD correction columns match the canonical DB optimizer before signed v13 restore",()=>{
  const fixture=readFileSync(new URL("../tooling/bootstrap-browser-smoke-db.mjs",import.meta.url),"utf8");
  const optimizer=readFileSync(new URL("../lib/db-optimization.ts",import.meta.url),"utf8");
  const fstd=fixture.slice(fixture.indexOf("CREATE TABLE fstd_sessions ("),fixture.indexOf("CREATE TABLE fstd_certified_revisions ("));
  assert.ok(fstd.startsWith("CREATE TABLE fstd_sessions ("));
  for(const column of ["record_revision","correction_reason","correction_opened_at","correction_opened_by_user_id"]){
    assert.match(fstd,new RegExp("^  "+column+"\\s", "m"),"Missing "+column+" in browser FSTD fixture");
    assert.ok(optimizer.includes("ALTER TABLE fstd_sessions ADD COLUMN IF NOT EXISTS "+column),
      "Missing canonical FSTD optimizer provenance for "+column);
  }
});

test("signed v13 desktop recovery waits for an explicit Server Action result before asserting restored money",()=>{
  const browser=readFileSync(new URL("../e2e/trash-integrity.spec.mjs",import.meta.url),"utf8");
  const signed=browser.slice(browser.indexOf('test("Currency 3.8 browser: signed portable v13'));
  assert.match(signed,/test\.setTimeout\(90_000\)/);
  assert.match(signed,/Exact recovery completed atomically\./);
  assert.match(signed,/Restore error: /);
  const status=signed.indexOf('page.locator(".backup-center [role=status]")');
  const persisted=signed.indexOf("SELECT price_currency_code||");
  assert.ok(status>0&&persisted>status,"Check the actual authenticated restore result before PostgreSQL values");
});
