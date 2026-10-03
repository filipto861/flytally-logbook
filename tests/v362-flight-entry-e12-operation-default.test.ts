import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { parseAircraftDefaultOperationType } from "../lib/aircraft-profile-validation.ts";
import { manualFlightCandidate } from "../lib/flight-draft-candidate.ts";
import { normalizeFlightDraft } from "../lib/flight-input.ts";
import { fcl050FlightCompliance } from "../lib/fcl050-compliance.ts";
import { parseAircraftShareSnapshot } from "../lib/aircraft-sharing.ts";

const root=path.resolve(import.meta.dirname,"..");
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");

function manualForm(operationType=""){
  const form=new FormData();
  for(const [key,value] of Object.entries({
    date:"2026-10-03",registration:"OK-E12",aircraftType:"B23",evidence:"EASA",aircraftClass:"SEP",regulatoryCategory:"AEROPLANE",
    departure:"LKLT",arrival:"LKLT",offBlock:"10:00",takeoff:"10:05",landing:"10:55",onBlock:"11:00",
    role:"PIC",engineType:"SE",landingsDay:"1",landingsNight:"0",operationType,
  }))form.set(key,value);
  return form;
}

test("E1.2 schema v18 adds a nullable constrained aircraft operation default without backfill",()=>{
  const plan=read("lib/migration-plan.ts"),db=read("lib/db-optimization.ts");
  assert.match(plan,/DATABASE_SCHEMA_VERSION=18/);
  assert.match(plan,/version:18,name:"aircraft default operation type"/);
  assert.match(db,/18:"aircraft default operation type"/);
  const start=db.indexOf("if(version===18)return[");
  const end=db.indexOf("throw new Error",start);
  assert.ok(start>=0&&end>start);
  const migration=db.slice(start,end);
  assert.match(migration,/ALTER TABLE aircraft ADD COLUMN IF NOT EXISTS default_operation_type TEXT/);
  assert.match(migration,/CHECK\(default_operation_type IS NULL OR default_operation_type IN \('SP','MP'\)\)/);
  assert.doesNotMatch(migration,/UPDATE aircraft SET default_operation_type/i);
});

test("E1.2 aircraft operation default parser preserves NULL semantics and rejects unknown values",()=>{
  assert.deepEqual(parseAircraftDefaultOperationType(""),{value:""});
  assert.deepEqual(parseAircraftDefaultOperationType("sp"),{value:"SP"});
  assert.deepEqual(parseAircraftDefaultOperationType("MP"),{value:"MP"});
  assert.match(parseAircraftDefaultOperationType("AUTO").error??"",/single-pilot|multi-pilot|not set/i);
});

test("E1.2 Manual draft can remain operation-incomplete without silently becoming SP",()=>{
  const result=normalizeFlightDraft(manualFlightCandidate(manualForm("")));
  assert.equal(result.error,undefined);
  assert.equal(result.data?.operationType,"");

  const invalid=normalizeFlightDraft(manualFlightCandidate(manualForm("XX")));
  assert.equal(invalid.data,undefined);
  assert.match(invalid.error??"",/valid operation type/i);
});

test("E1.2 certification still fails closed when an EASA draft has no SP MP operation",()=>{
  const row={
    date:"2026-10-03",evidence:"EASA",registration:"OK-E12",aircraft_make:"BRM Aero",aircraft_model:"B23",aircraft_type:"B23",
    aircraft_class:"SEP",departure:"LKLT",arrival:"LKLT",off_block:"10:00",on_block:"11:00",engine_type:"SE",operation_type:"",
    role:"PIC",commander:"Pilot",pic_minutes:60,copilot_minutes:0,dual_minutes:0,instructor_minutes:0,night_minutes:0,ifr_minutes:0,
    landings_day:1,landings_night:0,starts:1,
  };
  assert.ok(fcl050FlightCompliance(row).some(issue=>issue.code==="operation_type"));
});

