import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const root=path.resolve(import.meta.dirname,"..");
const scopeScript=path.join(root,"tooling/development-scope.mjs");
const groupRunner=path.join(root,"tooling/run-development-test-group.mjs");
const manifestPath=path.join(root,"tooling/development-modules.json");
const manifestSchemaPath=path.join(root,"tooling/development-modules.schema.json");

function classify(files:string[],title=""){
  const tempDir=fs.mkdtempSync(path.join(os.tmpdir(),"flytally-scope-"));
  const changedFile=path.join(tempDir,"changed-files.txt");
  fs.writeFileSync(changedFile,files.join("\n")+"\n");
  const result=spawnSync(process.execPath,[scopeScript,"--files",changedFile,"--title",title],{encoding:"utf8"});
  fs.rmSync(tempDir,{recursive:true,force:true});
  assert.equal(result.status,0,result.stderr||result.stdout);
  return Object.fromEntries(result.stdout.trim().split(/\r?\n/).map(line=>{
    const index=line.indexOf("=");
    return [line.slice(0,index),line.slice(index+1)];
  }));
}

function listRuntimeFiles(){
  const extensions=new Set([".ts",".tsx",".css"]);
  const files:string[]=[];
  const visit=(absolute:string,relative:string)=>{
    for(const entry of fs.readdirSync(absolute,{withFileTypes:true})){
      const childAbsolute=path.join(absolute,entry.name);
      const childRelative=path.posix.join(relative,entry.name);
      if(entry.isDirectory())visit(childAbsolute,childRelative);
      else if(extensions.has(path.extname(entry.name)))files.push(childRelative);
    }
  };
  for(const rootName of ["app","components","lib"])visit(path.join(root,rootName),rootName);
  return files.sort();
}

function registryEntryMatches(entry:{files?:string[],prefixes?:string[]},file:string){
  return (entry.files??[]).includes(file)||(entry.prefixes??[]).some(prefix=>file.startsWith(prefix));
}

test("documentation remains lightweight without runtime gates",()=>{
  const result=classify(["README.md","docs/product/example.md"]);
  assert.equal(result.typecheck,"false");
  assert.equal(result.postgres,"false");
  assert.equal(result.scale,"false");
  assert.equal(result.browser,"false");
  assert.equal(result.full_tests,"false");
  assert.equal(result.build,"false");
  assert.match(result.risks,/documentation/);
});

test("CSS is UI presentation risk rather than documentation or PostgreSQL risk",()=>{
  const result=classify(["app/globals.css"]);
  assert.equal(result.typecheck,"true");
  assert.equal(result.postgres,"false");
  assert.equal(result.scale,"false");
  assert.equal(result.browser,"false");
  assert.equal(result.full_tests,"false");
  assert.equal(result.build,"true");
  assert.match(result.risks,/ui-presentation/);
  assert.doesNotMatch(result.risks,/documentation/);
  assert.match(result.test_groups,/ui-contract/);
});

test("registered changed tests select their owning group without inventing runtime risk",()=>{
  const result=classify(["tests/v320-ui-consistency.test.ts"]);
  assert.equal(result.postgres,"false");
  assert.equal(result.scale,"false");
  assert.equal(result.browser,"false");
  assert.equal(result.full_tests,"false");
  assert.match(result.test_groups,/ui-contract/);
  assert.match(result.targeted_tests,/tests\/v320-ui-consistency\.test\.ts/);
});

test("unknown runtime code remains conservative without automatically requiring PostgreSQL",()=>{
  const result=classify(["lib/future-module.ts"]);
  assert.equal(result.typecheck,"true");
  assert.equal(result.postgres,"false");
  assert.equal(result.scale,"false");
  assert.equal(result.browser,"false");
  assert.equal(result.full_tests,"true");
  assert.equal(result.build,"true");
  assert.match(result.modules,/shared/);
  assert.match(result.risks,/shared-runtime/);
});

