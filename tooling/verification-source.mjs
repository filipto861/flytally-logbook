import { selectTestGroupsByEvidenceClass } from "./development-evidence.mjs";
import { evaluateEvidenceObservation } from "./evidence-contract.mjs";
import { runNodeTests } from "./verification-execution.mjs";
import { verificationConfigIdentity,declaredToolchainIdentity } from "./verification-identity.mjs";
import { writeVerificationLedgerEntry } from "./verification-ledger.mjs";

export function selectApplicationSourceContract(plan){
  const selected=selectTestGroupsByEvidenceClass(plan.testGroups,"application-source-contract");
  const required=(plan.requiredEvidence??[]).includes("application-source-contract");
  return {required,groups:selected.groups,tests:selected.tests};
}

export function applicationSourceConfiguration(plan){
  const selected=selectApplicationSourceContract(plan);
  return {
    coverage:"targeted",
    groups:selected.groups,
    tests:selected.tests,
    configHash:verificationConfigIdentity().hash,
    toolchainHash:declaredToolchainIdentity().hash,
  };
}

export async function runApplicationSourceVerification(planResult,{canonicalCommand="internal",env=process.env}={}){
  const {candidate,plan}=planResult;
  const selected=selectApplicationSourceContract(plan);
  const configuration=applicationSourceConfiguration(plan);

  if(!selected.required){
    const ledger=writeVerificationLedgerEntry({
      gate:"source",
      evidenceClass:"application-source-contract",
      candidate,
      canonicalCommand,
      exitCode:0,
      effectiveConfiguration:configuration,
      evaluation:{status:"N/A",reason:"Application source-contract evidence is not required for this candidate."},
    });
    return {exitCode:0,ledger,configuration,selected};
  }

  if(selected.groups.length===0||selected.tests.length===0){
    const ledger=writeVerificationLedgerEntry({
      gate:"source",
      evidenceClass:"application-source-contract",
      candidate,
      canonicalCommand,
      exitCode:3,
      effectiveConfiguration:configuration,
      evaluation:{status:"NOT RUN",reason:"Required application source-contract evidence has no approved test group."},
    });
    return {exitCode:3,ledger,configuration,selected};
  }

  const execution=await runNodeTests(selected.tests,{env,coverage:"targeted"});
  const observation=execution.summary?{
    command:execution.command,
    coverage:"targeted",
    ...execution.summary,
    sourceGates:selected.groups,
  }:null;
  const evaluation=observation
    ?evaluateEvidenceObservation("application-source-contract",observation)
    :{status:"FAIL",reason:"Source-contract execution failed before an evidence summary was produced."};
  const exitCode=execution.code!==0?execution.code:(evaluation.status==="PASS"?0:1);
  const ledger=writeVerificationLedgerEntry({
    gate:"source",
    evidenceClass:"application-source-contract",
    candidate,
    canonicalCommand,
    exitCode,
    effectiveConfiguration:configuration,
    observation,
    evaluation,
  });
  return {exitCode,ledger,configuration,selected};
}
