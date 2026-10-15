import assert from "node:assert/strict";
import test from "node:test";
import {readFileSync} from "node:fs";
const source=(path:string)=>readFileSync(new URL("../"+path,import.meta.url),"utf8");

test("historical flight list and profile screens do not assign CZK to unknown-denomination rates",()=>{
  for(const path of [
    "app/(protected)/flights/page.tsx",
    "app/(protected)/flights/[id]/page.tsx",
    "components/aircraft-manager.tsx",
    "components/aircraft-share-panel.tsx",
    "components/dashboard-details.tsx",
    "app/(protected)/statistics/page.tsx",
  ]){
    const content=source(path);
    assert.doesNotMatch(content,/CZK\/h|toLocaleString\("en-GB"\)\}\s*CZK/i,path);
  }
  const list=source("app/(protected)/flights/page.tsx");
  assert.match(list,/presentFlightCostSummary\(result\.costSummarySource\.buckets/);
  assert.doesNotMatch(list,/<strong>Unverified<\/strong>/);
  const aggregate=source("lib/flight-cost-summary.ts");
  assert.match(aggregate,/supportedIsoCurrency\(raw\.currency\)/);
  assert.match(aggregate,/unsupported \+= flights/);
  assert.match(aggregate,/excluded \(unavailable\/unknown\)/);
  assert.match(source("app/(protected)/flights/[id]/page.tsx"),/currency unknown/);
});

test("highest-cost sort cannot compare unknown or mixed denominations, including old deep links",()=>{
  const page=source("app/(protected)/flights/page.tsx");
  assert.doesNotMatch(page,/value="cost">Highest cost/);
  assert.match(page,/rawFilters\.sort==="cost"\?\{\.\.\.rawFilters,sort:"newest"\}/);
  assert.match(source("lib/data/flights-fast.ts"),/sort:filters\.sort\?\.trim\(\)==="cost"\?"newest"/);
  assert.match(source("lib/data/flights.ts"),/sort=\(filters\.sort\?\?"newest"\)\.trim\(\)==="cost"\?"newest"/);
});

test("legacy aircraft-cost numeric value is never silently attributed to CZK expense totals",()=>{
  const totals=source("lib/flight-expenses.ts");
  assert.doesNotMatch(totals,/totals\.set\("CZK",Math\.round\(aircraftCost\)/);
  assert.match(totals,/Aircraft rate currency unknown/);
  assert.match(source("app/(protected)/flights/[id]/page.tsx"),/costTotalsLabel\(expenses\)/);
});
