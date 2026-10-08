import { fileURLToPath } from "node:url";
import { CandidateInputError } from "./verification-candidate.mjs";
import { createVerificationPlan } from "./verify-plan.mjs";
import { evaluateEvidenceMatrix } from "./evidence-contract.mjs";
import { applicationSourceConfiguration,runApplicationSourceVerification } from "./verification-source.mjs";
import { domainVerificationConfiguration,runDomainVerification } from "./verify-domain.mjs";
import { typecheckVerificationConfiguration,runTypecheckVerification } from "./verification-typecheck.mjs";
import { aggregateVerificationConfiguration,runAggregateVerification } from "./verification-aggregate.mjs";
import { reusableBuildLedger,runCandidateBuild } from "./verification-build.mjs";
import { postgresVerificationConfiguration,runPostgresVerification } from "./verify-postgres.mjs";
import { reusableBrowserRiskLedger } from "./verification-browser-risk.mjs";
import { runBrowserRiskVerification } from "./verify-browser-risk.mjs";
import { verificationConfigIdentity,declaredToolchainIdentity } from "./verification-identity.mjs";
import { readVerificationLedgerEntry,writeVerificationLedgerEntry } from "./verification-ledger.mjs";
import { reusableLedgerEntry } from "./verification-reuse.mjs";

function parseReleaseArgs(argv){
  const candidateArgs=[];
  let rerun=false;
  for(const value of argv){
    if(value==="--rerun"){
      rerun=true;
      continue;
    }
    candidateArgs.push(value);
  }
  return {candidateArgs,rerun,json:candidateArgs.includes("--json")};
}

function canonicalCommand(argv){
  return "npm run verify:release:risk -- "+argv.join(" ");
}

function stepFromLedger(entry,reused=false){
  if(!entry)return {status:"NOT RUN",reused:false,reason:"No ledger observation."};
  return {
    status:entry.evaluation?.status??"NOT RUN",
    reused,
    exitCode:entry.exitCode,
    reason:entry.evaluation?.reason??"No evaluation reason.",
  };
}

function notRequired(reason){
  return {status:"N/A",reused:false,exitCode:0,reason};
}

function buildStep(entry,reused=false){
  if(!entry)return {status:"NOT RUN",reused:false,reason:"No build ledger observation."};
  return {
    status:entry.evaluation?.status??"NOT RUN",
    reused,
    exitCode:entry.exitCode,
    reason:entry.evaluation?.reason??"No build evaluation reason.",
    artifact:entry.artifact??null,
  };
}

function releaseConfiguration(plan,rerun){
  return {
    rerun,
    typecheck:Boolean(plan.typecheck),
    fullTests:Boolean(plan.fullTests),
    buildArtifactRequired:Boolean(plan.buildArtifactRequired),
    postgres:Boolean(plan.postgres),
    scale:Boolean(plan.scale),
    browser:Boolean(plan.browser),
    requiredEvidence:[...(plan.requiredEvidence??[])].sort(),
    sourceGroups:[...(plan.sourceEvidence?.groups??[])].sort(),
    domainModules:[...(plan.directEvidence?.["domain-unit"]?.modules??[])].sort(),
    browserSelectionHash:plan.browserEvidence?.selectionHash??null,
    configHash:verificationConfigIdentity().hash,
    toolchainHash:declaredToolchainIdentity().hash,
  };
}

function evidenceObservations({sourceLedger,domainLedger,postgresLedger,browserLedger}){
  const observations={};
  if(sourceLedger?.observation)observations["application-source-contract"]=sourceLedger.observation;
  if(domainLedger?.observation)observations["domain-unit"]=domainLedger.observation;
  if(postgresLedger?.observation)observations["postgres-acceptance"]=postgresLedger.observation;
  if(browserLedger?.observation)observations["browser-acceptance"]=browserLedger.observation;
  return observations;
}

function buildObservation(buildLedger){
  if(!buildLedger)return null;
  return {
    sourceGate:"build",
    ran:true,
    failed:buildLedger.exitCode!==0||buildLedger.evaluation?.status!=="PASS",
  };
}

function nonBehavioralStatus(plan,steps){
  const required=[];
  if(plan.typecheck)required.push(steps.typecheck?.status??"NOT RUN");
  if(plan.fullTests)required.push(steps.aggregate?.status??"NOT RUN");
  if(plan.scale)required.push(steps.scale?.status??"NOT RUN");
  if(required.some((status)=>status==="FAIL"||status==="PARTIAL"))return "FAIL";
  if(required.some((status)=>status==="NOT RUN"))return "NOT RUN";
  return "PASS";
}

