import { fileURLToPath } from "node:url";
import { createVerificationPlan } from "./verify-plan.mjs";
import { CandidateInputError } from "./verification-candidate.mjs";
import { evaluateEvidenceObservation } from "./evidence-contract.mjs";
import { preflightPostgresGate,selectPostgresTests } from "./run-postgres-tests.mjs";
import { runNodeTests } from "./verification-execution.mjs";
import { writeVerificationLedgerEntry } from "./verification-ledger.mjs";

function canonicalCommand(argv){
  return "npm run verify:postgres -- "+argv.join(" ");
}

export async function runPostgresVerification(argv,env=process.env){
  const plan=createVerificationPlan(argv);
  const {candidate}=plan;
  let gateEnv;

  try{
    gateEnv=preflightPostgresGate(env);
  }catch(error){
    const reason=error instanceof Error?error.message:String(error);
    const ledger=writeVerificationLedgerEntry({
      gate:"postgres",
      evidenceClass:"postgres-acceptance",
      candidate,
      canonicalCommand:canonicalCommand(argv),
      exitCode:2,
      effectiveConfiguration:{mode:"full",localhostOnly:true},
      evaluation:{status:"NOT RUN",reason},
    });
    return {exitCode:2,plan,ledger};
  }

  const tests=selectPostgresTests("full").map((name)=>"tests/integration/"+name);
  const execution=await runNodeTests(tests,{
    coverage:"full",
    env:{...gateEnv,FLYTALLY_POSTGRES_INTEGRATION:"1"},
  });
  const observation=execution.summary?{
    command:execution.command,
    coverage:"full",
    ...execution.summary,
    sourceGate:"postgres",
  }:null;
  const evaluation=observation
    ?evaluateEvidenceObservation("postgres-acceptance",observation)
    :{status:"FAIL",reason:"PostgreSQL execution failed before an evidence summary was produced."};
  const exitCode=execution.code!==0?execution.code:(evaluation.status==="PASS"?0:1);

  const ledger=writeVerificationLedgerEntry({
    gate:"postgres",
    evidenceClass:"postgres-acceptance",
    candidate,
    canonicalCommand:canonicalCommand(argv),
    exitCode,
    effectiveConfiguration:{mode:"full",localhostOnly:true,testFiles:tests},
    observation,
    evaluation,
  });
  return {exitCode,plan,ledger};
}

if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]){
  try{
    const result=await runPostgresVerification(process.argv.slice(2));
    process.exit(result.exitCode);
  }catch(error){
    console.error(error instanceof Error?error.message:String(error));
    process.exit(error instanceof CandidateInputError?error.exitCode:2);
  }
}
