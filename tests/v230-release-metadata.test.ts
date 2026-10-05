import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root=path.resolve(import.meta.dirname,"..");
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");

test("canonical release metadata is reconciled at 3.4.0 while v2.7 history remains archived",()=>{
  const pkg=JSON.parse(read("package.json")),lock=JSON.parse(read("package-lock.json")),roadmap=read("docs/history/ROADMAP_LEGACY_2026-09-26.md");
  assert.equal(pkg.version,"3.4.0");
  assert.equal(lock.version,"3.4.0");
  assert.equal(lock.packages?.[""]?.version,"3.4.0");
  assert.match(roadmap,/## Current release — v2\.7\.0 — Data Integrity & Recovery 2\.0/);
  assert.match(roadmap,/## Post-v2\.7 roadmap/);
  assert.match(roadmap,/### v2\.8 — Mobile & PWA Hardening/);
  assert.match(roadmap,/## v2\.6\.0 — Professional Pilot Workspace 2\.0/);
});
