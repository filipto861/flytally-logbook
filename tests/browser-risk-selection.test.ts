import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";

const root=path.resolve(import.meta.dirname,"..");
const planner=path.join(root,"tooling","verify-plan.mjs");

function plan(args:string[]){
  const result=spawnSync(process.execPath,[planner,...args,"--json"],{cwd:root,encoding:"utf8"});
  return {result,payload:result.stdout.trim()?JSON.parse(result.stdout):null};
}

test("browser target registry resolves every declared target exactly once",async()=>{
  const moduleUrl=pathToFileURL(path.join(root,"tooling","browser-risk-selection.mjs")).href;
  const mod=await import(moduleUrl);
  assert.deepEqual(mod.validateBrowserTargetRegistry(),[]);
});

test("flight candidate selects deterministic risk-scoped browser targets and build artifact",()=>{
  const {result,payload}=plan(["app/(protected)/flights/page.tsx"]);
  assert.equal(result.status,0,result.stderr||result.stdout);
  assert.equal(payload.plan.browser,true);
  assert.equal(payload.plan.buildArtifactRequired,true);
  assert.equal(payload.plan.browserEvidence.required,true);
  assert.equal(payload.plan.browserEvidence.authoritativeSource,"browser-risk");
  assert.equal(payload.plan.browserEvidence.authority,"release");
  assert.match(payload.plan.browserEvidence.selectionHash,/^[a-f0-9]{64}$/);
  assert.match(payload.plan.browserEvidence.configHash,/^[a-f0-9]{64}$/);
  assert.match(payload.plan.browserEvidence.toolchainHash,/^[a-f0-9]{64}$/);
  assert.match(payload.plan.browserEvidence.fixtureContractHash,/^[a-f0-9]{64}$/);
  assert.equal(payload.plan.browserEvidence.plannerVersion,2);
  const ids=payload.plan.browserEvidence.targets.map((target:{id:string})=>target.id);
  for(const id of [
    "flight-manual-save-desktop","flight-manual-save-mobile",
    "flight-gps-save-desktop","flight-gps-save-mobile",
    "flight-void-desktop","flight-void-mobile",
  ])assert.ok(ids.includes(id),id+" must be selected");
  assert.deepEqual(payload.plan.browserEvidence.blockers,[]);
});

test("browser-relevant module with no approved target ownership blocks before Playwright",()=>{
  const {result,payload}=plan(["app/(protected)/credentials/page.tsx"]);
  assert.equal(result.status,3,result.stderr||result.stdout);
  assert.equal(payload.plan.browser,true);
  assert.ok(payload.plan.blockedEvidence.some((value:string)=>value.includes("browser-module:credentials-compliance:missing-target-ownership")));
});

test("changed authoritative E2E spec selects only registered targets owned by that spec",()=>{
  const {result,payload}=plan(["e2e/public-shell.spec.mjs"]);
  assert.equal(result.status,0,result.stderr||result.stdout);
  const targets=payload.plan.browserEvidence.targets;
  assert.ok(targets.length>0);
  assert.ok(targets.every((target:{spec:string})=>target.spec==="e2e/public-shell.spec.mjs"));
  assert.deepEqual(payload.plan.browserEvidence.blockers,[]);
});

test("changed diagnostic-only E2E spec fails closed instead of shrinking authoritative coverage",()=>{
  const {result,payload}=plan(["e2e/ui-audit-capture.spec.mjs"]);
  assert.equal(result.status,3,result.stderr||result.stdout);
  assert.ok(payload.plan.blockedEvidence.some((value:string)=>value.includes("changed-e2e-spec-has-no-authoritative-target")));
});

test("force-all has a deterministic registered harness target set",()=>{
  const {result,payload}=plan(["DEVELOPMENT.md","--force-all"]);
  assert.equal(result.status,0,result.stderr||result.stdout);
  assert.equal(payload.plan.browser,true);
  assert.ok(payload.plan.browserEvidence.targets.length>=20);
  assert.deepEqual(payload.plan.browserEvidence.blockers,[]);
});

test("candidate identity changes when an untracked worktree file changes",async()=>{
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),"flytally-candidate-v2-"));
  try{
    const git=(args:string[])=>{
      const result=spawnSync("git",args,{cwd:temp,encoding:"utf8"});
      assert.equal(result.status,0,result.stderr||result.stdout);
    };
    git(["init"]);
    git(["config","user.email","test@example.test"]);
    git(["config","user.name","FlyTally Test"]);
    fs.writeFileSync(path.join(temp,"tracked.txt"),"base\n");
    git(["add","tracked.txt"]);
    git(["commit","-m","base"]);

    const moduleUrl=pathToFileURL(path.join(root,"tooling","verification-candidate.mjs")).href;
    const mod=await import(moduleUrl);
    const first=mod.resolveVerificationCandidate(["tracked.txt"],temp).candidate;
    fs.writeFileSync(path.join(temp,"untracked.txt"),"one\n");
    const second=mod.resolveVerificationCandidate(["tracked.txt"],temp).candidate;
    fs.writeFileSync(path.join(temp,"untracked.txt"),"two\n");
    const third=mod.resolveVerificationCandidate(["tracked.txt"],temp).candidate;

    assert.equal(first.schemaVersion,2);
    assert.notEqual(first.candidateId,second.candidateId);
    assert.notEqual(second.candidateId,third.candidateId);
    assert.deepEqual(second.worktree.outsideCandidate,["untracked.txt"]);
    assert.match(second.worktree.hash,/^[a-f0-9]{64}$/);
  }finally{
    fs.rmSync(temp,{recursive:true,force:true});
  }
});