test("known hot paths select persistence scale browser and application gates centrally",()=>{
  const result=classify(["lib/data/dashboard.ts"]);
  assert.equal(result.typecheck,"true");
  assert.equal(result.postgres,"true");
  assert.equal(result.scale,"true");
  assert.equal(result.browser,"true");
  assert.equal(result.full_tests,"true");
  assert.equal(result.build,"true");
  assert.match(result.modules,/analytics/);
  assert.match(result.risks,/scale-performance/);
});

test("full-ci forces every heavy gate even for documentation-only work",()=>{
  const result=classify(["DEVELOPMENT.md"],"[full-ci] infrastructure transition");
  assert.equal(result.postgres,"true");
  assert.equal(result.scale,"true");
  assert.equal(result.browser,"true");
  assert.equal(result.full_tests,"true");
  assert.equal(result.build,"true");
  assert.match(result.modules,/development-infrastructure/);
  assert.match(result.risks,/full-ci/);
  assert.match(result.test_groups,/development-pipeline/);
  assert.match(result.test_groups,/ui-contract/);
});

test("module registry identifies independent product domains without changing runtime layout",()=>{
  const result=classify([
    "app/(protected)/flights/page.tsx",
    "app/(protected)/credentials/page.tsx",
    "app/(protected)/connections/page.tsx",
  ]);
  assert.match(result.modules,/flight-records/);
  assert.match(result.modules,/credentials-compliance/);
  assert.match(result.modules,/connections-workflows/);
});

test("PostgreSQL integration tests select PostgreSQL without reclassifying as app runtime",()=>{
  const result=classify(["tests/integration/postgres-full-workflow.test.ts"]);
  assert.equal(result.postgres,"true");
  assert.equal(result.scale,"false");
  assert.equal(result.browser,"false");
  assert.equal(result.full_tests,"false");
  assert.match(result.risks,/persistence-schema/);
  assert.match(result.risks,/test-contract/);
});

test("registered PostgreSQL scale tests select the scale gate from the same registry",()=>{
  const result=classify(["tests/integration/postgres-scale-readiness.test.ts"]);
  assert.equal(result.postgres,"true");
  assert.equal(result.scale,"true");
  assert.equal(result.browser,"false");
  assert.equal(result.full_tests,"false");
  assert.match(result.risks,/scale-performance/);
});

test("browser specs select browser acceptance explicitly",()=>{
  const result=classify(["e2e/public-shell.spec.mjs"]);
  assert.equal(result.browser,"true");
  assert.equal(result.postgres,"false");
  assert.equal(result.full_tests,"true");
  assert.equal(result.build_artifact,"required");
  assert.match(result.risks,/browser-ui/);
});

test("PostgreSQL harness changes select its source contracts and real acceptance",()=>{
  for(const file of ["tooling/run-postgres-tests.mjs","tooling/verify-postgres.mjs"]){
    const result=classify([file]);
    assert.equal(result.postgres,"true",file);
    assert.equal(result.full_tests,"true",file);
    assert.match(result.modules,/development-infrastructure/);
    assert.match(result.test_groups,/development-pipeline/);
    assert.match(result.targeted_tests,/tests\/development-pipeline\.test\.ts/);
  }
});

test("risk release orchestrator changes require source PostgreSQL browser aggregate and build verification",()=>{
  const result=classify(["tooling/verify-release-risk.mjs"]);
  assert.equal(result.postgres,"true");
  assert.equal(result.browser,"true");
  assert.equal(result.full_tests,"true");
  assert.equal(result.build,"true");
  assert.equal(result.build_artifact,"required");
  assert.match(result.test_groups,/development-pipeline/);
  assert.match(result.test_groups,/ui-contract/);
  assert.match(result.required_evidence,/application-source-contract/);
  assert.match(result.required_evidence,/postgres-acceptance/);
  assert.match(result.required_evidence,/browser-acceptance/);
});

test("canonical browser harness changes still require browser acceptance",()=>{
  for(const file of [
    "tooling/verify-browser.mjs",
    "tooling/verify-browser-with-build.mjs",
    "tooling/verify-browser-risk.mjs",
    "tooling/verification-browser-risk.mjs",
    "tooling/playwright-evidence-reporter.mjs",
  ]){
    const result=classify([file]);
    assert.equal(result.browser,"true",file);
    assert.equal(result.full_tests,"true",file);
    assert.match(result.modules,/development-infrastructure/);
    assert.match(result.test_groups,/development-pipeline/);
    assert.match(result.test_groups,/ui-contract/);
  }
});

