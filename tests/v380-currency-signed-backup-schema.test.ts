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
