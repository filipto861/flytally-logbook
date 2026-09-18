import "server-only";

import { createTrainingPrivacyErasureAssertion } from "@/lib/auth/training-identity";

function trainingOrigin():URL{
  const configured=process.env.TRAINING_APP_URL?.trim();
  if(!configured)throw new Error("TRAINING_APP_URL is not configured.");
  const url=new URL(configured);
  if(process.env.NODE_ENV==="production"&&url.protocol!=="https:")throw new Error("TRAINING_APP_URL must use HTTPS in production.");
  return url;
}

/**
 * Main account deletion fails closed on this handoff. Training progress has no
 * aviation-record retention reason, and deleting the Logbook identity first
 * would otherwise strand the user without self-service access to that data.
 */
export async function eraseTrainingDataForAccount(accountSubject:string):Promise<void>{
  const target=new URL("/api/internal/privacy/erase",trainingOrigin());
  const assertion=createTrainingPrivacyErasureAssertion(accountSubject);
  const response=await fetch(target,{
    method:"POST",
    headers:{authorization:`FlyTally-Privacy ${assertion}`},
    cache:"no-store",
    signal:AbortSignal.timeout(10_000),
  });
  if(!response.ok)throw new Error(`Training privacy erasure failed with HTTP ${response.status}.`);
}
