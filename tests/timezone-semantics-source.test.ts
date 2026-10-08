import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root=path.resolve(import.meta.dirname,"..");
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");

test("saveable calendar authority stays separate from resilient display timezone fallback",()=>{
  const strict=read("lib/data/user-calendar.ts"),display=read("lib/data/user-settings.ts");
  assert.doesNotMatch(strict,/FALLBACK_TIMEZONE|normalizeTimeZone/);
  assert.match(strict,/needs_configuration/);
  assert.match(strict,/read_failed/);
  assert.match(display,/return normalizeTimeZone\(rows\[0\]\?\.timezone\)/);
  assert.match(display,/return FALLBACK_TIMEZONE/);
});

test("settings validates timezone before any account settings transaction",()=>{
  const actions=read("app/(protected)/profile/actions.ts"),page=read("app/(protected)/profile/page.tsx");
  const account=actions.slice(actions.indexOf("export async function saveAccountSettings"),actions.indexOf("// Legacy licence actions"));
  const validation=account.indexOf("normalizeSaveableTimeZone");
  const transaction=account.indexOf("sql.transaction");
  assert.ok(validation>=0&&transaction>validation,"timezone validation must happen before account settings writes");
  assert.match(account,/if\(!timezone\)redirect\("\/profile\?settingsError=timezone"\)/);
  assert.match(page,/settingsError\?:string/);
  assert.match(page,/Enter a valid named time zone/);
  assert.match(page,/Numeric offsets such as \+02:00 are not supported/);
});

test("development registry owns the strict timezone boundary",()=>{
  const registry=JSON.parse(read("tooling/development-modules.json"));
  const platform=registry.modules.find((item:{id:string})=>item.id==="platform");
  assert.ok(platform);
  assert.ok(platform.prefixes.includes("lib/calendar-date"));
  assert.ok(platform.prefixes.includes("lib/data/user-calendar"));
  assert.equal(registry.ownership.auditedTotal,383);
});
