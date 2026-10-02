import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root=path.resolve(import.meta.dirname,"..");
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");

const luminance=(hex:string)=>{
  const values=[hex.slice(1,3),hex.slice(3,5),hex.slice(5,7)].map(part=>parseInt(part,16)/255).map(value=>value<=.04045?value/12.92:Math.pow((value+.055)/1.055,2.4));
  return .2126*values[0]+.7152*values[1]+.0722*values[2];
};
const contrast=(a:string,b:string)=>{
  const [high,low]=[luminance(a),luminance(b)].sort((x,y)=>y-x);
  return (high+.05)/(low+.05);
};

test("B5 delays ordinary required-field error styling until a save attempt",()=>{
  const form=read("components/flight-form.tsx");
  assert.match(form,/\[submitAttempted,setSubmitAttempted\]=useState\(false\)/);
  assert.match(form,/onAttempt=\{\(\)=>setSubmitAttempted\(true\)\}/);
  assert.match(form,/aria-invalid=\{submitAttempted&&!registration\|\|profileNeedsConfiguration\|\|undefined\}/);
  assert.match(form,/aria-invalid=\{submitAttempted&&!role\|\|undefined\}/);
  assert.match(form,/submitAttempted&&!registration\?<small className="field-message-error">Required before save\.<\/small>/);
  assert.match(form,/submitAttempted&&!role\?<small className="field-message-error">Required before save\.<\/small>/);
  assert.doesNotMatch(form,/aria-invalid=\{!registration\}|aria-invalid=\{!role\}/);
});

test("B5 missing-field navigation opens the owning disclosure before focus",()=>{
  const form=read("components/flight-form.tsx");
  assert.match(form,/const focusMissing=\(item:string\)=>/);
  assert.match(form,/\["profileConfig","aircraftContext","balloonClass","balloonGroup"\]\.includes\(item\)\)setLogbookOpen\(true\)/);
  assert.match(form,/item==="billingConfig"\)setOptionalDetailsOpen\(true\)/);
  assert.doesNotMatch(form,/item==="actualPic"\)setCrewOpen\(true\)/);
  assert.match(form,/roleInstructor:'\[name="instructor"\]'/);
  assert.match(form,/supervisingPic:'\[name="verificationName"\]'/);
  assert.match(form,/countersignature:'\[name="verificationReference"\]'/);
  assert.match(form,/\["launches","launchMethod","balloonOperation"\]\.includes\(item\)\)setExperienceOpen\(true\)/);
  assert.match(form,/requestAnimationFrame\(\(\)=>requestAnimationFrame\(\(\)=>formRef\.current\?\.querySelector<HTMLElement>\(selector\)\?\.focus\(\)\)\)/);
  assert.match(form,/className="entry-save-blockers" aria-label="Missing required fields"/);
  assert.match(form,/className="entry-blocker-link" onClick=\{\(\)=>focusMissing\(item\)\}/);
});

test("B5 preserves native disclosure semantics and keeps required disclosures discoverable",()=>{
  const form=read("components/flight-form.tsx");
  assert.doesNotMatch(form,/<details[^>]*aria-expanded/);
  assert.doesNotMatch(form,/<details[^>]*aria-controls/);
  assert.match(form,/experienceRequiredOpen=!entryProfile\.selected\|\|entryProfile\.showSailplaneExperience\|\|balloonFlight/);
  assert.match(form,/inlineRoleCrew=Boolean\(dualCrewInline\|\|supervisedCrewInline\|\|safetyCrewInline\)/);
  assert.match(form,/open=\{crewOpen\} onToggle=\{event=>setCrewOpen\(event\.currentTarget\.open\)\}/);
  assert.match(form,/if\(profileNeedsConfiguration\)setLogbookOpen\(true\)/);
  assert.match(form,/if\(billing==="INVALID"\)setOptionalDetailsOpen\(true\)/);
});

