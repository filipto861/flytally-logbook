import assert from "node:assert/strict";
import test from "node:test";
import { validateAircraftProfile } from "../lib/aircraft-profile-validation.ts";

test("direct aircraft profile evidence accepts canonical EASA and ULL contexts",()=>{
  const easa=validateAircraftProfile({
    aircraftMake:"Bristell",aircraftModel:"B23",evidence:"EASA",aircraftClass:"SEP",regulatoryCategory:"AEROPLANE",
  });
  assert.equal(easa.error,undefined);
  assert.equal(easa.profile?.regulatoryCategory,"AEROPLANE");

  const ull=validateAircraftProfile({
    evidence:"ULL",aircraftClass:"ULL",regulatoryCategory:"ULL",
    partFclCreditClass:"SEP",partFclCreditBasis:"Documented mapping",partFclCreditFrom:"2026-01-15",
  });
  assert.equal(ull.error,undefined);
  assert.equal(ull.profile?.partFclCreditClass,"SEP");
});

test("direct aircraft profile evidence fails closed on explicit regulatory mismatch",()=>{
  const result=validateAircraftProfile({
    aircraftMake:"Bristell",aircraftModel:"B23",evidence:"EASA",aircraftClass:"SEP",regulatoryCategory:"SAILPLANE",
  });
  assert.equal(result.profile,undefined);
  assert.match(result.error??"",/do not match/i);
});

test("direct aircraft profile evidence enforces balloon applicability",()=>{
  const valid=validateAircraftProfile({
    aircraftMake:"Cameron",aircraftModel:"Z-105",evidence:"EASA",aircraftClass:"BALLOON",
    regulatoryCategory:"BALLOON",balloonClass:"HOT_AIR_BALLOON",balloonGroup:"B",
  });
  assert.equal(valid.error,undefined);
  assert.equal(valid.profile?.balloonGroup,"B");

  const invalid=validateAircraftProfile({
    aircraftMake:"Cameron",aircraftModel:"Z-105",evidence:"EASA",aircraftClass:"BALLOON",
    regulatoryCategory:"BALLOON",balloonClass:"GAS_BALLOON",balloonGroup:"A",
  });
  assert.equal(invalid.profile,undefined);
  assert.match(invalid.error??"",/not applicable/i);
});
