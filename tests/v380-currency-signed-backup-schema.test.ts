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

test("flight detail expense projection reads exact money on v21 and stays valid on legacy v20",()=>{
  const source=readFileSync(new URL("../app/(protected)/flights/[id]/page.tsx",import.meta.url),"utf8");
  assert.match(source,/to_jsonb\(e\)->>'amount_encoding' amount_encoding/);
  assert.match(source,/\(to_jsonb\(e\)->>'amount_minor_units'\)::smallint amount_minor_units/);
  assert.doesNotMatch(source,/SELECT id,category,label,amount_minor,currency,amount_encoding,amount_minor_units,created_at/);
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

test("M0-A signed v13 browser check preserves evidence without full-account restore",()=>{
  const browser=readFileSync(new URL("../e2e/trash-integrity.spec.mjs",import.meta.url),"utf8");
  const start=browser.indexOf('test("M0-A browser: signed v13 backup remains checkable while full restore is blocked"');
  assert.ok(start>=0,"The browser must retain the signed-v13 containment scenario");
  const signed=browser.slice(start);
  assert.match(signed,/test\.setTimeout\(90_000\)/);
  assert.match(signed,/downloaded\.createReadStream\(\)/);
  assert.match(signed,/backup\.integrity\.server_signature/);
  assert.match(signed,/getByRole\("button",\{name:"Check backup"\}\)\.click\(\)/);
  assert.match(signed,/getByRole\("button",\{name:"Restore missing data"\}\)\)\.toHaveCount\(0\)/);
  assert.match(signed,/getByRole\("textbox",\{name:"Type RESTORE"\}\)\)\.toHaveCount\(0\)/);
  assert.match(signed,/const beforePreRestore=scalar\("SELECT COUNT\(\*\) FROM account_backups/);
  assert.match(signed,/const beforeAudit=scalar\("SELECT COUNT\(\*\) FROM flight_audit_log/);
  assert.match(signed,/expect\(scalar\("SELECT COUNT\(\*\) FROM flights WHERE id="\+flightId/);
  assert.match(signed,/expect\(scalar\("SELECT COUNT\(\*\) FROM flight_audit_log WHERE user_id=9001"\)\)\.toBe\(beforeAudit\)/);
  const checked=signed.indexOf('name:"Check backup"');
  const persisted=signed.lastIndexOf('SELECT COUNT(*) FROM flights WHERE id=');
  assert.ok(checked>=0&&persisted>checked,"Assert persisted no-restore state after the actual preview");
});
