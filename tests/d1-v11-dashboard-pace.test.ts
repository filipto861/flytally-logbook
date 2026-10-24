import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { buildDashboardPace,type PaceMonth } from "../lib/dashboard-pace.ts";

const root=path.resolve(import.meta.dirname,"..");
const read=(p:string)=>fs.readFileSync(path.join(root,p),"utf8");
const asOf=new Date("2026-10-24T14:00:00Z");
const sample=(month:string,total:number,ull=total,easa=0):PaceMonth=>({month,total,ull,easa});

test("D1-V11 selects exactly 24 UTC calendar months and marks current month separately",()=>{
  const result=buildDashboardPace([sample("2024-10",80),sample("2025-10",140),sample("2026-09",200),sample("2026-10",70)],asOf);
  assert.equal(result.status,"available");
  assert.equal(result.months.length,24);
  assert.equal(result.months[0].month,"2024-11");
  assert.equal(result.months.at(-1)?.month,"2026-10");
  assert.equal(result.currentMonth,"2026-10");
  assert.equal(result.months.at(-1)?.total,70);
  assert.equal(result.comparisons?.total.currentRange,"2025-10 – 2026-09");
  assert.equal(result.comparisons?.total.previousRange,"2024-10 – 2025-09");
  assert.equal(result.comparisons?.total.currentMinutes,340);
  assert.equal(result.comparisons?.total.previousMinutes,80);
  // Partial October 2026 contributes to 24-month plot, not either completed comparison.
  assert.equal(result.comparisons?.total.percentChange,325);
});

test("D1-V11 categories have independent, source-supplied totals",()=>{
  const result=buildDashboardPace([sample("2024-10",20,10,10),sample("2026-09",40,12,28)],asOf);
  assert.equal(result.comparisons?.ull.currentMinutes,12);
  assert.equal(result.comparisons?.easa.currentMinutes,28);
  assert.equal(result.comparisons?.easa.previousMinutes,10);
  assert.equal(result.comparisons?.ull.percentChange,20);
});

test("D1-V11 zero baseline never fabricates a percentage and missing months are zero only with complete inputs",()=>{
  const result=buildDashboardPace([sample("2026-09",25)],asOf);
  assert.equal(result.comparisons?.total.percentChange,null);
  assert.equal(result.months.filter(row=>row.total!==0).length,1);
  assert.equal(buildDashboardPace([],asOf).status,"empty");
  assert.equal(buildDashboardPace(null,asOf).status,"unavailable");
});

test("D1-V11 malformed or unaccounted date evidence fails closed",()=>{
  assert.equal(buildDashboardPace([sample("2026-13",10)],asOf).status,"unavailable");
  assert.equal(buildDashboardPace([sample("2026-09",-1)],asOf).status,"unavailable");
  assert.equal(buildDashboardPace([sample("2026-09",10),sample("2026-09",20)],asOf).status,"unavailable");
  assert.equal(buildDashboardPace([sample("2026-09",10)],asOf,1).status,"unavailable");
});

test("D1-V11 opt-in preview preserves the legacy preference editor and protected routes",()=>{
  const page=read("app/(protected)/dashboard/page.tsx"),editorial=read("components/dashboard-editorial.tsx"),pace=read("components/dashboard-pace.tsx"),css=read("app/dashboard-editorial.css");
  assert.match(page,/params\.view==="v11"/);
  assert.match(page,/DashboardEditor layout=\{layout\}/);
  assert.match(page,/dashboardLayoutFromPreferences\(preferences\)/);
  assert.match(page,/href="\/dashboard"/);
  assert.match(page,/href="\/flights\/new"/);
  assert.match(editorial,/href="\/credentials"/);
  assert.match(editorial,/href="\/flights\/needs-attention"/);
  assert.match(editorial,/href="\/actions"/);
  assert.match(editorial,/d1v11-latest/);
  assert.match(pace,/role="slider"/);
  assert.match(pace,/aria-valuetext/);
  assert.match(css,/@media\(max-width:610px\)/);
});
