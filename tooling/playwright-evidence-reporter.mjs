import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const manifestPath=fileURLToPath(new URL("./development-modules.json",import.meta.url));
const manifest=JSON.parse(readFileSync(manifestPath,"utf8"));
const explicitNaReasons=new Set(manifest.browserAcceptance?.explicitNotApplicableSkipReasons??[]);

function normalizePath(value){
  return String(value??"").replaceAll("\\","/");
}

export function browserCaseIdentity(test,root=process.cwd()){
  const file=normalizePath(path.relative(root,String(test?.location?.file??"")));
  const project=typeof test?.parent?.project==="function"
    ?String(test.parent.project()?.name??"")
    :"";
  return {spec:file,title:String(test?.title??""),project};
}

export function explicitBrowserNotApplicable(test){
  const annotations=Array.isArray(test?.annotations)?test.annotations:[];
  return annotations.some((annotation)=>
    (annotation?.type==="flytally-na"||annotation?.type==="skip")&&
    explicitNaReasons.has(String(annotation.description??""))
  );
}

export default class FlyTallyEvidenceReporter{
  constructor(){
    this.planned=0;
    this.passed=0;
    this.failed=0;
    this.skipped=0;
    this.notApplicable=0;
    this.retries=0;
    this.effectiveConfiguration={};
    this.plannedCases=[];
    this.cases=[];
  }

  onBegin(config,suite){
    const tests=suite.allTests();
    this.planned=tests.length;
    this.plannedCases=tests.map((test)=>browserCaseIdentity(test));
    this.effectiveConfiguration={
      workers:config.workers,
      fullyParallel:config.fullyParallel,
      projects:config.projects.map((project)=>project.name),
    };
  }

  onTestEnd(test,result){
    this.retries=Math.max(this.retries,Number(result.retry??0));
    const identity=browserCaseIdentity(test);
    const notApplicable=result.status==="skipped"&&explicitBrowserNotApplicable(test);
    this.cases.push({
      ...identity,
      status:result.status,
      retry:Number(result.retry??0),
      notApplicable,
    });
    if(result.status==="passed"){
      this.passed+=1;
      return;
    }
    if(result.status==="skipped"){
      if(explicitBrowserNotApplicable(test))this.notApplicable+=1;
      else this.skipped+=1;
      return;
    }
    this.failed+=1;
  }

  async onEnd(result){
    const output=String(process.env.FLYTALLY_BROWSER_EVIDENCE_FILE??"").trim();
    if(!output)throw new Error("FLYTALLY_BROWSER_EVIDENCE_FILE is required for the FlyTally evidence reporter.");
    mkdirSync(path.dirname(output),{recursive:true});
    writeFileSync(output,JSON.stringify({
      schemaVersion:2,
      status:result.status,
      planned:this.planned,
      passed:this.passed,
      failed:this.failed,
      skipped:this.skipped,
      notApplicable:this.notApplicable,
      retries:this.retries,
      effectiveConfiguration:this.effectiveConfiguration,
      plannedCases:this.plannedCases,
      cases:this.cases,
    },null,2)+"\n","utf8");
  }
}
