import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { gpsNightMinutesSuggestion } from "../lib/civil-twilight.ts";
import { gpsImportSourceRequirements } from "../lib/gps-import-integrity.ts";
import { parseAircraftDefaultEngineType } from "../lib/aircraft-profile-validation.ts";
import { engineDefaultFromCatalogEntry } from "../lib/aircraft-type-search.ts";
import { parseAircraftShareSnapshot } from "../lib/aircraft-sharing.ts";
import type { KmlPoint } from "../lib/track-processing.ts";

const root=path.resolve(import.meta.dirname,"..");
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");

const profile=(partFclCreditClass="")=>({
  evidence:"ULL" as const,
  aircraftClass:"ULL" as const,
  regulatoryCategory:"ULL" as const,
  balloonClass:"" as const,
  balloonGroup:"" as const,
  partFclCreditClass:partFclCreditClass as ""|"SEP",
  partFclCreditBasis:partFclCreditClass?"Configured credit":"",
  partFclCreditFrom:partFclCreditClass?"2026-01-01":"",
});

test("E2 schema v19 is additive nullable SE ME with no backfill",()=>{
  const plan=read("lib/migration-plan.ts"),db=read("lib/db-optimization.ts");
  const currentSchema=Number(plan.match(/DATABASE_SCHEMA_VERSION=(\d+)/)?.[1]??0);
  assert.ok(currentSchema>=19,"current schema must retain migration v19 or later");
  assert.match(plan,/version:19,name:"aircraft default engine type"/);
  assert.match(db,/19:"aircraft default engine type"/);
  const start=db.indexOf("if(version===19)return[");
  const end=db.indexOf("throw new Error",start);
  assert.ok(start>=0&&end>start);
  const migration=db.slice(start,end);
  assert.match(migration,/ADD COLUMN IF NOT EXISTS default_engine_type TEXT/);
  assert.match(migration,/CHECK\(default_engine_type IS NULL OR default_engine_type IN \('SE','ME'\)\)/);
  assert.doesNotMatch(migration,/UPDATE aircraft SET default_engine_type/i);
});

test("E2 engine default parser and catalogue suggestion are fail closed",()=>{
  assert.deepEqual(parseAircraftDefaultEngineType(""),{value:""});
  assert.deepEqual(parseAircraftDefaultEngineType("se"),{value:"SE"});
  assert.deepEqual(parseAircraftDefaultEngineType("ME"),{value:"ME"});
  assert.match(parseAircraftDefaultEngineType("AUTO").error??"",/single-engine|multi-engine|not set/i);

  assert.equal(engineDefaultFromCatalogEntry({category:"Fixed-wing",engine:"1P/S"}),"SE");
  assert.equal(engineDefaultFromCatalogEntry({category:"Fixed-wing",engine:"2P/S"}),"ME");
  assert.equal(engineDefaultFromCatalogEntry({category:"Fixed-wing",engine:""}),"");
  assert.equal(engineDefaultFromCatalogEntry({category:"Rotorcraft",engine:"1T"}),"");
});

test("E2 ordinary ULL GPS review no longer requires Part-FCL PF evidence without explicit credit mapping",()=>{
  assert.equal(gpsImportSourceRequirements(profile()).movementMode,"NONE");
  assert.equal(gpsImportSourceRequirements(profile("SEP")).movementMode,"FCL060_PF");
});

test("E2 GPS Night-time baseline remains conservative and 3.4.1 explains sparse-gap unavailability",()=>{
  const points=(start:string,end:string):KmlPoint[]=>[
    {lat:50.09,lon:14.43,alt:300,time:start},
    {lat:50.10,lon:14.44,alt:320,time:end},
  ];
  assert.deepEqual(gpsNightMinutesSuggestion(points("2026-07-19T12:00:00Z","2026-07-19T12:10:00Z")),{status:"AVAILABLE",minutes:0});
  assert.deepEqual(gpsNightMinutesSuggestion(points("2026-07-19T22:00:00Z","2026-07-19T22:10:00Z")),{status:"AVAILABLE",minutes:10});
  const ambiguous=gpsNightMinutesSuggestion(points("2026-07-19T22:00:00","2026-07-19T22:10:00"));
  assert.equal(ambiguous.status,"UNAVAILABLE");
  if(ambiguous.status==="UNAVAILABLE")assert.deepEqual(ambiguous.reasons,["MISSING_OR_AMBIGUOUS_TIMESTAMP"]);
  const sparse=gpsNightMinutesSuggestion(points("2026-07-19T12:00:00Z","2026-07-19T12:10:01Z"));
  assert.equal(sparse.status,"UNAVAILABLE");
  if(sparse.status==="UNAVAILABLE"){
    assert.deepEqual(sparse.reasons,["SEGMENT_GAP_TOO_LARGE"]);
    assert.equal(sparse.affectedSegmentSeconds,601);
  }
});

