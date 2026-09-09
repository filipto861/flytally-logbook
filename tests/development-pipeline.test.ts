import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root=path.resolve(import.meta.dirname,"..");
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");

test("development pipeline keeps Vercel build separate from tests",()=>{
  const pkg=JSON.parse(read("package.json"));
  assert.equal(pkg.scripts.build,"next build");
  assert.equal(pkg.scripts.verify,"npm test && npm run build");
  assert.equal(typeof pkg.scripts["test:target"],"string");
  assert.equal(typeof pkg.scripts["test:postgres:full"],"string");
  assert.doesNotMatch(pkg.scripts.build,/test/);
});

test("CI runs one fast PR gate and adds PostgreSQL work according to risk",()=>{
  const workflow=read(".github/workflows/verify-web.yml");
  assert.match(workflow,/cancel-in-progress: true/);
  assert.match(workflow,/Classify CI risk/);
  assert.match(workflow,/Fast application gate/);
  assert.match(workflow,/Unit and regression tests/);
  assert.match(workflow,/Production build/);
  assert.match(workflow,/PostgreSQL acceptance tests/);
  assert.match(workflow,/test:postgres:full/);
  assert.match(workflow,/\[full-ci\]/);
  assert.doesNotMatch(workflow,/npm run typecheck/);
  assert.doesNotMatch(workflow,/\n  push:/);
});

test("large PostgreSQL fixtures are isolated from the normal core acceptance loop",()=>{
  const runner=read("scripts/run-postgres-tests.mjs");
  for(const file of [
    "postgres-scale-readiness.test.ts",
    "postgres-v169-production-hardening.test.ts",
    "postgres-v230-large-logbook-performance.test.ts",
  ])assert.ok(runner.includes(file),`missing scale classification for ${file}`);
  assert.match(runner,/mode === "scale" \? isScale : !isScale/);
});

test("development policy documents candidate-first iteration and release verification",()=>{
  const doc=read("DEVELOPMENT.md");
  assert.match(doc,/candidate-first development workflow/);
  assert.match(doc,/one coherent candidate commit/);
  assert.match(doc,/npm run test:target/);
  assert.match(doc,/npm run verify:release/);
  assert.match(doc,/codex\/vercel-migration-v080/);
});
