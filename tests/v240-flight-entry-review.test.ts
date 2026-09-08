import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const page=fs.readFileSync("app/(protected)/flights/new/page.tsx","utf8");
const workspace=fs.readFileSync("components/flight-entry-workspace.tsx","utf8");
const detailWorkspace=fs.readFileSync("components/flight-detail-workspace.tsx","utf8");
const form=fs.readFileSync("components/flight-form.tsx","utf8");
const panel=fs.readFileSync("components/intelligent-flight-entry-panel.tsx","utf8");
const trackManager=fs.readFileSync("components/track-manager.tsx","utf8");
const reviewNavigation=fs.readFileSync("lib/flight-review-navigation.ts","utf8");

test("v2.4 keeps intelligence attached to the canonical manual FlightForm",()=>{
  assert.match(page,/FlightEntryWorkspace/);
  assert.match(page,/<FlightForm action=\{createFlight\}/);
  assert.match(page,/<IntelligentFlightEntryPanel context=\{intelligentContext\}/);
  assert.match(workspace,/manual:ReactNode/);
  assert.match(workspace,/\{manual\}/);
  assert.match(panel,/createPortal/);
  assert.match(panel,/fieldTarget\(form,preferredField\(item\.code\)\)/);
  assert.match(panel,/data-intelligent-review=\{item\.code\}/);
  assert.match(form,/className="entry-review-summary"/);
});

test("v2.4 continuation and return assistance edit the same canonical route fields",()=>{
  assert.ok(panel.includes('applyFieldValue(form,"departure",continuation.airport)'));
  assert.ok(panel.includes('applyFieldValue(form,"arrival",latestDeparture)'));
  assert.ok(panel.includes('latestArrival===departure'));
  assert.ok(panel.includes('latestDeparture!==departure'));
  assert.ok(panel.includes('data-intelligent-review="return-leg"'));
  assert.ok(panel.includes('className="detail-button"'));
  assert.ok(panel.includes('background:"transparent"'));
  assert.ok(panel.includes('cursor:"pointer"'));
  assert.ok(form.includes('setArrival(departure)'));
  assert.ok(form.includes('Use {departure} for local flight'));
  assert.ok(panel.includes('dispatchEvent(new Event("input",{bubbles:true}))'));
  assert.ok(panel.includes('dispatchEvent(new Event("change",{bubbles:true}))'));
  assert.ok(panel.includes("control.focus()"));
  assert.doesNotMatch(panel,/\/flights\/new\?departure=/);
  assert.doesNotMatch(panel,/import Link from "next\/link"/);
});

test("v2.4 maps intelligent findings only to visible fields",()=>{
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
  assert.ok(panel.includes('control instanceof HTMLInputElement&&control.type==="hidden"'));
  assert.ok(panel.includes('control.closest("[hidden]")'));
  assert.match(panel,/fallback=inline\.filter\(entry=>!entry\.target\)/);
});

test("v2.4 keeps hard required-state review and advisory intelligence separate",()=>{
  assert.match(form,/Complete before save:/);
  assert.match(panel,/attention\?"form-error":"role-guidance"/);
  assert.match(panel,/role=\{attention\?"alert":undefined\}/);
  assert.match(panel,/Suggestions use only this form and your own stored flights/);
  assert.match(panel,/FlyTally never rewrites regulatory fields or infers privileges/);
});

test("v2.4 requires explicit review before applying GPS-derived times",()=>{
  assert.match(trackManager,/const \[state,action\]=useActionState\(attachAction,\{\}\),\[reviewed,setReviewed\]=useState\(false\)/);
  assert.match(trackManager,/disabled=\{!reviewed\|\|pending\}/);
  assert.match(trackManager,/I reviewed the current vs GPS comparison/);
  assert.match(trackManager,/Applying…/);
  assert.match(trackManager,/href=\{`\/flights\/\$\{flightId\}\?tab=logbook`\}/);
  assert.match(trackManager,/Review Logbook data/);
});

test("v2.4 keeps quick-aircraft keyboard focus inside the dialog and restores the opener",()=>{
  assert.match(workspace,/opener=useRef<HTMLButtonElement\|null>\(null\)/);
  assert.match(workspace,/event\.key==="Escape"/);
  assert.match(workspace,/event\.key!=="Tab"/);
  assert.match(workspace,/document\.activeElement===first/);
  assert.match(workspace,/document\.activeElement===last/);
  assert.match(workspace,/requestAnimationFrame\(\(\)=>opener\.current\?\.focus\(\)\)/);
  assert.match(workspace,/aria-haspopup="dialog"/);
  assert.match(workspace,/aria-controls="quick-aircraft-dialog"/);
  assert.match(workspace,/id="quick-aircraft-dialog"/);
});

test("v2.4 hands a successful manual Save into final Logbook review exactly once",()=>{
  assert.match(reviewNavigation,/POST_SAVE_REVIEW_KEY/);
  assert.match(reviewNavigation,/POST_SAVE_REVIEW_MAX_AGE_MS=2\*60\*1000/);
  assert.match(panel,/event:SubmitEvent/);
  assert.match(panel,/intent==="save"/);
  assert.match(panel,/sessionStorage\.setItem\(POST_SAVE_REVIEW_KEY,String\(Date\.now\(\)\)\)/);
  assert.match(panel,/\.form-error\[role="alert"\]/);
  assert.match(panel,/sessionStorage\.removeItem\(POST_SAVE_REVIEW_KEY\)/);
  assert.match(detailWorkspace,/sessionStorage\.getItem\(POST_SAVE_REVIEW_KEY\)/);
  assert.match(detailWorkspace,/sessionStorage\.removeItem\(POST_SAVE_REVIEW_KEY\)/);
  assert.match(detailWorkspace,/age<=POST_SAVE_REVIEW_MAX_AGE_MS/);
  assert.match(detailWorkspace,/setTab\("logbook"\)/);
  assert.match(detailWorkspace,/Flight saved\./);
  assert.match(detailWorkspace,/open Overview to certify the record/);
  assert.match(detailWorkspace,/sharing becomes available after certification/);
});