test("stable module ownership covers at least ninety percent of the audited runtime surface",()=>{
  const manifest=JSON.parse(fs.readFileSync(manifestPath,"utf8"));
  const runtimeFiles=listRuntimeFiles();
  const shared=manifest.modules.find((module:{id:string})=>module.id==="shared-runtime");
  assert.ok(shared,"shared-runtime module must make reviewed cross-cutting ownership explicit");

  const stableModules=manifest.modules.filter((module:{id:string})=>module.id!=="shared-runtime");
  const stableOwned=runtimeFiles.filter(file=>stableModules.some((module:{files?:string[],prefixes?:string[]})=>registryEntryMatches(module,file)));
  const explicitShared=runtimeFiles.filter(file=>registryEntryMatches(shared,file));
  const uncovered=runtimeFiles.filter(file=>
    !stableModules.some((module:{files?:string[],prefixes?:string[]})=>registryEntryMatches(module,file)) &&
    !registryEntryMatches(shared,file)
  );

  assert.equal(runtimeFiles.length,manifest.ownership.auditedTotal);
  assert.equal(manifest.ownership.baselineStableOwned,121);
  assert.ok(stableOwned.length/runtimeFiles.length>=manifest.ownership.minimumStableCoverage,
    `stable ownership coverage ${stableOwned.length}/${runtimeFiles.length} is below registry minimum`);
  assert.equal(uncovered.length,0,"every current runtime file must be stable-owned or explicitly shared");
  assert.ok(explicitShared.length>0,"cross-cutting runtime handling must remain explicit rather than disappear by broad prefix");
});

test("new stable modules own representative aircraft GPS auth notification and shell boundaries",()=>{
  const result=classify([
    "components/aircraft-manager.tsx",
    "lib/track-processing.ts",
    "app/login/actions.ts",
    "app/api/push/preferences/route.ts",
    "app/layout.tsx",
  ]);
  assert.match(result.modules,/aircraft-airports/);
  assert.match(result.modules,/gps-tracks/);
  assert.match(result.modules,/identity-auth/);
  assert.match(result.modules,/notifications-push/);
  assert.match(result.modules,/shell-presentation/);
});

test("reviewed cross-cutting files stay explicit shared runtime instead of receiving guessed ownership",()=>{
  const result=classify(["lib/pilot-workspace.ts"]);
  assert.match(result.modules,/shared-runtime/);
  assert.match(result.risks,/shared-runtime/);
  assert.equal(result.postgres,"false");
  assert.equal(result.browser,"false");
  assert.equal(result.full_tests,"true");
  assert.equal(result.build,"true");
});

test("development registry has unique ids scale paths and test ownership",()=>{
  const manifest=JSON.parse(fs.readFileSync(manifestPath,"utf8"));
  assert.equal(manifest.version,3);
  assert.equal(manifest.schemaVersion,3);
  const ids=manifest.modules.map((module:{id:string})=>module.id);
  assert.equal(new Set(ids).size,ids.length);
  assert.equal(new Set(manifest.scalePaths).size,manifest.scalePaths.length);
  assert.equal(new Set(manifest.postgresAcceptance.scaleTests).size,manifest.postgresAcceptance.scaleTests.length);
  assert.equal(
    manifest.scalePaths.filter((file:string)=>manifest.postgresAcceptance.scaleTests.includes(file)).length,
    0,
    "runtime scale paths and PostgreSQL scale-test membership must not be duplicated",
  );
  assert.ok(manifest.modules.some((module:{id:string})=>module.id==="development-infrastructure"));

  const testOwners=new Map<string,string>();
  for(const [groupId,group] of Object.entries(manifest.testGroups) as [string,{tests:string[]}][]){
    assert.ok(group.tests.length>0,"empty test group: "+groupId);
    for(const file of group.tests){
      assert.equal(testOwners.has(file),false,"test belongs to more than one group: "+file);
      testOwners.set(file,groupId);
    }
  }
});

