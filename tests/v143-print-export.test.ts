import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { logbookScopeIncludesFstd } from "../lib/logbook-print.ts";
import { normalizeOutputDateRange,outputRangeFileToken } from "../lib/output-range.ts";
import { releaseAtLeast } from "./release-version.ts";

const root=path.resolve(import.meta.dirname,"..");
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");

test("v1.43.0 validates printable and export date ranges strictly",()=>{
  assert.ok(releaseAtLeast(JSON.parse(read("package.json")).version,1,43,0));
  assert.deepEqual(normalizeOutputDateRange("2026-01-02","2026-08-30"),{from:"2026-01-02",to:"2026-08-30",error:null,label:"2026-01-02 → 2026-08-30"});
  assert.equal(normalizeOutputDateRange("2026-02-31","").error,"From date is invalid.");
  assert.equal(normalizeOutputDateRange("2026-08-30","2026-01-02").error,"From date must not be after To date.");
  assert.equal(outputRangeFileToken(normalizeOutputDateRange("","2026-08-30")),"through-2026-08-30");
});

test("v1.43.0 shares logbook scope semantics including FSTD",()=>{
  assert.equal(logbookScopeIncludesFstd("all"),true);
  assert.equal(logbookScopeIncludesFstd("easa"),true);
  assert.equal(logbookScopeIncludesFstd("ull-easa"),true);
  assert.equal(logbookScopeIncludesFstd("ull"),false);
  const hub=read("components/data-hub.tsx");
  assert.match(hub,/action="\/print"/);
  assert.match(hub,/action="\/api\/export"/);
  assert.ok((hub.match(/LOGBOOK_PRINT_SCOPES\.map/g)||[]).length>=2);
  assert.match(hub,/name="scope"/);
  assert.doesNotMatch(hub,/name="evidence"/);
  assert.match(hub,/CSV contains filtered flight rows only/);
});

test("v1.43.0 keeps export scope and range aligned with print",()=>{
  const route=read("app/api/export/route.ts");
  assert.match(route,/normalizeOutputDateRange/);
  assert.match(route,/normalizeLogbookPrintScope/);
  assert.match(route,/logbookScopeIncludesFstd/);
  assert.match(route,/Unsupported export format/);
  assert.match(route,/AND \(\$\{scope\}='all'/);
  assert.match(route,/session_date::text>=\$\{from\}/);
  assert.match(route,/session_date::text<=\$\{to\}/);
  assert.doesNotMatch(route,/SELECT f\.\*/);
  assert.match(route,/flytally-logbook-\$\{scope\}-\$\{outputRangeFileToken\(range\)\}/);
});

test("v1.43.0 print preview reports size and handles empty or invalid selections",()=>{
  const page=read("app/(protected)/print/page.tsx");
  assert.match(page,/normalizeOutputDateRange/);
  assert.match(page,/records\.length\?paginateEasaRecords\(records,10\):\[\]/);
  assert.match(page,/selected records/);
  assert.match(page,/Large print selection/);
  assert.match(page,/No records match the selected logbook scope and date range/);
  assert.match(page,/Correct the date range before opening the printable logbook/);
  assert.match(page,/logbookScopeIncludesFstd/);
  assert.match(page,/<Header\/>/);
});

test("v1.43.0 leaves regulatory record and backup direction unchanged",()=>{
  const roadmap=read("ROADMAP.md"),backup=read("lib/account-backup.ts");
  assert.match(roadmap,/same FCL\.050 columns 1–12, 10-row A4 landscape renderer/);
  assert.match(roadmap,/preserve certification payloads\/hashes\/revisions/);
  assert.match(backup,/track_points/);
  assert.match(backup,/instructor_flight_approvals/);
});
