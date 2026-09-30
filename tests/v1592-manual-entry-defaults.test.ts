import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { shouldApplyAircraftProfileDefaults } from "../lib/flight-form-rules.ts";
import { releaseAtLeast } from "./release-version.ts";

const form=fs.readFileSync("components/flight-form.tsx","utf8");
const data=fs.readFileSync("lib/data/flights.ts","utf8");
const pkg=JSON.parse(fs.readFileSync("package.json","utf8"));
const lock=JSON.parse(fs.readFileSync("package-lock.json","utf8"));

test("v1.59.2 package metadata remains synchronized in later releases",()=>{
  assert.ok(releaseAtLeast(pkg.version,1,59,2));
  assert.equal(lock.version,pkg.version);
  assert.equal(lock.packages[""].version,pkg.version);
});

test("new manual flight starts without previous aircraft or airport defaults",()=>{
  const start=data.indexOf("export async function getManualEntryDefaults");
  const end=data.indexOf("export async function getFlightNavigation",start);
  const block=data.slice(start,end);
  assert.match(block,/registration:""/);
  assert.match(block,/departure:""/);
  assert.match(block,/arrival:""/);
  assert.match(block,/evidence:""/);
  assert.doesNotMatch(block,/ORDER BY f\.id DESC LIMIT 1/);
  assert.doesNotMatch(block,/registration_default_source|departure_default_source/);
  assert.doesNotMatch(block,/home_airport/);
});

test("blank New flight stays neutral and selected-aircraft profile defaults fail closed",()=>{
  assert.match(form,/initialRegistration=normalizeRegistration\(field\("registration"\)\)/);
  assert.doesNotMatch(form,/normalizedAircraft\[0\]\?\.registration/);
  assert.match(form,/selectedProfile=useMemo\(\(\)=>selected\?resolveFlightEntryAircraftProfileDefaults\(selected\):null,\[selected\]\)/);
  assert.match(form,/profileEvidence=selectedProfile\?\.profile\?\.evidence\|\|""/);
  assert.match(form,/profileClass=selectedProfile\?\.profile\?\.aircraftClass\|\|""/);
  assert.doesNotMatch(form,/normalizeChoice\(selected\.evidence,EVIDENCE,"ULL"\)/);
  assert.doesNotMatch(form,/normalizeChoice\(selected\.aircraft_class,CLASSES,"ULL"\)/);
  assert.match(form,/selected\?\.billing_basis\|\|""/);
  assert.match(form,/initialBilling=parseOptionalBilling\(billingSource\)/);
  assert.match(form,/initialBillingBasis:FlightBillingChoice=initialBilling\.error\?"INVALID":initialBilling\.settings\?\.basis\|\|""/);
});

test("explicit aircraft selection atomically refreshes aircraft-dependent defaults",()=>{
  assert.equal(shouldApplyAircraftProfileDefaults(false,"","OK-RTK"),true);
  const start=form.indexOf("const pickAircraft=");
  const end=form.indexOf("const blockMinutes=",start);
  const pick=form.slice(start,end);
  for(const pattern of [/setType\(a\.aircraft_type\|\|""\)/,/setClass\(nextClass\)/,/setEngineType\(defaultEngineType\(nextClass\)\)/,/setOperationType\("SP"\)/,/setEvidence\(nextEvidence\)/,/setBilling\(nextBilling\.error\?"INVALID":nextBilling\.settings\?\.basis\|\|""\)/,/setBillingShare\(nextBilling\.settings\?\.share\|\|1\)/,/setHourlyRate\(Number\(a\.price_per_hour\)\|\|0\)/])assert.match(pick,pattern);
  assert.doesNotMatch(pick,/setRole\(/);
});

test("blank aircraft state does not force open aircraft-dependent sections",()=>{
  assert.match(form,/useState\(editing&&\(!initialEvidence\|\|!initialClass\)\)/);
  assert.match(form,/if\(registration&&\(!evidence\|\|!aircraftClass\|\|profileNeedsConfiguration\)\)setLogbookOpen\(true\)/);
  assert.doesNotMatch(form,/if\(registration&&!billing\)setCostOpen\(true\)/);
});
