import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const page=fs.readFileSync("app/(protected)/flights/new/page.tsx","utf8");
const workspace=fs.readFileSync("components/flight-entry-workspace.tsx","utf8");
const form=fs.readFileSync("components/flight-form.tsx","utf8");
const panel=fs.readFileSync("components/intelligent-flight-entry-panel.tsx","utf8");

test("v2.4 keeps intelligence attached to the canonical manual FlightForm",()=>{
  assert.match(page,/FlightEntryWorkspace/);
  assert.match(workspace,/<FlightForm action=\{createFlight\}/);
  assert.match(workspace,/<IntelligentFlightEntryPanel context=\{intelligentContext\}/);
  assert.match(panel,/createPortal/);
  assert.match(panel,/fieldTarget\(form,preferredField\(item\.code\)\)/);
  assert.match(panel,/data-intelligent-review=\{item\.code\}/);
  assert.match(form,/className="entry-review-summary"/);
});

test("v2.4 continuation edits the existing Departure control without navigation",()=>{
  assert.ok(panel.includes('applyFieldValue(form,"departure",continuation.airport)'));
  assert.ok(panel.includes('dispatchEvent(new Event("input",{bubbles:true}))'));
  assert.ok(panel.includes('dispatchEvent(new Event("change",{bubbles:true}))'));
  assert.ok(panel.includes("control.focus()"));
  assert.doesNotMatch(panel,/\/flights\/new\?departure=/);
  assert.doesNotMatch(panel,/import Link from "next\/link"/);
});

test("v2.4 maps intelligent findings to the fields that own the review",()=>{
  const mappings=[
    ['code==="exact_duplicate"','return"registration"'],
    ['code==="incomplete_block_pair"','return"offBlock"'],
    ['code==="incomplete_air_pair"','return"takeoff"'],
    ['code==="air_exceeds_block"','return"landing"'],
    ['code.startsWith("movement_")','return"landingsDay"'],
    ['code==="copilot_single_pilot"','return"role"'],
    ['code==="professional_context_scope"','return"operationContext"'],
    ['code==="registration_profile_aircraft_class"','return"aircraftClass"'],
    ['code==="registration_profile_evidence"','return"evidence"'],
  ];
  for(const [condition,target] of mappings){
    assert.ok(panel.includes(condition),`missing intelligent mapping condition ${condition}`);
    assert.ok(panel.includes(target),`missing intelligent mapping target ${target}`);
  }
});

test("v2.4 keeps hard required-state review and advisory intelligence separate",()=>{
  assert.match(form,/Complete before save:/);
  assert.match(panel,/attention\?"field-message-error":"role-guidance"/);
  assert.match(panel,/Suggestions use only this form and your own stored flights/);
  assert.match(panel,/FlyTally never rewrites regulatory fields or infers privileges/);
});