test("development registry v3 evidence schema is explicit and self-consistent",()=>{
  const manifest=JSON.parse(fs.readFileSync(manifestPath,"utf8"));
  const schema=JSON.parse(fs.readFileSync(manifestSchemaPath,"utf8"));
  const expectedBehavioral=["domain-unit","application-source-contract","postgres-acceptance","browser-acceptance"];

  assert.equal(manifest.$schema,"./development-modules.schema.json");
  assert.equal(manifest.schemaVersion,3);
  assert.equal(schema.properties.schemaVersion.const,3);
  assert.equal(schema.properties.version.const,3);
  assert.deepEqual(new Set(manifest.evidencePolicy.behavioralClasses),new Set(expectedBehavioral));
  assert.deepEqual(
    new Set(schema.properties.evidencePolicy.properties.behavioralClasses.items.enum),
    new Set(expectedBehavioral),
  );
  assert.deepEqual(new Set(manifest.evidencePolicy.statuses),new Set(["PASS","FAIL","NOT RUN","N/A","PARTIAL"]));
  assert.equal(manifest.evidencePolicy.buildArtifact,"build");
  assert.deepEqual(manifest.evidencePolicy.gateRequirements,{
    postgres:"postgres-acceptance",
    browser:"browser-acceptance",
  });
  assert.deepEqual(manifest.evidencePolicy.dedicatedAcceptanceSources,{
    "postgres-acceptance":"postgres",
    "browser-acceptance":"browser-risk",
  });
  assert.deepEqual(manifest.evidencePolicy.dedicatedAcceptanceCoverage,{
    "postgres-acceptance":"full",
    "browser-acceptance":"targeted",
  });
  assert.deepEqual(manifest.evidencePolicy.directEvidenceSources,{"domain-unit":"domain-unit"});
  assert.equal(schema.properties.modules.items.properties.evidenceTests.properties["domain-unit"].minItems,1);
  assert.deepEqual(manifest.browserAcceptance.explicitNotApplicableSkipReasons,[
    "UI audit capture runs only for the dedicated audit branch or explicit local opt-in.",
  ]);
  assert.equal(schema.properties.browserAcceptance.properties.explicitNotApplicableSkipReasons.minItems,1);
  assert.equal(manifest.browserAcceptance.selectionVersion,1);
  assert.ok(Object.keys(manifest.browserAcceptance.targets).length>=20);
  assert.ok(manifest.browserAcceptance.harnessTargets.length>=20);
  assert.equal(schema.properties.browserAcceptance.properties.selectionVersion.const,1);
  assert.equal(schema.properties.browserAcceptance.properties.targets.minProperties,1);

  for(const [groupId,group] of Object.entries(manifest.testGroups) as [string,{evidenceClass:string,coverage:string,tests:string[]}][]){
    assert.ok(manifest.evidencePolicy.groupClasses.includes(group.evidenceClass),"invalid evidence class for group: "+groupId);
    assert.equal(group.evidenceClass,"application-source-contract","current named groups must remain homogeneous source-contract groups");
    assert.equal(group.coverage,"targeted");
    assert.ok(group.tests.length>0);
  }
});

