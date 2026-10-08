import { runNpm } from "./verification-execution.mjs";
import { buildIdentityMatches,currentBuildIdentity,writeVerificationLedgerEntry } from "./verification-ledger.mjs";

export function reusableBuildLedger(candidate,entry,{currentArtifact}={}){
  if(!entry)return {reusable:false,reason:"missing"};
  if(entry.schemaVersion!==2)return {reusable:false,reason:"ledger-schema"};
  if(entry?.candidate?.candidateId!==candidate?.candidateId)return {reusable:false,reason:"candidate"};
  if(entry.gate!=="build"||entry.artifactClass!=="build")return {reusable:false,reason:"gate"};
  if(entry.exitCode!==0||entry.evaluation?.status!=="PASS"||!entry.artifact){
    return {reusable:false,reason:"evaluation"};
  }
  try{
    const current=currentArtifact===undefined?currentBuildIdentity():currentArtifact;
    if(!buildIdentityMatches(entry.artifact,current)){
      return {reusable:false,reason:"build-output"};
    }
  }catch{
    return {reusable:false,reason:"build-output"};
  }
  return {reusable:true,reason:"exact-match"};
}

export async function runCandidateBuild(candidate,{env=process.env,producerCommand="npm run build"}={}){
  const build=await runNpm(["run","build"],{env});
  const step={
    status:build.code===0?"PASS":"FAIL",
    exitCode:build.code,
    command:build.command,
  };

  if(build.code!==0){
    const ledger=writeVerificationLedgerEntry({
      gate:"build",
      artifactClass:"build",
      candidate,
      canonicalCommand:producerCommand,
      exitCode:build.code,
      effectiveConfiguration:{productionBuild:true},
      evaluation:{status:"FAIL",reason:"Production build failed."},
    });
    return {exitCode:build.code,step,ledger,artifact:null};
  }

  try{
    const artifact=currentBuildIdentity();
    const ledger=writeVerificationLedgerEntry({
      gate:"build",
      artifactClass:"build",
      candidate,
      canonicalCommand:producerCommand,
      exitCode:0,
      effectiveConfiguration:{productionBuild:true},
      artifact,
      evaluation:{
        status:"PASS",
        reason:"Production build completed and a candidate-bound Next.js build identity was recorded.",
      },
    });
    return {exitCode:0,step,ledger,artifact};
  }catch(error){
    const reason=error instanceof Error?error.message:String(error);
    const partialStep={...step,status:"PARTIAL",reason};
    const ledger=writeVerificationLedgerEntry({
      gate:"build",
      artifactClass:"build",
      candidate,
      canonicalCommand:producerCommand,
      exitCode:1,
      effectiveConfiguration:{productionBuild:true},
      evaluation:{status:"PARTIAL",reason},
    });
    return {exitCode:1,step:partialStep,ledger,artifact:null};
  }
}
