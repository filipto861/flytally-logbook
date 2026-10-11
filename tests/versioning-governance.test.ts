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

test("canonical roadmap preserves accepted maps release and following roadmap targets",()=>{
  const roadmap=read("ROADMAP.md");
  assert.match(roadmap,/\| \*\*3\.7\.0\*\* \| Maps & Aviation Layers \|/);
  assert.match(roadmap,/\| \*\*3\.8\.0\*\* \| Currency \/ monetary semantics · #136 \|/);
  assert.match(roadmap,/\| 3\.9\.0 \| Multi-aircraft heterogeneous onboarding proof \|/);
  assert.match(roadmap,/Owner functional acceptance decision|Owner decision — functional acceptance COMPLETE/i);
  assert.doesNotMatch(roadmap,/## E3 — Flight entry simplification — ACTIVE/);
});

test("versioning policy reconciles legacy labels without reusing them",()=>{
  const policy=read("docs/product/VERSIONING.md");
  assert.match(policy,/MAJOR\.MINOR\.PATCH/);
  assert.match(policy,/first canonical unified product release is 3\.4\.0/i);
  assert.match(policy,/CHANGELOG\/development headings already used labels through \*\*v3\.3\*\*/);
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


test("3.7.0 release candidate metadata aligns without inventing production deployment",()=>{
  const pkg=JSON.parse(read("package.json")) as {version:string};
  const lock=JSON.parse(read("package-lock.json")) as {version:string;packages:Record<string,{version?:string}>};
  assert.equal(pkg.version,"3.7.0");
  assert.equal(lock.version,pkg.version);
  assert.equal(lock.packages[""].version,pkg.version);
  assert.match(read("components/app-shell.tsx"),/const appVersion=packageMetadata\.version/);
  assert.match(read("ROADMAP.md"),/\| \*\*3\.7\.0\*\* \| Maps & Aviation Layers \|/);
  assert.match(read("docs/product/VERSIONING.md"),/future release branches may carry the target `package\.json` version while still unreleased/);
  assert.match(read("docs/product/3_7_0_FINAL_PRODUCTION_ACCEPTANCE_2026-10-11.md"),/OWNER-REPORTED UX ACCEPTANCE/);
});
