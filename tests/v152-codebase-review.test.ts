import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { releaseAtLeast } from "./release-version.ts";

const root=path.resolve(import.meta.dirname,"..");
const exists=(relative:string)=>fs.existsSync(path.join(root,relative));
const read=(relative:string)=>fs.readFileSync(path.join(root,relative),"utf8");

test("v1.52 active tree is the Next.js runtime rather than the retired Streamlit application",()=>{
  const pkg=JSON.parse(read("package.json"));
  assert.ok(releaseAtLeast(pkg.version,1,52,0));
  for(const retired of ["app.py","logbook_core","logbook_ui",".streamlit","requirements.txt","scripts","sql"]){
    assert.equal(exists(retired),false,`${retired} must remain outside the active production tree`);
  }
  for(const active of ["app","components","lib","tests","next.config.ts","vercel.json"]){
    assert.equal(exists(active),true,`${active} is part of the active production tree`);
  }
});

test("v1.52 repository no longer ships transactional or generated legacy data artifacts",()=>{
  for(const retired of ["data/logbook.sqlite","data/Zapisnik_letu_source.xlsx","data/airports_full.sqlite","data/airport_overrides.csv"]){
    assert.equal(exists(retired),false,`${retired} must not be shipped in the production repository`);
  }
  assert.equal(exists("data/airports.csv"),true);
  const catalog=read("lib/airport-catalog.ts");
  assert.match(catalog,/data","airports[.]csv/);
  assert.doesNotMatch(catalog,/airports_full[.]sqlite/);
});

test("v1.52 package and lockfile versions are synchronized",()=>{
  const pkg=JSON.parse(read("package.json")),lock=JSON.parse(read("package-lock.json"));
  assert.equal(pkg.version,"1.52.0");
  assert.equal(lock.version,pkg.version);
  assert.equal(lock.packages?.[""]?.version,pkg.version);
});

test("v1.52 operational documentation describes the current runtime",()=>{
  const readme=read("README.md"),architecture=read("ARCHITECTURE.md"),review=read("CODE_REVIEW_V152.md");
  assert.match(readme,/Next[.]js 16/);
  assert.match(readme,/Neon PostgreSQL/);
  assert.doesNotMatch(readme,/Current production-oriented release: \*\*FlyTally v1[.]33/);
  assert.match(architecture,/FlyTally architecture — v1[.]52/);
  assert.match(architecture,/active runtime is TypeScript only/);
  assert.match(review,/behavior preserving/i);
});

test("v1.52 cleanup does not remove the v1.51 regulatory regression safety net",()=>{
  for(const regression of [
    "tests/v151-regulatory-correctness.test.ts",
    "tests/v1511-legacy-recency.test.ts",
    "tests/v1512-recency-provenance.test.ts",
    "tests/v1513-automatic-ull-credit.test.ts",
    "REGULATORY_CORE_V151.md",
  ])assert.equal(exists(regression),true,`${regression} must be retained`);

  const regulatory=read("REGULATORY_CORE_V151.md");
  assert.match(regulatory,/automatically treated as SEP experience/);
  assert.match(regulatory,/does not automatically satisfy FCL[.]060 passenger currency/i);
});
