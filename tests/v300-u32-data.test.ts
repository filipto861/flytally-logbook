import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root=path.resolve(import.meta.dirname,"..");
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");

test("v3.0 U3.2 exposes durable Print & export, Backup & restore and Deleted flights workspaces",()=>{
  const nav=read("components/data-workspace-navigation.tsx"),page=read("app/(protected)/data/page.tsx"),hub=read("components/data-hub.tsx");
  assert.match(nav,/id:"export",label:"Print & export"/);
  assert.match(nav,/id:"recovery",label:"Backup & restore"/);
  assert.match(nav,/id:"deleted",label:"Deleted flights"/);
  assert.match(page,/resolveView=.*"export"/);
  assert.match(hub,/view==="recovery"/);
  assert.match(hub,/view==="deleted"/);
  assert.doesNotMatch(hub,/useState/);
});

test("v3.0 U3.2 loads recovery and deleted-flight data only when needed",()=>{
  const page=read("app/(protected)/data/page.tsx");
  assert.match(page,/if\(view==="recovery"\)\{await ensureDailyBackup\(userId\);backups=await listStoredBackups\(userId\)\}/);
  assert.match(page,/if\(view==="deleted"\)deletedFlights=await listDeletedFlights\(userId\)/);
  const before=page.slice(0,page.indexOf('if(view==="recovery")'));
  assert.doesNotMatch(before,/ensureDailyBackup\(userId\).*listStoredBackups\(userId\).*listDeletedFlights\(userId\)/s);
});

test("v3.0 U3.2 keeps portable backup with recovery instead of ordinary flight export",()=>{
  const hub=read("components/data-hub.tsx");
  const recovery=hub.slice(hub.indexOf('if(view==="recovery")'),hub.indexOf('if(view==="deleted")'));
  const exportBlock=hub.slice(hub.indexOf('return <main className="u32-data-workspace">'));
  assert.match(recovery,/Download JSON backup/);
  assert.match(recovery,/\/api\/export\?format=json/);
  assert.match(exportBlock,/Open printable logbook/);
  assert.match(exportBlock,/Download Excel/);
  assert.match(exportBlock,/Download CSV/);
  assert.doesNotMatch(exportBlock,/Complete JSON backup/);
});

test("v3.0 U3.2 preserves print/export semantics behind a simpler presentation",()=>{
  const hub=read("components/data-hub.tsx");
  assert.match(hub,/action="\/print"/);
  assert.match(hub,/action="\/api\/export"/);
  assert.ok((hub.match(/LOGBOOK_PRINT_SCOPES\.map/g)||[]).length>=2);
  assert.match(hub,/CSV contains filtered flight rows only/);
  assert.match(hub,/FCL\.050 view/);
  assert.match(hub,/Output details/);
  assert.match(hub,/Excel vs CSV/);
});

test("v3.0 U3.2 has responsive and light-theme presentation",()=>{
  const layout=read("app/layout.tsx"),css=read("app/v300-u32-data.css"),roadmap=read("ROADMAP.md"),audit=read("docs/product/V3_0_UX_CONSOLIDATION.md");
  assert.match(layout,/v300-u32-data\.css/);
  assert.match(css,/data-workspace-nav/);
  assert.match(css,/u32-recovery-grid/);
  assert.match(css,/html\[data-theme="light"\] \.data-workspace-nav/);
  assert.match(css,/@media\(max-width:620px\)/);
  assert.match(roadmap,/U3\.2 ✅ Print & data task hierarchy/);
  assert.match(roadmap,/U3\.3 ✅ Settings hierarchy/);
  assert.match(roadmap,/U4 next: flight save/);
  assert.match(audit,/U3\.2 ✅ Print & data/);
});
