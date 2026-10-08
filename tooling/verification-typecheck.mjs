import { runNpm } from "./verification-execution.mjs";
import { verificationConfigIdentity,declaredToolchainIdentity } from "./verification-identity.mjs";
import { writeVerificationLedgerEntry } from "./verification-ledger.mjs";

export function typecheckVerificationConfiguration(){
  return {
    configHash:verificationConfigIdentity().hash,
    toolchainHash:declaredToolchainIdentity().hash,
  };
}

export async function runTypecheckVerification(candidate,{canonicalCommand="internal",env=process.env,required=true}={}){
  const configuration=typecheckVerificationConfiguration();
  if(!required){
    const ledger=writeVerificationLedgerEntry({
      gate:"typecheck",
      candidate,
      canonicalCommand,
      exitCode:0,
      effectiveConfiguration:configuration,
      evaluation:{status:"N/A",reason:"TypeScript is not required for this candidate."},
    });
    return {exitCode:0,ledger,configuration};
  }

  const execution=await runNpm(["run","typecheck"],{env});
  const exitCode=execution.code===0?0:execution.code||1;
  const ledger=writeVerificationLedgerEntry({
    gate:"typecheck",
    candidate,
    canonicalCommand,
    exitCode,
    effectiveConfiguration:configuration,
    observation:{command:execution.command},
    evaluation:execution.code===0
      ?{status:"PASS",reason:"TypeScript completed successfully."}
      :{status:"FAIL",reason:"TypeScript failed."},
  });
  return {exitCode,ledger,configuration};
}
