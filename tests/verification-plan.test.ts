import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const root=path.resolve(import.meta.dirname,"..");
const planner=path.join(root,"tooling","verify-plan.mjs");

function run(args:string[]){
  return spawnSync(process.execPath,[planner,...args],{cwd:root,encoding:"utf8"});
}

function withFiles(lines:string[],callback:(file:string)=>void){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),"flytally-verify-plan-"));
  const file=path.join(dir,"files.txt");
  fs.writeFileSync(file,lines.join("\n")+"\n");
  try{callback(file);}finally{fs.rmSync(dir,{recursive:true,force:true});}
}

test("verify:plan fails closed when candidate input is omitted",()=>{
  const result=run(["--json"]);
  assert.equal(result.status,2,result.stderr||result.stdout);
  assert.match(result.stderr,/No candidate supplied/);
});

test("verify:plan rejects multiple candidate sources",()=>{
  withFiles(["DEVELOPMENT.md"],file=>{
    const result=run(["DEVELOPMENT.md","--files",file,"--json"]);
    assert.equal(result.status,2,result.stderr||result.stdout);
    assert.match(result.stderr,/Exactly one candidate source is required/);
  });
});

test("verify:plan JSON binds plan to deterministic content-aware candidate identity",()=>{
  withFiles(["DEVELOPMENT.md","package.json"],file=>{
    const first=run(["--files",file,"--json"]);
    const second=run(["--files",file,"--json"]);
    assert.equal(first.status,0,first.stderr||first.stdout);
    assert.equal(second.status,0,second.stderr||second.stdout);
    const a=JSON.parse(first.stdout),b=JSON.parse(second.stdout);
    assert.equal(a.schemaVersion,1);
    assert.equal(a.candidate.schemaVersion,1);
    assert.match(a.candidate.candidateId,/^[a-f0-9]{64}$/);
    assert.match(a.candidate.filesHash,/^[a-f0-9]{64}$/);
    assert.match(a.candidate.headSha,/^[a-f0-9]{40}$/);
    assert.deepEqual(a.candidate.files,["DEVELOPMENT.md","package.json"]);
    assert.equal(a.candidate.source.kind,"files");
    assert.equal(a.candidate.candidateId,b.candidate.candidateId);
    assert.equal(a.candidate.filesHash,b.candidate.filesHash);
    assert.equal(a.plan.typecheck,true);
    assert.equal(a.plan.fullTests,true);
    assert.equal(a.plan.build,true);
    assert.match(a.plan.modules.join(","),/development-infrastructure/);
    assert.deepEqual(a.plan.blockedEvidence,[]);
  });
});

test("documentation-only verify:plan does not require typecheck or runtime gates",()=>{
  withFiles(["DEVELOPMENT.md"],file=>{
    const result=run(["--files",file,"--json"]);
    assert.equal(result.status,0,result.stderr||result.stdout);
    const plan=JSON.parse(result.stdout).plan;
    assert.equal(plan.typecheck,false);
    assert.equal(plan.postgres,false);
    assert.equal(plan.browser,false);
    assert.equal(plan.fullTests,false);
    assert.equal(plan.build,false);
    assert.match(plan.risks.join(","),/documentation/);
  });
});

test("verify:plan --force-all changes gates without changing candidate membership",()=>{
  withFiles(["DEVELOPMENT.md"],file=>{
    const normal=run(["--files",file,"--json"]);
    const forced=run(["--files",file,"--force-all","--json"]);
    assert.equal(normal.status,0,normal.stderr||normal.stdout);
    assert.equal(forced.status,0,forced.stderr||forced.stdout);
    const a=JSON.parse(normal.stdout),b=JSON.parse(forced.stdout);
    assert.equal(a.candidate.candidateId,b.candidate.candidateId);
    assert.deepEqual(a.candidate.files,b.candidate.files);
    assert.equal(b.forceAll,true);
    assert.equal(b.plan.typecheck,true);
    assert.equal(b.plan.postgres,true);
    assert.equal(b.plan.scale,true);
    assert.equal(b.plan.browser,true);
    assert.equal(b.plan.fullTests,true);
    assert.equal(b.plan.build,true);
    assert.match(b.plan.risks.join(","),/full-ci/);
  });
});

test("verify:plan rejects an unresolved explicit base ref",()=>{
  const result=run(["--base","refs/heads/definitely-not-a-flytally-ref","--json"]);
  assert.equal(result.status,2,result.stderr||result.stdout);
  assert.match(result.stderr,/Git command failed/);
});

test("verify:plan human output exposes candidate and gate contract",()=>{
  const result=run(["package.json"]);
  assert.equal(result.status,0,result.stderr||result.stdout);
  assert.match(result.stdout,/candidate_id=[a-f0-9]{64}/);
  assert.match(result.stdout,/head_sha=[a-f0-9]{40}/);
  assert.match(result.stdout,/typecheck=true/);
  assert.match(result.stdout,/full_tests=true/);
  assert.match(result.stdout,/build=true/);
  assert.match(result.stdout,/required_evidence=/);
  assert.match(result.stdout,/blocked_evidence=none/);
});
