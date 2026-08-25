import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";

const root=path.resolve(import.meta.dirname,"..");
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");

test("Print and data exposes one accessible task panel at a time",()=>{
  const source=read("components/data-hub.tsx");
  assert.match(source,/role="tablist"/);
  assert.match(source,/role="tabpanel"/);
  assert.match(source,/aria-controls="data-panel-export"/);
  assert.match(source,/className="export-hub-workspace"/);
  assert.match(source,/Deleted flights/);
});

test("Aircraft cards separate status from reversible management actions",()=>{
  const source=read("components/aircraft-manager.tsx");
  assert.match(source,/Edit aircraft & rates/);
  assert.match(source,/Aircraft is active/);
  assert.match(source,/Deactivate aircraft/);
  assert.match(source,/<span className=\{active\?"status-on":"status-off"\}>\{active\?"Active":"Inactive"\}<\/span>/);
});

test("Permanent licence and rate deletion requires a disclosed second step",()=>{
  const profile=read("app/(protected)/profile/page.tsx");
  const aircraft=read("components/aircraft-manager.tsx");
  assert.match(profile,/className="confirm-action"/);
  assert.match(profile,/Delete permanently/);
  assert.match(aircraft,/className="confirm-action compact-confirm"/);
  assert.match(aircraft,/Delete rate/);
});

test("Aircraft and airport tools present task-oriented navigation and summaries",()=>{
  const page=read("app/(protected)/database/page.tsx");
  const navigation=read("components/details-navigation.tsx");
  const css=read("app/globals.css");
  assert.match(page,/<DetailsNavigation/);
  assert.match(navigation,/target instanceof HTMLDetailsElement/);
  assert.match(page,/Profiles, defaults and hourly-rate history/);
  assert.match(page,/Advanced counts for duplicates, rates, routes and GPS records/);
  assert.match(css,/FlyTally 1\.24 — clear tasks, safe secondary actions/);
});

test("Flight list states explain whether a record is editable or official",()=>{
  const page=read("app/(protected)/flights/page.tsx");
  const css=read("app/globals.css");
  assert.match(page,/Official locked logbook record/);
  assert.match(page,/Editable record not yet certified/);
  assert.match(page,/className=\{`record-status \$\{status\.tone\}`\}/);
  assert.match(css,/\.record-status\.certified/);
});
