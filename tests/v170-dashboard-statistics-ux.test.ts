import assert from "node:assert/strict";
import test from "node:test";
import { DASHBOARD_OVERVIEW_WIDGET_IDS,dashboardOverviewLayoutFromPreferences,defaultDashboardOverviewLayout } from "../lib/dashboard-widgets.ts";

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
