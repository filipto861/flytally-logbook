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


test("D1-V11 four category overview keeps account-scoped source reads and rollback",()=>{
  const page=read("app/(protected)/dashboard/page.tsx");
  const view=read("components/dashboard-editorial.tsx");
  const summary=read("lib/dashboard-credential-overview.ts");
  const css=read("app/dashboard-editorial.css");
  assert.match(page,/FROM pilot_licences WHERE user_id=\$\{session\.userId\} AND active=TRUE/);
  assert.match(page,/FROM pilot_qualifications q JOIN pilot_licences l ON l.id=q.licence_id AND l.user_id=q.user_id/);
  assert.match(page,/WHERE q.user_id=\$\{session\.userId\} AND q.active=TRUE AND l.active=TRUE/);
  assert.match(page,/COALESCE\(q.record_kind,\x27\x27\)<>\x27aircraft_training\x27/);
  assert.match(page,/FROM user_expiries\s+WHERE user_id=\$\{session\.userId\} AND active=1/);
  assert.match(page,/UPPER\(TRIM\(category\)\)<>\x27LICENCE\x27/);
  assert.equal((page.match(/classic\?Promise\.resolve\(\[\]\):sql/g)||[]).length,3);
  assert.match(page,/qualifications=\{qualifications\} documents=\{documents\}/);
  assert.match(view,/role="group" aria-label="Recorded credentials overview"/);
  assert.match(view,/label:"LICENCES"/);
  assert.match(view,/label:"RATINGS"/);
  assert.match(view,/label:"DOCUMENTS"/);
  assert.match(view,/label:"MEDICAL"/);
  assert.equal((view.match(/d1v11-credential-row/g)||[]).length,1);
  assert.match(view,/credentialCategories\.map\(category=>/);
  assert.match(view,/href:"\/credentials\?view=licences"/);
  assert.match(view,/href:"\/credentials\?view=documents"/);
  assert.match(view,/category\.summary\.reviewCount/);
  assert.doesNotMatch(view,/licencePreview|qualificationPreview|medicalPreview|previewLimits/);
  assert.doesNotMatch(view,/\bCURRENT\b|\bCOMPLIANT\b/);
  assert.match(summary,/partitionCredentialDocuments/);
  assert.match(summary,/!day\.startsWith\("0000"\)/);
  assert.match(summary,/validityMode/);
  assert.match(css,/\.d1v11-credential-row\{[^}]*min-height:74px/);
  assert.match(css,/@media\(max-width:380px\).*?\.d1v11-credential-row/s);
});
