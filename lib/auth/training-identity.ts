import "server-only";

import { resolveAccountEntitlementSnapshot } from "../entitlement-ledger";
import {
  createTrainingIdentityAssertionFromGrants,
  createTrainingPrivacyErasureAssertion,
  TRAINING_IDENTITY_VERSION,
  TRAINING_PRIVACY_ERASURE_VERSION,
  type TrainingIdentityClaims,
  type TrainingIdentityRole,
  type TrainingPrivacyErasureClaims,
} from "./training-identity-contract";

export {
  createTrainingPrivacyErasureAssertion,
  TRAINING_IDENTITY_VERSION,
  TRAINING_PRIVACY_ERASURE_VERSION,
};
export type {
  TrainingIdentityClaims,
  TrainingIdentityRole,
  TrainingPrivacyErasureClaims,
};

export async function createTrainingIdentityAssertion(
  subject: string,
  role: TrainingIdentityRole,
  nowSeconds = Math.floor(Date.now() / 1000),
): Promise<string> {
  const userId=Number(subject);
  if(!Number.isSafeInteger(userId)||userId<1)throw new Error("Invalid FlyTally account subject.");
  const snapshot=await resolveAccountEntitlementSnapshot(userId,role,process.env,nowSeconds);
  return createTrainingIdentityAssertionFromGrants(subject,role,snapshot.grants,nowSeconds);
}
