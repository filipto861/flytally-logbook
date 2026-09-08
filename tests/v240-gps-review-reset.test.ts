import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const trackManager=fs.readFileSync("components/track-manager.tsx","utf8");

test("v2.4 invalidates GPS apply confirmation when track evidence changes",()=>{
  assert.match(trackManager,/trackEvidenceKey=tracks\.map/);
  assert.match(trackManager,/track\.id/);
  assert.match(trackManager,/track\.pointCount/);
  assert.match(trackManager,/track\.startUtc/);
  assert.match(trackManager,/track\.endUtc/);
  assert.match(trackManager,/track\.distanceKm/);
  assert.match(trackManager,/useEffect\(\(\)=>setReviewed\(false\),\[trackEvidenceKey,state\.success\]\)/);
  assert.match(trackManager,/disabled=\{!reviewed\|\|pending\}/);
});
