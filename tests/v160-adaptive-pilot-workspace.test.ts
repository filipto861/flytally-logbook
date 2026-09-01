import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { pilotWorkspaceCategory,sortPilotWorkspaceItems,validityTone,type PilotWorkspaceItem } from "../lib/pilot-workspace.ts";

const root=path.resolve(import.meta.dirname,"..");
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");

test("v1.60 categorises pilot workspace items without deciding regulatory eligibility",()=>{
  assert.equal(pilotWorkspaceCategory("LAPL(A)"),"aeroplane");
  assert.equal(pilotWorkspaceCategory("SEP"),"aeroplane");
  assert.equal(pilotWorkspaceCategory("ULL"),"ull");
  assert.equal(pilotWorkspaceCategory("SPL"),"sailplane");
  assert.equal(pilotWorkspaceCategory("BPL"),"balloon");
  assert.equal(pilotWorkspaceCategory("PPL(H)"),"helicopter");
  assert.equal(pilotWorkspaceCategory("custom"),"other");
});

test("v1.60 keeps attention prominent while leaving legal calculations outside the presentation layer",()=>{
  assert.equal(validityTone("valid"),"current");
  assert.equal(validityTone("warning"),"review");
  assert.equal(validityTone("expired"),"attention");
  const items:PilotWorkspaceItem[]=[
    {id:"a",kind:"licence",category:"aeroplane",label:"A",statusLabel:"VALID",tone:"current",href:"/a"},
    {id:"b",kind:"document",category:"other",label:"B",statusLabel:"EXPIRED",tone:"attention",href:"/b"},
  ];
  assert.equal(sortPilotWorkspaceItems(items)[0].id,"b");
  const model=read("lib/pilot-workspace.ts");
  assert.doesNotMatch(model,/FCL[.]140|FCL[.]060|flightMinutes|certified_at|sql`/);
});

test("v1.60 Overview is adaptive and delegates authoritative LAPL recency to the existing engine",()=>{
  const page=read("app/(protected)/credentials/page.tsx"),overview=read("app/(protected)/credentials/adaptive-overview.tsx"),legacy=read("app/(protected)/credentials/legacy-page.tsx");
  assert.match(page,/AdaptivePilotOverview/);
  assert.match(page,/LegacyCredentialsPage/);
  assert.match(overview,/getRecencyStateForUser/);
  assert.match(overview,/lapl-a-fcl140a/);
  assert.match(overview,/Licence validity/);
  assert.match(overview,/Flying privilege/);
  assert.match(overview,/Open a section above for details/);
  assert.match(overview,/What matters now/);
  assert.doesNotMatch(overview,/Under CAA|regulation requires|FCL[.]035/);
  assert.match(legacy,/view==="recency"\?<RecencyPanel/);
});

test("v1.60 preserves the detailed credential workspace and is read-only at the new Overview layer",()=>{
  for(const file of ["app/(protected)/credentials/legacy-page.tsx","app/(protected)/credentials/adaptive-overview.tsx","lib/pilot-workspace.ts","app/v160-adaptive-pilot-workspace.css"]){assert.ok(fs.existsSync(path.join(root,file)),`${file} must exist`)}
  const overview=read("app/(protected)/credentials/adaptive-overview.tsx");
  assert.doesNotMatch(overview,/\bINSERT\b|\bUPDATE\b|\bDELETE\b/i);
  assert.match(read("app/layout.tsx"),/v160-adaptive-pilot-workspace[.]css/);
});
