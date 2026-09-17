import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const root=path.resolve(import.meta.dirname,"..");
const script=path.join(root,"tooling/vercel-ignore-build.mjs");
const productionBranch="main";

function run(command:string,args:string[],cwd:string){
  const result=spawnSync(command,args,{cwd,encoding:"utf8"});
  assert.equal(result.status,0,`${command} ${args.join(" ")} failed: ${result.stderr||result.stdout}`);
  return result;
}

function git(cwd:string,...args:string[]){
  return run("git",args,cwd);
}

function initRepo(){
  const repo=fs.mkdtempSync(path.join(os.tmpdir(),"flytally-vercel-ignore-"));
  git(repo,"init");
  git(repo,"config","user.email","ci@example.invalid");
  git(repo,"config","user.name","FlyTally CI");
  git(repo,"checkout","-b",productionBranch);
  fs.mkdirSync(path.join(repo,"app"),{recursive:true});
  fs.writeFileSync(path.join(repo,"app","base.ts"),"export const base = true;\n");
  fs.writeFileSync(path.join(repo,"ARCHITECTURE.md"),"# Base\n");
  git(repo,"add",".");
  git(repo,"commit","-m","base");

  git(repo,"checkout","-b","feature/seed");
  fs.writeFileSync(path.join(repo,"SEED.md"),"seed\n");
  git(repo,"add","SEED.md");
  git(repo,"commit","-m","seed candidate");
  git(repo,"checkout",productionBranch);
  git(repo,"-c","user.email=noreply@github.com","-c","user.name=GitHub","merge","--no-ff","feature/seed","-m","Seed production merge (#1)");
  return repo;
}

function decision(files:string[]){
  const env={
    ...process.env,
    VERCEL_ENV:"production",
    VERCEL_TARGET_ENV:"production",
    VERCEL_GIT_COMMIT_REF:productionBranch,
  };
  return spawnSync(process.execPath,[script,"--files",...files],{cwd:root,encoding:"utf8",env});
}

function gitDecision(repo:string,envOverrides:Record<string,string|undefined>){
  const env={...process.env,...envOverrides};
  if(envOverrides.VERCEL_GIT_PREVIOUS_SHA===undefined) delete env.VERCEL_GIT_PREVIOUS_SHA;
  return spawnSync(process.execPath,[script],{cwd:repo,encoding:"utf8",env});
}

function assertPreviewSkipped(result:ReturnType<typeof spawnSync>){
  assert.equal(result.status,0,String(result.stderr||result.stdout));
  assert.match(String(result.stdout),/Skipping Vercel preview build/);
}

