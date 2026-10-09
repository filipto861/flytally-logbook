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
  assert.match(roadmap,/# 3\.4\.1 — GPS Night-time reliability — DONE/);
  assert.match(roadmap,/# 3\.4\.0 — Flight Entry Simplification — DONE/);
  assert.match(roadmap,/\| 1 \| \*\*3\.4\.0\*\* \| Flight Entry Simplification \| ✅ \|/);
  assert.match(roadmap,/\| 2 \| \*\*3\.4\.1\*\* \| GPS Night-time reliability \| ✅ \|/);
  assert.match(roadmap,/\| 3 \| \*\*3\.5\.0\*\* \| Certified flight voiding \+ multi-aircraft integrity audit \| ✅ \|/);
  assert.match(roadmap,/\| 4 \| \*\*3\.5\.1\*\* \| GPS T&G false-positive containment \| ✅ \|/);
  assert.match(roadmap,/\| 5 \| \*\*3\.5\.2\*\* \| Always-on GPS\/SERA Night suggestions \| ✅ \|/);
  assert.match(roadmap,/\| 6 \| \*\*3\.5\.3\*\* \| Flight detail navigation UX \| ✅ \|/);
  assert.match(roadmap,/\| 7 \| \*\*3\.5\.4\*\* \| iPad flight-detail visual hotfix \| ✅ \|/);
  assert.match(roadmap,/\| 8 \| \*\*3\.5\.5\*\* \| iPad sidebar collapse-control alignment \| ✅ \|/);
  assert.match(roadmap,/\| 9 \| \*\*3\.6\.0\*\* \| Saved-date \/ timezone semantics · #144 \| 🚧 \|/);
  assert.match(roadmap,/\| 10 \| \*\*3\.7\.0\*\* \| Currency \/ monetary semantics · #136 \| ➡️ \|/);
  assert.match(roadmap,/## Single implementation phase — DONE/);
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


test("3.6.0 release candidate metadata stays aligned with the 3.5.5 production baseline",()=>{
  const pkg=JSON.parse(read("package.json")) as {version:string};
  const lock=JSON.parse(read("package-lock.json")) as {version:string;packages:Record<string,{version?:string}>};
  assert.equal(pkg.version,"3.6.0");
  assert.equal(lock.version,pkg.version);
  assert.equal(lock.packages[""].version,pkg.version);
  assert.match(read("components/app-shell.tsx"),/const appVersion=packageMetadata\.version/);
  assert.match(read("ROADMAP.md"),/# 3\.5\.5 — iPad sidebar collapse-control alignment — DONE \/ PRODUCTION/);
  assert.match(read("docs/product/VERSIONING.md"),/\| 3\.5\.5 \| iPad sidebar collapse-control alignment \| DONE \/ PRODUCTION \|/);
  assert.match(read("docs/product/VERSIONING.md"),/production product package\/runtime is \*\*3\.5\.5\*\*/);
  assert.match(read("ROADMAP.md"),/\*\*Current production product version:\*\* `3\.5\.5`/);
  assert.match(read("ROADMAP.md"),/\*\*Current active release:\*\* `3\.6\.0`/);
  assert.match(read("docs/product/VERSIONING.md"),/\| 3\.6\.0 \| Saved-date \/ timezone semantics \| ACTIVE \|/);
  assert.match(read("docs/product/VERSIONING.md"),/\| 3\.7\.0 \| Currency \/ monetary semantics \| NEXT \|/);
});
