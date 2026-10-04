import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root=path.resolve(import.meta.dirname,"..");
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");

test("product version source remains numeric MAJOR.MINOR.PATCH",()=>{
  const pkg=JSON.parse(read("package.json")) as {version:string};
  assert.match(pkg.version,/^\d+\.\d+\.\d+$/);
  assert.equal(pkg.version,"2.7.0");
});

test("current roadmap uses numeric release targets and numeric phases",()=>{
  const roadmap=read("ROADMAP.md");
  assert.match(roadmap,/## Canonical release sequence/);
  assert.match(roadmap,/## 2\.8\.0 — Flight Entry Simplification — ACTIVE/);
  for(const phase of [1,2,3,4,5,6])assert.match(roadmap,new RegExp(`\\| ${phase} \\|`));
  assert.doesNotMatch(roadmap,/## E3 — Flight entry simplification — ACTIVE/);
});

test("versioning policy separates product releases from technical counters",()=>{
  const policy=read("docs/product/VERSIONING.md");
  assert.match(policy,/MAJOR\.MINOR\.PATCH/);
  assert.match(policy,/PostgreSQL schema migration version/);
  assert.match(policy,/certification payload\/hash version/);
  assert.match(policy,/backup\/export format versions/);
  assert.match(policy,/Do not create new current-planning identifiers/);
});

test("2.8.0 design preserves explicit certification and fail-closed batch semantics",()=>{
  const design=read("docs/product/2_8_0_FLIGHT_ENTRY_SIMPLIFICATION.md");
  assert.match(design,/Save & certify flight/);
  assert.match(design,/Save draft/);
  assert.match(design,/no silent certification/i);
  assert.match(design,/No partial multi-flight certification state/);
  assert.match(design,/Training purpose audit/);
});
