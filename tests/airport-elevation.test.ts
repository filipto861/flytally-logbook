import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  formatAirportElevationFt,
  parseAirportElevationFt,
  validateManualAirportElevationFt,
} from "../lib/airport-elevation.ts";

const root=path.resolve(import.meta.dirname,"..");
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");

test("airport elevations preserve null, zero, below-sea-level and fractional values",()=>{
  assert.equal(parseAirportElevationFt(""),null);
  assert.equal(parseAirportElevationFt("  "),null);
  assert.equal(parseAirportElevationFt(null),null);
  assert.equal(parseAirportElevationFt(undefined),null);
  assert.equal(parseAirportElevationFt("0"),0);
  assert.equal(parseAirportElevationFt(0),0);
  assert.equal(parseAirportElevationFt("-120.5"),-120.5);
  assert.equal(parseAirportElevationFt("+125.25"),125.25);
  assert.equal(parseAirportElevationFt(" 345 "),345);
  for(const invalid of ["N/A","unknown","NaN","Infinity","1e3","1,000","1 000","1x","--1"]){
    assert.equal(parseAirportElevationFt(invalid),null,invalid);
  }
  assert.equal(parseAirportElevationFt(Infinity),null);
});

test("manual elevation validates invalid input rather than silently clearing",()=>{
  assert.deepEqual(validateManualAirportElevationFt(""),{value:null,error:null});
  assert.deepEqual(validateManualAirportElevationFt("  "),{value:null,error:null});
  assert.deepEqual(validateManualAirportElevationFt("0"),{value:0,error:null});
  assert.deepEqual(validateManualAirportElevationFt("-430"),{value:-430,error:null});
  assert.equal(validateManualAirportElevationFt("not numeric").value,null);
  assert.match(validateManualAirportElevationFt("not numeric").error??"",/valid airport elevation/);
});

test("airport elevation display is explicitly feet MSL and unknown is not zero",()=>{
  assert.equal(formatAirportElevationFt(""),"—");
  assert.equal(formatAirportElevationFt(null),"—");
  assert.equal(formatAirportElevationFt("n/a"),"—");
  assert.equal(formatAirportElevationFt(0),"0 ft MSL");
  assert.equal(formatAirportElevationFt(-15),"-15 ft MSL");
  assert.equal(formatAirportElevationFt("1525"),"1,525 ft MSL");
});

test("catalogue reads existing CSV elevation column and keeps it nullable",()=>{
  const catalog=read("lib/airport-catalog.ts");
  assert.match(catalog,/elevationFt:number\|null/);
  assert.ok(catalog.includes('elevationAt=at("elevation_ft")'));
  assert.ok(catalog.includes('parseAirportElevationFt(elevationAt>=0?row[elevationAt]:"")'));
  const source=read("data/airports.csv");
  assert.ok(source.split(/\r?\n/,1)[0].replace(/"/g,"").split(",").includes("elevation_ft"));
});

test("airport elevation is user-owned and does not overwrite unrelated airport columns",()=>{
  const db=read("lib/data/database.ts");
  const actions=read("app/(protected)/database/actions.ts");
  const page=read("app/(protected)/database/page.tsx");
  assert.ok(db.includes("latitude_deg,longitude_deg,elevation_ft,active,closed,source FROM airports WHERE user_id="));
  assert.ok(actions.includes("INSERT INTO airports(user_id,ident,name,municipality,iso_country,latitude_deg,longitude_deg,elevation_ft,active"));
  assert.ok(actions.includes("elevation_ft=CASE WHEN "+"$"+"{elevationSpecified} THEN EXCLUDED.elevation_ft ELSE airports.elevation_ft END"));
  assert.ok(actions.includes("UPDATE airports SET elevation_ft="+"$"+"{elevation.value},updated_at=NOW()"));
  assert.ok(actions.includes("WHERE id="+"$"+"{id} AND user_id="+"$"+"{userId}"));
  assert.ok(actions.includes("NOT LIKE 'ourairports%'"));
  assert.ok(actions.includes('validateManualAirportElevationFt(s(form,"elevation_ft"))'));
  assert.ok(actions.includes('const elevationSpecified=form.has("elevation_ft")'));
  assert.ok(actions.includes('if(!form.has("elevation_ft"))return finishAirportSave("invalid-elevation")'));
  assert.ok(page.includes("formatAirportElevationFt(item.elevation_ft)"));
  assert.ok(page.includes("formatAirportElevationFt(airport.elevationFt)"));
  assert.ok(page.includes("action={saveAirportElevation}"));
  assert.ok(page.includes('name="elevation_ft" type="number" step="any"'));
  assert.ok(page.includes("colSpan={7}"));
});

test("isolated browser database fixtures include the nullable elevation prerequisite",()=>{
  const bootstrap=read("tooling/bootstrap-browser-smoke-db.mjs");
  const browser=read("e2e/browser-db.mjs");
  assert.ok(bootstrap.includes("elevation_ft DOUBLE PRECISION"));
  assert.ok(browser.includes("ALTER TABLE airports ADD COLUMN IF NOT EXISTS elevation_ft DOUBLE PRECISION"));
});
