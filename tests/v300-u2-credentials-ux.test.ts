import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root=path.resolve(import.meta.dirname,"..");
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");

test("v3.0 U2 keeps the top level to Overview, Recency and Records",()=>{
  const nav=read("components/credentials-navigation.tsx");
  const hub=read("app/(protected)/credentials/records-hub.tsx");
  assert.match(nav,/\["overview","Overview"\]/);
  assert.match(nav,/\["recency","Recency"\]/);
  assert.match(nav,/\["records","Records"\]/);
  assert.match(nav,/Licences & ratings/);
  assert.match(nav,/Medical & documents/);
  assert.match(nav,/Aircraft training/);
  assert.match(hub,/Manage pilot records/);
});

test("v3.0 U2 overview is status and action only",()=>{
  const page=read("app/(protected)/credentials/page.tsx");
  const overview=read("app/(protected)/credentials/adaptive-overview.tsx");
  assert.match(page,/return <AdaptivePilotOverview\/>/);
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

test("v3.0 U2 keeps detailed evidence and editors one level deeper",()=>{
  const workspace=read("components/recency-compliance-workspace.tsx");
  const legacy=read("app/(protected)/credentials/legacy-page.tsx");
  for(const panel of ["RecencyPanel","SplRecencyPanel","HelicopterRecencyPanel","BalloonRecencyPanel"])assert.match(workspace,new RegExp(`<${panel}`));
  assert.match(legacy,/CredentialsRecordsNav/);
  assert.match(legacy,/view==="licences"/);
  assert.match(legacy,/view==="documents"/);
  assert.match(legacy,/view==="training"/);
});

test("v3.0 U2 ships dedicated responsive presentation",()=>{
  const layout=read("app/layout.tsx");
  const css=read("app/v300-u2-credentials.css");
  assert.match(layout,/v300-u2-credentials\.css/);
  assert.match(css,/credentials-subtabs/);
  assert.match(css,/records-hub-grid/);
  assert.match(css,/u2-status-hero/);
  assert.match(css,/@media\(max-width:560px\)/);
});
