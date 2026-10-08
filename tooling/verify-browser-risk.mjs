import { existsSync,readFileSync,rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import playwrightConfig from "../playwright.config.mjs";
import { createVerificationPlan } from "./verify-plan.mjs";
import { CandidateInputError,repositoryRoot } from "./verification-candidate.mjs";
import { evaluateEvidenceObservation } from "./evidence-contract.mjs";
import { runCandidateBuild } from "./verification-build.mjs";
import { runCommand } from "./verification-execution.mjs";
import { reusableLedgerEntry } from "./verification-reuse.mjs";
import {
  buildIdentityMatches,
  currentBuildIdentity,
  readVerificationLedgerEntry,
  verificationArtifactPath,
  writeVerificationLedgerEntry,
} from "./verification-ledger.mjs";

function canonicalCommand(argv){
  return "npm run verify:browser:risk -- "+argv.join(" ");
}

function regexpEscape(value){
  return String(value).replace(/[.*+?^$(){}|[\]\\]/g,"\\$&");
}

function targetKey(target){
  return [String(target.spec??""),String(target.title??""),String(target.project??"")].join("\0");
}

function sortedKeys(targets){
  return targets.map(targetKey).sort();
}

export function browserRiskConfiguration(browserEvidence,buildArtifact=null){
  return {
    authority:"release",
    source:"browser-risk",
    coverage:"targeted",
    workers:1,
    retries:0,
    fullyParallel:false,
    selectionHash:browserEvidence.selectionHash,
    targets:browserEvidence.targets.map(({id,spec,title,project})=>({id,spec,title,project})),
    configHash:browserEvidence.configHash,
    toolchainHash:browserEvidence.toolchainHash,
    fixtureContractHash:browserEvidence.fixtureContractHash,
    buildArtifact:buildArtifact??null,
  };
}

export function reusableBrowserRiskLedger(candidate,browserEvidence,entry){
  const artifact=entry?.effectiveConfiguration?.buildArtifact??null;
  const reuse=reusableLedgerEntry(entry,{
    candidate,
    gate:"browser-risk",
    evidenceClass:"browser-acceptance",
    configuration:browserRiskConfiguration(browserEvidence,artifact),
    allowNA:!browserEvidence.required,
  });
  if(!reuse.reusable)return reuse;
  if(!browserEvidence.required)return {reusable:true,reason:"exact-match"};
  if(!artifact)return {reusable:false,reason:"build-artifact"};

  const build=readVerificationLedgerEntry(candidate.candidateId,"build");
  if(!build||build.exitCode!==0||build.evaluation?.status!=="PASS"||
     !buildIdentityMatches(build.artifact,artifact)){
    return {reusable:false,reason:"build-ledger"};
  }
  try{
    if(!buildIdentityMatches(currentBuildIdentity(),artifact)){
      return {reusable:false,reason:"build-output"};
    }
  }catch{
    return {reusable:false,reason:"build-output"};
  }
  return {reusable:true,reason:"exact-match"};
}

function blockedLedger(candidate,argv,browserEvidence,reason,exitCode=3,buildArtifact=null){
  return writeVerificationLedgerEntry({
    gate:"browser-risk",
    evidenceClass:"browser-acceptance",
    candidate,
    canonicalCommand:canonicalCommand(argv),
    exitCode,
    effectiveConfiguration:browserRiskConfiguration(browserEvidence,buildArtifact),
    evaluation:{status:"NOT RUN",reason},
  });
}

function validRecordedBuild(candidate){
  const build=readVerificationLedgerEntry(candidate.candidateId,"build");
  if(!build||build.exitCode!==0||build.evaluation?.status!=="PASS"||!build.artifact)return null;
  try{
    const current=currentBuildIdentity();
    if(!buildIdentityMatches(build.artifact,current))return null;
  }catch{
    return null;
  }
  return build;
}

function groupTargetsByProject(targets){
  const groups=new Map();
  for(const target of targets){
    if(!groups.has(target.project))groups.set(target.project,[]);
    groups.get(target.project).push(target);
  }
  return [...groups.entries()]
    .sort(([a],[b])=>a.localeCompare(b))
    .map(([project,items])=>({project,targets:items.sort((a,b)=>targetKey(a).localeCompare(targetKey(b)))}));
}

function reportCaseTarget(item){
  return {
    spec:String(item?.spec??""),
    title:String(item?.title??""),
    project:String(item?.project??""),
  };
}

export function compareExactTargetSet(expected,actual){
  const left=sortedKeys(expected);
  const right=sortedKeys(actual);
  if(left.length!==right.length)return false;
  return left.every((value,index)=>value===right[index]);
}

export async function runBrowserRiskVerification(argv,env=process.env){
  const planResult=createVerificationPlan(argv);
  const {candidate,plan}=planResult;
  const browserEvidence=plan.browserEvidence;

  if(!browserEvidence.required){
    const ledger=writeVerificationLedgerEntry({
      gate:"browser-risk",
      evidenceClass:"browser-acceptance",
      candidate,
      canonicalCommand:canonicalCommand(argv),
      exitCode:0,
      effectiveConfiguration:browserRiskConfiguration(browserEvidence),
      evaluation:{status:"N/A",reason:"Risk-scoped browser evidence is not required for this candidate."},
    });
    return {exitCode:0,plan:planResult,ledger};
  }

  if(browserEvidence.blockers.length>0){
    const ledger=blockedLedger(
      candidate,
      argv,
      browserEvidence,
      "Risk-scoped browser evidence is blocked: "+browserEvidence.blockers.join(", "),
    );
    return {exitCode:3,plan:planResult,ledger};
  }

  if(playwrightConfig.fullyParallel!==false||playwrightConfig.workers!==1){
    const ledger=blockedLedger(
      candidate,
      argv,
      browserEvidence,
      "Risk-scoped browser acceptance requires fullyParallel=false and workers=1 in playwright.config.mjs.",
      2,
    );
    return {exitCode:2,plan:planResult,ledger};
  }

  let build=validRecordedBuild(candidate);
  let buildReused=Boolean(build);
  if(!build){
    const built=await runCandidateBuild(candidate,{env,producerCommand:canonicalCommand(argv)});
    if(built.exitCode!==0||!built.ledger?.artifact){
      const ledger=blockedLedger(
        candidate,
        argv,
        browserEvidence,
        "A successful same-candidate production build is required before risk-scoped browser acceptance.",
        built.exitCode||1,
      );
      return {exitCode:built.exitCode||1,plan:planResult,ledger};
    }
    build=built.ledger;
    buildReused=false;
  }

  const buildArtifact=build.artifact;
  const groups=groupTargetsByProject(browserEvidence.targets);
  const actualCases=[];
  const plannedCases=[];
  const executions=[];
  let executionFailure=0;
  let mismatchReason="";

  for(const group of groups){
    const reportName="browser-risk-"+group.project.replace(/[^A-Za-z0-9._-]/g,"-")+".json";
    const reportPath=verificationArtifactPath(candidate.candidateId,reportName);
    rmSync(reportPath,{force:true});
    const specs=[...new Set(group.targets.map((target)=>target.spec))].sort();
    const titles=[...new Set(group.targets.map((target)=>target.title))].sort();
    const grep="^(?:"+titles.map(regexpEscape).join("|")+")$";
    const runner=path.join(repositoryRoot,"tooling","run-auth-browser.mjs");
    const args=[
      runner,
      ...specs,
      "--project="+group.project,
      "--grep="+grep,
      "--retries=0",
      "--workers=1",
    ];
    const startedAt=Date.now();
    const execution=await runCommand(process.execPath,args,{
      env:{...env,FLYTALLY_BROWSER_EVIDENCE_FILE:reportPath},
    });
    const durationMs=Date.now()-startedAt;
    executions.push({
      project:group.project,
      command:execution.command,
      exitCode:execution.code,
      durationMs,
      expectedTargets:group.targets.map(({id,spec,title,project})=>({id,spec,title,project})),
    });

    if(!existsSync(reportPath)){
      executionFailure=execution.code===2?2:(execution.code||1);
      mismatchReason=execution.code===2
        ?"Authenticated browser configuration/preflight failed before risk evidence was produced."
        :"Risk-scoped browser execution did not produce its evidence report.";
      break;
    }

    const report=JSON.parse(readFileSync(reportPath,"utf8"));
    const effective=report.effectiveConfiguration??{};
    if(effective.workers!==1||effective.fullyParallel!==false){
      executionFailure=1;
      mismatchReason="Playwright effective configuration did not preserve workers=1 and fullyParallel=false.";
      break;
    }

    const reportPlanned=(report.plannedCases??[]).map(reportCaseTarget);
    const reportActual=(report.cases??[]).map((item)=>({
      ...reportCaseTarget(item),
      status:String(item?.status??""),
      notApplicable:Boolean(item?.notApplicable),
      retry:Number(item?.retry??0),
    }));
    plannedCases.push(...reportPlanned);
    actualCases.push(...reportActual);

    if(!compareExactTargetSet(group.targets,reportPlanned)){
      executionFailure=1;
      mismatchReason="Playwright planned cases did not exactly match the planner-selected risk target set.";
      break;
    }
    if(!compareExactTargetSet(group.targets,reportActual)){
      executionFailure=1;
      mismatchReason="Playwright executed cases did not exactly match the planner-selected risk target set.";
      break;
    }
    if(Number(report.retries??0)!==0||reportActual.some((item)=>item.retry!==0)){
      executionFailure=1;
      mismatchReason="Risk-scoped browser acceptance requires retries=0.";
      break;
    }
    if(reportActual.some((item)=>item.status==="skipped"&&!item.notApplicable)){
      executionFailure=1;
      mismatchReason="Unexpected skipped/fixme browser cases cannot satisfy risk-scoped acceptance.";
      break;
    }
    if(execution.code!==0){
      executionFailure=execution.code===2?2:1;
      mismatchReason="One or more risk-scoped browser cases failed.";
      break;
    }
  }

  const passed=actualCases.filter((item)=>item.status==="passed").length;
  const notApplicable=actualCases.filter((item)=>item.status==="skipped"&&item.notApplicable).length;
  const skipped=actualCases.filter((item)=>item.status==="skipped"&&!item.notApplicable).length;
  const failed=actualCases.filter((item)=>item.status!=="passed"&&item.status!=="skipped").length;
  const retries=actualCases.reduce((maximum,item)=>Math.max(maximum,item.retry),0);
  const observation={
    command:canonicalCommand(argv),
    coverage:"targeted",
    planned:browserEvidence.targets.length,
    passed,
    failed,
    skipped,
    notApplicable,
    retries,
    sourceGate:"browser-risk",
    authority:"release",
    selectionHash:browserEvidence.selectionHash,
    targets:browserEvidence.targets.map(({id,spec,title,project})=>({id,spec,title,project})),
    plannedCases,
    actualCases,
  };

  let evaluation=evaluateEvidenceObservation("browser-acceptance",observation);
  if(!compareExactTargetSet(browserEvidence.targets,plannedCases)||
     !compareExactTargetSet(browserEvidence.targets,actualCases)){
    evaluation={status:"PARTIAL",reason:mismatchReason||"Actual browser execution did not exactly match the planner selection."};
  }else if(executionFailure!==0){
    evaluation={
      status:executionFailure===2?"NOT RUN":"FAIL",
      reason:mismatchReason||"Risk-scoped browser execution failed.",
    };
  }

  const exitCode=executionFailure!==0
    ?executionFailure
    :(evaluation.status==="PASS"?0:1);
  const ledger=writeVerificationLedgerEntry({
    gate:"browser-risk",
    evidenceClass:"browser-acceptance",
    candidate,
    canonicalCommand:canonicalCommand(argv),
    exitCode,
    effectiveConfiguration:browserRiskConfiguration(browserEvidence,buildArtifact),
    consumedArtifacts:[{gate:"build",artifact:buildArtifact,reused:buildReused}],
    executions,
    observation,
    evaluation,
  });
  return {exitCode,plan:planResult,ledger};
}

if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]){
  try{
    const result=await runBrowserRiskVerification(process.argv.slice(2));
    process.exit(result.exitCode);
  }catch(error){
    console.error(error instanceof Error?error.message:String(error));
    process.exit(error instanceof CandidateInputError?error.exitCode:2);
  }
}
