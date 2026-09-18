import assert from "node:assert/strict";
import test from "node:test";

import {
  entitlementPolicyForStage,
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
  assert.deepEqual(entitlementPolicyForStage("commercial","user"),[]);
  assert.deepEqual(
    entitlementPolicyForStage("commercial","admin").map(item=>item.key),
    ["logbook.access","training.access"],
  );
});
