import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root=path.resolve(import.meta.dirname,"..");
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");

test("product version source remains numeric MAJOR.MINOR.PATCH",()=>{
  const pkg=JSON.parse(read("package.json")) as {version:string};
  assert.match(pkg.version,/^\d+\.\d+\.\d+$/);
});

test("current roadmap uses canonical numeric release targets and numeric phases",()=>{
  const roadmap=read("ROADMAP.md");
  assert.match(roadmap,/## Canonical release sequence/);
  assert.match(roadmap,/# 3\.4\.0 — Flight Entry Simplification — ACTIVE/);
  assert.match(roadmap,/\| 1 \| \*\*3\.4\.0\*\* \| Flight Entry Simplification \| 🚧 \|/);
  assert.match(roadmap,/\| 2 \| \*\*3\.5\.0\*\* \| Multi-aircraft remaining integrity audit \| ➡️ \|/);
  for(const phase of [1,2,3,4,5,6,7])assert.match(roadmap,new RegExp(`## Phase ${phase}\\b`));
  assert.doesNotMatch(roadmap,/## E3 — Flight entry simplification — ACTIVE/);
});

test("versioning policy reconciles legacy labels without reusing them",()=>{
  const policy=read("docs/product/VERSIONING.md");
  assert.match(policy,/MAJOR\.MINOR\.PATCH/);
  assert.match(policy,/first canonical unified product release is 3\.4\.0/i);
  assert.match(policy,/historical CHANGELOG labels already used labels through \*\*v3\.3\*\*/);
  assert.match(policy,/PostgreSQL schema migration version/);
  assert.match(policy,/certification payload\/hash version/);
  assert.match(policy,/backup\/export format version/);
});

test("3.4.0 design preserves explicit single-flight certification and draft-only multi-flight safety",()=>{
  const design=read("docs/product/3_4_0_FLIGHT_ENTRY_SIMPLIFICATION.md");
  assert.match(design,/Save & certify flight/);
  assert.match(design,/Save draft/);
  assert.match(design,/missing\/default form intent always means \*\*Save draft\*\*/);
  assert.match(design,/3\.4\.0 does \*\*not\*\* add direct batch certification/);
  assert.match(design,/Training purpose/);
  assert.match(design,/one shared applicability predicate/i);
});
