import assert from "node:assert/strict";
import test from "node:test";

import {
  allowedFlightContexts,
  classifySnapshotAircraftContextChange,
  isAllowedFlightContext,
  normalizeFlightAircraftContextSnapshot,
  resolveFlightAircraftContextAuthority,
} from "../lib/flight-aircraft-context-authority.ts";

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

test("F3.2 standard PROFILE contexts stay single and profile-owned",()=>{
  const result=allowedFlightContexts(profile());
  assert.equal(result.error,undefined);
  assert.deepEqual(result.contexts,[{
    evidence:"EASA",
    aircraftClass:"SEP",
    regulatoryCategory:"AEROPLANE",
    balloonClass:"",
    balloonGroup:"",
    aircraftType:"B23",
  }]);

  assert.equal(isAllowedFlightContext({
    evidence:"easa",aircraftClass:"sep",regulatoryCategory:"aeroplane",
    balloonClass:"",balloonGroup:"",aircraftType:"B23",
  },result.contexts??[]),true);

  assert.equal(isAllowedFlightContext({
    evidence:"ULL",aircraftClass:"ULL",regulatoryCategory:"ULL",
    balloonClass:"",balloonGroup:"",aircraftType:"B23",
  },result.contexts??[]),false);

  assert.equal(isAllowedFlightContext({
    evidence:"EASA",aircraftClass:"SEP",regulatoryCategory:"SAILPLANE",
    balloonClass:"",balloonGroup:"",aircraftType:"B23",
  },result.contexts??[]),false);

  assert.equal(isAllowedFlightContext({
    evidence:"EASA",aircraftClass:"SEP",regulatoryCategory:"AEROPLANE",
    balloonClass:"",balloonGroup:"",aircraftType:"DIFFERENT",
  },result.contexts??[]),false);
});

test("F3.2 ULL PROFILE context stays canonical without inventing EASA identity requirements",()=>{
  const result=allowedFlightContexts(profile({
    aircraft_type:"",
    aircraft_make:"",
    aircraft_model:"",
    evidence:"ULL",
    aircraft_class:"ULL",
    regulatory_category:"ULL",
  }));
  assert.equal(result.error,undefined);
  assert.deepEqual(result.contexts,[{
    evidence:"ULL",
    aircraftClass:"ULL",
    regulatoryCategory:"ULL",
    balloonClass:"",
    balloonGroup:"",
    aircraftType:"",
  }]);
});

test("F3.2 TMG allowed contexts expose only the two legitimate regulatory categories with profile default first",()=>{
  for(const current of ["AEROPLANE","SAILPLANE"] as const){
    const result=allowedFlightContexts(profile({
      aircraft_type:"TMG",
      aircraft_model:"Touring Motor Glider",
      aircraft_class:"TMG",
      regulatory_category:current,
    }));
    assert.equal(result.error,undefined,current);
    assert.deepEqual(result.contexts?.map(item=>item.regulatoryCategory),
      current==="AEROPLANE"?["AEROPLANE","SAILPLANE"]:["SAILPLANE","AEROPLANE"]);
    assert.ok(result.contexts?.every(item=>item.evidence==="EASA"&&item.aircraftClass==="TMG"&&item.aircraftType==="TMG"));
  }
});

test("F3.2 OTHER allowed contexts expose only the canonical three categories with profile default first",()=>{
  const result=allowedFlightContexts(profile({
    aircraft_type:"CUSTOM",
    aircraft_model:"Custom",
    aircraft_class:"OTHER",
    regulatory_category:"OTHER",
  }));
  assert.equal(result.error,undefined);
  assert.deepEqual(result.contexts?.map(item=>item.regulatoryCategory),["OTHER","AEROPLANE","SAILPLANE"]);
  assert.ok(result.contexts?.every(item=>item.evidence==="EASA"&&item.aircraftClass==="OTHER"));
});

