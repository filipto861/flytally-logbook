import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { releaseAtLeast } from "./release-version.ts";

const root=path.resolve(import.meta.dirname,".."),read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");

test("v1.33.2 protects restored verification evidence with keyed HMAC validation",()=>{
  const backup=read("lib/backup-certification.ts");
  assert.match(backup,/verificationCryptographicStatus/);
  assert.match(backup,/failed HMAC verification/);
  assert.match(backup,/is not bound to the stored certification fingerprint/);
});

test("v1.33.2 PostgreSQL acceptance covers IDOR and exact restore evidence paths",()=>{
  const integration=read("tests/integration/postgres-security-restore.test.ts");
  assert.match(integration,/AC-13 exact production action SQL rejects cross-user identifiers/);
  assert.match(integration,/app\/\(protected\)\/flights\/certification-actions\.ts/);
  assert.match(integration,/app\/\(protected\)\/flights\/instructor-actions\.ts/);
  assert.match(integration,/lib\/account-restore-v6\.ts/);
  assert.match(integration,/AC-20 production restore SQL preserves R1\/R2 hashes, signatures, participation and GPS/);
});

test("v1.33.2 certification-readiness evidence remains documented in later releases",()=>{
  assert.ok(releaseAtLeast(JSON.parse(read("package.json")).version,1,33,2));
  const evidence=read("docs/certification-readiness/SECURITY_AND_RESTORE_EVIDENCE.md"),matrix=read("docs/certification-readiness/ACCEPTANCE_MATRIX.md");
  assert.match(evidence,/PostgreSQL 16/);assert.match(evidence,/cross-user/i);assert.match(evidence,/HMAC-SHA-256/);assert.match(evidence,/GPS/);
  assert.match(matrix,/v1\.33\.2/);assert.match(matrix,/AC-13/);assert.match(matrix,/AC-20/);
});
