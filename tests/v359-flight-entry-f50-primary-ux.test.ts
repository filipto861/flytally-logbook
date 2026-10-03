import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { roleCrewSpec } from "../lib/role-crew.ts";

const root=path.resolve(import.meta.dirname,"..");
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");

test("F5.0 keeps Manual New, Manual Edit and GPS ownership explicit",()=>{
  const newPage=read("app/(protected)/flights/new/page.tsx");
  const detail=read("app/(protected)/flights/[id]/page.tsx");
  const gps=read("components/kml-import-form.tsx");
  const dashboard=read("app/(protected)/dashboard/page.tsx");

  assert.match(newPage,/<KmlImportForm/);
  assert.match(newPage,/<FlightForm/);
  assert.match(detail,/<FlightForm/);
  assert.doesNotMatch(gps,/FlightForm/);
  assert.doesNotMatch(dashboard,/FlightForm/);
  assert.match(dashboard,/href="\/flights\/new"/);
});

test("F5.0 common Manual base controls remain the frozen Date Aircraft Role Route Timeline set",()=>{
  const form=read("components/flight-form.tsx");
  const start=form.indexOf('entry-section entry-section-primary');
  const end=form.indexOf('entry-section entry-section-experience',start);
  assert.ok(start>=0&&end>start);
  const essentials=form.slice(start,end);

  const ordered=[
    'name="date"',
    'name="registration"',
    'name="role"',
    'essential-route-group',
    'name="departure"',
    'name="arrival"',
    'essential-time-group',
    'name="offBlock"',
    'name="takeoff"',
    'name="landing"',
    'name="onBlock"',
    'flight-time-summary',
  ].map(token=>essentials.indexOf(token));

  assert.ok(ordered.every(index=>index>=0));
  assert.deepEqual([...ordered].sort((a,b)=>a-b),ordered);
  assert.equal((essentials.match(/>UTC</g)??[]).length,1);
  assert.match(essentials,/className="flight-time-summary" aria-live="polite"/);
  assert.doesNotMatch(essentials,/aria-describedby/);
});

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

test("F5.0 preserves progressive disclosure for non-core Manual detail",()=>{
  const form=read("components/flight-form.tsx");
  assert.match(form,/\[experienceOpen,setExperienceOpen\]=useState\(editing\)/);
  assert.match(form,/\[crewOpen,setCrewOpen\]=useState\(editing&&initialAdditionalCrew\)/);
  assert.match(form,/\[optionalDetailsOpen,setOptionalDetailsOpen\]=useState\(editing&&optionalInitialPopulated\)/);
  assert.match(form,/className="entry-section aircraft-context-section" open=\{logbookOpen\}/);
  assert.match(form,/if\(profileNeedsConfiguration\)setLogbookOpen\(true\)/);
  assert.match(form,/<summary><span>Optional details<\/span>/);
});

test("F5.1 removes duplicated New Flight workflow prose but preserves the draft-review consequence at Save",()=>{
  const page=read("app/(protected)/flights/new/page.tsx");
  const form=read("components/flight-form.tsx");
  const workspace=read("components/flight-entry-workspace.tsx");

  assert.match(page,/<p className="eyebrow">LOGBOOK<\/p><h1>New flight<\/h1>/);
  assert.doesNotMatch(page,/Log a flight manually or import a GPS track/);
  assert.match(workspace,/>Manual entry<\/strong>/);
  assert.match(workspace,/>Import GPS track<\/strong>/);
  assert.match(form,/Creates an editable draft for final review\./);
  assert.match(form,/>\{editing\?"Save changes":"Save & review"\}<\/PendingActionButton>/);
});

test("F5.2 keeps Role default provenance concise and New-only",()=>{
  const form=read("components/flight-form.tsx");
  assert.match(form,/!editing&&selected&&role===profileRole\?<small>Aircraft default<\/small>:null/);
  assert.doesNotMatch(form,/Aircraft default · change if this flight differed\./);
  assert.match(form,/\[role,setRole\]=useState<string>\(initialRole\)/);
});

test("F5.2 preserves Registration management and unresolved-profile recovery",()=>{
  const form=read("components/flight-form.tsx");
  assert.match(form,/registration\?<small><Link href="\/database">Manage aircraft<\/Link><\/small>:null/);
  assert.match(form,/Open Aircraft without losing this draft/);
  assert.match(form,/href="\/database" target="_blank" rel="noreferrer" data-aircraft-config-link/);
});

test("F5.2 trims only resolved New-flight BLOCK AIR explanation while preserving authority and live updates",()=>{
  const form=read("components/flight-form.tsx");
  const at=form.indexOf('className="flight-time-summary"');
  const end=form.indexOf('<details className="entry-section entry-section-experience"',at);
  assert.ok(at>=0&&end>at);
  const summary=form.slice(at,end);

  assert.match(summary,/aria-live="polite"/);
  assert.match(summary,/BFCL flight time is taken from take-off to landing \(AIR\)\./);
  assert.match(summary,/editing\?<small>\{blockMinutes\|\|airMinutes\?"Calculated automatically from the timeline above\.":"Enter times above to calculate BLOCK and AIR\."\}<\/small>/);
  assert.match(summary,/:blockMinutes&&airMinutes\?null:<small>Enter times above to calculate BLOCK and AIR\.<\/small>/);
  assert.doesNotMatch(summary,/aria-describedby/);
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
