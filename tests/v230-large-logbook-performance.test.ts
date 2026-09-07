import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root=path.resolve(import.meta.dirname,"..");
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");

test("v2.3 keeps a retained 100k read-performance gate over production hot paths",()=>{
  const integration=read("tests/integration/postgres-v230-large-logbook-performance.test.ts");
  const workflow=read(".github/workflows/verify-web.yml");
  assert.match(integration,/const SCALE_ROWS=100_000/);
  for(const metric of [
    "dashboardAllTime100k",
    "flightListFirstPage100k",
    "pilotInsights100k",
    "printCompleteSql100k",
    "exportCompleteSql100k",
    "pendingActionCount4500",
    "auditArchivedRevisions500",
    "flightAuditLatest100Of5000",
  ])assert.ok(integration.includes(metric),`missing v2.3 performance metric ${metric}`);
  assert.match(integration,/read\("lib\/data\/dashboard\.ts"\)/);
  assert.match(integration,/read\("lib\/data\/flights-fast\.ts"\)/);
  assert.match(integration,/read\("lib\/data\/pilot-insights\.ts"\)/);
  assert.match(integration,/read\("app\/api\/export\/route\.ts"\)/);
  assert.match(integration,/read\("lib\/pending-actions\.ts"\)/);
  assert.match(integration,/read\("app\/\(protected\)\/flights\/\[id\]\/audit\/page\.tsx"\)/);
  assert.match(workflow,/flytally-v230-100k-scale-evidence\.json/);
  assert.match(workflow,/retention-days: 90/);
});

test("v2.3 Dashboard uses a lean at-a-glance read model instead of recalculating Statistics",()=>{
  const source=read("lib/data/dashboard.ts"),page=read("app/(protected)/dashboard/page.tsx");
  assert.match(page,/getDashboardOverviewData\(session\.userId,"all"\)/);
  const match=source.match(/getDashboardOverviewData[\s\S]*?sql`([\s\S]*?)`,650/);
  assert.ok(match,"Dashboard overview production SQL must remain directly measurable");
  const overviewSql=match[1];
  assert.match(overviewSql,/SUM\(activity_minutes\).*total_minutes/s);
  assert.match(overviewSql,/SUM\(logged_minutes\).*ull_minutes/s);
  assert.match(overviewSql,/SUM\(logged_minutes\).*easa_minutes/s);
  assert.match(overviewSql,/SUM\(block_minutes\) FILTER\(WHERE role='SAFETY PILOT'\).*safety_minutes/s);
  for(const deadAggregate of ["jsonb_agg","top_aircraft","top_routes","top_airports","month_key","year_key"])
    assert.equal(overviewSql.includes(deadAggregate),false,`Dashboard overview must not compute ${deadAggregate}`);
});

test("v2.3 remains a performance-only roadmap stage",()=>{
  const roadmap=read("ROADMAP.md");
  assert.match(roadmap,/### v2\.3 — Large Logbook Performance & Scalability/);
  assert.match(roadmap,/Keep this release performance-only: no new regulatory semantics or parallel user workflows\./);
});
