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

test("F3.4 Manual entry submits aircraft authority fields canonically without routine schema editors",()=>{
  const form=read("components/flight-form.tsx");
  assert.match(form,/allowedFlightContexts\(selected\)/);
  assert.match(form,/<summary><span>Aircraft context<\/span>/);
  for(const [name,value] of [
    ["evidence","submittedEvidence"],
    ["aircraftType","submittedAircraftType"],
    ["aircraftClass","submittedAircraftClass"],
    ["balloonClass","submittedBalloonClass"],
    ["balloonGroup","submittedBalloonGroup"],
  ])assert.match(form,new RegExp(`type="hidden" name="${name}" value=\\{${value}\\}`),name);
  assert.doesNotMatch(form,/<select name="evidence"/);
  assert.doesNotMatch(form,/<select name="aircraftClass"/);
  assert.match(form,/Supplied by the selected aircraft profile and enforced again by the server when you save\./);
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

test("F3.4 invalid PROFILE is a visible save blocker with a draft-preserving configuration route",()=>{
  const form=read("components/flight-form.tsx");
  assert.match(form,/profileNeedsConfiguration&&"profileConfig"/);
  assert.ok(form.includes('profileConfig:"Aircraft profile"'));
  assert.match(form,/if\(profileNeedsConfiguration\)setLogbookOpen\(true\)/);
  assert.match(form,/href="\/database" target="_blank" rel="noreferrer" data-aircraft-config-link/);
  assert.match(form,/Open Aircraft without losing this draft/);
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

test("F3.4 GPS uses the same compact profile summary and only exposes the legitimate common context choice",()=>{
  const form=read("components/kml-import-form.tsx");
  assert.match(form,/className=\{\`aircraft-context-card wide \$\{profileError\?"needs-configuration":""\}\`\}/);
  assert.match(form,/type="hidden" name="aircraftType"/);
  assert.match(form,/type="hidden" name="aircraftClass"/);
  assert.match(form,/type="hidden" name="evidence"/);
  assert.doesNotMatch(form,/aria-label="Aircraft class"/);
  assert.doesNotMatch(form,/aria-label="Logbook"/);
  assert.match(form,/allowedContexts\.length>1/);
  assert.match(form,/This is the only aircraft-context choice and applies to every flight in this import session\./);
  assert.match(form,/Open Aircraft without losing this import/);
});

test("F3.4 keeps flight-specific configuration explicit outside profile-owned aircraft context",()=>{
  const manual=read("components/flight-form.tsx");
  const gps=read("components/kml-import-form.tsx");
  assert.match(manual,/Flight-specific · single-pilot \/ multi-pilot\./);
  assert.match(manual,/Flight-specific · single-engine \/ multi-engine\./);
  assert.match(manual,/!balloonFlight\?<input type="hidden" name="balloonOperation" value=""\/>:null/);
  assert.match(gps,/GPS cannot determine crew operation\./);
  assert.match(gps,/GPS cannot determine whether the operation was free or tethered\./);
});

test("F3.4 compact summaries de-duplicate repeated ULL context labels",()=>{
  const manual=read("components/flight-form.tsx");
  const gps=read("components/kml-import-form.tsx");
  for(const source of [manual,gps])assert.match(source,/compactContextSummary=\(parts:Array<string\|undefined>\)=>\[\.\.\.new Set\(/);
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
