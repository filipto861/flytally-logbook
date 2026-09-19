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

test("flight rows keep one clear action",()=>{
  const list=read("app/(protected)/flights/page.tsx"),entry=read("app/(protected)/flights/new/page.tsx");
  assert.match(list,/className="flight-route-link"/);
  assert.match(list,/>Open →</);
  assert.doesNotMatch(list,/>View flight<|>Edit<|>Copy<|mode=manual&copy=/);
  assert.doesNotMatch(entry,/copyId|New flight from copy|getFlightDetailFast/);
});

test("certified records remain visible in an FCL.050 read-only layout",()=>{
  const page=read("app/(protected)/flights/[id]/page.tsx"),preview=read("components/readonly-logbook-entry.tsx"),css=read("app/globals.css");
  assert.match(page,/ReadonlyLogbookEntry/);
  assert.match(preview,/FCL\.050 logbook entry/);
  assert.match(preview,/Single-pilot time/);
  assert.match(preview,/Pilot function/);
  assert.match(css,/\.readonly-fcl-table\{[^}]*min-width:1600px/);
  assert.match(css,/@media\(max-width:700px\)[\s\S]*\.readonly-fcl-table-wrap\{display:none\}[\s\S]*\.readonly-logbook-card\.mobile-only\{display:grid\}/);
});

test("1.22 flight search workflow remains responsive",()=>{
  const css=read("app/globals.css");
  assert.match(css,/FlyTally 1\.22 — everyday flight workflow/);
  assert.match(css,/\.flight-search-form>div\{display:grid;grid-template-columns:minmax\(0,1fr\) auto/);
  assert.match(css,/@media\(max-width:700px\)[\s\S]*\.flight-search-form\{padding:16px\}/);
});
