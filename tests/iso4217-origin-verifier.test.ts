import assert from "node:assert/strict";
import test from "node:test";
import {readFileSync} from "node:fs";
import {mkdtempSync,writeFileSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {spawnSync} from "node:child_process";
import {fileURLToPath} from "node:url";
import {
  compareIso4217Snapshots,gitBlobSha1,xmlPublication,sha256,
  EXPECTED_PUBLICATION,PINNED_GIT_BLOB_SHA1,
} from "../tooling/verify-iso4217-origin.mjs";

const pin=readFileSync(new URL("../data/iso4217/list-one-2026-09-17.xml",import.meta.url));
const script=fileURLToPath(new URL("../tooling/verify-iso4217-origin.mjs",import.meta.url));

test("pinned registry source has verified Git blob but is NOT official-origin authenticated",()=>{
  assert.equal(xmlPublication(pin),EXPECTED_PUBLICATION);
  assert.equal(gitBlobSha1(pin),PINNED_GIT_BLOB_SHA1);
  assert.match(sha256(pin),/^[a-f0-9]{64}$/);
  assert.deepEqual(compareIso4217Snapshots(pin,Buffer.from(pin)).status,"byte-identical");
});

test("source date change, altered content, malformed XML and malicious DTD reject",()=>{
  const source=pin.toString("utf8");
  const withDate=Buffer.from(source.replace('Pblshd="2026-09-17"','Pblshd="2026-09-18"'),"utf8");
  assert.equal(compareIso4217Snapshots(withDate,pin).status,"different-publication");
  assert.equal(compareIso4217Snapshots(Buffer.from(source.replace("<Ccy>AFN</Ccy>","<Ccy>ZZZ</Ccy>")),pin).status,"different-content");
  assert.equal(compareIso4217Snapshots(Buffer.from("no xml"),pin).status,"invalid-xml");
  assert.equal(compareIso4217Snapshots(Buffer.from("<!DOCTYPE x>"+source),pin).status,"invalid-xml");
  assert.equal(compareIso4217Snapshots(pin,Buffer.from(source+" ")).status,"invalid-pin");
});

test("CLI enforces explicit local source argument and rejects unmatching bytes without writes",()=>{
  const dir=mkdtempSync(join(tmpdir(),"flytally-six-"));
  try{
    const candidate=join(dir,"candidate.xml");
    const source=pin.toString("utf8");
    writeFileSync(candidate,Buffer.from(source.replace("<Ccy>AFN</Ccy>","<Ccy>ZZZ</Ccy>")));
    const missing=spawnSync(process.execPath,[script],{encoding:"utf8"});
    assert.equal(missing.status,2);
    assert.match(missing.stderr,/Usage/);
    const mismatch=spawnSync(process.execPath,[script,"--official",candidate],{encoding:"utf8"});
    assert.equal(mismatch.status,2);
    const parsed=JSON.parse(mismatch.stdout);
    assert.equal(parsed.status,"different-content");
    assert.equal(parsed.productionRegistryApproval,false);
    assert.equal(parsed.sourceOriginAuthenticatedByThisScript,false);
  }finally{rmSync(dir,{recursive:true,force:true})}
});

test("byte-identical local copy does NOT assert provenance or production approval",()=>{
  const dir=mkdtempSync(join(tmpdir(),"flytally-six-"));
  try{
    const candidate=join(dir,"supplied.xml");
    writeFileSync(candidate,pin);
    const result=spawnSync(process.execPath,[script,"--official",candidate],{encoding:"utf8"});
    assert.equal(result.status,0,result.stderr);
    const parsed=JSON.parse(result.stdout);
    assert.equal(parsed.status,"byte-identical");
    assert.equal(parsed.sourceOriginAuthenticatedByThisScript,false);
    assert.equal(parsed.productionRegistryApproval,false);
    assert.equal(parsed.candidateSha256,parsed.pinnedSha256);
  }finally{rmSync(dir,{recursive:true,force:true})}
});
