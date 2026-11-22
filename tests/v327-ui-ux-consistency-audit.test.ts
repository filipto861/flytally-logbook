import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root=path.resolve(import.meta.dirname,"..");
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");


test("v3.3 design batch 7 formats date-only values without timezone conversion",async()=>{
  const {formatDateOnly}=await import("../lib/display-format.ts");
  assert.equal(formatDateOnly("2026-01-01"),"01/01/2026");
  assert.equal(formatDateOnly("2026-12-31"),"31/12/2026");
  for(const invalid of ["","2026-02-29","2026-04-31","not-a-date"])assert.equal(formatDateOnly(invalid),invalid);

  const oldTz=process.env.TZ;
  try{
    for(const zone of ["America/Los_Angeles","Pacific/Auckland"]){
      process.env.TZ=zone;
      assert.equal(formatDateOnly("2026-01-01"),"01/01/2026",zone);
      assert.equal(formatDateOnly("2026-12-31"),"31/12/2026",zone);
    }
  }finally{
    if(oldTz===undefined)delete process.env.TZ;else process.env.TZ=oldTz;
  }

  const daysInMonth=(year:number,month:number)=>[31,year%4===0&&(year%100!==0||year%400===0)?29:28,31,30,31,30,31,31,30,31,30,31][month-1];
  for(const year of [2024,2026])for(let month=1;month<=12;month++)for(let day=1;day<=daysInMonth(year,month);day++){
    const iso=`${year}-${String(month).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
    const legacy=new Date(`${iso}T00:00:00`).toLocaleDateString("en-GB");
    assert.equal(formatDateOnly(iso),legacy,iso);
  }

  const helper=read("lib/display-format.ts");
  const start=helper.indexOf("export function formatDateOnly");
  const end=helper.indexOf("function parsedDate",start);
  assert.ok(start>=0&&end>start);
  assert.doesNotMatch(helper.slice(start,end),/new Date|Date[.]/);
});

test("v3.3 design batch 7 keeps GPS timeline timestamps explicitly UTC",()=>{
  const player=read("components/flight-track-player.tsx");
  const legacy=read("components/track-profile.tsx");
  const manager=read("components/track-manager.tsx");
  const importReview=read("components/gps-import-review-player.tsx");
  assert.match(player,/formatUtcTime\(current\.time\)/);
  assert.match(legacy,/formatUtcTime\(current\.time\)/);
  assert.match(manager,/formatUtcDateTime\(t\.startUtc\)/);
  assert.match(importReview,/timeZone:"UTC"\}\)\+" UTC"/);
  assert.doesNotMatch(player,/toLocaleTimeString\("en-GB"/);
  assert.doesNotMatch(legacy,/toLocaleTimeString\(['"]en-GB['"]/);
  assert.doesNotMatch(manager,/new Date\([^;\n]*\)\.toLocale(?:String|TimeString)\(\s*["\']en-GB["\']/i);
});

test("v3.3 design batch 7 uses one altitude conversion contract and keeps chart geometry in metres",async()=>{
  const units=await import("../lib/aviation-units.ts");
  assert.equal(units.METERS_TO_FEET,3.28084);
  assert.equal(units.metersToFeet(1000),3281);
  for(const file of ["components/track-profile.tsx","components/flight-track-player.tsx","components/gps-import-review-player.tsx"]){
    const source=read(file);
    assert.match(source,/metersToFeet/);
    assert.doesNotMatch(source,/3[.]28084/);
  }
  const legacy=read("components/track-profile.tsx");
  assert.match(legacy,/metersToFeet\(maxAlt\)\} ft · \{Math\.round\(maxAlt\)\} m/);
  assert.ok(legacy.includes("metersToFeet(current.alt)} ft · ${Math.round(Number(current.alt))} m"));
  assert.match(legacy,/const line=profile\.map/);
  assert.doesNotMatch(legacy,/<text\b|axis|tick/i);
});

test("v3.3 design batch 7 routes audited date-only displays through formatDateOnly",()=>{
  const checks:Record<string,string[]>={
    "app/(protected)/dashboard/page.tsx":["formatDateOnly(data.lastFlight.date)","formatDateOnly(recencySnapshot.nextDate)"],
    "app/(protected)/statistics/page.tsx":["formatDateOnly(data.career.firstDate)","formatDateOnly(data.career.lastDate)","formatDateOnly(row.firstDate)","formatDateOnly(row.lastDate)"],
    "components/recency-panel.tsx":["formatDateOnly(item.forecastDate)","formatDateOnly(item.deadline)","formatDateOnly(row.date)","formatDateOnly(row.dropOffDate)","formatDateOnly(item.date)"],
    "app/(protected)/flights/page.tsx":["formatDateOnly(f.date)"],
    "app/(protected)/flights/[id]/page.tsx":["formatDateOnly(flight.date)"],
    "components/aircraft-qualifications-section.tsx":["formatDateOnly(t(row.completed_on))","formatDateOnly(t(row.first_date))","formatDateOnly(t(row.last_date))"],
  };
  for(const [file,needles] of Object.entries(checks)){
    const source=read(file);
    for(const needle of needles)assert.ok(source.includes(needle),`${file}: ${needle}`);
  }
});


test("v3.3 design batch 7 formats local timestamps with deterministic numeric en-GB output",async()=>{
  const {FALLBACK_TIMEZONE,formatLocalDateTime}=await import("../lib/display-format.ts");
  assert.equal(FALLBACK_TIMEZONE,"Europe/Prague");
  assert.equal(formatLocalDateTime("2026-09-20T07:35:00Z","Europe/Prague"),"20/09/2026, 09:35");
  assert.equal(formatLocalDateTime("2026-09-20T07:35:00Z","America/New_York"),"20/09/2026, 03:35");

  assert.equal(formatLocalDateTime("2026-03-29T00:30:00Z","Europe/Prague"),"29/03/2026, 01:30");
  assert.equal(formatLocalDateTime("2026-03-29T01:30:00Z","Europe/Prague"),"29/03/2026, 03:30");
  assert.equal(formatLocalDateTime("2026-03-08T06:30:00Z","America/New_York"),"08/03/2026, 01:30");
  assert.equal(formatLocalDateTime("2026-03-08T07:30:00Z","America/New_York"),"08/03/2026, 03:30");

  assert.equal(formatLocalDateTime("2026-09-20T07:35:00Z","Not/A_Zone"),formatLocalDateTime("2026-09-20T07:35:00Z","Europe/Prague"));
  for(const value of [null,"","not-a-date"]){
    const expected=value==null?"":String(value);
    assert.doesNotThrow(()=>formatLocalDateTime(value,"Not/A_Zone"));
    assert.equal(formatLocalDateTime(value,"Not/A_Zone"),expected);
  }

  const helper=read("lib/display-format.ts");
  const start=helper.indexOf("export function formatLocalDateTime");
  const local=helper.slice(start);
  assert.match(local,/new Intl\.DateTimeFormat\("en-GB",options\)/);
  assert.match(local,/day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit",hourCycle:"h23"/);
  assert.doesNotMatch(local,/dateStyle|timeStyle/);
});

test("v3.3 design batch 7 user-timezone data helper falls back without throwing",async()=>{
  const {getUserTimezone}=await import("../lib/data/user-settings.ts");
  assert.equal(await getUserTimezone(7,async()=>[]),"Europe/Prague");
  assert.equal(await getUserTimezone(7,async()=>[{timezone:null}]),"Europe/Prague");
  assert.equal(await getUserTimezone(7,async()=>[{timezone:"Not/A_Zone"}]),"Europe/Prague");
  assert.equal(await getUserTimezone(7,async()=>[{timezone:"Pacific/Auckland"}]),"Pacific/Auckland");
  await assert.doesNotReject(async()=>{
    assert.equal(await getUserTimezone(7,async()=>{throw new Error("database unavailable")}),"Europe/Prague");
  });

  const source=read("lib/data/user-settings.ts");
  assert.match(source,/sql`SELECT timezone FROM user_settings WHERE user_id=\$\{userId\} LIMIT 1`/);
  assert.doesNotMatch(source,/\b(?:INSERT|UPDATE|DELETE|ALTER|CREATE|DROP)\b/i);
  assert.match(source,/catch\{\s*return FALLBACK_TIMEZONE;/);
});

test("v3.3 design batch 7 keeps timezone formatting independent from auth",()=>{
  const settings=read("lib/data/user-settings.ts");
  const display=read("lib/display-format.ts");
  assert.doesNotMatch(settings,/from ["']@\/lib\/auth|from ["']\.\.\/auth|from ["']\.\/auth/);
  assert.doesNotMatch(display,/from ["']@\/lib\/auth|from ["']\.\.\/auth|from ["']\.\/auth/);
  assert.match(settings,/sql`SELECT timezone FROM user_settings WHERE user_id=\$\{userId\} LIMIT 1`/);
  assert.doesNotMatch(settings,/\b(?:INSERT|UPDATE|DELETE)\b/i);
});

test("v3.3 design batch 7 wires viewer timezone without duplicate component reads",()=>{
  const notifications=read("app/(protected)/notifications/page.tsx");
  assert.match(notifications,/const\[rows,timeZone\]=await Promise\.all\(\[/);
  assert.match(notifications,/getUserTimezone\(userId\)/);
  assert.match(notifications,/formatLocalDateTime\(t\(row\.created_at\),timeZone\)/);

  const profile=read("app/(protected)/profile/page.tsx");
  assert.match(profile,/const\[auth,sessions,access,timeZone\]=await Promise\.all\(\[/);
  assert.match(profile,/getUserTimezone\(userId\)/);
  assert.match(profile,/formatLocalDateTime\(t\(item\.last_seen_at\),timeZone\)/);

  const credentials=read("app/(protected)/credentials/legacy-page.tsx");
  assert.match(credentials,/SELECT preferences_json,timezone FROM user_settings/);
  assert.match(credentials,/AircraftQualificationsSection timeZone=\{t\(settings\[0\]\?\.timezone\)\}/);

  const qualifications=read("components/aircraft-qualifications-section.tsx");
  assert.match(qualifications,/AircraftQualificationsSection\(\{timeZone\}:\{timeZone:string\}\)/);
  assert.match(qualifications,/formatLocalDateTime\(t\(row\.verified_at\),timeZone\)/);
  assert.doesNotMatch(qualifications,/getUserTimezone|user_settings/);

  const audit=read("components/flight-audit-panel.tsx");
  assert.match(audit,/FlightAuditPanel\(\{events,timeZone\}:\{events:FlightAuditEvent\[\];timeZone:string\}\)/);
  assert.match(audit,/formatLocalDateTime\(event\.changedAt,timeZone\)/);
  assert.doesNotMatch(audit,/getUserTimezone|user_settings|@\/lib\/db/);

  const detail=read("app/(protected)/flights/[id]/page.tsx");
  assert.doesNotMatch(detail,/FlightAuditPanel|getFlightAudit/);
});

test("v3.3 design batch 7 prevents bare en-GB date-time locale calls on touched runtime surfaces",()=>{
  const files=[
    "app/(protected)/dashboard/page.tsx",
    "app/(protected)/statistics/page.tsx",
    "app/(protected)/flights/page.tsx",
    "app/(protected)/flights/[id]/page.tsx",
    "app/(protected)/notifications/page.tsx",
    "app/(protected)/profile/page.tsx",
    "app/(protected)/credentials/legacy-page.tsx",
    "components/recency-panel.tsx",
    "components/aircraft-qualifications-section.tsx",
    "components/flight-audit-panel.tsx",
    "components/track-profile.tsx",
    "components/flight-track-player.tsx",
    "components/gps-import-review-player.tsx",
    "components/track-manager.tsx",
  ];
  for(const file of files){
    const source=read(file);
    assert.doesNotMatch(source,/\.toLocale(?:DateString|TimeString)\(\s*["']en-GB["']\s*\)/i,file);
    assert.doesNotMatch(source,/\.toLocale(?:DateString|TimeString)\(\s*["']en-GB["']\s*,\s*\{(?![^}]*timeZone\s*:)[^}]*\}\s*\)/i,file);
    assert.doesNotMatch(source,/new Date\([^;\n]*\)\.toLocaleString\(\s*["']en-GB["']\s*\)/i,file);
    assert.doesNotMatch(source,/new Date\([^;\n]*\)\.toLocaleString\(\s*["']en-GB["']\s*,\s*\{(?![^}]*timeZone\s*:)[^}]*\}\s*\)/i,file);
  }
});

test("v3.3 design batch 7b routes remaining date-only displays through formatDateOnly",()=>{
  const checks:Record<string,string[]>={
    "components/flight-trash.tsx":["formatDateOnly(flight.date)"],
    "components/aircraft-manager.tsx":["formatDateOnly(t(rate.valid_from))","formatDateOnly(t(item.current_price_valid_from))"],
    "components/dashboard-details.tsx":["formatDateOnly(row.lastDate)","formatDateOnly(row.firstDate)","formatDateOnly(row.date)"],
    "app/(protected)/connections/aircraft/[id]/page.tsx":["formatDateOnly(snapshot.currentRate.validFrom)"],
  };
  for(const [file,needles] of Object.entries(checks)){const source=read(file);for(const needle of needles)assert.ok(source.includes(needle),`${file}: ${needle}`)}
  const dashboard=read("lib/data/dashboard.ts");
  assert.match(dashboard,/new Date\(Date\.UTC\(today\.getUTCFullYear\(\),today\.getUTCMonth\(\)-12,today\.getUTCDate\(\)\+1\)\)/);
  assert.match(dashboard,/start:iso\(start\),end:iso\(today\),label:`\$\{formatDateOnly\(iso\(start\)\)\}–\$\{formatDateOnly\(iso\(today\)\)\}`/);
  assert.doesNotMatch(dashboard,/toLocaleDateString\(["']en-GB["']\)/);
});


test("v3.3 design batch 7b wires remaining local metadata to the signed-in viewer timezone once per page",()=>{
  const actions=read("app/(protected)/actions/page.tsx");
  assert.match(actions,/\[actions,timeZone\]=await Promise\.all\(\[getPendingActions\(userId\),getUserTimezone\(userId\)\]\)/);
  assert.match(actions,/formatLocalDateTime\(action\.createdAt,timeZone\)/);
  assert.equal((actions.match(/getUserTimezone\(/g)??[]).length,1);

  const admin=read("app/(protected)/admin/page.tsx");
  assert.match(admin,/\[users,health,invites,features,timeZone\]=await Promise\.all\(\[/);
  assert.match(admin,/getUserTimezone\(session\.userId\)/);
  assert.match(admin,/formatLocalDateTime\(health\.lastBackup,timeZone\)/);
  assert.match(admin,/formatLocalDateTime\(t\(invite\.expires_at\),timeZone\)/);
  assert.match(admin,/formatLocalDateTime\(t\(u\.last_login_at\),timeZone\)/);
  assert.equal((admin.match(/getUserTimezone\(/g)??[]).length,1);

  const data=read("app/(protected)/data/page.tsx");
  assert.match(data,/timeZonePromise=getUserTimezone\(userId\)/);
  assert.match(data,/const timeZone=await timeZonePromise/);
  assert.match(data,/DataHub view=\{view\} timeZone=\{timeZone\}/);
  assert.equal((data.match(/getUserTimezone\(/g)??[]).length,1);

  const hub=read("components/data-hub.tsx");
  assert.match(hub,/timeZone:string/);
  for(const component of ["BackupCenter","BackupRestore","FlightTrash"])assert.match(hub,new RegExp("<"+component+"[^>]*timeZone=\\{timeZone\\}"));

  const componentChecks:Record<string,string>={
    "components/backup-center.tsx":"formatLocalDateTime(backup.createdAt,timeZone)",
    "components/backup-restore.tsx":"formatLocalDateTime(preview.exportedAt,timeZone)",
    "components/flight-trash.tsx":"formatLocalDateTime(flight.deletedAt,timeZone)",
  };
  for(const [file,needle] of Object.entries(componentChecks)){
    const source=read(file);
    assert.ok(source.includes(needle),`${file}: ${needle}`);
    assert.doesNotMatch(source,/getUserTimezone|user_settings|@\/lib\/db/);
  }
});

test("v3.3 design batch 7b leaves no bare en-GB date-time locale calls on its audited metadata surfaces",()=>{
  const files=["app/(protected)/actions/page.tsx","app/(protected)/admin/page.tsx","components/backup-center.tsx","components/backup-restore.tsx","components/flight-trash.tsx"];
  for(const file of files){
    const source=read(file);
    assert.doesNotMatch(source,/new Date\([^;\n]*\)\.toLocaleString\(\s*["']en-GB["']\s*\)/i,file);
    assert.doesNotMatch(source,/\.toLocale(?:DateString|TimeString)\(\s*["']en-GB["']\s*\)/i,file);
  }
});

test("v3.3 design batch 9 gives root runtime errors retry and safe navigation without technical leakage",()=>{
  const source=read("app/error.tsx");
  assert.match(source,/^"use client";/);
  assert.equal((source.match(/<main\b/g)??[]).length,1);
  assert.equal((source.match(/<h1>/g)??[]).length,1);
  assert.match(source,/className="login-shell page-shell"/);
  assert.match(source,/className="panel ui-page-stack"/);
  assert.match(source,/<h1>Something went wrong<\/h1>/);
  assert.match(source,/FlyTally couldn’t load this page\./);
  assert.match(source,/>Try again<\/button>/);
  assert.match(source,/onClick=\{\(\)=>reset\(\)\}/);
  assert.match(source,/className="secondary-button" href="\/">Go to FlyTally<\/Link>/);
  assert.doesNotMatch(source,/error\.message|\.digest|\.stack|stack trace|technical detail/i);
  assert.equal(fs.existsSync(path.join(root,"app/global-error.tsx")),false);
  assert.equal(fs.existsSync(path.join(root,"app/(protected)/error.tsx")),false);
});

test("v3.3 design batch 11 exposes explicit offline state without adding offline data behavior",()=>{
  const pwa=read("components/pwa-client.tsx");
  const css=read("app/v300-push.css");
  const sw=read("public/sw.js");

  assert.match(pwa,/useState\(false\)/);
  assert.match(pwa,/setOffline\(!navigator\.onLine\)/);
  assert.match(pwa,/addEventListener\("online",syncConnectivity\)/);
  assert.match(pwa,/addEventListener\("offline",syncConnectivity\)/);
  assert.match(pwa,/removeEventListener\("online",syncConnectivity\)/);
  assert.match(pwa,/removeEventListener\("offline",syncConnectivity\)/);
  assert.match(pwa,/className="connection-status-banner" role="status" aria-live="polite"/);
  assert.match(pwa,/You&apos;re offline\. FlyTally needs a connection to load or save logbook data\./);

  const banner=css.match(/\.connection-status-banner\{([^}]*)\}/)?.[1]??"";
  assert.match(banner,/position:fixed/);
  assert.match(banner,/top:calc\(12px \+ env\(safe-area-inset-top\)\)/);
  assert.match(banner,/background:var\(--surface\)/);
  assert.match(banner,/border:1px solid var\(--line\)/);
  assert.match(banner,/border-radius:var\(--ui-radius-control\)/);
  assert.match(banner,/box-shadow:var\(--shadow-raised\)/);
  assert.match(banner,/pointer-events:none/);

  assert.match(sw,/FlyTally remains online-only/);
  assert.doesNotMatch(sw,/addEventListener\("fetch"/);
  assert.doesNotMatch(sw,/respondWith\(/);
});

