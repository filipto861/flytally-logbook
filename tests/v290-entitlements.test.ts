import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  entitlementPolicyForStage,
  mergeEntitlementGrants,
} from "../lib/entitlements.ts";

const root=path.resolve(import.meta.dirname,"..");
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");

test("C3 grants current beta users provider-agnostic Logbook and Training access",()=>{
  const grants=entitlementPolicyForStage("external-validation","user");
  assert.deepEqual(grants.map(item=>item.key),["logbook.access","training.access"]);
  assert.ok(grants.every(item=>item.source==="private-beta"));
});

test("C3 admin access is independent of a future commercial billing provider",()=>{
  const grants=entitlementPolicyForStage("commercial","admin");
  assert.deepEqual(grants.map(item=>item.key),["logbook.access","training.access"]);
  assert.ok(grants.every(item=>item.source==="admin"));
});

test("C3 regular commercial access fails closed until a durable grant exists",()=>{
  assert.deepEqual(entitlementPolicyForStage("commercial","user"),[]);
  const merged=mergeEntitlementGrants([],[
    {key:"training.access",source:"billing",validUntil:1_900_000_000},
  ]);
  assert.deepEqual(merged,[{key:"training.access",source:"billing",validUntil:1_900_000_000}]);
});

test("C3 durable entitlement ledger stays provider-neutral and revocable",()=>{
  const schema=read("lib/v290-schema.ts");
  const ledger=read("lib/entitlement-ledger.ts");
  assert.match(schema,/account_entitlements/);
  assert.match(schema,/source IN \('billing','organization','manual'\)/);
  assert.match(schema,/revoked_at/);
  assert.match(ledger,/upsertDurableEntitlement/);
  assert.match(ledger,/revokeDurableEntitlement/);
  assert.doesNotMatch(ledger,/stripe|paddle|braintree/i);
});

test("C3 Training SSO emits ft2 entitlement-bearing assertions",()=>{
  const identity=read("lib/auth/training-identity.ts");
  const route=read("app/api/auth/training/start/route.ts");
  assert.match(identity,/TRAINING_IDENTITY_VERSION = "ft2"/);
  assert.match(identity,/entitlementVersion: FLYTALLY_ENTITLEMENT_VERSION/);
  assert.match(identity,/resolveAccountEntitlementSnapshot/);
  assert.match(route,/await createTrainingIdentityAssertion/);
});
