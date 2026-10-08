import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";

const root=path.resolve(import.meta.dirname,"..");
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");

test("development pipeline keeps Vercel build separate from tests",()=>{
  const pkg=JSON.parse(read("package.json"));
  assert.equal(pkg.scripts.build,"next build");
  assert.equal(pkg.scripts.verify,"node tooling/verify-app-compat.mjs");
  assert.equal(pkg.scripts["verify:release"],"npm run typecheck && npm test && npm run test:postgres:full && npm run build");
  assert.equal(pkg.scripts["verify:app"],"node tooling/verify-app.mjs");
  assert.equal(pkg.scripts["verify:domain"],"node tooling/verify-domain.mjs");
  assert.equal(pkg.scripts["verify:postgres"],"node tooling/verify-postgres.mjs");
  assert.equal(typeof pkg.scripts["test:target"],"string");
  assert.equal(pkg.scripts["scope:changed"],"node tooling/development-scope.mjs");
  assert.equal(pkg.scripts["verify:plan"],"node tooling/verify-plan.mjs");
  assert.equal(pkg.scripts["verify:iterate"],"node tooling/verify-iterate.mjs");
  assert.equal(pkg.scripts["verify:release:risk"],"node tooling/verify-release-risk.mjs");
  assert.equal(typeof pkg.scripts["test:postgres:full"],"string");
  assert.match(pkg.scripts["test:postgres"],/tooling\/run-postgres-tests[.]mjs core/);
  assert.equal(pkg.scripts["test:browser"],"node tooling/run-auth-browser.mjs");
  assert.equal(pkg.scripts["verify:browser"],"node tooling/verify-browser.mjs");
  assert.equal(pkg.scripts["verify:browser:risk"],"node tooling/verify-browser-risk.mjs");
  assert.equal(pkg.scripts["verify:browser:with-build"],"node tooling/verify-browser-with-build.mjs");
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

test("PostgreSQL acceptance rejects remote DATABASE_URL before any client connection",()=>{
  const result=spawnSync(
    process.execPath,
    [path.join(root,"tooling/run-postgres-tests.mjs"),"core"],
    {
      cwd:root,
      encoding:"utf8",
      env:{...process.env,DATABASE_URL:"postgresql://flytally@example.com/flytally_test",FLYTALLY_PSQL:path.join(root,"definitely-not-psql")},
    },
  );
  assert.equal(result.status,2,result.stderr||result.stdout);
  assert.match(result.stderr,/may only target a localhost database/);
  assert.match(result.stderr,/gate did not run/);
  assert.doesNotMatch(result.stderr,/requires the psql client|could not connect/);
});

test("PostgreSQL runner owns integration intent instead of relying on the caller flag",()=>{
  const runner=read("tooling/run-postgres-tests.mjs");
  assert.match(runner,/const gateEnv = preflightPostgresGate\(env\)/);
  assert.match(runner,/FLYTALLY_POSTGRES_INTEGRATION: "1"/);
  assert.match(runner,/probePostgresConnection\(databaseUrl/);
  assert.match(runner,/\.\.\.gateEnv/);
  assert.doesNotMatch(runner,/env: process\.env/);
});

test("PostgreSQL CLI override is explicit and propagated through child PATH",()=>{
  const helper=read("tooling/postgres-cli.mjs");
  assert.match(helper,/FLYTALLY_PSQL/);
  assert.match(helper,/const command = explicit \|\| "psql"/);
  assert.match(helper,/dirname\(explicit\)/);
  assert.match(helper,/join\(delimiter\)/);
  assert.match(helper,/PGCONNECT_TIMEOUT: env\.PGCONNECT_TIMEOUT \|\| "5"/);
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

test("authenticated browser gate preflights a localhost database connection before bootstrap",()=>{
  const runner=read("tooling/run-auth-browser.mjs");
  assert.match(runner,/may only reset a localhost PostgreSQL fixture/);
  assert.match(runner,/probePostgresConnection\(databaseUrl/);
  assert.match(runner,/failureSuffix:"The browser gate did not run\."/);
  assert.match(runner,/env:browserEnv/);
  assert.ok(
    runner.indexOf("probePostgresConnection(databaseUrl")<runner.indexOf("bootstrap-browser-smoke-db.mjs"),
    "database connectivity probe must run before the destructive fixture bootstrap",
  );
});

test("authenticated browser gate executes the repository-pinned Playwright CLI through Node",()=>{
  const runner=read("tooling/run-auth-browser.mjs");
  assert.match(runner,/createRequire\(import\.meta\.url\)/);
  assert.match(runner,/require\.resolve\("@playwright\/test\/package\.json"\)/);
  assert.match(runner,/join\(dirname\(playwrightPackage\),"cli\.js"\)/);
  assert.match(runner,/spawnSync\(process\.execPath,\[playwrightCli,"test","--config=playwright\.config\.mjs"/);
  assert.doesNotMatch(runner,/npx\.cmd|const command=.*npx/);
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
  assert.match(workflow,/Manual application diagnostic/);
  assert.match(workflow,/Manual PostgreSQL diagnostic/);
  assert.match(workflow,/TypeScript check/);
  assert.match(workflow,/npm run typecheck/);
  assert.match(workflow,/Targeted UI regression tests/);
  assert.match(workflow,/inputs\.full_tests != true/);
  assert.match(workflow,/Full unit and regression tests/);
  assert.match(workflow,/inputs\.full_tests == true/);
  assert.match(workflow,/npm run test:group -- ui-contract/);
  assert.doesNotMatch(workflow,/npm run test:ui/);
  assert.doesNotMatch(workflow,/name: Production build/);
  assert.match(browser,/name: Legacy full Chromium diagnostic/);
  assert.match(browser,/name: Diagnostic production build/);
  assert.match(browser,/name: Legacy full browser diagnostic/);
  assert.match(browser,/flytally-browser-diagnostic-/);
  assert.doesNotMatch(browser,/Authenticated browser acceptance/);
  assert.match(browser,/run: npm run build/);
  assert.match(workflow,/PostgreSQL acceptance tests/);
  assert.match(workflow,/inputs\.postgres == true/);
  assert.match(workflow,/test:postgres:full/);
  assert.doesNotMatch(workflow,/FLYTALLY_POSTGRES_INTEGRATION/);
  assert.match(workflow,/node-version: 24/);
  assert.match(browser,/node-version: 24/);
  assert.match(browser,/npm run test:browser/);
  assert.doesNotMatch(workflow,/verify:release:risk/);
  assert.doesNotMatch(browser,/verify:release:risk|verify:browser:risk/);
  assert.doesNotMatch(browser,/npm install --no-save --package-lock=false @playwright\/test/);
});

test("PostgreSQL core scale and full membership comes from the development registry",()=>{
  const runner=read("tooling/run-postgres-tests.mjs");
  const manifest=JSON.parse(read("tooling/development-modules.json"));
  const scalePaths=manifest.postgresAcceptance.scaleTests as string[];
  assert.equal(new Set(scalePaths).size,scalePaths.length);
  assert.ok(scalePaths.length>0);
  assert.match(runner,/development-modules[.]json/);
  assert.match(runner,/manifest\.postgresAcceptance\?\.scaleTests/);
  for(const file of scalePaths){
    assert.match(file,/^tests\/integration\/.*[.]test[.]ts$/);
    assert.doesNotMatch(runner,new RegExp(path.basename(file).replaceAll(".","[.]")));
  }

  const moduleUrl=pathToFileURL(path.join(root,"tooling/run-postgres-tests.mjs")).href;
  const script=[
    `import { selectPostgresTests } from ${JSON.stringify(moduleUrl)};`,
    `console.log(JSON.stringify({core:selectPostgresTests("core"),scale:selectPostgresTests("scale"),full:selectPostgresTests("full")}));`,
  ].join("");
  const result=spawnSync(process.execPath,["--input-type=module","-e",script],{cwd:root,encoding:"utf8"});
  assert.equal(result.status,0,result.stderr||result.stdout);
  const selected=JSON.parse(result.stdout.trim());
  const all=fs.readdirSync(path.join(root,"tests","integration")).filter(name=>name.endsWith(".test.ts")).sort();
  const expectedScale=scalePaths.map(file=>path.basename(file)).sort();
  assert.deepEqual(selected.scale,expectedScale);
  assert.deepEqual(selected.full,all);
  assert.deepEqual(selected.core,all.filter(name=>!expectedScale.includes(name)));
});

test("development policy documents candidate-first iteration, module scope and release verification",()=>{
  const doc=read("DEVELOPMENT.md");
  assert.match(doc,/candidate-first development workflow/);
  assert.match(doc,/one coherent candidate commit/);
  assert.match(doc,/npm run test:target/);
  assert.match(doc,/tooling\/development-modules[.]json/);
  assert.match(doc,/unknown .* runtime files fail conservative/i);
  assert.match(doc,/do not automatically invent PostgreSQL\/browser dependencies/i);
  assert.match(doc,/scope:changed.*planner.*not an executor/i);
  assert.match(doc,/verify:plan/i);
  assert.match(doc,/full_tests.*does not silently imply PostgreSQL or browser work/i);
  assert.match(doc,/Evidence taxonomy and reporting/i);
  assert.match(doc,/required_evidence/);
  assert.match(doc,/aggregate regression gate/i);
  assert.match(doc,/source\/regex\/static contract PASS.*does .*not.*runtime domain behavior.*browser behavior.*PostgreSQL behavior/i);
  assert.match(doc,/PostgreSQL runner reads its scale membership from that registry/i);
  assert.match(doc,/npm run verify:release/);
  assert.match(doc,/canonical production branch is `main`/i);
  assert.match(doc,/deleted after merge/i);
});