test("B5 keeps mobile summaries visible and reflows New Flight through 320px",()=>{
  const css=read("app/ui-system.css");
  assert.match(css,/@media\(max-width:820px\)\{[\s\S]*?\.flight-form \.essential-identity-grid,[\s\S]*?\.flight-form \.secondary-entry-grid\{grid-template-columns:minmax\(0,1fr\)\}/);
  assert.match(css,/@media\(max-width:600px\)\{[\s\S]*?\.flight-form \.entry-section>summary>small\{[\s\S]*?display:flex;[\s\S]*?grid-column:1\/-1/);
  assert.match(css,/@media\(max-width:360px\)\{[\s\S]*?\.flight-form \.form-actions\.field-actions\{position:static;bottom:auto\}/);
  assert.match(css,/\.flight-form \.essential-time-grid\{grid-template-columns:minmax\(0,1fr\)\}/);
  assert.match(css,/@media\(max-width:900px\) and \(max-height:600px\)\{[\s\S]*?position:static/);
});

test("B5 touch targets and forced-colors treatment cover the new blocker controls",()=>{
  const css=read("app/ui-system.css");
  const acceptance=read("app/v300-u6-acceptance.css");
  assert.match(css,/@media\(pointer:coarse\)\{[\s\S]*?\.flight-form \.form-actions\.field-actions\{position:static;bottom:auto\}[\s\S]*?\.entry-blocker-link\{min-height:44px/);
  assert.match(css,/@media\(forced-colors:active\)\{[\s\S]*?\.entry-blocker-link\{border:1px solid ButtonText\}/);
  assert.match(acceptance,/:where\(button,[\s\S]*?summary\)\{[\s\S]*?min-height:44px/);
  assert.match(acceptance,/font-size:16px/);
});

test("B5 measured helper and action colors meet normal-text AA on New Flight surfaces",()=>{
  const tokens=read("app/v150-ui-system.css");
  const ui=read("app/ui-system.css");
  for(const token of ["--muted:#8ea3bb","--panel:#0e1b2d","--link:#67d5fb","--muted:#66788d","--panel:#ffffff","--link:#066f9f"])assert.ok(tokens.includes(token),token);
  for(const [fg,bg] of [["#8ea3bb","#0e1b2d"],["#67d5fb","#0e1b2d"],["#66788d","#ffffff"],["#066f9f","#ffffff"]])assert.ok(contrast(fg,bg)>=4.5,`${fg} on ${bg} must meet 4.5:1`);
  assert.match(ui,/\.entry-summary-action\{color:var\(--link\)\}/);
});

test("B5 keeps Flight experience empty-state title and explanation visually separated without a new empty-state variant",()=>{
  const form=read("components/flight-form.tsx");
  const css=read("app/ui-system.css");
  assert.match(form,/className="empty-state"><strong>Select an aircraft first<\/strong><span>FlyTally will show the experience fields that match its aircraft profile\.<\/span>/);
  assert.match(css,/\.flight-form \.entry-section-experience \.empty-state\{[\s\S]*?display:grid;[\s\S]*?gap:var\(--ui-space-1\)/);
  assert.doesNotMatch(form,/flight-experience-empty-state/);
  assert.doesNotMatch(css,/flight-experience-empty-state/);
});

test("B5 live regions remain limited to changing feedback rather than static completion copy",()=>{
  const form=read("components/flight-form.tsx");
  assert.match(form,/className="flight-time-summary" aria-live="polite"/);
  assert.match(form,/className="form-success" role="status"/);
  assert.doesNotMatch(form,/className="entry-save-state"[^>]*aria-live/);
});

test("B5 remains presentation-only around canonical parser certification and optional billing",()=>{
  const actions=read("app/(protected)/flights/actions.ts");
  const parser=read("lib/flight-input.ts");
  assert.match(actions,/parseFlightInput\(form\)/);
  assert.match(parser,/serializeOptionalBilling/);
  assert.match(read("lib/fcl050-compliance.ts"),/blockingComplianceIssues/);
});
