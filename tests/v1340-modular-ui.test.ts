import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { dashboardLayoutFromPreferences,DASHBOARD_PRESETS,DASHBOARD_WIDGETS } from "../lib/dashboard-widgets.ts";
import { normalizeAppearance } from "../lib/ui-preferences.ts";

const root=path.resolve(import.meta.dirname,"..");
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");
const releaseAtLeast=(current:string,target:string)=>{const a=current.split(".").map(Number),b=target.split(".").map(Number);for(let i=0;i<3;i++){if((a[i]||0)>(b[i]||0))return true;if((a[i]||0)<(b[i]||0))return false}return true};

test("v1.34.0 introduces a validated dashboard widget registry without changing default visibility",()=>{
  assert.ok(releaseAtLeast(JSON.parse(read("package.json")).version,"1.34.0"));
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
    {id:"aircraft-costs",enabled:false,size:"medium"},
    {id:"aircraft-costs",enabled:true,size:"wide"},
    {id:"unknown",enabled:true},
    {id:"monthly-activity",size:"nonsense"},
  ]});
  assert.equal(layout.filter(item=>item.id==="aircraft-costs").length,1);
  assert.equal(layout.find(item=>item.id==="aircraft-costs")?.enabled,false);
  assert.equal(layout.find(item=>item.id==="aircraft-costs")?.size,"medium");
  assert.equal(layout.find(item=>item.id==="monthly-activity")?.size,"wide");
  assert.ok(layout.some(item=>item.id==="total-time"));
});

test("appearance contract is System/Dark/Light and is wired through settings, protected shell and shared CSS",()=>{
  assert.equal(normalizeAppearance("LIGHT"),"light");
  assert.equal(normalizeAppearance("nope"),"system");
  const rootLayout=read("app/layout.tsx"),protectedLayout=read("app/(protected)/layout.tsx"),shell=read("components/app-shell.tsx"),profile=read("app/(protected)/profile/page.tsx"),action=read("app/(protected)/profile/appearance-actions.ts"),theme=read("app/theme.css"),uiSystem=read("app/v150-ui-system.css");
  assert.match(rootLayout,/theme[.]css/);
  assert.match(protectedLayout,/appearanceFromPreferences/);
  assert.match(shell,/ThemeManager/);
  assert.match(profile,/System|APPEARANCE_OPTIONS/);
  assert.match(action,/preferences_json/);
  assert.match(theme,/data-theme="light"/);
  assert.match(uiSystem,/--bg:#f4f7fb/);
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
  const theme=read("app/theme.css"),uiSystem=read("app/v150-ui-system.css");
  assert.match(uiSystem,/--surface:#ffffff/);
  assert.match(uiSystem,/--border:#d5dee8/);
  assert.match(theme,/\.dashboard-chart-v3\{background:var\(--surface\)\}/);
  assert.match(theme,/\.chart-summary>span\{background:var\(--surface-raised\)/);
  assert.match(theme,/\.chart-focus\{background:#f4f9fb/);
  assert.match(theme,/\.credential-card\{background:var\(--surface\);border-color:var\(--line\)\}/);
  assert.match(theme,/\.entry-section,/);
  assert.match(theme,/\.flight-review-card\{background:var\(--surface\)/);
  assert.match(theme,/\.add-aircraft-card,\s*html\[data-theme="light"\] \.aircraft-card\{background:var\(--surface\);border-color:var\(--line\)\}/);
  assert.match(theme,/\.data-hub-nav\{background:#fffffff2/);
  assert.match(theme,/\.sidebar nav\{background:var\(--surface-raised\)/);
  assert.match(theme,/\.entry-progress\{background:var\(--surface-raised\);border-color:var\(--line\)\}/);
  assert.match(theme,/\.connection-search-result,\s*html\[data-theme="light"\] \.connection-card\{background:var\(--surface\)/);
  assert.match(theme,/\.security-grid>section,/);
  assert.match(theme,/\.session-list>div,/);
  assert.match(theme,/\.invite-list>div\{background:var\(--surface\);color:var\(--text\);border-color:var\(--line\)\}/);
  assert.match(theme,/\.security-panel>summary\{color:var\(--text\)\}/);
});
