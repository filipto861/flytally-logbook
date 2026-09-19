import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root=path.resolve(import.meta.dirname,"..");
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");

test("v3.2 U3 browser smoke is selective and pinned",()=>{
  const workflow=read(".github/workflows/browser-smoke.yml");
  assert.match(workflow,/pull_request:/);
  assert.match(workflow,/paths:/);
  assert.match(workflow,/schedule:/);
  assert.match(workflow,/@playwright\/test@1[.]55[.]0/);
  assert.match(workflow,/playwright install --with-deps chromium/);
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
  assert.match(smoke,/scrollWidth-document[.]documentElement[.]clientWidth/);
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
