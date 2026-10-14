import test from "node:test";
import assert from "node:assert/strict";
import {validateCurrencyRateSnapshot} from "../lib/currency-rate-snapshot.ts";
import {readFileSync} from "node:fs";
const src=(file:string)=>readFileSync(new URL("../"+file,import.meta.url),"utf8");
const aircraft=src("app/(protected)/database/actions.ts"),flights=src("app/(protected)/flights/actions.ts"),aircraftUi=src("components/aircraft-manager.tsx"),aircraftRead=src("lib/data/database.ts");

test("3.8 new aircraft rate writes validate source ISO currency and persist exact rate tuple",()=>{
  assert.match(aircraft,/supportedIsoCurrency\(s\(form,"currency"\)\)/);
  assert.match(aircraft,/supportedIsoCurrency\(s\(form,"initial_currency"\)\)/);
  assert.match(aircraft,/currency_code,currency_minor_units,price_per_hour_decimal/);
  assert.match(aircraft,/dry_price_per_hour_decimal/);
  assert.match(aircraft,/hourlyDecimal\(raw,true\)/);
  assert.match(aircraftUi,/name="currency"/);
  assert.match(aircraftUi,/name="initial_currency"/);
  assert.match(aircraftUi,/listSupportedIsoCurrencies\(\)/);
  assert.match(aircraftRead,/currency_code,currency_minor_units,price_per_hour_decimal/);
});

test("both manual and GPS creates snapshot original rate currency together with amount",()=>{
  assert.match(flights,/function validateRateSnapshot\(/);
  assert.match(flights,/validateCurrencyRateSnapshot\(row\)/);
  assert.match(flights,/if\(rate===null\)return\{error:/);
  assert.match(flights,/if\(storedRate===null\)return\{error:/);
  assert.match(flights,/const noRateSnapshot:RateSnapshot=/);
  const columnTuples=flights.match(/price_currency_code,price_currency_minor_units,price_per_hour_decimal/g)??[];
  assert.equal(columnTuples.length,2,"Manual and GPS INSERTs must project all three attributes atomically");
  assert.match(flights,/\$\{rate.price_per_hour\},\$\{rate.currency_code\},\$\{rate.currency_minor_units\},\$\{rate.rate_decimal\}/);
  assert.match(flights,/\$\{item.rate.price_per_hour\},\$\{item.rate.currency_code\},\$\{item.rate.currency_minor_units\},\$\{item.rate.rate_decimal\}/);
});

test("edits preserve unchanged stored rate provenance and clear it when billing disabled",()=>{
  assert.match(flights,/price_currency_code AS currency_code/);
  assert.match(flights,/validateRateSnapshot\(existing\)/);
  assert.match(flights,/!f.billingBasis\?noRateSnapshot/);
  assert.match(flights,/price_currency_code=\$\{rate.currency_code\},price_currency_minor_units=\$\{rate.currency_minor_units\},price_per_hour_decimal=\$\{rate.rate_decimal\}/);
  assert.doesNotMatch(flights,/currency_code=.*CZK|price_currency_code=.*CZK/);
});

test("stored legacy rates keep original value without inventing a currency",()=>{
  assert.deepEqual(validateCurrencyRateSnapshot({price_per_hour:1250.5,currency_code:null,currency_minor_units:null,rate_decimal:null}),{
    price_per_hour:1250.5,currency_code:null,currency_minor_units:null,rate_decimal:null
  });
  assert.deepEqual(validateCurrencyRateSnapshot(undefined),{
    price_per_hour:null,currency_code:null,currency_minor_units:null,rate_decimal:null
  });
});

test("partial or corrupted exact currency tuples reject without clearing evidence",()=>{
  const good={price_per_hour:1234.125,currency_code:"KWD",currency_minor_units:3,rate_decimal:"1234.125"};
  assert.deepEqual(validateCurrencyRateSnapshot(good),good);
  for(const broken of [
    {...good,currency_minor_units:null},
    {...good,currency_code:"XXX"},
    {...good,currency_minor_units:2},
    {...good,rate_decimal:null},
    {...good,rate_decimal:"1234.1250.0"},
    {...good,rate_decimal:"0"},
    {...good,price_per_hour:null},
    {...good,price_per_hour:Infinity},
  ])assert.equal(validateCurrencyRateSnapshot(broken),null);
});
