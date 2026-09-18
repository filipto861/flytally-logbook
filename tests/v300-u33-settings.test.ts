import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root=path.resolve(import.meta.dirname,"..");
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");

test("v3.0 U3.3 separates General, Account & security and Privacy settings workspaces",()=>{
  const nav=read("components/settings-workspace-navigation.tsx"),page=read("app/(protected)/profile/page.tsx");
  assert.match(nav,/id:"general",label:"General"/);
  assert.match(nav,/id:"account",label:"Account & security"/);
  assert.match(nav,/id:"privacy",label:"Privacy"/);
  assert.match(nav,/aria-current=\{active===item\.id\?"page":undefined\}/);
  assert.match(page,/resolveView=.*"general"/);
  assert.match(page,/if\(view==="general"\)/);
  assert.match(page,/if\(view==="account"\)/);
});

test("v3.0 U3.3 keeps everyday preferences in General and removes duplicated licence management",()=>{
  const page=read("app/(protected)/profile/page.tsx");
  const general=page.slice(page.indexOf('if(view==="general")'),page.indexOf('if(view==="account")'));
  assert.match(general,/Pilot details/);
  assert.match(general,/Flight defaults/);
  assert.match(general,/APPEARANCE/);
  assert.match(general,/Install FlyTally/);
  assert.match(general,/href="\/credentials"/);
  assert.doesNotMatch(general,/Licences, qualifications & documents/);
});

test("v3.0 U3.3 loads security and privacy data only in their own workspaces",()=>{
  const page=read("app/(protected)/profile/page.tsx");
  const general=page.slice(page.indexOf('if(view==="general")'),page.indexOf('if(view==="account")'));
  const account=page.slice(page.indexOf('if(view==="account")'),page.indexOf('const privacy='));
  const privacy=page.slice(page.indexOf('const privacy='));
  assert.doesNotMatch(general,/auth_sessions|getAccountPrivacySummary|resolveAccountEntitlementSnapshot/);
  assert.match(account,/auth_sessions/);
  assert.match(account,/resolveAccountEntitlementSnapshot/);
  assert.doesNotMatch(account,/getAccountPrivacySummary/);
  assert.match(privacy,/getAccountPrivacySummary\(userId\)/);
});

test("v3.0 U3.3 keeps account security explicit and moves commercial access detail behind disclosure",()=>{
  const page=read("app/(protected)/profile/page.tsx");
  assert.match(page,/Google account/);
  assert.match(page,/Change password/);
  assert.match(page,/Active sessions/);
  assert.match(page,/u33-access-details/);
  assert.match(page,/FlyTally access/);
  assert.match(page,/Billing provider/);
});

test("v3.0 U3.3 keeps privacy controls while handing backup recovery to Print & data",()=>{
  const page=read("app/(protected)/profile/page.tsx"),actions=read("app/(protected)/profile/actions.ts");
  assert.match(page,/PUBLIC SHARING/);
  assert.match(page,/Revoke all public links/);
  assert.match(page,/href="\/data\?view=recovery"/);
  assert.doesNotMatch(page,/href="\/api\/export\?format=json"/);
  assert.match(page,/Stored data summary/);
  assert.match(page,/Delete account/);
  assert.match(actions,/view=privacy&privacyError=training-erasure/);
});

test("v3.0 U3.3 ships responsive light-theme presentation and advances roadmap to U4",()=>{
  const layout=read("app/layout.tsx"),css=read("app/v300-u33-settings.css"),roadmap=read("ROADMAP.md"),audit=read("docs/product/V3_0_UX_CONSOLIDATION.md");
  assert.match(layout,/v300-u33-settings\.css/);
  assert.match(css,/settings-workspace-nav/);
  assert.match(css,/html\[data-theme="light"\] \.settings-workspace-nav/);
  assert.match(css,/@media\(max-width:520px\)/);
  assert.match(roadmap,/U3 ✅ management hierarchy/);
  assert.match(roadmap,/U3\.3 ✅ Settings hierarchy/);
  assert.match(roadmap,/U4 ✅ flight save/);
  assert.match(roadmap,/U5 ✅ Training learner polish/);
  assert.match(roadmap,/U6 ✅ mobile, accessibility and final UX acceptance/);
  assert.match(audit,/U3\.3 ✅ Settings/);
  assert.match(audit,/U4 ✅ Flight workflow clarity/);
});
