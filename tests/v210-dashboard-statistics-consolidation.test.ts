import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root=path.resolve(import.meta.dirname,"..");
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");

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
