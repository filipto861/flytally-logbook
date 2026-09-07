import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root=path.resolve(import.meta.dirname,"..");
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");

test("v2.1 release remains a preserved baseline for later v2.x releases",()=>{
  const pkg=JSON.parse(read("package.json")),lock=JSON.parse(read("package-lock.json"));
  const [major,minor]=String(pkg.version).split(".").map(Number);
  assert.ok(major>2||(major===2&&minor>=1));
  assert.equal(lock.version,pkg.version);
  assert.equal(lock.packages[""].version,pkg.version);
  assert.match(read("CHANGELOG.md"),/## 2\.1\.0 — Dashboard & Statistics consolidation/);
  assert.match(read("ROADMAP.md"),/## v2\.1\.0 — Dashboard & Statistics consolidation/);
});
