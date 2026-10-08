import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

const root=path.resolve(import.meta.dirname,"..");

async function importTooling(relativePath:string){
  return import(pathToFileURL(path.join(root,relativePath)).href);
}

test("Phase 0E canonical verification modules are syntactically parseable",()=>{
  for(const file of [
    "tooling/verification-ledger.mjs",
    "tooling/verification-identity.mjs",
    "tooling/browser-risk-selection.mjs",
    "tooling/verification-execution.mjs",
    "tooling/verification-reuse.mjs",
    "tooling/verification-source.mjs",
    "tooling/verification-typecheck.mjs",
    "tooling/verification-build.mjs",
    "tooling/verification-aggregate.mjs",
    "tooling/verification-browser-risk.mjs",
    "tooling/verify-app.mjs",
    "tooling/verify-app-compat.mjs",
    "tooling/verify-domain.mjs",
    "tooling/verify-iterate.mjs",
    "tooling/verify-postgres.mjs",
    "tooling/verify-release-risk.mjs",
    "tooling/verify-browser.mjs",
    "tooling/verify-browser-risk.mjs",
    "tooling/verify-browser-with-build.mjs",
    "tooling/playwright-evidence-reporter.mjs",
    "playwright.config.mjs",
  ]){
    const result=spawnSync(process.execPath,["--check",path.join(root,file)],{cwd:root,encoding:"utf8"});
    assert.equal(result.status,0,file+" failed node --check:\n"+result.stderr);
  }
});

test("verification ledger writes and reads one candidate-bound gate entry",async()=>{
  const {readVerificationLedgerEntry,verificationLedgerPath,writeVerificationLedgerEntry}=await importTooling("tooling/verification-ledger.mjs");
  const candidateId="a".repeat(64);
  const target=verificationLedgerPath(candidateId,"domain");
  fs.rmSync(path.dirname(target),{recursive:true,force:true});
  try{
    const candidate={
      schemaVersion:2,
      candidateId,
      headSha:"b".repeat(40),
      baseSha:null,
      filesHash:"c".repeat(64),
      source:{kind:"paths",value:null},
      files:["lib/commercial-readiness.ts"],
      worktree:{files:[],hash:"d".repeat(64),outsideCandidate:[]},
    };
    writeVerificationLedgerEntry({
      gate:"domain",
      evidenceClass:"domain-unit",
      candidate,
      canonicalCommand:"npm run verify:domain -- lib/commercial-readiness.ts",
      exitCode:0,
      evaluation:{status:"PASS",reason:"test"},
    });
    const stored=readVerificationLedgerEntry(candidateId,"domain");
    assert.equal(stored?.schemaVersion,2);
    assert.equal(stored?.gate,"domain");
    assert.equal(stored?.candidate.candidateId,candidateId);
    assert.deepEqual(stored?.candidate.files,["lib/commercial-readiness.ts"]);
    assert.deepEqual(stored?.candidate.worktree.outsideCandidate,[]);
    assert.match(stored?.recordedAt,/^\d{4}-\d{2}-\d{2}T/);
  }finally{
    fs.rmSync(path.dirname(target),{recursive:true,force:true});
  }
});

test("verification ledger rejects malformed candidate and gate identities",async()=>{
  const {verificationLedgerPath}=await importTooling("tooling/verification-ledger.mjs");
  assert.throws(()=>verificationLedgerPath("../escape","domain"),/Invalid verification candidate id/);
  assert.throws(()=>verificationLedgerPath("a".repeat(64),"../domain"),/Invalid verification gate name/);
});

test("verification execution parses Node spec and TAP summaries without inventing evidence",async()=>{
  const {parseNodeTestSummary}=await importTooling("tooling/verification-execution.mjs");
  assert.deepEqual(
    parseNodeTestSummary("ℹ tests 6\nℹ pass 6\nℹ fail 0\nℹ skipped 0\n"),
    {planned:6,passed:6,failed:0,skipped:0,notApplicable:0,retries:0},
  );
  assert.deepEqual(
    parseNodeTestSummary("# tests 12\n# pass 10\n# fail 1\n# skipped 1\n"),
    {planned:12,passed:10,failed:1,skipped:1,notApplicable:0,retries:0},
  );
  assert.throws(()=>parseNodeTestSummary("no summary"),/Could not parse Node test summary/);
});

