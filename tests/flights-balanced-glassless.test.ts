import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root=path.resolve(import.meta.dirname,"..");
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");

test("Balanced Glassless is loaded after the existing UI and F3 layers",()=>{
  const layout=read("app/layout.tsx");
  const importName='import "./flights-balanced-glassless.css"';
  assert.ok(layout.includes(importName));
  assert.ok(layout.indexOf(importName)>layout.indexOf('import "./flight-detail-f3.css"'));
  assert.ok(layout.indexOf(importName)>layout.indexOf('import "./ui-system.css"'));
});

test("Balanced Glassless remains confined to the Flights list and its existing surfaces",()=>{
  const css=read("app/flights-balanced-glassless.css");
  const selectors=css.split("\n").map(line=>line.trim()).filter(line=>line.endsWith("{")&&!line.startsWith("@"));
  assert.ok(selectors.length>=8);
  for(const rule of selectors){
    // The only selectors permitted to style this trial's surfaces target the list route.
    assert.ok(rule.includes('data-n2-layout="flights"'),rule);
  }
  assert.match(css,/\.flight-finder\s*\{/);
  assert.match(css,/\.flight-summary\s*\{/);
  assert.match(css,/\.flights-table\s*\{/);
  assert.match(css,/--flights-filter-surface:color-mix\(/);
  assert.match(css,/--flights-overview-surface:color-mix\(/);
  assert.match(css,/--flights-records-surface:color-mix\(/);
  assert.doesNotMatch(css,/#[\da-f]{3,8}\b/i,"new hardcoded palette must not be introduced");
  assert.doesNotMatch(css,/\b(?:opacity|backdrop-filter|animation|transition)\s*:/,"no glass or motion");
  assert.doesNotMatch(css,/!important/,"do not override core data/mobile rules");
});

test("Glassless preserves rounded cards and removes only decorative state rails on mobile",()=>{
  const css=read("app/flights-balanced-glassless.css");
  assert.match(css,/border-radius:var\(--ui-radius-card\)/);
  assert.match(css,/\.flight-summary\s*>\s*div\s*\{[\s\S]*?border-radius:14px/);
  assert.match(css,/@media\(max-width:760px\)\{/);
  assert.match(css,/border-inline-start:1px solid var\(--line\)/);
  assert.doesNotMatch(css,/border-(?:left|right|top|bottom)\s*:\s*[234]px\s+solid/);
  assert.match(css,/@media print\{/);
  const page=read("app/(protected)/flights/page.tsx");
  for(const existing of ['data-n2-layout="flights"','className="flight-finder"','className="flight-summary"','className="table-panel flights-table"','data-label="BLOCK"','data-label="AIR"'])assert.ok(page.includes(existing),existing);
});
