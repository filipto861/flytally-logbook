import assert from "node:assert/strict";
import test from "node:test";
import {readFileSync} from "node:fs";
import {encodeAircraftShareRate,parseAircraftShareSnapshot,formatAircraftShareRate} from "../lib/aircraft-sharing.ts";
import {validateCurrencyRateSnapshot} from "../lib/currency-rate-snapshot.ts";

const source=(path:string)=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const kwd={
  aircraft_type:"B23",valid_from:"2026-10-14",source:"Club",
  price_per_hour:1234.125,dry_price_per_hour:500.001,
  currency_code:"KWD",currency_minor_units:3,
  price_per_hour_decimal:"1234.125",dry_price_per_hour_decimal:"500.001"
};

test("v2 shared source rate preserves exact KWD exponent and decimal provenance",()=>{
  const rate=encodeAircraftShareRate(kwd);
  assert.ok(rate);
  assert.equal(rate.rateKind,"exact");
  assert.equal(rate.pricePerHour,1234.125);
  assert.equal(formatAircraftShareRate(rate),"1234.125 KWD/h");
  const parsed=parseAircraftShareSnapshot({version:2,profile:{registration:"OK-ABC"},currentRate:rate,rateHistory:[rate]});
  assert.equal(parsed.rateError,undefined);
  assert.deepEqual(parsed.currentRate,rate);
  assert.deepEqual(parsed.rateHistory,[rate]);
});

test("v2 legacy-unknown rate remains unknown, without a fabricated CZK",()=>{
  const rate=encodeAircraftShareRate({...kwd,currency_code:null,currency_minor_units:null,
    price_per_hour_decimal:null,dry_price_per_hour_decimal:null});
  assert.ok(rate);
  assert.equal(rate.rateKind,"legacy-unknown");
  assert.match(formatAircraftShareRate(rate),/currency unknown/);
  const parsed=parseAircraftShareSnapshot({version:2,profile:{registration:"OK-ABC"},currentRate:rate});
  assert.equal(parsed.currentRate?.rateKind,"legacy-unknown");
});

test("versionless historical v1 pending share keeps original import compatibility",()=>{
  const parsed=parseAircraftShareSnapshot({
    profile:{registration:" ok-abc "},
    currentRate:{validFrom:"2026-09-01",pricePerHour:"3500",dryPricePerHour:"2500"},
    rateHistory:[{validFrom:"bad",pricePerHour:1},{validFrom:"2026-01-01",pricePerHour:2300}]
  });
  assert.equal(parsed.version,undefined);
  assert.equal(parsed.rateError,undefined);
  assert.equal(parsed.currentRate?.rateKind,"legacy-unknown");
  assert.equal(parsed.rateHistory?.length,1);
});

test("invalid, incomplete or contradictory v21 tuples fail closed",()=>{
  for(const candidate of [
    {...kwd,currency_code:"XXX"}, {...kwd,currency_minor_units:2},
    {...kwd,price_per_hour:1200}, {...kwd,dry_price_per_hour_decimal:null},
    {...kwd,price_per_hour_decimal:null}
  ])assert.equal(encodeAircraftShareRate(candidate),null);
  const good=encodeAircraftShareRate(kwd);
  assert.ok(good);
  for(const malformed of [
    {...good,priceDecimal:null},
    {...good,rateKind:"legacy-unknown"},
    {...good,currencyCode:"XXX"},
    {...good,pricePerHour:1200},
    {...good,dryPriceDecimal:"400.001"}
  ]){
    const parsed=parseAircraftShareSnapshot({version:2,profile:{registration:"OK-ABC"},currentRate:malformed});
    assert.ok(parsed.rateError);
    assert.equal(parsed.currentRate,undefined);
  }
  assert.ok(parseAircraftShareSnapshot({version:3,profile:{registration:"OK-ABC"}}).rateError);
});

test("legacy/exact cache conflicts are rejected without changing the stored snapshot",()=>{
  assert.equal(validateCurrencyRateSnapshot({
    price_per_hour:1200,currency_code:"EUR",currency_minor_units:2,rate_decimal:"2000.000"
  }),null);
  assert.ok(validateCurrencyRateSnapshot({
    price_per_hour:Number("1234.125"),currency_code:"KWD",currency_minor_units:3,rate_decimal:"1234.125"
  }));
});

test("share writer and recipient upsert preserve all four exact v21 columns atomically",()=>{
  const actions=source("app/(protected)/connections/aircraft-share-actions.ts");
  assert.match(actions,/const snapshot:AircraftShareSnapshot=\{version:2,profile\}/);
  assert.match(actions,/rates\.filter\(row=>iso\(/);
  assert.match(actions,/rateRows\.map\(encodeAircraftShareRate\)/);
  assert.match(actions,/if\(encoded\.some\(value=>value===null\)\)/);
  assert.match(actions,/currency_code,currency_minor_units,price_per_hour_decimal::text/);
  assert.match(actions,/a\.default_price_currency_code,a\.default_price_currency_minor_units/);
  assert.match(actions,/currency_code=EXCLUDED\.currency_code,currency_minor_units=EXCLUDED\.currency_minor_units/);
  assert.match(actions,/dry_price_per_hour_decimal=EXCLUDED\.dry_price_per_hour_decimal/);
  assert.match(actions,/WHERE \$\{exact\} OR \(rates\.currency_code IS NULL/);
  assert.match(actions,/rates\.price_per_hour_decimal IS NULL AND rates\.dry_price_per_hour_decimal IS NULL/);
  assert.match(actions,/rateStatementIndexes\.some\(index=>/);
  assert.match(source("app/(protected)/database/page.tsx"),/ratesSkipped/);
  assert.doesNotMatch(source("app/(protected)/connections/aircraft/[id]/page.tsx"),/CZK\/h/);
  assert.match(source("app/(protected)/connections/aircraft/[id]/page.tsx"),/formatAircraftShareRate/);
});
