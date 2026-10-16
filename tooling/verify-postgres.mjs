import { fileURLToPath } from "node:url";
import { createVerificationPlan } from "./verify-plan.mjs";
import { CandidateInputError } from "./verification-candidate.mjs";
import { evaluateEvidenceObservation } from "./evidence-contract.mjs";
import { preflightPostgresGate,selectPostgresTests } from "./run-postgres-tests.mjs";
import { runNodeTests } from "./verification-execution.mjs";
import { writeVerificationLedgerEntry } from "./verification-ledger.mjs";
import { verificationConfigIdentity,declaredToolchainIdentity } from "./verification-identity.mjs";
import {runOwnedPr340PostgresAcceptance,assertPr340AcceptancePreflight} from "./pr340-owned-postgres-acceptance.mjs";

function canonicalCommand(argv){
  return "npm run verify:postgres -- "+argv.join(" ");
}

export function postgresVerificationConfiguration(env=process.env){
  const tests=selectPostgresTests("full").map((name)=>"tests/integration/"+name);
  return {
    mode:env.FLYTALLY_PR340_PARTITION_RELEASE==="1"?"pr340-six-owned-pg16":"full",
    benchmarkProfile:env.FLYTALLY_PR340_PARTITION_RELEASE==="1"?"shared-core-work_mem-64MB":"database-default",
    localhostOnly:true,
    testFiles:tests,
    configHash:verificationConfigIdentity().hash,
    toolchainHash:declaredToolchainIdentity().hash,
  };
}

export async function runPostgresVerification(argv,env=process.env){
  const plan=createVerificationPlan(argv);
  const {candidate}=plan;
  let gateEnv;
  const configuration=postgresVerificationConfiguration(env);

  try{
    gateEnv=preflightPostgresGate(env);
    if(configuration.mode==="pr340-six-owned-pg16")assertPr340AcceptancePreflight({candidate,env});
  }catch(error){
    const reason=error instanceof Error?error.message:String(error);
    const ledger=writeVerificationLedgerEntry({
      gate:"postgres",
      evidenceClass:"postgres-acceptance",
      candidate,
      canonicalCommand:canonicalCommand(argv),
      exitCode:2,
      effectiveConfiguration:configuration,
      evaluation:{status:"NOT RUN",reason},
    });
    return {exitCode:2,plan,ledger};
  }

  let observation=null,executionCode=0,executionFailure=null;
  if(configuration.mode==="pr340-six-owned-pg16"){
    try{
      observation=runOwnedPr340PostgresAcceptance({candidate,env});
    }catch(error){
      executionCode=1;
      executionFailure=error instanceof Error?error.message:String(error);
      console.error("PR340 PostgreSQL partition acceptance failed: "+executionFailure);
    }
  }else{
    const execution=await runNodeTests(configuration.testFiles,{
      coverage:"full",env:{...gateEnv,FLYTALLY_POSTGRES_INTEGRATION:"1"},
    });
    observation=execution.summary?{
      command:execution.command,coverage:"full",...execution.summary,sourceGate:"postgres",
    }:null;
    executionCode=execution.code;
  }
  const evaluation=observation
    ?evaluateEvidenceObservation("postgres-acceptance",observation)
    :{status:"FAIL",reason:executionFailure??
       "PostgreSQL execution failed before an evidence summary was produced."};
  const exitCode=executionCode!==0?executionCode:(evaluation.status==="PASS"?0:1);

  const ledger=writeVerificationLedgerEntry({
    gate:"postgres",
    evidenceClass:"postgres-acceptance",
    candidate,
    canonicalCommand:canonicalCommand(argv),
    exitCode,
    effectiveConfiguration:configuration,
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
