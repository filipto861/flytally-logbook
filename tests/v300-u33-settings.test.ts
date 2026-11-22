import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root=path.resolve(import.meta.dirname,"..");
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");

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
