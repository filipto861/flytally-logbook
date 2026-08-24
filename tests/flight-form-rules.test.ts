import test from "node:test";
import assert from "node:assert/strict";
import {normalizeChoice,normalizeRegistration,shouldApplyAircraftProfileDefaults} from "../lib/flight-form-rules.ts";

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
