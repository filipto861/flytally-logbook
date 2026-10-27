import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root=path.resolve(import.meta.dirname,"..");
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");

test("3.5.4 keeps wider flight-detail navigation on one row",()=>{
  const page=read("app/(protected)/flights/[id]/page.tsx");
  const css=read("app/ui-system.css");

  assert.match(page,/className="page-header flight-detail-header"/);
  assert.match(css,/\.flight-detail-navigation\{[\s\S]*?flex-wrap:nowrap;[\s\S]*?flex:0 0 auto;/);
  assert.match(css,/\.flight-detail-more\{position:relative;flex:0 0 auto\}/);
});

test("3.5.4 moves the whole navigation group below identity on narrower tablets",()=>{
  const css=read("app/ui-system.css");

  assert.match(css,/@media\(max-width:1180px\)\{[\s\S]*?\.flight-detail-header\{[\s\S]*?display:grid;[\s\S]*?grid-template-columns:minmax\(0,1fr\)/);
  assert.match(css,/@media\(max-width:1180px\)\{[\s\S]*?\.flight-detail-navigation\{[\s\S]*?width:100%;[\s\S]*?justify-content:flex-start/);
  assert.match(css,/@media\(max-width:700px\)\{[\s\S]*?\.flight-detail-navigation\{[\s\S]*?display:grid/);
  assert.match(css,/@media\(max-width:700px\)\{[\s\S]*?\.flight-detail-step-group\{[\s\S]*?grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
});

test("3.5.4 fully hides the skip link until keyboard focus",()=>{
  const css=read("app/ui-system.css");
  const layout=read("app/layout.tsx");

  assert.ok(layout.indexOf('import "./ui-system.css"')>layout.indexOf('import "./v300-u6-acceptance.css"'));
  assert.match(css,/\.skip-link:not\(:focus\):not\(:focus-visible\)\{[\s\S]*?width:1px;[\s\S]*?height:1px;[\s\S]*?clip-path:inset\(50%\);[\s\S]*?border:0;[\s\S]*?transform:none/);
  assert.match(css,/\.skip-link:focus,[\s\S]*?\.skip-link:focus-visible\{[\s\S]*?width:auto;[\s\S]*?height:auto;[\s\S]*?clip-path:none;[\s\S]*?border:2px solid var\(--accent2\);[\s\S]*?transform:none/);
});

test("F3 shows the route first and separates complete BLOCK/AIR clocks without changing logged-time rules",()=>{
  const page=read("app/(protected)/flights/[id]/page.tsx");
  const summary=read("components/flight-detail-overview.tsx");
  const css=read("app/flight-detail-f3.css");
  const layout=read("app/layout.tsx");
  assert.match(page,/className="flight-f3-heading"/);
  assert.match(page,/flight\.departure\|\|"—"\} → \{flight\.arrival\|\|"—"/);
  assert.match(page,/<FlightDetailOverview blockMinutes=\{flight\.block_minutes\} airMinutes=\{flight\.air_minutes\}/);
  assert.match(summary,/completePair\(offBlock,onBlock\)/);
  assert.match(summary,/completePair\(takeoff,landing\)/);
  assert.match(summary,/blockKnown\?formatDuration\(blockMinutes\):"—"/);
  assert.match(summary,/airKnown\?formatDuration\(airMinutes\):"—"/);
  assert.match(summary,/landingCount=Number\.isSafeInteger\(landings\)/);
  assert.match(summary,/trackTotal>0&&Number\.isFinite\(gpsKm\)/);
  assert.ok(layout.indexOf('import "./flight-detail-f3.css"')>layout.indexOf('import "./ui-system.css"'));
  for(const name of ["flight-f3-time-grid","flight-f3-clock-pair","flight-f3-facts"])assert.ok(css.includes(name),name);
  for(const width of ["max-width:900px","max-width:700px","max-width:360px"])assert.ok(css.includes(width),width);
  for(const preserved of ["certifyFlight.bind","startCertifiedCorrection.bind","ReadonlyLogbookEntry","<FlightForm","crewPanel","LazyFlightTrackReview","TrackManager"])assert.ok(page.includes(preserved),preserved);
});

test("F3 cancelled unsaved tab switch cannot move keyboard focus to an unselected tab",()=>{
  const tabs=read("components/flight-detail-workspace.tsx");
  assert.match(tabs,/const selectTab=\(value:Tab\):boolean=>/);
  assert.match(tabs,/if\(submitting\)return false/);
  assert.match(tabs,/if\(unsaved&&!window\.confirm\([^\n]+\)\)return false/);
  assert.match(tabs,/if\(selectTab\(nextTab\)\)document\.getElementById/);
  assert.match(tabs,/role="tablist"/);
  assert.match(tabs,/role="tabpanel"/);
});


test("F3.1 keeps certified status above optional expenses and never blends an unqualified aircraft rate into personal totals",()=>{
  const page=read("app/(protected)/flights/[id]/page.tsx");
  const standalone=read("components/flight-expenses-standalone.tsx");
  const editor=read("components/flight-expenses-editor.tsx");

  const overview=page.indexOf("<FlightDetailOverview ");
  const status=page.indexOf('flight-lock-panel');
  const expenses=page.indexOf("<FlightExpensesStandalone ");
  assert.ok(overview>=0&&overview<status&&status<expenses,
    "F3 overview must lead with BLOCK/AIR, then status, then optional personal expenses");
  assert.match(page,/<FlightExpensesStandalone action=\{saveExpenses\} initial=\{expenses\}\/>/);
  assert.doesNotMatch(standalone,/aircraftCost=\{aircraftCost\}/);
  assert.match(standalone,/<FlightExpensesEditor initial=\{initial\} defaultCurrency=\{defaultCurrency\}\/>/);
  assert.match(editor,/costTotalsLabel\(parsed\.data\.map/);
  assert.match(page,/calculateSupportedCurrencyFlightCost\(/);
  assert.match(page,/currencyRateLabel/);
});

test("F3.1 uses native keyboard-operable personal-expense disclosure and never hides save feedback",()=>{
  const panel=read("components/flight-expenses-standalone.tsx");
  const css=read("app/flight-detail-f3.css");
  const layout=read("app/layout.tsx");

  assert.match(panel,/<details ref=\{detailsRef\} className="panel flight-expense-panel flight-f3-expenses">/);
  assert.match(panel,/<summary className="flight-f3-expenses-summary">/);
  assert.match(panel,/count===0\?"No additional expenses"/);
  assert.match(panel,/if\(state\.error\|\|state\.success\)detailsRef\.current\?\.setAttribute\("open",""\)/);
  assert.match(panel,/<form action=\{formAction\} className="expense-standalone-form">/);
  assert.match(panel,/state\.error\?<p className="form-error" role="alert">/);
  assert.match(panel,/state\.success\?<p className="form-success" role="status">/);
  assert.match(panel,/<PendingActionButton className="primary-button" pendingLabel="Saving expenses…">Save expenses<\/PendingActionButton>/);
  assert.ok(layout.indexOf('import "./flight-detail-f3.css"')>layout.indexOf('import "./ui-system.css"'));
  assert.match(css,/\.flight-f3-expenses > summary:focus-visible/);
  assert.match(css,/@media\(max-width:700px\)/);
  assert.doesNotMatch(css,/transition:\s*all/);
});

test("F3.1 improves small flight-detail labels with scoped CSS and unchanged BLOCK/AIR data semantics",()=>{
  const css=read("app/flight-detail-f3.css");
  const overview=read("components/flight-detail-overview.tsx");
  for(const selector of [
    ".flight-detail-header .flight-f3-meta",
    ".flight-f3-time-heading small",
    ".flight-f3-clock-pair dt",
    ".flight-f3-fact p",
    ".flight-detail-workspace .flight-workflow p",
  ])assert.ok(css.includes(selector),selector);
  assert.match(overview,/completePair\(offBlock,onBlock\)/);
  assert.match(overview,/completePair\(takeoff,landing\)/);
  assert.match(overview,/blockKnown\?formatDuration\(blockMinutes\):"—"/);
  assert.match(overview,/airKnown\?formatDuration\(airMinutes\):"—"/);
});


test("F3.2 compacts phone navigation without changing desktop layout, action order or tap sizes",()=>{
  const css=read("app/flight-detail-f3.css");
  const page=read("app/(protected)/flights/[id]/page.tsx");
  const layout=read("app/layout.tsx");
  const scoped=css.slice(css.indexOf("/* F3.2 — compact phone-only"));
  assert.match(scoped,/@media screen and \(max-width:700px\)\{/);
  assert.match(scoped,/\.app-grid \.shell-workspace > \.flight-detail-header\{[\s\S]*?padding:13px 14px 14px/);
  assert.match(scoped,/\.flight-detail-header \.flight-detail-navigation\{[\s\S]*?grid-template-columns:minmax\(0,1fr\) auto/);
  assert.match(scoped,/\.flight-detail-header \.flight-detail-back\{grid-column:1\/-1\}/);
  assert.match(scoped,/\.flight-detail-header \.flight-detail-step-group\{[\s\S]*?grid-column:1;/);
  assert.match(scoped,/\.flight-detail-header \.flight-detail-more\{[\s\S]*?grid-column:2;/);
  assert.match(scoped,/\.flight-detail-header \.flight-detail-more > summary\{[\s\S]*?min-height:44px/);
  const back=page.indexOf('className="secondary-button flight-detail-back"');
  const previous=page.indexOf('className="secondary-button flight-detail-step"');
  const more=page.indexOf('className="flight-detail-more"');
  assert.ok(back>=0&&previous>back&&more>previous,"DOM/tab focus order stays Back, previous/next, More");
  assert.ok(layout.indexOf('import "./flight-detail-f3.css"')>layout.indexOf('import "./ui-system.css"'));
  assert.doesNotMatch(scoped,/(?:display:none|visibility:hidden|position:fixed|transition:all)/);
});

test("F3.2 retains Saved/Review/Certify/Share semantics with compact mobile workflow",()=>{
  const css=read("app/flight-detail-f3.css");
  const workflow=read("components/flight-workflow-progress.tsx");
  const scoped=css.slice(css.indexOf("/* F3.2 — compact phone-only"));
  assert.match(scoped,/\.flight-detail-workspace \.flight-workflow-steps\{[\s\S]*?grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
  assert.match(scoped,/\.flight-detail-workspace \.flight-workflow-step\{[\s\S]*?flex-direction:row;[\s\S]*?min-height:44px/);
  assert.match(scoped,/@media screen and \(max-width:360px\)\{[\s\S]*?\.flight-detail-workspace \.flight-workflow-step\{[\s\S]*?flex-direction:column/);
  for(const stage of ["Saved","Review","Certify","Share"])assert.ok(workflow.includes('stage("'+stage+'"'),stage);
  assert.match(workflow,/state\.certified\?<Link className="primary-button" href=\{state\.shareHref\}>Share flight<\/Link>/);
  assert.match(workflow,/certificationBlocked=draft&&\(state\.locked\|\|state\.blockers>0\)/);
});

test("F3.2 opaque sticky tabs preserve shell safe-area offset, focus and anchored tab content",()=>{
  const css=read("app/flight-detail-f3.css");
  const globals=read("app/globals.css");
  const detail=read("components/flight-detail-workspace.tsx");
  const scoped=css.slice(css.indexOf("/* F3.2 — compact phone-only"));
  assert.match(scoped,/\.flight-detail-workspace \.detail-tabs\{[\s\S]*?background:var\(--panel\);[\s\S]*?backdrop-filter:none;[\s\S]*?-webkit-backdrop-filter:none;/);
  assert.match(scoped,/\.flight-detail-workspace \.detail-tab-content\{[\s\S]*?scroll-margin-top:calc\(var\(--mobile-shell-height,64px\) \+ env\(safe-area-inset-top\) \+ 80px\)/);
  assert.match(globals,/\.detail-tabs\{top:calc\(var\(--mobile-shell-height\) \+ env\(safe-area-inset-top\) \+ 6px\)\}/);
  assert.match(detail,/role="tablist"/);
  assert.match(detail,/aria-selected=\{tab===value\}/);
  assert.match(detail,/role="tabpanel"/);
  assert.match(css,/\.flight-detail-workspace \.detail-tabs button:focus-visible/);
});
