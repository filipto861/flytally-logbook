import assert from "node:assert/strict";
import test from "node:test";
import {
  classifyFlightMonetary, classifyExpenseMonetary, validateSourceOwnership,
  extractFlightMonetaryAllowlist, extractExpenseMonetaryAllowlist,
  type RegistryLookup, type ProtectedEvidence,
} from "../lib/currency-monetary-tuple.ts";

const registry: RegistryLookup = {exponentOf: code => ({JPY:0, EUR:2, KWD:3} as Record<string,number>)[code] ?? null};
const noHistory: ProtectedEvidence = {hasProtectedHistory: () => false};
const flight = (code:string,units:number,decimal:string,legacy:unknown=null) => ({
  price_currency_code:code, price_currency_minor_units:units,
  price_per_hour_decimal:decimal, price_per_hour:legacy,
});
const expense = (code:string,units:number,amount:unknown=125) => ({
  currency:code, amount_minor:amount, amount_encoding:"iso_minor_units", amount_minor_units:units,
});

for (const [code,units] of [["JPY",0],["EUR",2],["KWD",3]] as const) {
  test(`flight ${code} exact tuple preserved with hourly rate more precise than exponent`,()=>{
    const source=flight(code,units,"3060.25001001",123.45);
    const result=classifyFlightMonetary(source,registry,noHistory);
    assert.equal(result.kind,"exact_flight");
    if (result.kind !== "exact_flight") return;
    assert.equal(result.tuple.pricePerHourDecimal,"3060.25001001");
    assert.equal(result.tuple.pricePerHour,123.45);
    assert.equal(result.tuple.priceCurrencyMinorUnits,units);
  });
  test(`expense ${code} exact minor units`,()=>{
    const result=classifyExpenseMonetary(expense(code,units),registry);
    assert.deepEqual(result,{kind:"exact_expense",record:{currency:code,amountMinor:"125",amountEncoding:"iso_minor_units",amountMinorUnits:units}});
  });
}

