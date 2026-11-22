import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";

const root=path.resolve(import.meta.dirname,".."),read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");

test("v1.33.2 protects restored verification evidence with keyed HMAC validation",()=>{
  const backup=read("lib/backup-certification.ts");
  assert.match(backup,/verificationCryptographicStatus/);
  assert.match(backup,/failed HMAC verification/);
  assert.match(backup,/is not bound to the stored certification fingerprint/);
});
