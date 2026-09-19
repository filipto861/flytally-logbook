import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root=path.resolve(import.meta.dirname,"..");
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");

test("v3.2 U2 gives high-frequency routes one canonical page rhythm",()=>{
  const routes=[
    "app/(protected)/dashboard/page.tsx",
    "app/(protected)/flights/page.tsx",
    "app/(protected)/connections/page.tsx",
    "app/(protected)/database/page.tsx",
    "app/(protected)/data/page.tsx",
    "app/(protected)/profile/page.tsx",
  ];
  for(const route of routes)assert.match(read(route),/ui-page-stack/,route);
  const css=read("app/ui-system.css");
  assert.match(css,/--ui-page-gap:24px/);
  assert.match(css,/\.ui-page-stack\{/);
  assert.match(css,/margin-block:0/);
});

test("v3.2 U2 provides pending feedback for direct Connections mutations",()=>{
  const source=read("app/(protected)/connections/page.tsx");
  for(const label of ["Accepting…","Declining…","Saving…","Removing…","Cancelling…"])assert.ok(source.includes(`pendingLabel="${label}"`),label);
});

test("v3.2 U2 provides pending feedback for Settings security and privacy mutations",()=>{
  const source=read("app/(protected)/profile/page.tsx");
  for(const label of ["Disconnecting…","Updating…","Signing out…","Revoking…","Deleting…"])assert.ok(source.includes(`pendingLabel="${label}"`),label);
});

test("v3.2 U2 provides pending feedback for direct Aircraft and airport mutations",()=>{
  const source=read("app/(protected)/database/page.tsx");
  assert.match(source,/pendingLabel="Saving…"/);
  assert.match(source,/pendingLabel="Updating…"/);
});
