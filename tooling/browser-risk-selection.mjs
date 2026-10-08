import { createHash } from "node:crypto";
import { existsSync,readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { classifyDevelopmentScope } from "./development-scope.mjs";
import { repositoryRoot } from "./verification-candidate.mjs";
import {
  browserFixtureContractIdentity,
  declaredToolchainIdentity,
  verificationConfigIdentity,
} from "./verification-identity.mjs";

const manifestPath=fileURLToPath(new URL("./development-modules.json",import.meta.url));
const baselinePath=fileURLToPath(new URL("./browser-suite-baseline.json",import.meta.url));
const manifest=JSON.parse(readFileSync(manifestPath,"utf8"));
const baseline=JSON.parse(readFileSync(baselinePath,"utf8"));
const browser=manifest.browserAcceptance??{};

const normalize=(value)=>String(value??"").replaceAll("\\","/").replace(/^\.\/+/, "");

function pathMatches(entry,file){
  const normalized=normalize(file);
  return (entry.files??[]).includes(normalized)||(entry.prefixes??[]).some((prefix)=>normalized.startsWith(prefix));
}

function stableHash(value){
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function targetDeclarationCount(spec,title){
  const absolute=path.join(repositoryRoot,...spec.split("/"));
  if(!existsSync(absolute))return 0;
  const source=readFileSync(absolute,"utf8");
  const needle='test("'+title+'"';
  let count=0,index=-1;
  while((index=source.indexOf(needle,index+1))>=0)count+=1;
  return count;
}

function validateRegistryTarget(id,target){
  const reasons=[];
  if(!target||typeof target!=="object"){
    reasons.push("browser-target:"+id+":missing-definition");
    return reasons;
  }
  const spec=normalize(target.spec);
  const title=String(target.title??"");
  const project=String(target.project??"");
  if(!(baseline.playwright?.projects??[]).includes(project))reasons.push("browser-target:"+id+":unknown-project:"+project);
  if((baseline.excludedSpecs??[]).includes(path.posix.basename(spec)))reasons.push("browser-target:"+id+":diagnostic-only-spec");
  if(!(baseline.acceptanceLogicalTests??[]).includes(title))reasons.push("browser-target:"+id+":title-not-in-baseline");
  const count=targetDeclarationCount(spec,title);
  if(count===0)reasons.push("browser-target:"+id+":missing-test");
  if(count>1)reasons.push("browser-target:"+id+":ambiguous-test");
  return reasons;
}

export function validateBrowserTargetRegistry(){
  const reasons=[];
  const targets=browser.targets??{};
  const executionKeys=new Map();
  for(const [id,target] of Object.entries(targets)){
    reasons.push(...validateRegistryTarget(id,target));
    const key=[normalize(target?.spec),String(target?.title??""),String(target?.project??"")].join("\0");
    if(executionKeys.has(key))reasons.push("browser-target:"+id+":duplicate-execution:"+executionKeys.get(key));
    else executionKeys.set(key,id);
  }
  const referenced=[];
  for(const [moduleId,ids] of Object.entries(browser.moduleTargets??{})){
    for(const id of ids??[])referenced.push(["module:"+moduleId,id]);
  }
  for(const [index,entry] of (browser.pathTargets??[]).entries()){
    for(const id of entry.targets??[])referenced.push(["path:"+index,id]);
  }
  for(const id of browser.harnessTargets??[])referenced.push(["harness",id]);
  for(const [owner,id] of referenced){
    if(!targets[id])reasons.push("browser-target-owner:"+owner+":unknown-target:"+id);
  }
  return [...new Set(reasons)].sort();
}

function addIds(targetIds,ids){
  for(const id of ids??[])targetIds.add(id);
}

function moduleById(id){
  return (manifest.modules??[]).find((entry)=>entry.id===id)??null;
}

function browserHarnessRule(){
  return (manifest.specialRules??[]).find((entry)=>entry.id==="browser-harness")??null;
}

export function selectBrowserEvidence(candidate,classification){
  const required=Boolean(classification.browser);
  const targetIds=new Set();
  const blockers=[...validateBrowserTargetRegistry()];
  const fileCoverage=[];
  const targets=browser.targets??{};
  const harness=browserHarnessRule();

  for(const file of candidate.files){
    const single=classifyDevelopmentScope([file]);
    if(!single.browser)continue;
    const before=new Set(targetIds);
    const reasons=[];

    if(file.startsWith("e2e/")&&file.endsWith(".spec.mjs")){
      const owned=Object.entries(targets)
        .filter(([,target])=>normalize(target.spec)===file)
        .map(([id])=>id)
        .sort();
      if(owned.length===0)reasons.push("changed-e2e-spec-has-no-authoritative-target");
      addIds(targetIds,owned);
    }else if(harness&&pathMatches(harness,file)){
      addIds(targetIds,browser.harnessTargets);
      if((browser.harnessTargets??[]).length===0)reasons.push("browser-harness-target-set-empty");
    }

    for(const moduleId of single.modules){
      const module=moduleById(moduleId);
      if(!module?.gates?.browser)continue;
      const owned=browser.moduleTargets?.[moduleId]??[];
      if(owned.length===0)reasons.push("browser-module:"+moduleId+":missing-target-ownership");
      addIds(targetIds,owned);
    }

    for(const entry of browser.pathTargets??[]){
      if(pathMatches(entry,file))addIds(targetIds,entry.targets);
    }

    const addedTargets=[...targetIds].filter((id)=>!before.has(id)).sort();
    if(addedTargets.length===0&&reasons.length===0)reasons.push("browser-relevant-path-has-no-target");
    if(reasons.length>0){
      for(const reason of reasons)blockers.push("browser:"+file+":"+reason);
    }
    fileCoverage.push({file,addedTargets,reasons});
  }

  if(required&&targetIds.size===0)blockers.push("browser:required:no-targets-selected");

  const selected=[...targetIds].sort().map((id)=>({id,...targets[id]}));
  for(const item of selected){
    if(!targets[item.id])blockers.push("browser-target:"+item.id+":missing-definition");
  }

  const config=verificationConfigIdentity();
  const fixture=browserFixtureContractIdentity();
  const toolchain=declaredToolchainIdentity();
  const selectionPayload={
    selectionVersion:browser.selectionVersion??0,
    registrySchemaVersion:manifest.schemaVersion??manifest.version??0,
    candidateFiles:candidate.files,
    targets:selected.map(({id,spec,title,project})=>({id,spec,title,project})),
  };
  const selectionHash=stableHash(selectionPayload);

  return {
    required,
    authoritativeSource:"browser-risk",
    authority:"release",
    selectionVersion:browser.selectionVersion??0,
    targets:selected,
    selectionHash,
    configHash:config.hash,
    toolchainHash:toolchain.hash,
    fixtureContractHash:fixture.hash,
    fileCoverage,
    blockers:[...new Set(blockers)].sort(),
  };
}
