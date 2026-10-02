import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { flightFingerprint } from "../lib/flight-dedup.ts";
import { GPS_IMPORT_ROLES,validateGpsImportRole } from "../lib/gps-import-integrity.ts";

const root=path.resolve(import.meta.dirname,"..");
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");
const between=(source:string,start:string,end:string)=>{const a=source.indexOf(start),b=source.indexOf(end,a+start.length);assert.ok(a>=0&&b>a,`Missing range: ${start}`);return source.slice(a,b)};

test("F4.0 characterizes Manual and GPS RoleCrew persistence columns before multi-role expansion",()=>{
  const actions=read("app/(protected)/flights/actions.ts");
  const manual=between(actions,"export async function createFlight","export async function importKmlFlight");
  const gps=between(actions,"export async function importKmlFlight","export async function updateFlight");

  for(const [name,block] of [["Manual",manual],["GPS",gps]] as const){
    for(const column of ["commander","instructor","role","verification_name","verification_reference"]){
      assert.match(block,new RegExp(`INSERT INTO flights\\s*\\([\\s\\S]*?\\b${column}\\b`),`${name} must persist ${column}`);
    }
  }

  assert.ok(manual.includes("${commander}"));
  assert.ok(manual.includes("${f.instructor}"));
  assert.ok(manual.includes("${f.role}"));
  assert.ok(manual.includes("${f.verificationName}"));
  assert.ok(manual.includes("${f.verificationReference}"));

  assert.ok(gps.includes("${item.input.commander}"));
  assert.ok(gps.includes("${item.input.instructor}"));
  assert.ok(gps.includes("${item.input.role}"));
  assert.ok(gps.includes("${item.input.verificationName}"));
  assert.ok(gps.includes("${item.input.verificationReference}"));
});

test("F4.0 duplicate identity remains RoleCrew-independent",()=>{
  const identity={date:"2026-10-02",registration:"OK-F40",offBlock:"10:00",departure:"LKPR",arrival:"LKLT"};
  const fingerprint=flightFingerprint(9001,identity);
  assert.equal(fingerprint,"9001|2026-10-02|OK-F40|10:00|LKPR|LKLT");

  const source=read("lib/flight-dedup.ts");
  assert.match(source,/export type FlightIdentity=\{date:unknown;registration:unknown;offBlock:unknown;departure:unknown;arrival:unknown\}/);
  assert.doesNotMatch(source,/role|commander|instructor|verification/i);
});

test("F4.0 temporary PIC-only boundary is superseded only by the F4.1 common PIC/DUAL gate",()=>{
  assert.deepEqual([...GPS_IMPORT_ROLES],["PIC","DUAL"]);
  assert.deepEqual(validateGpsImportRole("PIC"),{role:"PIC"});
  assert.deepEqual(validateGpsImportRole("DUAL"),{role:"DUAL"});
  for(const role of ["SPIC","PICUS","SAFETY PILOT"]){
    assert.match(validateGpsImportRole(role).error??"",/supports PIC and DUAL/i,role);
  }

  const form=read("components/kml-import-form.tsx");
  assert.match(form,/GPS_IMPORT_ROLES\.map\(value=><option/);
});

test("F4.0 records that Safety Pilot authority is not yet wired into GPS",()=>{
  const actions=read("app/(protected)/flights/actions.ts");
  const manual=between(actions,"export async function createFlight","export async function importKmlFlight");
  const gps=between(actions,"export async function importKmlFlight","export async function updateFlight");
  const helper=read("lib/flight-connected-crew.ts");

  assert.match(manual,/resolveSafetyPilotPicForSave/);
  assert.match(manual,/flight_connected_crew/);
  assert.match(manual,/pc\.status='accepted'/);

  assert.doesNotMatch(gps,/resolveSafetyPilotPicForSave/);
  assert.doesNotMatch(gps,/flight_connected_crew/);

  assert.match(helper,/WHERE u\.id=\$\{connectedUserId\}/);
  assert.match(helper,/pc\.status='accepted'/);
});

test("F4.0 shared RoleCrew contract already owns DUAL and SPIC/PICUS Save requirements",()=>{
  const roleCrew=read("lib/role-crew.ts");
  const normalizer=read("lib/flight-input.ts");

  assert.match(roleCrew,/role==="DUAL"/);
  assert.match(roleCrew,/instructor=easa\?"required_save":"optional"/);
  assert.match(roleCrew,/SUPERVISED_ROLES=new Set<RoleCrewRole>\(\["SPIC","PICUS"\]\)/);
  assert.match(roleCrew,/verificationName=easa\?"required_save":"optional"/);
  assert.match(roleCrew,/verificationReference=easa\?"required_save":"optional"/);
  assert.match(normalizer,/roleCrewSaveError\(crewSpec,\{instructor,verificationName,verificationReference\}\)/);
});
