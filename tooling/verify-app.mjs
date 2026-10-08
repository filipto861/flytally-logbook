import { fileURLToPath } from "node:url";
import { createVerificationPlan } from "./verify-plan.mjs";
import { CandidateInputError } from "./verification-candidate.mjs";
import { parseNodeTestSummary,runNpm } from "./verification-execution.mjs";
import { runCandidateBuild } from "./verification-build.mjs";
import { writeVerificationLedgerEntry } from "./verification-ledger.mjs";

function canonicalCommand(argv){
  return "npm run verify:app -- "+argv.join(" ");
}

export async function runAppVerification(argv,env=process.env){
  const plan=createVerificationPlan(argv);
  const {candidate}=plan;
  const steps={
    typecheck:{status:"NOT RUN"},
    aggregateRegression:{status:"NOT RUN"},
    build:{status:"NOT RUN"},
  };

  const typecheck=await runNpm(["run","typecheck"],{env});
  steps.typecheck={
    status:typecheck.code===0?"PASS":"FAIL",
    exitCode:typecheck.code,
    command:typecheck.command,
  };
  if(typecheck.code!==0){
    const ledger=writeVerificationLedgerEntry({
      gate:"app",
      candidate,
      canonicalCommand:canonicalCommand(argv),
      exitCode:typecheck.code,
      effectiveConfiguration:{typecheck:true,aggregateRegression:true,productionBuild:true},
      steps,
      evaluation:{status:"FAIL",reason:"TypeScript gate failed; later application steps did not run."},
    });
    return {exitCode:typecheck.code,plan,ledger};
  }

  const tests=await runNpm(["test"],{env});
  let testSummary=null,summaryError=null;
  try{
    testSummary=parseNodeTestSummary(tests.stdout+"\n"+tests.stderr);
  }catch(error){
    summaryError=error instanceof Error?error.message:String(error);
  }
  steps.aggregateRegression={
    status:tests.code===0&&testSummary?"PASS":"FAIL",
    exitCode:tests.code,
    command:tests.command,
    summary:testSummary,
    evidenceClass:null,
    note:"Aggregate regression does not synthesize behavioral evidence.",
  };
  if(tests.code!==0||!testSummary){
    const exitCode=tests.code||1;
    const ledger=writeVerificationLedgerEntry({
      gate:"app",
      candidate,
      canonicalCommand:canonicalCommand(argv),
      exitCode,
      effectiveConfiguration:{typecheck:true,aggregateRegression:true,productionBuild:true},
      steps,
      evaluation:{
        status:"FAIL",
        reason:tests.code!==0?"Aggregate regression gate failed.":summaryError??"Aggregate regression evidence summary was unavailable.",
      },
    });
    return {exitCode,plan,ledger};
  }

  const buildResult=await runCandidateBuild(candidate,{
    env,
    producerCommand:"npm run verify:app -- "+argv.join(" "),
  });
  steps.build=buildResult.step;
  if(buildResult.exitCode!==0){
    const ledger=writeVerificationLedgerEntry({
      gate:"app",
      candidate,
      canonicalCommand:canonicalCommand(argv),
      exitCode:buildResult.exitCode,
      effectiveConfiguration:{typecheck:true,aggregateRegression:true,productionBuild:true},
      steps,
      evaluation:{
        status:buildResult.step.status==="PARTIAL"?"PARTIAL":"FAIL",
        reason:buildResult.step.reason??"Production build failed.",
      },
    });
    return {exitCode:buildResult.exitCode,plan,ledger};
  }

  const ledger=writeVerificationLedgerEntry({
    gate:"app",
    candidate,
    canonicalCommand:canonicalCommand(argv),
    exitCode:0,
    effectiveConfiguration:{typecheck:true,aggregateRegression:true,productionBuild:true},
    steps,
    evaluation:{status:"PASS",reason:"TypeScript, aggregate regression and production build completed successfully."},
  });
  return {exitCode:0,plan,ledger};
}

if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]){
  try{
    const result=await runAppVerification(process.argv.slice(2));
    process.exit(result.exitCode);
  }catch(error){
    console.error(error instanceof Error?error.message:String(error));
    process.exit(error instanceof CandidateInputError?error.exitCode:2);
  }
}
