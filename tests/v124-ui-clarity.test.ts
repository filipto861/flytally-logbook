import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";

const root=path.resolve(import.meta.dirname,"..");
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");
const credentialsSource=()=>read("app/(protected)/credentials/page.tsx")+read("app/(protected)/credentials/legacy-page.tsx")+read("app/(protected)/credentials/adaptive-overview.tsx");

test("Print and data exposes one durable task workspace at a time",()=>{
  const source=read("components/data-hub.tsx");
  const navigation=read("components/data-workspace-navigation.tsx");
  assert.match(navigation,/aria-label="Print and data sections"/);
  assert.match(navigation,/aria-current=\{active===item\.id\?"page":undefined\}/);
  assert.match(navigation,/Print & export/);
  assert.match(navigation,/Backup & restore/);
  assert.match(navigation,/Deleted flights/);
  assert.match(source,/view==="recovery"/);
  assert.match(source,/view==="deleted"/);
});

test("Aircraft cards separate status from reversible management actions",()=>{
  const source=read("components/aircraft-manager.tsx");
  assert.match(source,/Manage aircraft/);
  assert.match(source,/Aircraft is active/);
  assert.match(source,/Deactivate aircraft/);
  assert.match(source,/<span className=\{active\?"status-on":"status-off"\}>\{active\?"Active":"Inactive"\}<\/span>/);
});

test("Permanent credential and rate deletion requires a disclosed second step",()=>{
  const credentials=credentialsSource();
  const aircraft=read("components/aircraft-manager.tsx");
  assert.match(credentials,/className="confirm-action"/);
  assert.match(credentials,/Delete permanently/);
  assert.match(aircraft,/className="confirm-action compact-confirm"/);
  assert.match(aircraft,/Delete rate/);
});

test("Aircraft and airport tools present task-oriented navigation and summaries",()=>{
  const page=read("app/(protected)/database/page.tsx");
  const navigation=read("components/database-workspace-navigation.tsx");
  const css=read("app/v300-u31-aircraft-airports.css");
  assert.match(page,/<DatabaseWorkspaceNavigation/);
  assert.match(navigation,/Aircraft/);
  assert.match(navigation,/Airports/);
  assert.match(navigation,/Data health/);
  assert.match(page,/Technical defaults stay inside the aircraft editor/);
  assert.match(page,/Advanced counts/);
  assert.match(css,/database-workspace-nav/);
});

test("Flight list states explain whether a record is editable or official",()=>{
  const page=read("app/(protected)/flights/page.tsx");
  const css=read("app/globals.css");
  assert.match(page,/Official locked logbook record/);
  assert.match(page,/Editable record not yet certified/);
  assert.match(page,/className=\{`record-status \$\{status\.tone\}`\}/);
  assert.match(css,/\.record-status\.certified/);
});
