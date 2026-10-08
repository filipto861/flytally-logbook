import { parseNodeTestSummary,runNpm } from "./verification-execution.mjs";
import { verificationConfigIdentity,declaredToolchainIdentity } from "./verification-identity.mjs";
import { writeVerificationLedgerEntry } from "./verification-ledger.mjs";

export function aggregateVerificationConfiguration(){
  return {
    coverage:"full",
    configHash:verificationConfigIdentity().hash,
    toolchainHash:declaredToolchainIdentity().hash,
  };
}

export async function runAggregateVerification(candidate,{canonicalCommand="internal",env=process.env,required=true}={}){
  const configuration=aggregateVerificationConfiguration();
  if(!required){
    const ledger=writeVerificationLedgerEntry({
      gate:"aggregate",
      candidate,
      canonicalCommand,
      exitCode:0,
      effectiveConfiguration:configuration,
      evaluation:{status:"N/A",reason:"Aggregate regression is not required for this candidate."},
    });
    return {exitCode:0,ledger,configuration};
  }

  const execution=await runNpm(["test"],{env});
  let summary=null;
  let summaryError=null;
  try{
    summary=parseNodeTestSummary(execution.stdout+"\n"+execution.stderr);
  }catch(error){
    summaryError=error instanceof Error?error.message:String(error);
  }

  const exitCode=execution.code!==0?execution.code:(summary?0:1);
  const evaluation=exitCode===0
    ?{status:"PASS",reason:"Aggregate regression completed successfully."}
    :{status:"FAIL",reason:execution.code!==0?"Aggregate regression failed.":summaryError??"Aggregate regression summary was unavailable."};
  const ledger=writeVerificationLedgerEntry({
    gate:"aggregate",
    candidate,
    canonicalCommand,
    exitCode,
    effectiveConfiguration:configuration,
    observation:summary?{
      command:execution.command,
      coverage:"full",
      ...summary,
      evidenceClass:null,
      note:"Aggregate regression does not synthesize behavioral evidence.",
    }:null,
    evaluation,
  });
  return {exitCode,ledger,configuration};
}
