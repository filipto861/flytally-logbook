import assert from "node:assert/strict";
import test from "node:test";

import {
  hasAccountEntitlement,
  resolveAccountEntitlementSnapshot,
} from "../lib/entitlements.ts";

const externalValidationEnv = { FLYTALLY_LAUNCH_STAGE: "external-validation" } as const;

test("C3 grants current beta users provider-agnostic Logbook and Training access",()=>{
  const snapshot=resolveAccountEntitlementSnapshot("42","user",externalValidationEnv,1_800_000_000);
  assert.equal(snapshot.version,1);
  assert.equal(snapshot.stage,"external-validation");
  assert.deepEqual(snapshot.grants.map(item=>item.key),["logbook.access","training.access"]);
  assert.ok(snapshot.grants.every(item=>item.source==="private-beta"));
  assert.equal(hasAccountEntitlement(snapshot,"training.access",1_800_000_010),true);
});

test("C3 admin access is independent of a future commercial billing provider",()=>{
  const snapshot=resolveAccountEntitlementSnapshot("1","admin",{
    FLYTALLY_LAUNCH_STAGE:"commercial",
  },1_800_000_000);
  assert.deepEqual(snapshot.grants.map(item=>item.key),["logbook.access","training.access"]);
  assert.ok(snapshot.grants.every(item=>item.source==="admin"));
});

test("C3 regular commercial access fails closed until a durable grant source exists",()=>{
  // Commercial is currently blocked by C1/C2 gates, but the resolver must still
  // be safe if those gates are eventually cleared.
  const commercialEnv={
    FLYTALLY_LAUNCH_STAGE:"commercial",
    LEGAL_OPERATOR_NAME:"FlyTally s.r.o.",
    LEGAL_OPERATOR_ADDRESS:"Example 1",
    LEGAL_OPERATOR_ID:"CZ12345678",
    LEGAL_CONTACT_EMAIL:"support@fly-tally.com",
  };
  const snapshot=resolveAccountEntitlementSnapshot("42","user",commercialEnv,1_800_000_000);
  assert.notEqual(snapshot.stage,"commercial");
  assert.equal(hasAccountEntitlement(snapshot,"training.access"),true);
});