test("E1.2 Aircraft Add Edit and Quick Add expose an optional default operation control",()=>{
  const manager=read("components/aircraft-manager.tsx"),quick=read("components/quick-aircraft-form.tsx"),actions=read("app/(protected)/database/actions.ts");
  assert.match(manager,/name="default_operation_type"/);
  assert.match(manager,/>No default<\/option>/);
  assert.match(quick,/name="default_operation_type"/);
  assert.match(actions,/parseAircraftDefaultOperationType\(s\(form,"default_operation_type"\)\)/);
  assert.match(actions,/default_operation_type=\$\{defaultOperationType\}/);
  assert.match(actions,/default_operation_type=EXCLUDED\.default_operation_type/);
});

test("E1.2 Manual and GPS entry receive and visibly apply the profile default without making it aircraft authority",()=>{
  const data=read("lib/data/aircraft.ts"),manual=read("components/flight-form.tsx"),gps=read("components/kml-import-form.tsx");
  assert.match(data,/default_operation_type:string/);
  assert.match(data,/COALESCE\(default_operation_type,''\) AS default_operation_type/);
  assert.match(manual,/profileOperationDefault=normalizeChoice\(selected\?\.default_operation_type,OPERATION_TYPES,""\)/);
  assert.match(manual,/setOperationType\(nextOperationProfile\.showOperationEngineControls\?normalizeChoice\(a\.default_operation_type,OPERATION_TYPES,""\):"SP"\)/);
  assert.match(manual,/<option value="">Select SP \/ MP<\/option>/);
  assert.match(manual,/Aircraft default · flight-specific\./);
  assert.match(gps,/setOperationType\(defaultOperation\)/);
  assert.match(gps,/operationType!==""&&engineType!==""/);
  assert.match(gps,/Aircraft default · confirm or change for this flight\./);
});

test("E1.2 sharing carries the default and rejects unknown imported values instead of coercing to SP",()=>{
  const parsed=parseAircraftShareSnapshot({
    profile:{registration:"OK-E12"},
    defaults:{defaultRole:"PIC",defaultOperationType:"MP",billingBasis:""},
  });
  assert.equal(parsed.defaults?.defaultOperationType,"MP");
  assert.equal(parsed.defaults?.operationError,undefined);

  const invalid=parseAircraftShareSnapshot({
    profile:{registration:"OK-E12"},
    defaults:{defaultRole:"PIC",defaultOperationType:"AUTO",billingBasis:""},
  });
  assert.match(invalid.defaults?.operationError??"",/single-pilot|multi-pilot|not set/i);

  const legacy=parseAircraftShareSnapshot({
    profile:{registration:"OK-E12"},
    defaults:{defaultRole:"PIC",billingBasis:""},
  });
  assert.equal(legacy.defaults?.defaultOperationType,undefined);
  assert.equal(legacy.defaults?.operationError,undefined);

  const actions=read("app/(protected)/connections/aircraft-share-actions.ts");
  assert.match(actions,/defaultOperationType:text\(aircraft\.default_operation_type\)\.toUpperCase\(\)/);
  assert.match(actions,/snapshot\.defaults\?\.operationError/);
  assert.match(actions,/operationDefaultIncluded=snapshot\.defaults\.defaultOperationType!==undefined/);
  assert.match(actions,/default_operation_type=CASE WHEN \$\{operationDefaultIncluded\} THEN \$\{snapshot\.defaults\.defaultOperationType\|\|null\} ELSE default_operation_type END/);
});

test("E1.2 account backup and exact restore are schema-aware and preserve the aircraft column through SELECT star JSON restore",()=>{
  const backup=read("lib/account-backup.ts"),restore=read("lib/account-restore-v6.ts");
  assert.match(backup,/ensureDatabaseOptimizations\(\)/);
  assert.match(backup,/SELECT \* FROM aircraft WHERE user_id=/);
  assert.match(restore,/ensureDatabaseOptimizations\(\)/);
  assert.match(restore,/INSERT INTO aircraft SELECT \(json_populate_record\(NULL::aircraft,item\)\)\.\*/);
});