test("every current domain-risk module has approved direct domain evidence",()=>{
  const manifest=JSON.parse(fs.readFileSync(manifestPath,"utf8"));
  const domainRisks=new Set(
    Object.entries(manifest.evidencePolicy.riskRequirements)
      .filter(([,classes])=>(classes as string[]).includes("domain-unit"))
      .map(([risk])=>risk),
  );
  const sourceOwned=new Set(
    Object.values(manifest.testGroups)
      .flatMap((group)=>((group as {tests?:string[]}).tests??[])),
  );

  for(const module of manifest.modules as {id:string,risks:string[],evidenceTests?:Record<string,string[]>}[]){
    const requiresDomain=module.risks.some(risk=>domainRisks.has(risk));
    const direct=module.evidenceTests?.["domain-unit"]??[];
    if(!requiresDomain){
      assert.equal(direct.length,0,module.id+" must not invent domain evidence when policy does not require it");
      continue;
    }
    assert.ok(direct.length>0,module.id+" requires approved direct domain evidence");
    assert.equal(new Set(direct).size,direct.length,module.id+" direct evidence paths must be unique");
    for(const file of direct){
      assert.match(file,/^tests\/.*[.]test[.]ts$/,module.id+" direct evidence must be an exact test path");
      assert.equal(fs.existsSync(path.join(root,file)),true,module.id+" direct evidence file must exist: "+file);
      assert.equal(file.startsWith("tests/integration/"),false,module.id+" direct unit evidence must not be PostgreSQL acceptance");
      assert.equal(sourceOwned.has(file),false,module.id+" direct unit evidence must not reuse a source-contract group file");
    }
  }
});

test("source-contract groups do not import browser PostgreSQL or DB acceptance fixtures",()=>{
  const manifest=JSON.parse(fs.readFileSync(manifestPath,"utf8"));
  const forbidden=/@playwright\/test|(?:^|\/)e2e\/|browser-db|bootstrap-browser-smoke-db|@neondatabase|(?:^|\/)lib\/db(?:[./]|$)|FLYTALLY_POSTGRES_INTEGRATION/;

  for(const [groupId,group] of Object.entries(manifest.testGroups) as [string,{evidenceClass:string,tests:string[]}][]){
    if(group.evidenceClass!=="application-source-contract")continue;
    for(const file of group.tests){
      const source=fs.readFileSync(path.join(root,file),"utf8");
      const imports=[...source.matchAll(/^\s*import(?:[\s\S]*?\sfrom\s*)?["']([^"']+)["'];?/gm)].map(match=>match[1]);
      for(const specifier of imports){
        if(specifier.startsWith("node:"))continue;
        assert.doesNotMatch(specifier,forbidden,groupId+" must not import runtime acceptance fixture "+specifier);
      }
    }
  }
});

test("scope planner reports required evidence separately from aggregate regression and build",()=>{
  const sourceContract=classify(["tests/v320-ui-consistency.test.ts"]);
  assert.equal(sourceContract.required_evidence,"application-source-contract");
  assert.equal(sourceContract.aggregate_gates,"none");
  assert.equal(sourceContract.build_artifact,"not-required");

  const domain=classify(["lib/commercial-pricing.ts"]);
  assert.equal(domain.required_evidence,"domain-unit");
  assert.equal(domain.aggregate_gates,"full-tests");
  assert.equal(domain.build_artifact,"required");

  const aggregateOnly=classify(["tests/future-unowned.test.ts"]);
  assert.equal(aggregateOnly.full_tests,"true");
  assert.equal(aggregateOnly.required_evidence,"none");
  assert.equal(aggregateOnly.aggregate_gates,"full-tests");
  assert.doesNotMatch(aggregateOnly.required_evidence,/domain-unit/);

  const crossDomain=classify(["app/(protected)/flights/page.tsx"]);
  assert.equal(
    crossDomain.required_evidence,
    "application-source-contract,browser-acceptance,domain-unit,postgres-acceptance",
  );
  assert.equal(crossDomain.build_artifact,"required");
});

test("UI command consumes the registry instead of duplicating the file list",()=>{
  const pkg=JSON.parse(fs.readFileSync(path.join(root,"package.json"),"utf8"));
  assert.equal(pkg.scripts["test:group"],"node tooling/run-development-test-group.mjs");
  assert.equal(pkg.scripts["test:ui"],"npm run test:group -- ui-contract");
  assert.doesNotMatch(pkg.scripts["test:ui"],/tests\//);
});

test("development test-group runner fails closed for an unknown group",()=>{
  const result=spawnSync(process.execPath,[groupRunner,"not-a-real-group"],{cwd:root,encoding:"utf8"});
  assert.equal(result.status,2,result.stderr||result.stdout);
  assert.match(result.stderr,/Unknown development test group/);
});
