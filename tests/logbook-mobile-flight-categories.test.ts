import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";

const flights=readFileSync(new URL("../app/(protected)/flights/page.tsx",import.meta.url),"utf8");
const css=readFileSync(new URL("../app/ui-system.css",import.meta.url),"utf8");
const layout=readFileSync(new URL("../app/layout.tsx",import.meta.url),"utf8");

test("Flights category navigation preserves all six filters and explicit current-page semantics",()=>{
  assert.match(flights,/const categoryTabs=\["","AEROPLANE","ULL","SAILPLANE","HELICOPTER","BALLOON"\]/);
  const start=flights.indexOf('<nav className="period-control" aria-label="Logbook category">');
  const end=flights.indexOf("</nav>",start);
  assert.ok(start>=0&&end>start);
  const nav=flights.slice(start,end);
  assert.match(nav,/aria-current=\{\(params\.category\|\|""\)===value\?"page":undefined\}/);
  assert.match(nav,/href=\{href\(params,\{category:value\|\|undefined,page:"1"\}\)\}/);
  assert.match(nav,/categoryLabels\[value\]/);
});

test("Flights category chips show as two full rows only at 390px or narrower",()=>{
  const marker="/* U0-R01 follow-up — narrow Flights category reachability.";
  const start=css.indexOf(marker);
  assert.ok(start>=0);
  const style=css.slice(start);
  assert.match(style,/@media\(max-width:390px\)/);
  assert.match(style,/nav\.period-control\[aria-label="Logbook category"\]/);
  assert.match(style,/grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
  assert.match(style,/min-height:44px/);
  assert.match(style,/overflow:visible/);
  assert.match(style,/white-space:normal/);
  assert.doesNotMatch(style,/!important|\.segment-control|\.settings-nav|\.scope-links/);
  assert.match(layout,/import "\.\/ui-system\.css";/);
});
