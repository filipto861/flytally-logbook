import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  REGULATORY_STRATEGY_VERSION,
  getRegulatoryReadiness,
  signatureAssuranceForSource,
} from "../lib/regulatory-validation.ts";

const root=path.resolve(import.meta.dirname,"..");
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");

test("C4 never classifies current FlyTally evidence as QES or advanced e-signature",()=>{
  const account=signatureAssuranceForSource("FlyTally account",42);
  const inPerson=signatureAssuranceForSource("In-person handwritten signature",null);
  for(const item of [account,inPerson]){
    assert.equal(item.qes,false);
    assert.equal(item.advancedElectronicSignatureClaimed,false);
  }
});

test("C4 regulatory gate fails closed even when decision flags are filled",()=>{
  const state=getRegulatoryReadiness({
    COMMERCIAL_REGULATORY_STRATEGY_VERSION:REGULATORY_STRATEGY_VERSION,
    COMMERCIAL_QES_STATUS:"NOT_REQUIRED",
    COMMERCIAL_AVIATION_VALIDATION_STATUS:"APPROVED",
  });
  assert.equal(state.qesImplemented,false);
  assert.equal(state.commercialReady,false);
  assert.ok(state.blockers.includes("regulatory-external-evidence"));
});

test("C4 requires the exact strategy version and explicit decision statuses",()=>{
  const state=getRegulatoryReadiness({
    COMMERCIAL_REGULATORY_STRATEGY_VERSION:"old-version",
  });
  assert.equal(state.commercialReady,false);
  assert.ok(state.blockers.includes("regulatory-strategy-version"));
  assert.ok(state.blockers.includes("qes-strategy-decision"));
  assert.ok(state.blockers.includes("aviation-validation-decision"));
});

test("C4 public legal page makes assurance and authority limits explicit",()=>{
  const page=read("app/legal/regulatory/page.tsx");
  assert.match(page,/eIDAS qualified electronic signature \(QES\)/i);\n  assert.match(page,/advanced electronic signature/i);\n  assert.match(page,/does <strong>not<\/strong> currently represent/i);
  assert.match(page,/No authority approval is implied/);
  assert.match(page,/External validation incomplete/);
});

test("C4 evidence UI labels HMAC as integrity evidence rather than QES/signature verification",()=>{
  const report=read("app/(protected)/flights/[id]/verification-report/page.tsx");
  const audit=read("app/(protected)/flights/[id]/audit/page.tsx");
  const pad=read("components/in-person-signature-pad.tsx");
  assert.match(report,/evidence integrity/);
  assert.match(audit,/integrity HMAC/);
  assert.match(pad,/does not represent this capture as a qualified electronic signature \(QES\)/i);
});
