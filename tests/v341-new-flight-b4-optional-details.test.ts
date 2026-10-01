import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root=path.resolve(import.meta.dirname,"..");
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");

test("B4 consolidates optional metadata under one native disclosure",()=>{
  const form=read("components/flight-form.tsx");
  const start=form.indexOf('entry-section entry-section-optional');
  const end=form.indexOf('{state.error?',start);
  const optional=form.slice(start,end);
  assert.ok(start>=0&&end>start);
  for(const token of ["Training","Night / IFR","ProfessionalContextFields","Costs","Notes"])assert.ok(optional.includes(token),token);
  assert.match(optional,/open=\{optionalDetailsOpen\}/);
  assert.match(optional,/ProfessionalContextFields[^>]*embedded\/>/);
  assert.doesNotMatch(form,/open=\{costOpen\}|<details className="entry-section"><summary><span>Notes/);
  assert.equal((form.match(/<ProfessionalContextFields/g)??[]).length,1);
});

test("B4 populated Edit state is discoverable without making optional fields required",()=>{
  const form=read("components/flight-form.tsx");
  assert.match(form,/storedNightMinutes=Number\(field\("night_minutes","0"\)\)\|\|0/);
  assert.match(form,/storedProfessional=professionalVisible&&Boolean/);
  assert.match(form,/storedNote=Boolean\(field\("note"\)\.trim\(\)\)/);
  assert.match(form,/storedTraining=Boolean\(storedPurpose\.length\|\|storedTask\)/);
  assert.match(form,/storedCosts=Boolean\(initialBillingBasis\|\|expenses\.length\)/);
  assert.match(form,/optionalInitialPopulated=storedTraining\|\|storedNightMinutes>0\|\|storedIfrMinutes>0\|\|storedProfessional\|\|storedNote\|\|storedCosts/);
  assert.match(form,/\[optionalDetailsOpen,setOptionalDetailsOpen\]=useState\(editing&&optionalInitialPopulated\)/);
  assert.match(form,/optionalDetailsLabels=\[storedTraining&&"Training",[\s\S]*storedNote&&"Notes"\]/);
  assert.doesNotMatch(form,/name="nightTime"[^>]*required|name="ifrTime"[^>]*required|name="task"[^>]*required|name="note"[^>]*required/);
});

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
  assert.match(form,/type="hidden" name="nightTime" value=\{formatEasaDuration\(field\("night_minutes","0"\)\)\}/);
  assert.match(form,/type="hidden" name="ifrTime" value=\{formatEasaDuration\(field\("ifr_minutes","0"\)\)\}/);
});

test("B4 invalid billing remains fail closed and opens Optional details",()=>{
  const form=read("components/flight-form.tsx");
  assert.match(form,/if\(billing==="INVALID"\)setOptionalDetailsOpen\(true\)/);
  assert.match(form,/optionalDetailsSummary=billing==="INVALID"\?"Needs configuration"/);
  assert.match(form,/Stored billing is invalid\. Choose Not tracked, BLOCK or AIR before saving\./);
  assert.match(form,/billing==="INVALID"&&"billingConfig"/);
});

test("B4 helper-copy triage removes generic noise but keeps consequences",()=>{
  const form=read("components/flight-form.tsx");
  const purpose=read("components/flight-purpose-picker.tsx");
  const professional=read("components/professional-context-fields.tsx");
  assert.doesNotMatch(form,/Aircraft profile applies type, logbook and class defaults/);
  assert.doesNotMatch(form,/Choose what you did on this flight\. Most private flights are PIC/);
  assert.doesNotMatch(form,/Configured flight defaults are applied when available/);
  assert.match(form,/A connected instructor receives the review\/sign request after certification\./);
  assert.match(form,/saving this draft sends no invitation\./);
  assert.match(purpose,/Structured recency credit still requires the applicable signed evidence\./);
  assert.match(professional,/FlyTally does not infer operational privileges from it\./);
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

test("B4 optional grouping has compact shared presentation",()=>{
  const css=read("app/ui-system.css");
  assert.match(css,/\.optional-details-body\{display:grid;gap:var\(--ui-space-4\)\}/);
  assert.match(css,/\.optional-detail-group\+\.optional-detail-group\{padding-top:var\(--ui-space-3\);border-top:1px solid var\(--line\)\}/);
  assert.match(css,/\.optional-detail-heading\{display:flex;align-items:baseline;justify-content:space-between;gap:12px;flex-wrap:wrap\}/);
  assert.match(css,/\.optional-detail-heading small\{min-width:0;text-align:right;overflow-wrap:anywhere\}/);
});
