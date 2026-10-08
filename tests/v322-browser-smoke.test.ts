import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root=path.resolve(import.meta.dirname,"..");
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");

test("v3.2 U3 browser smoke is manual-only and repository-pinned",()=>{
  const workflow=read(".github/workflows/browser-smoke.yml");
  const pkg=JSON.parse(read("package.json"));
  const lock=JSON.parse(read("package-lock.json"));
  assert.match(workflow,/workflow_dispatch:/);
  assert.doesNotMatch(workflow,/\n\s*pull_request:/);
  assert.doesNotMatch(workflow,/\n\s*schedule:/);
  assert.equal(pkg.devDependencies["@playwright/test"],"1.55.0");
  assert.equal(lock.packages["node_modules/@playwright/test"].version,"1.55.0");
  assert.match(workflow,/npx --no-install playwright install --with-deps chromium/);
  assert.match(workflow,/npm run test:browser/);
  assert.doesNotMatch(workflow,/npm install --no-save --package-lock=false @playwright\/test/);
  assert.match(workflow,/Chromium desktop \+ mobile/);
  assert.doesNotMatch(workflow,/secrets[.]/);
});

test("v3.2 U3 runs real desktop and mobile browser projects",()=>{
  const config=read("playwright.config.mjs");
  assert.match(config,/Desktop Chrome/);
  assert.match(config,/Pixel 7/);
  assert.match(config,/webServer/);
  assert.match(config,/npm start/);
});

test("v3.2 U3 verifies auth boundary, responsive overflow and pending feedback",()=>{
  const smoke=read("e2e/public-shell.spec.mjs");
  const actions=read("e2e/browser-actions.mjs");
  assert.match(actions,/document[.]documentElement[.]scrollWidth/);
  assert.match(actions,/document[.]documentElement[.]clientWidth/);
  assert.match(smoke,/expectNoHorizontalOverflow\(page\)/);
  assert.match(smoke,/page[.]goto\("\/dashboard"\)/);
  assert.match(smoke,/Signing in…/);
  assert.match(smoke,/aria-busy/);
  assert.match(smoke,/data-loading/);
});

test("login uses the shared pending-action contract",()=>{
  const login=read("app/login/login-form.tsx");
  assert.match(login,/PendingActionButton/);
  assert.match(login,/pendingLabel="Signing in…"/);
});

test("browser smoke flight fixture includes historical aircraft identity columns required by runtime migrations",()=>{
  const bootstrap=read("tooling/bootstrap-browser-smoke-db.mjs");
  const start=bootstrap.indexOf("CREATE TABLE flights(");
  const end=bootstrap.indexOf(");",start);
  assert.ok(start>=0&&end>start);
  const flights=bootstrap.slice(start,end);
  assert.match(flights,/aircraft_make TEXT NOT NULL DEFAULT ''/);
  assert.match(flights,/aircraft_model TEXT NOT NULL DEFAULT ''/);
  assert.match(flights,/aircraft_variant TEXT NOT NULL DEFAULT ''/);
});
