import assert from "node:assert/strict";
import test from "node:test";
import {readFileSync} from "node:fs";
import {validateBackupMonetaryEvidence,type PortableBackup} from "../lib/portable-backup.ts";

const sample=(changes:Record<string,unknown>={}):PortableBackup=>({
  version:13,format:"pilot-logbook-portable",exported_at:"2026-10-14T10:00:00Z",
  profile:{id:1},counts:{},integrity:{algorithm:"SHA-256",payload_sha256:"test"},
  flights:[],aircraft:[],rates:[],airports:[],expiries:[],settings:[],flight_tracks:[],
  audit_log:[],fstd_sessions:[],flight_certified_revisions:[],fstd_certified_revisions:[],deleted_flights:[],
  flight_expenses:[],...changes
} as PortableBackup);
const rate={
  price_per_hour:1234.125,dry_price_per_hour:500.001,
  currency_code:"KWD",currency_minor_units:3,
  price_per_hour_decimal:"1234.125",dry_price_per_hour_decimal:"500.001"
};

test("valid ISO 0/2/3 original monetary tuples are accepted before signed restore",()=>{
  assert.equal(validateBackupMonetaryEvidence(sample({
    rates:[rate],
    aircraft:[{default_price_per_hour:7500,default_price_currency_code:"JPY",
      default_price_currency_minor_units:0,default_price_per_hour_decimal:"7500"}],
    flights:[{price_per_hour:35.67,price_currency_code:"EUR",
      price_currency_minor_units:2,price_per_hour_decimal:"35.67"}],
    flight_expenses:[{currency:"KWD",amount_minor:1234125,amount_encoding:"iso_minor_units",amount_minor_units:3}]
  })),null);
});

test("signed v13 JSONB archived snapshots preserve valid numeric decimal tokens",()=>{
  const flight={price_per_hour:1234.125,price_currency_code:"KWD",
    price_currency_minor_units:3,price_per_hour_decimal:1234.125};
  assert.equal(validateBackupMonetaryEvidence(sample({
    deleted_flights:[{flight_data:flight,expenses_data:[
      {currency:"JPY",amount_minor:150,amount_encoding:"iso_minor_units",amount_minor_units:0}
    ]}],
    voided_certified_flights:[{flight_snapshot:flight}],
    voided_flight_archive_items:[{source_data:flight}]
  })),null);
});

test("all-null v21 fields and legacy 2-digit expenses remain unmodified unknown denomination",()=>{
  assert.equal(validateBackupMonetaryEvidence(sample({
    rates:[{price_per_hour:1250,currency_code:null,currency_minor_units:null,price_per_hour_decimal:null}],
    flight_expenses:[{currency:"JPY",amount_minor:1200,amount_encoding:null,amount_minor_units:null}],
    deleted_flights:[{flight_data:{price_currency_code:null,price_currency_minor_units:null},
      expenses_data:[{amount_encoding:null,amount_minor_units:null}]}]
  })),null);
});

test("partial ISO tuple, wrong exponent, unsupported ISO, and contradictory double reject",()=>{
  const scenarios=[
    {rates:[{...rate,currency_minor_units:null}]},
    {rates:[{...rate,currency_minor_units:2}]},
    {rates:[{...rate,currency_code:"XXX"}]},
    {rates:[{...rate,price_per_hour:1200}]},
    {aircraft:[{default_price_currency_code:"KWD",default_price_currency_minor_units:3,
      default_price_per_hour_decimal:null,default_price_per_hour:1234.125}]},
    {flights:[{price_currency_code:"EUR",price_currency_minor_units:null,
      price_per_hour_decimal:"35.67",price_per_hour:35.67}]},
    {flight_expenses:[{currency:"KWD",amount_minor:1000,amount_encoding:"iso_minor_units",amount_minor_units:2}]},
    {flight_expenses:[{currency:"EUR",amount_minor:1000,amount_encoding:"legacy_two_decimal",amount_minor_units:3}]},
    {deleted_flights:[{flight_data:{price_currency_code:"XXX",price_currency_minor_units:7,
      price_per_hour_decimal:"2",price_per_hour:2},expenses_data:[]}]},
    {voided_certified_flights:[{flight_snapshot:{price_per_hour:1,price_currency_code:"XXX",
      price_currency_minor_units:7,price_per_hour_decimal:"1"}}]}
  ];
  for(const caseData of scenarios){
    assert.ok(validateBackupMonetaryEvidence(sample(caseData)),JSON.stringify(caseData));
  }
});

test("preview and execution both refuse malformed evidence before DB writes",()=>{
  const source=readFileSync(new URL("../lib/account-restore-v6.ts",import.meta.url),"utf8");
  assert.match(source,/validateBackupMonetaryEvidence\(backup\)/);
  assert.match(source,/Invalid exact currency evidence/);
  assert.match(source,/async function requireMonetaryRestoreSchema/);
  assert.match(source,/await requireMonetaryRestoreSchema\(backup\)/);
});
