import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root=path.resolve(import.meta.dirname,"..");
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");

test("v3.0 U1 keeps global Logbook navigation task-oriented",()=>{
  const sidebar=read("components/sidebar.tsx");
  assert.match(sidebar,/label:"Dashboard"/);
  assert.match(sidebar,/label:"Flights"/);
  assert.match(sidebar,/label:"Map"/);
  assert.match(sidebar,/label:"Statistics"/);
  assert.match(sidebar,/className=\{styles\.primaryAction\} href="\/flights\/new"/);
  const mainStart=sidebar.indexOf("const mainLinks=[");
  const mainEnd=sidebar.indexOf("] as const;",mainStart);
  const main=sidebar.slice(mainStart,mainEnd);
  assert.doesNotMatch(main,/\/flights\/needs-attention/);
  assert.doesNotMatch(main,/\/fstd/);
  assert.match(sidebar,/Pilot & records/);
  assert.match(sidebar,/Licences & recency/);
});

test("v3.0 U1 makes Flights own its contextual record destinations",()=>{
  const nav=read("components/flight-workspace-nav.tsx");
  const flights=read("app/(protected)/flights/page.tsx");
  const attention=read("app/(protected)/flights/needs-attention/page.tsx");
  const fstd=read("app/(protected)/fstd/page.tsx");
  assert.match(nav,/All flights/);
  assert.match(nav,/Needs attention/);
  assert.match(nav,/FSTD sessions/);
  assert.match(flights,/FlightWorkspaceNav active="flights"/);
  assert.match(attention,/FlightWorkspaceNav active="attention"/);
  assert.match(fstd,/FlightWorkspaceNav active="fstd"/);
});

test("v3.0 U1 rolls flight attention into the Flights destination",()=>{
  const sidebar=read("components/sidebar.tsx");
  assert.match(sidebar,/flights&&attentionCount>0/);
  assert.match(sidebar,/flights need attention/);
  assert.match(sidebar,/pathname\.startsWith\("\/flights\/"\)/);
});

test("v3.0 roadmap prioritizes UX consolidation before multi-aircraft scale",()=>{
  const roadmap=read("ROADMAP.md");
  const audit=read("docs/product/V3_0_UX_CONSOLIDATION.md");
  assert.match(roadmap,/v3\.0 — UX & Product Consolidation — current/);
  assert.match(roadmap,/v3\.1 — Multi-aircraft Product Scale/);
  assert.match(audit,/U0 ✅ Product UX audit/);
  assert.match(audit,/U1 ✅ Navigation & task hierarchy/);
  assert.match(audit,/U2 ✅ Licences & recency/);
  assert.match(audit,/U3 ✅ Aircraft \/ Data \/ Settings/);
  assert.match(audit,/U3\.1 ✅ Aircraft & airports/);
  assert.match(audit,/U3\.2 ✅ Print & data/);
  assert.match(audit,/U3\.3 ✅ Settings/);
  assert.match(audit,/U4 ✅ Flight workflow clarity/);
  assert.match(audit,/U5 — Training learner polish — next/);
});
