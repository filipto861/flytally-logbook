import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root=path.resolve(import.meta.dirname,"..");
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");

test("the certification action delegates to certifyStoredFlight and never fingerprints itself",()=>{
  // certifyStoredFlight itself runs in tests/integration/postgres-certify-stored-flight.test.ts.
  const action=read("app/(protected)/flights/certification-actions.ts");
  assert.match(action,/certifyStoredFlight\(userId,flightId\)/);
  assert.doesNotMatch(action,/flightCertificationHash/);
  assert.match(action,/revalidateFlightCertificationViews\(flightId\)/);
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
  // Certification never infers a verifier account from typed crew names.
  assert.doesNotMatch(service,/autoRequestTrainingVerification|upsertInstructorRequest|pilot_connections|LOWER\(TRIM\(u\.display_name\)\)/);
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

test("certified correction Save & certify seals exactly the row returned by the successful draft update",()=>{
  const form=read("components/flight-form.tsx");
  const actions=read("app/(protected)/flights/actions.ts");
  const service=read("lib/flight-certification.ts");
  const update=actions.slice(actions.indexOf("export async function updateFlight("),actions.indexOf("export async function saveFlightExpenses("));
  assert.match(form,/if\(editing\)return[\s\S]*name="intent" value="draft"[\s\S]*Save changes[\s\S]*name="intent" value="certify"[\s\S]*Save &amp; certify/);
  assert.match(update,/if\(existing\.certified_at\)return\{error:/);
  assert.match(update,/flight\.locked_at IS NULL AND flight\.certified_at IS NULL/);
  assert.match(update,/RETURNING flight\.id,flight\.xmin::text row_xmin,COALESCE\(flight\.record_revision,1\)::int record_revision/);
  assert.match(update,/if\(String\(form\.get\("intent"\)\|\|"draft"\)==="certify"\)/);
  assert.match(update,/certifyStoredFlight\(userId,id,String\(rows\[0\]\.row_xmin\?\?""\)\)/);
  assert.match(service,/expectedRowXmin\?:string/);
  assert.match(service,/expectedRowXmin!==undefined&&String\(row\.row_xmin\?\?""\)!==expectedRowXmin\)return\{status:"stale"/);
  assert.match(update,/if\(certification\.status==="certified"\)[\s\S]*revalidateFlightCertificationViews\(id\);[\s\S]*redirect\(`\/flights\/\$\{id\}\?certified=1`\)/);
  assert.match(update,/Changes saved as a draft, but certification was blocked/);
  assert.match(update,/certification status could not be confirmed/);
  assert.match(update,/certification did not complete or the record changed concurrently/);
  assert.match(update,/saved:true/);
  assert.match(form,/if\(!state\.saved\)\{markDirty\(\);flightEdit\?\.setUnsaved\(true\)\}/);
});

