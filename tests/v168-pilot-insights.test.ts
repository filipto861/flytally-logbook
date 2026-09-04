import assert from "node:assert/strict";
import test from "node:test";
import { formatInsightDuration,paceComparison,pilotInsightBounds,rollingYearBounds,sharePercent } from "../lib/pilot-insights.ts";

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
