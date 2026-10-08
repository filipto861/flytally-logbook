import { fileURLToPath } from "node:url";
import { CandidateInputError } from "./verification-candidate.mjs";
import { runAppVerification } from "./verify-app.mjs";

export async function runAppCompatibility(argv,env=process.env){
  const candidateArgs=argv.length>0?argv:["--all"];
  return runAppVerification(candidateArgs,env);
}

if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]){
  try{
    const result=await runAppCompatibility(process.argv.slice(2));
    process.exit(result.exitCode);
  }catch(error){
    console.error(error instanceof Error?error.message:String(error));
    process.exit(error instanceof CandidateInputError?error.exitCode:2);
  }
}
