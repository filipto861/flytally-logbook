import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root=path.resolve(import.meta.dirname,"..");
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");

test("v2.4 release metadata stays aligned",()=>{
  const pkg=JSON.parse(read("package.json")),lock=JSON.parse(read("package-lock.json")),roadmap=read("ROADMAP.md");
  assert.equal(pkg.version,"2.4.0");
  assert.equal(lock.version,"2.4.0");
  assert.equal(lock.packages?.[""]?.version,"2.4.0");
  assert.match(roadmap,/## Current release — v2\.4\.0 — Flight Entry & Review 2\.0/);
  assert.match(roadmap,/## Post-v2\.4 roadmap/);
  assert.match(roadmap,/### v2\.5 — Recency & Compliance Workspace/);
});
