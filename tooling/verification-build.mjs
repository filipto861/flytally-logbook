import { runNpm } from "./verification-execution.mjs";
import { currentBuildIdentity,writeVerificationLedgerEntry } from "./verification-ledger.mjs";

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
