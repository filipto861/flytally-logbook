import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import {aircraftCategoryCapabilities} from "../lib/aircraft-category.ts";

const root=path.resolve(import.meta.dirname,"..");
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");
const source=()=>read("components/readonly-logbook-entry.tsx");
const between=(text:string,start:string,end:string)=>text.slice(text.indexOf(start),text.indexOf(end));

test("v2.0-C2 readonly category resolver preserves explicit SFCL TMG and legacy Part-FCL TMG",()=>{
  assert.equal(aircraftCategoryCapabilities({regulatoryCategory:"SAILPLANE",aircraftClass:"TMG",evidence:"EASA"}).category,"sailplane");
  assert.equal(aircraftCategoryCapabilities({aircraftClass:"TMG",evidence:"EASA"}).category,"aeroplane");
  assert.equal(aircraftCategoryCapabilities({aircraftClass:"GLIDER",evidence:"EASA"}).category,"sailplane");
  assert.equal(aircraftCategoryCapabilities({aircraftClass:"BALLOON",evidence:"EASA"}).category,"balloon");
});

test("v2.0-C2 powered and ULL readonly records retain the established FCL-style desktop table",()=>{
  const powered=between(source(),"function PoweredDesktopTable","function SailplaneDesktopTable");
  assert.match(powered,/Single-pilot time/);
  assert.match(powered,/Multi-pilot/);
  assert.match(powered,/Total flight/);
  assert.match(powered,/Co-pilot/);
});

test("v2.0-C2 Sailplane desktop view exposes SFCL evidence without powered SE ME MP columns",()=>{
  const sailplane=between(source(),"function SailplaneDesktopTable","function BalloonDesktopTable");
  assert.match(sailplane,/Take-off UTC/);
  assert.match(sailplane,/Flight time/);
  assert.match(sailplane,/Launch method/);
  assert.match(sailplane,/Launches/);
  assert.match(sailplane,/Take-offs/);
  assert.match(sailplane,/Landings/);
  assert.doesNotMatch(sailplane,/Single-pilot time|Multi-pilot|<th>SE<\/th>|<th>ME<\/th>/);
});

test("v2.0-C2 Balloon desktop view exposes BFCL class operation and movement evidence",()=>{
  const balloon=between(source(),"function BalloonDesktopTable","export function ReadonlyLogbookEntry");
  assert.match(balloon,/BFCL class \/ group/);
  assert.match(balloon,/Operation/);
  assert.match(balloon,/Flight time/);
  assert.match(balloon,/Take-offs/);
  assert.match(balloon,/Landings/);
  assert.doesNotMatch(balloon,/Single-pilot time|Multi-pilot|<th>SE<\/th>|<th>ME<\/th>/);
});

test("v2.0-C2 Sailplane and Balloon location times use take-off and landing while powered records keep block times",()=>{
  const component=source();
  assert.match(component,/placeStartTime=sailplane\|\|balloon\?utc\(row[.]takeoff\):utc\(row[.]off_block\)/);
  assert.match(component,/placeEndTime=sailplane\|\|balloon\?utc\(row[.]landing\):utc\(row[.]on_block\)/);
  assert.match(component,/Part-SFCL logbook entry/);
  assert.match(component,/Part-BFCL logbook entry/);
});
