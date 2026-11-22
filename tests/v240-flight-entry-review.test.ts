import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const trackManager=fs.readFileSync("components/track-manager.tsx","utf8");

test("v2.4 requires explicit review before applying GPS-derived times",()=>{
  assert.match(trackManager,/const \[state,action\]=useActionState\(attachAction,\{\}\),\[reviewed,setReviewed\]=useState\(false\)/);
  assert.match(trackManager,/disabled=\{!reviewed\|\|pending\}/);
  assert.match(trackManager,/I reviewed the current vs GPS comparison/);
  assert.match(trackManager,/Applying…/);
  assert.match(trackManager,/href=\{`\/flights\/\$\{flightId\}\?tab=logbook`\}/);
  assert.match(trackManager,/Review Logbook data/);
});
