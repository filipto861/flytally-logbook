import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root=path.resolve(import.meta.dirname,"..");
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");

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
