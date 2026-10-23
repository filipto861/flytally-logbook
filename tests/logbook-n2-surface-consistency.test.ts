import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root=path.resolve(import.meta.dirname,"..");
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");

test("N2-A is scoped to protected informational cards and dashboard widgets",()=>{
  const css=read("app/ui-system.css");
  const start=css.indexOf("/* N2-A — shared informational surface / action hierarchy.");
  assert.ok(start>0,"N2-A stylesheet contract missing");
  const n2=css.slice(start);
  assert.match(n2,/\.app-grid \.shell-workspace > \.ui-page-stack > :is\(\.panel,\.table-panel\)/);
  assert.match(n2,/\.app-grid \.shell-workspace > \.ui-page-stack > \.metric-grid > \.metric/);
  assert.match(n2,/\.app-grid \.shell-workspace \.dashboard-layout-grid > \.dashboard-widget > :is\(\.metric,\.panel\)/);
  assert.match(n2,/background:var\(--surface\)/);
  assert.match(n2,/border-radius:var\(--ui-radius-card\)/);
  assert.match(n2,/padding:var\(--ui-card-padding\)/);
  assert.match(n2,/padding:var\(--ui-card-padding-mobile\)/);
  assert.doesNotMatch(n2,/\.flight-form|\.credentials-overview-card|\.map-panel|\.track-player-suite|\.flight-review-card|\.record-protection-actions|\.delete-button/);
});

test("N2-A retains readable type, focus and theme-aware section actions",()=>{
  const css=read("app/ui-system.css").split("/* N2-A — shared informational surface / action hierarchy.")[1];
  assert.ok(css);
  assert.match(css,/font-variant-numeric:tabular-nums/);
  assert.match(css,/\.panel > \.section-heading h2/);
  assert.match(css,/\.panel > \.section-heading \.muted/);
  assert.match(css,/min-height:44px/);
  assert.match(css,/var\(--ui-radius-control\)/);
  assert.match(css,/outline:2px solid var\(--focus-color\)/);
  assert.match(css,/@media \(max-width:820px\)/);
  assert.match(css,/@media \(max-width:600px\)/);
  assert.match(css,/@media print/);
  assert.doesNotMatch(css,/(?:^|\n)\s*(?:html\[data-theme|body\s*\{)/);
  assert.doesNotMatch(css,/animation:|transition:all|backdrop-filter:/);
});

test("N2-A does not rewrite existing flight, statistics or dashboard calculations",()=>{
  const dashboard=read("app/(protected)/dashboard/page.tsx");
  const statistics=read("app/(protected)/statistics/page.tsx");
  const flights=read("app/(protected)/flights/page.tsx");
  assert.match(dashboard,/className="dashboard-layout-grid"/);
  assert.match(dashboard,/className="metric category-card"/);
  assert.match(statistics,/className="metric-grid"/);
  assert.match(statistics,/className="metric"/);
  assert.match(flights,/className="ui-page-stack"/);
  const css=read("app/ui-system.css");
  assert.ok(css.indexOf("/* N2-A — shared informational surface / action hierarchy.")>css.indexOf("/* N1 V2-2 — protected-app masthead only;"));
});


test("N2-A2 changes dashboard presentation without changing saved widget layout",()=>{
  const dashboard=read("app/(protected)/dashboard/page.tsx");
  const source=read("app/ui-system.css");
  const start=source.indexOf("/* N2-A2 — visible hierarchy pass after owner review of N2-A.");
  assert.ok(start>0);
  const n2=source.slice(start);
  assert.match(dashboard,/visibleLayout\.map\(item=>/);
  assert.match(dashboard,/data-dashboard-widget=\{item\.id\}/);
  assert.match(dashboard,/data-dashboard-size=\{item\.size\}/);
  assert.match(dashboard,/className="panel dashboard-quick-actions-panel"/);
  assert.match(n2,/\.dashboard-widget > \.hero-metric/);
  assert.match(n2,/\.dashboard-widget > \.category-card/);
  assert.match(n2,/\.dashboard-widget > a\.dashboard-quick-card/);
  assert.match(n2,/\.dashboard-quick-actions-panel > \.mini-metrics/);
  assert.match(n2,/grid-template-columns:repeat\(auto-fit,minmax\(min\(100%,206px\),1fr\)\)/);
  assert.doesNotMatch(n2,/\.dashboard-size-(small|medium|wide|hero)\s*\{/);
});

test("N2-A2 scopes statistics and flight summaries to the correct pages",()=>{
  const stats=read("app/(protected)/statistics/page.tsx");
  const flights=read("app/(protected)/flights/page.tsx");
  const css=read("app/ui-system.css").split("/* N2-A2 — visible hierarchy pass after owner review of N2-A.")[1];
  assert.ok(css);
  assert.match(stats,/className="ui-page-stack" data-n2-layout="statistics"/);
  assert.match(flights,/className="ui-page-stack" data-n2-layout="flights"/);
  assert.match(css,/data-n2-layout="statistics"\] > \.metric-grid/);
  assert.match(css,/data-n2-layout="flights"\] > \.flight-summary/);
  assert.match(css,/grid-template-columns:repeat\(12,minmax\(0,1fr\)\)/);
  assert.match(css,/grid-template-columns:repeat\(5,minmax\(0,1fr\)\)/);
  assert.match(css,/@media\(max-width:820px\)/);
  assert.match(css,/@media\(max-width:430px\)/);
  assert.match(css,/@media print/);
  assert.doesNotMatch(css,/\.flight-list-row|\.flight-form|\.map-panel|\.credential-summary|\.period-control|\.flight-search-form/);
  assert.doesNotMatch(css,/animation:|transition:all|backdrop-filter:/);
});
