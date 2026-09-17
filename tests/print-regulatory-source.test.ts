import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root=path.resolve(import.meta.dirname,"..");
const printPage=fs.readFileSync(path.join(root,"app/(protected)/print/page.tsx"),"utf8");
const printModel=fs.readFileSync(path.join(root,"lib/logbook-print.ts"),"utf8");

test("regulator-facing print reads authoritative pilot licences before legacy mirror",()=>{
  assert.match(printPage,/FROM pilot_licences WHERE user_id=\$\{userId\}/);
  assert.match(printPage,/printIdentity\(preferences,identityScope,\[\.\.\.pilotLicenceRows,\.\.\.legacyLicenceRows\]\)/);
  assert.match(printModel,/source:\"pilot_licences\"/);
  assert.match(printModel,/if\(selectedPrimary\)return/);
});

test("legacy licence mirror remains fallback-only",()=>{
  const primaryIndex=printModel.indexOf("const selectedPrimary=primary[0]");
  const fallbackIndex=printModel.indexOf("const fallback=licences.filter");
  assert.ok(primaryIndex>=0,"primary licence selection must exist");
  assert.ok(fallbackIndex>primaryIndex,"legacy fallback must be evaluated only after authoritative pilot_licences");
});

test("print output keeps holder identity and page carry-forward fields",()=>{
  assert.match(printPage,/Holder&apos;s name\(s\)/);
  assert.match(printPage,/Holder&apos;s licence number/);
  assert.match(printPage,/TOTAL THIS PAGE/);
  assert.match(printPage,/TOTAL FROM PREVIOUS PAGES/);
  assert.match(printPage,/TOTAL TIME/);
  assert.match(printPage,/Pilot&apos;s signature/);
});
