import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { releaseAtLeast } from "./release-version.ts";

const root=path.resolve(import.meta.dirname,"..");
const exists=(relative:string)=>fs.existsSync(path.join(root,relative));
const read=(relative:string)=>fs.readFileSync(path.join(root,relative),"utf8");

test("v1.52 repository no longer ships transactional or generated legacy data artifacts",()=>{
  for(const retired of ["data/logbook.sqlite","data/Zapisnik_letu_source.xlsx","data/airports_full.sqlite","data/airport_overrides.csv"]){
    assert.equal(exists(retired),false,`${retired} must not be shipped in the production repository`);
  }
  assert.equal(exists("data/airports.csv"),true);
  const catalog=read("lib/airport-catalog.ts");
  assert.match(catalog,/data","airports[.]csv/);
  assert.doesNotMatch(catalog,/airports_full[.]sqlite/);
});

test("v1.52 package and lockfile versions remain synchronized in later releases",()=>{
  const pkg=JSON.parse(read("package.json")),lock=JSON.parse(read("package-lock.json"));
  assert.ok(releaseAtLeast(pkg.version,1,52,0));
  assert.equal(lock.version,pkg.version);
  assert.equal(lock.packages?.[""]?.version,pkg.version);
});