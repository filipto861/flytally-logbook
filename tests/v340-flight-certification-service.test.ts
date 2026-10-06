import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root=path.resolve(import.meta.dirname,"..");
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");

test("3.4.0 certification authority is centralized on the persisted owned row",()=>{
  const service=read("lib/flight-certification.ts");
  const action=read("app/(protected)/flights/certification-actions.ts");

  assert.match(service,/FROM flights f[\s\S]*JOIN users u ON u\.id=f\.user_id[\s\S]*WHERE f\.id=\$\{flightId\} AND f\.user_id=\$\{userId\}/);
  assert.match(service,/flightCertificationCompliance\(row,text\(row\.pilot_name\)\)/);
  assert.match(service,/flightCertificationHash\(\{\.\.\.row,certification_version:8\},userId,8\)/);
  assert.match(service,/certification_version=8/);
  assert.match(action,/certifyStoredFlight\(userId,flightId\)/);
  assert.doesNotMatch(action,/flightCertificationHash/);
});

test("3.4.0 certification uses optimistic row-version protection before sealing",()=>{
  const service=read("lib/flight-certification.ts");
  assert.match(service,/f\.xmin::text row_xmin/);
  assert.match(service,/AND xmin::text=\$\{String\(row\.row_xmin\?\?\"\"\)\}/);
  assert.match(service,/status:"stale"/);
  assert.match(service,/AND certified_at IS NULL/);
  assert.match(service,/AND locked_at IS NULL/);
});

test("3.4.0 keeps explicit legacy certification able to unlock a ready locked draft",()=>{
  const action=read("app/(protected)/flights/certification-actions.ts");
  assert.match(action,/if\(result\.status==="locked"\)/);
  assert.match(action,/SET locked_at=NULL,locked_by_user_id=NULL/);
  assert.match(action,/result=await certifyStoredFlight\(userId,flightId\)/);
});

test("3.4.0 shared certification service has no invitation or sharing side effect",()=>{
  const service=read("lib/flight-certification.ts");
  assert.doesNotMatch(service,/flight_participations|instructor_flight_approvals|user_notifications|invite|flight_public_shares/);
});

test("3.4.0 Manual entry makes draft the implicit submit and certification explicit",()=>{
  const form=read("components/flight-form.tsx");
  const actions=read("app/(protected)/flights/actions.ts");

  const draftIndex=form.indexOf('name="intent" value="draft"');
  const certifyIndex=form.indexOf('name="intent" value="certify"');
  assert.ok(draftIndex>=0&&certifyIndex>draftIndex,"Save draft must precede Save & certify so implicit submit stays non-certifying.");
  assert.match(form,/Save &amp; certify flight/);
  assert.match(form,/certifyDisabled=\{missing\.length>0\}/);
  assert.match(actions,/intent=String\(form\.get\("intent"\)\|\|"draft"\)/);
  assert.match(actions,/if\(intent==="certify"\)/);
  assert.match(actions,/certifyStoredFlight\(userId,id\)/);
  assert.match(actions,/certify=\$\{outcome\}/);
});

test("3.4.0 pre-certification summary exposes the materially sealed evidence",()=>{
  const form=read("components/flight-form.tsx");
  for(const label of ["Flight","Aircraft / role","UTC times","Evidence"])assert.ok(form.includes(`<span>${label}</span>`));
  assert.match(form,/Certified flights are locked; later changes are recorded as corrections\./);
  assert.match(form,/name="nightTime"[\s\S]*value=\{nightTime\}/);
  assert.match(form,/name="ifrTime"[\s\S]*value=\{ifrTime\}/);
});

test("3.4.0 saved-draft and direct-certification outcomes are explicit on flight detail",()=>{
  const page=read("app/(protected)/flights/[id]/page.tsx");
  const workspace=read("components/flight-detail-workspace.tsx");

  assert.match(page,/certification-blocked/);
  assert.match(page,/certification-deferred/);
  assert.match(page,/completionMessage/);
  assert.match(workspace,/Flight saved and certified\./);
  assert.match(workspace,/Flight saved as draft — not certified\./);
  assert.match(workspace,/params\.delete\("certified"\)/);
  assert.match(workspace,/params\.delete\("certify"\)/);
});
