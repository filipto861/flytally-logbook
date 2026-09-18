import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";

import {
  createTrainingIdentityAssertion,
  createTrainingPrivacyErasureAssertion,
  TRAINING_PRIVACY_ERASURE_VERSION,
  type TrainingIdentityClaims,
  type TrainingPrivacyErasureClaims,
} from "../lib/auth/training-identity.ts";

const secret = "0123456789abcdef0123456789abcdef";
process.env.FLYTALLY_IDENTITY_SECRET = secret;

function decode<T>(token:string,expectedVersion:string):T {
  const [version,payload,providedSignature]=token.split(".");
  assert.equal(version,expectedVersion);
  const expected=createHmac("sha256",secret).update(`${version}.${payload}`).digest("base64url");
  assert.equal(providedSignature,expected);
  return JSON.parse(Buffer.from(payload,"base64url").toString("utf8")) as T;
}

test("Logbook emits a short-lived Training identity assertion with stable account subject", () => {
  const now = 1_800_000_000;
  const claims = decode<TrainingIdentityClaims>(createTrainingIdentityAssertion("42", "user", now),"ft1");
  assert.equal(claims.iss, "flytally-logbook");
  assert.equal(claims.aud, "flytally-training");
  assert.equal(claims.sub, "42");
  assert.equal(claims.role, "user");
  assert.equal(claims.iat, now);
  assert.equal(claims.exp, now + 120);
  assert.ok(claims.jti.length >= 8);
});

test("Logbook emits a purpose-bound Training privacy erasure assertion",()=>{
  const now=1_800_000_000;
  const claims=decode<TrainingPrivacyErasureClaims>(createTrainingPrivacyErasureAssertion("42",now),TRAINING_PRIVACY_ERASURE_VERSION);
  assert.equal(claims.iss,"flytally-logbook");
  assert.equal(claims.aud,"flytally-training");
  assert.equal(claims.purpose,"erase-training-data");
  assert.equal(claims.sub,"42");
  assert.equal(claims.iat,now);
  assert.equal(claims.exp,now+120);
  assert.ok(claims.jti.length>=8);
});