function deriveExitCode(ledgers){
  if(ledgers.some((entry)=>entry?.exitCode===2))return 2;
  if(ledgers.some((entry)=>entry?.exitCode===3))return 3;
  if(ledgers.some((entry)=>entry&&entry.exitCode!==0))return 1;
  return 0;
}

function finalizeRelease({
  candidate,
  plan,
  argv,
  rerun,
  steps,
  sourceLedger,
  domainLedger,
  postgresLedger,
  browserLedger,
  buildLedger,
  gateLedgers,
  forcedExitCode=0,
}){
  const matrix=evaluateEvidenceMatrix({
    requiredEvidence:plan.requiredEvidence,
    observations:evidenceObservations({sourceLedger,domainLedger,postgresLedger,browserLedger}),
    buildRequired:plan.buildArtifactRequired,
    buildObservation:buildObservation(buildLedger),
  });
  const nonBehavioral=nonBehavioralStatus(plan,steps);
  const derived=deriveExitCode(gateLedgers);
  const exitCode=forcedExitCode||derived;

  let status;
  if(exitCode===2||exitCode===3)status="NOT RUN";
  else if(exitCode!==0||matrix.overallStatus==="FAIL"||nonBehavioral==="FAIL")status="FAIL";
  else if(matrix.overallStatus==="NOT RUN"||nonBehavioral==="NOT RUN")status="NOT RUN";
  else status="PASS";

  let reason;
  if(status==="PASS")reason="All risk-planned release gates and required evidence passed for the exact candidate.";
  else if(exitCode===2)reason="Release verification could not run because invocation, environment or configuration was invalid.";
  else if(exitCode===3)reason="Release verification is blocked by required evidence ownership or a non-repairable prerequisite.";
  else if(status==="FAIL")reason="One or more required release gates or evidence classes failed.";
  else reason="One or more required release gates or evidence classes did not run.";

  const finalExitCode=status==="PASS"?0:(exitCode||1);
  const ledger=writeVerificationLedgerEntry({
    gate:"release-risk",
    candidate,
    canonicalCommand:canonicalCommand(argv),
    exitCode:finalExitCode,
    effectiveConfiguration:releaseConfiguration(plan,rerun),
    steps,
    evidenceMatrix:matrix,
    evaluation:{status,reason},
  });
  const summary={
    candidateId:candidate.candidateId,
    exitCode:finalExitCode,
    releaseStatus:status,
    steps,
    evidence:matrix.evidence,
    build:matrix.build,
    requiredEvidence:plan.requiredEvidence,
    blockedEvidence:plan.blockedEvidence,
  };
  return {exitCode:finalExitCode,ledger,summary,matrix};
}

