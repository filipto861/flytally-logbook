import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root=path.resolve(import.meta.dirname,"..");
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");

const actions=read("app/(protected)/flights/actions.ts");
const flightInput=read("lib/flight-input.ts");
const certification=read("lib/certification-integrity.ts");
const certificationActions=read("lib/flight-certification.ts");
const compliance=read("lib/fcl050-compliance.ts");
const recency=read("lib/recency-service.ts");
const dashboard=read("lib/data/dashboard.ts");
const insights=read("lib/data/pilot-insights.ts");
const exportRoute=read("app/api/export/route.ts");
const printPage=read("app/(protected)/print/page.tsx");
const sharedActions=read("app/(protected)/flights/shared-actions.ts");
const dbOptimization=read("lib/db-optimization.ts");
const matrix=read("docs/product/FLIGHT_ENTRY_WORKFLOW_3_0_F0_FIELD_CONSUMER_MATRIX.md");
const f2=read("docs/product/FLIGHT_ENTRY_WORKFLOW_3_0_F2_ROLE_CREW_DESIGN.md");
const roleCrew=read("lib/role-crew.ts");

const actionBlock=(name:string)=>{
  const start=actions.indexOf(`export async function ${name}`);
  assert.ok(start>=0,`${name} missing`);
  const end=actions.indexOf("\nexport async function",start+40);
  return actions.slice(start,end>start?end:actions.length);
};
const create=actionBlock("createFlight");
const gps=actionBlock("importKmlFlight");
const update=actionBlock("updateFlight");

test("F0 inventory locks Manual shared parser versus current GPS direct semantic path",()=>{
  assert.match(create,/parseFlightInput\(form\)/);
  assert.match(update,/parseFlightInput\(form\)/);
  assert.doesNotMatch(gps,/parseFlightInput\(/);
  assert.match(gps,/INSERT INTO flights\(user_id,date,evidence,registration,aircraft_type,aircraft_class/);
  assert.match(matrix,/GPS is therefore still a second semantic write path/);
});

test("F2.1 closes the F0-characterized DUAL Save gap without changing Certification",()=>{
  assert.match(roleCrew,/role==="DUAL"/);
  assert.match(roleCrew,/instructor=easa\?"required_save":"optional"/);
  assert.match(flightInput,/roleCrewSaveError\(crewSpec,\{instructor,verificationName,verificationReference\}\)/);
  assert.match(compliance,/role==="DUAL"&&!text\(row\.instructor\).*DUAL flight requires the instructor\/PIC name/);
  assert.match(matrix,/Current server parser does not independently reject blank DUAL instructor/);
  assert.match(f2,/make EASA DUAL Instructor\/PIC Save-required server-side/);
});

test("F0 inventory locks certified-only recency and draft-visible analytics",()=>{
  assert.match(recency,/FROM flights f LEFT JOIN aircraft a[\s\S]*f\.certified_at IS NOT NULL/);
  assert.match(dashboard,/FROM flights f WHERE f\.user_id=\$\{userId\}/);
  assert.doesNotMatch(dashboard,/FROM flights f WHERE f\.user_id=\$\{userId\} AND f\.certified_at IS NOT NULL/);
  assert.match(insights,/FROM flights f WHERE f\.user_id=\$\{userId\}/);
  assert.doesNotMatch(insights,/FROM flights f WHERE f\.user_id=\$\{userId\} AND f\.certified_at IS NOT NULL/);
  assert.match(matrix,/draft does not mean regulatory evidence/);
});

test("F0 inventory preserves certification v1-v8 compatibility boundary",()=>{
  for(let version=1;version<=8;version++)assert.match(certification,new RegExp(`version===${version}`));
  assert.match(certificationActions,/flightCertificationHash\(\{\.\.\.row,certification_version:8\},userId,8\)/);
  assert.match(certificationActions,/certification_version=8/);
  assert.match(matrix,/Do not change certification payload v1–v8/);
});

test("F0 inventory records DB aircraft identity snapshot as a cross-path dependency",()=>{
  assert.match(dbOptimization,/logbook_snapshot_aircraft_identity/);
  assert.match(dbOptimization,/BEFORE INSERT OR UPDATE OF registration ON flights/);
  assert.match(dbOptimization,/NEW\.aircraft_make:=COALESCE\(v_make,''\)/);
  assert.match(dbOptimization,/NEW\.aircraft_model:=COALESCE\(v_model,NULLIF\(TRIM\(NEW\.aircraft_type\),''\),''\)/);
  assert.match(dbOptimization,/NEW\.aircraft_variant:=COALESCE\(v_variant,''\)/);
  assert.match(matrix,/final persistence authority for those three identity fields/);
});

test("F0 inventory captures shared-flight identity trigger interaction for F1 review",()=>{
  assert.match(sharedActions,/INSERT INTO flights\(user_id,date,evidence,registration,aircraft_type,aircraft_class/);
  assert.match(sharedActions,/\$\{text\(row\.aircraft_make\)\},\$\{text\(row\.aircraft_model\)\},\$\{text\(row\.aircraft_variant\)\}/);
  assert.match(matrix,/Shared-flight copy \+ aircraft identity trigger needs dedicated review/);
});

test("F0 inventory records current CSV/XLS field coverage without redefining stored semantics",()=>{
  const start=exportRoute.indexOf("const flightColumns=[");
  const end=exportRoute.indexOf("];",start);
  assert.ok(start>=0&&end>start);
  const columns=exportRoute.slice(start,end);
  for(const field of ["date","evidence","regulatory_category","registration","aircraft_make","aircraft_model","role","certified_at"])assert.match(columns,new RegExp(`"${field}"`));
  for(const omitted of ["purpose_code","operator_name","flight_number","operation_context","movement_evidence_recorded","approaches_day","approaches_night"])assert.doesNotMatch(columns,new RegExp(`"${omitted}"`));
  assert.match(printPage,/f\.purpose_code/);
  assert.match(matrix,/Tabular export is not a complete semantic mirror/);
});

test("F0 inventory keeps collaboration and GPS track provenance outside the certification hash payload",()=>{
  assert.doesNotMatch(certification,/flight_connected_crew/);
  assert.doesNotMatch(certification,/flight_tracks|track_points/);
  assert.doesNotMatch(certification,/billing_basis|price_per_hour|flight_expenses/);
  assert.match(matrix,/GPS track content/);
  assert.match(matrix,/connected-account PIC link/);
});

test("F0 inventory points F1 at one normalized semantic object without broadening GPS roles",()=>{
  assert.match(matrix,/Introduce one server-side normalized semantic flight object/);
  assert.match(matrix,/unsupported GPS roles remain rejected/);
  assert.match(matrix,/Equivalent Manual and GPS \*\*PIC\*\* inputs must produce equivalent semantic flight fields/);
});
