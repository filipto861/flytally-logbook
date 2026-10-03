import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { nightDefinitionFromPreferences,normalizeNightDefinition } from "../lib/night-definition.ts";

const profilePage=fs.readFileSync("app/(protected)/profile/page.tsx","utf8");
const profileActions=fs.readFileSync("app/(protected)/profile/actions.ts","utf8");
const newFlight=fs.readFileSync("app/(protected)/flights/new/page.tsx","utf8");
const gps=fs.readFileSync("components/kml-import-form.tsx","utf8");

test("E1.3 night-definition preference fails closed to MANUAL",()=>{
  assert.equal(normalizeNightDefinition("SERA"),"SERA");
  assert.equal(normalizeNightDefinition("sera"),"SERA");
  assert.equal(normalizeNightDefinition("AUTO"),"MANUAL");
  assert.equal(normalizeNightDefinition(undefined),"MANUAL");
  assert.equal(nightDefinitionFromPreferences({night_definition:"SERA"}),"SERA");
  assert.equal(nightDefinitionFromPreferences({}),"MANUAL");
  assert.equal(nightDefinitionFromPreferences('{"night_definition":"SERA"}'),"SERA");
  assert.equal(nightDefinitionFromPreferences("broken"),"MANUAL");
});

test("E1.3 account settings expose and persist explicit MANUAL or SERA applicability",()=>{
  assert.match(profilePage,/name="night_definition"/);
  assert.match(profilePage,/Manual · no automatic Day\/Night split/);
  assert.match(profilePage,/SERA · GPS civil-twilight suggestion/);
  assert.match(profileActions,/night_definition:normalizeNightDefinition\(pick\(f,"night_definition",existing\.night_definition\)\)/);
  assert.match(newFlight,/getUserNightDefinition\(userId\)/);
  assert.match(newFlight,/nightDefinition=\{nightDefinition\}/);
});

test("E1.3 GPS suggestion is gated by explicit account SERA plus DAY_NIGHT context",()=>{
  assert.match(gps,/nightDefinition==="SERA"&&sourceRequirements\?\.landingMode==="DAY_NIGHT"/);
  assert.doesNotMatch(gps,/nightDefinition==="SERA"&&selectedProfile\?\.evidence==="EASA"/);
  assert.match(gps,/gpsLandingDayNightSuggestion\(parts\[index\]\?\?\[\]\)/);
  assert.match(gps,/suggestion\.status!=="AVAILABLE"\|\|Number\(review\.starts\)!==suggestion\.total/);
});

test("E1.3 landing split state is sticky for direct edits and clears suggested split on total change",()=>{
  assert.match(gps,/type LandingSplitSource="UNSET"\|"SUGGESTED"\|"MANUAL"/);
  assert.match(gps,/review\.landingSplitSource==="SUGGESTED"\?\{\.\.\.review,starts:value,landingsDay:"",landingsNight:"",landingSplitSource:"UNSET",reviewed:false\}/);
  assert.match(gps,/\[field\]:value,landingSplitSource:"MANUAL",reviewed:false/);
  assert.match(gps,/landingSplitSource:"UNSET",pfMovement/);
});

test("E1.3 Day Night suggestion provenance is accessible and remains pilot-editable",()=>{
  assert.match(gps,/aria-describedby=\{seraLandingSuggestionEnabled\?landingHelpId:undefined\}/);
  assert.match(gps,/SERA civil-twilight suggestion · GPS event time\/location/);
  assert.match(gps,/Pilot-edited Day\/Night split/);
  assert.match(gps,/Day\/Night split unavailable from the GPS event evidence/);
  assert.match(gps,/onChange=\{event=>updateLandingSplit\(index,"landingsDay",event\.target\.value\)\}/);
  assert.match(gps,/onChange=\{event=>updateLandingSplit\(index,"landingsNight",event\.target\.value\)\}/);
});