test("E2 GPS UX extends SERA to ULL, keeps IFR manual and makes PF evidence optional",()=>{
  const gps=read("components/kml-import-form.tsx");
  assert.match(gps,/seraLandingSuggestionEnabled=sourceRequirements\?\.landingMode==="DAY_NIGHT"/);
  assert.match(gps,/seraNightTimeSuggestionEnabled=sourceRequirements\?\.reviewNightIfr===true/);
  assert.doesNotMatch(gps,/\bnightDefinition\b/);
  assert.match(gps,/pfSuggestion=sourceRequirements\?\.movementMode==="FCL060_PF"\?gpsPfMovementDayNightSuggestion\(part\):null/);
  assert.match(gps,/gpsNightMinutesSuggestion\(parts\[index\]\?\?\[\]\)/);
  assert.match(gps,/GPS does not prove IFR/);
  assert.match(gps,/type="checkbox" value="yes" checked=\{review\.pfMovement==="yes"\}/);
  assert.match(gps,/Leave unchecked unless you were pilot flying/);
  assert.doesNotMatch(gps,/PF movement evidence <span className="field-hint" aria-hidden="true">Required/);
  const actions=read("app/(protected)/flights/actions.ts");
  assert.match(actions,/if\(pf&&pf!=="yes"\)/);
  assert.doesNotMatch(actions,/needs an explicit pilot-flying movement decision/);
});

test("E2 aircraft profile default engine is persisted, shared and applied as an editable flight prefill",()=>{
  const manager=read("components/aircraft-manager.tsx"),quick=read("components/quick-aircraft-form.tsx"),actions=read("app/(protected)/database/actions.ts"),data=read("lib/data/aircraft.ts"),manual=read("components/flight-form.tsx"),gps=read("components/kml-import-form.tsx");
  assert.match(manager,/name="default_engine_type"/);
  assert.match(manager,/onEngineSuggestion/);
  assert.match(quick,/name="default_engine_type"/);
  assert.match(actions,/parseAircraftDefaultEngineType\(s\(form,"default_engine_type"\)\)/);
  assert.match(actions,/default_engine_type=\$\{defaultEngineType\}/);
  assert.match(data,/default_engine_type:string/);
  assert.match(manual,/profileEngineDefault=normalizeChoice\(selected\?\.default_engine_type,ENGINE_TYPES,""\)/);
  assert.match(manual,/normalizeChoice\(a\.default_engine_type,ENGINE_TYPES,defaultEngineType\(nextClass\)\)/);
  assert.match(gps,/selectedAircraft\?\.default_engine_type/);

  const shared=parseAircraftShareSnapshot({
    profile:{registration:"OK-E2"},
    defaults:{defaultRole:"PIC",defaultOperationType:"SP",defaultEngineType:"SE",billingBasis:""},
  });
  assert.equal(shared.defaults?.defaultEngineType,"SE");
  assert.equal(shared.defaults?.engineError,undefined);
  const invalid=parseAircraftShareSnapshot({
    profile:{registration:"OK-E2"},
    defaults:{defaultRole:"PIC",defaultEngineType:"AUTO",billingBasis:""},
  });
  assert.match(invalid.defaults?.engineError??"",/single-engine|multi-engine|not set/i);
});

test("E2 production v19 tooling is strict, transactional and no-backfill",()=>{
  const pre=read("tooling/e2-v19-preflight.sql"),mig=read("tooling/e2-v19-migrate.sql"),post=read("tooling/e2-v19-postflight.sql");
  assert.match(pre,/BEGIN TRANSACTION READ ONLY/);
  assert.match(pre,/registry is not exact versions 1\.\.18/);
  assert.match(pre,/default_engine_type already exists/);
  assert.match(pre,/ROLLBACK/);
  assert.doesNotMatch(pre,/\bUPDATE\b|\bINSERT\b|\bDELETE\b|ALTER TABLE/i);

  assert.match(mig,/BEGIN;/);
  assert.match(mig,/pg_advisory_xact_lock\(704190104\)/);
  assert.match(mig,/ADD COLUMN default_engine_type TEXT/);
  assert.match(mig,/CHECK\(default_engine_type IS NULL OR default_engine_type IN \('SE','ME'\)\)/);
  assert.match(mig,/VALUES\(19,'aircraft default engine type'\)/);
  assert.match(mig,/existing aircraft defaults were populated unexpectedly/);
  assert.match(mig,/COMMIT;/);
  assert.doesNotMatch(mig,/UPDATE\s+public\.aircraft|UPDATE\s+aircraft/i);

  assert.match(post,/BEGIN TRANSACTION READ ONLY/);
  assert.match(post,/registry is not exact versions 1\.\.19/);
  assert.match(post,/non_null_engine_defaults/);
  assert.match(post,/ROLLBACK/);
});
