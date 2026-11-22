import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root=path.resolve(import.meta.dirname,"..");
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");

test("B4 keeps optional values in the form when the disclosure is closed",()=>{
  const form=read("components/flight-form.tsx");
  const start=form.indexOf('entry-section entry-section-optional');
  const end=form.indexOf('{state.error?',start);
  const optional=form.slice(start,end);
  for(const token of ['name="task"','name="nightTime"','name="ifrTime"','name="billingBasis"','name="billingShare"','name="note"'])assert.ok(optional.includes(token),token);
  assert.doesNotMatch(optional,/optionalDetailsOpen\s*\?/);
  const professional=read("components/professional-context-fields.tsx");
  assert.match(professional,/if\(!visible\)return <>[\s\S]*name="operatorName"[\s\S]*name="flightNumber"[\s\S]*name="operationContext"/);
  assert.match(professional,/if\(embedded\)return <section className="optional-detail-group optional-professional-context"/);
});

test("B4 moves Night and IFR detail out of Flight experience without dropping stored values",()=>{
  const form=read("components/flight-form.tsx");
  const experience=form.indexOf('entry-section entry-section-experience');
  const optional=form.indexOf('entry-section entry-section-optional');
  assert.ok(form.indexOf("Day landings",experience)<optional);
  assert.ok(form.indexOf("Night landings",experience)<optional);
  assert.ok(form.indexOf("Night time",optional)>optional);
  assert.ok(form.indexOf("IFR time",optional)>optional);
  assert.match(form,/showOptionalTime=entryProfile\.showStandardExperience\|\|storedNightMinutes>0\|\|storedIfrMinutes>0/);
  assert.match(form,/type="hidden" name="nightTime" value=\{nightTime\}/);
  assert.match(form,/type="hidden" name="ifrTime" value=\{ifrTime\}/);
});

test("B4 invalid billing remains fail closed and opens Optional details",()=>{
  const form=read("components/flight-form.tsx");
  assert.match(form,/if\(billing==="INVALID"\)setOptionalDetailsOpen\(true\)/);
  assert.match(form,/optionalDetailsSummary=billing==="INVALID"\?"Needs configuration"/);
  assert.match(form,/Stored billing is invalid\. Choose Not tracked, BLOCK or AIR before saving\./);
  assert.match(form,/billing==="INVALID"&&"billingConfig"/);
});

test("B4 remains presentation-only around canonical parsing and certification",()=>{
  const actions=read("app/(protected)/flights/actions.ts");
  const parser=read("lib/flight-input.ts");
  const certification=read("lib/certification-integrity.ts");
  const candidate=read("lib/flight-draft-candidate.ts");
  assert.match(actions,/parseFlightInput\(form\)/);
  assert.match(candidate,/nightTime:formValue\(form,"nightTime"\)/);
  assert.match(candidate,/ifrTime:formValue\(form,"ifrTime"\)/);
  assert.match(candidate,/purposeSelectionPresent:form\.has\("purposeSelectionPresent"\)\|\|form\.has\("purposeCode"\)/);
  assert.match(parser,/nightMinutes=durationMinutes\(nightRaw\.value\)/);
  assert.match(parser,/ifrMinutes=durationMinutes\(ifrRaw\.value\)/);
  assert.match(parser,/hasPurposeField=candidate\.purposeSelectionPresent/);
  assert.match(certification,/flightCertificationHash/);
});
