import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  gpsImportRequiresOperationEngine,
  resolveGpsImportOperationEngine,
} from "../lib/gps-import-integrity.ts";

const root=path.resolve(import.meta.dirname,"..");
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");
const gpsForm=read("components/kml-import-form.tsx");
const actions=read("app/(protected)/flights/actions.ts");
const importStart=actions.indexOf("export async function importKmlFlight");
const importEnd=actions.indexOf("\nexport async function",importStart+40);
const importAction=actions.slice(importStart,importEnd>importStart?importEnd:actions.length);

const sepProfile={
  evidence:"EASA" as const,
  aircraftClass:"SEP" as const,
  regulatoryCategory:"AEROPLANE" as const,
  balloonClass:"" as const,
  balloonGroup:"" as const,
  partFclCreditClass:"" as const,
  partFclCreditBasis:"",
  partFclCreditFrom:"",
};

test("F1.5 requires explicit Operation/Engine where category semantics expose them",()=>{
  assert.equal(gpsImportRequiresOperationEngine(sepProfile),true);
  assert.deepEqual(
    resolveGpsImportOperationEngine({operationType:"SP",engineType:"SE"},sepProfile),
    {operationType:"SP",engineType:"SE",explicit:true},
  );
  assert.deepEqual(
    resolveGpsImportOperationEngine({operationType:"mp",engineType:"me"},sepProfile),
    {operationType:"MP",engineType:"ME",explicit:true},
  );
  assert.match(resolveGpsImportOperationEngine({operationType:"",engineType:"SE"},sepProfile).error??"",/single-pilot or multi-pilot/i);
  assert.match(resolveGpsImportOperationEngine({operationType:"SP",engineType:""},sepProfile).error??"",/single-engine or multi-engine/i);
  assert.match(resolveGpsImportOperationEngine({operationType:"AUTO",engineType:"SE"},sepProfile).error??"",/single-pilot or multi-pilot/i);
});

test("F1.5 does not require Operation/Engine for non-applicable balloon context",()=>{
  const balloon={
    ...sepProfile,
    aircraftClass:"BALLOON" as const,
    regulatoryCategory:"BALLOON" as const,
    balloonClass:"HOT_AIR_BALLOON" as const,
    balloonGroup:"A" as const,
  };
  assert.equal(gpsImportRequiresOperationEngine(balloon),false);
  const result=resolveGpsImportOperationEngine({operationType:"",engineType:""},balloon);
  assert.equal(result.error,undefined);
  assert.equal(result.explicit,false);
  assert.equal(result.operationType,"SP");
});

test("F1.5 GPS UI exposes explicit common Operation/Engine and blocks readiness until selected",()=>{
  assert.match(gpsForm,/gpsImportRequiresOperationEngine/);
  assert.match(gpsForm,/name="operationType" value=\{operationType\}/);
  assert.match(gpsForm,/name="engineType" value=\{engineType\}/);
  assert.match(gpsForm,/Select SP \/ MP/);
  assert.match(gpsForm,/Select SE \/ ME/);
  assert.match(gpsForm,/!requiresOperationEngine\|\|\(operationType!==""&&engineType!==""\)/);
  assert.ok(gpsForm.includes('setOperationType("")'));
  assert.ok(gpsForm.includes('setEngineType("")'));
});

test("F1.5 server revalidates Operation/Engine and persists resolved values",()=>{
  assert.match(importAction,/resolveGpsImportOperationEngine\(\{operationType:form\.get\("operationType"\),engineType:form\.get\("engineType"\)\},resolvedProfile\)/);
  assert.match(importAction,/if\(operationEngine\.error\)return\{error:operationEngine\.error\}/);
  assert.match(importAction,/const operationType=operationEngine\.operationType,engineType=operationEngine\.engineType/);
  assert.match(importAction,/\$\{item\.input\.operationType\},\$\{item\.input\.engineType\}/);
  assert.doesNotMatch(importAction,/'SP',\$\{defaultEngineType\(aircraftClass\)\}/);
});

test("F1.5 keeps GPS role support narrow while F1.4 routes PIC semantics through the shared normalizer",()=>{
  assert.match(importAction,/validateGpsImportRole\(form\.get\("role"\)\)/);
  assert.match(importAction,/normalizeFlightDraft\(candidate\)/);
  assert.match(importAction,/gpsFlightCandidate\(/);
  assert.match(importAction,/\$\{item\.input\.role\}/);
});
