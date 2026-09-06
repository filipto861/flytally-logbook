import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { DASHBOARD_OVERVIEW_WIDGET_IDS,dashboardOverviewLayoutFromPreferences,defaultDashboardOverviewLayout } from "../lib/dashboard-widgets.ts";

const root=path.resolve(import.meta.dirname,"..");
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");
const overviewIds=new Set<string>(DASHBOARD_OVERVIEW_WIDGET_IDS);

test("v1.70 dashboard exposes only at-a-glance widgets",()=>{
  const defaults=defaultDashboardOverviewLayout();
  assert.deepEqual(defaults.map(item=>item.id),["total-time","ull-time","easa-time","last-flight","gps-tracks"]);
  assert.equal(defaults.find(item=>item.id==="gps-tracks")?.enabled,false);
  for(const id of defaults.map(item=>item.id))assert.ok(overviewIds.has(id));
});

test("v1.70 migrates historical dashboard preferences without showing analytics twice",()=>{
  const layout=dashboardOverviewLayoutFromPreferences({dashboard_widgets:[
    {id:"monthly-activity",enabled:true,size:"wide"},
    {id:"statistics",enabled:true,size:"wide"},
    {id:"aircraft-costs",enabled:true,size:"wide"},
    {id:"airports",enabled:true,size:"medium"},
    {id:"total-time",enabled:false,size:"hero"},
    {id:"last-flight",enabled:false,size:"medium"},
  ]});
  assert.ok(layout.some(item=>item.enabled),"legacy analytics-only layouts must not create an empty Dashboard");
  assert.ok(layout.every(item=>overviewIds.has(item.id)));
  assert.equal(layout.some(item=>["monthly-activity","statistics","aircraft-costs","airports"].includes(item.id)),false);
});

test("v1.70 dashboard is action-oriented and hands historical analysis to Statistics",()=>{
  const page=read("app/(protected)/dashboard/page.tsx");
  assert.match(page,/<h1>At a glance<\/h1>/);
  assert.match(page,/Trends and detailed breakdowns live in Statistics/);
  assert.match(page,/QUICK ACTIONS/);
  assert.match(page,/href="\/flights\/needs-attention"/);
  assert.match(page,/\/statistics\?period=/);
  assert.match(page,/href="\/data"/);
  assert.doesNotMatch(page,/import \{ MonthlyChart \}/);
  assert.doesNotMatch(page,/import \{ DashboardDetails \}/);
});

test("v1.70 keeps old dashboard detail links useful through Statistics or Flights",()=>{
  const page=read("app/(protected)/dashboard/page.tsx");
  assert.match(page,/aircraft:\{label:"Aircraft & costs · Average cost \/ h",section:"aircraft"\}/);
  assert.match(page,/airports:\{label:"Visited airports",section:"places"\}/);
  assert.match(page,/routes:\{label:"Flown routes",section:"places"\}/);
  assert.match(page,/recent:\{label:"Recent flights",section:"flights"\}/);
  assert.match(page,/redirect\(`\/statistics\?period=/);
  assert.match(page,/redirect\("\/flights"\)/);
});

test("v1.70 dashboard customization cannot re-add analytical duplicates",()=>{
  const editor=read("components/dashboard-editor.tsx");
  assert.match(editor,/DASHBOARD_OVERVIEW_WIDGET_IDS/);
  assert.match(editor,/dashboardPresetLayout\(preset\)\.filter/);
  assert.match(editor,/defaultDashboardOverviewLayout/);
  assert.match(editor,/Detailed analytics stay in Statistics/);
});

test("v1.70 navigation visually separates Dashboard and Statistics",()=>{
  const sidebar=read("components/sidebar.tsx"),icons=read("components/nav-icon.tsx"),statistics=read("app/(protected)/statistics/page.tsx");
  assert.match(sidebar,/href:"\/dashboard",icon:"dashboard",label:"Dashboard"/);
  assert.match(sidebar,/href:"\/statistics",icon:"statistics",label:"Statistics"/);
  assert.match(icons,/statistics:/);
  assert.match(statistics,/const sections=\[\["overview","Overview"\],\["experience","Experience"\],\["aircraft","Aircraft"\],\["places","Airports & routes"\]\]/);
  assert.match(statistics,/PilotInsightsChart/);
});
