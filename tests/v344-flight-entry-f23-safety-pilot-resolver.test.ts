import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root=path.resolve(import.meta.dirname,"..");
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");
const between=(source:string,start:string,end:string)=>{const a=source.indexOf(start),b=source.indexOf(end,a+start.length);assert.ok(a>=0&&b>a,`Missing range: ${start}`);return source.slice(a,b)};

test("F2.3 owns Safety Pilot Manual/Connection resolution in one server helper",()=>{
  const helper=read("lib/flight-connected-crew.ts");
  assert.match(helper,/export async function resolveSafetyPilotPicForSave/);
  assert.match(helper,/if\(role!=="SAFETY PILOT"\)return\{ok:true,mode:"not_applicable",commander,connectedUserId:0\}/);
  assert.match(helper,/if\(mode==="manual"\)\{/);
  assert.match(helper,/if\(evidence==="EASA"&&!commander\.trim\(\)\)/);
  assert.match(helper,/return\{ok:true,mode:"manual",commander,connectedUserId:0\}/);
  assert.match(helper,/if\(mode!=="connected"\)return\{ok:false,error:"Select a valid connected Actual PIC\."\}/);
  assert.match(helper,/connectedUserId===sourceUserId/);
  assert.match(helper,/commander:snapshot\.displayName,connectedUserId:snapshot\.id/);
  assert.doesNotMatch(helper,/display_name\s*=\s*\$\{commander\}|ILIKE|LOWER\([^)]*display_name/);
});

test("F2.3 accepted Connection lookup is account-id based and server-authoritative",()=>{
  const helper=read("lib/flight-connected-crew.ts");
  const start=helper.indexOf("async function acceptedPicSnapshot");
  const end=helper.indexOf("export async function resolveSafetyPilotPicForSave",start);
  assert.ok(start>=0&&end>start);
  const resolver=helper.slice(start,end);
  assert.match(resolver,/WHERE u\.id=\$\{connectedUserId\}/);
  assert.match(resolver,/u\.id<>\$\{sourceUserId\}/);
  assert.match(resolver,/NULLIF\(TRIM\(u\.display_name\),' '\)|NULLIF\(TRIM\(u\.display_name\),''\)/);
  assert.match(resolver,/pc\.status='accepted'/);
  assert.match(resolver,/pc\.requester_user_id=\$\{sourceUserId\} AND pc\.recipient_user_id=u\.id/);
  assert.match(resolver,/pc\.recipient_user_id=\$\{sourceUserId\} AND pc\.requester_user_id=u\.id/);
});

test("F2.3 create and update both consume the shared resolver and no longer embed independent PIC context resolvers",()=>{
  const actions=read("app/(protected)/flights/actions.ts");
  const create=between(actions,"export async function createFlight","export async function importKmlFlight");
  const update=between(actions,"export async function updateFlight","export async function saveFlightExpenses");
  for(const [name,block] of [["create",create],["update",update]] as const){
    assert.match(block,/picResolution=await resolveSafetyPilotPicForSave\(/,name);
    assert.match(block,/connectedPicUserId=picResolution\.connectedUserId,commander=picResolution\.commander/,name);
    assert.ok(block.includes("${commander}"),name);
    assert.match(block,/INSERT INTO flight_connected_crew\(source_flight_id,source_user_id,connected_user_id,intended_role,updated_at\)/,name);
    assert.match(block,/\$\{connectedPicUserId\}=0 OR EXISTS\(/,name);
    assert.match(block,/pc\.status='accepted'/,name);
    assert.doesNotMatch(block,/pic_context AS|connectedPicSelection/,name);
  }
  assert.doesNotMatch(actions,/function connectedPicSelection/);
});

test("F2.3 persistence rechecks Connection state in the write statement and fails without partial child mutation",()=>{
  const actions=read("app/(protected)/flights/actions.ts");
  const create=between(actions,"export async function createFlight","export async function importKmlFlight");
  const update=between(actions,"export async function updateFlight","export async function saveFlightExpenses");
  assert.match(create,/WHERE \(\$\{connectedPicUserId\}=0 OR EXISTS\([\s\S]*pc\.status='accepted'[\s\S]*\)\)[\s\S]*AND NOT EXISTS/);
  assert.match(create,/FROM inserted[\s\S]*WHERE \$\{connectedPicUserId\}>0[\s\S]*ON CONFLICT\(source_flight_id,intended_role\) DO UPDATE/);
  assert.match(update,/WHERE flight\.id=\$\{id\}[\s\S]*\$\{connectedPicUserId\}=0 OR EXISTS\([\s\S]*pc\.status='accepted'/);
  assert.match(update,/DELETE FROM flight_expenses[\s\S]*EXISTS\(SELECT 1 FROM updated\)/);
  assert.match(update,/DELETE FROM flight_connected_crew[\s\S]*EXISTS\(SELECT 1 FROM updated\)/);
  assert.match(update,/FROM updated[\s\S]*WHERE \$\{connectedPicUserId\}>0/);
});

test("F2.3 reuses the same resolver for post-write race classification",()=>{
  const actions=read("app/(protected)/flights/actions.ts");
  const create=between(actions,"export async function createFlight","export async function importKmlFlight");
  const update=between(actions,"export async function updateFlight","export async function saveFlightExpenses");
  for(const block of [create,update]){
    const calls=block.match(/resolveSafetyPilotPicForSave\(/g)??[];
    assert.equal(calls.length,2);
    assert.match(block,/if\(connectedPicUserId>0\)\{const recheck=await resolveSafetyPilotPicForSave/);
    assert.match(block,/if\(!recheck\.ok\)return\{error:recheck\.error\}/);
  }
});

test("F2.3 keeps collaboration, certification and GPS scope outside the resolver",()=>{
  const helper=read("lib/flight-connected-crew.ts");
  const actions=read("app/(protected)/flights/actions.ts");
  const gps=between(actions,"export async function importKmlFlight","export async function updateFlight");
  assert.doesNotMatch(helper,/flight_participations|certification_hash|certification_version|gpsFlightCandidate|normalizeFlightDraft/);
  assert.doesNotMatch(gps,/resolveSafetyPilotPicForSave|flight_connected_crew/);
  assert.match(gps,/resolveGpsImportCommonRoleCrew/);
});