test("browser reporter maps only the registered audit exclusion to explicit N/A",async()=>{
  const {browserCaseIdentity,explicitBrowserNotApplicable}=await importTooling("tooling/playwright-evidence-reporter.mjs");
  assert.equal(explicitBrowserNotApplicable({
    annotations:[{type:"flytally-na",description:"UI audit capture runs only for the dedicated audit branch or explicit local opt-in."}],
  }),true);
  assert.equal(explicitBrowserNotApplicable({
    annotations:[{type:"skip",description:"Unexpected browser skip"}],
  }),false);
  assert.equal(explicitBrowserNotApplicable({annotations:[]}),false);
  assert.deepEqual(browserCaseIdentity({
    title:"Exact case",
    location:{file:path.join(root,"e2e","sample.spec.mjs")},
    parent:{project:()=>({name:"mobile-chromium"})},
  },root),{
    spec:"e2e/sample.spec.mjs",
    title:"Exact case",
    project:"mobile-chromium",
  });
  const audit=fs.readFileSync(path.join(root,"e2e","ui-audit-capture.spec.mjs"),"utf8");
  assert.match(audit,/annotation:\{type:"flytally-na",description:"UI audit capture runs only/);
});

test("risk browser acceptance owns exact planner selection and same-candidate build",()=>{
  const risk=fs.readFileSync(path.join(root,"tooling","verify-browser-risk.mjs"),"utf8");
  const diagnostic=fs.readFileSync(path.join(root,"tooling","verify-browser.mjs"),"utf8");
  const withBuild=fs.readFileSync(path.join(root,"tooling","verify-browser-with-build.mjs"),"utf8");
  assert.match(risk,/readVerificationLedgerEntry\(candidate\.candidateId,"build"\)/);
  assert.match(risk,/buildIdentityMatches\(build\.artifact,current\)/);
  assert.match(risk,/runCandidateBuild/);
  assert.match(risk,/sourceGate:"browser-risk"/);
  assert.match(risk,/selectionHash:browserEvidence\.selectionHash/);
  assert.match(risk,/compareExactTargetSet/);
  assert.match(risk,/FLYTALLY_BROWSER_EVIDENCE_FILE/);
  assert.match(diagnostic,/gate:"browser-diagnostic"/);
  assert.match(diagnostic,/sourceGate:"browser-diagnostic"/);
  assert.doesNotMatch(diagnostic,/evidenceClass:"browser-acceptance"/);
  assert.match(withBuild,/runCandidateBuild/);
  assert.match(withBuild,/runBrowserVerification/);
});

test("verification identities cover planner release toolchain and browser fixture inputs",async()=>{
  const {browserFixtureContractIdentity,declaredToolchainIdentity,verificationConfigIdentity}=await importTooling("tooling/verification-identity.mjs");
  const config=verificationConfigIdentity();
  const fixture=browserFixtureContractIdentity();
  const toolchain=declaredToolchainIdentity();

  assert.match(config.hash,/^[a-f0-9]{64}$/);
  for(const file of [
    "tooling/development-modules.json",
    "tooling/verification-reuse.mjs",
    "tooling/verification-build.mjs",
    "tooling/verification-browser-risk.mjs",
    "tooling/verify-release-risk.mjs",
  ])assert.ok(config.files.some((entry:{name:string})=>entry.name===file),file);

  assert.match(fixture.hash,/^[a-f0-9]{64}$/);
  assert.deepEqual(fixture.files.map((entry:{name:string})=>entry.name),[
    "e2e/browser-db.mjs",
    "tooling/bootstrap-browser-smoke-db.mjs",
  ]);

  assert.match(toolchain.hash,/^[a-f0-9]{64}$/);
  assert.match(toolchain.packageLockSha256,/^[a-f0-9]{64}$/);
  assert.ok(String(toolchain.nodeRuntime).startsWith("v"));
  assert.ok(String(toolchain.playwright).length>0);
});

test("browser-risk reuse rejects selection config toolchain fixture and build freshness drift",async()=>{
  const {browserRiskConfiguration,reusableBrowserRiskLedger}=await importTooling("tooling/verification-browser-risk.mjs");
  const candidate={candidateId:"9".repeat(64)};
  const artifact={kind:"next-build-id",value:"build-1"};
  const evidence={
    required:true,
    selectionHash:"1".repeat(64),
    configHash:"2".repeat(64),
    toolchainHash:"3".repeat(64),
    fixtureContractHash:"4".repeat(64),
    targets:[{id:"target-a",spec:"e2e/a.spec.mjs",title:"A",project:"desktop-chromium"}],
  };
  const entry={
    schemaVersion:2,
    candidate:{candidateId:candidate.candidateId},
    gate:"browser-risk",
    evidenceClass:"browser-acceptance",
    exitCode:0,
    effectiveConfiguration:browserRiskConfiguration(evidence,artifact),
    evaluation:{status:"PASS"},
  };
  const buildLedger={exitCode:0,evaluation:{status:"PASS"},artifact};
  const exact={buildLedger,currentBuildArtifact:artifact};

  assert.deepEqual(
    reusableBrowserRiskLedger(candidate,evidence,entry,exact),
    {reusable:true,reason:"exact-match"},
  );

  for(const changed of [
    {...evidence,selectionHash:"5".repeat(64)},
    {...evidence,configHash:"6".repeat(64)},
    {...evidence,toolchainHash:"7".repeat(64)},
    {...evidence,fixtureContractHash:"8".repeat(64)},
    {...evidence,targets:[{...evidence.targets[0],project:"mobile-chromium"}]},
  ]){
    assert.equal(reusableBrowserRiskLedger(candidate,changed,entry,exact).reason,"configuration");
  }

  assert.equal(
    reusableBrowserRiskLedger(candidate,evidence,entry,{
      buildLedger:{...buildLedger,artifact:{kind:"next-build-id",value:"build-2"}},
      currentBuildArtifact:artifact,
    }).reason,
    "build-ledger",
  );
  assert.equal(
    reusableBrowserRiskLedger(candidate,evidence,entry,{
      buildLedger,
      currentBuildArtifact:{kind:"next-build-id",value:"build-2"},
    }).reason,
    "build-output",
  );

  const noArtifactEntry={
    ...entry,
    effectiveConfiguration:browserRiskConfiguration(evidence,null),
  };
  assert.equal(
    reusableBrowserRiskLedger(candidate,evidence,noArtifactEntry,{buildLedger:null,currentBuildArtifact:null}).reason,
    "build-artifact",
  );
});

test("risk browser exact target comparison is order-independent and identity-strict",async()=>{
  const {browserRiskConfiguration,buildBrowserRiskTitleGrep,compareExactTargetSet}=await importTooling("tooling/verification-browser-risk.mjs");
  const targets=[
    {id:"a",spec:"e2e/a.spec.mjs",title:"A",project:"desktop-chromium"},
    {id:"b",spec:"e2e/b.spec.mjs",title:"B",project:"mobile-chromium"},
  ];
  const grep=new RegExp(buildBrowserRiskTitleGrep(["A (exact)"]));
  assert.equal(grep.test("desktop-chromium › e2e/a.spec.mjs:10 › A (exact)"),true);
  assert.equal(grep.test("desktop-chromium › e2e/a.spec.mjs:10 › Unrelated test"),false);

  assert.equal(compareExactTargetSet(targets,[targets[1],targets[0]]),true);
  assert.equal(compareExactTargetSet(targets,[targets[0]]),false);
  assert.equal(compareExactTargetSet(targets,[
    targets[0],
    {...targets[1],project:"desktop-chromium"},
  ]),false);

  const configuration=browserRiskConfiguration({
    selectionHash:"a".repeat(64),
    configHash:"b".repeat(64),
    toolchainHash:"c".repeat(64),
    fixtureContractHash:"d".repeat(64),
    targets,
  },{kind:"next-build-id",value:"build-1"});
  assert.equal(configuration.authority,"release");
  assert.equal(configuration.source,"browser-risk");
  assert.equal(configuration.coverage,"targeted");
  assert.equal(configuration.selectionHash,"a".repeat(64));
  assert.deepEqual(configuration.buildArtifact,{kind:"next-build-id",value:"build-1"});
});

test("canonical Phase 0E gate scripts stay candidate-bound and keep browser migration separate",()=>{
  const pkg=JSON.parse(fs.readFileSync(path.join(root,"package.json"),"utf8"));
  assert.equal(pkg.scripts.verify,"node tooling/verify-app-compat.mjs");
  assert.equal(pkg.scripts["verify:app"],"node tooling/verify-app.mjs");
  assert.equal(pkg.scripts["verify:domain"],"node tooling/verify-domain.mjs");
  assert.equal(pkg.scripts["verify:iterate"],"node tooling/verify-iterate.mjs");
  assert.equal(pkg.scripts["verify:release:risk"],"node tooling/verify-release-risk.mjs");
  assert.equal(pkg.scripts["verify:postgres"],"node tooling/verify-postgres.mjs");
  assert.equal(pkg.scripts["verify:browser"],"node tooling/verify-browser.mjs");
  assert.equal(pkg.scripts["verify:browser:risk"],"node tooling/verify-browser-risk.mjs");
  assert.equal(pkg.scripts["verify:browser:with-build"],"node tooling/verify-browser-with-build.mjs");
  const compat=fs.readFileSync(path.join(root,"tooling","verify-app-compat.mjs"),"utf8");
  assert.match(compat,/argv\.length>0\?argv:\["--all"\]/);
  assert.match(fs.readFileSync(path.join(root,".gitignore"),"utf8"),/^\.flytally\/$/m);
});