test("legacy unknown price preserves NULL and FLOAT8 JSON values; no denomination inferred",()=>{
  assert.deepEqual(classifyFlightMonetary({price_per_hour:99.125},registry,noHistory),{kind:"legacy_flight_unknown_currency",pricePerHour:99.125});
  assert.deepEqual(classifyFlightMonetary({price_per_hour:null,price_currency_code:null,price_currency_minor_units:null,price_per_hour_decimal:null},registry,noHistory),{kind:"legacy_flight_unknown_currency",pricePerHour:null});
});
test("partial/malformed/unsupported flight tuple fails closed",()=>{
  assert.deepEqual(classifyFlightMonetary(flight("EUR",null as never,"1.00"),registry,noHistory),{kind:"reject",reason:"malformed_partial_tuple"});
  assert.deepEqual(classifyFlightMonetary(flight("EUR",3,"1.00"),registry,noHistory),{kind:"reject",reason:"contradictory_currency_exponent"});
  assert.deepEqual(classifyFlightMonetary(flight("ZZZ",2,"1.00"),registry,noHistory),{kind:"reject",reason:"unsupported_currency"});
  assert.deepEqual(classifyFlightMonetary(flight("EUR",2,"-1.00"),registry,noHistory),{kind:"reject",reason:"invalid_exact_decimal"});
  assert.deepEqual(classifyFlightMonetary(flight("EUR",2,"1e3"),registry,noHistory),{kind:"reject",reason:"invalid_exact_decimal"});
});
test("exact JSON NUMERIC parsed as JS number is rejected rather than silently rounded",()=>{
  const source={...flight("EUR",2,"9007199254740993.01"),price_per_hour_decimal:9007199254740994};
  assert.deepEqual(classifyFlightMonetary(source,registry,noHistory),{kind:"reject",reason:"invalid_exact_decimal"});
  assert.equal(classifyFlightMonetary(flight("EUR",2,"9007199254740993.01"),registry,noHistory).kind,"exact_flight");
});
test("protected source fields and external protected history cannot be bypassed",()=>{
  for (const flag of [{certified_at:"2026-01-01"},{certification_hash:"abc"},{record_revision:2},{locked_at:"2026-01-01"},{correction_reason:"fix"}]) {
    assert.deepEqual(classifyFlightMonetary({...flight("EUR",2,"1.00"),...flag},registry,noHistory),{kind:"reject",reason:"protected_snapshot"});
  }
  assert.deepEqual(classifyFlightMonetary(flight("EUR",2,"1.00"),registry,{hasProtectedHistory:()=>true}),{kind:"reject",reason:"protected_snapshot"});
  assert.equal(classifyFlightMonetary({...flight("EUR",2,"1.00"),certification_hash:"",record_revision:1},registry,noHistory).kind,"exact_flight");
});
test("legacy expense encoding is preserved independent of ISO exponent",()=>{
  assert.deepEqual(classifyExpenseMonetary({currency:"JPY",amount_minor:550,amount_encoding:null,amount_minor_units:null},registry),{
    kind:"legacy_expense",record:{currency:"JPY",amountMinor:"550",amountEncoding:null,amountMinorUnits:null},
  });
  assert.deepEqual(classifyExpenseMonetary({currency:"JPY",amount_minor:"550",amount_encoding:"legacy_two_decimal",amount_minor_units:2},registry),{
    kind:"legacy_expense",record:{currency:"JPY",amountMinor:"550",amountEncoding:"legacy_two_decimal",amountMinorUnits:2},
  });
});
test("expense rejects missing currency, zero, out-of-range, fractions and unsafe JS numbers",()=>{
  assert.deepEqual(classifyExpenseMonetary({amount_minor:1},registry),{kind:"reject",reason:"missing_expense_currency"});
  for (const amount of [0,"0",-1,"-1",1.3,"1.3",null,"",1_000_000_001,"1000000001",Number.MAX_SAFE_INTEGER+1]) {
    assert.deepEqual(classifyExpenseMonetary({...expense("EUR",2),amount_minor:amount},registry),{kind:"reject",reason:"invalid_amount_minor"},String(amount));
  }
});
test("expense rejects partial tuple, unknown ISO, mismatched exponent",()=>{
  assert.deepEqual(classifyExpenseMonetary({...expense("EUR",2),amount_minor_units:null},registry),{kind:"reject",reason:"malformed_partial_tuple"});
  assert.deepEqual(classifyExpenseMonetary(expense("EUR",3),registry),{kind:"reject",reason:"contradictory_currency_exponent"});
  assert.deepEqual(classifyExpenseMonetary(expense("ZZZ",2),registry),{kind:"reject",reason:"unsupported_currency"});
  assert.deepEqual(classifyExpenseMonetary({...expense("EUR",2),amount_encoding:"bad"},registry),{kind:"reject",reason:"malformed_partial_tuple"});
});
test("allowlist extraction never copies arbitrary snapshot keys and never changes scalar values",()=>{
  const f={...flight("EUR",2,"1.001"),id:42,user_id:4,note:"secret"};
  assert.deepEqual(extractFlightMonetaryAllowlist(f),flight("EUR",2,"1.001"));
  assert.deepEqual(extractExpenseMonetaryAllowlist({...expense("EUR",2),id:55,card:"secret"}),expense("EUR",2));
  assert.equal(extractFlightMonetaryAllowlist(null),null);
});
test("ownership matches numeric JSONB BIGINTs against trusted decimal-string identifiers",()=>{
  assert.equal(validateSourceOwnership({id:101,user_id:15},[{id:7,user_id:15,flight_id:101}],[{id:8,user_id:15,flight_id:101}],{expectedUserId:"15",originalFlightId:"101"}),true);
  assert.equal(validateSourceOwnership({id:"101",user_id:"15"},[],[],{expectedUserId:15,originalFlightId:101}),true);
});
test("ownership fail-closed for mismatched, missing, duplicate and unsafe numeric identities",()=>{
  const ctx={expectedUserId:"15",originalFlightId:"101"};
  assert.equal(validateSourceOwnership({id:101,user_id:16},[],[],ctx),"ownership_mismatch");
  assert.equal(validateSourceOwnership({id:101,user_id:15},[{id:1,user_id:15,flight_id:102}],[],ctx),"ownership_mismatch");
  assert.equal(validateSourceOwnership({id:101,user_id:15},[],[{id:2,user_id:16,flight_id:101}],ctx),"ownership_mismatch");
  assert.equal(validateSourceOwnership({id:101,user_id:15},[{id:1,user_id:15,flight_id:101},{id:1,user_id:15,flight_id:101}],[],ctx),"ownership_mismatch");
  assert.equal(validateSourceOwnership({id:101,user_id:15},[{user_id:15,flight_id:101}],[],ctx),"ownership_mismatch");
  assert.equal(validateSourceOwnership({id:9007199254740992,user_id:15},[],[],{expectedUserId:"9007199254740992",originalFlightId:"9007199254740992"}),"ownership_mismatch");
  assert.equal(validateSourceOwnership(null,[],[],ctx),"type_error");
});