test("F3.2 Balloon class/group remain profile-owned and do not become override dimensions",()=>{
  const result=allowedFlightContexts(profile({
    aircraft_type:"Z105",
    aircraft_make:"Cameron",
    aircraft_model:"Z-105",
    aircraft_class:"BALLOON",
    regulatory_category:"BALLOON",
    balloon_class:"HOT_AIR_BALLOON",
    balloon_group:"B",
  }));
  assert.equal(result.error,undefined);
  assert.equal(result.contexts?.length,1);
  assert.deepEqual(result.contexts?.[0],{
    evidence:"EASA",
    aircraftClass:"BALLOON",
    regulatoryCategory:"BALLOON",
    balloonClass:"HOT_AIR_BALLOON",
    balloonGroup:"B",
    aircraftType:"Z105",
  });

  assert.equal(isAllowedFlightContext({
    evidence:"EASA",aircraftClass:"BALLOON",regulatoryCategory:"BALLOON",
    balloonClass:"HOT_AIR_BALLOON",balloonGroup:"C",aircraftType:"Z105",
  },result.contexts??[]),false);
});

test("F3.2 allowed contexts fail closed on malformed profile identity or Part-FCL credit provenance",()=>{
  const missingIdentity=allowedFlightContexts(profile({aircraft_make:""}));
  assert.equal(missingIdentity.contexts,undefined);
  assert.match(missingIdentity.error??"",/manufacturer/i);

  const invalidCredit=allowedFlightContexts(profile({
    part_fcl_credit_class:"SEP",
    part_fcl_credit_basis:"",
    part_fcl_credit_from:"2026-01-01",
  }));
  assert.equal(invalidCredit.contexts,undefined);
  assert.match(invalidCredit.error??"",/basis\/reference/i);
});

test("F3.2 authority derives PROFILE or SNAPSHOT from stored versus final normalized registration",()=>{
  assert.deepEqual(resolveFlightAircraftContextAuthority({
    mode:"CREATE",storedRegistration:"",submittedRegistration:" ok-new ",
  }),{
    authority:"PROFILE",
    storedRegistration:"",
    submittedRegistration:"OK-NEW",
  });

  assert.equal(resolveFlightAircraftContextAuthority({
    mode:"UPDATE",storedRegistration:" OK-HIST ",submittedRegistration:"ok-hist",
  }).authority,"SNAPSHOT");

  assert.equal(resolveFlightAircraftContextAuthority({
    mode:"UPDATE",storedRegistration:"OK-HIST",submittedRegistration:"OK-NEW",
  }).authority,"PROFILE");

  // A -> B -> A in the UI still resolves from the stored registration and final submission only.
  assert.equal(resolveFlightAircraftContextAuthority({
    mode:"UPDATE",storedRegistration:"OK-A",submittedRegistration:"OK-A",
  }).authority,"SNAPSHOT");
});

test("F3.2 SNAPSHOT comparison preserves unchanged legacy blanks without deriving today's category",()=>{
  const legacy={
    evidence:"EASA",
    aircraftClass:"SEP",
    regulatoryCategory:"",
    balloonClass:"",
    balloonGroup:"",
    aircraftType:"B23",
  };
  const same={
    evidence:" easa ",
    aircraftClass:"sep",
    regulatoryCategory:"",
    balloonClass:"",
    balloonGroup:"",
    aircraftType:"B23",
  };

  assert.deepEqual(normalizeFlightAircraftContextSnapshot(legacy),legacy);
  assert.equal(classifySnapshotAircraftContextChange(legacy,same),"UNCHANGED");
  assert.equal(classifySnapshotAircraftContextChange(legacy,{...same,regulatoryCategory:"AEROPLANE"}),"CHANGED");
  assert.equal(classifySnapshotAircraftContextChange(legacy,{...same,aircraftType:"b23"}),"CHANGED");
});

test("F3.2 pure resolver does not silently repair profile or snapshot drift",()=>{
  const profileResult=allowedFlightContexts(profile());
  assert.equal(profileResult.error,undefined);

  const crafted={
    evidence:"EASA",
    aircraftClass:"SEP",
    regulatoryCategory:"",
    balloonClass:"",
    balloonGroup:"",
    aircraftType:"B23",
  };
  assert.equal(isAllowedFlightContext(crafted,profileResult.contexts??[]),false);

  const stored={...crafted};
  assert.equal(classifySnapshotAircraftContextChange(stored,crafted),"UNCHANGED");
});
