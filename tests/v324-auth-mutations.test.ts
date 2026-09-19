import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root=path.resolve(import.meta.dirname,"..");
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");

test("v3.2 U5 seeds deterministic mutation fixtures",()=>{
  const bootstrap=read("tooling/bootstrap-browser-smoke-db.mjs");
  assert.match(bootstrap,/browser-friend@example[.]test/);
  assert.match(bootstrap,/VALUES\(7001,9002,9001,'pilot','pending'/);
  assert.match(bootstrap,/UNIQUE\(user_id,dedupe_key\)/);
  assert.match(bootstrap,/created_at TIMESTAMPTZ/);
});

test("v3.2 U5 fixture resets are localhost-only and browser-only",()=>{
  const helper=read("e2e/browser-db.mjs");
  assert.match(helper,/LOCAL_HOSTS/);
  assert.match(helper,/FLYTALLY_AUTH_BROWSER!=="1"/);
  assert.match(helper,/may only reset a localhost database/);
  assert.match(helper,/UPDATE user_settings SET preferences_json='\{\}'::jsonb/);
  assert.match(helper,/UPDATE pilot_connections SET status='pending'/);
});

test("v3.2 U5 verifies pending state duplicate-submit protection and persistence",()=>{
  const smoke=read("e2e/public-shell.spec.mjs");
  assert.match(smoke,/appearance mutation disables duplicate submit and persists/);
  assert.match(smoke,/connection acceptance disables duplicate submit and persists/);
  assert.match(smoke,/toHaveAttribute\("aria-busy","true"\)/);
  assert.match(smoke,/toHaveAttribute\("data-loading","true"\)/);
  assert.match(smoke,/expect\(gate[.]count\(\)\)[.]toBe\(1\)/);
  assert.match(smoke,/toHaveValue\("dark"\)/);
  assert.match(smoke,/details[.]connection-manager/);
});
