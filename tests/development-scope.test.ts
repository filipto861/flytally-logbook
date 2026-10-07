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

test("documentation remains lightweight without runtime gates",()=>{
  const result=classify(["README.md","docs/product/example.md"]);
  assert.equal(result.postgres,"false");
  assert.equal(result.scale,"false");
  assert.equal(result.browser,"false");
  assert.equal(result.full_tests,"false");
  assert.equal(result.build,"false");
  assert.match(result.risks,/documentation/);
});

test("CSS is UI presentation risk rather than documentation or PostgreSQL risk",()=>{
  const result=classify(["app/globals.css"]);
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

test("browser specs select browser acceptance explicitly",()=>{
  const result=classify(["e2e/public-shell.spec.mjs"]);
  assert.equal(result.browser,"true");
  assert.equal(result.postgres,"false");
  assert.equal(result.full_tests,"true");
  assert.match(result.risks,/browser-ui/);
});

test("PostgreSQL harness changes select its source contracts and real acceptance",()=>{
  const result=classify(["tooling/run-postgres-tests.mjs"]);
  assert.equal(result.postgres,"true");
  assert.equal(result.full_tests,"true");
  assert.match(result.modules,/development-infrastructure/);
  assert.match(result.test_groups,/development-pipeline/);
  assert.match(result.targeted_tests,/tests\/development-pipeline\.test\.ts/);
});

test("development registry has unique ids scale paths and test ownership",()=>{
  const manifest=JSON.parse(fs.readFileSync(manifestPath,"utf8"));
  assert.equal(manifest.version,2);
  const ids=manifest.modules.map((module:{id:string})=>module.id);
  assert.equal(new Set(ids).size,ids.length);
  assert.equal(new Set(manifest.scalePaths).size,manifest.scalePaths.length);
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
