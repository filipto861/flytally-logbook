import { fileURLToPath } from "node:url";
import { CandidateInputError } from "./verification-candidate.mjs";
import { createVerificationPlan } from "./verify-plan.mjs";
import { applicationSourceConfiguration,runApplicationSourceVerification } from "./verification-source.mjs";
import { domainVerificationConfiguration,runDomainVerification } from "./verify-domain.mjs";
import { runTypecheckVerification,typecheckVerificationConfiguration } from "./verification-typecheck.mjs";
import { readVerificationLedgerEntry,writeVerificationLedgerEntry } from "./verification-ledger.mjs";
import { reusableLedgerEntry } from "./verification-reuse.mjs";
import { verificationConfigIdentity,declaredToolchainIdentity } from "./verification-identity.mjs";

function parseIterationArgs(argv){
  const candidateArgs=[];
  let rerun=false;
  for(const value of argv){
    if(value==="--rerun"){
      rerun=true;
      continue;
    }
    if(value==="--with-browser"){
      throw new CandidateInputError("--with-browser is reserved for Phase 0E.4c and is not available yet.");
    }
    candidateArgs.push(value);
  }
  return {candidateArgs,rerun,json:candidateArgs.includes("--json")};
}

function stepFromLedger(entry,reused){
  return {
    status:entry?.evaluation?.status??"NOT RUN",
    reused,
    gate:entry?.gate??null,
    reason:entry?.evaluation?.reason??"No ledger observation.",
  };
}

function pendingReleaseWork(plan){
  const pending=[];
  if(plan.fullTests)pending.push("aggregate-regression");
  if(plan.buildArtifactRequired)pending.push("production-build");
  if(plan.postgres)pending.push("postgres-acceptance");
  if(plan.scale)pending.push("scale");
  if(plan.browser)pending.push("browser-risk");
  return pending;
}

function canonicalCommand(argv){
  return "npm run verify:iterate -- "+argv.join(" ");
}

export async function runIterationVerification(argv,{env=process.env}={}){
  const parsed=parseIterationArgs(argv);
  const planResult=createVerificationPlan(parsed.candidateArgs);
  const {candidate,plan}=planResult;
  const command=canonicalCommand(argv);
  const steps={};

  const sourceConfig=applicationSourceConfiguration(plan);
  let sourceLedger=parsed.rerun?null:readVerificationLedgerEntry(candidate.candidateId,"source");
  let sourceReuse=sourceLedger
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
  steps.source=stepFromLedger(sourceLedger,sourceReuse.reusable);

  const domainConfig=domainVerificationConfiguration(plan);
  let domainLedger=parsed.rerun?null:readVerificationLedgerEntry(candidate.candidateId,"domain");
  let domainReuse=domainLedger
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
  steps.domain=stepFromLedger(domainLedger,domainReuse.reusable);

  const typecheckConfig=typecheckVerificationConfiguration();
  let typecheckLedger=parsed.rerun?null:readVerificationLedgerEntry(candidate.candidateId,"typecheck");
  let typecheckReuse=typecheckLedger
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
  steps.typecheck=stepFromLedger(typecheckLedger,typecheckReuse.reusable);

  const executedFailure=[sourceLedger,domainLedger,typecheckLedger].some((entry)=>
    entry?.exitCode!==0&&entry?.exitCode!==3,
  );
  const blocked=plan.blockedEvidence.length>0||
    [sourceLedger,domainLedger,typecheckLedger].some((entry)=>entry?.exitCode===3);
  const exitCode=executedFailure?1:(blocked?3:0);
  const releasePending=pendingReleaseWork(plan);
  const identity={
    configHash:verificationConfigIdentity().hash,
    toolchainHash:declaredToolchainIdentity().hash,
  };
  const evaluation=exitCode===0
    ?{status:"PASS",reason:"Fast iteration gates passed. Release verification was not evaluated."}
    :exitCode===3
      ?{status:"NOT RUN",reason:"Fast iteration completed available checks, but the candidate is blocked by missing required evidence ownership."}
      :{status:"FAIL",reason:"One or more fast iteration gates failed."};

  const ledger=writeVerificationLedgerEntry({
    gate:"iterate",
    candidate,
    canonicalCommand:command,
    exitCode,
    effectiveConfiguration:{
      rerun:parsed.rerun,
      source:sourceConfig,
      domain:domainConfig,
      typecheck:typecheckConfig,
      ...identity,
    },
    steps,
    release:{
      status:"NOT EVALUATED",
      pending:releasePending,
      blockedEvidence:plan.blockedEvidence,
    },
    evaluation,
  });

  const summary={
    candidateId:candidate.candidateId,
    exitCode,
    iterationStatus:evaluation.status,
    steps,
    blockedEvidence:plan.blockedEvidence,
    releaseStatus:"NOT EVALUATED",
    releasePending,
  };
  return {exitCode,plan:planResult,ledger,summary,json:parsed.json};
}

function printHuman(summary){
  const line=(key,value)=>process.stdout.write(key+"="+value+"\n");
  line("candidate_id",summary.candidateId);
  line("iteration_status",summary.iterationStatus);
  line("source",summary.steps.source.status+(summary.steps.source.reused?":reused":""));
  line("domain",summary.steps.domain.status+(summary.steps.domain.reused?":reused":""));
  line("typecheck",summary.steps.typecheck.status+(summary.steps.typecheck.reused?":reused":""));
  line("blocked_evidence",summary.blockedEvidence.join(",")||"none");
  line("release_status",summary.releaseStatus);
  line("release_pending",summary.releasePending.join(",")||"none");
}

if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]){
  try{
    const result=await runIterationVerification(process.argv.slice(2));
    if(result.json)process.stdout.write(JSON.stringify(result.summary,null,2)+"\n");
    else printHuman(result.summary);
    process.exit(result.exitCode);
  }catch(error){
    console.error(error instanceof Error?error.message:String(error));
    process.exit(error instanceof CandidateInputError?error.exitCode:2);
  }
}
