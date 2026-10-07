import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { releaseAtLeast } from "./release-version.ts";

const root=path.resolve(import.meta.dirname,"..");
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");

test("canonical release metadata remains aligned at or beyond 3.4.0 while v2.7 history stays archived",()=>{
  const pkg=JSON.parse(read("package.json")),lock=JSON.parse(read("package-lock.json")),roadmap=read("docs/history/ROADMAP_LEGACY_2026-09-26.md");
  assert.ok(releaseAtLeast(pkg.version,3,4,0));
  assert.equal(lock.version,pkg.version);
  assert.equal(lock.packages?.[""]?.version,pkg.version);
  assert.match(roadmap,/## Current release — v2\.7\.0 — Data Integrity & Recovery 2\.0/);
  assert.match(roadmap,/## Post-v2\.7 roadmap/);
  assert.match(roadmap,/### v2\.8 — Mobile & PWA Hardening/);
  assert.match(roadmap,/## v2\.6\.0 — Professional Pilot Workspace 2\.0/);
});
