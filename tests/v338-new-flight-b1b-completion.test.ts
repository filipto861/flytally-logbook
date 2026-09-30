import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root=path.resolve(import.meta.dirname,"..");
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");

test("B1B New Flight has one completion surface and one primary save action",()=>{
  const form=read("components/flight-form.tsx");
  assert.match(form,/function Submit\(\{editing=false\}:\{editing\?:boolean\}\)/);
  assert.match(form,/name="intent" value="save"/);
  assert.match(form,/>\{editing\?"Save changes":"Save & review"\}<\/PendingActionButton>/);
  assert.doesNotMatch(form,/Save and add another|Review before save|entry-review-summary|Ready to save/);
  assert.match(form,/className="entry-save-state"/);
  assert.match(form,/Complete before save/);
  assert.match(form,/missing\.map\(item=>missingLabel\[item\]\|\|item\)\.join\(" · "\)/);
  assert.match(form,/Creates an editable draft for final review\./);
});

test("B1B relocates unique review information before deleting the inline review card",()=>{
  const form=read("components/flight-form.tsx");
  const origin=form.indexOf('className="value-origin-note"');
  const profile=form.indexOf("<ProfessionalContextFields");
  const actions=form.indexOf('className="form-actions field-actions"');
  assert.ok(origin>=0&&profile>origin,"aircraft-profile origin should live with Aircraft & logbook before later optional sections");
  assert.ok(actions>profile,"completion actions stay at the end of the canonical form");
  assert.ok(form.includes('selected&&!editing?`from ${registration}`:""'));
  assert.match(form,/Aircraft, logbook and regulatory context came from \{registration\}/);
  assert.match(form,/\{dirty\?<small className="unsaved-indicator">Unsaved changes<\/small>:null\}/);
});

test("B1B offers Add another only from the successful post-save review handoff",()=>{
  const workspace=read("components/flight-detail-workspace.tsx");
  const detail=read("app/(protected)/flights/[id]/page.tsx");
  const newPage=read("app/(protected)/flights/new/page.tsx");
  const form=read("components/flight-form.tsx");

  assert.match(detail,/postSave=\{context\.saved==="1"\}/);
  assert.match(workspace,/postSave\?<div className="flight-post-save">/);
  assert.match(workspace,/href="\/flights\/new\?added=1">Add another flight<\/Link>/);
  assert.match(workspace,/<div role="status"><strong>Flight saved\.<\/strong>/);
  assert.doesNotMatch(form,/Add another flight|Save and add another/);
  assert.match(newPage,/params\.added==="1"/);
  assert.match(newPage,/Flight saved\.<\/strong><span>Ready for the next entry\.<\/span>/);
});

test("B1B keeps the existing save-to-review redirect and backward-compatible server intent",()=>{
  const actions=read("app/(protected)/flights/actions.ts");
  assert.match(actions,/\/flights\/\$\{id\}\?tab=logbook&saved=1/);
  assert.match(actions,/String\(form\.get\("intent"\)\)==="another"\?"\/flights\/new\?added=1"/);
  assert.equal((read("components/flight-form.tsx").match(/value="save"/g)??[]).length,1);
});

test("B1B does not move route/time completeness into the draft-save UI",()=>{
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

test("B1B action layout reflects one primary action and responsive post-save handoff",()=>{
  const css=read("app/ui-system.css");
  assert.match(css,/\.form-actions\.field-actions\{[\s\S]*?grid-template-columns:minmax\(0,1fr\) auto;/);
  assert.match(css,/\.flight-post-save\{[\s\S]*?display:flex;/);
  assert.match(css,/@media\(max-width:700px\)\{[\s\S]*?\.flight-post-save\{align-items:stretch;flex-direction:column\}/);
});
