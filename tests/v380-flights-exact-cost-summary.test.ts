import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { presentFlightCostSummary } from "../lib/flight-cost-summary.ts";

const source=readFileSync(new URL("../lib/data/flights-fast.ts",import.meta.url),"utf8");
const page=readFileSync(new URL("../app/(protected)/flights/page.tsx",import.meta.url),"utf8");
const bucket=(currency:string,minorUnits:number,minor:string,flights:number)=>({currency,minorUnits,minor,flights});

test("single-currency exact aggregate is formatted as integer minor units, not float",()=>{
  const s=presentFlightCostSummary([bucket("CZK",2,"77689184",283)],283,0,0,0);
  assert.equal(s.headline,"776,891.84 CZK");
  assert.equal(s.pricedFlights,283);
  assert.equal(s.excludedFlights,0);
  assert.equal(s.complete,true);
});
test("mixed currencies are not combined and can be displayed independently",()=>{
  const s=presentFlightCostSummary([bucket("CZK",2,"12345",2),bucket("JPY",0,"250",1),bucket("KWD",3,"1001",1)],4,0,0,0);
  assert.equal(s.headline,"Multiple currencies");
  assert.deepEqual(s.breakdown,["123.45 CZK","250 JPY","1.001 KWD"]);
  assert.equal(s.complete,true);
});
test("unresolved, invalid, and untracked flights cannot silently become priced zero",()=>{
  const s=presentFlightCostSummary([bucket("EUR",2,"10050",2)],6,1,2,1);
  assert.equal(s.headline,"100.50 EUR");
  assert.equal(s.complete,false);
  assert.equal(s.pricedFlights,2);
  assert.equal(s.excludedFlights,3);
  assert.equal(s.notTrackedFlights,1);
  assert.match(s.detail,/3 excluded/);
  assert.match(presentFlightCostSummary([],1,0,1,0).headline,/Unavailable/);
  assert.equal(presentFlightCostSummary([],1,1,0,0).headline,"—");
  assert.equal(presentFlightCostSummary([],0,0,0,0).headline,"—");
});
test("unsupported currency or inconsistent precision fails closed",()=>{
  const s=presentFlightCostSummary([bucket("XXX",2,"1234",1)],1,0,0,0);
  assert.equal(s.headline,"Unavailable");
  assert.equal(s.excludedFlights,1);
  assert.equal(presentFlightCostSummary([bucket("JPY",2,"10",1)],1,0,0,0).complete,false);
  assert.equal(presentFlightCostSummary([bucket("EUR",2,"10",1)],2,0,0,0).complete,false);
  assert.equal(presentFlightCostSummary(null,1,0,0,0).complete,false);
  assert.equal(presentFlightCostSummary([bucket("CZK",2,"1.2",1)],1,0,0,0).complete,false);
});
test("integer totals larger than JS safe integer remain exact",()=>{
  const s=presentFlightCostSummary([bucket("EUR",2,"99999999999999912",1)],1,0,0,0);
  assert.equal(s.headline,"999,999,999,999,999.12 EUR");
});
test("flight list money aggregator uses entire selected SQL scope, not paginated rows",()=>{
  assert.match(source,/scoped AS MATERIALIZED \(SELECT \* FROM b WHERE/);
  assert.match(source,/classified AS MATERIALIZED/);
  assert.match(source,/costed AS MATERIALIZED/);
  assert.match(source,/cost_totals AS/);
  assert.match(source,/FROM costed CROSS JOIN cost_totals ORDER BY/);
  assert.match(source,/TRUNC\(SUM\(cost_exact \* POWER\(10::numeric,price_currency_minor_units\)\)\)::text total_minor/);
  assert.match(source,/ROUND\([\s\S]*?price_per_hour_decimal::numeric \*[\s\S]*?60::numeric[\s\S]*?price_currency_minor_units\)/);
  assert.match(source,/cost_state='not_tracked'/);
  assert.match(source,/cost_state='unknown'/);
  assert.match(source,/cost_state='invalid'/);
  assert.match(page,/presentFlightCostSummary\(result.costSummarySource.buckets,result.summary.flights/);
  assert.doesNotMatch(page,/<strong>Unverified<\/strong><small>Legacy rates have no recorded currency/);
});
