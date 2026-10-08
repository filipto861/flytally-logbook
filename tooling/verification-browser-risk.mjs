import {
  buildIdentityMatches,
  currentBuildIdentity,
  readVerificationLedgerEntry,
} from "./verification-ledger.mjs";
import { reusableLedgerEntry } from "./verification-reuse.mjs";

export function regexpEscape(value){
  return String(value).replace(/[.*+?^$(){}|[\]\\]/g,"\\$&");
}

export function buildBrowserRiskTitleGrep(titles){
  const unique=[...new Set((titles??[]).map((value)=>String(value)))].sort();
  if(unique.length===0)throw new Error("Risk-scoped browser execution requires at least one test title.");
  // Playwright --grep is matched against the composed full title (project/file/suite/title),
  // so anchoring to ^title$ would incorrectly select zero tests. Exact completeness is
  // enforced separately by planner/planned/actual {spec,title,project} equality.
  return "(?:"+unique.map(regexpEscape).join("|")+")";
}

function targetKey(target){
  return [String(target.spec??""),String(target.title??""),String(target.project??"")].join("\0");
}

function sortedKeys(targets){
  return targets.map(targetKey).sort();
}

export function compareExactTargetSet(expected,actual){
  const left=sortedKeys(expected);
  const right=sortedKeys(actual);
  if(left.length!==right.length)return false;
  return left.every((value,index)=>value===right[index]);
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

export function reusableBrowserRiskLedger(candidate,browserEvidence,entry,{buildLedger,currentBuildArtifact}={}){
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

  const build=buildLedger===undefined
    ?readVerificationLedgerEntry(candidate.candidateId,"build")
    :buildLedger;
  if(!build||build.exitCode!==0||build.evaluation?.status!=="PASS"||
     !buildIdentityMatches(build.artifact,artifact)){
    return {reusable:false,reason:"build-ledger"};
  }
  try{
    const current=currentBuildArtifact===undefined?currentBuildIdentity():currentBuildArtifact;
    if(!buildIdentityMatches(current,artifact)){
      return {reusable:false,reason:"build-output"};
    }
  }catch{
    return {reusable:false,reason:"build-output"};
  }
  return {reusable:true,reason:"exact-match"};
}
