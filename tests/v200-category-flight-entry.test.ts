import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import {aircraftCategoryCapabilities} from "../lib/aircraft-category.ts";
import {flightEntryProfile} from "../lib/flight-entry-profile.ts";
import {supportsProfessionalContext} from "../lib/professional-context.ts";

const root=path.resolve(import.meta.dirname,"..");
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");

test("v2.0-B exposes regulatory labels and category-specific technical controls",()=>{
  const aeroplane=flightEntryProfile({hasAircraft:true,regulatoryCategory:"AEROPLANE",aircraftClass:"SEP",evidence:"EASA"});
  assert.equal(aeroplane.regulatoryLabel,"Part-FCL");
  assert.equal(aeroplane.showOperationEngineControls,true);
  const helicopter=flightEntryProfile({hasAircraft:true,regulatoryCategory:"HELICOPTER",aircraftClass:"HELICOPTER",evidence:"EASA"});
  assert.equal(helicopter.showOperationEngineControls,true);
  const balloon=flightEntryProfile({hasAircraft:true,regulatoryCategory:"BALLOON",aircraftClass:"BALLOON",evidence:"EASA"});
  assert.equal(balloon.regulatoryLabel,"Part-BFCL");
  assert.equal(balloon.showOperationEngineControls,false);
  const glider=flightEntryProfile({hasAircraft:true,regulatoryCategory:"SAILPLANE",aircraftClass:"GLIDER",evidence:"EASA"});
  assert.equal(glider.regulatoryLabel,"Part-SFCL");
  assert.equal(glider.showOperationEngineControls,false);
  const tmg=flightEntryProfile({hasAircraft:true,regulatoryCategory:"SAILPLANE",aircraftClass:"TMG",evidence:"EASA"});
  assert.equal(tmg.showOperationEngineControls,true);
});

test("v2.0-B keeps professional context category-aware without guessing",()=>{
  assert.equal(supportsProfessionalContext({evidence:"EASA",regulatoryCategory:"AEROPLANE"}),true);
  assert.equal(supportsProfessionalContext({evidence:"EASA",regulatoryCategory:"HELICOPTER"}),true);
  assert.equal(supportsProfessionalContext({evidence:"EASA",regulatoryCategory:"SAILPLANE"}),false);
  assert.equal(supportsProfessionalContext({evidence:"EASA",regulatoryCategory:"BALLOON"}),false);
  assert.equal(supportsProfessionalContext({evidence:"ULL",regulatoryCategory:"ULL"}),false);
});

test("v2.0-B preserves distinct movement evidence modes in the entry workspace",()=>{
  assert.equal(aircraftCategoryCapabilities({regulatoryCategory:"AEROPLANE",aircraftClass:"SEP",evidence:"EASA"}).movementEvidenceMode,"FCL060_PF");
  assert.equal(aircraftCategoryCapabilities({regulatoryCategory:"SAILPLANE",aircraftClass:"GLIDER",evidence:"EASA"}).movementEvidenceMode,"SFCL_LAUNCH");
  assert.equal(aircraftCategoryCapabilities({regulatoryCategory:"SAILPLANE",aircraftClass:"TMG",evidence:"EASA"}).movementEvidenceMode,"SFCL_TMG");
  assert.equal(aircraftCategoryCapabilities({regulatoryCategory:"BALLOON",aircraftClass:"BALLOON",evidence:"EASA"}).movementEvidenceMode,"BFCL_TAKEOFF_LANDING");
});

test("v2.0-B FlightForm consumes capabilities instead of duplicating the main category branches",()=>{
  const form=read("components/flight-form.tsx");
  assert.match(form,/entryProfile[.]movementEvidenceMode==="SFCL_TMG"/);
  assert.match(form,/entryProfile[.]movementEvidenceMode==="BFCL_TAKEOFF_LANDING"/);
  assert.match(form,/entryProfile[.]supportsProfessionalContext/);
  assert.match(form,/entryProfile[.]showOperationEngineControls/);
  assert.match(form,/type="hidden" name="operationType"/);
  assert.match(form,/Part-BFCL/);
  assert.match(form,/Part-SFCL/);
});
