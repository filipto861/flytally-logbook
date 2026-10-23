import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root=path.resolve(import.meta.dirname,"..");
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");

test("N2-C custom date picker applies only after explicit submission",()=>{
  const page=read("app/(protected)/statistics/page.tsx");
  assert.equal((page.match(/<header className="page-header">/g)??[]).length,1,"Statistics must render one shared masthead");
  assert.equal((page.match(/\{header\}/g)??[]).length,2,"Both invalid and valid paths use that masthead");
  assert.match(page,/className="statistics-custom-range"/);
  assert.match(page,/className="statistics-period-toolbar"/);
  assert.match(page,/<nav className="period-control" aria-label="Statistics period">/);
  assert.match(page,/<details className="statistics-custom-range" data-selected=\{period==="custom"\?"true":undefined\}>/);
  assert.match(page,/<summary aria-label="Custom dates" aria-current=\{period==="custom"\?"true":undefined\}>Custom<\/summary>/);
  assert.doesNotMatch(page,/<details className="statistics-custom-range" open=/);
  const position=page.indexOf('className="statistics-period-toolbar"');
  assert.ok(position<page.indexOf('aria-label="Statistics period"')&&page.indexOf('aria-label="Statistics period"')<page.indexOf('className="statistics-custom-range"'),
    "Custom must appear next to the presets in one toolbar");
  assert.match(page,/<form method="get" action="\/statistics" className="statistics-custom-range-form">/);
  assert.match(page,/name="from" type="date"/);
  assert.match(page,/name="to" type="date"/);
  assert.match(page,/name="period" value="custom"/);
  assert.match(page,/<button type="submit" className="primary-button">Apply<\/button>/);
  assert.match(page,/name="section" value=\{section\}/);
  assert.match(page,/name="category" value=\{category\}/);
  assert.match(page,/section!=="career"/);
  assert.doesNotMatch(page,/onChange=|useEffect\(|window\.location|router\.replace/);
});

test("N2-C retains range in category/analysis navigation but clears it for presets",()=>{
  const page=read("app/(protected)/statistics/page.tsx");
  assert.match(page,/if\(period==="custom"&&range\)\{query\.set\("from",range\.from\);query\.set\("to",range\.to\)\}/);
  assert.match(page,/statisticsHref\(period,section,key,customRange\)/);
  assert.match(page,/statisticsHref\(period,key,category,customRange\)/);
  assert.match(page,/statisticsHref\(key,section,category\)/);
  assert.match(page,/getPilotInsightsData\(session\.userId,section==="career"\?"all":period,category,section,customRange\)/);
  assert.match(page,/aria-current=\{period===key\?"page":undefined\}/);
});

test("N2-C rejects invalid deep links before querying statistics",()=>{
  const page=read("app/(protected)/statistics/page.tsx");
  const invalid=page.indexOf('if(section!=="career"&&period==="custom"&&!customRange)return');
  const query=page.indexOf('getPilotInsightsData(session.userId,section==="career"?"all":period');
  assert.ok(invalid>=0&&query>invalid,"invalid custom requests must render an error before expensive aggregate query");
  assert.match(page,/role="alert"/);
  assert.match(page,/parsePilotInsightCustomRange\(params\.from,params\.to\)/);
  const data=read("lib/data/pilot-insights.ts");
  assert.match(data,/pilotInsightBounds\(requested,new Date\(\),customRange\)/);
  assert.match(data,/date_key>=\$\{bounds\.start\}/);
  assert.match(data,/date_key<=\$\{bounds\.end\}/);
});

test("N2-C preserves narrow/touch/light-dark styling with no new calendar library",()=>{
  const ui=read("app/ui-system.css").split("/* N2-C — inline native calendar range")[1];
  assert.ok(ui);
  assert.match(ui,/statistics-period-toolbar\{/);
  assert.match(ui,/\.statistics-period-toolbar > \.period-control\{/);
  assert.match(ui,/\.statistics-custom-range-form\{[\s\S]*?position:absolute/);
  assert.match(ui,/top:calc\(100% \+ 8px\)/);
  assert.match(ui,/right:0/);
  assert.match(ui,/@media\(min-width:1500px\)/);
  assert.match(ui,/statistics-custom-range-form input\[type="date"\]/);
  assert.match(ui,/@media \(max-width:430px\)/);
  assert.match(ui,/min-height:44px/);
  assert.match(ui,/color-scheme:dark/);
  assert.match(ui,/color-scheme:light/);
  assert.match(ui,/outline:2px solid var\(--focus-color\)/);
  assert.doesNotMatch(ui,/animation:|transition:all|backdrop-filter/);
});
