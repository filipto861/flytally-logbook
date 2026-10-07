import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const profilePage=fs.readFileSync("app/(protected)/profile/page.tsx","utf8");
const profileActions=fs.readFileSync("app/(protected)/profile/actions.ts","utf8");
const newFlight=fs.readFileSync("app/(protected)/flights/new/page.tsx","utf8");
const gps=fs.readFileSync("components/kml-import-form.tsx","utf8");

test("3.5.2 removes the account Night-definition switch from active Settings and flight-entry runtime",()=>{
  assert.doesNotMatch(profilePage,/name="night_definition"/);
  assert.doesNotMatch(profilePage,/Manual · no automatic Day\/Night split/);
  assert.doesNotMatch(profilePage,/SERA · GPS civil-twilight suggestion/);
  assert.doesNotMatch(profileActions,/night_definition:normalizeNightDefinition/);
  assert.doesNotMatch(profileActions,/pick\(f,"night_definition"/);
  assert.doesNotMatch(newFlight,/getUserNightDefinition/);
  assert.doesNotMatch(newFlight,/nightDefinition=\{/);
  assert.doesNotMatch(gps,/NightDefinition/);
});

test("3.5.2 GPS SERA suggestions are automatic but remain gated by canonical flight-context applicability",()=>{
  assert.match(gps,/const seraLandingSuggestionEnabled=sourceRequirements\?\.landingMode==="DAY_NIGHT",seraNightTimeSuggestionEnabled=sourceRequirements\?\.reviewNightIfr===true/);
  assert.doesNotMatch(gps,/nightDefinition==="SERA"/);
  assert.match(gps,/gpsLandingDayNightSuggestion\(parts\[index\]\?\?\[\]\)/);
  assert.match(gps,/gpsNightMinutesSuggestion\(parts\[index\]\?\?\[\]\)/);
  assert.match(gps,/suggestion\.status!=="AVAILABLE"\|\|Number\(review\.starts\)!==suggestion\.total/);
});

test("3.5.2 landing split state stays sticky for direct edits and clears only stale automatic suggestions",()=>{
  assert.match(gps,/type LandingSplitSource="UNSET"\|"SUGGESTED"\|"MANUAL"/);
  assert.match(gps,/if\(review\.landingSplitSource==="MANUAL"\)return review/);
  assert.match(gps,/review\.landingSplitSource==="SUGGESTED"\?\{\.\.\.review,starts:value,landingsDay:"",landingsNight:"",landingSplitSource:"UNSET",pfMovement:"",takeoffsDay:"",takeoffsNight:"",approachesDay:"",approachesNight:""\}/);
  assert.match(gps,/\[field\]:value,landingSplitSource:"MANUAL"/);
});

test("3.5.2 Night-time state stays sticky and unavailable GPS evidence still falls back to manual entry",()=>{
  assert.match(gps,/if\(review\.nightTimeSource==="MANUAL"\)return review/);
  assert.match(gps,/review\.nightTimeSource==="SUGGESTED"\?\{\.\.\.review,nightTime:"",nightTimeSource:"UNSET"\}:review/);
  assert.match(gps,/GPS Night-time unavailable —/);
  assert.match(gps,/Enter manually/);
  assert.match(gps,/GPS does not prove IFR/);
});

test("3.5.2 Day Night suggestion provenance remains visible and pilot-editable",()=>{
  assert.match(gps,/aria-describedby=\{seraLandingSuggestionEnabled\?landingHelpId:undefined\}/);
  assert.match(gps,/SERA civil-twilight suggestion · GPS event time\/location/);
  assert.match(gps,/Pilot-edited Day\/Night split/);
  assert.match(gps,/Day\/Night split unavailable from the GPS event evidence/);
  assert.match(gps,/onChange=\{event=>updateLandingSplit\(index,"landingsDay",event\.target\.value\)\}/);
  assert.match(gps,/onChange=\{event=>updateLandingSplit\(index,"landingsNight",event\.target\.value\)\}/);
});
