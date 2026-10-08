import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { isLegacyGpsImportTask,LEGACY_GPS_IMPORT_TASK } from "../lib/legacy-flight-task.ts";

const root=path.resolve(import.meta.dirname,"..");
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");

test("E1.4 legacy GPS Task annotation is exact-match only",()=>{
  assert.equal(LEGACY_GPS_IMPORT_TASK,"GPS import");
  assert.equal(isLegacyGpsImportTask("GPS import"),true);
  assert.equal(isLegacyGpsImportTask(" GPS import"),false);
  assert.equal(isLegacyGpsImportTask("GPS import "),false);
  assert.equal(isLegacyGpsImportTask("gps import"),false);
  assert.equal(isLegacyGpsImportTask("GPS Import"),false);
  assert.equal(isLegacyGpsImportTask(null),false);
});

test("E1.4 read-only owner and shared-preview views keep raw Task visible and add an annotation",()=>{
  const entry=read("components/readonly-logbook-entry.tsx");
  const detail=read("app/(protected)/flights/[id]/page.tsx");
  const shared=read("app/(protected)/connections/shared/[id]/page.tsx");
  assert.match(entry,/isLegacyGpsImportTask\(row\.task\)/);
  assert.match(entry,/LEGACY GPS IMPORT/);
  assert.match(entry,/Task <code>\{text\(row\.task\)\}<\/code>/);
  assert.match(entry,/retained exactly as stored evidence/);
  assert.match(detail,/isLegacyGpsImportTask\(flight\.task\)/);
  assert.match(detail,/\{flight\.task\|\|"flight"\}\{legacyGpsImportTask\?<span className="legacy-task-inline">LEGACY GPS IMPORT<\/span>:null\}/);
  assert.match(shared,/ReadonlyLogbookEntry/);
  assert.doesNotMatch(entry,/legacyGpsImportTask\?\s*["']{2}/);
});

test("E1.4 presentation annotation does not transform export, print or certification payload data",()=>{
  const exportRoute=read("app/api/export/route.ts");
  const printPage=read("app/(protected)/print/page.tsx");
  const integrity=read("lib/certification-integrity.ts");
  assert.match(exportRoute,/"task"/);
  assert.match(exportRoute,/f\.task/);
  assert.doesNotMatch(exportRoute,/legacy-flight-task|isLegacyGpsImportTask/);
  assert.match(printPage,/else if\(task\)parts\.push\(task\)/);
  assert.doesNotMatch(printPage,/legacy-flight-task|isLegacyGpsImportTask/);
  assert.match(integrity,/remarks:\{task:text\(row\.task\)/);
  assert.doesNotMatch(integrity,/legacy-flight-task|isLegacyGpsImportTask/);
});

test("E1.4 correction remains owner-scoped and archives the certified snapshot before opening a correction",()=>{
  const actions=read("app/(protected)/flights/certification-actions.ts");
  assert.match(actions,/SELECT certified_at,certification_hash,record_revision FROM flights WHERE id=\$\{flightId\} AND user_id=\$\{userId\}/);
  assert.match(actions,/INSERT INTO flight_certified_revisions[\s\S]*to_jsonb\(f\)[\s\S]*WHERE f\.id=\$\{flightId\} AND f\.user_id=\$\{userId\} AND f\.certified_at IS NOT NULL/);
  assert.match(actions,/UPDATE flights SET record_revision=COALESCE\(record_revision,1\)\+1[\s\S]*WHERE id=\$\{flightId\} AND user_id=\$\{userId\} AND certified_at IS NOT NULL/);
  assert.doesNotMatch(actions,/UPDATE flights SET task\s*=\s*''/);
});

test("E1.4 authenticated browser fixture cleans up its certified legacy rows between projects",()=>{
  const browserDb=read("e2e/browser-db.mjs");
  const browser=read("e2e/advisory-presentation.spec.mjs");
  assert.match(browserDb,/export function clearE14LegacyTaskFixture\(\)/);
  assert.match(browserDb,/DELETE FROM flight_participations WHERE id=9915 OR source_flight_id IN \(9914,9915\)/);
  assert.match(browserDb,/DELETE FROM flights WHERE id IN \(9914,9915\)/);
  assert.match(browser,/finally\{\s*clearE14LegacyTaskFixture\(\);\s*\}/);
});

test("E1.4 legacy annotation styles are bounded and responsive",()=>{
  const css=read("app/globals.css");
  assert.match(css,/\.legacy-task-note\{/);
  assert.match(css,/\.legacy-task-badge,\.legacy-task-inline\{/);
  assert.match(css,/@media\(max-width:600px\)\{\.legacy-task-note/);
});
