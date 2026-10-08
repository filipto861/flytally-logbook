import { existsSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import playwrightConfig from "../playwright.config.mjs";
import { createVerificationPlan } from "./verify-plan.mjs";
import { CandidateInputError,repositoryRoot } from "./verification-candidate.mjs";
import { evaluateEvidenceObservation } from "./evidence-contract.mjs";
import { runCommand } from "./verification-execution.mjs";
import {
  buildIdentityMatches,
  currentBuildIdentity,
  readVerificationLedgerEntry,
  verificationArtifactPath,
  writeVerificationLedgerEntry,
} from "./verification-ledger.mjs";

function canonicalCommand(argv){
  return "npm run verify:browser -- "+argv.join(" ");
}

function blockedLedger(candidate,argv,reason){
  return writeVerificationLedgerEntry({
    gate:"browser",
    evidenceClass:"browser-acceptance",
    candidate,
    canonicalCommand:canonicalCommand(argv),
    exitCode:3,
    effectiveConfiguration:{coverage:"full",workers:1,retries:0,fullyParallel:false},
    evaluation:{status:"NOT RUN",reason},
  });
}

export async function runBrowserVerification(argv,env=process.env){
  const plan=createVerificationPlan(argv);
  const {candidate}=plan;

  if(playwrightConfig.fullyParallel!==false||playwrightConfig.workers!==1){
    const reason="Canonical browser acceptance requires fullyParallel=false and workers=1 in playwright.config.mjs.";
    const ledger=writeVerificationLedgerEntry({
      gate:"browser",
      evidenceClass:"browser-acceptance",
      candidate,
      canonicalCommand:canonicalCommand(argv),
      exitCode:2,
      effectiveConfiguration:{
        coverage:"full",
        workers:playwrightConfig.workers,
        retries:0,
        fullyParallel:playwrightConfig.fullyParallel,
      },
      evaluation:{status:"NOT RUN",reason},
    });
    return {exitCode:2,plan,ledger};
  }

  const build=readVerificationLedgerEntry(candidate.candidateId,"build");
  if(!build||build.exitCode!==0||build.evaluation?.status!=="PASS"||!build.artifact){
    const ledger=blockedLedger(candidate,argv,"A successful candidate-bound production build ledger is required before browser acceptance.");
    return {exitCode:3,plan,ledger};
  }

  let current;
  try{
    current=currentBuildIdentity();
  }catch(error){
    const ledger=blockedLedger(candidate,argv,error instanceof Error?error.message:String(error));
    return {exitCode:3,plan,ledger};
  }
  if(!buildIdentityMatches(build.artifact,current)){
    const ledger=blockedLedger(candidate,argv,"The current Next.js build output does not match the recorded build artifact for this candidate.");
    return {exitCode:3,plan,ledger};
  }

  const reportPath=verificationArtifactPath(candidate.candidateId,"browser-evidence.json");
  rmSync(reportPath,{force:true});
  const runner=path.join(repositoryRoot,"tooling","run-auth-browser.mjs");
  const execution=await runCommand(
    process.execPath,
    [runner,"--retries=0","--workers=1"],
    {env:{...env,FLYTALLY_BROWSER_EVIDENCE_FILE:reportPath}},
  );

  if(!existsSync(reportPath)){
    const reason=execution.code===2
      ?"Authenticated browser acceptance configuration/preflight failed before Playwright evidence was produced."
      :"Authenticated browser acceptance did not produce its evidence report.";
    const ledger=writeVerificationLedgerEntry({
      gate:"browser",
      evidenceClass:"browser-acceptance",
      candidate,
      canonicalCommand:canonicalCommand(argv),
      exitCode:execution.code,
      effectiveConfiguration:{coverage:"full",workers:1,retries:0,fullyParallel:false},
      consumedArtifacts:[{gate:"build",artifact:build.artifact}],
      evaluation:{status:"NOT RUN",reason},
    });
    return {exitCode:execution.code||1,plan,ledger};
  }

  const report=JSON.parse(readFileSync(reportPath,"utf8"));
  const observation={
    command:execution.command,
    coverage:"full",
    planned:Number(report.planned??0),
    passed:Number(report.passed??0),
    failed:Number(report.failed??0),
    skipped:Number(report.skipped??0),
    notApplicable:Number(report.notApplicable??0),
    retries:Number(report.retries??0),
    sourceGate:"browser",
  };
  let evaluation=evaluateEvidenceObservation("browser-acceptance",observation);
  const effective=report.effectiveConfiguration??{};
  if(effective.workers!==1||effective.fullyParallel!==false){
    evaluation={
      status:"PARTIAL",
      reason:"Playwright effective configuration did not preserve workers=1 and fullyParallel=false.",
    };
  }
  const exitCode=execution.code!==0?execution.code:(evaluation.status==="PASS"?0:1);
  const ledger=writeVerificationLedgerEntry({
    gate:"browser",
    evidenceClass:"browser-acceptance",
    candidate,
    canonicalCommand:canonicalCommand(argv),
    exitCode,
    effectiveConfiguration:{
      coverage:"full",
      workers:effective.workers,
      retries:observation.retries,
      fullyParallel:effective.fullyParallel,
      projects:effective.projects??[],
    },
    consumedArtifacts:[{gate:"build",artifact:build.artifact}],
    observation,
    evaluation,
  });
  return {exitCode,plan,ledger};
}

if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]){
  try{
    const result=await runBrowserVerification(process.argv.slice(2));
    process.exit(result.exitCode);
  }catch(error){
    console.error(error instanceof Error?error.message:String(error));
    process.exit(error instanceof CandidateInputError?error.exitCode:2);
  }
}
