import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root=path.resolve(import.meta.dirname,"..");
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");

test("development pipeline keeps Vercel build separate from tests",()=>{
  const pkg=JSON.parse(read("package.json"));
  assert.equal(pkg.scripts.build,"next build");
  assert.equal(pkg.scripts.verify,"npm run typecheck && npm test && npm run build");
  assert.equal(typeof pkg.scripts["test:target"],"string");
  assert.equal(pkg.scripts["scope:changed"],"node tooling/development-scope.mjs");
  assert.equal(typeof pkg.scripts["test:postgres:full"],"string");
  assert.match(pkg.scripts["test:postgres"],/tooling\/run-postgres-tests[.]mjs core/);
  assert.equal(pkg.scripts["test:browser"],"node tooling/run-auth-browser.mjs");
  assert.equal(pkg.scripts["verify:browser"],"npm run build && npm run test:browser");
  assert.doesNotMatch(pkg.scripts.build,/test/);
});

test("PostgreSQL acceptance gate fails closed when DATABASE_URL is absent",()=>{
  const result=spawnSync(
    process.execPath,
    [path.join(root,"tooling/run-postgres-tests.mjs"),"core"],
    {
      cwd:root,
      encoding:"utf8",
      env:{...process.env,DATABASE_URL:"",FLYTALLY_POSTGRES_INTEGRATION:""},
    },
  );
  assert.equal(result.status,2,result.stderr||result.stdout);
  assert.match(result.stderr,/DATABASE_URL is required for PostgreSQL acceptance/);
  assert.match(result.stderr,/gate did not run/);
});

test("PostgreSQL runner owns integration intent instead of relying on the caller flag",()=>{
  const runner=read("tooling/run-postgres-tests.mjs");
  assert.match(runner,/preflightPostgresGate\(env\)/);
  assert.match(runner,/FLYTALLY_POSTGRES_INTEGRATION: "1"/);
  assert.match(runner,/spawnSync\("psql", \["--version"\]/);
  assert.doesNotMatch(runner,/env: process\.env/);
});

test("authenticated browser gate fails closed before fixture reset when auth mode is absent",()=>{
  const result=spawnSync(
    process.execPath,
    [path.join(root,"tooling/run-auth-browser.mjs")],
    {
      cwd:root,
      encoding:"utf8",
      env:{...process.env,FLYTALLY_AUTH_BROWSER:""},
    },
  );
  assert.equal(result.status,2,result.stderr||result.stdout);
  assert.match(result.stderr,/FLYTALLY_AUTH_BROWSER=1 and FLYTALLY_LOCAL_POSTGRES=1 are required/);
  assert.match(result.stderr,/browser gate did not run/);
});

test("Node and Playwright versions are repository-pinned to the production toolchain",()=>{
  const pkg=JSON.parse(read("package.json"));
  const lock=JSON.parse(read("package-lock.json"));
  assert.equal(pkg.engines.node,"24.x");
  assert.equal(read(".nvmrc").trim(),"24");
  assert.equal(pkg.devDependencies["@playwright/test"],"1.55.0");
  assert.equal(lock.packages[""].devDependencies["@playwright/test"],"1.55.0");
  assert.equal(lock.packages["node_modules/@playwright/test"].version,"1.55.0");
  assert.equal(lock.packages["node_modules/playwright"].version,"1.55.0");
  assert.equal(lock.packages["node_modules/playwright-core"].version,"1.55.0");
});

test("manual cloud verification mirrors the local-first release policy without automatic PR runs",()=>{
  const workflow=read(".github/workflows/verify-web.yml"),browser=read(".github/workflows/browser-smoke.yml");
  assert.match(workflow,/workflow_dispatch:/);
  assert.match(browser,/workflow_dispatch:/);
  assert.doesNotMatch(workflow,/\n\s*pull_request:/);
  assert.doesNotMatch(browser,/\n\s*pull_request:/);
  assert.doesNotMatch(workflow,/\n\s*push:/);
  assert.doesNotMatch(browser,/\n\s*schedule:/);
  assert.match(workflow,/cancel-in-progress: true/);
  assert.match(workflow,/Application gate/);
  assert.match(workflow,/TypeScript check/);
  assert.match(workflow,/npm run typecheck/);
  assert.match(workflow,/Targeted UI regression tests/);
  assert.match(workflow,/inputs\.full_tests != true/);
  assert.match(workflow,/Full unit and regression tests/);
  assert.match(workflow,/inputs\.full_tests == true/);
  assert.match(workflow,/npm run test:ui/);
  assert.doesNotMatch(workflow,/name: Production build/);
  assert.match(browser,/name: Production build/);
  assert.match(browser,/run: npm run build/);
  assert.match(workflow,/PostgreSQL acceptance tests/);
  assert.match(workflow,/inputs\.postgres == true/);
  assert.match(workflow,/test:postgres:full/);
  assert.doesNotMatch(workflow,/FLYTALLY_POSTGRES_INTEGRATION/);
  assert.match(workflow,/node-version: 24/);
  assert.match(browser,/node-version: 24/);
  assert.match(browser,/npm run test:browser/);
  assert.doesNotMatch(browser,/npm install --no-save --package-lock=false @playwright\/test/);
});

test("large PostgreSQL fixtures are isolated from the normal core acceptance loop",()=>{
  const runner=read("tooling/run-postgres-tests.mjs");
  for(const file of [
    "postgres-scale-readiness.test.ts",
    "postgres-v169-production-hardening.test.ts",
    "postgres-v230-large-logbook-performance.test.ts",
  ])assert.ok(runner.includes(file),`missing scale classification for ${file}`);
  assert.match(runner,/mode === "scale" \? isScale : !isScale/);
});

test("development policy documents candidate-first iteration, module scope and release verification",()=>{
  const doc=read("DEVELOPMENT.md");
  assert.match(doc,/candidate-first development workflow/);
  assert.match(doc,/one coherent candidate commit/);
  assert.match(doc,/npm run test:target/);
  assert.match(doc,/tooling\/development-modules[.]json/);
  assert.match(doc,/unknown code remains conservative|previously unknown code remains conservative/i);
  assert.match(doc,/npm run verify:release/);
  assert.match(doc,/canonical production branch is `main`/i);
  assert.match(doc,/deleted after merge/i);
});
