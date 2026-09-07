import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root=path.resolve(import.meta.dirname,"..");
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");

test("v2.1 keeps Dashboard a stable at-a-glance home instead of a period analytics view",()=>{
  const page=read("app/(protected)/dashboard/page.tsx");
  assert.match(page,/getDashboardOverviewData\(session\.userId,"all"\)/);
  assert.doesNotMatch(page,/aria-label="Dashboard period"/);
  assert.doesNotMatch(page,/href={`\/dashboard\?period=/);
  assert.match(page,/your all-time flying snapshot/);
  assert.match(page,/href="\/statistics\?period=all&section=overview"/);
});

test("v2.1 preserves legacy dashboard period and detail URLs by handing them to Statistics",()=>{
  const page=read("app/(protected)/dashboard/page.tsx");
  assert.match(page,/isLegacyPeriod/);
  assert.match(page,/params\.period&&isLegacyPeriod\(requestedPeriod\)/);
  assert.match(page,/redirect\(`\/statistics\?period=\$\{encodeURIComponent\(legacyPeriod\)\}&section=overview`\)/);
  assert.match(page,/section:\"aircraft\"/);
  assert.match(page,/section:\"places\"/);
});

test("v2.1 keeps the v1.70 saved-layout migration contract intact",()=>{
  const page=read("app/(protected)/dashboard/page.tsx"),widgets=read("lib/dashboard-widgets.ts");
  assert.match(page,/dashboardLayoutFromPreferences\(preferences\)/);
  assert.match(page,/dashboardOverviewLayout\(savedLayout\)/);
  assert.match(widgets,/DASHBOARD_OVERVIEW_WIDGET_IDS=\["total-time","ull-time","easa-time","last-flight","gps-tracks"\]/);
});

test("v2.1 gives Career its own Statistics workspace and removes misleading period controls there",()=>{
  const page=read("app/(protected)/statistics/page.tsx");
  assert.match(page,/\["career","Career"\]/);
  assert.match(page,/section!=="career"\?<div className="period-control" aria-label="Statistics period"/);
  assert.match(page,/section==="career"\?<section className="panel">/);
  assert.equal((page.match(/<h2>Career snapshot<\/h2>/g)??[]).length,1);
  assert.match(page,/Period filters do not apply to Career/);
  assert.match(page,/data\.career\.minutes/);
  assert.match(page,/data\.career\.busiestYear/);
});
