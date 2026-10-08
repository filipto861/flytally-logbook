import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";

const root=path.resolve(import.meta.dirname,"..");

test("application source evidence comes only from registry-approved source-contract groups",async()=>{
  const mod=await import(pathToFileURL(path.join(root,"tooling","verification-source.mjs")).href);
  const selected=mod.selectApplicationSourceContract({
    testGroups:["ui-contract","development-pipeline"],
    requiredEvidence:["application-source-contract"],
  });
  assert.equal(selected.required,true);
  assert.deepEqual(selected.groups,["development-pipeline","ui-contract"]);
  assert.ok(selected.tests.includes("tests/development-pipeline.test.ts"));
  assert.ok(selected.tests.includes("tests/v320-ui-consistency.test.ts"));
  assert.equal(new Set(selected.tests).size,selected.tests.length);
});

test("exact ledger reuse rejects stale candidate config and failed evidence",async()=>{
  const mod=await import(pathToFileURL(path.join(root,"tooling","verification-reuse.mjs")).href);
  const candidate={candidateId:"a".repeat(64)};
  const configuration={coverage:"targeted",groups:["development-pipeline"],hash:"x"};
  const base={
    schemaVersion:2,
    candidate:{candidateId:candidate.candidateId},
    gate:"source",
    evidenceClass:"application-source-contract",
    exitCode:0,
    effectiveConfiguration:configuration,
    evaluation:{status:"PASS"},
  };
  assert.equal(mod.reusableLedgerEntry(base,{
    candidate,gate:"source",evidenceClass:"application-source-contract",configuration,
  }).reusable,true);
  assert.equal(mod.reusableLedgerEntry({...base,candidate:{candidateId:"b".repeat(64)}},{
    candidate,gate:"source",evidenceClass:"application-source-contract",configuration,
  }).reusable,false);
  assert.equal(mod.reusableLedgerEntry({...base,effectiveConfiguration:{...configuration,hash:"y"}},{
    candidate,gate:"source",evidenceClass:"application-source-contract",configuration,
  }).reusable,false);
  assert.equal(mod.reusableLedgerEntry({...base,evaluation:{status:"FAIL"}},{
    candidate,gate:"source",evidenceClass:"application-source-contract",configuration,
  }).reusable,false);
  assert.equal(mod.reusableLedgerEntry({...base,schemaVersion:1},{
    candidate,gate:"source",evidenceClass:"application-source-contract",configuration,
  }).reason,"ledger-schema");
  assert.equal(mod.reusableLedgerEntry({...base,gate:"domain"},{
    candidate,gate:"source",evidenceClass:"application-source-contract",configuration,
  }).reason,"gate");
  assert.equal(mod.reusableLedgerEntry({...base,evidenceClass:"domain-unit"},{
    candidate,gate:"source",evidenceClass:"application-source-contract",configuration,
  }).reason,"evidence-class");
  assert.equal(mod.reusableLedgerEntry({...base,exitCode:1},{
    candidate,gate:"source",evidenceClass:"application-source-contract",configuration,
  }).reason,"exit-code");
});

test("build reuse requires the exact candidate artifact and current build output",async()=>{
  const mod=await import(pathToFileURL(path.join(root,"tooling","verification-build.mjs")).href);
  const candidate={candidateId:"e".repeat(64)};
  const artifact={kind:"next-build-id",value:"build-1"};
  const entry={
    schemaVersion:2,
    candidate:{candidateId:candidate.candidateId},
    gate:"build",
    artifactClass:"build",
    exitCode:0,
    artifact,
    evaluation:{status:"PASS"},
  };

  assert.deepEqual(
    mod.reusableBuildLedger(candidate,entry,{currentArtifact:artifact}),
    {reusable:true,reason:"exact-match"},
  );
  assert.equal(
    mod.reusableBuildLedger(candidate,entry,{currentArtifact:{kind:"next-build-id",value:"build-2"}}).reason,
    "build-output",
  );
  assert.equal(
    mod.reusableBuildLedger({...candidate,candidateId:"f".repeat(64)},entry,{currentArtifact:artifact}).reason,
    "candidate",
  );
  assert.equal(
    mod.reusableBuildLedger(candidate,{...entry,artifact:null},{currentArtifact:artifact}).reason,
    "evaluation",
  );
});

