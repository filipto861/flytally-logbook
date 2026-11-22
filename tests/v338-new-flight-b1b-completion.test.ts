import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root=path.resolve(import.meta.dirname,"..");
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");

test("B1B keeps draft as the implicit server intent and certification as an explicit branch",()=>{
  const actions=read("app/(protected)/flights/actions.ts");
  assert.match(actions,/intent=String\(form\.get\("intent"\)\|\|"draft"\)/);
  assert.match(actions,/if\(intent==="certify"\)/);
  assert.match(actions,/redirect\(`\/flights\/\$\{id\}\?certified=1`\)/);
  assert.match(actions,/`\/flights\/\$\{id\}\?tab=logbook&saved=1`/);
  assert.doesNotMatch(actions,/form\.get\("intent"\)\|\|"certify"/);
  const submit=read("components/flight-form.tsx");
  assert.equal((submit.match(/value="certify"/g)??[]).length,2);
  assert.match(submit,/if\(editing\)return[\s\S]*name="intent" value="certify"[\s\S]*Save &amp; certify[\s\S]*return <>[\s\S]*name="intent" value="certify"[\s\S]*Save &amp; certify flight/);
});

test("B1B does not move route/time completeness into draft-save blockers",()=>{
  const form=read("components/flight-form.tsx");
  const compliance=read("lib/fcl050-compliance.ts");
  const detail=read("app/(protected)/flights/[id]/page.tsx");

  assert.doesNotMatch(form,/required[^\n]*(Departure|Arrival|Off-block|On-block)|route and times|required before certification/i);
  assert.doesNotMatch(form,/!departure&&|!arrival&&|!off&&|!on&&/);
  assert.match(compliance,/issue\("departure","departure","Departure place is required\."\)/);
  assert.match(compliance,/issue\("arrival","arrival","Arrival place is required\."\)/);
  assert.match(compliance,/issue\("off_block","off_block","Departure time must be recorded in UTC\."\)/);
  assert.match(compliance,/issue\("on_block","on_block","Arrival time must be recorded in UTC\."\)/);
  assert.match(detail,/blockingComplianceIssues\(certificationCompliance\)/);
});
