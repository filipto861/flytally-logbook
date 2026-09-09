import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const root=path.resolve(import.meta.dirname,"..");
const script=path.join(root,"tooling/vercel-ignore-build.mjs");

function decision(files:string[]){
  return spawnSync(process.execPath,[script,"--files",...files],{cwd:root,encoding:"utf8"});
}

test("Vercel skips only pure development-only changes",()=>{
  const result=decision([
    "DEVELOPMENT.md",
    "docs/module-guide.md",
    ".github/workflows/verify-web.yml",
    "tests/development-scope.test.ts",
    "tooling/development-scope.mjs",
  ]);
  assert.equal(result.status,0,result.stderr||result.stdout);
  assert.match(result.stdout,/Skipping Vercel build/);
});

test("Vercel still builds for runtime, dependency and deployment configuration changes",()=>{
  for(const file of [
    "app/(protected)/flights/page.tsx",
    "components/flight-form.tsx",
    "lib/recency-service.ts",
    "package.json",
    "package-lock.json",
    "tsconfig.json",
    "next.config.ts",
    "vercel.json",
  ]){
    const result=decision([file]);
    assert.equal(result.status,1,`${file} must require a Vercel build`);
  }
});

test("one runtime file prevents a mixed change from being skipped",()=>{
  const result=decision(["README.md","tests/development-scope.test.ts","lib/db.ts"]);
  assert.equal(result.status,1);
});

test("missing Vercel previous SHA fails safe by requiring a build",()=>{
  const env={...process.env};
  delete env.VERCEL_GIT_PREVIOUS_SHA;
  const result=spawnSync(process.execPath,[script],{cwd:root,encoding:"utf8",env});
  assert.equal(result.status,1);
  assert.match(result.stderr,/build required/i);
});

test("vercel config delegates ignored builds to the conservative tooling guard",()=>{
  const config=JSON.parse(fs.readFileSync(path.join(root,"vercel.json"),"utf8"));
  assert.equal(config.ignoreCommand,"node tooling/vercel-ignore-build.mjs");
});
