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
  assert.match(integration,/\["overview","experience","aircraft","places","career"\] as const/);
  assert.match(integration,/recordMetric\(`pilotInsights\$\{section\[0\]\.toUpperCase\(\)\}\$\{section\.slice\(1\)\}100k`/);
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

test("v2.3 Print resolves latest aircraft and verification metadata once instead of per flight row",()=>{
  const page=read("app/(protected)/print/page.tsx");
  assert.doesNotMatch(page,/LEFT JOIN LATERAL\(/);
  assert.match(page,/DISTINCT ON\(UPPER\(TRIM\(a\.registration\)\)\)/);
  assert.match(page,/ORDER BY UPPER\(TRIM\(a\.registration\)\),a\.id DESC/);
  assert.match(page,/DISTINCT ON\(v\.flight_id,v\.record_revision,v\.flight_hash\)/);
  assert.match(page,/ORDER BY v\.flight_id,v\.record_revision,v\.flight_hash,v\.signed_at DESC NULLS LAST,v\.id DESC/);
  assert.match(page,/verify\.flight_id=f\.id AND verify\.record_revision=COALESCE\(f\.record_revision,1\) AND verify\.flight_hash=f\.certification_hash/);
  assert.match(page,/v\.verification_role IN \('INSTRUCTOR','SUPERVISING PIC'\)/);
});

test("v2.3 Statistics only computes aggregates required by the active section",()=>{
  const source=read("lib/data/pilot-insights.ts"),page=read("app/(protected)/statistics/page.tsx");
  assert.match(page,/getPilotInsightsData\(session\.userId,period,category,section\)/);
  assert.match(source,/getPilotInsightsData\(userId:number,requested:string,requestedCategory\?:string,requestedSection\?:string\)/);
  assert.match(source,/normalizedAnalyticsSection/);
  assert.ok(source.includes('?s(value).toLowerCase():"all") as'),"missing backward-compatible all-section fallback");
  for(const name of ["overview","experience","aircraft","places","career"])assert.ok(source.includes(`'all','${name}'`));
});

test("v2.3 performance baseline remains documented after v2.6 release",()=>{
  const roadmap=read("ROADMAP.md");
  assert.match(roadmap,/## Current release — v2\.6\.0 — Professional Pilot Workspace 2\.0/);
  assert.match(roadmap,/## v2\.3\.0 — Large Logbook Performance & Scalability/);
  assert.match(roadmap,/100k-flight read-performance gate/);
  assert.match(roadmap,/without a schema change or historical-row rewrite/);
});
