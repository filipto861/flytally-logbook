import assert from "node:assert/strict";
import fs from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import test from "node:test";

const root=path.resolve(import.meta.dirname,"..");
const script=path.join(root,"tooling","verify-release-risk.mjs");

function run(args:string[]){
  return spawnSync(process.execPath,[script,...args],{
    cwd:root,
    encoding:"utf8",
    env:{...process.env,FLYTALLY_AUTH_BROWSER:"",FLYTALLY_LOCAL_POSTGRES:"",DATABASE_URL:""},
  });
}

test("risk release documentation candidate is PASS without hidden heavy gates",()=>{
  const result=run(["DEVELOPMENT.md"]);
  assert.equal(result.status,0,result.stderr||result.stdout);
  assert.match(result.stdout,/release_status=PASS/);
  assert.match(result.stdout,/source=N\/A/);
  assert.match(result.stdout,/domain=N\/A/);
  assert.match(result.stdout,/typecheck=N\/A/);
  assert.match(result.stdout,/aggregate=N\/A/);
  assert.match(result.stdout,/build=N\/A/);
  assert.match(result.stdout,/postgres=N\/A/);
  assert.match(result.stdout,/scale=N\/A/);
  assert.match(result.stdout,/browser=N\/A/);
  assert.match(result.stdout,/required_evidence=none/);
  assert.match(result.stdout,/blocked_evidence=none/);
});

test("risk release reuses exact cheap N/A evidence for the same documentation candidate",()=>{
  const first=run(["DEVELOPMENT.md"]);
  assert.equal(first.status,0,first.stderr||first.stdout);
  const second=run(["DEVELOPMENT.md"]);
  assert.equal(second.status,0,second.stderr||second.stdout);
  assert.match(second.stdout,/source=N\/A:reused/);
  assert.match(second.stdout,/domain=N\/A:reused/);
  assert.match(second.stdout,/typecheck=N\/A:reused/);
  assert.match(second.stdout,/release_status=PASS/);
});

test("risk release rerun bypasses reusable cheap evidence",()=>{
  const seeded=run(["DEVELOPMENT.md"]);
  assert.equal(seeded.status,0,seeded.stderr||seeded.stdout);
  const rerun=run(["DEVELOPMENT.md","--rerun"]);
  assert.equal(rerun.status,0,rerun.stderr||rerun.stdout);
  assert.doesNotMatch(rerun.stdout,/source=N\/A:reused/);
  assert.doesNotMatch(rerun.stdout,/domain=N\/A:reused/);
  assert.doesNotMatch(rerun.stdout,/typecheck=N\/A:reused/);
});

test("risk release blocks before execution when planner evidence ownership is incomplete",()=>{
  const result=run(["app/(protected)/credentials/page.tsx"]);
  assert.equal(result.status,3,result.stderr||result.stdout);
  assert.match(result.stdout,/release_status=NOT RUN/);
  assert.match(result.stdout,/blocked_evidence=.*missing-target-ownership/);
  assert.doesNotMatch(result.stdout,/postgres=PASS/);
  assert.doesNotMatch(result.stdout,/browser=PASS/);
});

test("risk release JSON reports candidate-bound final evidence state",()=>{
  const result=run(["DEVELOPMENT.md","--json"]);
  assert.equal(result.status,0,result.stderr||result.stdout);
  const payload=JSON.parse(result.stdout);
  assert.match(payload.candidateId,/^[a-f0-9]{64}$/);
  assert.equal(payload.releaseStatus,"PASS");
  assert.deepEqual(payload.requiredEvidence,[]);
  assert.deepEqual(payload.blockedEvidence,[]);
  assert.equal(payload.build.status,"N/A");
});

test("risk release source uses canonical evidence matrix and never invokes legacy full browser",()=>{
  const source=fs.readFileSync(script,"utf8");
  assert.match(source,/evaluateEvidenceMatrix/);
  assert.match(source,/runBrowserRiskVerification/);
  assert.match(source,/reusableBrowserRiskLedger/);
  assert.match(source,/runPostgresVerification/);
  assert.doesNotMatch(source,/runBrowserVerification/);
  assert.doesNotMatch(source,/verify:browser --/);
});

test("package preserves legacy release command and adds risk release separately",()=>{
  const pkg=JSON.parse(fs.readFileSync(path.join(root,"package.json"),"utf8"));
  assert.equal(pkg.scripts["verify:release"],"npm run typecheck && npm test && npm run test:postgres:full && npm run build");
  assert.equal(pkg.scripts["verify:release:risk"],"node tooling/verify-release-risk.mjs");
});
