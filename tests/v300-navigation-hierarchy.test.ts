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

test("v3.0 historical UX evidence is archived while numeric roadmap owns current priority",()=>{
  const roadmap=read("ROADMAP.md");
  const legacy=read("docs/history/ROADMAP_PRE_NUMERIC_2026-10-04.md");
  const audit=read("docs/product/V3_0_UX_CONSOLIDATION.md");

  assert.match(roadmap,/## Canonical release sequence/);
  assert.match(roadmap,/\| 1 \| \*\*3\.4\.0\*\* \| Flight Entry Simplification \| ✅ \|/);
  assert.match(roadmap,/\| 2 \| \*\*3\.4\.1\*\* \| GPS Night-time reliability \| ✅ \|/);
  assert.match(roadmap,/\| 3 \| \*\*3\.5\.0\*\* \| Certified flight voiding \+ multi-aircraft integrity audit \| ✅ \|/);
  assert.match(roadmap,/\| 4 \| \*\*3\.5\.1\*\* \| GPS T&G false-positive containment \| ✅ \|/);
  assert.match(roadmap,/\| 5 \| \*\*3\.5\.2\*\* \| Always-on GPS\/SERA Night suggestions \| ✅ \|/);
  assert.match(roadmap,/\| 6 \| \*\*3\.5\.3\*\* \| Flight detail navigation UX \| ✅ \|/);
  assert.match(roadmap,/\| 7 \| \*\*3\.5\.4\*\* \| iPad flight-detail visual hotfix \| ✅ \|/);
  assert.match(roadmap,/\| 8 \| \*\*3\.5\.5\*\* \| iPad sidebar collapse-control alignment \| ✅ \|/);
  assert.match(roadmap,/\| 9 \| \*\*3\.6\.0\*\* \| Saved-date \/ timezone semantics · #144 \| ✅ \|/);
  // 3.7.0 was explicitly reprioritized to Maps; the Currency contract survives at 3.8.0.
  assert.match(roadmap,/\| 10 \| \*\*3\.7\.0\*\* \| Maps & Aviation Layers \| 🚧 \|/);
  assert.match(roadmap,/\| 11 \| \*\*3\.8\.0\*\* \| Currency \/ monetary semantics · #136 \| ➡️ \|/);
  assert.match(roadmap,/# 3\.4\.1 — GPS Night-time reliability — DONE/);
  assert.match(roadmap,/# 3\.4\.0 — Flight Entry Simplification — DONE/);
  assert.match(roadmap,/docs\/history\/ROADMAP_PRE_NUMERIC_2026-10-04\.md/);

  assert.match(legacy,/\| UX & design consistency \| ✅ \|/);
  assert.match(legacy,/\| GPS touch-and-go detection reliability \| ✅ \|/);
  assert.match(legacy,/\| Safety Pilot ↔ PIC shared-flight workflow \| ✅ \|/);
  assert.match(legacy,/\| Flight Entry Workflow 3\.0 \| ✅ \|/);

  assert.match(audit,/U0 ✅ Product UX audit/);
  assert.match(audit,/U1 ✅ Navigation & task hierarchy/);
  assert.match(audit,/U2 ✅ Licences & recency/);
  assert.match(audit,/U3 ✅ Aircraft \/ Data \/ Settings/);
  assert.match(audit,/U3\.1 ✅ Aircraft & airports/);
  assert.match(audit,/U3\.2 ✅ Print & data/);
  assert.match(audit,/U3\.3 ✅ Settings/);
  assert.match(audit,/U4 ✅ Flight workflow clarity/);
  assert.match(audit,/U5 ✅ Training learner polish/);
  assert.match(audit,/U6 ✅ Mobile, accessibility and final UX acceptance/);
});
