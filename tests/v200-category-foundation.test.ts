import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  aircraftCategoryCapabilities,
  legacyRegulatoryAircraftCategory,
  REGULATORY_AIRCRAFT_CATEGORIES,
  resolveRegulatoryAircraftCategory,
} from "../lib/aircraft-category.ts";
import {aircraftProfileRegulatoryCategory,normalizeAircraftProfileContext} from "../lib/aircraft-profile-context.ts";
import {flightEntryProfile,regulatoryAircraftCategory} from "../lib/flight-entry-profile.ts";

const root=path.resolve(import.meta.dirname,"..");
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");

test("v2.0-A exposes one canonical regulatory category vocabulary",()=>{
  assert.deepEqual(REGULATORY_AIRCRAFT_CATEGORIES,["AEROPLANE","HELICOPTER","BALLOON","SAILPLANE","ULL","OTHER"]);
  assert.equal(regulatoryAircraftCategory({aircraftClass:"SEP",evidence:"EASA"}),"AEROPLANE");
  assert.equal(regulatoryAircraftCategory({aircraftClass:"HELICOPTER",evidence:"EASA"}),"HELICOPTER");
  assert.equal(regulatoryAircraftCategory({aircraftClass:"BALLOON",evidence:"EASA"}),"BALLOON");
  assert.equal(regulatoryAircraftCategory({aircraftClass:"GLIDER",evidence:"EASA"}),"SAILPLANE");
  assert.equal(regulatoryAircraftCategory({aircraftClass:"ULL",evidence:"ULL"}),"ULL");
});

test("v2.0-A preserves legacy TMG as Part-FCL until an explicit SPL snapshot exists",()=>{
  assert.equal(legacyRegulatoryAircraftCategory({aircraftClass:"TMG",evidence:"EASA"}),"AEROPLANE");
  assert.equal(resolveRegulatoryAircraftCategory({aircraftClass:"TMG",evidence:"EASA"}),"AEROPLANE");
  assert.equal(resolveRegulatoryAircraftCategory({regulatoryCategory:"SAILPLANE",aircraftClass:"TMG",evidence:"EASA"}),"SAILPLANE");
  assert.equal(aircraftProfileRegulatoryCategory("EASA","TMG"),"AEROPLANE");
  assert.equal(aircraftProfileRegulatoryCategory("EASA","TMG","SAILPLANE"),"SAILPLANE");
});

test("v2.0-A category capabilities keep regulatory evidence families separate",()=>{
  const aeroplane=aircraftCategoryCapabilities({regulatoryCategory:"AEROPLANE",aircraftClass:"SEP",evidence:"EASA"});
  assert.equal(aeroplane.timeEntryMode,"STANDARD");
  assert.equal(aeroplane.movementEvidenceMode,"FCL060_PF");
  assert.equal(aeroplane.recencyFamily,"PART_FCL_A");
  assert.equal(aeroplane.supportsFcl060MovementEvidence,true);

  const helicopter=aircraftCategoryCapabilities({regulatoryCategory:"HELICOPTER",aircraftClass:"HELICOPTER",evidence:"EASA"});
  assert.equal(helicopter.movementEvidenceMode,"FCL060_PF");
  assert.equal(helicopter.recencyFamily,"PART_FCL_H");
  assert.equal(helicopter.requiresTypeSpecificRecency,true);

  const balloon=aircraftCategoryCapabilities({regulatoryCategory:"BALLOON",aircraftClass:"BALLOON",evidence:"EASA"});
  assert.equal(balloon.timeEntryMode,"STANDARD");
  assert.equal(balloon.movementEvidenceMode,"BFCL_TAKEOFF_LANDING");
  assert.equal(balloon.recencyFamily,"PART_BFCL");
  assert.equal(balloon.supportsFcl060MovementEvidence,false);

  const ull=aircraftCategoryCapabilities({regulatoryCategory:"ULL",aircraftClass:"ULL",evidence:"ULL"});
  assert.equal(ull.movementEvidenceMode,"FCL060_PF");
  assert.equal(ull.recencyFamily,"ULL");
  assert.equal(ull.supportsFcl060MovementEvidence,true);
});

test("v2.0-A distinguishes non-TMG sailplane launch evidence from SPL TMG take-off evidence",()=>{
  const glider=aircraftCategoryCapabilities({regulatoryCategory:"SAILPLANE",aircraftClass:"GLIDER",evidence:"EASA"});
  assert.equal(glider.timeEntryMode,"SAILPLANE_LAUNCH");
  assert.equal(glider.movementEvidenceMode,"SFCL_LAUNCH");
  assert.equal(glider.recencyFamily,"PART_SFCL");

  const tmg=aircraftCategoryCapabilities({regulatoryCategory:"SAILPLANE",aircraftClass:"TMG",evidence:"EASA"});
  assert.equal(tmg.isTmg,true);
  assert.equal(tmg.timeEntryMode,"STANDARD");
  assert.equal(tmg.movementEvidenceMode,"SFCL_TMG");
  assert.equal(tmg.supportsFcl060MovementEvidence,false);

  const profile=flightEntryProfile({hasAircraft:true,regulatoryCategory:"SAILPLANE",aircraftClass:"TMG",evidence:"EASA"});
  assert.equal(profile.showStandardExperience,true);
  assert.equal(profile.showSailplaneExperience,false);
  assert.equal(profile.showRegulatoryMovements,false);
});

test("v2.0-A unknown category is conservative and the capability layer is persistence-free",()=>{
  const unknown=aircraftCategoryCapabilities({aircraftClass:"OTHER",evidence:"EASA"});
  assert.equal(unknown.regulatoryCategory,"OTHER");
  assert.equal(unknown.category,"other");
  assert.equal(unknown.movementEvidenceMode,"NONE");
  assert.equal(unknown.recencyFamily,"NONE");
  assert.equal(unknown.supportsFcl060MovementEvidence,false);

  const source=read("lib/aircraft-category.ts");
  assert.doesNotMatch(source,/certified_at|sql`|\bINSERT\b|\bUPDATE\b|\bDELETE\b/);
  assert.match(source,/never grants privileges/);
});

test("v2.0-A aircraft profile normalization remains backward compatible",()=>{
  assert.deepEqual(normalizeAircraftProfileContext("ULL","SEP","AEROPLANE").context,{evidence:"ULL",aircraftClass:"ULL",regulatoryCategory:"ULL"});
  assert.deepEqual(normalizeAircraftProfileContext("EASA","GLIDER","AEROPLANE").context,{evidence:"EASA",aircraftClass:"GLIDER",regulatoryCategory:"SAILPLANE"});
  assert.deepEqual(normalizeAircraftProfileContext("EASA","HELICOPTER","AEROPLANE").context,{evidence:"EASA",aircraftClass:"HELICOPTER",regulatoryCategory:"HELICOPTER"});
  assert.deepEqual(normalizeAircraftProfileContext("EASA","BALLOON","AEROPLANE").context,{evidence:"EASA",aircraftClass:"BALLOON",regulatoryCategory:"BALLOON"});
});
