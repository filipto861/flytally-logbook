import { fileURLToPath } from "node:url";
import { createVerificationPlan } from "./verify-plan.mjs";
import { CandidateInputError } from "./verification-candidate.mjs";
import { runCandidateBuild } from "./verification-build.mjs";
import { runBrowserVerification } from "./verify-browser.mjs";

function canonicalCommand(argv){
  return "npm run verify:browser:with-build -- "+argv.join(" ");
}

export async function runBrowserWithBuild(argv,env=process.env){
  const plan=createVerificationPlan(argv);
  const build=await runCandidateBuild(plan.candidate,{
    env,
    producerCommand:canonicalCommand(argv),
  });
  if(build.exitCode!==0)return {exitCode:build.exitCode,plan,build};
  const browser=await runBrowserVerification(argv,env);
  return {exitCode:browser.exitCode,plan,browser};
}

if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]){
  try{
    const result=await runBrowserWithBuild(process.argv.slice(2));
    process.exit(result.exitCode);
  }catch(error){
    console.error(error instanceof Error?error.message:String(error));
    process.exit(error instanceof CandidateInputError?error.exitCode:2);
  }
}
