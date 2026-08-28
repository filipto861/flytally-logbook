import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { dashboardLayoutFromPreferences,DASHBOARD_PRESETS,DASHBOARD_WIDGETS } from "../lib/dashboard-widgets.ts";
import { normalizeAppearance } from "../lib/ui-preferences.ts";

const root=path.resolve(import.meta.dirname,"..");
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");

test("v1.34.0 introduces a validated dashboard widget registry without changing default visibility",()=>{
  assert.equal(JSON.parse(read("package.json")).version,"1.34.0");
  assert.equal(new Set(DASHBOARD_WIDGETS.map(widget=>widget.id)).size,DASHBOARD_WIDGETS.length);
  const layout=dashboardLayoutFromPreferences({});
  assert.equal(layout.length,DASHBOARD_WIDGETS.length);
  assert.ok(layout.every(item=>item.enabled));
  assert.ok(DASHBOARD_PRESETS.general.includes("total-time"));
  assert.ok(DASHBOARD_PRESETS.instructor.includes("statistics"));
  assert.ok(DASHBOARD_PRESETS.ull.includes("ull-time"));
});

test("dashboard preference parser rejects unknown/duplicate widgets and preserves future missing defaults",()=>{
  const layout=dashboardLayoutFromPreferences({dashboard_widgets:[
    {id:"cost",enabled:false,size:"wide"},
    {id:"cost",enabled:true,size:"hero"},
    {id:"unknown",enabled:true},
    {id:"monthly-activity",size:"nonsense"},
  ]});
  assert.equal(layout.filter(item=>item.id==="cost").length,1);
  assert.equal(layout.find(item=>item.id==="cost")?.enabled,false);
  assert.equal(layout.find(item=>item.id==="cost")?.size,"wide");
  assert.equal(layout.find(item=>item.id==="monthly-activity")?.size,"wide");
  assert.ok(layout.some(item=>item.id==="total-time"));
});

test("appearance contract is System/Dark/Light and is wired through settings, protected shell and shared CSS",()=>{
  assert.equal(normalizeAppearance("LIGHT"),"light");
  assert.equal(normalizeAppearance("nope"),"system");
  const rootLayout=read("app/layout.tsx"),protectedLayout=read("app/(protected)/layout.tsx"),shell=read("components/app-shell.tsx"),profile=read("app/(protected)/profile/page.tsx"),action=read("app/(protected)/profile/appearance-actions.ts"),theme=read("app/theme.css");
  assert.match(rootLayout,/theme[.]css/);
  assert.match(protectedLayout,/appearanceFromPreferences/);
  assert.match(shell,/ThemeManager/);
  assert.match(profile,/System|APPEARANCE_OPTIONS/);
  assert.match(action,/preferences_json/);
  assert.match(theme,/data-theme="light"/);
  assert.match(theme,/--bg:#f4f7fb/);
});

test("dashboard renders registered widget boundaries and maps follow the resolved theme",()=>{
  const dashboard=read("app/(protected)/dashboard/page.tsx"),map=read("components/leaflet-mobile.ts");
  assert.match(dashboard,/dashboardLayoutFromPreferences/);
  assert.match(dashboard,/data-dashboard-widget/);
  assert.match(map,/MutationObserver/);
  assert.match(map,/dataset[.]theme/);
  assert.match(map,/DARK_TILE_FILTER/);
});

test("light appearance overrides legacy dark workspace surfaces across the application",()=>{
  const theme=read("app/theme.css");
  assert.match(theme,/--surface:#ffffff/);
  assert.match(theme,/--border:#d5dee8/);
  assert.match(theme,/\.dashboard-chart-v3\{background:#fff\}/);
  assert.match(theme,/\.chart-summary>span\{background:#f8fafc/);
  assert.match(theme,/\.chart-focus\{background:#f4f9fb/);
  assert.match(theme,/\.credential-card\{background:#fff/);
  assert.match(theme,/\.entry-section,/);
  assert.match(theme,/\.flight-review-card\{background:#fff/);
  assert.match(theme,/\.aircraft-card\{background:#fff/);
  assert.match(theme,/\.data-hub-nav\{background:#fffffff2/);
  assert.match(theme,/\.sidebar nav\{background:#f8fafc/);
});
