import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root=path.resolve(import.meta.dirname,"..");
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");

test("v3.0 U3.1 separates Aircraft, Airports and Data health into explicit workspaces",()=>{
  const nav=read("components/database-workspace-navigation.tsx");
  const page=read("app/(protected)/database/page.tsx");
  assert.match(nav,/id:"aircraft",label:"Aircraft"/);
  assert.match(nav,/id:"airports",label:"Airports"/);
  assert.match(nav,/id:"health",label:"Data health"/);
  assert.match(page,/view==="aircraft"/);
  assert.match(page,/view==="airports"/);
  assert.match(page,/view==="health"/);
  assert.doesNotMatch(page,/DetailsNavigation/);
});

test("v3.0 U3.1 keeps aircraft management as the default task",()=>{
  const page=read("app/(protected)/database/page.tsx");
  const manager=read("components/aircraft-manager.tsx");
  assert.match(page,/resolveView=.*"aircraft"/);
  assert.match(page,/Your aircraft/);
  assert.match(page,/AircraftManager/);
  assert.match(manager,/aircraft-card-summary/);
  assert.match(manager,/Manage aircraft/);
  assert.doesNotMatch(manager,/aircraft-card-metrics/);
  assert.doesNotMatch(manager,/Edit aircraft & rates/);
});

test("v3.0 U3.1 makes airport catalogue search on demand",()=>{
  const page=read("app/(protected)/database/page.tsx");
  assert.match(page,/view==="airports"&&airportSearch\?searchAirportCatalog/);
  assert.match(page,/Search the catalogue when needed/);
  assert.match(page,/type="hidden" name="view" value="airports"/);
  assert.match(page,/<label><span>Code(?: <span className="field-hint" aria-hidden="true">Required<\/span>)?<\/span><input name="ident"/);
  assert.match(page,/<label>Latitude<input name="latitude_deg"/);
  assert.match(page,/<label>Longitude<input name="longitude_deg"/);
});

test("v3.0 U3.1 moves diagnostics and historical maintenance behind Data health",()=>{
  const page=read("app/(protected)/database/page.tsx");
  assert.match(page,/view==="health"/);
  assert.match(page,/DataQualityPanel/);
  assert.match(page,/Standardize historical airport codes/);
  assert.match(page,/Advanced counts/);
  const aircraftBlock=page.slice(page.indexOf('view==="aircraft"'),page.indexOf('view==="airports"'));
  assert.doesNotMatch(aircraftBlock,/DataQualityPanel|airport-code-migration|Airport catalogue/);
});
