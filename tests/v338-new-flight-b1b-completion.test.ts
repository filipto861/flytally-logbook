import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root=path.resolve(import.meta.dirname,"..");
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");

test("B1B completion evolves into explicit draft and certification actions in 3.4.0",()=>{
  const form=read("components/flight-form.tsx");
  assert.match(form,/function Submit\(\{editing=false,certifyDisabled=false,onAttempt\}/);
  assert.match(form,/name="intent" value="draft"/);
  assert.match(form,/name="intent" value="certify"/);
  assert.match(form,/Save draft/);
  assert.match(form,/Save &amp; certify flight/);
  assert.doesNotMatch(form,/Save and add another|Review before save|Save & review/);
  assert.match(form,/className="entry-save-state"/);
  assert.match(form,/Complete before save/);
  assert.match(form,/missing\.map\(item=><button key=\{item\} type="button" className="entry-blocker-link"/);
});

test("B1B relocated review information remains visible inside the 3.4.0 completion summary",()=>{
  const form=read("components/flight-form.tsx");
  const profileSummary=form.indexOf("profileSummary=profileNeedsConfiguration");
  const optional=form.indexOf('entry-section entry-section-optional');
  const summary=form.indexOf('entry-certification-summary');
  const actions=form.lastIndexOf('className="form-actions field-actions"');
  assert.ok(profileSummary>=0&&optional>profileSummary);
  assert.ok(summary>optional&&actions>summary);
  assert.match(form,/profileSummary=profileNeedsConfiguration\?"Needs configuration":aircraftContextSummary/);
  assert.match(form,/Aircraft \/ role/);
  assert.match(form,/Certified flights are locked; later changes are recorded as corrections\./);
  assert.match(form,/\{dirty\?<small className="unsaved-indicator">Unsaved changes<\/small>:null\}/);
});

test("B1B offers Add another from the post-completion handoff, not the entry form",()=>{
  const workspace=read("components/flight-detail-workspace.tsx");
  const detail=read("app/(protected)/flights/[id]/page.tsx");
  const newPage=read("app/(protected)/flights/new/page.tsx");
  const form=read("components/flight-form.tsx");

  assert.match(detail,/completion=\{completion\}/);
  assert.match(detail,/completionMessage=\{completionMessage\}/);
  assert.match(workspace,/href="\/flights\/new\?added=1">Add another flight<\/Link>/);
  assert.match(workspace,/Flight saved as draft\./);
  assert.match(workspace,/Flight saved and certified\./);
  assert.doesNotMatch(form,/Add another flight|Save and add another/);
  assert.match(newPage,/params\.added==="1"/);
  assert.match(newPage,/Flight saved\.<\/strong><span>Ready for the next entry\.<\/span>/);
});

test("B1B keeps draft as the implicit server intent and certification as an explicit branch",()=>{
  const actions=read("app/(protected)/flights/actions.ts");
  assert.match(actions,/intent=String\(form\.get\("intent"\)\|\|"draft"\)/);
  assert.match(actions,/if\(intent==="certify"\)/);
  assert.match(actions,/redirect\(`\/flights\/\$\{id\}\?certified=1`\)/);
  assert.match(actions,/`\/flights\/\$\{id\}\?tab=logbook&saved=1`/);
  assert.doesNotMatch(actions,/form\.get\("intent"\)\|\|"certify"/);
  assert.equal((read("components/flight-form.tsx").match(/value="certify"/g)??[]).length,1);
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
  assert.match(detail,/blockingComplianceIssues\(compliance\)/);
});

test("B1B action layout supports one secondary draft action plus one primary certification action",()=>{
  const css=read("app/ui-system.css");
  assert.match(css,/\.form-actions\.field-actions\{[\s\S]*?grid-template-columns:minmax\(0,1fr\) auto auto;/);
  assert.match(css,/\.flight-post-save\{[\s\S]*?display:flex;/);
  assert.match(css,/@media\(max-width:700px\)\{[\s\S]*?\.flight-post-save\{align-items:stretch;flex-direction:column\}/);
});
