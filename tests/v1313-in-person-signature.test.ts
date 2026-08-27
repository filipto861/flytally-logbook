import assert from "node:assert/strict";import test from "node:test";import fs from "node:fs";import path from "node:path";
const root=path.resolve(import.meta.dirname,".."),read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");

test("v1.31.3 offers an in-person signature for certified training flights",()=>{const entry=read("components/readonly-logbook-entry.tsx"),route=read("app/(protected)/flights/[id]/in-person-signature/page.tsx"),pad=read("components/in-person-signature-pad.tsx");assert.match(entry,/Instructor without FlyTally · Sign on this device/);assert.match(entry,/DUAL","SPIC","PICUS/);assert.match(route,/certified_at IS NOT NULL/);assert.match(route,/In-person handwritten signature/);assert.match(pad,/onPointerDown/);assert.match(pad,/Apple Pencil/);assert.match(pad,/confirm_in_person/)});

test("in-person evidence is bound to the exact revision without impersonating a FlyTally account",()=>{const route=read("app/(protected)/flights/[id]/in-person-signature/page.tsx");assert.match(route,/recordRevision/);assert.match(route,/flightHash/);assert.match(route,/signerUserId:null/);assert.match(route,/signVerificationPayload/);assert.match(route,/NULL,\$\{verificationRole\}/);assert.match(route,/identity was not independently authenticated by a FlyTally account/)});

test("LAPL refresher accepts any signed instructor verification including in-person evidence",()=>{const licences=read("app/(protected)/credentials/page.tsx");assert.match(licences,/v\.verification_role='INSTRUCTOR' AND v\.status='signed'/);assert.doesNotMatch(licences,/v\.verification_role='INSTRUCTOR' AND v\.signer_user_id/)});

test("v1.31.3 release version is current",()=>{assert.equal(JSON.parse(read("package.json")).version,"1.31.3")});
