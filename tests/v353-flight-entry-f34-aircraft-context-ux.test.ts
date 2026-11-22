import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { allowedFlightContexts } from "../lib/flight-aircraft-context-authority.ts";

const root=path.resolve(import.meta.dirname,"..");
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");

const profile=(overrides:Record<string,unknown>={})=>({
  aircraft_type:"B23",
  aircraft_make:"BRM Aero",
  aircraft_model:"Bristell B23",
  evidence:"EASA",
  aircraft_class:"SEP",
  regulatory_category:"AEROPLANE",
  balloon_class:"",
  balloon_group:"",
  part_fcl_credit_class:"",
  part_fcl_credit_basis:"",
  part_fcl_credit_from:"",
  ...overrides,
});

test("F3.4 same-registration Edit presents and submits the stored SNAPSHOT instead of the mutable profile",()=>{
  const form=read("components/flight-form.tsx");
  assert.match(form,/snapshotAuthority=editing&&!profileDefaultsApply/);
  assert.match(form,/submittedEvidence=snapshotAuthority\?storedEvidence:/);
  assert.match(form,/submittedAircraftClass=snapshotAuthority\?storedClass:/);
  assert.match(form,/submittedRegulatoryCategory=snapshotAuthority\?field\("regulatory_category"\)\.trim\(\)\.toUpperCase\(\):/);
  assert.match(form,/submittedAircraftType=snapshotAuthority\?field\("aircraft_type"\)\.trim\(\):/);
  assert.match(form,/snapshotAuthority\?"Stored flight context":"Profile context"/);
  assert.match(form,/This legacy record has no stored regulatory-category value; FlyTally will not backfill one during this edit\./);
});

test("F3.4 Manual multi-context choice comes only from the profile-supported A+ set",()=>{
  const tmg=allowedFlightContexts(profile({
    aircraft_type:"TMG",
    aircraft_model:"Touring Motor Glider",
    aircraft_class:"TMG",
    regulatory_category:"AEROPLANE",
  }));
  assert.deepEqual(tmg.contexts?.map(context=>context.regulatoryCategory),["AEROPLANE","SAILPLANE"]);

  const other=allowedFlightContexts(profile({
    aircraft_type:"OTHER",
    aircraft_model:"Other",
    aircraft_class:"OTHER",
    regulatory_category:"OTHER",
  }));
  assert.deepEqual(other.contexts?.map(context=>context.regulatoryCategory),["OTHER","AEROPLANE","SAILPLANE"]);

  const form=read("components/flight-form.tsx");
  assert.match(form,/profileContexts\.length>1&&!snapshotAuthority/);
  assert.match(form,/profileContexts\.map\(context=>/);
  assert.match(form,/This is the only aircraft-context choice for this flight\. Evidence and class stay profile-owned\./);
  assert.doesNotMatch(form,/full context override|override authority/i);
});

test("F3.4 browser fixture carries authority provenance and exercises compact Manual/GPS states",()=>{
  const bootstrap=read("tooling/bootstrap-browser-smoke-db.mjs");
  const browser=read("e2e/manual-authority-certification.spec.mjs");
  for(const column of ["part_fcl_credit_class","part_fcl_credit_basis","part_fcl_credit_from"])assert.match(bootstrap,new RegExp(column+" TEXT NOT NULL DEFAULT ''"));
  assert.match(bootstrap,/OK-TMG1/);
  assert.match(browser,/F3\.4 Manual compact context exposes only A\+ choice and blocks invalid profiles/);
  assert.match(browser,/details\.aircraft-context-section/);
  assert.match(browser,/select\[name="regulatoryCategory"\]/);
  assert.match(browser,/ULL · UL/);
  assert.match(browser,/Stored flight context/);
});
