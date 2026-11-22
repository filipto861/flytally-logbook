import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root=path.resolve(import.meta.dirname,"..");
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");

test("N2-C retains range in category/analysis navigation but clears it for presets",()=>{
  const page=read("app/(protected)/statistics/page.tsx");
  assert.match(page,/if\(period==="custom"&&range\)\{query\.set\("from",range\.from\);query\.set\("to",range\.to\)\}/);
  assert.match(page,/statisticsHref\(period,section,key,customRange\)/);
  assert.match(page,/statisticsHref\(period,key,category,customRange\)/);
  assert.match(page,/statisticsHref\(key,section,category\)/);
  assert.match(page,/getPilotInsightsData\(session\.userId,section==="career"\?"all":period,category,section,customRange\)/);
  assert.match(page,/aria-current=\{period===key\?"page":undefined\}/);
});

test("N2-C rejects invalid deep links before querying statistics",()=>{
  const page=read("app/(protected)/statistics/page.tsx");
  const invalid=page.indexOf('if(section!=="career"&&period==="custom"&&!customRange)return');
  const query=page.indexOf('getPilotInsightsData(session.userId,section==="career"?"all":period');
  assert.ok(invalid>=0&&query>invalid,"invalid custom requests must render an error before expensive aggregate query");
  assert.match(page,/role="alert"/);
  assert.match(page,/parsePilotInsightCustomRange\(params\.from,params\.to\)/);
  const data=read("lib/data/pilot-insights.ts");
  assert.match(data,/pilotInsightBounds\(requested,new Date\(\),customRange\)/);
  assert.match(data,/date_key>=\$\{bounds\.start\}/);
  assert.match(data,/date_key<=\$\{bounds\.end\}/);
});

// Source-level guard: direct invocation with an invalid/remote URL must not run after() SQL.
test("N2-C PostgreSQL fixture cleanup remains fail closed after rejected URL preflight",()=>{
  const integration=read("tests/integration/postgres-pilot-insights.test.ts");
  assert.match(integration,/let localTargetValidated=false/);
  const validated=integration.indexOf("localTargetValidated=true;");
  const hostnameGuard=integration.indexOf(".has(url.hostname)");
  const setup=integration.indexOf("const setup=`");
  assert.ok(hostnameGuard>=0&&validated>hostnameGuard&&setup>validated,
    "Only the locally validated URL may authorize fixture setup and subsequent cleanup");
  assert.match(integration,/after\(\(\)=>\{if\(enabled&&localTargetValidated\)raw\(`DROP SCHEMA IF EXISTS/);
});
