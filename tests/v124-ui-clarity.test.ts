import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";

const root=path.resolve(import.meta.dirname,"..");
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");
const credentialsSource=()=>read("app/(protected)/credentials/page.tsx")+read("app/(protected)/credentials/legacy-page.tsx")+read("app/(protected)/credentials/adaptive-overview.tsx");

test("Permanent credential and rate deletion requires a disclosed second step",()=>{
  const credentials=credentialsSource();
  const aircraft=read("components/aircraft-manager.tsx");
  assert.match(credentials,/className="confirm-action"/);
  assert.match(credentials,/Delete permanently/);
  assert.match(aircraft,/className="confirm-action compact-confirm"/);
  assert.match(aircraft,/Delete rate/);
});
