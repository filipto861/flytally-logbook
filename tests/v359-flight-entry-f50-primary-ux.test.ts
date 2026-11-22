import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { roleCrewSpec } from "../lib/role-crew.ts";

const root=path.resolve(import.meta.dirname,"..");
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");

test("F5.0 PIC stays simple while role-required identity remains inline from the canonical RoleCrew contract",()=>{
  const pic=roleCrewSpec("PIC","EASA");
  const dual=roleCrewSpec("DUAL","EASA");
  const safety=roleCrewSpec("SAFETY PILOT","EASA");
  const spic=roleCrewSpec("SPIC","EASA");
  const picus=roleCrewSpec("PICUS","EASA");

  assert.equal(pic?.rolePicIdentitySource,"SELF");
  assert.equal(dual?.rolePicIdentitySource,"INSTRUCTOR");
  assert.equal(safety?.connectedActualPic,"allowed");
  assert.equal(spic?.rolePicIdentitySource,"VERIFIER");
  assert.equal(picus?.rolePicIdentitySource,"VERIFIER");

  const form=read("components/flight-form.tsx");
  const essentials=form.slice(form.indexOf('entry-section entry-section-primary'),form.indexOf('entry-section entry-section-experience'));
  for(const token of ["Instructor / PIC","Actual PIC source","Actual PIC","Supervising PIC / FI","Countersignature reference"])assert.ok(essentials.includes(token),token);
});

test("F5 does not move Date UTC or certification completeness into copy simplification",()=>{
  const form=read("components/flight-form.tsx");
  const compliance=read("lib/fcl050-compliance.ts");
  assert.match(form,/name="date" type="date"/);
  assert.equal((form.match(/>UTC</g)??[]).length,1);
  assert.match(compliance,/Departure time must be recorded in UTC\./);
  assert.match(compliance,/Arrival time must be recorded in UTC\./);
  assert.doesNotMatch(form,/route and times|required before certification/i);
});
