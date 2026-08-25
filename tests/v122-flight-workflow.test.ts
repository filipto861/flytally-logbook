import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read=(path:string)=>readFileSync(new URL(`../${path}`,import.meta.url),"utf8");

test("flight list keeps everyday search visible and advanced filters secondary",()=>{
  const page=read("app/(protected)/flights/page.tsx");
  assert.match(page,/Find a flight/);
  assert.match(page,/advanced-flight-filters/);
  assert.match(page,/active-filter-bar/);
  assert.match(page,/Totals below reflect/);
  assert.match(page,/No flights found/);
});

test("flight rows expose direct view, edit and safe copy workflows",()=>{
  const list=read("app/(protected)/flights/page.tsx"),detail=read("components/flight-detail-workspace.tsx"),entry=read("app/(protected)/flights/new/page.tsx");
  assert.match(list,/View<\/Link><Link href=\{detailHref\(f\.id,params,"logbook"\)\}>Edit/);
  assert.match(list,/mode=manual&copy=/);
  assert.match(detail,/initialTab="overview"/);
  assert.match(entry,/getFlightDetailFast\(userId,copyId\)/);
  assert.match(entry,/starts:1,landings_day:1,landings_night:0/);
  assert.doesNotMatch(entry,/off_block:copied|takeoff:copied|landing:copied|on_block:copied/);
});

test("1.22 flight workflow remains responsive",()=>{
  const css=read("app/globals.css");
  assert.match(css,/FlyTally 1\.22 — everyday flight workflow/);
  assert.match(css,/\.flight-search-form>div\{display:grid;grid-template-columns:minmax\(0,1fr\) auto/);
  assert.match(css,/@media\(max-width:700px\)[\s\S]*\.flight-row-actions\{display:grid;grid-template-columns:1fr 1fr 1fr/);
});
