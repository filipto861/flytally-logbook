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
  assert.equal(buildDashboardPace([sample("2023-01",900)],asOf).status,"empty",
    "Only out-of-window source rows must not render a fake 24-month chart");
  assert.equal(buildDashboardPace([sample("2024-10",40)],asOf).status,"empty",
    "A comparison-only 25th source month is not visible Flying Pace activity");
  assert.equal(buildDashboardPace([sample("2024-11",0)],asOf).status,"available",
    "A valid zero-minute flight in the visible period is still a recorded activity month");
});

test("D1-V11 malformed or unaccounted date evidence fails closed",()=>{
  assert.equal(buildDashboardPace([sample("2026-13",10)],asOf).status,"unavailable");
  assert.equal(buildDashboardPace([sample("2026-09",-1)],asOf).status,"unavailable");
  assert.equal(buildDashboardPace([sample("2026-09",10),sample("2026-09",20)],asOf).status,"unavailable");
  assert.equal(buildDashboardPace([sample("2026-09",10)],asOf,1).status,"unavailable");
});

test("D1-V11 25-source-month canonical fixture maps exactly to 24 displayed UTC months",()=>{
  const monthKeys=Array.from({length:25},(_,i)=>{
    const date=new Date(Date.UTC(2024,9+i,1));
    return date.toISOString().slice(0,7);
  });
  const canonicalMonthly=monthKeys.map((month,i)=>{
    const ull=i===1?0:i*5,easa=i===1?0:i*7;
    return {month,total:ull+easa,ull,easa};
  });
  const result=buildDashboardPace([
    {month:"2024-09",total:9000,ull:4000,easa:5000},
    ...canonicalMonthly,
  ],asOf);
  assert.equal(result.status,"available");
  assert.deepEqual(result.months,canonicalMonthly.slice(1),
    "plot must preserve exactly the source aggregation for 24 visible months");
  for(const category of ["total","ull","easa"] as const){
    assert.equal(result.comparisons?.[category].previousMinutes,
      canonicalMonthly.slice(0,12).reduce((sum,row)=>sum+row[category],0));
    assert.equal(result.comparisons?.[category].currentMinutes,
      canonicalMonthly.slice(12,24).reduce((sum,row)=>sum+row[category],0));
  }
  assert.equal(result.months[0].total,0,"valid in-window zero-minute month is preserved");
  assert.equal(result.months.at(-1)?.month,"2026-10","current partial month is plotted, not compared");
});

test("D1-V11 opt-in preview preserves the legacy preference editor and protected routes",()=>{
  const page=read("app/(protected)/dashboard/page.tsx"),editorial=read("components/dashboard-editorial.tsx"),pace=read("components/dashboard-pace.tsx"),css=read("app/dashboard-editorial.css"),layout=read("app/layout.tsx");
  assert.match(page,/params\.view==="v11"/);
  assert.match(page,/DashboardEditor layout=\{layout\}/);
  assert.match(page,/dashboardLayoutFromPreferences\(preferences\)/);
  assert.match(page,/href="\/dashboard"/);
  assert.match(page,/href="\/flights\/new"/);
  assert.match(editorial,/href="\/credentials"/);
  assert.match(editorial,/href="\/flights\/needs-attention"/);
  assert.match(editorial,/href="\/actions"/);
  assert.match(editorial,/d1v11-latest/);
  assert.doesNotMatch(editorial,/SAVED SNAPSHOT|Historical snapshot|Saved result:/,"avoid redundant historical snapshot labels");
  assert.match(editorial,/Last check: OK/,"green is historical, not current");
  assert.match(editorial,/Last check: Due soon/,"warning must not claim current expiry");
  assert.match(editorial,/Last check: Needs review/,"ambiguous attention must never be labelled Not current");
  assert.match(editorial,/Not assessed/,"missing evidence must remain neutral");
  assert.doesNotMatch(editorial,/Verify before flight|Check recency <span|Saved result:/,"no duplicate explanatory or button copy");
  assert.match(editorial,/formatDateOnly\(recencySnapshot\.generatedAt\.slice\(0,10\)\)/,"timestamp of previous assessment must remain visible");
  assert.match(editorial,/<Link className="d1v11-recency-primary" href="\/credentials">/,"whole status block is the sole action");
  assert.match(css,/\.d1v11-recency-primary\{display:grid;/,"compact status area is touchable");
  assert.match(css,/min-height:112px/,"primary Recency area must have a large touch target");
  assert.doesNotMatch(editorial,/Saved \$\{formatDateOnly|Check your licences and recency evidence/,"no duplicate explanatory copy");
  assert.match(editorial,/d1v11-recency-marker/,"status is identifiable without relying on color alone");
  assert.doesNotMatch(editorial,/recencyHeadline=.*Not current/,"attention is not proof of NOT CURRENT");
  assert.match(css,/\.d1v11-recency--ok\{--d1v11-recency-tone:var\(--success-text\)/);
  assert.match(css,/\.d1v11-recency--warning\{--d1v11-recency-tone:var\(--warning-text\)/);
  assert.match(css,/\.d1v11-recency--review\{--d1v11-recency-tone:var\(--danger-text\)/);
  assert.match(css,/\.d1v11-recency--unknown\{--d1v11-recency-tone:var\(--muted\)/);
  assert.ok(layout.indexOf('import "./dashboard-editorial.css"')<layout.indexOf('import "./ui-system.css"'),
    "ui-system.css must remain the final canonical stylesheet");
  assert.match(pace,/role="slider"/);
  assert.match(pace,/aria-valuetext/);
  assert.match(css,/@media\(max-width:610px\)/);
});
