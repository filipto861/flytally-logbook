import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root=path.resolve(import.meta.dirname,"..");
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");

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
