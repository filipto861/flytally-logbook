import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root=path.resolve(import.meta.dirname,"..");
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");

test("B2 orders Date Aircraft Role before grouped route and UTC timeline",()=>{
  const form=read("components/flight-form.tsx");
  const start=form.indexOf('entry-section entry-section-primary');
  const end=form.indexOf('entry-section entry-section-experience',start);
  const essentials=form.slice(start,end);
  const ordered=[
    'name="date"',
    'name="registration"',
    'name="role"',
    'essential-route-group',
    'name="departure"',
    'name="arrival"',
    'essential-time-group',
    'name="offBlock"',
    'name="takeoff"',
    'name="landing"',
    'name="onBlock"',
    'flight-time-summary',
  ].map(token=>essentials.indexOf(token));
  assert.ok(ordered.every(index=>index>=0));
  assert.deepEqual([...ordered].sort((a,b)=>a-b),ordered);
  assert.equal((essentials.match(/>UTC</g)??[]).length,1);
  assert.doesNotMatch(essentials,/Off-block <span|Takeoff <span|Landing <span|On-block <span/);
});

test("B2 keeps route and time optional for draft save while retaining live BLOCK AIR unavailable state",()=>{
  const form=read("components/flight-form.tsx");
  assert.match(form,/function durationLabel\(minutes:number\)\{return minutes\?[^\n]*:"—"\}/);
  assert.match(form,/<span>BLOCK<\/span><strong>\{durationLabel\(blockMinutes\)\}<\/strong>/);
  assert.match(form,/<span>AIR<\/span><strong>\{durationLabel\(airMinutes\)\}<\/strong>/);
  for(const name of ["departure","arrival","offBlock","takeoff","landing","onBlock"]){
    const at=form.indexOf(`name="${name}"`);
    assert.ok(at>=0,name);
    assert.doesNotMatch(form.slice(at,at+180),/required/);
  }
});

test("B2 exposes landing and PF presets in the collapsed experience summary without reconfirmation",()=>{
  const form=read("components/flight-form.tsx");
  assert.match(form,/standardLandingSummary=/);
  assert.match(form,/PF \$\{movementRecorded\?"Yes":"No"\}/);
  assert.match(form,/className="experience-summary"/);
  assert.match(form,/className="entry-summary-action">Change<\/span>/);
  assert.match(form,/\[experienceOpen,setExperienceOpen\]=useState\(editing\)/);
  assert.match(form,/if\(!editing&&!movementTouched\)setMovementRecorded\(autoMovement/);
  assert.match(form,/checked=\{movementRecorded\}/);
});

test("B2 trims duplicate manual-entry copy and keeps Add aircraft contextual when aircraft exist",()=>{
  const workspace=read("components/flight-entry-workspace.tsx");
  assert.match(workspace,/mode==="gps"\?<div><p className="eyebrow">GPS IMPORT/);
  assert.match(workspace,/:<div><h2>Flight details<\/h2><\/div>/);
  assert.doesNotMatch(workspace,/Enter the flight itself first\. Extra training, regulatory and cost fields stay collapsed/);
  assert.match(workspace,/!aircraftCount\?<section className="first-aircraft-callout"/);
  assert.match(workspace,/aircraftCount\?<button type="button" className="entry-aircraft-context-action"/);
  assert.match(workspace,/>Add first aircraft<\/button>/);
});

test("B2 responsive essentials keep cockpit layouts compact without changing field semantics",()=>{
  const css=read("app/ui-system.css");
  assert.match(css,/\.flight-form \.essential-identity-grid\{grid-template-columns:minmax\(0,\.8fr\)/);
  assert.match(css,/\.flight-form \.essential-route-grid\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(css,/\.flight-form \.essential-time-grid\{grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
  assert.match(css,/@media\(max-width:1000px\)\{[\s\S]*?essential-time-grid\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(css,/@media\(max-width:360px\)\{[\s\S]*?essential-time-grid\{grid-template-columns:minmax\(0,1fr\)/);
});

test("B2 remains presentation-only around canonical parsing and certification",()=>{
  const form=read("components/flight-form.tsx");
  const actions=read("app/(protected)/flights/actions.ts");
  const certification=read("lib/fcl050-compliance.ts");
  assert.match(actions,/parseFlightInput\(form\)/);
  assert.match(certification,/issue\("off_block","off_block","Departure time must be recorded in UTC\."\)/);
  assert.match(certification,/issue\("on_block","on_block","Arrival time must be recorded in UTC\."\)/);
  assert.doesNotMatch(form,/fcl050FlightCompliance|blockingComplianceIssues/);
});
