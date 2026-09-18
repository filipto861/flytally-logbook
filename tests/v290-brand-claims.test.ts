import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  BRAND_CLAIMS_POLICY_VERSION,
  flyTallyBrandStatus,
  getBrandClaimsReadiness,
  unsafePublicMarketingClaims,
} from "../lib/brand-claims.ts";

const root=path.resolve(import.meta.dirname,"..");
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");

test("C5 never claims a registered FlyTally trademark without evidence",()=>{
  assert.equal(flyTallyBrandStatus.registeredTrademarkClaimed,false);
  assert.equal(flyTallyBrandStatus.trademarkSymbolAllowed,false);
  assert.equal(flyTallyBrandStatus.registrationStatus,"UNVERIFIED");
});

test("C5 rejects high-risk positive public claims",()=>{
  for(const value of [
    "FlyTally is EASA approved.",
    "FlyTally is a qualified electronic signature platform.",
    "FlyTally is a registered trademark.",
    "FlyTally® digital logbook",
    "FlyTally is fully compliant with EASA requirements.",
  ])assert.ok(unsafePublicMarketingClaims(value).length>0,value);

  for(const value of [
    "Digital pilot logbook",
    "Source-backed aircraft training",
    "FCL.050-style logbook records",
  ])assert.deepEqual(unsafePublicMarketingClaims(value),[],value);
});

test("C5 brand and claims gate fails closed despite decision flags",()=>{
  const state=getBrandClaimsReadiness({
    COMMERCIAL_BRAND_CLAIMS_POLICY_VERSION:BRAND_CLAIMS_POLICY_VERSION,
    COMMERCIAL_TRADEMARK_STATUS:"NOT_REQUIRED",
    COMMERCIAL_MARKETING_CLAIMS_STATUS:"APPROVED",
  });
  assert.equal(state.registeredTrademarkClaimed,false);
  assert.equal(state.commercialReady,false);
  assert.ok(state.blockers.includes("brand-claims-external-evidence"));
});

test("C5 scans current public entry surfaces for prohibited positive claims",()=>{
  for(const file of [
    "app/layout.tsx",
    "app/login/page.tsx",
    "app/join/page.tsx",
    "app/page.tsx",
  ]){
    assert.deepEqual(unsafePublicMarketingClaims(read(file)),[],file);
  }
});

test("C5 public legal surface publishes the trademark and claim boundary",()=>{
  const page=read("app/legal/brand-claims/page.tsx");
  assert.match(page,/Registered trademark claimed/);
  assert.match(page,/® symbol allowed/);
  assert.match(page,/Approved wording and evidence boundaries/);
  assert.match(page,/External brand\/claims validation incomplete/);
});