export async function runRiskReleaseVerification(argv,{env=process.env}={}){
  const parsed=parseReleaseArgs(argv);
  const planResult=createVerificationPlan(parsed.candidateArgs);
  const {candidate,plan}=planResult;
  const command=canonicalCommand(argv);
  const steps={};
  const gateLedgers=[];

  if(plan.blockedEvidence.length>0){
    const result=finalizeRelease({
      candidate,plan,argv,rerun:parsed.rerun,steps,
      sourceLedger:null,domainLedger:null,postgresLedger:null,browserLedger:null,buildLedger:null,
      gateLedgers,forcedExitCode:3,
    });
    return {...result,plan:planResult,json:parsed.json};
  }

  const sourceConfig=applicationSourceConfiguration(plan);
  let sourceLedger=parsed.rerun?null:readVerificationLedgerEntry(candidate.candidateId,"source");
  const sourceReuse=sourceLedger
    ?reusableLedgerEntry(sourceLedger,{
        candidate,
        gate:"source",
        evidenceClass:"application-source-contract",
        configuration:sourceConfig,
        allowNA:!plan.sourceEvidence.required,
      })
    :{reusable:false,reason:"missing"};
  if(!sourceReuse.reusable){
    const source=await runApplicationSourceVerification(planResult,{canonicalCommand:command,env});
    sourceLedger=source.ledger;
  }
  gateLedgers.push(sourceLedger);
  steps.source=stepFromLedger(sourceLedger,sourceReuse.reusable);
  if(sourceLedger?.exitCode!==0){
    const result=finalizeRelease({
      candidate,plan,argv,rerun:parsed.rerun,steps,sourceLedger,
      domainLedger:null,postgresLedger:null,browserLedger:null,buildLedger:null,gateLedgers,
    });
    return {...result,plan:planResult,json:parsed.json};
  }

  const domainConfig=domainVerificationConfiguration(plan);
  let domainLedger=parsed.rerun?null:readVerificationLedgerEntry(candidate.candidateId,"domain");
  const domainReuse=domainLedger
    ?reusableLedgerEntry(domainLedger,{
        candidate,
        gate:"domain",
        evidenceClass:"domain-unit",
        configuration:domainConfig,
        allowNA:!plan.directEvidence["domain-unit"].required,
      })
    :{reusable:false,reason:"missing"};
  if(!domainReuse.reusable){
    const domain=await runDomainVerification(parsed.candidateArgs);
    domainLedger=domain.ledger;
  }
  gateLedgers.push(domainLedger);
  steps.domain=stepFromLedger(domainLedger,domainReuse.reusable);
  if(domainLedger?.exitCode!==0){
    const result=finalizeRelease({
      candidate,plan,argv,rerun:parsed.rerun,steps,sourceLedger,domainLedger,
      postgresLedger:null,browserLedger:null,buildLedger:null,gateLedgers,
    });
    return {...result,plan:planResult,json:parsed.json};
  }

  const typecheckConfig=typecheckVerificationConfiguration();
  let typecheckLedger=parsed.rerun?null:readVerificationLedgerEntry(candidate.candidateId,"typecheck");
  const typecheckReuse=typecheckLedger
    ?reusableLedgerEntry(typecheckLedger,{
        candidate,
        gate:"typecheck",
        configuration:typecheckConfig,
        allowNA:!plan.typecheck,
      })
    :{reusable:false,reason:"missing"};
  if(!typecheckReuse.reusable){
    const typecheck=await runTypecheckVerification(candidate,{
      canonicalCommand:command,
      env,
      required:plan.typecheck,
    });
    typecheckLedger=typecheck.ledger;
  }
  gateLedgers.push(typecheckLedger);
  steps.typecheck=stepFromLedger(typecheckLedger,typecheckReuse.reusable);
  if(typecheckLedger?.exitCode!==0){
    const result=finalizeRelease({
      candidate,plan,argv,rerun:parsed.rerun,steps,sourceLedger,domainLedger,
      postgresLedger:null,browserLedger:null,buildLedger:null,gateLedgers,
    });
    return {...result,plan:planResult,json:parsed.json};
  }

  const aggregateConfig=aggregateVerificationConfiguration();
  let aggregateLedger=null;
  let aggregateReused=false;
  if(plan.fullTests){
    aggregateLedger=parsed.rerun?null:readVerificationLedgerEntry(candidate.candidateId,"aggregate");
    const aggregateReuse=aggregateLedger
      ?reusableLedgerEntry(aggregateLedger,{
          candidate,
          gate:"aggregate",
          configuration:aggregateConfig,
        })
      :{reusable:false,reason:"missing"};
    aggregateReused=aggregateReuse.reusable;
    if(!aggregateReused){
      const aggregate=await runAggregateVerification(candidate,{canonicalCommand:command,env,required:true});
      aggregateLedger=aggregate.ledger;
    }
    gateLedgers.push(aggregateLedger);
    steps.aggregate=stepFromLedger(aggregateLedger,aggregateReused);
    if(aggregateLedger?.exitCode!==0){
      const result=finalizeRelease({
        candidate,plan,argv,rerun:parsed.rerun,steps,sourceLedger,domainLedger,
        postgresLedger:null,browserLedger:null,buildLedger:null,gateLedgers,
      });
      return {...result,plan:planResult,json:parsed.json};
    }
  }else{
    steps.aggregate=notRequired("Aggregate regression is not required for this candidate.");
  }

  let buildLedger=null;
  let buildReused=false;
  if(plan.buildArtifactRequired){
    buildLedger=parsed.rerun?null:readVerificationLedgerEntry(candidate.candidateId,"build");
    const buildReuse=buildLedger?reusableBuildLedger(candidate,buildLedger):{reusable:false,reason:"missing"};
    buildReused=buildReuse.reusable;
    if(!buildReused){
      const build=await runCandidateBuild(candidate,{env,producerCommand:command});
      buildLedger=build.ledger;
    }
    gateLedgers.push(buildLedger);
    steps.build=buildStep(buildLedger,buildReused);
    if(buildLedger?.exitCode!==0){
      const result=finalizeRelease({
        candidate,plan,argv,rerun:parsed.rerun,steps,sourceLedger,domainLedger,
        postgresLedger:null,browserLedger:null,buildLedger,gateLedgers,
      });
      return {...result,plan:planResult,json:parsed.json};
    }
  }else{
    steps.build=notRequired("Production build is not required for this candidate.");
  }

  let postgresLedger=null;
  let postgresReused=false;
  if(plan.postgres){
    const postgresConfig=postgresVerificationConfiguration();
    postgresLedger=parsed.rerun?null:readVerificationLedgerEntry(candidate.candidateId,"postgres");
    const postgresReuse=postgresLedger
      ?reusableLedgerEntry(postgresLedger,{
          candidate,
          gate:"postgres",
          evidenceClass:"postgres-acceptance",
          configuration:postgresConfig,
        })
      :{reusable:false,reason:"missing"};
    postgresReused=postgresReuse.reusable;
    if(!postgresReused){
      const postgres=await runPostgresVerification(parsed.candidateArgs,env);
      postgresLedger=postgres.ledger;
    }
    gateLedgers.push(postgresLedger);
    steps.postgres=stepFromLedger(postgresLedger,postgresReused);
    if(postgresLedger?.exitCode!==0){
      steps.scale=plan.scale
        ?{status:"NOT RUN",reused:false,exitCode:postgresLedger?.exitCode??1,reason:"Scale coverage is part of PostgreSQL full acceptance, which did not pass."}
        :notRequired("Scale verification is not required for this candidate.");
      const result=finalizeRelease({
        candidate,plan,argv,rerun:parsed.rerun,steps,sourceLedger,domainLedger,
        postgresLedger,browserLedger:null,buildLedger,gateLedgers,
      });
      return {...result,plan:planResult,json:parsed.json};
    }
  }else{
    steps.postgres=notRequired("PostgreSQL acceptance is not required for this candidate.");
  }

  steps.scale=plan.scale
    ?{status:"PASS",reused:postgresReused,exitCode:0,reason:"Scale tests are included in canonical PostgreSQL full acceptance."}
    :notRequired("Scale verification is not required for this candidate.");

  let browserLedger=null;
  let browserReused=false;
  if(plan.browser){
    browserLedger=parsed.rerun?null:readVerificationLedgerEntry(candidate.candidateId,"browser-risk");
    const browserReuse=browserLedger
      ?reusableBrowserRiskLedger(candidate,plan.browserEvidence,browserLedger)
      :{reusable:false,reason:"missing"};
    browserReused=browserReuse.reusable;
    if(!browserReused){
      const browser=await runBrowserRiskVerification(parsed.candidateArgs,env);
      browserLedger=browser.ledger;
    }
    gateLedgers.push(browserLedger);
    steps.browser=stepFromLedger(browserLedger,browserReused);
    if(browserLedger?.exitCode!==0){
      const result=finalizeRelease({
        candidate,plan,argv,rerun:parsed.rerun,steps,sourceLedger,domainLedger,
        postgresLedger,browserLedger,buildLedger,gateLedgers,
      });
      return {...result,plan:planResult,json:parsed.json};
    }
  }else{
    steps.browser=notRequired("Browser acceptance is not required for this candidate.");
  }

  const result=finalizeRelease({
    candidate,plan,argv,rerun:parsed.rerun,steps,sourceLedger,domainLedger,
    postgresLedger,browserLedger,buildLedger,gateLedgers,
  });
  return {...result,plan:planResult,json:parsed.json};
}

function printHuman(summary){
  const line=(key,value)=>process.stdout.write(key+"="+value+"\n");
  const show=(name)=>{
    const step=summary.steps[name];
    if(!step)return;
    line(name,step.status+(step.reused?":reused":""));
  };
  line("candidate_id",summary.candidateId);
  line("release_status",summary.releaseStatus);
  show("source");
  show("domain");
  show("typecheck");
  show("aggregate");
  show("build");
  show("postgres");
  show("scale");
  show("browser");
  line("required_evidence",summary.requiredEvidence.join(",")||"none");
  line("blocked_evidence",summary.blockedEvidence.join(",")||"none");
}

if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]){
  try{
    const result=await runRiskReleaseVerification(process.argv.slice(2));
    if(result.json)process.stdout.write(JSON.stringify(result.summary,null,2)+"\n");
    else printHuman(result.summary);
    process.exit(result.exitCode);
  }catch(error){
    console.error(error instanceof Error?error.message:String(error));
    process.exit(error instanceof CandidateInputError?error.exitCode:2);
  }
}
