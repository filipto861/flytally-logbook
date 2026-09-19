import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root=path.resolve(import.meta.dirname,"..");
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");

test("v3.2 U7 brings remaining core routes onto the canonical page stack",()=>{
  const routes=[
    "app/(protected)/statistics/page.tsx",
    "app/(protected)/credentials/page.tsx",
    "app/(protected)/map/page.tsx",
    "app/(protected)/fstd/page.tsx",
    "app/(protected)/actions/page.tsx",
    "app/(protected)/notifications/page.tsx",
    "app/(protected)/flights/new/page.tsx",
  ];
  for(const route of routes)assert.match(read(route),/ui-page-stack/,route);
  const css=read("app/ui-system.css");
  for(const selector of [".period-control",".metric-grid",".flight-summary",".saved-next-flight",".map-panel"])assert.ok(css.includes(selector),selector);
  assert.match(css,/page-header > \.connection-actions/);
});

test("v3.2 U7 gives FSTD mutations explicit pending feedback",()=>{
  const source=read("app/(protected)/fstd/page.tsx");
  assert.match(source,/PendingActionButton/);
  for(const label of ["Saving…","Opening…","Certifying…","Deleting…"])assert.ok(source.includes(`pendingLabel="${label}"`),label);
  assert.doesNotMatch(source,/<button className="primary-button">Save FSTD session<\/button>/);
});

test("v3.2 U7 gives action and notification mutations explicit pending feedback",()=>{
  const actions=read("app/(protected)/actions/page.tsx");
  const notifications=read("app/(protected)/notifications/page.tsx");
  for(const source of [actions,notifications])assert.match(source,/PendingActionButton/);
  for(const label of ["Accepting…","Declining…"])assert.ok(actions.includes(`pendingLabel="${label}"`),label);
  for(const label of ["Marking…","Clearing…","Declining…","Deleting…"])assert.ok(notifications.includes(`pendingLabel="${label}"`),label);
});

test("v3.2 U7 converges remaining high-frequency async actions on the shared loading contract",()=>{
  for(const file of ["components/flight-form.tsx","components/kml-import-form.tsx","components/backup-center.tsx"]){
    assert.match(read(file),/PendingActionButton/,file);
  }
  for(const file of ["components/backup-restore.tsx","components/flight-trash.tsx","components/quick-aircraft-form.tsx","components/push-notification-controls.tsx"]){
    const source=read(file);
    assert.match(source,/aria-busy=/,file);
    assert.match(source,/data-loading=/,file);
  }
});



test("v3.3 design batch 1 converges canonical geometry without changing the card-radius token",()=>{
  const ui=read("app/ui-system.css");
  const globals=read("app/globals.css");
  const adaptive=read("app/v160-adaptive-pilot-workspace.css");
  const recency=read("app/v250-recency-workspace.css");

  assert.match(ui,/--ui-radius-card:17px/);
  assert.match(globals,/\.page-header \{[^}]*margin-bottom:var\(--ui-section-gap\)/);
  assert.match(globals,/\.metric-grid \{[^}]*gap:var\(--ui-card-gap\)[^}]*margin-bottom:var\(--ui-section-gap\)/);
  assert.match(globals,/\.panel \{ padding:var\(--ui-card-padding\); \}/);
  assert.match(globals,/\.flight-form \{ display:grid;gap:var\(--ui-section-gap\); \}/);
  assert.match(globals,/\.form-grid \{[^}]*gap:var\(--ui-card-gap\)/);

  for(const source of [adaptive,recency]){
    assert.doesNotMatch(source,/font-size:(?:10|11|12|13|15)px/);
    assert.doesNotMatch(source,/border-radius:18px/);
  }
  assert.match(adaptive,/\.adaptive-workspace\{display:grid;gap:var\(--ui-card-gap\)/);
  assert.match(recency,/\.compliance-workspace\{display:grid;gap:var\(--ui-card-gap\)/);
  assert.match(recency,/box-shadow:var\(--shadow-soft\)/);
});

test("v3.3 design batch 1 centralizes recurring light compatibility colors",()=>{
  const colors=read("app/v150-ui-system.css");
  const theme=read("app/theme.css");
  const interactions=read("app/light-interactions.css");

  assert.match(colors,/--light-surface-hover-strong:#eef4f8/);
  assert.match(colors,/--light-border-hover-subtle:#b8c9d7/);
  assert.doesNotMatch(theme,/--panel:#ffffff/);
  for(const source of [theme,interactions]){
    assert.doesNotMatch(source,/#eef4f8(?![0-9a-f])/i);
    assert.doesNotMatch(source,/#f3f7fa(?![0-9a-f])/i);
    assert.doesNotMatch(source,/#b8c9d7(?![0-9a-f])/i);
  }
});

test("v3.3 design batch 1 standardizes motion and tabular figures",()=>{
  const globals=read("app/globals.css");
  const dashboard=read("app/v138-dashboard-insights.css");
  const credentials=read("app/v146-credentials.css");
  const sharing=read("app/v300-aircraft-sharing.css");
  const ui=read("app/ui-system.css");
  const stats=read("app/(protected)/statistics/page.tsx");

  assert.match(globals,/transition:width \.14s ease/);
  assert.match(globals,/transition:transform \.08s linear/);
  assert.doesNotMatch(dashboard,/\.15s ease/);
  assert.doesNotMatch(credentials,/\.15s ease/);
  assert.doesNotMatch(sharing,/\.16s ease/);
  for(const selector of [".time-pair",".pagination",".page-number-list",".track-stats",".rate-history-row",".numeric-table"])assert.ok(ui.includes(selector),selector);
  assert.match(stats,/className="numeric-table"/);
});
