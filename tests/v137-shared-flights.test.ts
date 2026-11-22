import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root=path.resolve(import.meta.dirname,"..");const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");

test("v1.37 shared-flight notification actions remain supported",()=>{
  const page=read("app/(protected)/notifications/page.tsx"),actions=read("app/(protected)/notifications/actions.ts");
  assert.match(page,/\["flight_request","flight_invite","signature_request"\]/);
  assert.match(page,/Review & add/);assert.match(page,/Review & sign/);assert.match(page,/>Decline</);
  assert.match(actions,/kind IN \('flight_request','flight_invite','signature_request'\)/);
  assert.match(actions,/declineSharedFlight\(participation\)/);
});
