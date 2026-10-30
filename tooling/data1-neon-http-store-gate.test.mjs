import test from "node:test";
import assert from "node:assert/strict";
import {
  MIB, PRESETS, parseArgs, checkTarget, makeSyntheticArchive,
  verifyStoredArchive, makeProbeToken,
} from "./data1-neon-http-store-gate.mjs";

const targetEnv = () => ({
  DATA1_SYNTHETIC_ONLY: "1",
  DATA1_EXPECTED_PROJECT_ID: "clean-fixture-12345678",
  DATA1_EXPECTED_BRANCH_ID: "br-synthetic-123",
  DATA1_EXPECTED_DATABASE: "synthetic_data1",
  DATA1_EXPECTED_ROLE: "synthetic_data1_owner",
  DATABASE_URL: "postgresql://synthetic_data1_owner:FAKE-NOT-REAL@ep-demo.eu-central-1.aws.neon.tech/synthetic_data1?sslmode=require",
});

test("DATA-1D: CLI requires exact opt-in, probe, or confirmed execution", () => {
  assert.deepEqual(parseArgs(["--synthetic-only","--probe"]),{mode:"probe"});
  assert.deepEqual(parseArgs(["--synthetic-only","--execute","--confirm="+"a".repeat(20)]),
    {mode:"execute",confirm:"a".repeat(20)});
  for(const invalid of [
    [],["--execute"],["--synthetic-only","--execute"],
    ["--synthetic-only","--execute","--confirm=abc"],
    ["--synthetic-only","--probe","--execute"],
    ["--synthetic-only","--execute","--confirm="+"g".repeat(20)],
  ]) assert.throws(()=>parseArgs(invalid),/Use/);
});

test("DATA-1D: target must be named dedicated synthetic Neon and has no inherited deployment context", () => {
  const accepted=checkTarget(targetEnv());
  assert.equal(accepted.db,"synthetic_data1");
  assert.equal(accepted.role,"synthetic_data1_owner");
  assert.equal(accepted.id,"clean-fixture-12345678");
  for(const [key,value] of [
    ["DATA1_SYNTHETIC_ONLY","0"],
    ["DATA1_EXPECTED_PROJECT_ID","muddy-dust-14049657"],
    ["DATA1_EXPECTED_PROJECT_ID","frosty-recipe-46458686"],
    ["DATA1_EXPECTED_PROJECT_ID","dry-king-94424047"],
    ["DATA1_EXPECTED_PROJECT_ID","unknown"],
    ["DATA1_EXPECTED_BRANCH_ID",""],
    ["DATA1_EXPECTED_DATABASE","neondb"],
    ["DATA1_EXPECTED_ROLE","production"],
    ["DATABASE_URL",""],
    ["DATABASE_URL","postgresql://synthetic_data1_owner:FAKE@localhost/synthetic_data1"],
    ["DATABASE_URL","postgresql://synthetic_data1_owner:FAKE@ep-demo.neon.tech/production"],
    ["DATABASE_URL","postgresql://production:FAKE@ep-demo.neon.tech/synthetic_data1"],
    ["CI","true"],
    ["VERCEL","1"],
    ["NEON_DATABASE_URL","another-database"],
    ["PGHOST","localhost"],
  ]) assert.throws(()=>checkTarget({...targetEnv(),[key]:value}),/Refused|Missing|opt-in|Expected|DATABASE_URL/);
});

test("DATA-1D: bounded gzip/Base64 synthetic archive round trip and corruption rejection", () => {
  assert.deepEqual(PRESETS,[1,4,12]);
  for (const mib of PRESETS) {
    const artifact=makeSyntheticArchive(mib,size=>Buffer.alloc(size,0x71));
    assert.ok(artifact.raw.length>0&&artifact.gzip.length>0);
    assert.equal(artifact.base64,artifact.gzip.toString("base64"));
    assert.ok(artifact.gzip.length<=50*MIB);
    const row={payload_base64:artifact.base64,payload_sha256:artifact.digest,
      raw_bytes:String(artifact.raw.length),compressed_bytes:String(artifact.gzip.length)};
    assert.equal(verifyStoredArchive(artifact,row),true);
    assert.equal(verifyStoredArchive(artifact,{...row,payload_sha256:"0".repeat(64)}),false);
    assert.equal(verifyStoredArchive(artifact,{...row,raw_bytes:"0"}),false);
    assert.equal(verifyStoredArchive(artifact,{...row,compressed_bytes:"0"}),false);
    assert.equal(verifyStoredArchive(artifact,{...row,payload_base64:artifact.base64.slice(4)}),false);
  }
  assert.throws(()=>makeSyntheticArchive(24),/Unapproved/);
  assert.throws(()=>makeSyntheticArchive(1,()=>Buffer.alloc(3)),/invalid bounded/);
});

test("DATA-1D: read-only probe token is tied to configured project, branch and server boot identity", () => {
  const target=checkTarget(targetEnv());
  const row={pg_version:160015,boot_time:"2026-10-30 08:00:00+00"};
  const token=makeProbeToken(target,row);
  assert.match(token,/^[a-f0-9]{20}$/);
  assert.equal(token,makeProbeToken(target,row));
  assert.notEqual(token,makeProbeToken({...target,branch:"br-other-456"},row));
  assert.notEqual(token,makeProbeToken(target,{...row,boot_time:"2026-10-30 09:00:00+00"}));
});

test("DATA-1D: existing 50MiB gzip safety cap implies a larger Base64 field than gzip", () => {
  const gzipBytes=50*MIB;
  const encoded=4*Math.ceil(gzipBytes/3);
  assert.equal(gzipBytes,52428800);
  assert.equal(encoded,69905068);
  assert.ok(encoded>gzipBytes);
});
