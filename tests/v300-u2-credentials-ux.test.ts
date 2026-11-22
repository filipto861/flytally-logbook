import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root=path.resolve(import.meta.dirname,"..");
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");

test("v3.0 U2 overview is status and action only",()=>{
  const page=read("app/(protected)/credentials/page.tsx");
  const overview=read("app/(protected)/credentials/adaptive-overview.tsx");
  assert.match(page,/<AdaptivePilotOverview\/>/);
  assert.doesNotMatch(page,/ProfessionalExperiencePanel/);
  assert.match(overview,/getRecencyComplianceWorkspaceForUser/);
  assert.match(overview,/attention=state\.items\.filter\(item=>item\.status!=="current"\)/);
  assert.match(overview,/Everything recorded looks current/);
  assert.match(overview,/Review these items/);
  assert.doesNotMatch(overview,/form action=/);
});

test("v3.0 U2 separates recency from credential administration",()=>{
  const workspace=read("components/recency-compliance-workspace.tsx");
  assert.match(workspace,/flyingItems=state\.items\.filter\(item=>item\.kind==="recency"\|\|item\.kind==="setup"\)/);
  assert.match(workspace,/attention=flyingItems\.filter\(item=>item\.status!=="current"\)/);
  assert.match(workspace,/Evidence & settings/);
  assert.doesNotMatch(workspace,/compliance-scorecard/);
  assert.doesNotMatch(workspace,/compliance-credential-summary/);
  assert.doesNotMatch(workspace,/credentialAttention/);
});
