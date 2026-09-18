import assert from "node:assert/strict";
import test from "node:test";
import { getCommercialReadiness } from "../lib/commercial-readiness.ts";

const clearedEnv = {
  FLYTALLY_LAUNCH_STAGE: "commercial",
  LEGAL_OPERATOR_NAME: "FlyTally s.r.o.",
  LEGAL_OPERATOR_ADDRESS: "Example 1, Prague, Czechia",
  LEGAL_OPERATOR_ID: "CZ12345678",
  LEGAL_CONTACT_EMAIL: "support@fly-tally.com",
  COMMERCIAL_LEGAL_REVIEW_STATUS: "APPROVED",
  COMMERCIAL_CONSUMER_LAW_ADR_STATUS: "APPROVED",
  COMMERCIAL_PRIVACY_PROCESSOR_STATUS: "APPROVED",
  COMMERCIAL_TRAINING_SOURCE_RIGHTS_STATUS: "APPROVED",
  COMMERCIAL_SUPPORT_OPERATIONS_STATUS: "APPROVED",
  COMMERCIAL_POLICIES_STATUS: "APPROVED",
  COMMERCIAL_TERMS_PUBLISHED_STATUS: "APPROVED",
  COMMERCIAL_BILLING_STATUS: "APPROVED",
  COMMERCIAL_QES_STATUS: "NOT_REQUIRED",
  COMMERCIAL_AVIATION_VALIDATION_STATUS: "NOT_REQUIRED",
  COMMERCIAL_TRADEMARK_STATUS: "APPROVED",
  COMMERCIAL_MARKETING_CLAIMS_STATUS: "APPROVED",
} as const;

test("v2.9 commercial launch defaults fail closed to private beta", () => {
  const readiness = getCommercialReadiness({});
  assert.equal(readiness.requestedStage, "private-beta");
  assert.equal(readiness.effectiveStage, "private-beta");
  assert.equal(readiness.commercialEnabled, false);
  assert.ok(readiness.blockers.includes("operator-identity"));
  assert.ok(readiness.blockers.includes("commercial-legal-publication"));
});

test("v2.9 cannot enable commercial mode merely by requesting it", () => {
  const readiness = getCommercialReadiness({ FLYTALLY_LAUNCH_STAGE: "commercial" });
  assert.equal(readiness.requestedStage, "commercial");
  assert.equal(readiness.effectiveStage, "external-validation");
  assert.equal(readiness.commercialEnabled, false);
  assert.ok(readiness.blockers.length > 5);
});

test("v2.9 treats mandatory NOT_REQUIRED as unresolved but allows it for reviewed decision gates", () => {
  const readiness = getCommercialReadiness({
    ...clearedEnv,
    COMMERCIAL_LEGAL_REVIEW_STATUS: "NOT_REQUIRED",
    COMMERCIAL_QES_STATUS: "NOT_REQUIRED",
  });
  assert.equal(readiness.commercialEnabled, false);
  assert.ok(readiness.blockers.includes("legal-review"));
  assert.ok(!readiness.blockers.includes("qes"));
});

test("v2.9 can record complete external validation while C2 legal publication remains incomplete", () => {
  const readiness = getCommercialReadiness(clearedEnv);
  assert.equal(readiness.configurationValid, true);
  assert.equal(readiness.operatorIdentityComplete, true);
  assert.equal(readiness.externalValidationComplete, true);
  assert.deepEqual(readiness.blockers, ["commercial-legal-publication"]);
  assert.equal(readiness.effectiveStage, "external-validation");
  assert.equal(readiness.commercialEnabled, false);
});

test("v2.9 invalid launch-stage configuration fails closed", () => {
  const readiness = getCommercialReadiness({
    ...clearedEnv,
    FLYTALLY_LAUNCH_STAGE: "public",
  });
  assert.equal(readiness.configurationValid, false);
  assert.equal(readiness.requestedStage, "private-beta");
  assert.equal(readiness.effectiveStage, "private-beta");
  assert.equal(readiness.commercialEnabled, false);
  assert.ok(readiness.blockers.includes("launch-stage-configuration"));
});
