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
  const aircraftPhotosSchema=read("lib/v300-aircraft-sharing-schema.ts");
  for(const ddl of [
    "aircraft_photos",
    "aircraft_id BIGINT PRIMARY KEY REFERENCES aircraft(id) ON DELETE CASCADE",
    "user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE",
    "mime_type TEXT NOT NULL DEFAULT 'image/jpeg'",
    "image_base64 TEXT NOT NULL",
    "CHECK(mime_type IN ('image/jpeg','image/webp','image/png'))",
    "CHECK(length(image_base64)<=1200000)",
  ]){
    assert.ok(bootstrap.includes(ddl),"browser fixture is missing required aircraft-photo schema: "+ddl);
    assert.ok(aircraftPhotosSchema.includes(ddl),"production photo schema contract changed: "+ddl);
  }
  assert.ok(bootstrap.includes("CREATE INDEX idx_aircraft_photos_user"));
  assert.ok(aircraftPhotosSchema.includes("idx_aircraft_photos_user"));
  for (const column of [
    "municipality TEXT NOT NULL DEFAULT ''",
    "iso_country TEXT NOT NULL DEFAULT ''",
    "updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()",
    "CONSTRAINT airports_user_ident_unique UNIQUE(user_id,ident)",
  ]) assert.ok(bootstrap.includes(column),column);
  assert.ok(bootstrap.includes("(9002,${quote(passwordHash)})"),
    "secondary authenticated fixture account must have explicit test-only credentials");
  assert.ok(browser.includes("ALTER TABLE airports ADD COLUMN IF NOT EXISTS elevation_ft DOUBLE PRECISION"));
});

test("Airport elevation browser tests are authority-registered and run only on owned PG16",()=>{
  const spec=read("e2e/airport-elevation.spec.mjs");
  const registry=JSON.parse(read("tooling/development-modules.json"));
  const baseline=JSON.parse(read("tooling/browser-suite-baseline.json"));
  const browser=registry.browserAcceptance;
  const first="Airport elevation add edit and clear preserves nullable persisted MSL values";
  const second="Airport elevation server action refuses a cross-user forged edit";
  for(const title of [first,second]){
    assert.ok(spec.includes('test("'+title+'"'),title);
    assert.ok(baseline.acceptanceLogicalTests.includes(title),title);
  }
  assert.ok(spec.includes('test.skip(!authenticatedBrowser'));
  assert.ok(spec.includes("browserSqlScalar"));
  assert.ok(spec.includes('input[name^="$ACTION_ID_"]'));
  assert.ok(spec.includes('browser.newContext({baseURL:"http://127.0.0.1:3000"})'),
    "cross-user browser context must not navigate to a relative URL without a baseURL");
  for(const kind of ["mutation","ownership"]){
    for(const device of ["desktop","mobile"]){
      const id="airport-elevation-"+kind+"-"+device;
      assert.ok(browser.targets[id],id);
      assert.ok(browser.moduleTargets["aircraft-airports"].includes(id));
      assert.ok(browser.harnessTargets.includes(id));
    }
  }
  const wrapper=read("tooling/run-airport-elevation-browser-local.ps1");
  assert.ok(wrapper.includes('refs/remotes/origin/$expectedBranch'));
  assert.ok(wrapper.includes('FLYTALLY_V21_RISK_BROWSER = "1"'));
  assert.ok(wrapper.includes("npm.cmd run verify:browser:risk -- --base origin/main"));
  assert.ok(wrapper.includes("Verified disposable DB identity."));
  assert.ok(wrapper.includes('Join-Path $env:TEMP'));
  assert.ok(wrapper.includes('pg_ctl.exe'));
  assert.ok(wrapper.includes('DROP'));
});
