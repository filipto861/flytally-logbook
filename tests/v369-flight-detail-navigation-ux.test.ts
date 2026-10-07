import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root=path.resolve(import.meta.dirname,"..");
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");

test("3.5.3 keeps filter-aware flight navigation authority unchanged",()=>{
  const page=read("app/(protected)/flights/[id]/page.tsx");
  const data=read("lib/data/flights-fast.ts");

  assert.match(page,/getFlightNavigation\(userId,id,context\)/);
  assert.match(page,/query=contextQuery\(context\),suffix=query\?`\?\$\{query\}`:""/);
  assert.match(page,/FLIGHT \{navigation\.position\}\/\{navigation\.total\}/);

  assert.match(data,/LAG\(id\).*previous_id/);
  assert.match(data,/LEAD\(id\).*next_id/);
  assert.match(data,/flight-navigation-filtered/);
});

test("3.5.3 exposes obvious Back Previous and Next controls",()=>{
  const page=read("app/(protected)/flights/[id]/page.tsx");

  assert.match(page,/className="secondary-button flight-detail-back" href=\{`\/flights\$\{suffix\}`\}>← Back to flights<\/Link>/);
  assert.match(page,/className="flight-detail-step-group" aria-label="Flight navigation"/);
  assert.match(page,/href=\{`\/flights\/\$\{navigation\.previousId\}\$\{suffix\}`\}>← Previous flight<\/Link>/);
  assert.match(page,/href=\{`\/flights\/\$\{navigation\.nextId\}\$\{suffix\}`\}>Next flight →<\/Link>/);
});

test("3.5.3 keeps unavailable sequential directions visible and disabled",()=>{
  const page=read("app/(protected)/flights/[id]/page.tsx");

  assert.match(page,/navigation\.previousId\?<Link[\s\S]*?:<button type="button" className="secondary-button flight-detail-step" disabled>← Previous flight<\/button>/);
  assert.match(page,/navigation\.nextId\?<Link[\s\S]*?:<button type="button" className="secondary-button flight-detail-step" disabled>Next flight →<\/button>/);
});

test("3.5.3 uses stable responsive hierarchy without horizontal core-navigation scrolling",()=>{
  const css=read("app/ui-system.css");

  assert.match(css,/\.flight-detail-step-group\{[\s\S]*grid-template-columns:repeat\(2,minmax\(132px,max-content\)\)/);
  assert.match(css,/\.flight-detail-step:disabled\{[\s\S]*cursor:not-allowed/);
  assert.match(css,/@media\(max-width:700px\)\{[\s\S]*\.flight-detail-navigation\{[\s\S]*display:grid/);
  assert.match(css,/@media\(max-width:700px\)\{[\s\S]*\.flight-detail-back\{[\s\S]*width:100%/);
  assert.match(css,/@media\(max-width:700px\)\{[\s\S]*\.flight-detail-step-group\{[\s\S]*grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.doesNotMatch(css,/\.flight-detail-step-group\{[^}]*overflow-x:auto/);
});
