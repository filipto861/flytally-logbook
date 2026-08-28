import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { dashboardLayoutFromPreferences,dashboardPresetLayout,DASHBOARD_WIDGETS } from "../lib/dashboard-widgets.ts";

const root=path.resolve(import.meta.dirname,"..");
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");

test("v1.34.1 enables per-user dashboard visibility, order, sizes and presets",()=>{
  assert.equal(JSON.parse(read("package.json")).version,"1.34.1");
  const general=dashboardPresetLayout("general"),ull=dashboardPresetLayout("ull"),instructor=dashboardPresetLayout("instructor");
  assert.equal(general.length,DASHBOARD_WIDGETS.length);
  assert.ok(general.every(item=>item.enabled));
  assert.equal(ull.find(item=>item.id==="easa-time")?.enabled,false);
  assert.equal(ull.find(item=>item.id==="ull-time")?.enabled,true);
  assert.equal(instructor.find(item=>item.id==="ull-time")?.enabled,false);
  assert.equal(instructor.find(item=>item.id==="statistics")?.enabled,true);
});

test("dashboard parser migrates v1.34 cost and aircraft widgets into one combined widget",()=>{
  const layout=dashboardLayoutFromPreferences({dashboard_widgets:[
    {id:"total-time",enabled:true,size:"hero"},
    {id:"cost",enabled:false,size:"wide"},
    {id:"aircraft",enabled:true,size:"small"},
    {id:"airports",enabled:true,size:"hero"},
  ]});
  const combined=layout.find(item=>item.id==="aircraft-costs");
  assert.ok(combined);
  assert.equal(combined.enabled,true);
  assert.equal(combined.size,"wide");
  assert.equal(layout.some(item=>(item.id as string)==="cost"||(item.id as string)==="aircraft"),false);
  assert.equal(layout.find(item=>item.id==="airports")?.size,"small");
});

test("dashboard editor is wired to a user-scoped server action and responsive 12-column renderer",()=>{
  const page=read("app/(protected)/dashboard/page.tsx"),editor=read("components/dashboard-editor.tsx"),action=read("app/(protected)/dashboard/actions.ts"),css=read("app/dashboard-customization.css"),layout=read("app/layout.tsx");
  assert.match(page,/DashboardEditor layout=\{layout\}/);
  assert.ok(page.indexOf("dashboard-layout-grid")<page.lastIndexOf("<DashboardEditor layout={layout}/>"));
  assert.match(page,/layout\.filter\(item=>item\.enabled\)\.map/);
  assert.match(page,/Aircraft & costs/);
  assert.match(editor,/dashboardPresetLayout/);
  assert.match(editor,/<summary>Customize dashboard<\/summary>/);
  assert.match(editor,/Move \$\{definition\.label\} up/);
  assert.match(editor,/Reset to default/);
  assert.match(action,/requireUser/);
  assert.match(action,/dashboard_widgets:layout/);
  assert.match(action,/Keep at least one widget visible/);
  assert.match(css,/\.dashboard-editor>summary\{[^}]*font-size:\.66rem/);
  assert.match(css,/grid-template-columns:repeat\(12,minmax\(0,1fr\)\)/);
  assert.match(css,/@media\(max-width:760px\)/);
  assert.match(layout,/dashboard-customization[.]css/);
});
