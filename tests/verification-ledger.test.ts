import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { parseNodeTestSummary } from "../tooling/verification-execution.mjs";
import { explicitBrowserNotApplicable } from "../tooling/playwright-evidence-reporter.mjs";
import {
  readVerificationLedgerEntry,
  verificationLedgerPath,
  writeVerificationLedgerEntry,
} from "../tooling/verification-ledger.mjs";

const root=path.resolve(import.meta.dirname,"..");

test("verification ledger writes and reads one candidate-bound gate entry",()=>{
  const candidateId="a".repeat(64);
  const target=verificationLedgerPath(candidateId,"domain");
  fs.rmSync(path.dirname(target),{recursive:true,force:true});
  try{
    const candidate={
      schemaVersion:1,
      candidateId,
      headSha:"b".repeat(40),
      baseSha:null,
      filesHash:"c".repeat(64),
      source:{kind:"paths",value:null},
      files:["lib/commercial-readiness.ts"],
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
    assert.equal(stored?.schemaVersion,1);
    assert.equal(stored?.gate,"domain");
    assert.equal(stored?.candidate.candidateId,candidateId);
    assert.deepEqual(stored?.candidate.files,["lib/commercial-readiness.ts"]);
    assert.match(stored?.recordedAt,/^\d{4}-\d{2}-\d{2}T/);
  }finally{
    fs.rmSync(path.dirname(target),{recursive:true,force:true});
  }
});

test("verification ledger rejects malformed candidate and gate identities",()=>{
  assert.throws(()=>verificationLedgerPath("../escape","domain"),/Invalid verification candidate id/);
  assert.throws(()=>verificationLedgerPath("a".repeat(64),"../domain"),/Invalid verification gate name/);
});

test("verification execution parses Node spec and TAP summaries without inventing evidence",()=>{
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

test("browser reporter maps only the registered audit exclusion to explicit N/A",()=>{
  assert.equal(explicitBrowserNotApplicable({
    annotations:[{type:"skip",description:"UI audit capture runs only for the dedicated audit branch or explicit local opt-in."}],
  }),true);
  assert.equal(explicitBrowserNotApplicable({
    annotations:[{type:"skip",description:"Unexpected browser skip"}],
  }),false);
  assert.equal(explicitBrowserNotApplicable({annotations:[]}),false);
});

test("canonical browser acceptance requires the recorded same-candidate build before Playwright",()=>{
  const browser=fs.readFileSync(path.join(root,"tooling","verify-browser.mjs"),"utf8");
  const withBuild=fs.readFileSync(path.join(root,"tooling","verify-browser-with-build.mjs"),"utf8");
  assert.match(browser,/readVerificationLedgerEntry\(candidate\.candidateId,"build"\)/);
  assert.match(browser,/buildIdentityMatches\(build\.artifact,current\)/);
  assert.match(browser,/\["--retries=0","--workers=1"\]/);
  assert.match(browser,/FLYTALLY_BROWSER_EVIDENCE_FILE/);
  assert.ok(
    browser.indexOf('readVerificationLedgerEntry(candidate.candidateId,"build")')<
    browser.indexOf('run-auth-browser.mjs'),
    "build freshness must be checked before authenticated browser execution",
  );
  assert.match(withBuild,/runCandidateBuild/);
  assert.match(withBuild,/runBrowserVerification/);
});

test("canonical Phase 0E gate scripts stay candidate-bound and keep browser migration separate",()=>{
  const pkg=JSON.parse(fs.readFileSync(path.join(root,"package.json"),"utf8"));
  assert.equal(pkg.scripts.verify,"node tooling/verify-app.mjs");
  assert.equal(pkg.scripts["verify:app"],"node tooling/verify-app.mjs");
  assert.equal(pkg.scripts["verify:domain"],"node tooling/verify-domain.mjs");
  assert.equal(pkg.scripts["verify:postgres"],"node tooling/verify-postgres.mjs");
  assert.equal(pkg.scripts["verify:browser"],"node tooling/verify-browser.mjs");
  assert.equal(pkg.scripts["verify:browser:with-build"],"node tooling/verify-browser-with-build.mjs");
  assert.match(fs.readFileSync(path.join(root,".gitignore"),"utf8"),/^\.flytally\/$/m);
});