test("Vercel skips only pure development-only changes in production",()=>{
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

test("Vercel still builds production for runtime, dependency and deployment configuration changes",()=>{
  for(const file of [
    "app/(protected)/flights/page.tsx",
    "components/flight-form.tsx",
    "lib/recency-service.ts",
    "package.json",
    "package-lock.json",
    "tsconfig.json",
    "next.config.ts",
    "vercel.json",
    "tooling/vercel-ignore-build.mjs",
  ]){
    const result=decision([file]);
    assert.equal(result.status,1,`${file} must require a Vercel build`);
  }
});

test("one runtime file prevents a mixed production change from being skipped",()=>{
  const result=decision(["README.md","tests/development-scope.test.ts","lib/db.ts"]);
  assert.equal(result.status,1);
});

test("single-commit preview is skipped before diff resolution",()=>{
  const repo=initRepo();
  try{
    git(repo,"checkout","-b","feature/docs");
    fs.writeFileSync(path.join(repo,"ARCHITECTURE.md"),"# Docs only\n");
    git(repo,"add","ARCHITECTURE.md");
    git(repo,"commit","-m","docs candidate");

    const result=gitDecision(repo,{
      VERCEL_GIT_PREVIOUS_SHA:undefined,
      VERCEL_ENV:"preview",
      VERCEL_TARGET_ENV:"preview",
      VERCEL_GIT_COMMIT_REF:"feature/docs",
    });
    assertPreviewSkipped(result);
  }finally{
    fs.rmSync(repo,{recursive:true,force:true});
  }
});

test("multi-commit preview is skipped without spending a Vercel build",()=>{
  const repo=initRepo();
  try{
    git(repo,"checkout","-b","feature/mixed");
    fs.mkdirSync(path.join(repo,"lib"),{recursive:true});
    fs.writeFileSync(path.join(repo,"lib","runtime.ts"),"export const runtime = true;\n");
    git(repo,"add","lib/runtime.ts");
    git(repo,"commit","-m","runtime change");
    fs.writeFileSync(path.join(repo,"ARCHITECTURE.md"),"# Final docs\n");
    git(repo,"add","ARCHITECTURE.md");
    git(repo,"commit","-m","docs after runtime");

    const result=gitDecision(repo,{
      VERCEL_GIT_PREVIOUS_SHA:undefined,
      VERCEL_ENV:"preview",
      VERCEL_TARGET_ENV:"preview",
      VERCEL_GIT_COMMIT_REF:"feature/mixed",
    });
    assertPreviewSkipped(result);
  }finally{
    fs.rmSync(repo,{recursive:true,force:true});
  }
});

test("previous deployment SHA does not cause a preview build",()=>{
  const repo=initRepo();
  try{
    const base=git(repo,"rev-parse",productionBranch).stdout.trim();
    git(repo,"checkout","-b","feature/previous-sha");
    fs.mkdirSync(path.join(repo,"lib"),{recursive:true});
    fs.writeFileSync(path.join(repo,"lib","runtime.ts"),"export const runtime = true;\n");
    git(repo,"add","lib/runtime.ts");
    git(repo,"commit","-m","runtime");
    fs.writeFileSync(path.join(repo,"ARCHITECTURE.md"),"# Docs\n");
    git(repo,"add","ARCHITECTURE.md");
    git(repo,"commit","-m","docs");

    const result=gitDecision(repo,{
      VERCEL_GIT_PREVIOUS_SHA:base,
      VERCEL_ENV:"preview",
      VERCEL_TARGET_ENV:"preview",
      VERCEL_GIT_COMMIT_REF:"feature/previous-sha",
    });
    assertPreviewSkipped(result);
  }finally{
    fs.rmSync(repo,{recursive:true,force:true});
  }
});

test("production fallback compares a merge commit with its first parent",()=>{
  const repo=initRepo();
  try{
    git(repo,"checkout","-b","feature/docs");
    fs.writeFileSync(path.join(repo,"ARCHITECTURE.md"),"# Production docs\n");
    git(repo,"add","ARCHITECTURE.md");
    git(repo,"commit","-m","docs");
    git(repo,"checkout",productionBranch);
    git(repo,"-c","user.email=noreply@github.com","-c","user.name=GitHub","merge","--no-ff","feature/docs","-m","merge docs");

    const docsMerge=gitDecision(repo,{
      VERCEL_GIT_PREVIOUS_SHA:undefined,
      VERCEL_ENV:"production",
      VERCEL_TARGET_ENV:"production",
      VERCEL_GIT_COMMIT_REF:productionBranch,
    });
    assert.equal(docsMerge.status,0,docsMerge.stderr||docsMerge.stdout);
    assert.match(docsMerge.stderr,/production first parent/);

    git(repo,"checkout","-b","feature/runtime");
    fs.mkdirSync(path.join(repo,"lib"),{recursive:true});
    fs.writeFileSync(path.join(repo,"lib","runtime.ts"),"export const runtime = true;\n");
    git(repo,"add","lib/runtime.ts");
    git(repo,"commit","-m","runtime");
    git(repo,"checkout",productionBranch);
    git(repo,"-c","user.email=noreply@github.com","-c","user.name=GitHub","merge","--no-ff","feature/runtime","-m","merge runtime");

    const runtimeMerge=gitDecision(repo,{
      VERCEL_GIT_PREVIOUS_SHA:undefined,
      VERCEL_ENV:"production",
      VERCEL_TARGET_ENV:"production",
      VERCEL_GIT_COMMIT_REF:productionBranch,
    });
    assert.equal(runtimeMerge.status,1,runtimeMerge.stderr||runtimeMerge.stdout);
  }finally{
    fs.rmSync(repo,{recursive:true,force:true});
  }
});

test("untrusted preview parent is still skipped before diff resolution",()=>{
  const repo=fs.mkdtempSync(path.join(os.tmpdir(),"flytally-vercel-failsafe-"));
  try{
    git(repo,"init");
    git(repo,"config","user.email","ci@example.invalid");
    git(repo,"config","user.name","FlyTally CI");
    git(repo,"checkout","-b","feature/no-trusted-base");
    fs.writeFileSync(path.join(repo,"README.md"),"base\n");
    git(repo,"add","README.md");
    git(repo,"commit","-m","ordinary parent");
    fs.appendFileSync(path.join(repo,"README.md"),"docs\n");
    git(repo,"add","README.md");
    git(repo,"commit","-m","candidate");

    const result=gitDecision(repo,{
      VERCEL_GIT_PREVIOUS_SHA:undefined,
      VERCEL_ENV:"preview",
      VERCEL_TARGET_ENV:"preview",
      VERCEL_GIT_COMMIT_REF:"feature/no-trusted-base",
    });
    assertPreviewSkipped(result);
  }finally{
    fs.rmSync(repo,{recursive:true,force:true});
  }
});

test("vercel config delegates ignored builds to the conservative tooling guard",()=>{
  const config=JSON.parse(fs.readFileSync(path.join(root,"vercel.json"),"utf8"));
  assert.equal(config.ignoreCommand,"node tooling/vercel-ignore-build.mjs");
});
