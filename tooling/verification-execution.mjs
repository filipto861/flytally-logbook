import { spawn } from "node:child_process";

export const npmExecutable=process.platform==="win32"?"npm.cmd":"npm";

export function commandText(command,args=[]){
  const quote=(value)=>/[\s"]/u.test(value)?JSON.stringify(value):value;
  return [command,...args].map((value)=>quote(String(value))).join(" ");
}

export async function runCommand(command,args=[],options={}){
  const child=spawn(command,args,{
    cwd:options.cwd,
    env:options.env??process.env,
    stdio:["inherit","pipe","pipe"],
    shell:false,
  });
  let stdout="",stderr="";
  child.stdout?.on("data",(chunk)=>{stdout+=chunk;process.stdout.write(chunk);});
  child.stderr?.on("data",(chunk)=>{stderr+=chunk;process.stderr.write(chunk);});
  const result=await new Promise((resolve,reject)=>{
    child.once("error",reject);
    child.once("close",(code,signal)=>resolve({code:code??1,signal}));
  });
  return {...result,stdout,stderr,command:commandText(command,args)};
}

function summaryValue(output,label){
  const patterns=[
    new RegExp("(?:^|\\n)\\s*#\\s*"+label+"\\s+(\\d+)","m"),
    new RegExp("(?:^|\\n)\\s*ℹ\\s*"+label+"\\s+(\\d+)","m"),
  ];
  for(const pattern of patterns){
    const match=output.match(pattern);
    if(match)return Number(match[1]);
  }
  return null;
}

export function parseNodeTestSummary(output){
  const tests=summaryValue(output,"tests");
  const passed=summaryValue(output,"pass");
  const failed=summaryValue(output,"fail");
  const skipped=summaryValue(output,"skipped");
  if([tests,passed,failed,skipped].some((value)=>value===null)){
    throw new Error("Could not parse Node test summary for verification evidence.");
  }
  return {planned:tests,passed,failed,skipped,notApplicable:0,retries:0};
}

export async function runNodeTests(testFiles,{env=process.env,coverage="targeted"}={}){
  if(!Array.isArray(testFiles)||testFiles.length===0)throw new Error("No Node test files were supplied.");
  const args=[
    "--disable-warning=MODULE_TYPELESS_PACKAGE_JSON",
    "--test",
    "--test-reporter=tap",
    "--experimental-strip-types",
    ...testFiles,
  ];
  const result=await runCommand(process.execPath,args,{env});
  let summary=null;
  try{
    summary=parseNodeTestSummary(result.stdout+"\n"+result.stderr);
  }catch(error){
    if(result.code===0)throw error;
  }
  return {...result,summary,coverage};
}
