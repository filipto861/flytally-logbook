import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import {aircraftCategoryCapabilities} from "../lib/aircraft-category.ts";

const root=path.resolve(import.meta.dirname,"..");
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");
const source=()=>read("components/readonly-logbook-entry.tsx");

test("v2.0-C2 readonly category resolver preserves explicit SFCL TMG and legacy Part-FCL TMG",()=>{
  assert.equal(aircraftCategoryCapabilities({regulatoryCategory:"SAILPLANE",aircraftClass:"TMG",evidence:"EASA"}).category,"sailplane");
  assert.equal(aircraftCategoryCapabilities({aircraftClass:"TMG",evidence:"EASA"}).category,"aeroplane");
  assert.equal(aircraftCategoryCapabilities({aircraftClass:"GLIDER",evidence:"EASA"}).category,"sailplane");
  assert.equal(aircraftCategoryCapabilities({aircraftClass:"BALLOON",evidence:"EASA"}).category,"balloon");
});

test("v2.0-C2 Sailplane and Balloon location times use take-off and landing while powered records keep block times",()=>{
  const component=source();
  assert.match(component,/placeStartTime=sailplane\|\|balloon\?utc\(row[.]takeoff\):utc\(row[.]off_block\)/);
  assert.match(component,/placeEndTime=sailplane\|\|balloon\?utc\(row[.]landing\):utc\(row[.]on_block\)/);
  assert.match(component,/Part-SFCL logbook entry/);
  assert.match(component,/Part-BFCL logbook entry/);
});
