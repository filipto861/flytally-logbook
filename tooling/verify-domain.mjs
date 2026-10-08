import { fileURLToPath } from "node:url";
import { createVerificationPlan } from "./verify-plan.mjs";
import { CandidateInputError } from "./verification-candidate.mjs";
import { evaluateEvidenceObservation } from "./evidence-contract.mjs";
import { runNodeTests } from "./verification-execution.mjs";
import { writeVerificationLedgerEntry } from "./verification-ledger.mjs";

function canonicalCommand(argv){
  return "npm run verify:domain -- "+argv.join(" ");
}

export async function runDomainVerification(argv){
  const result=createVerificationPlan(argv);
  const {candidate,plan}=result;
  const direct=plan.directEvidence["domain-unit"];

  if(plan.blockedEvidence.length>0){
    const ledger=writeVerificationLedgerEntry({
      gate:"domain",
      evidenceClass:"domain-unit",
      candidate,
      canonicalCommand:canonicalCommand(argv),
      exitCode:3,
      effectiveConfiguration:{coverage:"targeted",modules:direct.modules,tests:direct.tests},
      evaluation:{
        status:"NOT RUN",
        reason:"Required direct domain evidence is unavailable: "+plan.blockedEvidence.join(", "),
      },
    });
    return {exitCode:3,plan:result,ledger};
  }

  if(!direct.required){
    const ledger=writeVerificationLedgerEntry({
      gate:"domain",
      evidenceClass:"domain-unit",
      candidate,
      canonicalCommand:canonicalCommand(argv),
      exitCode:0,
      effectiveConfiguration:{coverage:"targeted",modules:[],tests:[]},
      evaluation:{status:"N/A",reason:"Domain-unit evidence is not required for this candidate."},
    });
    return {exitCode:0,plan:result,ledger};
  }

  const execution=await runNodeTests(direct.tests,{coverage:"targeted"});
  const observation=execution.summary?{
    command:execution.command,
    coverage:"targeted",
    ...execution.summary,
    sourceGate:"domain-unit",
  }:null;
  const evaluation=observation
    ?evaluateEvidenceObservation("domain-unit",observation)
    :{status:"FAIL",reason:"Domain test execution failed before an evidence summary was produced."};
  const exitCode=execution.code!==0?execution.code:(evaluation.status==="PASS"?0:1);

  const ledger=writeVerificationLedgerEntry({
    gate:"domain",
    evidenceClass:"domain-unit",
    candidate,
    canonicalCommand:canonicalCommand(argv),
    exitCode,
    effectiveConfiguration:{coverage:"targeted",modules:direct.modules,tests:direct.tests},
    observation,
    evaluation,
  });
  return {exitCode,plan:result,ledger};
}

if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]){
  try{
    const result=await runDomainVerification(process.argv.slice(2));
    process.exit(result.exitCode);
  }catch(error){
    console.error(error instanceof Error?error.message:String(error));
    process.exit(error instanceof CandidateInputError?error.exitCode:2);
  }
}
