import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const gps=fs.readFileSync("components/kml-import-form.tsx","utf8");

test("3.5.2 GPS SERA suggestions are automatic but remain gated by canonical flight-context applicability",()=>{
  assert.match(gps,/const seraLandingSuggestionEnabled=sourceRequirements\?\.landingMode==="DAY_NIGHT",seraNightTimeSuggestionEnabled=sourceRequirements\?\.reviewNightIfr===true/);
  assert.doesNotMatch(gps,/nightDefinition==="SERA"/);
  assert.doesNotMatch(gps,/\bnightDefinition\b/);
  assert.match(gps,/pfSuggestion=sourceRequirements\?\.movementMode==="FCL060_PF"\?gpsPfMovementDayNightSuggestion\(part\):null/);
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
