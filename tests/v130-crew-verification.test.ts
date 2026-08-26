import test from "node:test";import assert from "node:assert/strict";
import { crewRoleCredits,normalizeCrewRole,validCrewCombination,verifierRoleForFlight } from "../lib/crew.ts";
import { credentialValidity } from "../lib/credential-validity.ts";
import { signVerificationPayload,verifyVerificationSignature } from "../lib/verification-signature.ts";

test("v1.30 supports the agreed crew roles and rejects invalid safety combinations",()=>{
  assert.equal(normalizeCrewRole("co-pilot"),"CO-PILOT");assert.equal(normalizeCrewRole("passenger"),null);
  assert.equal(validCrewCombination("PIC","SAFETY PILOT"),true);assert.equal(validCrewCombination("DUAL","SAFETY PILOT"),false);
  assert.deepEqual(crewRoleCredits("CO-PILOT",73),{role:"CO-PILOT",pic:0,copilot:73,instructor:0});
});
test("v1.30 maps training roles to the right verifier",()=>{
  assert.equal(verifierRoleForFlight("DUAL"),"INSTRUCTOR");assert.equal(verifierRoleForFlight("SPIC"),"SUPERVISING PIC");assert.equal(verifierRoleForFlight("PIC"),null);
});
test("v1.30 distinguishes unlimited, dated and recency validity",()=>{
  assert.equal(credentialValidity({mode:"unlimited"},"2026-08-26").label,"Unlimited");
  assert.equal(credentialValidity({mode:"date",validUntil:"2026-08-25"},"2026-08-26").status,"expired");
  assert.equal(credentialValidity({mode:"recency",recencyUntil:"2026-09-30"},"2026-08-26").status,"valid");
});
test("v1.30 signs the exact canonical payload and detects tampering",()=>{
  process.env.SIGNING_SECRET="v130-test-signing-secret-with-enough-entropy";
  const payload={flightId:42,revision:3,hash:"abc",credential:{type:"FI(A)"}},signature=signVerificationPayload(payload);
  assert.equal(signature.length,64);assert.equal(verifyVerificationSignature(payload,signature),true);assert.equal(verifyVerificationSignature({...payload,revision:4},signature),false);
});
