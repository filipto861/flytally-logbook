import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { authorityReportReference,verificationCryptographicStatus,verificationIdentity,verificationPayloadFromRow,verificationSource } from "../lib/authority-verification.ts";
import { signVerificationPayload } from "../lib/verification-signature.ts";

const root=path.resolve(import.meta.dirname,".."),read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");

test("v1.33 authority report reference is deterministic and revision/hash bound",()=>{
  const a=authorityReportReference(197,3,"abc"),b=authorityReportReference(197,3,"abc"),c=authorityReportReference(197,4,"abc");
  assert.equal(a,b);assert.notEqual(a,c);assert.match(a,/^FT-197-R3-[A-F0-9]{12}$/);
});

test("v1.33 reconstructs exact verification payload including in-person null signer",()=>{
  const row={flight_id:197,flight_user_id:7,signer_user_id:null,record_revision:3,flight_hash:"abc",verification_role:"INSTRUCTOR",credential_snapshot:{identity:"Test FI",source:"In-person handwritten signature"}};
  assert.deepEqual(verificationPayloadFromRow(row),{flightId:197,flightUserId:7,signerUserId:null,recordRevision:3,flightHash:"abc",verificationRole:"INSTRUCTOR",credentialSnapshot:{identity:"Test FI",source:"In-person handwritten signature"}});
  assert.equal(verificationIdentity(row),"Test FI");assert.equal(verificationSource(row),"In-person handwritten signature");
});

test("v1.33 verifies stored HMAC-SHA-256 evidence instead of merely displaying it",()=>{
  process.env.SIGNING_SECRET="flytally-test-signing-secret-with-enough-entropy";
  const row={flight_id:12,flight_user_id:4,signer_user_id:8,record_revision:2,flight_hash:"deadbeef",verification_role:"INSTRUCTOR",credential_snapshot:{identity:"FI Example",source:"FlyTally account"}};
  const payload=verificationPayloadFromRow(row),signature=signVerificationPayload(payload);
  assert.equal(verificationCryptographicStatus({...row,server_signature:signature}),"verified");
  assert.equal(verificationCryptographicStatus({...row,server_signature:"0".repeat(64)}),"invalid");
});

test("v1.33 authority report exposes certification, signature and identity-assurance evidence",()=>{
  const report=read("app/(protected)/flights/[id]/verification-report/page.tsx"),audit=read("app/(protected)/flights/[id]/audit/page.tsx");
  assert.match(report,/AUTHORITY VERIFICATION REPORT/);assert.match(report,/Technical evidence report/);assert.match(report,/verificationCryptographicStatus/);assert.match(report,/SignaturePreview/);assert.match(report,/does not state or imply approval/);
  assert.match(audit,/Verification report/);assert.match(audit,/Identity source:/);assert.doesNotMatch(audit,/Deleted account/);
});

test("v1.33 certification-readiness documentation set is version controlled",()=>{
  for(const file of ["README.md","DATA_DICTIONARY.md","FCL050_COMPLIANCE_MATRIX.md","VERIFICATION_SPEC.md","ACCEPTANCE_MATRIX.md","CHANGE_CONTROL.md"]){
    const target=file==="README.md"?"docs/certification-readiness/README.md":`docs/certification-readiness/${file}`;assert.ok(read(target).length>200,target);
  }
  assert.match(JSON.parse(read("package.json")).version,/^1\.33\./);
});
