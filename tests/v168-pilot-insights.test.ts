import assert from "node:assert/strict";
import test from "node:test";
import { formatInsightDuration,paceComparison,pilotInsightBounds,parsePilotInsightCustomRange,rollingYearBounds,sharePercent } from "../lib/pilot-insights.ts";

const today=new Date(Date.UTC(2026,8,4));

test("v1.68 period bounds remain deterministic and UTC based",()=>{
  assert.deepEqual(pilotInsightBounds("year",today),{start:"2026-01-01",end:"2026-09-04",label:"2026"});
  assert.deepEqual(pilotInsightBounds("previous",today),{start:"2025-01-01",end:"2025-12-31",label:"2025"});
  assert.deepEqual(pilotInsightBounds("12m",today),{start:"2025-09-05",end:"2026-09-04",label:"2025-09-05 – 2026-09-04"});
  assert.deepEqual(pilotInsightBounds("invalid",today),{start:null,end:null,label:"All time"});
});

test("v1.68 rolling years do not overlap",()=>{
  assert.deepEqual(rollingYearBounds(today),{currentStart:"2025-09-05",currentEnd:"2026-09-04",previousStart:"2024-09-05",previousEnd:"2025-09-04"});
});

test("v1.68 pace comparison handles new, flat, up and down activity",()=>{
  assert.deepEqual(paceComparison(0,0),{direction:"none",percent:null});
  assert.deepEqual(paceComparison(60,0),{direction:"new",percent:null});
  assert.deepEqual(paceComparison(101,100),{direction:"flat",percent:1});
  assert.deepEqual(paceComparison(120,100),{direction:"up",percent:20});
  assert.deepEqual(paceComparison(75,100),{direction:"down",percent:-25});
});

test("v1.68 shares and duration formatting are safe for empty or invalid values",()=>{
  assert.equal(sharePercent(30,120),25);
  assert.equal(sharePercent(30,0),0);
  assert.equal(sharePercent(-5,100),0);
  assert.equal(formatInsightDuration(125),"2:05");
  assert.equal(formatInsightDuration(-10),"0:00");
});


test("custom calendar range validates exact ISO UTC days and inclusive boundaries",()=>{
  assert.deepEqual(parsePilotInsightCustomRange("2026-02-01","2026-02-28"),{ok:true,range:{from:"2026-02-01",to:"2026-02-28"}});
  assert.deepEqual(pilotInsightBounds("custom",today,{from:"2026-02-01",to:"2026-02-28"}),{start:"2026-02-01",end:"2026-02-28",label:"2026-02-01 – 2026-02-28"});
  assert.deepEqual(pilotInsightBounds("custom",today,{from:"2024-02-29",to:"2024-02-29"}),{start:"2024-02-29",end:"2024-02-29",label:"2024-02-29 – 2024-02-29"});
});

test("custom calendar range fails closed for missing, malformed, impossible or reversed dates",()=>{
  const invalid:[unknown,unknown][]=[
    [undefined,"2026-01-31"],
    ["2026-01-01",undefined],
    ["2026-01","2026-01-31"],
    ["2026-02-30","2026-03-01"],
    ["2025-02-29","2025-03-01"],
    ["2026-13-01","2026-13-10"],
    ["2026-04-02","2026-04-01"],
    ["2026-02-01","2026-02-01T01:00:00Z"],
    ["01/02/2026","31/03/2026"],
  ];
  for(const [from,to] of invalid){
    const parsed=parsePilotInsightCustomRange(from,to);
    assert.equal(parsed.ok,false,`Invalid range ${String(from)} – ${String(to)} was accepted`);
    assert.throws(()=>pilotInsightBounds("custom",today,{from:from as string,to:to as string}),RangeError);
  }
});
