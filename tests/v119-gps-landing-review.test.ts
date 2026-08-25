import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const form=readFileSync(new URL("../components/kml-import-form.tsx",import.meta.url),"utf8");

test("each reviewed GPS section exposes its detected touch-and-go events",()=>{
  assert.match(form,/touchAndGoEvents\(part\)/);
  assert.match(form,/touch-and-go.*detected/);
  assert.match(form,/event\.signal/);
  assert.match(form,/stamp\.time.*UTC/);
});

test("the detected landing total remains a user-reviewed editable field",()=>{
  assert.match(form,/Landings \/ starts/);
  assert.match(form,/name=\{`part_\$\{index\}_starts`\}/);
  assert.match(form,/value=\{review\.starts\}/);
  assert.match(form,/GPS suggestion: \{detectedLandings\}/);
});
