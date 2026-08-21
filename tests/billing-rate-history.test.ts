import test from "node:test";
import assert from "node:assert/strict";
import { calculatedFlightPrice,parseBilling,serializeBilling } from "../lib/billing.ts";
import { effectiveRateForDate,shouldResolveStoredPrice,validIsoDate } from "../lib/rate-history.ts";

test("BLOCK and AIR prices include the selected share",()=>{
  assert.equal(calculatedFlightPrice(2400,90,60,"BLOCK/2"),1800);
  assert.equal(calculatedFlightPrice(2400,90,60,"AIR/2"),1200);
  assert.equal(calculatedFlightPrice(2400,90,60,"BLOCK/3"),1200);
});

test("legacy billing values remain compatible",()=>{
  assert.deepEqual(parseBilling("BLOCK"),{basis:"BLOCK",share:1});
  assert.deepEqual(parseBilling("AIR"),{basis:"AIR",share:1});
  assert.equal(serializeBilling("AIR",4),"AIR/4");
  assert.equal(serializeBilling("unknown",0),"BLOCK");
});

test("effective rate is selected from the historical timeline",()=>{
  const rates=[
    {valid_from:"2024-01-01",price_per_hour:2000},
    {valid_from:"2025-01-01",price_per_hour:2300},
    {valid_from:"2026-07-01",price_per_hour:2600},
  ];
  assert.equal(effectiveRateForDate(rates,"2024-12-31")?.price_per_hour,2000);
  assert.equal(effectiveRateForDate(rates,"2025-06-10")?.price_per_hour,2300);
  assert.equal(effectiveRateForDate(rates,"2026-08-21")?.price_per_hour,2600);
  assert.equal(effectiveRateForDate(rates,"2023-12-31"),null);
});

test("stored flight price is a snapshot unless date or registration changes",()=>{
  const flight={registration:"OK-ABC",date:"2026-08-20",price_per_hour:2500};
  assert.equal(shouldResolveStoredPrice(flight,"OK-ABC","2026-08-20"),false);
  assert.equal(shouldResolveStoredPrice(flight,"OK-XYZ","2026-08-20"),true);
  assert.equal(shouldResolveStoredPrice(flight,"OK-ABC","2026-08-21"),true);
  assert.equal(shouldResolveStoredPrice({...flight,price_per_hour:null},"OK-ABC","2026-08-20"),true);
});

test("effective dates require a real ISO date",()=>{
  assert.equal(validIsoDate("2026-08-21"),true);
  assert.equal(validIsoDate("21.08.2026"),false);
  assert.equal(validIsoDate(""),false);
});
