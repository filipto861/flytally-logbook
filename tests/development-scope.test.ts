import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const root=path.resolve(import.meta.dirname,"..");
const scopeScript=path.join(root,"tooling/development-scope.mjs");
const manifestPath=path.join(root,"tooling/development-modules.json");

function classify(files:string[],title=""){
  const tempDir=fs.mkdtempSync(path.join(os.tmpdir(),"flytally-scope-"));
  const changedFile=path.join(tempDir,"changed-files.txt");
  fs.writeFileSync(changedFile,`${files.join("\n")}\n`);
  const result=spawnSync(process.execPath,[scopeScript,"--files",changedFile,"--title",title],{encoding:"utf8"});
  fs.rmSync(tempDir,{recursive:true,force:true});
  assert.equal(result.status,0,result.stderr||result.stdout);
  return Object.fromEntries(result.stdout.trim().split(/\r?\n/).map(line=>{
    const index=line.indexOf("=");
    return [line.slice(0,index),line.slice(index+1)];
  }));
}

test("development scope preserves lightweight docs and CSS behavior",()=>{
  const result=classify(["README.md","app/globals.css"]);
  assert.equal(result.postgres,"false");
  assert.equal(result.scale,"false");
  assert.equal(result.full_tests,"false");
});

test("UI contract tests stay on the targeted fast path",()=>{
  const result=classify(["app/ui-system.css","tests/v320-ui-consistency.test.ts"]);
  assert.equal(result.postgres,"false");
  assert.equal(result.full_tests,"false");
});

test("unknown application code remains conservative",()=>{
  const result=classify(["lib/future-module.ts"]);
  assert.equal(result.postgres,"true");
  assert.equal(result.scale,"false");
  assert.equal(result.full_tests,"true");
  assert.match(result.modules,/shared/);
});

test("known hot paths select PostgreSQL and scale gates centrally",()=>{
  const result=classify(["lib/data/dashboard.ts"]);
  assert.equal(result.postgres,"true");
  assert.equal(result.scale,"true");
  assert.equal(result.full_tests,"true");
  assert.match(result.modules,/analytics/);
});

test("full-ci forces the complete gate even for documentation-only work",()=>{
  const result=classify(["DEVELOPMENT.md"],"[full-ci] infrastructure transition");
  assert.equal(result.postgres,"true");
  assert.equal(result.scale,"true");
  assert.equal(result.full_tests,"true");
  assert.match(result.modules,/development-infrastructure/);
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

test("development module registry has unique ids and unique scale paths",()=>{
  const manifest=JSON.parse(fs.readFileSync(manifestPath,"utf8"));
  const ids=manifest.modules.map((module:{id:string})=>module.id);
  assert.equal(new Set(ids).size,ids.length);
  assert.equal(new Set(manifest.scalePaths).size,manifest.scalePaths.length);
  assert.ok(manifest.modules.some((module:{id:string})=>module.id==="development-infrastructure"));
});
