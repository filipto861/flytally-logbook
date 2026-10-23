import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root=path.resolve(import.meta.dirname,"..");
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");
const n2b=()=>{
  const css=read("app/ui-system.css");
  const start="/* N2-B — purposeful workspace composition instead of more nested card chrome.";
  const end="/* N2-C — native calendar range within the approved Statistics filter station.";
  const begin=css.indexOf(start),finish=css.indexOf(end,begin+start.length);
  assert.ok(begin>=0&&finish>begin,"N2-B and its next section boundary must both exist");
  return css.slice(begin+start.length,finish);
};

test("N2-B Dashboard groups existing widgets beside shortcuts without replacing saved layout",()=>{
  const page=read("app/(protected)/dashboard/page.tsx");
  assert.match(page,/className="dashboard-home-layout"/);
  assert.match(page,/className="dashboard-main-column"/);
  assert.match(page,/className="dashboard-layout-grid" aria-label="Dashboard overview"/);
  assert.match(page,/visibleLayout\.map\(item=>/);
  assert.match(page,/data-dashboard-widget=\{item\.id\}/);
  assert.match(page,/data-dashboard-size=\{item\.size\}/);
  assert.match(page,/dashboardLayoutFromPreferences\(preferences\)/);
  assert.match(page,/className="panel dashboard-quick-actions-panel"/);
  assert.match(page,/href="\/flights\/new"/);
  assert.match(page,/href="\/statistics\?period=all&section=overview"/);
  assert.match(page,/href="\/data"/);
  const css=n2b();
  assert.ok(css);
  assert.match(css,/\.dashboard-home-layout\{[\s\S]*?grid-template-columns:minmax\(0,1fr\) minmax\(300px,330px\)/);
  assert.match(css,/\.dashboard-home-layout > \.dashboard-main-column/);
  assert.match(css,/\.dashboard-home-layout > \.dashboard-quick-actions-panel/);
  assert.match(css,/Only the original links are clickable/);
  assert.doesNotMatch(css,/\.dashboard-size-(?:hero|medium|wide|small)\s*\{/);
});

test("N2-B Statistics consolidates existing category period and analysis URL navigation",()=>{
  const page=read("app/(protected)/statistics/page.tsx");
  assert.match(page,/className="statistics-explorer" aria-label="Explore statistics"/);
  assert.match(page,/className="statistics-filter-group statistics-filter-category"/);
  assert.match(page,/className="statistics-filter-group statistics-filter-period"/);
  assert.match(page,/className="statistics-filter-group statistics-filter-section"/);
  assert.match(page,/aria-label="Statistics category"/);
  assert.match(page,/aria-label="Statistics period"/);
  assert.match(page,/aria-label="Statistics section"/);
  assert.match(page,/statisticsHref\(period,section,key,customRange\)/);
  assert.match(page,/statisticsHref\(key,section,category\)/);
  assert.match(page,/statisticsHref\(period,key,category,customRange\)/);
  assert.match(page,/section!=="career"/);
  assert.match(page,/aria-current=\{category===key\?"page":undefined\}/);
  assert.match(page,/aria-current=\{period===key\?"page":undefined\}/);
  assert.match(page,/aria-current=\{section===key\?"page":undefined\}/);
  const css=n2b();
  assert.ok(css);
  assert.match(css,/data-n2-layout="statistics"\] > \.statistics-explorer/);
  assert.match(css,/\.statistics-explorer \.period-control/);
  assert.match(css,/overflow-x:auto/);
  assert.match(css,/min-height:44px/);
});

test("N2-B responds to tablet/mobile, keeps scope and avoids extra motion",()=>{
  const css=n2b();
  assert.ok(css);
  assert.match(css,/@media\(max-width:1499px\)/);
  assert.match(css,/@media\(max-width:700px\)/);
  assert.match(css,/@media\(pointer:coarse\)/);
  assert.match(css,/@media print/);
  assert.match(css,/background:var\(--surface\)/);
  assert.match(css,/color:var\(--text-soft\)/);
  assert.match(css,/outline:2px solid var\(--focus-color\)/);
  assert.doesNotMatch(css,/\.flight-form|\.flight-review-card|\.map-panel|\.certified-|\.flight-list-row|\.record-protection-actions/);
  assert.doesNotMatch(css,/animation:|transition:all|backdrop-filter/);
  assert.doesNotMatch(css,/background:\s*#[0-9a-f]+|color:\s*#[0-9a-f]+/i);
});