test("N/A evidence is reusable only when the caller explicitly permits it",async()=>{
  const mod=await import(pathToFileURL(path.join(root,"tooling","verification-reuse.mjs")).href);
  const candidate={candidateId:"c".repeat(64)};
  const entry={
    schemaVersion:2,
    candidate:{candidateId:candidate.candidateId},
    gate:"domain",
    evidenceClass:"domain-unit",
    exitCode:0,
    effectiveConfiguration:{coverage:"targeted"},
    evaluation:{status:"N/A"},
  };
  assert.equal(mod.reusableLedgerEntry(entry,{
    candidate,gate:"domain",evidenceClass:"domain-unit",configuration:{coverage:"targeted"},
  }).reusable,false);
  assert.equal(mod.reusableLedgerEntry(entry,{
    candidate,gate:"domain",evidenceClass:"domain-unit",configuration:{coverage:"targeted"},allowNA:true,
  }).reusable,true);
});

test("verify:iterate documentation candidate is fast and never claims release PASS",()=>{
  const script=path.join(root,"tooling","verify-iterate.mjs");
  const first=spawnSync(process.execPath,[script,"DEVELOPMENT.md"],{cwd:root,encoding:"utf8"});
  assert.equal(first.status,0,first.stderr||first.stdout);
  assert.match(first.stdout,/iteration_status=PASS/);
  assert.match(first.stdout,/release_status=NOT EVALUATED/);
  assert.match(first.stdout,/release_pending=none/);

  const second=spawnSync(process.execPath,[script,"DEVELOPMENT.md"],{cwd:root,encoding:"utf8"});
  assert.equal(second.status,0,second.stderr||second.stdout);
  assert.match(second.stdout,/source=N\/A:reused/);
  assert.match(second.stdout,/domain=N\/A:reused/);
  assert.match(second.stdout,/typecheck=N\/A:reused/);
  assert.match(second.stdout,/release_status=NOT EVALUATED/);
});

test("verify:iterate with-browser keeps a non-browser candidate N/A and reusable",()=>{
  const script=path.join(root,"tooling","verify-iterate.mjs");
  const first=spawnSync(process.execPath,[script,"DEVELOPMENT.md","--with-browser"],{
    cwd:root,
    encoding:"utf8",
    env:{...process.env,FLYTALLY_AUTH_BROWSER:"",FLYTALLY_LOCAL_POSTGRES:"",DATABASE_URL:""},
  });
  assert.equal(first.status,0,first.stderr||first.stdout);
  assert.match(first.stdout,/browser=N\/A/);
  assert.match(first.stdout,/release_status=NOT EVALUATED/);

  const second=spawnSync(process.execPath,[script,"DEVELOPMENT.md","--with-browser"],{
    cwd:root,
    encoding:"utf8",
    env:{...process.env,FLYTALLY_AUTH_BROWSER:"",FLYTALLY_LOCAL_POSTGRES:"",DATABASE_URL:""},
  });
  assert.equal(second.status,0,second.stderr||second.stdout);
  assert.match(second.stdout,/browser=N\/A:reused/);
});

test("package command keeps legacy release semantics and adds iterate separately",()=>{
  const pkg=JSON.parse(fs.readFileSync(path.join(root,"package.json"),"utf8"));
  assert.equal(pkg.scripts["verify:iterate"],"node tooling/verify-iterate.mjs");
  assert.equal(pkg.scripts["verify:browser:risk"],"node tooling/verify-browser-risk.mjs");
  assert.equal(pkg.scripts["verify:release"],"npm run typecheck && npm test && npm run test:postgres:full && npm run build");
});
