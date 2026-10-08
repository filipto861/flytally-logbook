import { fileURLToPath } from "node:url";
import { createVerificationPlan } from "./verify-plan.mjs";
import { CandidateInputError } from "./verification-candidate.mjs";
import { npmExecutable,parseNodeTestSummary,runCommand } from "./verification-execution.mjs";
import { currentBuildIdentity,writeVerificationLedgerEntry } from "./verification-ledger.mjs";

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

  const typecheck=await runCommand(npmExecutable,["run","typecheck"],{env});
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
    });
    return {exitCode:typecheck.code,plan,ledger};
  }

  const tests=await runCommand(npmExecutable,["test"],{env});
  let testSummary=null;
  try{
    testSummary=parseNodeTestSummary(tests.stdout+"\n"+tests.stderr);
  }catch(error){
    if(tests.code===0)throw error;
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
    });
    return {exitCode,plan,ledger};
  }

  const build=await runCommand(npmExecutable,["run","build"],{env});
  steps.build={
    status:build.code===0?"PASS":"FAIL",
    exitCode:build.code,
    command:build.command,
  };
  if(build.code!==0){
    writeVerificationLedgerEntry({
      gate:"build",
      artifactClass:"build",
      candidate,
      canonicalCommand:build.command,
      exitCode:build.code,
      effectiveConfiguration:{productionBuild:true},
      evaluation:{status:"FAIL",reason:"Production build failed."},
    });
    const ledger=writeVerificationLedgerEntry({
      gate:"app",
      candidate,
      canonicalCommand:canonicalCommand(argv),
      exitCode:build.code,
      effectiveConfiguration:{typecheck:true,aggregateRegression:true,productionBuild:true},
      steps,
    });
    return {exitCode:build.code,plan,ledger};
  }

  let artifact;
  try{
    artifact=currentBuildIdentity();
  }catch(error){
    const reason=error instanceof Error?error.message:String(error);
    writeVerificationLedgerEntry({
      gate:"build",
      artifactClass:"build",
      candidate,
      canonicalCommand:build.command,
      exitCode:1,
      effectiveConfiguration:{productionBuild:true},
      evaluation:{status:"PARTIAL",reason},
    });
    steps.build={...steps.build,status:"PARTIAL",reason};
    const ledger=writeVerificationLedgerEntry({
      gate:"app",
      candidate,
      canonicalCommand:canonicalCommand(argv),
      exitCode:1,
      effectiveConfiguration:{typecheck:true,aggregateRegression:true,productionBuild:true},
      steps,
    });
    return {exitCode:1,plan,ledger};
  }

  writeVerificationLedgerEntry({
    gate:"build",
    artifactClass:"build",
    candidate,
    canonicalCommand:build.command,
    exitCode:0,
    effectiveConfiguration:{productionBuild:true},
    artifact,
    evaluation:{
      status:"PASS",
      reason:"Production build completed and a candidate-bound Next.js build identity was recorded.",
    },
  });
  const ledger=writeVerificationLedgerEntry({
    gate:"app",
    candidate,
    canonicalCommand:canonicalCommand(argv),
    exitCode:0,
    effectiveConfiguration:{typecheck:true,aggregateRegression:true,productionBuild:true},
    steps,
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
