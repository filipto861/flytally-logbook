import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root=path.resolve(import.meta.dirname,"..");
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");
const between=(source:string,start:string,end:string)=>{const a=source.indexOf(start),b=source.indexOf(end,a+start.length);assert.ok(a>=0&&b>a,`Missing source range: ${start}`);return source.slice(a,b)};

test("SP2 New Flight loads explicit accepted PIC connection ids separately from instructor suggestions",()=>{
  const page=read("app/(protected)/flights/new/page.tsx");
  const helper=read("lib/flight-connected-crew.ts");
  assert.match(page,/getAcceptedPicConnections\(userId\)/);
  assert.match(page,/picConnections=\{picConnections\}/);
  assert.match(helper,/SELECT DISTINCT u\.id,u\.display_name/);
  assert.match(helper,/c\.status='accepted'/);
  assert.match(helper,/requester_user_id=\$\{sourceUserId\} OR c\.recipient_user_id=\$\{sourceUserId\}/);
});

test("SP2 Safety Pilot UI keeps connected identity explicit and manual text first-class",()=>{
  const form=read("components/flight-form.tsx");
  assert.match(form,/Actual PIC source/);
  assert.match(form,/name="actualPicMode"/);
  assert.match(form,/name="connectedPicUserId"/);
  assert.match(form,/Enter name manually/);
  assert.match(form,/FlyTally Connection/);
  assert.match(form,/Manual text remains valid and is not linked to a FlyTally account/);
  assert.match(form,/No invitation is sent when this draft is saved/);
  assert.match(form,/connection unavailable/);
});

test("SP2 create canonicalizes connected commander server-side and creates the link in the same statement",()=>{
  const actions=read("app/(protected)/flights/actions.ts");
  const create=between(actions,"export async function createFlight","export async function importKmlFlight");
  assert.match(create,/connectedPicSelection\(form,f\.role\)/);
  assert.match(create,/u\.id=\$\{connectedPicUserId\}/);
  assert.match(create,/pc\.status='accepted'/);
  assert.match(create,/THEN u\.display_name ELSE \$\{f\.commander\} END commander/);
  assert.match(create,/INSERT INTO flight_connected_crew/);
  assert.match(create,/FROM inserted CROSS JOIN pic_context p/);
  assert.doesNotMatch(create,/flight_participations/);
});

test("SP2 update synchronizes current link atomically and removes it for manual or non-Safety-Pilot state",()=>{
  const actions=read("app/(protected)/flights/actions.ts");
  const update=between(actions,"export async function updateFlight","export async function saveFlightExpenses");
  assert.match(actions,/function connectedPicSelection\(form:FormData,role:string\)\{if\(role!=="SAFETY PILOT"\)return 0;const mode=String\(form\.get\("actualPicMode"\)/);
  assert.match(update,/commander=p\.commander/);
  assert.match(update,/deleted_link AS/);
  assert.match(update,/connected_link AS/);
  assert.match(update,/\$\{connectedPicUserId\}=0 AND EXISTS\(SELECT 1 FROM updated\)/);
  assert.match(update,/ON CONFLICT\(source_flight_id,intended_role\) DO UPDATE/);
  assert.doesNotMatch(update,/flight_participations/);
});

test("SP2 edit reloads stored connected identity by flight id instead of matching commander text",()=>{
  const page=read("app/(protected)/flights/[id]/page.tsx");
  const helper=read("lib/flight-connected-crew.ts");
  assert.match(page,/getConnectedPicLink\(userId,id\)/);
  assert.match(page,/connectedPic=\{connectedPicInitial\}/);
  assert.match(page,/picConnections=\{picConnections\}/);
  assert.match(helper,/WHERE c\.source_flight_id=\$\{sourceFlightId\} AND c\.source_user_id=\$\{sourceUserId\} AND c\.intended_role='PIC'/);
  assert.doesNotMatch(helper,/commander/);
});


test("SP2 browser coverage exercises manual and connected Actual PIC modes on the v15 fixture",()=>{
  const browser=read("e2e/public-shell.spec.mjs");
  const db=read("e2e/browser-db.mjs");
  const bootstrap=read("tooling/bootstrap-browser-smoke-db.mjs");
  assert.match(browser,/Safety Pilot Actual PIC form keeps manual and connected identity explicit/);
  assert.match(browser,/selectOption\("SAFETY PILOT"\)/);
  assert.match(browser,/selectOption\("connected"\)/);
  assert.match(browser,/selectOption\("9002"\)/);
  assert.match(browser,/fill\("Manual Captain"\)/);
  assert.match(db,/resetSafetyPilotPicFixture/);
  assert.match(bootstrap,/generate_series\(1,15\)/);
  assert.match(bootstrap,/CREATE TABLE flight_connected_crew/);
  assert.match(bootstrap,/CREATE TABLE flight_expenses/);
  assert.match(bootstrap,/balloon_operation TEXT NOT NULL DEFAULT/);
  assert.match(bootstrap,/purpose_code TEXT NOT NULL DEFAULT/);
  assert.match(bootstrap,/verification_reference TEXT NOT NULL DEFAULT/);
  assert.match(bootstrap,/CREATE TABLE aircraft/);
});


test("SP2 rejects a blank manual EASA Safety Pilot PIC server-side",()=>{
  const actions=read("app/(protected)/flights/actions.ts");
  const matches=actions.match(/f\.role==="SAFETY PILOT"&&f\.evidence==="EASA"&&connectedPicUserId===0&&!f\.commander\.trim\(\)/g)??[];
  assert.equal(matches.length,2);
  assert.match(actions,/Enter the actual PIC or select an accepted Connection/);
});


test("SP2 new Safety Pilot manual PIC starts blank instead of inheriting the source pilot name",()=>{
  const form=read("components/flight-form.tsx");
  assert.match(form,/\[manualCommander,setManualCommander\]=useState\(editing&&initialRole==="SAFETY PILOT"\?field\("commander"\):""\)/);
});


test("SP2 connected mode is explicit and cannot silently degrade to manual when no pilot is selected",()=>{
  const actions=read("app/(protected)/flights/actions.ts");
  const form=read("components/flight-form.tsx");
  assert.match(actions,/if\(mode==="manual"\)return 0;if\(mode!=="connected"\)return-1/);
  assert.match(actions,/if\(!raw\)return-1/);
  assert.match(form,/name="actualPicMode"/);
  assert.ok(form.includes('<select name="connectedPicUserId" value={connectedPicUserId} onChange={event=>setConnectedPicUserId(event.target.value)} required aria-invalid={!connectedPicUserId||!connectedPicAccepted}>'));
  assert.match(form,/picMode==="connected"\?\(!connectedPicUserId\|\|!connectedPicAccepted\)/);
  assert.ok(form.includes('<span>Actual PIC <span className="field-hint" aria-hidden="true">Required</span></span><select name="connectedPicUserId"'));
});


test("SP2 prevents the action reset from clearing controlled flight fields after save",()=>{
  const form=read("components/flight-form.tsx");
  assert.match(form,/onReset=\{event=>event\.preventDefault\(\)\}/);
  assert.match(form,/select name="registration" value=\{registration\}/);
  assert.match(form,/select name="role" value=\{role\}/);
});
