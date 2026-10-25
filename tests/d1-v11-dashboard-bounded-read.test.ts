import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root=path.resolve(import.meta.dirname,"..");
const read=(p:string)=>fs.readFileSync(path.join(root,p),"utf8");

test("D1-V11 does not invoke unbounded Statistics aggregation",()=>{
  const page=read("app/(protected)/dashboard/page.tsx");
  const monthly=read("lib/data/dashboard-pace.ts");
  assert.match(page,/getDashboardOverviewData\(session\.userId,"all"\)/);
  assert.match(page,/!classic\?getDashboardPaceData\(session\.userId,asOf\):Promise\.resolve\(null\)/);
  assert.match(page,/const classic=params\.view==="classic"/);
  assert.match(page,/if\(!classic\)/);
  assert.doesNotMatch(page,/getDashboardData\(/);
  assert.doesNotMatch(monthly,/\bgetDashboardData\(/, "bounded module must not call heavy Statistics data");
  assert.match(monthly,/WHERE f\.user_id=\$\{userId\}/, "new read must be user-scoped");
  assert.match(monthly,/f\.date>=\$\{startDate\}/);
  assert.match(monthly,/f\.date<\$\{endExclusive\}/);
  assert.match(monthly,/dashboard-pace-25-month/);
  assert.doesNotMatch(monthly,/f\.date::text\s*[<>]=?/, "date filter must remain index-eligible");
  assert.doesNotMatch(monthly,/top_airports|top_aircraft|top_routes|yearly/, "no unrelated Analytics aggregates");
});

test("D1-V11 bounded categories mirror existing role, safety pilot and flight duration contracts",()=>{
  const original=read("lib/data/dashboard.ts");
  const bounded=read("lib/data/dashboard-pace.ts");
  for(const piece of [
    "role NOT IN ('PAX','OBSERVER')",
    "role IN ('SAFETY PILOT','PAX','OBSERVER')",
    "WHEN role='SAFETY PILOT' THEN block_minutes ELSE logged_minutes",
    "WHEN resolved_category IN ('SAILPLANE','BALLOON')",
    "WHERE NOT auxiliary AND evidence='ULL'",
    "WHERE NOT auxiliary AND evidence='EASA'",
    "INSTRUKTOR",
    "STUDENT",
  ]) {
    assert.ok(bounded.includes(piece),`missing bounded formula: ${piece}`);
    assert.ok(original.includes(piece),`bounded formula not grounded in original: ${piece}`);
  }
  assert.match(bounded,/valid_date AND date_key<=\$\{currentDate\}/);
  assert.match(bounded,/NOT valid_date\) invalid_window_dates/);
  assert.match(bounded,/TO_CHAR\(TO_DATE\(date_key,'YYYY-MM-DD'\),'YYYY-MM-DD'\)=date_key/);
});

test("D1-V11 default retains persisted Classic rollback and last canonical stylesheet",()=>{
  const page=read("app/(protected)/dashboard/page.tsx");
  const layout=read("app/layout.tsx");
  assert.match(page,/dashboardLayoutFromPreferences\(preferences\)/);
  assert.match(page,/<DashboardEditor layout=\{layout\}\/>/);
  assert.match(page,/<DashboardEditorial data=\{data\}/);
  assert.doesNotMatch(page,/Preview new Dashboard|Classic dashboard/);
  assert.ok(layout.indexOf('import "./dashboard-editorial.css"')<
            layout.indexOf('import "./ui-system.css"'));
});

test("D1-V11 slider has source-level keyboard and focus semantics",()=>{
  const plot=read("components/dashboard-pace.tsx");
  assert.match(plot,/role="slider"/);
  assert.match(plot,/tabIndex=\{0\}/);
  assert.match(plot,/aria-valuemin/);
  assert.match(plot,/aria-valuemax/);
  assert.match(plot,/aria-valuenow/);
  assert.match(plot,/aria-valuetext/);
  assert.match(plot,/event\.key==="Home"/);
  assert.match(plot,/event\.key==="End"/);
  assert.match(plot,/event\.key==="ArrowLeft"/);
  assert.match(plot,/event\.key==="ArrowRight"/);
  const css=read("app/dashboard-editorial.css");
  assert.match(css,/\.d1v11-page :is\(a,button,\[role="slider"\]\):focus-visible/);
});

test("D1-V11 shows only active user-owned recorded licence dates without claiming live privileges",()=>{
  const page=read("app/(protected)/dashboard/page.tsx");
  const editorial=read("components/dashboard-editorial.tsx");
  const css=read("app/dashboard-editorial.css");
  assert.match(page,/FROM pilot_licences WHERE user_id=\$\{session\.userId\} AND active=TRUE/);
  assert.match(page,/classic\?Promise\.resolve\(\[\]\):sql/,"Classic must not gain the new read");
  assert.match(page,/SELECT id,licence_type,validity_mode,valid_until::text AS valid_until,recency_until::text AS recency_until/);
  assert.match(page,/licences=\{licences\} asOf=\{asOf\.toISOString\(\)\.slice\(0,10\)\}/);
  assert.match(editorial,/Recorded licences/);
  assert.match(editorial,/No active licences recorded/);
  assert.match(editorial,/Validity not recorded/);
  assert.match(editorial,/Expiry not recorded/);
  assert.match(editorial,/Recency date not recorded/);
  assert.match(editorial,/\["LAPL\(A\)","LAPL\(H\)"\]/,"LAPL recorded indefinite expiry must stay separate from current recency");
  assert.match(editorial,/isRecordedDay\(date\)/,"unverified or malformed dates cannot acquire a positive label");
  assert.match(editorial,/!date\.startsWith\("0000"\)/,"year zero cannot become an ordinary expiry");
  assert.match(editorial,/date passed/,"past dates must have a textual warning beyond color");
  assert.match(editorial,/href="\/credentials\?view=licences"/);
  assert.doesNotMatch(editorial,/\bCURRENT\b|\bCOMPLIANT\b/,"Dashboard licence rows must not infer privilege clearance");
  assert.match(css,/\.d1v11-licences-list li/);
  assert.match(css,/@media\(max-width:380px\).*?\.d1v11-licences-list li/s);
});
