import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root=path.resolve(import.meta.dirname,"..");
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");
const actions=read("app/(protected)/flights/actions.ts");
const parser=read("lib/flight-input.ts");

function actionBlock(name:string,next?:string){
  const start=actions.indexOf(`export async function ${name}`);
  assert.ok(start>=0,`${name} missing`);
  const end=next?actions.indexOf(`export async function ${next}`,start+30):actions.indexOf("\nexport async function",start+30);
  return actions.slice(start,end>start?end:actions.length);
}

const create=actionBlock("createFlight","importKmlFlight");
const gps=actionBlock("importKmlFlight","updateFlight");
const update=actionBlock("updateFlight","saveFlightExpenses");

test("F1.3 keeps parseFlightInput as the Manual compatibility boundary",()=>{
  assert.match(parser,/export function parseFlightInput\(form:FormData\)[\s\S]*return normalizeFlightDraft\(manualFlightCandidate\(form\)\)/);
  for(const [name,block] of [["create",create],["update",update]] as const){
    assert.equal((block.match(/parseFlightInput\(form\)/g)||[]).length,1,name);
    assert.equal((block.match(/parseFlightExpenses\(form\)/g)||[]).length,1,name);
    assert.match(block,/const f=parsed\.data/,name);
    assert.doesNotMatch(block,/normalizeFlightDraft\(/,name);
    assert.doesNotMatch(block,/manualFlightCandidate\(/,name);
  }
});

test("F1.3 Manual actions do not re-read semantic flight fields from FormData after normalization",()=>{
  const createGets=[...create.matchAll(/form\.get(?:All)?\("([^"]+)"/g)].map(match=>match[1]);
  const updateGets=[...update.matchAll(/form\.get(?:All)?\("([^"]+)"/g)].map(match=>match[1]);
  assert.deepEqual(createGets,["intent"]);
  assert.deepEqual(updateGets,[]);
  assert.match(actions,/function connectedPicSelection\(form:FormData,role:string\)/);
  assert.match(actions,/form\.get\("actualPicMode"\)/);
  assert.match(actions,/form\.get\("connectedPicUserId"\)/);
});

test("F1.3 create and update persist the normalized FlightInput semantic field set",()=>{
  const normalizedFields=[
    "date","evidence","registration","aircraftType","aircraftClass","regulatoryCategory",
    "balloonClass","balloonGroup","balloonOperation","launchMethod","launches",
    "offBlock","takeoff","landing","onBlock","starts","instructor","role","task","purposeCode",
    "billingBasis","note","operationType","engineType","operatorName","flightNumber","operationContext",
    "landingsDay","landingsNight","movementEvidenceRecorded","takeoffsDay","takeoffsNight",
    "approachesDay","approachesNight","nightMinutes","ifrMinutes","picMinutes","copilotMinutes",
    "dualMinutes","instructorMinutes","verificationName","verificationReference",
  ];
  for(const [name,block] of [["create",create],["update",update]] as const){
    for(const field of normalizedFields)assert.ok(block.includes(`f.${field}`),`${name} must persist normalized f.${field}`);
    assert.match(block,/canonicalAirportIdent\(f\.departure\)/,name);
    assert.match(block,/canonicalAirportIdent\(f\.arrival\)/,name);
    assert.match(block,/p\.commander/,name);
  }
});

test("F1.3 preserves expense child persistence outside FlightInput",()=>{
  for(const [name,block] of [["create",create],["update",update]] as const){
    assert.match(block,/expenseResult=parseFlightExpenses\(form\)/,name);
    assert.match(block,/expenseJson=JSON\.stringify\(expenseResult\.data\.map/,name);
    assert.match(block,/INSERT INTO flight_expenses\(user_id,flight_id,category,label,amount_minor,currency\)/,name);
  }
  assert.doesNotMatch(parser,/flight_expenses|expenseJson|expenseCategory/);
});

test("F1.3 preserves connected Actual-PIC validation and child-link semantics",()=>{
  for(const [name,block] of [["create",create],["update",update]] as const){
    assert.match(block,/connectedPicUserId=connectedPicSelection\(form,f\.role\)/,name);
    assert.match(block,/f\.role==="SAFETY PILOT"&&f\.evidence==="EASA"&&connectedPicUserId===0&&!f\.commander\.trim\(\)/,name);
    assert.match(block,/INSERT INTO flight_connected_crew\(source_flight_id,source_user_id,connected_user_id,intended_role,updated_at\)/,name);
    assert.match(block,/pc\.status='accepted'/,name);
  }
  assert.match(update,/DELETE FROM flight_connected_crew[\s\S]*connectedPicUserId\}=0/,);
  assert.doesNotMatch(parser,/flight_connected_crew|pilot_connections|connectedPicUserId/);
});

test("F1.3 preserves create duplicate protection from normalized identity",()=>{
  assert.match(create,/flightFingerprint\(userId,\{date:f\.date,registration:f\.registration,offBlock:f\.offBlock,departure,arrival\}\)/);
  assert.match(create,/pg_advisory_xact_lock\(hashtextextended\(\$\{fingerprint\},0\)\)/);
  assert.match(create,/WHERE NOT EXISTS\(SELECT 1 FROM flights WHERE user_id=\$\{userId\} AND date::text=\$\{f\.date\}/);
  assert.match(create,/This flight already exists\. Duplicate submission was blocked\./);
});

test("F1.3 preserves update lock, correction and stored-price boundaries",()=>{
  assert.match(update,/SELECT registration,date::text date,price_per_hour,locked_at,certified_at FROM flights/);
  assert.match(update,/if\(existing\.locked_at\)return\{error:"This flight is locked\. Unlock it before editing\."\}/);
  assert.match(update,/connectedPicUserId>0&&existing\.certified_at/);
  assert.match(update,/shouldResolveStoredPrice\(existing,f\.registration,f\.date\)/);
  assert.match(update,/WHERE flight\.id=\$\{id\} AND flight\.user_id=\$\{userId\} AND flight\.locked_at IS NULL/);
});

test("F1.3 Manual persistence boundary remains intact while F1.4 converges GPS semantics",()=>{
  assert.match(gps,/validateGpsImportRole/);
  assert.match(gps,/resolveGpsImportAircraftContext/);
  assert.match(gps,/gpsFlightCandidate/);
  assert.match(gps,/normalizeFlightDraft\(candidate\)/);
  assert.match(gps,/sql\.transaction\(\[\.\.\.locks,\.\.\.inserts\]\)/);
});
