import test from "node:test";
import assert from "node:assert/strict";
import {normalizeChoice,normalizeRegistration,resolveFlightEntryAircraftProfileDefaults,shouldApplyAircraftProfileDefaults} from "../lib/flight-form-rules.ts";

const evidence=["ULL","EASA"] as const;

test("edit keeps stored values when the same aircraft is reselected",()=>{
  assert.equal(shouldApplyAircraftProfileDefaults(true,"OK-BID","ok-bid"),false);
  assert.equal(shouldApplyAircraftProfileDefaults(true,"OK-BID","OK-ABC"),true);
  assert.equal(shouldApplyAircraftProfileDefaults(false,"OK-BID","OK-BID"),true);
});

test("stored select values are normalized before rendering",()=>{
  assert.equal(normalizeRegistration(" ok-bid "),"OK-BID");
  assert.equal(normalizeChoice(" easa ",evidence,""),"EASA");
  assert.equal(normalizeChoice("legacy",evidence,""),"");
});


test("aircraft profile defaults fail closed instead of repairing invalid evidence to ULL",()=>{
  const validUll=resolveFlightEntryAircraftProfileDefaults({evidence:"ULL",aircraft_class:"ULL",regulatory_category:"ULL"});
  assert.equal(validUll.error,undefined);
  assert.equal(validUll.profile?.evidence,"ULL");
  assert.equal(validUll.profile?.aircraftClass,"ULL");

  const missing=resolveFlightEntryAircraftProfileDefaults({evidence:"",aircraft_class:"",regulatory_category:""});
  assert.equal(missing.profile,undefined);
  assert.match(missing.error??"",/logbook|configuration/i);

  const legacyMismatch=resolveFlightEntryAircraftProfileDefaults({evidence:"ULL",aircraft_class:"SEP",regulatory_category:"ULL"});
  assert.equal(legacyMismatch.profile,undefined);
  assert.match(legacyMismatch.error??"",/needs configuration/i);
});

test("aircraft profile defaults require a valid canonical EASA profile",()=>{
  const valid=resolveFlightEntryAircraftProfileDefaults({
    aircraft_make:"BRM Aero",
    aircraft_model:"B23",
    evidence:"EASA",
    aircraft_class:"SEP",
    regulatory_category:"AEROPLANE",
  });
  assert.equal(valid.error,undefined);
  assert.equal(valid.profile?.evidence,"EASA");
  assert.equal(valid.profile?.aircraftClass,"SEP");

  const missingIdentity=resolveFlightEntryAircraftProfileDefaults({
    aircraft_make:"",
    aircraft_model:"B23",
    evidence:"EASA",
    aircraft_class:"SEP",
    regulatory_category:"AEROPLANE",
  });
  assert.equal(missingIdentity.profile,undefined);
  assert.match(missingIdentity.error??"",/manufacturer/i);
});
