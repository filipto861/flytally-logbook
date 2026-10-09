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
  assert.equal(registry.ownership.auditedTotal,385);
});

test("P1.4 aircraft and rate defaults use strict server calendar authority",()=>{
  const databasePage=read("app/(protected)/database/page.tsx");
  const manager=read("components/aircraft-manager.tsx");
  const newFlight=read("app/(protected)/flights/new/page.tsx");
  const workspace=read("components/flight-entry-workspace.tsx");
  const quick=read("components/quick-aircraft-form.tsx");

  assert.match(databasePage,/getUserSaveableCalendarDefault\(userId\)/);
  assert.match(databasePage,/calendarDefault=\{calendarDefault\}/);
  assert.match(manager,/calendarDefault:SaveableCalendarDefault/);
  assert.match(manager,/initialRateDate=calendarDefault\.status==="resolved"\?calendarDefault\.date:""/);
  assert.match(manager,/defaultRateDate=calendarDefault\.status==="resolved"\?calendarDefault\.date:""/);
  assert.doesNotMatch(manager,/timeZone:"Europe\/Prague"|const today=|new Date\(\)/);

  assert.match(newFlight,/calendarDefault=\{calendarDefault\}/);
  assert.match(workspace,/calendarDefault:SaveableCalendarDefault/);
  assert.match(workspace,/QuickAircraftForm action=\{aircraftAction\} calendarDefault=\{calendarDefault\}/);
  assert.match(quick,/calendarDefault:SaveableCalendarDefault/);
  assert.match(quick,/initialRateDate=calendarDefault\.status==="resolved"\?calendarDefault\.date:""/);
  assert.match(quick,/name="initial_valid_from" value=\{initialRateDate\}/);
  assert.doesNotMatch(quick,/timeZone:"Europe\/Prague"|const today=|new Date\(\)/);
});

test("P1.4 unresolved calendar state stays visible and editable instead of inventing a rate date",()=>{
  const manager=read("components/aircraft-manager.tsx");
  const quick=read("components/quick-aircraft-form.tsx");

  assert.match(manager,/Needs configuration for automatic date/);
  assert.match(manager,/Enter the effective date manually/);
  assert.match(manager,/Automatic date is temporarily unavailable/);
  assert.match(quick,/Automatic rate date needs timezone configuration/);
  assert.match(quick,/Add the aircraft without a rate/);
  assert.match(quick,/Automatic rate date is temporarily unavailable/);
});

test("P1.4 rejects a rate-bearing aircraft save before persistence when the effective date is invalid",()=>{
  const actions=read("app/(protected)/database/actions.ts");
  const start=actions.indexOf("async function persistAircraft");
  const end=actions.indexOf("export async function saveAircraft",start);
  const persist=actions.slice(start,end);
  const validation=persist.indexOf("initialRateDateError");
  const transaction=persist.indexOf("await sql.transaction(queries)");

  assert.ok(validation>=0&&transaction>validation,"initial rate date validation must happen before the aircraft/rate transaction");
  assert.match(persist,/if\(initialRateError\)return\{ok:false,message:initialRateError\}/);
  assert.match(persist,/if\(initialPrice!==null&&initialPrice>0\)queries\.push\(sql`INSERT INTO rates/);
  assert.doesNotMatch(persist,/initialPrice!==null&&initialPrice>0&&validIsoDate\(validFrom\)/);
});


test("P1.5 active GPS timestamp consumers stay on UTC authority",()=>{
  const kml=read("lib/kml.ts");
  const actions=read("app/(protected)/flights/actions.ts");
  const review=read("lib/data/flight-track-review.ts");
  const form=read("components/kml-import-form.tsx");

  assert.match(kml,/export \{ utcParts as localParts \} from "\.\/track-time";/);
  assert.match(actions,/import \{[^}]*\blocalParts\b[^}]*\} from "@\/lib\/kml";/);
  assert.doesNotMatch(actions,/localParts[^\n]*from "@\/lib\/track-processing"/);
  assert.match(review,/import \{[^}]*\blocalParts\b[^}]*\} from "@\/lib\/kml";/);
  assert.doesNotMatch(review,/localParts[^\n]*from "@\/lib\/track-processing"/);
  assert.match(form,/import \{ trackTimeBasis,utcParts,type TrackTimeBasis \} from "@\/lib\/track-time";/);
  assert.doesNotMatch(form,/\blocalParts\b/);
});

test("P1.5 backup and exact restore preserve calendar-date fields without timezone conversion",()=>{
  const backup=read("lib/account-backup.ts");
  const restore=read("lib/account-restore-v6.ts");
  const portable=read("lib/portable-backup.ts");

  assert.match(backup,/SELECT \* FROM flights WHERE user_id=/);
  assert.match(backup,/SELECT \* FROM rates WHERE user_id=/);
  assert.match(backup,/SELECT \* FROM user_settings WHERE user_id=/);

  assert.match(restore,/INSERT INTO user_settings SELECT \(json_populate_record\(NULL::user_settings,item\)\)\.\*/);
  assert.match(restore,/INSERT INTO rates SELECT \(json_populate_record\(NULL::rates,item\)\)\.\*/);
  assert.match(restore,/INSERT INTO flights SELECT \(json_populate_record\(NULL::flights,item\)\)\.\*/);
  const stageFlight=restore.slice(restore.indexOf("function stageFlight"),restore.indexOf("function stageFstd"));
  assert.doesNotMatch(stageFlight,/\bdate\b|valid_from|new Date|Date\.parse/);

  assert.match(portable,/flightRestoreKey\(row:BackupRow\).*String\(row\.date\?\?""\)\.slice\(0,10\)/);
  assert.doesNotMatch(portable,/flightRestoreKey[^{]*\{[^}]*new Date\(row\.date/s);
});

test("P1.5 export print and rate selection keep persisted calendar dates date-only",()=>{
  const exportRoute=read("app/api/export/route.ts");
  const printPage=read("app/(protected)/print/page.tsx");
  const rateHistory=read("lib/rate-history.ts");

  assert.match(exportRoute,/SELECT f\.date,f\.evidence/);
  assert.match(exportRoute,/date::text>=\$\{from\}::text/);
  assert.match(exportRoute,/date::text<=\$\{to\}::text/);
  assert.doesNotMatch(exportRoute,/new Date\([^\n]*(?:row\.)?date|Date\.parse\([^\n]*(?:row\.)?date/i);

  assert.match(printPage,/SELECT f\.date,f\.evidence/);
  assert.match(printPage,/f\.date::text>=\$\{from\}::text/);
  assert.match(printPage,/const date=\(value:unknown\)=>\{const match=text\(value\)\.match/);
  assert.doesNotMatch(printPage,/new Date\([^\n]*(?:row\.)?date|Date\.parse\([^\n]*(?:row\.)?date/i);

  const effective=rateHistory.slice(rateHistory.indexOf("export function effectiveRateForDate"),rateHistory.indexOf("export function shouldResolveStoredPrice"));
  assert.match(effective,/rate\.valid_from<=date/);
  assert.match(effective,/localeCompare/);
  assert.doesNotMatch(effective,/new Date|Date\.parse|toISOString/);
});
