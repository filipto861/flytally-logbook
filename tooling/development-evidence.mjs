import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const manifestPath=fileURLToPath(new URL("./development-modules.json",import.meta.url));
const manifest=JSON.parse(readFileSync(manifestPath,"utf8"));

function requiredByModule(module,evidenceClass,registry=manifest){
  const requirements=registry.evidencePolicy?.riskRequirements??{};
  return (module.risks??[]).some((risk)=>(requirements[risk]??[]).includes(evidenceClass));
}

export function selectDirectEvidenceForModules(moduleIds,evidenceClass="domain-unit",registry=manifest){
  const modulesById=new Map((registry.modules??[]).map((module)=>[module.id,module]));
  const requiredModules=[];
  const missingModules=[];
  const tests=new Set();

  for(const moduleId of [...new Set(moduleIds??[])].sort()){
    const module=modulesById.get(moduleId);
    if(!module||!requiredByModule(module,evidenceClass,registry))continue;
    requiredModules.push(moduleId);
    const approved=module.evidenceTests?.[evidenceClass]??[];
    if(!Array.isArray(approved)||approved.length===0){
      missingModules.push(moduleId);
      continue;
    }
    for(const file of approved)tests.add(file);
  }

  return {
    evidenceClass,
    modules:requiredModules,
    tests:[...tests].sort(),
    missingModules,
  };
}


export function selectTestGroupsByEvidenceClass(groupIds,evidenceClass="application-source-contract",registry=manifest){
  const groups=[];
  const tests=new Set();
  for(const groupId of [...new Set(groupIds??[])].sort()){
    const group=registry.testGroups?.[groupId];
    if(!group||group.evidenceClass!==evidenceClass)continue;
    groups.push(groupId);
    for(const file of group.tests??[])tests.add(file);
  }
  return {evidenceClass,groups,tests:[...tests].sort()};
}
